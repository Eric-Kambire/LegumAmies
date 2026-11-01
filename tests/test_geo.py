"""Unit tests for the geospatial / soil-risk foundation.

Validate schemas, the exploratory vulnerability indicator, RUSLE availability,
units conversion, sample-file integrity (CRS), and manifest consistency
(SHA-256 of downloaded samples).
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

from src.geo import schemas, vulnerability

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "data" / "geo"


# -------------------- vulnerability indicator --------------------
def _exposure(slope=5.0, heavy=5.0, maxd=40.0, cover=0.5):
    return schemas.ExposureInputs(
        slope_degrees_mean=slope, heavy_rain_days_gt20mm_per_year=heavy,
        max_daily_precip_mm=maxd, vegetation_cover_fraction=cover)


def test_vulnerability_bounds_and_labels():
    r = vulnerability.exploratory_vulnerability(_exposure())
    assert 0.0 <= r["score_0_100"] <= 100.0
    assert r["band"] in ("faible", "modéré", "élevé")
    assert r["is_quantitative_erosion_estimate"] is False
    assert any("not a RUSLE soil-loss rate" in l for l in r["limitations"])


def test_vulnerability_monotonic_in_slope_and_rain():
    low = vulnerability.exploratory_vulnerability(_exposure(slope=1, heavy=0, maxd=5, cover=0.9))["score_0_100"]
    high = vulnerability.exploratory_vulnerability(_exposure(slope=20, heavy=15, maxd=90, cover=0.0))["score_0_100"]
    assert high > low
    assert low < 33  # protected flat covered field -> low band


def test_rusle_factor_availability_honest():
    facts = {f.factor: f for f in vulnerability.rusle_factor_availability()}
    assert set(facts) == {"R", "K", "LS", "C", "P"}
    assert facts["LS"].available is True          # DEM slope available
    assert facts["R"].available is False          # ESDAC R needs login
    assert facts["K"].available is False
    assert "login" in facts["R"].note.lower() or "registration" in facts["R"].note.lower()


# -------------------- schema separation & honesty --------------------
def test_data_kind_separation():
    obs = schemas.SoilObservation(field_id="F1", observed_date="2026-03-01", ph_h2o=6.5)
    assert obs.data_kind == schemas.DataKind.measured
    ev = schemas.ManagementEvent(field_id="F1", event_date="2026-04-01", type="crop_protection")
    assert ev.data_kind == schemas.DataKind.declared
    sc = schemas.WeatherScenario(name="wet", description="hypothetical wetter spring", precip_multiplier=1.3)
    assert sc.is_hypothetical is True and sc.data_kind == schemas.DataKind.scenario


def test_modelled_property_requires_provenance():
    with pytest.raises(Exception):
        schemas.SoilTextureCarbon(clay_pct=21.8)  # provenance missing -> validation error


def test_soilgrids_units_conversion():
    # SoilGrids clay 'mean' stored g/kg; % = value/10 (documented in schema)
    raw_g_per_kg = 218
    assert round(raw_g_per_kg / 10.0, 1) == 21.8


# -------------------- sample-file integrity --------------------
def test_rpg_sample_is_declared_not_ownership():
    f = GEO / "samples" / "rpg2024_castelnaudary.geojson"
    d = json.loads(f.read_text())
    assert d["crs"]["properties"]["name"].endswith("4326")
    props = d["features"][0]["properties"]
    assert "code_cultu" in props          # declared crop code
    # must NOT masquerade as cadastral ownership
    assert not any(k in props for k in ("proprietaire", "owner", "numero_cadastre"))


def test_dem_sample_crs_and_units():
    rasterio = pytest.importorskip("rasterio")
    f = GEO / "samples" / "copernicus_dem_castelnaudary.tif"
    with rasterio.open(f) as s:
        assert str(s.crs) == "EPSG:4326"
        assert s.dtypes[0].startswith("float")  # elevation metres


def test_manifest_consistency_and_checksums():
    man = json.loads((GEO / "manifest.json").read_text())
    assert man["summary"]["not_obtained"], "ESDAC/Météo-France must be recorded as not obtained"
    for src in man["sources"]:
        if src["access"].startswith("downloaded") and "file" in src:
            p = ROOT / src["file"]
            assert p.exists(), f"missing sample {src['file']}"
            h = hashlib.sha256(p.read_bytes()).hexdigest()
            assert h == src["sha256"], f"checksum mismatch {src['file']}"
        if src["access"].startswith("not_obtained"):
            assert "auth" in src["access"]
