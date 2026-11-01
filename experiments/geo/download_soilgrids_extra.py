"""Acquire additional real SoilGrids 2.0 subsets (sand, silt, SOC, pH) via WCS
around the Castelnaudary study area. Small GeoTIFFs only; validates units and
computes the study-area mean of each property (with documented conversions).

SoilGrids 'mean' integer storage -> physical units:
  clay/sand/silt : g/kg      ( / 10 -> % )
  soc            : dg/kg     ( / 10 -> g/kg )
  phh2o          : pH x 10   ( / 10 -> pH )
"""
from __future__ import annotations
import json, hashlib
from pathlib import Path
import requests, numpy as np, rasterio

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "geo" / "samples"
OUT.mkdir(parents=True, exist_ok=True)
BBOX = dict(lon_min=1.93, lat_min=43.29, lon_max=1.97, lat_max=43.33)

PROPS = {  # property -> (map file, conversion divisor, physical unit)
    "sand": ("sand.map", 10.0, "%"),
    "silt": ("silt.map", 10.0, "%"),
    "soc":  ("soc.map", 10.0, "g/kg"),
    "phh2o": ("phh2o.map", 10.0, "pH"),
}
DEPTHS = ["0-5cm", "5-15cm"]


def wcs_url(mapfile, coverageid):
    return ("https://maps.isric.org/mapserv?map=/map/%s&SERVICE=WCS&VERSION=2.0.1"
            "&REQUEST=GetCoverage&COVERAGEID=%s&FORMAT=image/tiff"
            "&SUBSET=Long(%s,%s)&SUBSET=Lat(%s,%s)"
            "&SUBSETTINGCRS=http://www.opengis.net/def/crs/EPSG/0/4326"
            "&OUTPUTCRS=http://www.opengis.net/def/crs/EPSG/0/4326" % (
                mapfile, coverageid, BBOX["lon_min"], BBOX["lon_max"],
                BBOX["lat_min"], BBOX["lat_max"]))


def main():
    results = {}
    for prop, (mapfile, div, unit) in PROPS.items():
        for depth in DEPTHS:
            cov = f"{prop}_{depth}_mean"
            out = OUT / f"soilgrids_{prop}_{depth}_castelnaudary.tif"
            if not out.exists():
                r = requests.get(wcs_url(mapfile, cov), timeout=120)
                if r.status_code == 200 and r.content[:2] in (b"II", b"MM"):
                    out.write_bytes(r.content)
                else:
                    results[cov] = {"status": "error", "http": r.status_code}
                    continue
            with rasterio.open(out) as s:
                a = s.read(1).astype("float64")
                nod = s.nodata
                valid = a[(a > 0) & (a != (nod if nod is not None else -9999))]
                mean_phys = float(np.mean(valid)) / div if valid.size else None
                results[cov] = {
                    "file": str(out.relative_to(ROOT)),
                    "shape": list(a.shape), "crs": str(s.crs), "nodata": nod,
                    "n_valid": int(valid.size), "n_total": int(a.size),
                    "mean_physical": round(mean_phys, 2) if mean_phys is not None else None,
                    "unit": unit,
                    "sha256": hashlib.sha256(out.read_bytes()).hexdigest(),
                    "size_bytes": out.stat().st_size,
                }
            print(f"{cov}: mean={results[cov]['mean_physical']} {unit} "
                  f"| valid {results[cov]['n_valid']}/{results[cov]['n_total']}")
    (ROOT / "data" / "geo" / "soilgrids_extra_summary.json").write_text(
        json.dumps(results, indent=2), encoding="utf-8")
    print("wrote data/geo/soilgrids_extra_summary.json")


if __name__ == "__main__":
    main()
