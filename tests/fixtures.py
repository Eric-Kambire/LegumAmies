"""Deterministic mock payloads and fake HTTP objects for unit tests."""
from __future__ import annotations

import requests


def arome_raw(n_hours: int = 4, include_humidity: bool = True, include_wind: bool = True) -> dict:
    """A minimal AROME-shaped response with controllable variables."""
    times = [f"2026-10-31T{h:02d}:00" for h in range(n_hours)]
    hourly = {
        "time": times,
        "temperature_2m": [9.0 + h for h in range(n_hours)],
        "precipitation": [0.0, 0.2, 1.0, 0.0][:n_hours],
    }
    units = {"time": "iso8601", "temperature_2m": "\u00b0C", "precipitation": "mm"}
    if include_humidity:
        hourly["relative_humidity_2m"] = [80, 82, 85, 88][:n_hours]
        units["relative_humidity_2m"] = "%"
    if include_wind:
        hourly["wind_speed_10m"] = [10.0, 12.0, 9.0, 8.0][:n_hours]
        units["wind_speed_10m"] = "km/h"
    return {
        "latitude": 48.7,
        "longitude": 2.2,
        "utc_offset_seconds": 3600,
        "timezone": "Europe/Paris",
        "hourly_units": units,
        "hourly": hourly,
    }


def arome_hot_raw(hot_hours: int = 3) -> dict:
    """AROME payload with a heat spike above 25 C to trigger risk rules."""
    n = 6
    times = [f"2026-06-15T{10 + h:02d}:00" for h in range(n)]
    temps = [22.0, 24.0] + [30.0] * hot_hours + [20.0] * (n - 2 - hot_hours)
    return {
        "utc_offset_seconds": 7200,
        "timezone": "Europe/Paris",
        "hourly_units": {"time": "iso8601", "temperature_2m": "\u00b0C", "precipitation": "mm"},
        "hourly": {
            "time": times,
            "temperature_2m": temps[:n],
            "precipitation": [0.0] * n,
        },
    }


def aifs_raw(n_members: int = 3, n_hours: int = 48) -> dict:
    """AIFS ensemble payload: control 'precipitation' + member01..memberNN."""
    times = [f"2026-10-31T{(h % 24):02d}:00" for h in range(n_hours)]
    # shift date forward for the second day
    times = []
    for h in range(n_hours):
        day = 31 if h < 24 else 1
        month = 10 if h < 24 else 11
        times.append(f"2026-{month:02d}-{day:02d}T{(h % 24):02d}:00")
    hourly = {"time": times, "precipitation": [0.0] * n_hours}  # control member00 dry
    # member01: 0.3 mm each hour on day 1 -> 7.2 mm/day (exceeds 5)
    if n_members >= 2:
        hourly["precipitation_member01"] = [0.3 if h < 24 else 0.0 for h in range(n_hours)]
    # member02: 0.1 mm each hour day 1 -> 2.4 mm/day (below 5)
    if n_members >= 3:
        hourly["precipitation_member02"] = [0.1 if h < 24 else 0.0 for h in range(n_hours)]
    units = {"time": "iso8601", "precipitation": "mm"}
    return {"utc_offset_seconds": 3600, "timezone": "Europe/Paris", "hourly_units": units, "hourly": hourly}


class FakeResponse:
    def __init__(self, status_code=200, payload=None, text=""):
        self.status_code = status_code
        self._payload = payload if payload is not None else {}
        self.text = text

    def json(self):
        return self._payload


class FakeSession:
    """Mimics requests.Session.get with a canned response or exception."""

    def __init__(self, response=None, exc=None):
        self._response = response
        self._exc = exc
        self.calls = []

    def get(self, url, params=None, timeout=None):
        self.calls.append({"url": url, "params": params, "timeout": timeout})
        if self._exc is not None:
            raise self._exc
        return self._response


class TimeoutSession(FakeSession):
    def __init__(self):
        super().__init__(exc=requests.exceptions.Timeout("read timed out"))
