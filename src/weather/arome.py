"""Dataset A - Meteo-France AROME France HD short-term forecast.

Fetches a REAL high-resolution forecast from the Open-Meteo Meteo-France
endpoint (which serves the AROME France HD model), verifies the response,
stores the untouched JSON in ``data/raw/`` and converts it into a tidy hourly
DataFrame / CSV with explicit timestamps and units.

The HTTP fetch and the JSON parsing are kept in separate functions so the
parser can be unit-tested against mocked payloads without network access.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone as _tz
from pathlib import Path

import pandas as pd
import requests

from .. import config
from ..timeutils import build_time_frame

# Mapping of Open-Meteo hourly variable -> (output column, expected unit)
_VARIABLE_MAP = {
    "temperature_2m": ("temperature_c", "\u00b0C"),
    "precipitation": ("precipitation_mm", "mm"),
    "relative_humidity_2m": ("relative_humidity_pct", "%"),
    "wind_speed_10m": ("wind_speed_kmh", "km/h"),
}

# Variables we always expect AROME France HD to deliver. If any of these were
# missing we would still proceed but flag it (see ``check_variables``).
REQUIRED_VARIABLES = ("temperature_2m", "precipitation")


class AromeFetchError(RuntimeError):
    """Raised when the AROME request fails or returns an API-level error."""


def fetch_arome(
    latitude: float,
    longitude: float,
    hourly: tuple[str, ...] = config.AROME_HOURLY_VARS,
    forecast_days: int = 2,
    timezone: str = config.DEFAULT_TIMEZONE,
    model: str = config.AROME_MODEL_ID,
    timeout: int = 30,
    session: requests.Session | None = None,
) -> dict:
    """Send a real HTTP request to the AROME endpoint and return parsed JSON.

    Raises ``AromeFetchError`` on transport failure, non-200 status, or an
    Open-Meteo ``{"error": true, "reason": ...}`` payload.
    """
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "models": model,
        "hourly": ",".join(hourly),
        "forecast_days": forecast_days,
        "timezone": timezone,
    }
    http = session or requests
    try:
        resp = http.get(config.AROME_URL, params=params, timeout=timeout)
    except requests.RequestException as exc:  # network / timeout
        raise AromeFetchError(f"AROME request failed: {exc}") from exc

    if resp.status_code != 200:
        raise AromeFetchError(
            f"AROME endpoint returned HTTP {resp.status_code}: {resp.text[:300]}"
        )
    data = resp.json()
    if isinstance(data, dict) and data.get("error"):
        raise AromeFetchError(f"AROME API error: {data.get('reason')}")
    return data


def check_variables(raw: dict, requested: tuple[str, ...]) -> dict:
    """Report which requested variables are genuinely present in the response.

    Returns a dict with ``available``, ``missing`` and ``units`` keys. AROME
    France HD has a restricted variable set; any missing variable is documented
    here rather than silently substituted.
    """
    hourly = raw.get("hourly", {}) or {}
    units = raw.get("hourly_units", {}) or {}
    available = [v for v in requested if v in hourly and hourly[v] is not None]
    missing = [v for v in requested if v not in available]
    return {
        "available": available,
        "missing": missing,
        "units": {v: units.get(v) for v in available},
    }


def save_raw(raw: dict, path: Path | str) -> Path:
    """Persist the untouched JSON response to ``data/raw/``."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(raw, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def to_dataframe(
    raw: dict,
    field_id: str,
    retrieved_at_utc: str,
    model: str = config.AROME_MODEL_ID,
    timezone: str = config.DEFAULT_TIMEZONE,
) -> pd.DataFrame:
    """Convert a raw AROME response into the tidy hourly schema.

    Columns: field_id, valid_time_utc, valid_time_local, temperature_c,
    precipitation_mm, relative_humidity_pct (if available),
    wind_speed_kmh (if available), model_id, retrieved_at_utc.
    """
    hourly = raw.get("hourly")
    if not hourly or "time" not in hourly:
        raise AromeFetchError("AROME response has no 'hourly.time' block to parse")

    times = hourly["time"]
    frame = build_time_frame(times, timezone)
    out = pd.DataFrame(
        {
            "field_id": field_id,
            "valid_time_utc": frame["valid_time_utc"],
            "valid_time_local": frame["valid_time_local"],
        }
    )

    for api_var, (col, _unit) in _VARIABLE_MAP.items():
        if api_var in hourly and hourly[api_var] is not None:
            out[col] = pd.to_numeric(pd.Series(hourly[api_var]), errors="coerce")

    # Guarantee the always-expected columns exist even if the API omitted them.
    for api_var in REQUIRED_VARIABLES:
        col = _VARIABLE_MAP[api_var][0]
        if col not in out.columns:
            out[col] = pd.NA

    out["model_id"] = model
    out["retrieved_at_utc"] = retrieved_at_utc
    return out


def run(
    field: dict,
    forecast_days: int = 2,
    timezone: str = config.DEFAULT_TIMEZONE,
    session: requests.Session | None = None,
    save: bool = True,
) -> tuple[pd.DataFrame, dict]:
    """End-to-end: fetch, verify, store raw, parse, optionally export CSV.

    Returns ``(dataframe, metadata)``.
    """
    retrieved_at_utc = datetime.now(_tz.utc).isoformat()
    raw = fetch_arome(
        latitude=field["latitude"],
        longitude=field["longitude"],
        forecast_days=forecast_days,
        timezone=timezone,
        session=session,
    )
    var_report = check_variables(raw, config.AROME_HOURLY_VARS)

    if save:
        save_raw(raw, config.RAW_DIR / "arome_response.json")

    df = to_dataframe(
        raw, field_id=field["field_id"], retrieved_at_utc=retrieved_at_utc,
        timezone=timezone,
    )

    if save:
        config.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
        df.to_csv(config.WEATHER_HOURLY_CSV, index=False)

    meta = {
        "dataset": "AROME France HD (Meteo-France via Open-Meteo)",
        "data_kind": "real_weather_forecast",
        "url": config.AROME_URL,
        "model_id": config.AROME_MODEL_ID,
        "coordinates": {"latitude": field["latitude"], "longitude": field["longitude"]},
        "timezone": timezone,
        "forecast_days": forecast_days,
        "requested_variables": list(config.AROME_HOURLY_VARS),
        "available_variables": var_report["available"],
        "missing_variables": var_report["missing"],
        "variable_units": var_report["units"],
        "n_rows": int(len(df)),
        "valid_time_local_start": str(df["valid_time_local"].iloc[0]) if len(df) else None,
        "valid_time_local_end": str(df["valid_time_local"].iloc[-1]) if len(df) else None,
        "retrieved_at_utc": retrieved_at_utc,
    }
    return df, meta
