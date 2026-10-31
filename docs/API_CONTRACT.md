# LegumAmies - Shared Data / API Contract (v0)

Purpose: a stable contract between the **data/pipeline layer** (this repo,
`src/`) and the **frontend** (Gemini agent). Agree changes here before changing
payloads. This keeps the weather MVP and the HESTIA enrichment decoupled from
UI work.

Status: v0 (hackathon). The pipeline currently emits **files** in
`data/processed/`. The field names below are the contract; a thin HTTP/serverless
layer can wrap them later without changing shapes. All timestamps are ISO-8601;
local times carry an offset (e.g. `+01:00`), UTC ends in `Z`/`+00:00`.

Data-kind labels (must be surfaced in the UI):
`real_weather_forecast`, `derived_from_real_forecast`,
`risk_detection_from_real_forecast_and_agronomic_evidence`,
`user_provided_hypothetical_farm_information`, `weather_only_decision_aid`,
`hestia_aggregated_national_estimate`.

---

## 1. Field (user-provided, hypothetical in demo)
Source: `data/raw/fields.csv`.
```json
{
  "field_id": "DEMO_001",
  "latitude": 48.70,
  "longitude": 2.20,
  "crop": "fava_bean",
  "growth_stage": "flowering",
  "area_ha": 5,
  "harvest_ready": false
}
```
`crop` in: `fava_bean, pea, chickpea, soybean, lentil, lupin, dry_bean`.
`growth_stage` in: `vegetative, flowering, pod_formation, grain_filling, harvest_ready`.

## 2. AROME hourly forecast (real)
Source: `data/processed/weather_hourly.csv`. One row per hour.
```json
{
  "field_id": "DEMO_001",
  "valid_time_utc": "2026-10-30T23:00:00+00:00",
  "valid_time_local": "2026-10-31T00:00:00+01:00",
  "temperature_c": 9.1,
  "precipitation_mm": 0.0,
  "relative_humidity_pct": 80,
  "wind_speed_kmh": 9.8,
  "model_id": "meteofrance_arome_france_hd",
  "retrieved_at_utc": "2026-10-31T16:09:51Z"
}
```
`relative_humidity_pct` / `wind_speed_kmh` may be absent if AROME omits them;
treat as optional.

## 3. Rainfall probabilities (derived from AIFS ensemble)
Source: `data/processed/rain_probabilities.csv`. One row per local day.
```json
{
  "field_id": "DEMO_001",
  "date_local": "2026-11-02",
  "rain_threshold_mm": 5.0,
  "probability_pct": 0.0,
  "ensemble_members_used": 51,
  "mean_precipitation_mm": 0.412,
  "median_precipitation_mm": 0.0,
  "model_id": "ecmwf_aifs025_ensemble"
}
```
`probability_pct` = members exceeding `rain_threshold_mm` / `ensemble_members_used`.
Threshold is an operational demo value, not a validated harvest limit.

## 4. Risk alerts (explainable)
Source: `data/processed/flowering_alerts.csv`. Zero rows = no hazard (valid).
```json
{
  "field_id": "DEMO_001",
  "crop": "fava_bean",
  "growth_stage": "flowering",
  "hazard_type": "heat_stress",
  "weather_variable": "temperature_2m",
  "forecast_start_local": "2026-06-15T12:00:00+02:00",
  "forecast_end_local": "2026-06-15T14:00:00+02:00",
  "threshold_value": 25.0,
  "comparison_operator": "gt",
  "observed_value": 30.0,
  "exposure_hours": 3,
  "minimum_exposure_hours": 1,
  "source_url": "https://www.terresinovia.fr/...",
  "validation_status": "published"
}
```
UI must show `threshold_value`, `observed_value`, the window, `source_url` and
`validation_status` (`published` | `requires_expert_validation` | `demo_hypothetical`).
A threshold exceedance is a **risk flag, not a damage prediction**.

## 5. Harvest ranking (explainable, weather-only)
Source: `data/processed/harvest_ranking.csv`. One row per candidate day.
```json
{
  "field_id": "DEMO_001",
  "date_local": "2026-11-02",
  "feasible": true,
  "rain_probability_pct": 0.0,
  "expected_rain_mm": 0.412,
  "weather_risk_score": 0.62,
  "rank": 1,
  "explanation": "feasible: 0% ensemble rain-prob >5mm, expected 0.4mm, risk score 0.6/100 | baseline = earliest feasible date; recommended ...",
  "limitations": "weather-only, provisional (no grain-moisture / soil-trafficability data)"
}
```
`rank` is null when `feasible=false`. Lower `weather_risk_score` = better.
Never recommend a date when the crop is not `harvest_ready` or machinery is
unavailable. Always surface `explanation` and `limitations`.

## 6. HESTIA sustainability (aggregated national estimate)
Sources: `data/processed/hestia_legume_sustainability.csv` (one row per
crop x indicator) and `hestia_coverage.csv`.
```json
{
  "country": "France",
  "crop": "pea",
  "hestia_product_id": "peaSeedWhole",
  "hestia_product_name": "Pea, seed (whole)",
  "indicator_category": "ghg_emissions",
  "indicator_term_id": "gwp100",
  "indicator_label": "Global warming potential (GWP100)",
  "value_mean": 0.275,
  "value_sd": 0.059,
  "value_min": 0.13,
  "value_max": 0.493,
  "n_samples": 1000,
  "unit": "kg CO2 eq",
  "method_model": "IPCC (2021)",
  "functional_unit": "1 kg",
  "period_start": 2010,
  "period_end": 2026,
  "ia_id": "peaSeedWhole-france-2010-2026-20260418",
  "release_date": "2026-04-30",
  "release_name": "v1.2",
  "source_citation": "HESTIA Team (2023)",
  "licence": "CC-BY",
  "aggregated_quality_score": 2,
  "aggregated_quality_score_max": 4,
  "data_kind": "hestia_aggregated_national_estimate"
}
```
`indicator_category` in: `ghg_emissions, land_use, water_use, water_scarcity,
land_quality`. Coverage row:
```json
{ "country": "France", "crop": "soybean", "hestia_product_id": "soybeanSeedWhole",
  "hestia_product_name": "Soybean, seed (whole)", "covered": false, "ia_id": null,
  "note": "no validated aggregated IA for France in release 2026-04-30" }
```
UI rules: show `unit`, `release_name`, `source_citation`, `licence`, and a
"national estimate, not a field measurement" note. For `covered=false`, show the
empty state - never fabricate a value.

## 7. Run metadata
`data/processed/run_metadata.json` (weather run) and `hestia_metadata.json`
(sustainability run) carry provenance: model ids, coordinates, release/header,
date ranges, available variables, licences and source URLs. The UI "about this
data" panel should read from these.

---

## Change process
1. Propose field changes in a PR editing this file.
2. Keep additive changes backward-compatible; bump `v0 -> v1` for breaking ones.
3. Frontend and pipeline agents both approve before merge to `main`.

---

## 8. Live HTTP API (integration layer) — `src/api`

The pipeline is now exposed over HTTP by a FastAPI layer (`src/api/main.py`,
schemas in `src/api/schemas.py`). The PWA reaches it via `VITE_API_BASE_URL`.
It is **stateless per request** (no shared CSV between users) and accepts
French **or** English crop/stage ids (mapping in `src/api/mapping.py`).

### Endpoints
- `GET /health` — liveness.
- `GET /meta` — supported crops/stages, FR↔EN mappings, the sourced rule
  catalogue (with `source_url` + `validation_status`), model ids.
- `POST /assess` — full per-field assessment.

### `POST /assess` request
```json
{
  "latitude": 48.70, "longitude": 2.20,
  "crop": "feverole",            // FR or EN (feverole|fava_bean ...)
  "growth_stage": "floraison",   // FR or EN (floraison|flowering ...)
  "harvest_ready": false,
  "rain_threshold_mm": 5.0,
  "arome_forecast_days": 2,
  "aifs_forecast_days": 10,
  "machinery": [{ "date_local": "2026-11-02", "available": true }],
  "field_name": "Parcelle A"
}
```

### `POST /assess` response (shape)
Top-level keys: `field`, `weather`, `ensemble`, `risk`, `harvest`,
`regulatory_windows`, `provenance`. Each block carries a `data_kind` label
(see the legend in §0). Key honesty rules the UI must honour:
- `risk.alerts[]` come only from **sourced** rules and each carries
  `threshold_value`, `observed_value`, `source_url`, `validation_status`.
  An empty list means "no sourced hazard" — not an error.
- `harvest` is weather-only; `available=false` when the crop is not
  harvest-ready (no date recommended). No grain-moisture / pod-shattering /
  drying-cost / economic fields exist.
- `regulatory_windows[]` is the spraying wind check (Arrêté du 4 mai 2017),
  computed from the real forecast.
- `provenance` carries model ids, retrieval time, and agronomic source URLs.

### FR ↔ EN identifiers
Crops: `soja↔soybean`, `feverole↔fava_bean`, `pois_chiche↔chickpea`,
`pois↔pea`, `lentille↔lentil`, `lupin↔lupin`, `haricot_sec↔dry_bean`.
Stages: `vegetatif↔vegetative`, `floraison↔flowering`,
`formation_gousses↔pod_formation`, `remplissage_grain↔grain_filling`,
`pret_recolter↔harvest_ready`.

### Errors
- `422` — invalid body (unknown crop/stage, out-of-range coordinates).
- `502` — upstream forecast provider (AROME/AIFS) unavailable; the message
  names which one. The PWA should show an honest forecast-unavailable state.

CORS allow-list is configurable via `LEGUMAMIES_CORS_ORIGINS` (comma-separated;
default `*` for the test deployment).
