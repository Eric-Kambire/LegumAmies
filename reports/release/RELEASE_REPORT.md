# Légume'Ami — AWS Release Report

Date: 2026-11-01 · Region: us-east-1 · AWS account: 040416400623
Role: deployment / release agent (no UI development performed; active dev sessions untouched)

---

## 1. Exact deployed Git SHA
`37d2c67da5e31a14c053fdce74fcd28ae0fddfc0` — tip of `origin/main` (latest reviewed + merged main).
Built from a clean detached worktree of that SHA; the dirty local branch and the two active UI dev worktrees were never used for the build.

## 2. Included vs excluded PRs

INCLUDED (merged to main, in this build):
- PR #2 — integration/team-testing (FastAPI layer, PWA wired to live backend) — merged `10ab19a`.
- PR #3 — Bedrock Converse agricultural advisor over existing KB — merged `053fba9`.
- PR #4 — final frontend integration: scientific cards, AIFS UncertaintyRainChart, ExplainabilityPanel, per-field BedrockAdvisorCard, Légume'Ami PWA branding — merged `99efd87`.
- PR #5 — PBC subseasonal experiment — merged `37d2c67`, but code lives only under `experiments/`; it is NOT wired into the runtime API and was NOT deployed as a forecasting approach.

EXCLUDED (open drafts — not merged, not auto-merged):
- PR #1 — wire-backend-contract (draft, base = integration/team-testing).
- PR #6 — UX/UI audit remediation (draft, `d08f3d7`).
- PR #7 — geospatial + soil + exploratory erosion (draft, `cf3c324`); its `/geo/*` endpoints are "contracts only, not live in FastAPI".
Consequently the global "Ami" assistant, the UX remediation, and all geo/soil features are NOT in this release.

## 3. Amplify deployment job
- App: `doxhuwpoc3ctn` (`legumamies-pwa`), branch `team-testing`, manual deployment (no new app/branch created).
- **Deployment job ID: 4** — status SUCCEED (start 06:45:24Z, end 06:45:32Z).
- URL preserved: https://team-testing.doxhuwpoc3ctn.amplifyapp.com
- Previous good job #3 retained as rollback target.

## 4. Lambda deployment / configuration
- Function `legumamies-climateshield-api`: python3.12, handler `src.api.main.handler` (Mangum), 1024 MB, 30 s timeout.
- `update-function-code` only (never create). Package built from release SHA with `requirements-api.txt` (manylinux2014 cp312 wheels) + `src/` + `data/raw/crop_rules.csv`, 45.7 MB.
- Resulting CodeSha256 = `vmbU9JuzfB0vDyV/mtyi20bLapEDC3hOXG6tqBWvWIU=` — byte-identical to the previously deployed build, confirming the live backend already matched release SHA 37d2c67.
- Reserved concurrency = 5. Env preserved: `LEGUMAMIES_KB_ID=C5WRYFYF1O`, `LEGUMAMIES_ADVISOR_MODEL=amazon.nova-lite-v1:0`, `LEGUMAMIES_CORS_ORIGINS=https://team-testing.doxhuwpoc3ctn.amplifyapp.com`.
- IAM role `legumamies-api-lambda-role` policies PRESERVED (inline `legumamies-bedrock-kb-access` + `AWSLambdaBasicExecutionRole`). Bedrock model and KB permissions untouched.

## 5. API Gateway URL
`https://ba8yoci7d8.execute-api.us-east-1.amazonaws.com` (HTTP API `ba8yoci7d8`, `$default` stage).
Throttling preserved: rate 5 / burst 10, detailed metrics on. CORS: team-testing Amplify origin + localhost:5173; methods GET/POST/OPTIONS.

## 6. Endpoint tests (success + failure)

Success:
- GET `/health` → 200 `{"status":"ok","version":"0.1.0"}`
- GET `/meta` → 200 (rule catalogue, Terres Inovia sourced thresholds)
- POST `/assess` → 200 (AROME `meteofrance_arome_france_hd` 48 real hours; AIFS `ecmwf_aifs025_ensemble` 51 members, 7-day rain probabilities; sourced risk rules; spraying window per Arrêté du 4 mai 2017)
- POST `/advisor/ask` → 200 in ~4.6 s (Nova Lite `amazon.nova-lite-v1:0`, KB `C5WRYFYF1O`, grounded, 3 real Terres Inovia citations, honest limitations)

Failure / edge:
- `/assess` invalid crop → 422 · missing fields → 422 · GET on POST route → 405
- `/advisor/ask` empty question → 422
- `/geo/soil` → 404 (geo not deployed — expected)

## 7. Browser verification (real Chrome, Playwright)
Screenshots: `reports/release/screenshots/` (16 PNGs). Details: `reports/release/e2e_verification.md`.
- Root 200, title "Légume'Ami — Météo Agricole France", 0 console errors.
- All 5 destinations navigate (Accueil, Carte, Parcelles, Analyses, Alertes).
- Scientific charts + sourced thresholds render; AIFS ensemble bars; wind-law card (19 km/h, Arrêté 4 mai 2017) with real per-day winds.
- Ami/Bedrock advisor invoked live → `/advisor/ask` 200, grounded answer with Terres Inovia citations (screenshot 08). Exactly 1 Bedrock request per ask (no duplicates).
- Weather layer toggles: all 4 real overlays (Pluie/Nuages/Temp./Vent).
- Notifications view renders; responsive captured at 375/390/768/desktop.
- Soil results: none shown — correct, backend has no soil support in this release.

## 8. Cache / PWA verification
- `manifest.json` served (200): standalone display, 3 icons, Légume'Ami branding.
- `sw.js` served (200): cache `legumamies-v3`; `activate` deletes stale caches (cache-busting), network-first for weather APIs, cache-first for tiles, push + notificationclick handlers.
- Content-hashed asset filenames (`index-irTn19tn.js`) guarantee no stale JS. Live served bundle SHA256 `4e9652d2…c44f` is byte-identical to the built bundle (no stale cache).
- Installable PWA metadata present (apple-touch-icon, theme-color, standalone).

## 9. AWS cost / security observations
- Models/resources reused, nothing created. Within free tier (Amplify + Lambda + API Gateway).
- Bedrock: Nova Lite (lowest-cost tier); one Converse + one KB Retrieve per advisor request (no duplicate LLM calls). Spend bounded by reserved concurrency 5 + API GW throttle 5/10.
- Last 3 h: 108 Lambda invocations (test traffic), **0 Lambda errors**, no CloudWatch ERROR entries.
- Auth via ambient IAM instance role; no static secrets introduced. CORS restricted to the team-testing origin (+ localhost for dev).

## 10. Remaining blockers and rollback

Blockers / known issues (pre-existing in the release, NOT introduced by this deploy):
1. Duplicate `POST /assess` at initial load (~426 ms apart, same field): `App.tsx` and `ForecastInsightsView` both mount `useBackendAssess`. Redundant backend call; it is `/assess` (deterministic weather, no Bedrock/LLM cost). Fix is in draft PR #1/#6.
2. Minor radar / bottom-sheet tightness at 375 px — the item draft PR #6 targets.
Neither blocks the release; both resolve when the UX PRs are reviewed and merged.

Rollback path (if needed):
- Frontend: `aws amplify start-deployment` cannot replay an old job; redeploy the prior good artifact, or re-run a manual deployment of the previous `dist`. Last known-good Amplify job = **#3** (2026-10-31T23:24Z). Fastest revert: rebuild from the previous main commit `99efd87` and manual-deploy to the same app/branch.
- Backend: restore the prior Lambda package. Baseline CodeSha256 `vmbU9JuzfB0vDyV/mtyi20bLapEDC3hOXG6tqBWvWIU=` (identical to current, so the current code IS the known-good). To revert code, `aws lambda update-function-code` with a package built from the desired prior SHA. Env/role/concurrency were unchanged, so no config rollback needed.
- Full baseline snapshot: `reports/release/pre_deploy_baseline.json`.

Summary: Backend (Lambda @ 37d2c67) and frontend (Amplify job #4) are live and healthy on the existing resources. No resources were created, UI dev sessions were not touched, and the two unmerged feature sets (global Ami assistant / UX remediation, and geo-soil) are correctly NOT deployed.
