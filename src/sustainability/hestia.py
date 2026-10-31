"""HESTIA (University of Oxford) sustainability data integration.

Retrieves REAL, publicly available *aggregated* environmental impact data for
legume crops from the official HESTIA Data API, to enrich LegumAmies with
sustainability indicators (greenhouse-gas emissions, land use, water).

Design / honesty rules enforced here
------------------------------------
* The required ``X-Data-Version`` header is sent on every request. Its value is
  a release **date** (YYYY-MM-DD), never a version number.
* A release is embargoed for its first 182 days; we auto-select the newest
  release that is both ``enabled`` and older than that window, and allow an
  explicit pin for reproducibility.
* HESTIA aggregated nodes are **national/regional estimates over a period**
  (e.g. France 2010-2026), NOT measurements of an individual field. Every row
  is labelled ``data_kind = "hestia_aggregated_national_estimate"``.
* Aggregated indicator values are stored as bootstrap ``distribution`` arrays;
  we report mean / sd / min / max / n so the uncertainty is explicit.
* Provenance (release, node id, source citation, licence, quality score,
  method model, units) is recorded for every indicator. Nothing is fabricated:
  crops without published French coverage are reported as missing.

Docs: https://www.hestia.earth/guide/guide-accessing-data-data-api
"""
from __future__ import annotations

import datetime as _dt
import json
import statistics as _stats
from pathlib import Path

import pandas as pd
import requests

from .. import config

API_BASE = "https://api.hestia.earth"
DATA_BASE = "https://data.hestia.earth"
DEFAULT_COUNTRY = "France"
MIN_PUBLIC_AGE_DAYS = 182

# Our crop vocabulary -> HESTIA primary grain product term (seed, whole).
# (HESTIA names faba/field bean "Broad bean" and dry bean "Common bean".)
CROP_TO_HESTIA_PRODUCT = {
    "soybean": ("soybeanSeedWhole", "Soybean, seed (whole)"),
    "fava_bean": ("broadBeanSeedWhole", "Broad bean, seed (whole)"),
    "chickpea": ("chickpeaSeedWhole", "Chickpea, seed (whole)"),
    "pea": ("peaSeedWhole", "Pea, seed (whole)"),
    "lentil": ("lentilSeedWhole", "Lentil, seed (whole)"),
    "lupin": ("lupinSeedWhole", "Lupin, seed (whole)"),
    "dry_bean": ("commonBeanSeedWhole", "Common bean, seed (whole)"),
}
HESTIA_PRODUCT_TO_CROP = {pid: crop for crop, (pid, _n) in CROP_TO_HESTIA_PRODUCT.items()}

# Curated indicators mapped to the categories the product needs. When an
# indicator term appears more than once in a node (per subsystem / method), we
# keep the occurrence with the largest sample count (the full aggregated
# distribution) and record how many occurrences there were.
TARGET_INDICATORS = [
    {"term_id": "gwp100", "category": "ghg_emissions", "label": "Global warming potential (GWP100)"},
    {"term_id": "landOccupationDuringCycle", "category": "land_use", "label": "Land occupation, during cycle"},
    {"term_id": "freshwaterWithdrawalsDuringCycle", "category": "water_use", "label": "Freshwater withdrawals, during cycle"},
    {"term_id": "scarcityWeightedWaterUse", "category": "water_scarcity", "label": "Scarcity-weighted water use"},
    {"term_id": "soilQualityIndexTotalLandUseEffects", "category": "land_quality", "label": "Soil quality index, total land-use effects"},
]
_TARGET_IDS = {t["term_id"]: t for t in TARGET_INDICATORS}


class HestiaError(RuntimeError):
    """Raised for HESTIA API failures, with 401/404 interpreted per the docs."""


def _headers(release: str, post: bool = False) -> dict:
    h = {"accept": "application/json", "X-Data-Version": release}
    if post:
        h["Content-Type"] = "application/json"
    return h


# --------------------------------------------------------------------------
# Release selection
# --------------------------------------------------------------------------
def get_data_releases(session: requests.Session | None = None, timeout: int = 30) -> dict:
    http = session or requests
    try:
        r = http.get(f"{API_BASE}/settings/dataReleases",
                     headers={"accept": "application/json"}, timeout=timeout)
    except requests.RequestException as exc:
        raise HestiaError(f"Could not fetch HESTIA releases: {exc}") from exc
    if r.status_code != 200:
        raise HestiaError(f"dataReleases returned HTTP {r.status_code}")
    return r.json()


def select_public_release(
    releases: dict,
    today: _dt.date | None = None,
    min_age_days: int = MIN_PUBLIC_AGE_DAYS,
) -> tuple[str, str]:
    """Return ``(release_date, release_name)`` for the newest public release.

    Public = ``enabled`` and older than ``min_age_days`` (the embargo window).
    """
    today = today or _dt.date.today()
    candidates = []
    for date_str, meta in releases.items():
        try:
            d = _dt.date.fromisoformat(date_str)
        except (ValueError, TypeError):
            continue
        age = (today - d).days
        if meta.get("enabled") and age > min_age_days:
            candidates.append((d, date_str, meta.get("name", "")))
    if not candidates:
        raise HestiaError("No public HESTIA release available (all embargoed/disabled)")
    candidates.sort()
    _, date_str, name = candidates[-1]
    return date_str, name


# --------------------------------------------------------------------------
# Fetching
# --------------------------------------------------------------------------
def search_aggregated_ia_ids(
    country: str,
    release: str,
    session: requests.Session | None = None,
    limit: int = 50,
    timeout: int = 40,
) -> list[str]:
    """Return ids of validated, aggregated ImpactAssessment nodes for a country."""
    http = session or requests
    body = {
        "query": {"bool": {"must": [
            {"match": {"@type": "ImpactAssessment"}},
            {"match": {"aggregated": "true"}},
            {"match": {"aggregatedDataValidated": "true"}},
            {"match": {"country.name": country}},
        ]}},
        "limit": limit,
        "fields": ["@id"],
    }
    try:
        r = http.post(f"{API_BASE}/search", headers=_headers(release, post=True),
                      data=json.dumps(body), timeout=timeout)
    except requests.RequestException as exc:
        raise HestiaError(f"HESTIA search failed: {exc}") from exc
    if r.status_code != 200:
        raise HestiaError(f"HESTIA search returned HTTP {r.status_code}")
    return [x.get("@id") for x in r.json().get("results", []) if x.get("@id")]


def fetch_impact_assessment(
    ia_id: str,
    release: str,
    data_state: str = "recalculated",
    session: requests.Session | None = None,
    timeout: int = 40,
) -> dict:
    """Fetch one ImpactAssessment node. Interprets 401/404 per HESTIA docs."""
    http = session or requests
    params = {"dataState": data_state} if data_state else None
    try:
        r = http.get(f"{API_BASE}/impactassessments/{ia_id}",
                     headers=_headers(release), params=params, timeout=timeout)
    except requests.RequestException as exc:
        raise HestiaError(f"HESTIA IA fetch failed for {ia_id}: {exc}") from exc
    if r.status_code == 401:
        raise HestiaError(
            f"HTTP 401 for {ia_id}: not published to you (unvalidated or "
            f"embargoed release {release})."
        )
    if r.status_code == 404:
        raise HestiaError(
            f"HTTP 404 for {ia_id}: id not in release {release} "
            f"(aggregation ids are scoped to a release)."
        )
    if r.status_code != 200:
        raise HestiaError(f"HESTIA IA fetch for {ia_id} returned HTTP {r.status_code}")
    return r.json()


def fetch_source_citation(
    source_id: str,
    release: str,
    session: requests.Session | None = None,
    timeout: int = 30,
) -> dict:
    """Return ``{citation, licence}`` for a Source node (best-effort)."""
    http = session or requests
    try:
        r = http.get(f"{API_BASE}/sources/{source_id}", headers=_headers(release),
                     timeout=timeout)
        if r.status_code != 200:
            return {"citation": None, "licence": None}
        sj = r.json()
        return {"citation": sj.get("name"), "licence": sj.get("originalLicense")}
    except requests.RequestException:
        return {"citation": None, "licence": None}


# --------------------------------------------------------------------------
# Parsing / summarisation
# --------------------------------------------------------------------------
def summarise_distribution(entry: dict) -> dict:
    """Summarise an Indicator value.

    Uses an explicit ``value`` when present, otherwise the mean of the
    aggregated bootstrap ``distribution`` array; always reports n / sd / range.
    """
    dist = entry.get("distribution") or []
    value = entry.get("value")
    if value is None and dist:
        value = _stats.fmean(dist)
    sd = _stats.pstdev(dist) if len(dist) > 1 else None
    return {
        "value_mean": round(value, 6) if value is not None else None,
        "value_sd": round(sd, 6) if sd is not None else None,
        "value_min": round(min(dist), 6) if dist else None,
        "value_max": round(max(dist), 6) if dist else None,
        "n_samples": len(dist),
    }


def _all_indicator_entries(ia: dict) -> list[dict]:
    entries = []
    for key in ("impacts", "emissionsResourceUse"):
        entries.extend(ia.get(key) or [])
    return entries


def extract_indicators(ia: dict, targets: dict | None = None) -> list[dict]:
    """Extract the curated indicator set from an IA node.

    For each target term, keep the occurrence with the most samples.
    """
    targets = targets or _TARGET_IDS
    best: dict[str, tuple[int, dict]] = {}
    for entry in _all_indicator_entries(ia):
        term = entry.get("term", {}) or {}
        tid = term.get("@id")
        if tid not in targets:
            continue
        n = len(entry.get("distribution") or [])
        occ = best.get(tid)
        if occ is None or n > occ[0]:
            best[tid] = (n, entry)

    product = (ia.get("product", {}) or {}).get("term", {}) or {}
    fu_qty = ia.get("functionalUnitQuantity")
    product_unit = product.get("units") or "kg"
    out = []
    for tid, (occurrences_n, entry) in best.items():
        term = entry.get("term", {}) or {}
        method = (entry.get("methodModel", {}) or {}).get("name")
        summary = summarise_distribution(entry)
        out.append({
            "indicator_category": targets[tid]["category"],
            "indicator_term_id": tid,
            "indicator_label": targets[tid]["label"],
            **summary,
            "unit": term.get("units"),
            "method_model": method,
            "functional_unit": f"{fu_qty or 1} {product_unit}",
        })
    # Stable ordering by category as declared in TARGET_INDICATORS.
    order = {t["term_id"]: i for i, t in enumerate(TARGET_INDICATORS)}
    out.sort(key=lambda r: order.get(r["indicator_term_id"], 99))
    return out


# --------------------------------------------------------------------------
# Orchestration
# --------------------------------------------------------------------------
def build_country_legume_sustainability(
    country: str = DEFAULT_COUNTRY,
    crops: tuple[str, ...] | None = None,
    release: str | None = None,
    session: requests.Session | None = None,
    save: bool = True,
) -> tuple[pd.DataFrame, pd.DataFrame, dict]:
    """Retrieve HESTIA sustainability indicators for legume crops in a country.

    Returns ``(sustainability_long_df, coverage_df, metadata)``.
    """
    crops = tuple(crops) if crops else tuple(CROP_TO_HESTIA_PRODUCT.keys())
    retrieved_at = _dt.datetime.now(_dt.timezone.utc).isoformat()

    releases = get_data_releases(session=session)
    if release is None:
        release, release_name = select_public_release(releases)
    else:
        release_name = releases.get(release, {}).get("name", "")

    ia_ids = search_aggregated_ia_ids(country, release, session=session)

    # Map any returned IA whose product matches one of our crops.
    found: dict[str, dict] = {}
    source_cache: dict[str, dict] = {}
    for ia_id in ia_ids:
        crop = None
        for pid, c in HESTIA_PRODUCT_TO_CROP.items():
            if ia_id.startswith(pid + "-"):
                crop = c
                break
        if crop is None or crop not in crops or crop in found:
            continue
        ia = fetch_impact_assessment(ia_id, release, session=session)
        found[crop] = ia

    sustainability_rows = []
    for crop, ia in found.items():
        product = (ia.get("product", {}) or {}).get("term", {}) or {}
        source_id = (ia.get("source", {}) or {}).get("@id")
        if source_id and source_id not in source_cache:
            source_cache[source_id] = fetch_source_citation(source_id, release, session=session)
        src = source_cache.get(source_id, {"citation": None, "licence": None})

        if save:
            config.HESTIA_RAW_DIR.mkdir(parents=True, exist_ok=True)
            (config.HESTIA_RAW_DIR / f"{ia['@id']}.json").write_text(
                json.dumps(ia, ensure_ascii=False, indent=2), encoding="utf-8"
            )

        for ind in extract_indicators(ia):
            sustainability_rows.append({
                "country": country,
                "crop": crop,
                "hestia_product_id": product.get("@id"),
                "hestia_product_name": product.get("name"),
                **ind,
                "period_start": ia.get("startDate"),
                "period_end": ia.get("endDate"),
                "ia_id": ia.get("@id"),
                "release_date": release,
                "release_name": release_name,
                "source_citation": src.get("citation"),
                "licence": src.get("licence"),
                "aggregated_quality_score": ia.get("aggregatedQualityScore"),
                "aggregated_quality_score_max": ia.get("aggregatedQualityScoreMax"),
                "data_kind": "hestia_aggregated_national_estimate",
                "retrieved_at_utc": retrieved_at,
            })

    sustainability_df = pd.DataFrame(sustainability_rows)

    coverage_rows = []
    for crop in crops:
        pid, pname = CROP_TO_HESTIA_PRODUCT[crop]
        covered = crop in found
        coverage_rows.append({
            "country": country,
            "crop": crop,
            "hestia_product_id": pid,
            "hestia_product_name": pname,
            "covered": covered,
            "ia_id": found[crop]["@id"] if covered else None,
            "note": "validated aggregated IA found"
            if covered
            else f"no validated aggregated IA for {country} in release {release}",
        })
    coverage_df = pd.DataFrame(coverage_rows)

    metadata = {
        "dataset": "HESTIA aggregated environmental impact (University of Oxford)",
        "data_kind": "hestia_aggregated_national_estimate",
        "api_base": API_BASE,
        "docs": "https://www.hestia.earth/guide/guide-accessing-data-data-api",
        "x_data_version_header": release,
        "release_name": release_name,
        "country": country,
        "crops_requested": list(crops),
        "crops_covered": sorted(found.keys()),
        "crops_missing": sorted(set(crops) - set(found.keys())),
        "indicators": [t["term_id"] for t in TARGET_INDICATORS],
        "licence": sorted({r.get("licence") for r in sustainability_rows if r.get("licence")}),
        "n_sustainability_rows": len(sustainability_df),
        "retrieved_at_utc": retrieved_at,
        "note": (
            "Aggregated national/regional estimates over a multi-year period; "
            "NOT measurements of an individual field. Values are distribution means "
            "with reported spread."
        ),
    }

    if save:
        config.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
        sustainability_df.to_csv(config.HESTIA_SUSTAINABILITY_CSV, index=False)
        coverage_df.to_csv(config.HESTIA_COVERAGE_CSV, index=False)
        config.HESTIA_METADATA_JSON.write_text(
            json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    return sustainability_df, coverage_df, metadata
