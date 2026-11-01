"""Retrieve a genuine Sentinel-2 L2A scene (low cloud) over the Castelnaudary
study area and compute NDVI with proper scaling, SCL cloud masking and a
documented fractional-vegetation-cover proxy.

Source: Earth Search STAC (earth-search.aws.element84.com/v1) + public
sentinel-cogs COGs (AWS Open Data, no auth). Bands: B04 (red,10m), B08 (nir,10m),
SCL (20m scene classification).
"""
from __future__ import annotations
import json, hashlib
from pathlib import Path
import requests, numpy as np, rasterio
from rasterio.warp import transform_bounds
from rasterio.windows import from_bounds
from rasterio.enums import Resampling

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "geo" / "samples"
BBOX4326 = (1.93, 43.29, 1.97, 43.33)
STAC = "https://earth-search.aws.element84.com/v1/search"
# SCL classes to mask out (cloud shadow, cloud med/high, cirrus, snow)
SCL_MASK = {3, 8, 9, 10, 11}


def pick_item():
    body = {"collections": ["sentinel-2-l2a"], "bbox": list(BBOX4326),
            "datetime": "2025-04-01T00:00:00Z/2025-09-30T23:59:59Z",
            "query": {"eo:cloud_cover": {"lt": 10}},
            "sortby": [{"field": "properties.eo:cloud_cover", "direction": "asc"}],
            "limit": 5}
    r = requests.post(STAC, json=body, timeout=60); r.raise_for_status()
    feats = r.json()["features"]
    if not feats:
        raise SystemExit("no low-cloud S2 item found")
    return feats[0]


def read_band(href, dst_bounds_crs_bounds, dst_crs, out_shape=None):
    with rasterio.open(f"/vsicurl/{href}") as s:
        b = transform_bounds("EPSG:4326", s.crs, *BBOX4326)
        win = from_bounds(*b, s.transform)
        kwargs = {}
        if out_shape:
            kwargs = dict(out_shape=out_shape, resampling=Resampling.nearest)
        arr = s.read(1, window=win, **kwargs)
        return arr, s.crs, s.window_transform(win)


def main():
    it = pick_item()
    props = it["properties"]
    assets = it["assets"]
    red_href = assets.get("red", assets.get("B04"))["href"]
    nir_href = assets.get("nir", assets.get("B08"))["href"]
    scl_href = assets.get("scl", assets.get("SCL"))["href"]
    boa_off = props.get("earthsearch:boa_offset_applied", False)
    offset = -1000.0 if boa_off else 0.0

    red, crs, tr = read_band(red_href, BBOX4326, None)
    nir, _, _ = read_band(nir_href, BBOX4326, None)
    scl, _, _ = read_band(scl_href, BBOX4326, None, out_shape=red.shape)  # resample 20m->10m grid

    red_r = (red.astype("float64") + offset) / 10000.0
    nir_r = (nir.astype("float64") + offset) / 10000.0
    cloud = np.isin(scl, list(SCL_MASK))
    valid = (~cloud) & (nir_r + red_r > 0)
    ndvi = np.full(red_r.shape, np.nan)
    denom = nir_r + red_r
    ndvi[valid] = (nir_r[valid] - red_r[valid]) / denom[valid]
    ndvi = np.clip(ndvi, -1, 1)

    vv = ndvi[np.isfinite(ndvi)]
    # documented fractional vegetation cover proxy: fc = clip((NDVI-0.2)/(0.8-0.2),0,1)
    fc = np.clip((vv - 0.2) / 0.6, 0, 1)
    summary = {
        "item_id": it["id"], "datetime": props.get("datetime"),
        "cloud_cover_pct": props.get("eo:cloud_cover"),
        "crs": str(crs), "boa_offset_applied": boa_off,
        "ndvi_shape": list(ndvi.shape),
        "valid_fraction_after_cloud_mask": round(float(valid.mean()), 3),
        "ndvi_mean": round(float(np.nanmean(vv)), 3),
        "ndvi_p10": round(float(np.nanpercentile(vv, 10)), 3),
        "ndvi_p90": round(float(np.nanpercentile(vv, 90)), 3),
        "vegetation_cover_fraction_mean": round(float(fc.mean()), 3),
        "scaling": "reflectance=(DN%+d)/10000; NDVI=(NIR-RED)/(NIR+RED)" % int(offset),
        "cloud_mask": "SCL in {3,8,9,10,11} masked",
        "source": "Copernicus Sentinel-2 L2A via Earth Search STAC + sentinel-cogs (AWS Open Data)",
        "licence": "Copernicus Sentinel data (free & open)",
    }
    # save a small downsampled NDVI GeoTIFF for the figure (keep committed size tiny)
    step = max(1, ndvi.shape[0] // 120)
    small = ndvi[::step, ::step].astype("float32")
    prof = {"driver": "GTiff", "height": small.shape[0], "width": small.shape[1],
            "count": 1, "dtype": "float32", "crs": crs,
            "transform": tr * tr.scale(step, step), "compress": "deflate", "nodata": np.nan}
    outtif = OUT / "sentinel2_ndvi_castelnaudary.tif"
    with rasterio.open(outtif, "w", **prof) as d:
        d.write(np.nan_to_num(small, nan=-9999).astype("float32"), 1)
    summary["file"] = str(outtif.relative_to(ROOT))
    summary["size_bytes"] = outtif.stat().st_size
    summary["sha256"] = hashlib.sha256(outtif.read_bytes()).hexdigest()
    (ROOT / "data" / "geo" / "ndvi_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps({k: summary[k] for k in
          ["item_id", "datetime", "cloud_cover_pct", "crs",
           "valid_fraction_after_cloud_mask", "ndvi_mean",
           "vegetation_cover_fraction_mean", "size_bytes"]}, indent=2))


if __name__ == "__main__":
    main()
