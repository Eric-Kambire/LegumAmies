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
