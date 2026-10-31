"""Dataset B - ECMWF AIFS (AI Forecasting System) ensemble.

Retrieves the REAL ECMWF AIFS ensemble precipitation forecast from Open-Meteo's
ensemble endpoint and reshapes the per-member series into long-format tabular
data.

This module targets AIFS specifically (``ecmwf_aifs025_ensemble``) and never
falls back to the traditional ECMWF IFS ensemble. If the AIFS request fails, a
clear error is raised instead of silently substituting another model.

Open-Meteo exposes ensemble members as separate hourly keys:
  - ``precipitation``            -> control member (member00)
  - ``precipitation_memberNN``   -> perturbed members 01..NN
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone as _tz
from pathlib import Path

import pandas as pd
import requests

from .. import config
from ..timeutils import build_time_frame

_MEMBER_RE = re.compile(r"^precipitation_member(\d+)$")


class AifsFetchError(RuntimeError):
    """Raised when the AIFS ensemble request fails or returns no members."""


def fetch_ensemble(
    latitude: float,
    longitude: float,
    hourly: str = "precipitation",
    forecast_days: int = 10,
    timezone: str = config.DEFAULT_TIMEZONE,
    model: str = config.AIFS_MODEL_ID,
    timeout: int = 60,
    session: requests.Session | None = None,
) -> dict:
    """Send a real HTTP request to the AIFS ensemble endpoint.

    Raises ``AifsFetchError`` on transport failure, non-200 status or an
    API-level error. The requested model is passed through verbatim; no IFS
    substitution is ever attempted.
    """
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "models": model,
        "hourly": hourly,
        "forecast_days": forecast_days,
        "timezone": timezone,
    }
    http = session or requests
    try:
        resp = http.get(config.AIFS_URL, params=params, timeout=timeout)
    except requests.RequestException as exc:
        raise AifsFetchError(f"AIFS ensemble request failed: {exc}") from exc

    if resp.status_code != 200:
        raise AifsFetchError(
            f"AIFS endpoint returned HTTP {resp.status_code}: {resp.text[:300]}"
        )
    data = resp.json()
    if isinstance(data, dict) and data.get("error"):
        raise AifsFetchError(
            f"AIFS API error (model={model!r}): {data.get('reason')}"
        )
    return data


def extract_members(raw: dict) -> list[tuple[str, list]]:
    """Return ordered ``(member_id, series)`` pairs from the raw response.

    ``precipitation`` is mapped to ``member00`` (control); ``precipitation_memberNN``
    to ``memberNN``. Raises ``AifsFetchError`` if no precipitation series exist.
    """
    hourly = raw.get("hourly", {}) or {}
    members: list[tuple[str, list]] = []

    if "precipitation" in hourly and hourly["precipitation"] is not None:
        members.append(("member00", hourly["precipitation"]))

    numbered: list[tuple[int, str, list]] = []
    for key, series in hourly.items():
        m = _MEMBER_RE.match(key)
        if m and series is not None:
            numbered.append((int(m.group(1)), f"member{int(m.group(1)):02d}", series))
    numbered.sort(key=lambda t: t[0])
    members.extend((mid, series) for _, mid, series in numbered)

    if not members:
        raise AifsFetchError(
            "AIFS response contained no precipitation ensemble members"
        )
    return members


def count_valid_members(raw: dict) -> int:
    """Number of ensemble members actually present (may be < 51)."""
    return len(extract_members(raw))


def save_raw(raw: dict, path: Path | str) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(raw, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def to_long_dataframe(
    raw: dict,
    field_id: str,
    model: str = config.AIFS_MODEL_ID,
    timezone: str = config.DEFAULT_TIMEZONE,
) -> pd.DataFrame:
    """Reshape ensemble members into long format.

    Columns: field_id, valid_time_utc, valid_time_local, member_id,
    precipitation_mm, model_id.
    """
    hourly = raw.get("hourly")
    if not hourly or "time" not in hourly:
        raise AifsFetchError("AIFS response has no 'hourly.time' block to parse")

    frame = build_time_frame(hourly["time"], timezone)
    members = extract_members(raw)

    pieces = []
    for member_id, series in members:
        # Copy the tz-aware time frame per member. Avoid ``.values`` here: it
        # would strip the timezone and silently convert local times to UTC.
        block = frame.copy()
        block.insert(0, "field_id", field_id)
        block["member_id"] = member_id
        block["precipitation_mm"] = pd.to_numeric(
            pd.Series(series, index=block.index), errors="coerce"
        )
        block["model_id"] = model
        pieces.append(block)

    out = pd.concat(pieces, ignore_index=True)
    return out[
        [
            "field_id",
            "valid_time_utc",
            "valid_time_local",
            "member_id",
            "precipitation_mm",
            "model_id",
        ]
    ]


def run(
    field: dict,
    forecast_days: int = 10,
    timezone: str = config.DEFAULT_TIMEZONE,
    session: requests.Session | None = None,
    save: bool = True,
) -> tuple[pd.DataFrame, dict]:
    """End-to-end: fetch, store raw, reshape to long format, optionally export."""
    retrieved_at_utc = datetime.now(_tz.utc).isoformat()
    raw = fetch_ensemble(
        latitude=field["latitude"],
        longitude=field["longitude"],
        forecast_days=forecast_days,
        timezone=timezone,
        session=session,
    )
    n_members = count_valid_members(raw)

    if save:
        save_raw(raw, config.RAW_DIR / "aifs_ensemble_response.json")

    df = to_long_dataframe(raw, field_id=field["field_id"], timezone=timezone)

    if save:
        config.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
        df.to_csv(config.ENSEMBLE_HOURLY_CSV, index=False)

    local_times = df["valid_time_local"]
    meta = {
        "dataset": "ECMWF AIFS ensemble (via Open-Meteo)",
        "data_kind": "real_weather_forecast",
        "url": config.AIFS_URL,
        "model_id": config.AIFS_MODEL_ID,
        "coordinates": {"latitude": field["latitude"], "longitude": field["longitude"]},
        "timezone": timezone,
        "forecast_days": forecast_days,
        "ensemble_members_valid": int(n_members),
        "ensemble_members_expected_max": 51,
        "n_rows_long": int(len(df)),
        "valid_time_local_start": str(local_times.min()) if len(df) else None,
        "valid_time_local_end": str(local_times.max()) if len(df) else None,
        "retrieved_at_utc": retrieved_at_utc,
    }
    return df, meta
