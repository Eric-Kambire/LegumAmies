"""Live integration tests hitting the real AROME and AIFS endpoints.

Skipped automatically if the network is unavailable. Run explicitly with:
    pytest -m integration
"""
from __future__ import annotations

import pytest
import requests

from src import config
from src.weather import arome, aifs

pytestmark = pytest.mark.integration


def _network_available() -> bool:
    try:
        requests.get("https://api.open-meteo.com", timeout=5)
        return True
    except requests.RequestException:
        return False


requires_net = pytest.mark.skipif(
    not _network_available(), reason="network unavailable"
)


@requires_net
def test_live_arome_returns_usable_forecast():
    raw = arome.fetch_arome(48.70, 2.20, forecast_days=2)
    report = arome.check_variables(raw, config.AROME_HOURLY_VARS)
    assert "temperature_2m" in report["available"]
    df = arome.to_dataframe(raw, field_id="DEMO_001", retrieved_at_utc="live")
    assert len(df) >= 24
    assert df["temperature_c"].notna().any()


@requires_net
def test_live_aifs_returns_identifiable_members():
    raw = aifs.fetch_ensemble(48.70, 2.20, forecast_days=10)
    n = aifs.count_valid_members(raw)
    assert n >= 2, "expected multiple ensemble members from AIFS"
    df = aifs.to_long_dataframe(raw, field_id="DEMO_001")
    assert "member00" in set(df["member_id"])
    assert df["model_id"].iloc[0] == config.AIFS_MODEL_ID
