"""LegumAmies agricultural advisor agent (Amazon Bedrock Converse + existing KB).

Design: RETRIEVAL-FIRST and grounding-first.
  1. Validate input.
  2. Deterministically gather facts from bounded tools (KB evidence, real
     AROME/AIFS forecast, sourced risk rules, weather-only harvest ranking).
  3. Compose ONE Bedrock Converse call (Amazon Nova Lite) that writes a French
     prose answer constrained to the gathered facts.
  4. Assemble the structured fields (citations, provenance, uncertainty,
     actions, limitations) DETERMINISTICALLY from the tool outputs - never from
     the model - so the model cannot invent sources, numbers, yields,
     pesticide savings, treatment authorizations or economic/environmental
     figures.

This keeps forecast information separate from agronomic evidence and clearly
distinguishes recommendations (suggestions to confirm) from verified outcomes.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone as _tz
from typing import Any

import boto3
from botocore.config import Config as BotoConfig

from . import tools
from ..api import mapping

MODEL_ID = os.getenv("LEGUMAMIES_ADVISOR_MODEL", "amazon.nova-lite-v1:0")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
MAX_QUESTION_CHARS = 1000
CONVERSE_MAX_TOKENS = 700
CONVERSE_TIMEOUT_S = 30

SYSTEM_PROMPT = (
    "Tu es LegumAmies, un conseiller agricole pour les légumineuses françaises "
    "(pois, féverole, lentille, pois chiche, soja, lupin, haricot sec).\n"
    "RÈGLES STRICTES :\n"
    "1. Utilise UNIQUEMENT les faits fournis dans le bloc CONTEXTE. N'invente "
    "aucune donnée.\n"
    "2. N'invente JAMAIS de chiffres de rendement, d'économies de produits "
    "phytosanitaires, d'autorisation de traitement, de bénéfices économiques "
    "(euros) ni d'impacts environnementaux.\n"
    "3. Sépare clairement la PRÉVISION MÉTÉO (AROME/AIFS) des PREUVES "
    "AGRONOMIQUES (Terres Inovia). Attribue chaque seuil à sa source.\n"
    "4. Un dépassement de seuil est une ALERTE de risque, pas une prédiction de "
    "dégât. Formule des suggestions à confirmer au champ, pas des certitudes.\n"
    "5. Si une donnée est indisponible (prévision, document, culture non "
    "couverte), dis-le explicitement au lieu de deviner.\n"
    "6. Réponds en français, de façon concise et pratique (5-10 phrases max). "
    "N'écris pas de balises <thinking>."
)


def _bedrock_runtime(client: Any = None):
    if client is not None:
        return client
    return boto3.client(
        "bedrock-runtime", region_name=AWS_REGION,
        config=BotoConfig(read_timeout=CONVERSE_TIMEOUT_S, connect_timeout=10,
                          retries={"max_attempts": 2, "mode": "standard"}),
    )


# --------------------------------------------------------------------------
# Input validation
# --------------------------------------------------------------------------
class AdvisorInputError(ValueError):
    pass


def _validate(field: dict, question: str) -> None:
    if not question or not question.strip():
        raise AdvisorInputError("question is empty")
    if len(question) > MAX_QUESTION_CHARS:
        raise AdvisorInputError(f"question exceeds {MAX_QUESTION_CHARS} chars")
    lat, lon = field.get("latitude"), field.get("longitude")
    if lat is not None and not (-90 <= float(lat) <= 90):
        raise AdvisorInputError("latitude out of range")
    if lon is not None and not (-180 <= float(lon) <= 180):
        raise AdvisorInputError("longitude out of range")


# --------------------------------------------------------------------------
# Deterministic gather (retrieval-first)
# --------------------------------------------------------------------------
def gather_context(field: dict, question: str, kb_client: Any = None) -> dict:
    ctx: dict = {"tools_used": [], "limitations": []}

    # (a) KB agronomic evidence - always, retrieval-first.
    kb = tools.search_documents(question, client=kb_client)
    ctx["kb"] = kb
    ctx["tools_used"].append("search_documents")
    if not kb.get("available") or not kb.get("passages"):
        ctx["limitations"].append("Aucun document agronomique pertinent trouvé dans la base de connaissances.")

    # (b) Forecast - only if coordinates provided.
    lat, lon = field.get("latitude"), field.get("longitude")
    weather_df = prob_df = None
    if lat is not None and lon is not None:
        fc = tools.get_forecast(float(lat), float(lon))
        weather_df = fc.pop("_weather_df", None)
        prob_df = fc.pop("_prob_df", None)
        ctx["forecast"] = fc
        ctx["tools_used"].append("get_forecast")
        if not fc.get("available"):
            ctx["limitations"].append("Prévision météo indisponible pour cette position.")
    else:
        ctx["forecast"] = {"available": False, "error": "coordinates not provided",
                           "data_kind": "real_weather_forecast"}
        ctx["limitations"].append("Coordonnées de la parcelle manquantes : pas de prévision météo.")

    # (c) Risk + (d) Harvest - only if crop/stage provided.
    crop, stage = field.get("crop"), field.get("growth_stage")
    if crop and stage:
        try:
            mapping.normalise_crop(crop)
            mapping.normalise_stage(stage)
            ctx["risk"] = tools.explain_risk(crop, stage, weather_df)
            ctx["tools_used"].append("explain_risk")
            harvest_ready = bool(field.get("harvest_ready", mapping.normalise_stage(stage) == "harvest_ready"))
            ctx["harvest"] = tools.explain_harvest(crop, stage, prob_df, harvest_ready)
            ctx["tools_used"].append("explain_harvest")
        except ValueError as exc:
            ctx["risk"] = {"available": False, "error": str(exc)}
            ctx["harvest"] = {"available": False, "error": str(exc)}
            ctx["limitations"].append(f"Culture ou stade non reconnu : {exc}.")
    else:
        ctx["risk"] = {"available": False, "error": "crop/growth_stage not provided"}
        ctx["harvest"] = {"available": False, "error": "crop/growth_stage not provided"}
        ctx["limitations"].append("Culture et/ou stade manquants : analyse de risque et de récolte non effectuée.")

    return ctx


# --------------------------------------------------------------------------
# Grounding text for the model (facts only)
# --------------------------------------------------------------------------
def build_grounding(ctx: dict) -> str:
    lines = ["CONTEXTE (faits vérifiés - n'utilise que ceci) :", ""]

    fc = ctx.get("forecast", {})
    lines.append("== PRÉVISION MÉTÉO (source: Open-Meteo / Météo-France AROME, ECMWF AIFS) ==")
    if fc.get("available"):
        a = fc.get("arome", {})
        if a.get("available"):
            lines.append(f"- AROME {a.get('model_id')} : Tmax {a.get('temp_max_c')}°C, "
                         f"Tmin {a.get('temp_min_c')}°C, vent max {a.get('wind_max_kmh')} km/h "
                         f"(fenêtre {a.get('window_local')}).")
        e = fc.get("aifs", {})
        if e.get("available"):
            days = e.get("daily", [])[:5]
            probs = ", ".join(f"{d['date_local']}: {d['probability_pct']}%" for d in days)
            lines.append(f"- AIFS {e.get('model_id')} ({e.get('ensemble_members_valid')} membres) "
                         f"P(pluie>{e.get('rain_threshold_mm')}mm) : {probs}.")
    else:
        lines.append("- Prévision indisponible.")
    lines.append("")

    lines.append("== PREUVES AGRONOMIQUES (source: base de connaissances Terres Inovia/Agreste) ==")
    kb = ctx.get("kb", {})
    if kb.get("available") and kb.get("passages"):
        for i, p in enumerate(kb["passages"], 1):
            src = p.get("institution") or "source"
            lines.append(f"[Doc{i}] ({src}) {p['text'][:400]}")
    else:
        lines.append("- Aucun passage agronomique disponible.")
    lines.append("")

    lines.append("== RISQUES (règles sourcées ClimateShield) ==")
    risk = ctx.get("risk", {})
    if risk.get("available"):
        alerts = risk.get("alerts", [])
        if alerts:
            for a in alerts:
                lines.append(f"- {a['hazard_type']} : observé {a['observed_value']} "
                             f"{a['comparison_operator']} seuil {a['threshold_value']} "
                             f"({a['weather_variable']}) — source {a.get('source_url')} "
                             f"[{a.get('validation_status')}].")
        else:
            lines.append(f"- Aucun seuil sourcé dépassé "
                         f"({risk.get('active_published_rules_for_stage', 0)} règle(s) publiée(s) pour ce stade).")
    else:
        lines.append(f"- Analyse de risque non disponible ({risk.get('error')}).")
    lines.append("")

    lines.append("== FENÊTRE DE RÉCOLTE (aide météo uniquement) ==")
    h = ctx.get("harvest", {})
    if h.get("available"):
        if not h.get("harvest_ready"):
            lines.append("- Culture non déclarée prête à récolter : aucune date recommandée.")
        else:
            lines.append(f"- {h.get('n_feasible_days', 0)} jour(s) faisable(s) ; "
                         f"date recommandée : {h.get('recommended_date_local')} (aide météo, à valider au champ).")
    else:
        lines.append(f"- Récolte non disponible ({h.get('error')}).")
    return "\n".join(lines)


# --------------------------------------------------------------------------
# Deterministic structured fields (never from the model)
# --------------------------------------------------------------------------
def _citations(ctx: dict) -> list[dict]:
    cites: list[dict] = []
    seen = set()
    for p in ctx.get("kb", {}).get("passages", []) or []:
        key = (p.get("source_url") or p.get("document"), p.get("page"))
        if key and key not in seen:
            seen.add(key)
            cites.append({"type": "agronomic_evidence", "institution": p.get("institution"),
                          "document": p.get("document"), "source_url": p.get("source_url"),
                          "score": p.get("score"), "snippet": p.get("text", "")[:200],
                          "page": p.get("page"), "crop": p.get("crop")})
    for a in ctx.get("risk", {}).get("alerts", []) or []:
        url = a.get("source_url")
        if url and url not in seen:
            seen.add(url)
            cites.append({"type": "agronomic_rule", "hazard": a.get("hazard_type"),
                          "source_url": url, "validation_status": a.get("validation_status")})
    return cites


def _actions(ctx: dict) -> list[dict]:
    """Conservative, non-prescriptive operational suggestions tied to detected
    conditions. No treatment authorization, no economic/yield claims."""
    actions: list[dict] = []
    for a in ctx.get("risk", {}).get("alerts", []) or []:
        if a["hazard_type"] == "heat_stress":
            actions.append({"title": "Surveiller la floraison pendant le pic de chaleur",
                            "basis": f"seuil {a['threshold_value']}°C ({a.get('validation_status')})",
                            "verified": False})
        elif a["hazard_type"] == "frost":
            actions.append({"title": "Surveiller le risque de gel au stade sensible",
                            "basis": f"seuil {a['threshold_value']}°C ({a.get('validation_status')})",
                            "verified": False})
    h = ctx.get("harvest", {})
    if h.get("available") and h.get("harvest_ready") and h.get("recommended_date_local"):
        actions.append({"title": f"Viser une fenêtre sèche vers {h['recommended_date_local']}",
                        "basis": "classement météo (probabilité de pluie, aide provisoire)",
                        "verified": False})
    return actions


def _uncertainty(ctx: dict) -> dict:
    e = ctx.get("forecast", {}).get("aifs", {})
    probs = [d["probability_pct"] for d in e.get("daily", [])] if e.get("available") else []
    return {
        "ensemble_members": e.get("ensemble_members_valid") if e.get("available") else None,
        "rain_probability_pct_range": [min(probs), max(probs)] if probs else None,
        "note": "Probabilités issues de la dispersion des membres de l'ensemble AIFS ; "
                "incertitude explicite. Indicateurs météo, non des mesures de parcelle.",
    }


def _forecast_provenance(ctx: dict) -> dict:
    fc = ctx.get("forecast", {})
    arome_block = fc.get("arome", {}) or {}
    aifs_block = fc.get("aifs", {}) or {}
    return {
        "retrieved_at_utc": fc.get("retrieved_at_utc"),
        "arome": {
            "available": bool(arome_block.get("available", False)),
            "model_id": arome_block.get("model_id"),
            "window_local": arome_block.get("window_local"),
        },
        "aifs": {
            "available": bool(aifs_block.get("available", False)),
            "model_id": aifs_block.get("model_id"),
            "ensemble_members_valid": aifs_block.get("ensemble_members_valid"),
        },
        "data_kind": "real_weather_forecast",
    }


# --------------------------------------------------------------------------
# Main entry
# --------------------------------------------------------------------------
def run_advisor(field: dict, question: str, bedrock: Any = None,
                kb_client: Any = None) -> dict:
    """Answer a farmer question for a field. Returns a structured dict."""
    _validate(field, question)
    ctx = gather_context(field, question, kb_client=kb_client)
    grounding = build_grounding(ctx)

    user_text = f"QUESTION DE L'AGRICULTEUR : {question.strip()}\n\n{grounding}"
    answer_text, model_ok, model_err = _synthesise(user_text, bedrock)

    limitations = list(ctx["limitations"])
    limitations.append("La fenêtre de récolte est une aide météo (humidité du grain et portance du sol non mesurées).")
    limitations.append("Aucune estimation de rendement, d'économie phytosanitaire ou de bénéfice économique n'est fournie.")
    if not model_ok:
        limitations.append(f"Synthèse par le modèle indisponible ({model_err}) : réponse basée sur les faits bruts.")

    return {
        "answer": answer_text,
        "actions": _actions(ctx),
        "citations": _citations(ctx),
        "forecast_provenance": _forecast_provenance(ctx),
        "uncertainty": _uncertainty(ctx),
        "limitations": limitations,
        "grounded": bool(ctx.get("kb", {}).get("passages") or ctx.get("forecast", {}).get("available")),
        "tools_used": ctx["tools_used"],
        "model_id": MODEL_ID if model_ok else None,
        "knowledge_base_id": tools.KNOWLEDGE_BASE_ID,
        "generated_at_utc": datetime.now(_tz.utc).isoformat(),
    }


def _synthesise(user_text: str, bedrock: Any = None) -> tuple[str, bool, str | None]:
    """One grounded Converse call. On failure, return a safe deterministic note."""
    try:
        client = _bedrock_runtime(bedrock)
        resp = client.converse(
            modelId=MODEL_ID,
            system=[{"text": SYSTEM_PROMPT}],
            messages=[{"role": "user", "content": [{"text": user_text}]}],
            inferenceConfig={"maxTokens": CONVERSE_MAX_TOKENS, "temperature": 0.0, "topP": 0.9},
        )
        parts = [b.get("text", "") for b in resp["output"]["message"]["content"] if "text" in b]
        text = "\n".join(parts).strip()
        # Strip any stray <thinking> narration Nova may emit.
        if "<thinking>" in text:
            import re
            text = re.sub(r"<thinking>.*?</thinking>", "", text, flags=re.DOTALL).strip()
            text = text.replace("<thinking>", "").strip()
        if not text:
            return ("Je ne peux pas formuler de réponse fiable avec les données disponibles.",
                    False, "empty model output")
        return (text, True, None)
    except Exception as exc:  # noqa: BLE001
        return ("Le service de synthèse est momentanément indisponible. "
                "Consultez les faits et citations fournis.", False, str(exc)[:160])
