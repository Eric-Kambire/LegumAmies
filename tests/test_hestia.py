"""Tests for the HESTIA sustainability integration.

Deterministic unit tests use mocked API payloads; one network-guarded live
integration test checks the real API end to end.
"""
from __future__ import annotations

import datetime as dt
import json

import pytest
import requests

from src.sustainability import hestia
from tests.fixtures import FakeResponse


# --------------------------------------------------------------------------
# Release selection
# --------------------------------------------------------------------------
RELEASES = {
    "2025-05-01": {"name": "v1.0", "enabled": True},
    "2026-03-10": {"name": "v1.1", "enabled": True},
    "2026-04-30": {"name": "v1.2", "enabled": True},
}


def test_select_public_release_respects_embargo():
    # On 2026-10-31, v1.2 (2026-04-30) is 184 days old -> just public.
    date_str, name = hestia.select_public_release(RELEASES, today=dt.date(2026, 10, 31))
    assert (date_str, name) == ("2026-04-30", "v1.2")


def test_select_public_release_excludes_embargoed():
    # One week earlier, v1.2 is still embargoed -> newest public is v1.1.
    date_str, name = hestia.select_public_release(RELEASES, today=dt.date(2026, 10, 20))
    assert (date_str, name) == ("2026-03-10", "v1.1")


def test_select_public_release_none_available():
    with pytest.raises(hestia.HestiaError):
        hestia.select_public_release(
            {"2026-10-01": {"name": "vX", "enabled": True}}, today=dt.date(2026, 10, 31)
        )


# --------------------------------------------------------------------------
# Distribution summarisation + indicator extraction
# --------------------------------------------------------------------------
def test_summarise_distribution_mean_and_spread():
    s = hestia.summarise_distribution({"distribution": [0.2, 0.3, 0.25]})
    assert s["value_mean"] == 0.25
    assert s["n_samples"] == 3
    assert s["value_min"] == 0.2 and s["value_max"] == 0.3


def test_summarise_distribution_prefers_explicit_value():
    s = hestia.summarise_distribution({"value": 1.5, "distribution": [9, 9, 9]})
    assert s["value_mean"] == 1.5


def _fake_ia():
    return {
        "@id": "peaSeedWhole-france-2010-2026-20260418",
        "startDate": 2010,
        "endDate": 2026,
        "functionalUnitQuantity": 1,
        "product": {"term": {"@id": "peaSeedWhole", "name": "Pea, seed (whole)", "units": "kg"}},
        "source": {"@id": "src123"},
        "aggregatedQualityScore": 2,
        "aggregatedQualityScoreMax": 4,
        "impacts": [
            {"term": {"@id": "gwp100", "units": "kg CO2 eq"},
             "methodModel": {"name": "IPCC (2021)"}, "distribution": [0.2, 0.3, 0.25]},
            {"term": {"@id": "gwp100", "units": "kg CO2 eq"},
             "methodModel": {"name": "IPCC (2021)"}, "distribution": [0.9]},  # fewer samples
            {"term": {"@id": "scarcityWeightedWaterUse", "units": "L eq"}, "distribution": [100, 200]},
            {"term": {"@id": "notATarget", "units": "x"}, "distribution": [1, 2, 3]},
        ],
        "emissionsResourceUse": [
            {"term": {"@id": "landOccupationDuringCycle", "units": "m2*year"}, "distribution": [3.0, 3.1, 2.9]},
            {"term": {"@id": "freshwaterWithdrawalsDuringCycle", "units": "L"}, "distribution": [30, 40]},
        ],
    }


def test_extract_indicators_selects_targets_and_max_samples():
    inds = hestia.extract_indicators(_fake_ia())
    by_id = {i["indicator_term_id"]: i for i in inds}
    assert set(by_id) == {
        "gwp100", "scarcityWeightedWaterUse",
        "landOccupationDuringCycle", "freshwaterWithdrawalsDuringCycle",
    }
    # Picked the 3-sample GWP occurrence, not the 1-sample one.
    assert by_id["gwp100"]["value_mean"] == 0.25
    assert by_id["gwp100"]["n_samples"] == 3
    assert by_id["gwp100"]["indicator_category"] == "ghg_emissions"
    assert by_id["gwp100"]["functional_unit"] == "1 kg"
    assert "notATarget" not in by_id


# --------------------------------------------------------------------------
# 401 / 404 handling (no fabrication, clear errors)
# --------------------------------------------------------------------------
class _SingleResponseSession:
    def __init__(self, response):
        self._r = response

    def get(self, url, headers=None, params=None, timeout=None):
        return self._r


def test_fetch_ia_401_raises_with_reason():
    sess = _SingleResponseSession(FakeResponse(status_code=401))
    with pytest.raises(hestia.HestiaError) as e:
        hestia.fetch_impact_assessment("x", "2026-04-30", session=sess)
    assert "401" in str(e.value)


def test_fetch_ia_404_raises_with_reason():
    sess = _SingleResponseSession(FakeResponse(status_code=404))
    with pytest.raises(hestia.HestiaError) as e:
        hestia.fetch_impact_assessment("x", "2026-04-30", session=sess)
    assert "404" in str(e.value)


# --------------------------------------------------------------------------
# End-to-end build with a mocked router session
# --------------------------------------------------------------------------
class RouterSession:
    """Routes HESTIA GET/POST calls to canned responses by URL."""

    def __init__(self):
        self.ia = _fake_ia()

    def get(self, url, headers=None, params=None, timeout=None):
        if url.endswith("/settings/dataReleases"):
            return FakeResponse(payload=RELEASES)
        if "/impactassessments/" in url:
            return FakeResponse(payload=self.ia)
        if "/sources/" in url:
            return FakeResponse(payload={"name": "HESTIA Team (2023)", "originalLicense": "CC-BY"})
        return FakeResponse(status_code=404)

    def post(self, url, headers=None, data=None, timeout=None):
        if url.endswith("/search"):
            # Pea present; a non-legume cereal present (should be ignored).
            return FakeResponse(payload={"results": [
                {"@id": "peaSeedWhole-france-2010-2026-20260418"},
                {"@id": "wheatGrain-france-2010-2026-20260418"},
            ]})
        return FakeResponse(status_code=404)


def test_build_country_sustainability_mocked():
    sess = RouterSession()
    sdf, cov, meta = hestia.build_country_legume_sustainability(
        country="France", release="2026-04-30", session=sess, save=False
    )
    # Only pea is covered; the six other legumes are reported missing (not faked).
    assert meta["crops_covered"] == ["pea"]
    assert set(meta["crops_missing"]) == {
        "soybean", "fava_bean", "chickpea", "lentil", "lupin", "dry_bean"
    }
    assert bool(cov.loc[cov["crop"] == "pea", "covered"].iloc[0]) is True
    assert bool(cov.loc[cov["crop"] == "soybean", "covered"].iloc[0]) is False
    # Every emitted row is labelled an aggregated national estimate with a licence.
    assert (sdf["data_kind"] == "hestia_aggregated_national_estimate").all()
    assert (sdf["licence"] == "CC-BY").all()
    assert set(sdf["crop"].unique()) == {"pea"}
    assert meta["x_data_version_header"] == "2026-04-30"


# --------------------------------------------------------------------------
# Live integration (network-guarded)
# --------------------------------------------------------------------------
def _net() -> bool:
    try:
        requests.get("https://api.hestia.earth/settings/dataReleases", timeout=6)
        return True
    except requests.RequestException:
        return False


@pytest.mark.integration
@pytest.mark.skipif(not _net(), reason="network unavailable")
def test_live_hestia_france_pea():
    releases = hestia.get_data_releases()
    date_str, _ = hestia.select_public_release(releases)
    sdf, cov, meta = hestia.build_country_legume_sustainability(
        country="France", release=date_str, save=False
    )
    assert "pea" in meta["crops_covered"], "expected France pea aggregated data"
    ghg = sdf[(sdf["crop"] == "pea") & (sdf["indicator_category"] == "ghg_emissions")]
    assert len(ghg) == 1
    assert ghg["unit"].iloc[0] == "kg CO2 eq"
    assert ghg["value_mean"].iloc[0] > 0
