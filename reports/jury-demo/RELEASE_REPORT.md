# Légume'Ami — Jury Demo Release Report (fix, validate, integrate, deploy)

Date: 2026-11-01 · Region: us-east-1 · Account: 040416400623

## 1. Clean build / lint
Clean checkout of PR #8 (`feature/jury-demo-ux-chat-map`) initially FAILED to compile (as the PR warned — never built in its authoring environment).
- `npm ci`: OK (0 vulnerabilities).
- One hard TypeScript error fixed: `FieldActivityJournal.tsx` malformed prop type `onClose: ();` → `onClose: () => void`.
- After fixes: `npm run lint` (oxlint) EXIT 0 (warnings only, no errors); `npm run build` (tsc -b && vite build) EXIT 0, 2094 modules.
- Final deployed asset hashes: `index-DtS5qe_e.js` (604 KB), `index-oMmrtIj1.css`. Service worker cache bumped to `legumamies-v4`.

## 2. Python backend tests
`pytest` → **51 passed**. PR #8 is frontend-only; backend/Lambda unchanged (stays at main `37d2c67`), no backend redeploy required.

## 3–8. Browser verification (real Chrome via Playwright)
Screenshots: `reports/jury-demo/{p0,responsive,live}/`.

### Weather modes (P0) — all four work with real point data
Root cause of the "empty Nuages/Vent" the user saw: the desktop WeatherSheet (z-500) overlapped the layers panel (z-480) and intercepted the mode-toggle clicks. **Fix:** raised the layers container to z-520 (`MapControls.tsx`). After fix:
- **Pluie**: RainViewer radar renders; timeline present.
- **Vent**: 19 km/h + direction arrow rotated to bearing (295°) + map recenters + point tooltip.
- **Nuages**: cloud-cover % + bar indicator + recenter.
- **Température**: real 2 m temperature °C + recenter.
Labelled "Météo-France (AROME/ARPEGE) via Open-Meteo" — honest point value, not a national raster.

### Parcel drawing (P0) — full journey works
Draw ≥3 corners (polygon fills), undo (4→3 pts, 13.97→6.99 ha), clear, finish → spherical hectares (e.g. 15.17 ha), self-intersection + min-area guards. Save persists `polygonCoordinates` as `[lat,lng]`; reload keeps it; edit reopens with the polygon and **preserves field id + createdAt**; the saved polygon renders as a distinct green outline on the main map; point-only fields still supported.

### Four scientific modules (P1)
- **Flowering Risk**: real AROME hourly temperature, sourced crop threshold, 24/48 h, exceedance-hour count, "exposure, not damage" wording.
- **Irrigation Timing**: real 3-day rain + logged irrigation; **no invented FAO-56 date** ("bilan hydrique à venir").
- **Harvest Windows**: real AIFS ensemble ranking ("51 membres max"), honest readiness gating.
- **Soil Intelligence**: prefers `/geo/soil-risk` (still 404 → PR #7 not deployed) then falls back to the executed Castelnaudary case study: RUSLE baseline **6.68**, wetter **8.69**, improved cover **2.10** t/ha/yr, vulnerability **40.5/100**. Honest "study area, not all-France" + limitations.

### Ami floating chat (P1)
Globally mounted (all screens), persists across tab switches, passes `{lat,lon,crop,growth_stage,harvest_ready,field_name}` to `/advisor/ask`, GPS mode with permission/accuracy. On the **live** deploy: `POST /advisor/ask` → **200**, real Nova Lite grounded answer with **clickable Terres Inovia sources (2)**, **exactly one** Bedrock call per question.

### Notification center (P1)
Bell opens a fixed popover (desktop top-right / mobile bottom sheet); unread count; mark-read / mark-all → "0 non lue"; full history; demo "Exemple" labels. **Fix:** outside-click dismissal didn't fire over the Leaflet map (Leaflet stops pointer propagation) → added capture-phase `pointerdown` listener. Toggle/Escape/outside-click all dismiss.

### Responsive (P1)
375/390/640/767/768/1366/1920 — Ami launcher above the bottom nav at every size, notification center and Ami dialog stay within the viewport, 0 page errors.

### Duplicate /assess (P1) — fixed
PR #8 already removed the App+View double hook. Remaining 2nd call came from the effect depending on the `field` object reference (App mutates it after reverse-geocode). **Fix:** key the effect on a stable signature (`id+lat+lon+crop+stage`) in `useBackendAssess.ts`. Verified: **1** `/assess` on load, **1** per field switch.

## 9. Merge coordination
- Ancestry: PR #6 (`d08f3d7`) is fully contained in PR #8; main (`37d2c67`) is an ancestor of PR #8 (clean, no conflicts). Merging PR #8 brings PR #6 along.
- Produced a verified integration branch **`integration/jury-demo-verified`** = main + PR #6 + PR #8 + the 4 fixes above, pushed to origin.
- Did NOT merge the draft PRs on GitHub or push to `main` (left for human review). PR #7 kept separate; its `/geo/*` endpoints remain undeployed (404), and the soil card correctly falls back.
- Active sibling worktrees (`feature/hackathon-ami-integration`, and a newly appeared `feature/jury-release-rag-parcel`) were never touched.

## 10. Deployment (update-only, no resources recreated)
- **Deployed Git SHA: `d0687a21f1ec3c88256fe7a0c2091bbde93c5933`** (branch `integration/jury-demo-verified`).
- Frontend: Amplify manual deployment to existing app `doxhuwpoc3ctn`, branch `team-testing` → **job #5 SUCCEED**. Live JS SHA256 matches the local build byte-for-byte (`7228a9ab…`) — genuine deploy, content-hash + sw-v4 cache-busting.
- Backend: unchanged. Lambda `legumamies-climateshield-api` CodeSha256 `vmbU9Juzf…` (main 37d2c67), reserved concurrency 5. API Gateway `ba8yoci7d8` throttle 5/10. Bedrock `amazon.nova-lite-v1:0` + KB `C5WRYFYF1O` preserved.
- Live checks: root 200, `/sw.js` 200, `/geo/*.json` 200, `/assess` 200, `/advisor/ask` 200 with citations, `/geo/soil-risk` 404 (expected). 0 CloudWatch errors from live traffic.

## 11. Live public URL
https://team-testing.doxhuwpoc3ctn.amplifyapp.com

## 12. Remaining issues (by severity)
- **Low** — `/geo/soil-risk` returns 404 (PR #7 backend not deployed); Soil Intelligence uses the checked-in Castelnaudary case study. Intended; deploy PR #7 backend to go live.
- **Low** — Soil Intelligence only covers the Castelnaudary study area; other fields show "à explorer". By design.
- **Low** — JS bundle 604 KB (>500 KB warning). Cosmetic; code-splitting is a future optimization.
- **Low** — Irrigation timing shows the water-balance engine as "à venir" (FAO-56 not connected). Honest placeholder, per spec.
- **Info** — Weather Vent/Nuages/Temp are single-point Open-Meteo values, not national rasters (clearly labelled).

## Rollback
- Frontend: re-run a manual Amplify deployment of the previous artifact; last known-good is **job #4** (2026-11-01T06:45Z, the prior main-37d2c67 build).
- Backend: unchanged this release; known-good Lambda CodeSha256 `vmbU9JuzfB0vDyV/mtyi20bLapEDC3hOXG6tqBWvWIU=`.
- The deployed source is reproducible from `integration/jury-demo-verified` (`d0687a2`).
