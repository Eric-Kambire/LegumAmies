"""Consistent mapping between the French frontend identifiers and the Python
backend crop / growth-stage vocabulary.

Frontend (LegumeCropType / CropGrowthStage) uses French ids; the ClimateShield
backend uses English ids. The API accepts EITHER form and normalises to the
backend vocabulary so callers never have to guess.
"""
from __future__ import annotations

# Frontend French crop id -> backend crop id
CROP_FR_TO_PY = {
    "soja": "soybean",
    "feverole": "fava_bean",
    "pois_chiche": "chickpea",
    "pois": "pea",
    "lentille": "lentil",
    "lupin": "lupin",
    "haricot_sec": "dry_bean",
}
CROP_PY_TO_FR = {v: k for k, v in CROP_FR_TO_PY.items()}

# Frontend French growth stage -> backend growth stage
STAGE_FR_TO_PY = {
    "vegetatif": "vegetative",
    "floraison": "flowering",
    "formation_gousses": "pod_formation",
    "remplissage_grain": "grain_filling",
    "pret_recolter": "harvest_ready",
}
STAGE_PY_TO_FR = {v: k for k, v in STAGE_FR_TO_PY.items()}

# Human-readable French labels (for echoing back to the UI)
CROP_LABEL_FR = {
    "soybean": "Soja",
    "fava_bean": "Féverole",
    "chickpea": "Pois chiche",
    "pea": "Pois protéagineux",
    "lentil": "Lentille",
    "lupin": "Lupin",
    "dry_bean": "Haricot sec",
}
STAGE_LABEL_FR = {
    "vegetative": "Végétatif",
    "flowering": "Floraison",
    "pod_formation": "Formation des gousses",
    "grain_filling": "Remplissage du grain",
    "harvest_ready": "Prêt à récolter",
}


def normalise_crop(value: str) -> str:
    """Return the backend crop id from a French or English input."""
    v = (value or "").strip().lower()
    if v in CROP_FR_TO_PY:
        return CROP_FR_TO_PY[v]
    if v in CROP_PY_TO_FR:
        return v
    raise ValueError(f"Unknown crop identifier: {value!r}")


def normalise_stage(value: str) -> str:
    """Return the backend growth-stage id from a French or English input."""
    v = (value or "").strip().lower()
    if v in STAGE_FR_TO_PY:
        return STAGE_FR_TO_PY[v]
    if v in STAGE_PY_TO_FR:
        return v
    raise ValueError(f"Unknown growth stage identifier: {value!r}")
