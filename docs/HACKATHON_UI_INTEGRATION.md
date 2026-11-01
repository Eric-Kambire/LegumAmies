# Légume'Ami: hackathon UI integration (Ami, layers, heat curve, notification center)

Branch `feature/hackathon-ami-integration`. Frontend only: no Python, Bedrock agent or AWS change.

## Dependencies between branches

| Item | State when this branch was cut | Consequence |
|---|---|---|
| PR #6 `fix/ux-ui-audit-remediation` (tip `d08f3d7`) | open, not merged | **This branch is stacked on it.** Open this PR against `fix/ux-ui-audit-remediation`, or merge #6 first and retarget to `main`. |
| PR #7 `feature/geospatial-soil-foundation` | open, not merged; its `/geo/*` routes are not deployed | The soil panel calls `POST /geo/soil-risk` and `GET /geo/soil` **only when the "Scénarios" tab is opened**. On the deployed API (404) it shows an explicit "modèle de sol non disponible" state and no number. Nothing from #7 was copied into this branch. |
| `main` (deployed API) | `/assess`, `/advisor/ask`, `/health` | Used as is. |

## What a farmer now sees

1. **Accueil**: the selected parcel, its own weather, its main sourced risk, one primary action ("Voir l'analyse du risque"). First visit (only example parcels) shows a single "Créer ma première parcelle" call to action that opens the wizard directly.
2. **Carte**: Layers2 button (top right) opens one panel: exactly one weather visualization, plus independent geographic overlays with opacity, legend, validity time, source, coverage and caveat.
3. **Analyses**: one compact panel with four tabs, *Risque / Évolution / Scénarios / Méthode*. Évolution holds the flowering heat curve and the AIFS rain uncertainty chart. Scénarios holds soil intelligence.
4. **Ami** (floating assistant, every screen) replaces the long embedded advisor card.
5. **Notification center** (bell) opens a popover on desktop and a sheet on phones; the Alertes page keeps the full history.

## Ami

* `useAmiChat` (state in `App`, so it survives tab changes) + `AmiLauncher`, `AmiChatPanel`, `AmiMessage`, `AmiSources`, `AmiContextSelector`, `AmiAvatar`, `AmiRichText`.
* Two contexts, never mixed:
  * **Ma parcelle**: sends the selected field's coordinates, crop, stage, `harvest_ready`, name.
  * **Près de moi**: sends coordinates (and a label with the GPS accuracy) only, **no crop or stage**. The GPS is read only after the user presses "Utiliser ma position". If the permission is refused, "Choisir sur la carte" lets the user click a point.
* One question = one `POST /advisor/ask`. No call on load, navigation, tab switch or field switch. Sending is blocked while a request is in flight.
* History is kept on the device (`localStorage`, last 40 messages) and **never replayed to the API**. The panel says so. A real multi-turn contract would need an additive optional `history` field on `/advisor/ask`; it is not implemented.
* Evidence (citations, forecast provenance, uncertainty, limitations, model and KB ids) is shown exactly as returned, in an expandable block.
* Phones: full-height dialog with focus trap. Desktop: floating panel. Escape closes and returns focus to the launcher.

## Map layers

| Layer | Type | Source | Honest scope |
|---|---|---|---|
| Radar de précipitations | raster, mutually exclusive | RainViewer | Observation, extrapolation flagged. |
| Température, Vent, Nuages | **point value at the selected point** | Open-Meteo / Météo-France | Not a national map. The menu says so. A coloured value marker is drawn at the point. |
| Texture du sol | WMS overlay | ISRIC SoilGrids 2.0, clay 0-5 cm | France-wide, 250 m, **modelled**. |
| Parcelles déclarées | WMTS overlay | IGN RPG 2024 | PAC declarations, not ownership. |
| Limites administratives | WMTS overlay | IGN ADMIN EXPRESS | |
| Relief du terrain | WMTS overlay | IGN BD ALTI | **Altitude, not slope.** A computed slope raster is not integrated. |
| Contour de la parcelle | vector | user input | "Aucun contour enregistré" when none exists. |

IGN and ISRIC endpoints were checked live (HTTP 200, CORS `*`). The local Castelnaudary samples of PR #7 are not used for display; they feed the soil panel through the API.

The inspected map point (click, GPS, basin chip) is separate from the selected field. Moving the map no longer rewrites the field's coordinates; the sheet says "Point exploré" and offers "revenir à ma parcelle".

## Flowering heat curve

`FloweringHeatRiskChart` draws `/assess` `weather.hourly[].temperature_c` for the next 24 or 48 hours (windows start at the current hour, so a window can be shorter than requested and then says so). The threshold is, in order: the `heat_stress` alert returned by the API, then the sourced flowering table (`pois` 25, `féverole` 25, `lentille` 28 °C), and only in the flowering stage. Otherwise the card says why no threshold applies (no published threshold for the crop, or wrong stage). Output: hours above threshold, contiguous spans, max/min, hourly table. It computes an **exposure count only**: no damage probability, yield or money.

## Provenance, one design

Notifications use one `ProvenanceBadge`: **Prévision** (derived from the current assessment and sourced rules), **Exemple** (seeded illustration), **Simulée** (demonstration drawer). Example fields use one `Démo` chip. Notifications are local: nothing here claims delivery when the app is closed.

## Tests

`frontend/e2e/run.mjs` drives real Chrome through `playwright-core` (not a project dependency; `npm i --no-save playwright-core`). The deployed API only allows its own CORS origin, so the harness relays requests from Node and adds CORS headers; **responses are the real ones**. Two tests alter data on purpose and say so: "synthetic +20 °C" (shifts the real response to force exceedance) and "fixture" (soil response shaped like PR #7's, because the route is not deployed).

Viewports: 375×812, 390×844, 768×1024, 1366×768, 1920×1080, plus 640×900, 700×900, 767×1024 for the map.
Latest full run: see `reports/ux-remediation/hackathon/results.json` (screenshots next to it).

## Known gaps

* `/geo/*` is not deployed, so the soil panel shows its unavailable state against production.
* No computed slope raster; the "Relief" layer is altitude.
* Field polygons cannot be drawn in the UI yet (the overlay handles them when present).
* The advisor's wording ("envisagez ... l'ombrage ou l'irrigation") comes from the agent; the frontend displays it with its sources and limits but does not edit it.
* Native OS notifications work while the app/service worker runs. Server push is not built.
* The JS bundle is above 500 kB.
