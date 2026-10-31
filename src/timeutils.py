"""Timestamp helpers shared by the weather parsers.

Open-Meteo returns naive ISO8601 strings already expressed in the requested
``timezone`` (here Europe/Paris). We localise those to that zone (DST-safe via
pandas) and derive the UTC instants from them, so both ``valid_time_local`` and
``valid_time_utc`` are always consistent with the timestamps the API returned.
"""
from __future__ import annotations

import pandas as pd


def build_time_frame(times: list[str], timezone: str) -> pd.DataFrame:
    """Return a DataFrame with tz-aware local and UTC columns.

    Parameters
    ----------
    times : list[str]
        Naive ISO8601 timestamps as returned by Open-Meteo (local wall time).
    timezone : str
        IANA timezone name the API was queried with (e.g. ``Europe/Paris``).

    Returns
    -------
    pandas.DataFrame with columns ``valid_time_local`` (tz-aware) and
    ``valid_time_utc`` (tz-aware, UTC).
    """
    local_naive = pd.to_datetime(pd.Series(times), format="ISO8601")
    # Localise to the API timezone. DST transitions are resolved conservatively;
    # the 10-day windows used here never straddle a French DST change, but these
    # arguments keep the code correct if they ever did.
    local = local_naive.dt.tz_localize(
        timezone, ambiguous=True, nonexistent="shift_forward"
    )
    utc = local.dt.tz_convert("UTC")
    return pd.DataFrame({"valid_time_local": local, "valid_time_utc": utc})
