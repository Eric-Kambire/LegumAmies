# Légume'Ami — End-to-end browser verification (real Chrome via Playwright)

URL tested: https://team-testing.doxhuwpoc3ctn.amplifyapp.com (Amplify job #4)
Release SHA: 37d2c67da5e31a14c053fdce74fcd28ae0fddfc0
Browser: Chrome 1.64.1 headless. Screenshots in `reports/release/screenshots/`.

## Verified live
- Root load: HTTP 200, title "Légume'Ami — Météo Agricole France". 0 console errors.
- **Five navigation destinations** (desktop nav "Navigation Bureau"): Accueil, Carte Météo France, Mes Parcelles, Prévisions & Analyses, Alertes — all render (nav OK).
- **Field weather & risk**: active field "Parcelle du Moulin (Lauragais)" / Castelnaudary, pois_chiche / floraison. Weather sheet shows live 11° Couvert, hourly forecast.
- **Scientific charts & sourced thresholds** (Analyses tab): AIFS ensemble rain-probability bars per day (model `ecmwf_aifs025_ensemble`); regulatory spraying card "vent > 19 km/h" citing legal threshold 19 km/h / Arrêté du 4 mai 2017, per-day winds (Dim.1 25.5, Lun.2 20.1 km/h) matching backend `/assess`.
- **Ami / Bedrock advisor**: typed a question, submit → live `POST /advisor/ask` returned **HTTP 200**; answer card labelled "Conseiller Agronomique IA (Bedrock Converse)" + `KB C5WRYFYF1O` + `amazon.nova-lite-v1:0`, "SYNTHÈSE GROUNDED" with real AROME/AIFS prose (Tmax 15.2°C, Tmin 2.4°C, 1 nov. 2026). Terres Inovia citations visible.
- **No duplicate Bedrock requests**: exactly **1** `/advisor/ask` call per ask; switching tabs adds 0 advisor calls.
- **Weather layer toggles**: all four real overlays clickable — Pluie (radar), Nuages (clouds), Temp. (temperature), Vent (wind).
- **Notifications**: Alertes view renders (Duolingo-style notifications from seeded fields).
- **Responsive**: captured at 375, 390, 768 px and 1280 desktop. Layout functional at all; mobile tab bar present.
- **PWA**: manifest served (name "Légume'Ami - Météo Agricole France", display standalone, 3 icons), service worker file served (sw.js 200). Installable PWA metadata present (apple-touch-icon, theme-color, standalone).

## NOT YET DEPLOYED (belong to unmerged draft PRs — correctly absent)
- **Global "Ami" assistant** (app-wide chatbot) and new UX/UI remediation: belong to the active dev branch `feature/hackathon-ami-integration` and draft PR #6 — not merged to main, so not in this release. The advisor in this release is the per-field `BedrockAdvisorCard` inside the Analyses tab (working, as shown).
- **Geospatial / soil layers & `/geo/*`**: draft PR #7, unmerged. No soil results are shown and `/geo/*` returns 404. Correct — soil displays only where backend supports it (it doesn't yet).

## Known pre-existing issues in the deployed release (not regressions from this deploy)
1. **Duplicate `/assess` on initial load**: 2 identical `POST /assess` fire ~426 ms apart for the same field at startup (App.tsx + ForecastInsightsView both mount `useBackendAssess`). This is the exact issue flagged for remediation in draft PR #1/#6. It is a `/assess` (deterministic weather) call, NOT Bedrock, so no LLM cost impact; it is a redundant backend request pending the unmerged fix.
2. **375 px radar/bottom-sheet tightness**: minor visual overlap between the radar timeline / map labels and the bottom weather sheet at 375 px — the exact item PR #6 (unmerged) is meant to fix.
