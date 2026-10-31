"""Deterministic unit tests using mocked API payloads (no network)."""
from __future__ import annotations

import pandas as pd
import pytest

from src import config
from src.timeutils import build_time_frame
from src.weather import arome, aifs, ensemble_processing
from src.risk import rules
from src.harvest import ranking

from tests.fixtures import (
    arome_raw,
    arome_hot_raw,
    aifs_raw,
    FakeResponse,
    FakeSession,
    TimeoutSession,
)


# --------------------------------------------------------------------------
# Timestamp conversion and local dates
# --------------------------------------------------------------------------
def test_build_time_frame_local_and_utc():
    frame = build_time_frame(["2026-10-31T00:00", "2026-10-31T01:00"], "Europe/Paris")
    # Local keeps +01:00 (CET on 31 Oct 2026); UTC is one hour earlier.
    assert str(frame["valid_time_local"].iloc[0]) == "2026-10-31 00:00:00+01:00"
    assert str(frame["valid_time_utc"].iloc[0]) == "2026-10-30 23:00:00+00:00"
    assert frame["valid_time_utc"].iloc[1].tzname() == "UTC"


# --------------------------------------------------------------------------
# AROME JSON parsing + missing variables
# --------------------------------------------------------------------------
def test_arome_to_dataframe_parses_all_columns():
    df = arome.to_dataframe(arome_raw(), field_id="F1", retrieved_at_utc="t0")
    assert len(df) == 4
    for col in ["temperature_c", "precipitation_mm", "relative_humidity_pct", "wind_speed_kmh"]:
        assert col in df.columns
    assert df["model_id"].iloc[0] == config.AROME_MODEL_ID


def test_arome_check_variables_reports_missing():
    raw = arome_raw(include_humidity=False, include_wind=False)
    report = arome.check_variables(raw, config.AROME_HOURLY_VARS)
    assert "relative_humidity_2m" in report["missing"]
    assert "wind_speed_10m" in report["missing"]
    assert "temperature_2m" in report["available"]
    # Optional columns are simply absent, required ones remain present.
    df = arome.to_dataframe(raw, field_id="F1", retrieved_at_utc="t0")
    assert "relative_humidity_pct" not in df.columns
    assert "temperature_c" in df.columns


def test_arome_fetch_http_error_raises():
    sess = FakeSession(response=FakeResponse(status_code=400, text="bad request"))
    with pytest.raises(arome.AromeFetchError):
        arome.fetch_arome(48.7, 2.2, session=sess)


def test_arome_fetch_api_error_payload_raises():
    sess = FakeSession(response=FakeResponse(payload={"error": True, "reason": "nope"}))
    with pytest.raises(arome.AromeFetchError):
        arome.fetch_arome(48.7, 2.2, session=sess)


def test_arome_fetch_timeout_raises():
    with pytest.raises(arome.AromeFetchError):
        arome.fetch_arome(48.7, 2.2, session=TimeoutSession())


# --------------------------------------------------------------------------
# AIFS ensemble parsing + member handling
# --------------------------------------------------------------------------
def test_aifs_extract_members_control_plus_perturbed():
    members = aifs.extract_members(aifs_raw(n_members=3))
    ids = [m for m, _ in members]
    assert ids == ["member00", "member01", "member02"]


def test_aifs_long_dataframe_shape_and_tz():
    df = aifs.to_long_dataframe(aifs_raw(n_members=3, n_hours=48), field_id="F1")
    assert len(df) == 3 * 48
    assert set(df["member_id"].unique()) == {"member00", "member01", "member02"}
    # Local timestamps must retain the +01:00 offset (regression for tz bug).
    assert "+01:00" in str(df["valid_time_local"].iloc[0])


def test_aifs_no_members_raises():
    bad = {"hourly": {"time": ["2026-10-31T00:00"]}}
    with pytest.raises(aifs.AifsFetchError):
        aifs.extract_members(bad)


def test_aifs_does_not_substitute_on_error():
    sess = FakeSession(response=FakeResponse(payload={"error": True, "reason": "model unavailable"}))
    with pytest.raises(aifs.AifsFetchError):
        aifs.fetch_ensemble(48.7, 2.2, session=sess)
    # Exactly one call was attempted: no silent retry/substitution with IFS.
    assert len(sess.calls) == 1
    assert sess.calls[0]["params"]["models"] == config.AIFS_MODEL_ID


# --------------------------------------------------------------------------
# Daily rainfall accumulation + exceedance probability
# --------------------------------------------------------------------------
def test_daily_accumulation_and_probability():
    long_df = aifs.to_long_dataframe(aifs_raw(n_members=3, n_hours=48), field_id="F1")
    prob = ensemble_processing.compute_daily_rain_probabilities(long_df, threshold_mm=5.0)
    day1 = prob[prob["date_local"] == "2026-10-31"].iloc[0]
    # member01 -> 7.2 mm (exceeds), member00 & member02 -> below. 1/3 = 33.3%.
    assert day1["ensemble_members_used"] == 3
    assert round(day1["probability_pct"], 1) == 33.3
    assert round(day1["mean_precipitation_mm"], 2) == round((0 + 7.2 + 2.4) / 3, 2)


def test_incomplete_day_excluded():
    # 23 hours only -> the single day is incomplete and dropped.
    raw = aifs_raw(n_members=2, n_hours=23)
    long_df = aifs.to_long_dataframe(raw, field_id="F1")
    prob = ensemble_processing.compute_daily_rain_probabilities(long_df, threshold_mm=5.0)
    assert prob.empty


# --------------------------------------------------------------------------
# Crop-stage rule evaluation
# --------------------------------------------------------------------------
def _hot_weather_df():
    raw = arome_hot_raw(hot_hours=3)
    return arome.to_dataframe(raw, field_id="F1", retrieved_at_utc="t0",
                              timezone="Europe/Paris")


def test_rule_triggers_on_heat():
    wdf = _hot_weather_df()
    alerts = rules.evaluate_risks(wdf, "fava_bean", "flowering", "F1")
    assert len(alerts) == 1
    a = alerts.iloc[0]
    assert a["hazard_type"] == "heat_stress"
    assert a["observed_value"] >= 25
    assert a["validation_status"] == "published"
    assert a["source_url"].startswith("http")


def test_rule_respects_minimum_exposure_hours():
    wdf = _hot_weather_df()
    custom = config.load_crop_rules().copy()
    custom.loc[custom["hazard_type"] == "heat_stress", "minimum_exposure_hours"] = 5
    alerts = rules.evaluate_risks(wdf, "fava_bean", "flowering", "F1", rules_df=custom)
    # Only 3 consecutive hot hours -> below the 5 h requirement.
    assert alerts.empty


def test_unvalidated_rules_inactive_by_default():
    wdf = _hot_weather_df()
    # excess_rain rule for flowering is requires_expert_validation (no source).
    default = rules.evaluate_risks(wdf, "fava_bean", "flowering", "F1")
    assert (default["validation_status"] == "published").all()


def test_no_alert_when_cold():
    wdf = arome.to_dataframe(arome_raw(), field_id="F1", retrieved_at_utc="t0")
    alerts = rules.evaluate_risks(wdf, "fava_bean", "flowering", "F1")
    assert alerts.empty  # headers-only, honest "no hazard" result


# --------------------------------------------------------------------------
# Harvest readiness + machinery constraints
# --------------------------------------------------------------------------
def _rain_prob_df():
    return pd.DataFrame(
        {
            "field_id": ["F1", "F1", "F1"],
            "date_local": ["2026-11-02", "2026-11-03", "2026-11-04"],
            "rain_threshold_mm": [5.0, 5.0, 5.0],
            "probability_pct": [0.0, 40.0, 10.0],
            "ensemble_members_used": [51, 51, 51],
            "mean_precipitation_mm": [0.0, 8.0, 1.0],
            "median_precipitation_mm": [0.0, 7.0, 0.0],
            "model_id": [config.AIFS_MODEL_ID] * 3,
        }
    )


def _machinery_df():
    return pd.DataFrame(
        {
            "field_id": ["F1", "F1", "F1"],
            "date_local": ["2026-11-02", "2026-11-03", "2026-11-04"],
            "available": [True, True, False],
        }
    )


def test_harvest_not_ready_blocks_all():
    out = ranking.rank_harvest_windows(
        "F1", "fava_bean", "flowering", harvest_ready=False,
        rain_prob_df=_rain_prob_df(), machinery_df=_machinery_df(),
    )
    assert not out["feasible"].any()
    assert out["rank"].isna().all()
    assert out["explanation"].str.contains("not declared harvest-ready").all()


def test_harvest_machinery_constraint_and_ranking():
    out = ranking.rank_harvest_windows(
        "F1", "fava_bean", "harvest_ready", harvest_ready=True,
        rain_prob_df=_rain_prob_df(), machinery_df=_machinery_df(),
    )
    feasible = out[out["feasible"]]
    # 11-04 has no machinery -> excluded; 2 feasible days remain.
    assert set(feasible["date_local"]) == {"2026-11-02", "2026-11-03"}
    # Driest day (11-02, 0% prob) ranks first.
    assert out.loc[out["rank"] == 1, "date_local"].iloc[0] == "2026-11-02"


def test_harvest_weather_only_limitation_label():
    out = ranking.rank_harvest_windows(
        "F1", "fava_bean", "harvest_ready", harvest_ready=True,
        rain_prob_df=_rain_prob_df(), machinery_df=_machinery_df(),
        grain_moisture=None,
    )
    assert out["limitations"].str.contains("weather-only").all()
