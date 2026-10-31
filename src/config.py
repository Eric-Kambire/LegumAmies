"""Central configuration for the LegumAmies ClimateShield pipeline.

All paths are resolved relative to the repository root (derived from this
file's location) so the code runs unchanged in Kiro's Ubuntu environment,
Google Colab and AWS Jupyter. No absolute, machine-specific paths are used.
"""
from __future__ import annotations

from pathlib import Path
import pandas as pd

# --------------------------------------------------------------------------
# Repository-relative paths
# --------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
MODELS_DIR = ROOT / "models"

FIELDS_CSV = RAW_DIR / "fields.csv"
CROP_RULES_CSV = RAW_DIR / "crop_rules.csv"
MACHINERY_CSV = RAW_DIR / "machinery_availability.csv"

# HESTIA sustainability integration
HESTIA_RAW_DIR = RAW_DIR / "hestia"
HESTIA_SUSTAINABILITY_CSV = PROCESSED_DIR / "hestia_legume_sustainability.csv"
HESTIA_COVERAGE_CSV = PROCESSED_DIR / "hestia_coverage.csv"
HESTIA_METADATA_JSON = PROCESSED_DIR / "hestia_metadata.json"

# Processed outputs
WEATHER_HOURLY_CSV = PROCESSED_DIR / "weather_hourly.csv"
ENSEMBLE_HOURLY_CSV = PROCESSED_DIR / "ensemble_hourly.csv"
RAIN_PROBABILITIES_CSV = PROCESSED_DIR / "rain_probabilities.csv"
FLOWERING_ALERTS_CSV = PROCESSED_DIR / "flowering_alerts.csv"
HARVEST_RANKING_CSV = PROCESSED_DIR / "harvest_ranking.csv"
RUN_METADATA_JSON = PROCESSED_DIR / "run_metadata.json"

# --------------------------------------------------------------------------
# Domain vocabulary (kept in sync with the task specification)
# --------------------------------------------------------------------------
SUPPORTED_CROPS = (
    "fava_bean",
    "pea",
    "chickpea",
    "soybean",
    "lentil",
    "lupin",
    "dry_bean",
)

GROWTH_STAGES = (
    "vegetative",
    "flowering",
    "pod_formation",
    "grain_filling",
    "harvest_ready",
)

# --------------------------------------------------------------------------
# API configuration (Open-Meteo wrappers around the real NWP models)
# --------------------------------------------------------------------------
AROME_URL = "https://api.open-meteo.com/v1/meteofrance"
AROME_MODEL_ID = "meteofrance_arome_france_hd"
AROME_HOURLY_VARS = (
    "temperature_2m",
    "precipitation",
    "relative_humidity_2m",
    "wind_speed_10m",
)

AIFS_URL = "https://ensemble-api.open-meteo.com/v1/ensemble"
AIFS_MODEL_ID = "ecmwf_aifs025_ensemble"

DEFAULT_TIMEZONE = "Europe/Paris"

# Configurable *demonstration* rainfall threshold for harvest planning.
# NOTE: 5 mm/24 h is an operational demo value, NOT a universally validated
# agronomic harvest limit.
DEFAULT_RAIN_THRESHOLD_MM = 5.0


# --------------------------------------------------------------------------
# Loaders
# --------------------------------------------------------------------------
def load_fields(path: Path | str = FIELDS_CSV) -> pd.DataFrame:
    """Load the hypothetical field registry (user-provided farm information)."""
    df = pd.read_csv(path, dtype={"field_id": str})
    # Normalise the boolean column regardless of how it was written.
    df["harvest_ready"] = (
        df["harvest_ready"].astype(str).str.strip().str.lower().map(
            {"true": True, "false": False, "1": True, "0": False}
        )
    )
    return df


def get_field(field_id: str, path: Path | str = FIELDS_CSV) -> dict:
    """Return a single field record as a dict, or raise if not found."""
    df = load_fields(path)
    match = df[df["field_id"] == field_id]
    if match.empty:
        raise KeyError(f"field_id {field_id!r} not found in {path}")
    return match.iloc[0].to_dict()


def load_crop_rules(path: Path | str = CROP_RULES_CSV) -> pd.DataFrame:
    """Load agronomic risk rules with their provenance/validation status."""
    df = pd.read_csv(path, dtype=str)
    df["threshold_value"] = pd.to_numeric(df["threshold_value"], errors="coerce")
    df["minimum_exposure_hours"] = pd.to_numeric(
        df["minimum_exposure_hours"], errors="coerce"
    ).fillna(1).astype(int)
    df["source_url"] = df["source_url"].fillna("")
    return df


def load_machinery(path: Path | str = MACHINERY_CSV) -> pd.DataFrame:
    """Load machinery availability (user-provided operating constraints)."""
    df = pd.read_csv(path, dtype={"field_id": str, "date_local": str})
    df["available"] = (
        df["available"].astype(str).str.strip().str.lower().map(
            {"true": True, "false": False, "1": True, "0": False}
        )
    )
    return df


def ensure_dirs() -> None:
    """Create data/processed and models directories if they do not exist."""
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
