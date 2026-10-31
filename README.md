# Legum'Amies - HackTheFork

> **AI & ML for the French Food Industry: Alternative Proteins & Protein Sovereignty**

## 🌾 Project Overview
**Legum'Amies** is an AI/ML-driven initiative developed for the **HackTheFork** hackathon, targeting food resilience, alternative proteins (legumes, pulses, lupin, faba beans, peas, lentils), and protein sovereignty in France and Europe.

### Core Focus Areas
- **Protein Sovereignty (Souveraineté Protéique)**: Reducing reliance on imported soy and animal protein by valorizing French legume production.
- **Formulation & Nutritional AI**: Machine learning models to balance amino acid profiles, texture, digestability, and organoleptic properties.
- **Supply Chain & Eco-Score Optimization**: Evaluating carbon footprint, water impact, and local sourcing criteria (Open Food Facts / Agribalyse integration).

---

## 📁 Repository Structure
```
HackTheFork/
└── LegumAmies/
    ├── data/
    │   ├── raw/            # Unprocessed datasets (Open Food Facts, Agribalyse, CIQUAL, etc.)
    │   └── processed/      # Cleaned and feature-engineered datasets
    ├── notebooks/          # Exploratory Data Analysis (EDA) and prototyping
    ├── src/                # Modular Python source code (data pipeline, models, API)
    ├── models/             # Exported model weights and artifacts
    ├── requirements.txt    # Project dependencies
    └── README.md
```

---

## 🚀 Quickstart

### 1. Set up a Virtual Environment
```bash
python -m venv .venv
# Windows (PowerShell)
.\.venv\Scripts\Activate.ps1
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

---

## 🛰️ Module: ClimateShield (Milestone 1)

ClimateShield is a reproducible agricultural decision pipeline. A grower selects
a field, declares the legume and its growth stage; the pipeline retrieves real
weather forecasts, flags crop-stage weather hazards against sourced agronomic
thresholds, and ranks candidate harvest dates.

### Data sources (all real, retrieved live)
| Dataset | Model | Endpoint |
|---|---|---|
| A - Short-term HD forecast | `meteofrance_arome_france_hd` (Météo-France AROME France HD) | `https://api.open-meteo.com/v1/meteofrance` |
| B - Rainfall uncertainty | `ecmwf_aifs025_ensemble` (ECMWF **AIFS** AI ensemble, up to 51 members) | `https://ensemble-api.open-meteo.com/v1/ensemble` |

AIFS is the ECMWF *AI Forecasting System* ensemble; it is **not** the classic
IFS ensemble. The code never silently substitutes IFS: an AIFS failure raises a
clear error.

### Data honesty
The pipeline separates four kinds of information and labels them in
`data/processed/run_metadata.json`:
- **Real weather forecast** - AROME and AIFS outputs.
- **User-provided farm information** - `data/raw/fields.csv`, `machinery_availability.csv` (hypothetical demo).
- **Agronomic evidence** - `data/raw/crop_rules.csv`; active thresholds cite Terres Inovia and carry a `validation_status`.
- **Hypothetical scenario** - clearly-labelled what-if demonstrations.

Detecting that a weather threshold is exceeded is **not** a prediction of crop
damage, and the harvest ranking is a transparent weather-only aid, not a
validated agronomic optimiser.

### Layout (ClimateShield)
```
src/
  config.py                    # field registry, paths, constants
  timeutils.py                 # DST-safe local/UTC timestamp handling
  pipeline.py                  # orchestration + run_metadata.json
  weather/arome.py             # Dataset A fetch/parse -> weather_hourly.csv
  weather/aifs.py              # Dataset B fetch/parse -> ensemble_hourly.csv
  weather/ensemble_processing.py  # daily rain probabilities -> rain_probabilities.csv
  risk/rules.py                # crop-stage risk eval -> flowering_alerts.csv
  harvest/ranking.py           # harvest ranking -> harvest_ranking.csv
notebooks/01_climate_pipeline.ipynb
tests/                         # mocked unit tests + live integration tests
```

### Run it
```bash
python -m venv .venv
source .venv/bin/activate              # Linux/macOS
pip install -r requirements-climateshield.txt

# Full pipeline (real API calls) via Python:
python -c "from src.pipeline import run_pipeline; run_pipeline()"

# Or execute the notebook end-to-end:
jupyter nbconvert --to notebook --execute --inplace notebooks/01_climate_pipeline.ipynb

# Tests (unit + live integration):
pytest -q
```

Outputs are written to `data/processed/`:
`weather_hourly.csv`, `ensemble_hourly.csv`, `rain_probabilities.csv`,
`flowering_alerts.csv`, `harvest_ranking.csv`, `run_metadata.json`.

---

## 🌍 Module: HESTIA sustainability enrichment (Milestone 2)

Enriches LegumAmies with **real, published** environmental impact data for
legumes from the official [HESTIA](https://www.hestia.earth) (University of
Oxford) Data API. This **complements** the AROME/ECMWF climate MVP; it does not
replace it.

### What it retrieves
Validated, **aggregated** Impact Assessments for France, summarised per crop and
indicator (per functional unit = 1 kg of product):

| category | HESTIA indicator | unit | method |
|---|---|---|---|
| `ghg_emissions` | GWP100 | kg CO2 eq | IPCC (2021) |
| `land_use` | Land occupation, during cycle | m²·year | HESTIA |
| `water_use` | Freshwater withdrawals, during cycle | L | Poore & Nemecek (2018) |
| `water_scarcity` | Scarcity-weighted water use | L eq | Environmental Footprint v3.1 |
| `land_quality` | Soil quality index, total land-use effects | points | Environmental Footprint v3.1 |

### API rules honoured
- Every request sends the required `X-Data-Version` header as a release **date**
  (`YYYY-MM-DD`), never a version label.
- Releases are embargoed for 182 days; the client auto-selects the newest
  `enabled` release older than that window (pinnable for reproducibility).
- Aggregated values are stored as bootstrap `distribution` arrays → reported as
  **mean + sd + min + max + n**.
- 401 (not published to you) and 404 (id scoped to another release) are raised
  with clear messages.

### Honest coverage (France, release v1.2 / `2026-04-30`)
Only **pea** has a validated French aggregate in this release. `soybean`,
`fava_bean` (HESTIA *Broad bean*), `chickpea`, `lentil`, `lupin` and `dry_bean`
(HESTIA *Common bean*) are **not covered** and are reported as missing in
`data/processed/hestia_coverage.csv` — never fabricated.

### Important: not a field measurement
HESTIA aggregated nodes are **national/regional estimates over 2010–2026**, not
measurements of an individual field. Every output row is labelled
`data_kind = hestia_aggregated_national_estimate` and carries its source
citation and licence (here `CC-BY`). Do not attach a national aggregate to a
specific field as if measured there.

### Run it
```bash
source .venv/bin/activate
python -c "from src.sustainability.hestia import build_country_legume_sustainability as b; b(country='France')"
jupyter nbconvert --to notebook --execute --inplace notebooks/02_hestia_sustainability.ipynb
pytest -q tests/test_hestia.py
```
Outputs: `data/processed/hestia_legume_sustainability.csv`,
`hestia_coverage.csv`, `hestia_metadata.json`.

---

## 👥 Team docs (shared standards)

- [`docs/DESIGN_GUIDELINES.md`](docs/DESIGN_GUIDELINES.md) — mandatory iOS-inspired
  PWA design standard (tokens, motion with `motion/react`, accessibility,
  states, explainability). **The Gemini agent owns the frontend**; coordinate
  via this doc rather than rewriting components.
- [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md) — shared data/API contract
  between the pipeline and the frontend (climate + HESTIA payloads, provenance,
  decision traces).
