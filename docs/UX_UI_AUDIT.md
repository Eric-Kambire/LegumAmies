# Légume'Ami — UX/UI Diagnostic Audit

_Deployment audited: `origin/main` @ `37d2c67`, live at
https://team-testing.doxhuwpoc3ctn.amplifyapp.com (backend
https://ba8yoci7d8.execute-api.us-east-1.amazonaws.com). Audit date 2026-10-31._

**Method.** Both the **actual rendered app in a real browser** (Playwright
driving system Google Chrome; screenshots in `reports/ux-audit/screenshots/`,
viewports 375×812, 390×844, 768×1024, 1366×768, 1920×1080) **and** the React
source were reviewed. Where a finding is from source only, it says so.

**Scope.** Diagnostic only. This is **not** a redesign. The premium, minimal,
iOS-inspired identity is sound and should be preserved; the issues below are
targeted corrections. Visual implementation remains Gemini's responsibility.

---

## 1. Executive assessment

Légume'Ami is a genuinely polished, premium-feeling iOS-style PWA with real
value: live AROME/AIFS forecasts, a Leaflet weather map with radar timeline,
sourced agronomic risk rules, and a working Bedrock (Nova Lite) advisor grounded
on a real Knowledge Base. Typography, glass cards, dark theme and iconography are
consistent and attractive.

The product's main weakness is **density and repetition**, not aesthetics. The
same field, the same wind alert, and the same crop/stage are restated across
Accueil, Carte and Analyses, so the farmer re-reads the same thing instead of
progressing. Two screens have concrete layout defects: the **bottom tab bar
overlaps content** on several screens, and **Notifications** inverts its
information architecture (a push *simulator* and an "Activer le Push" card sit
above the actual notifications). A few statements risk the project's hard-won
scientific credibility: a **static morning briefing shown at night**, a push
card implying **background delivery that is not implemented**, and an
**untranslated English limitation string**.

None of these require a redesign. They require de-duplication, a bottom-padding/
z-index fix, a Notifications re-order, and three honesty corrections.

---

## 2. Component inventory & responsibility map

| Area | Component (file) | Responsibility | Notes |
|---|---|---|---|
| Nav (mobile) | `components/Navigation/AppleTabBar.tsx` | 5 tabs: Accueil/Carte/Parcelles/Analyses/Alertes | Fixed overlay; content underlaps it (see P1-3) |
| Nav (desktop) | `components/Navigation/DesktopNavBar.tsx` | Top nav + field selector + API button | Field name truncates |
| Accueil | `components/Home/HomeView.tsx` | Dashboard: briefing, hero field, alerts, field list | Static briefing (P1-5); repetition |
| Carte | `components/Map/WeatherMap.tsx`, `MapControls.tsx`, `components/RadarTimeline/RadarTimeline.tsx`, `IntensityLegend.tsx` | Leaflet map, layer toggles, radar timeline | Sheet + timeline overlap map on desktop (P2) |
| Weather sheet | `components/WeatherSheet/WeatherSheet.tsx` (+ `CurrentMetrics`, `HourlyForecast`, `DailyForecast`, `AgriRiskCard`, `FieldConfigModal`) | Per-field weather + 7-day + agro diagnostic | Very tall; same alert as elsewhere |
| Parcelles | `components/Fields/MyFieldsView.tsx`, `BotanicalCard.tsx`, `WeatherSheet/FieldConfigModal.tsx` | Field list, add/edit/delete, crop/stage picker | Cleanest screen; titles truncate |
| Analyses | `components/Insights/ForecastInsightsView.tsx` | Synthèse/Explications modes, risk cards, AIFS uncertainty, harvest, advisor | **Advisor rendered twice** (P1-1); English note (P1-7) |
| Advisor | `components/Scientific/BedrockAdvisorCard.tsx` | Calls `POST /advisor/ask`; renders Nova answer + citations | Instantiated in both modes → duplicate calls |
| Notifications | `components/Notifications/NotificationsView.tsx`, `DuoNotificationBanner.tsx`, `services/duoNotificationService.ts`, `services/pushNotificationService.ts` | Streak, push simulator, permission, filters, list | IA inverted + overlap (P0/P1); local-only push (P1-2) |
| PWA | `components/Navigation/PwaInstallBanner.tsx`, `services/pwaService.ts`, `public/sw.js`, `public/manifest.json` | Install prompt, service worker | OK; manifest/sw served 200 |
| API client | `services/legumamiesApi.ts` | `assess`, `askAdvisor`, `health` via `VITE_API_BASE_URL` | Correct; honest unavailable fallback |

---

## 3. Screen-by-screen findings

### 3.1 Accueil (`HomeView.tsx`) — screenshot `tab_1_accueil.png`
- **P1 — Static, time-inconsistent briefing.** "BRIEFING AGRONOMIQUE DU JOUR:
  Excellentes conditions ce matin… Fenêtre de traitement optimale ouverte
  jusqu'en début d'après-midi" was rendered at **23:26 (Nuit)**. It is not tied
  to the real time/forecast and contradicts the night context. _Why it matters:_
  a farmer glancing at the dashboard is told it's a good spraying morning when
  it's night — erodes trust in every other number.
- **P1 — Scientifically loose.** The same briefing says "hygrométrie favorable"
  while the hero card shows **Humidité 90%** (high humidity is not a favourable
  spraying condition). _Why it matters:_ contradicts the app's own agronomic rules.
- **P1 — Bottom nav overlaps the last field card** (see P1-3 global).
- **P2 — Repetition.** "Parcelle du Moulin" appears 3× on this one screen (hero,
  field list) and the wind alert duplicates Carte/Analyses.
- **P2 — Truncation.** "3 parcelles enregistrées • 54 ha sous surv…".
- **P1 — Demo fields unlabelled** (see P1-6 global). "3 parcelles enregistrées"
  presents seed/demo fields as the user's real farm.
- _10-second test:_ partially passes — the hero field temp/stage and one alert
  are visible, but the misleading briefing is the most prominent block.

### 3.2 Carte Météo (`WeatherMap.tsx` + sheet + radar) — `tab_2_carte.png`, `landing_desktop_1920x1080.png`
- **Good:** radar timeline is explicitly labelled "Radar historique (observé) —
  Ne constitue pas une prévision" — observation vs forecast is clearly
  distinguished. Layer toggles (Pluie/Nuages/Temp/Vent) are clear. Agronomic
  diagnostic cites the real Arrêté du 4 mai 2017 with the actual 22.5 km/h value.
- **P2 — Desktop overlap/overflow.** The right-hand weather sheet is very tall
  (current + hourly + 7-day + diagnostic) and the floating radar timeline card
  overlaps the map; on 1366×768 the sheet runs beyond the viewport. _Why:_ hard
  to read the map and controls simultaneously.
- **P2 — Town chips + controls over the map** can compete with map panning on
  small screens.
- **P2 — Field selector truncated** in the top nav ("Parcelle du Moulin (L…").

### 3.3 Mes Parcelles (`MyFieldsView.tsx`) — `tab_3_parcelles.png`
- **Cleanest, on-brand screen.** 3 field cards with crop + numbered stage
  (2. Floraison, 3. Formation des gousses, 5. Prêt à récolter), Active badge,
  edit/delete, Sélectionner. Bottom nav does **not** overlap here (short list).
- **P2 — Titles truncated** ("Parcelle du Moulin (…", "Champ des Vignes (…").
- **P2 — Subtitle truncated** ("Gérez vos assolements et suivez chaque st…").
- **Create/edit journey:** reviewed in **source only** (`FieldConfigModal.tsx`) —
  not opened in the browser in this pass; flagged for a focused follow-up so we
  don't claim visual testing we didn't do.

### 3.4 Prévisions & Analyses (`ForecastInsightsView.tsx`) — `tab_4_analyses.png`, `advisor_card_after.png`
- **P1 — Advisor duplicated across modes.** `BedrockAdvisorCard` is rendered in
  **both** `viewMode === 'summary'` (line 394) and `viewMode === 'scientific'`
  (line 409). Each instance has its own state and independently calls
  `POST /advisor/ask`. _Why it matters:_ confusing duplication **and duplicate
  paid LLM calls** when the user toggles modes.
- **P1 — English string in a French UI.** The harvest optimiser shows
  "Deterministic weather-only decision aid; not an agronomically validated
  optimiser. machinery availability not provided; all days assumed available
  (provisional)". Backend note leaked untranslated.
- **P1 — Bottom nav overlaps** the AIFS uncertainty card (global P1-3).
- **P2 — Title truncation** ("Prévisions & Analyses Scientifi…").
- **P2 — Same wind alert again** (3rd screen).
- **Good:** "API Gateway en direct" status, sourced rule card, honest harvest
  "Culture non prête à récolter", and the advisor renders a real grounded Nova
  answer with the `C5WRYFYF1O` KB badge (verified live).

### 3.5 Notifications (`NotificationsView.tsx`) — `tab_5_alertes.png`
- **P0 — Overlapping elements at the bottom.** A Duo notification banner, list
  rows ("Il y a 25 min", "Aversion à la perte"), and an "8j" streak badge bleed
  **through/behind the fixed tab bar** (z-index + padding). Visually broken.
- **P1 — Inverted information architecture.** The **push simulator** (4
  "Tester Push" demo presets) and the **"Activer le Push"** card occupy the top
  and middle; the **actual notification list and filter chips** (Toutes / Non
  lues (4) / Risques météo / Rappels) are pushed to the very bottom, below the
  fold and colliding with the nav. The primary content is the hardest to reach.
- **P1 — Clipped streak card.** The "Série de 8 jours / Vigilance active" card's
  warning-triangle icon is cut off by the card's rounded corner.
- **P1 — Overstated push capability (honesty).** "Activer les notifications push
  … même quand l'application est fermée" + "Tester Push". Source
  (`pushNotificationService.ts`) uses only `registration.showNotification` /
  `new Notification` — **local notifications while the app is open**; there is
  **no** `pushManager.subscribe`/VAPID/backend push. True background delivery is
  not implemented. _Why it matters:_ a farmer enabling "push" expects alerts when
  the app is closed; they won't arrive.
- **P2 — Overcrowded:** streak + simulator (4 presets) + permission + filters +
  list + banner on one screen.

---

## 4. Cross-cutting (global) issues

- **P1-3 — Fixed bottom tab bar overlaps scrollable content** on Accueil,
  Analyses and Notifications (insufficient bottom padding on scroll containers
  and/or z-index below floating banners). Reproduced at 375×812 and 390×844.
- **P1-6 — Demo data not labelled.** Parcelle du Moulin, Champ des Vignes, Les
  Terres Rouges are seed/demo fields presented as the user's "3 parcelles".
- **P2 — Pervasive truncation** of titles, field names and subtitles across
  Accueil/Carte/Parcelles/Analyses (labels too long for mobile widths).
- **P2 — Repetition** of the wind alert and the active field across 3 screens.
- **States:** loading/empty/offline states are inconsistent — the advisor card
  has good states; several lists do not show explicit empty/offline states.
- **A11y/motion:** dark theme contrast is mostly good; verify focus rings,
  `aria-modal`/focus-trap on sheets, and `prefers-reduced-motion` (source review
  pending — not asserted here).

---

## 5. User-journey assessment (A–F)

- **A. First visit → create field → advice.** Partially blocked: 3 demo fields
  appear as real, so a first-time user may not create their own; the misleading
  briefing is the first thing read. Create flow not visually tested.
- **B. Returning farmer, 10-second risk read.** Partial: hero field + 1 alert
  are visible quickly, but the static briefing competes and repeats.
- **C. Rain anticipation → map → uncertainty → harvest window.** Works: radar
  (observed, labelled) + AIFS uncertainty + harvest card exist; friction = the
  tall sheet/timeline overlap on desktop and reaching the harvest card past the
  repeated alert.
- **D. Agronomic question → advisor → citations → limitations.** Works live
  (verified): advisor returns a grounded Nova answer with Terres Inovia
  citations, uncertainty and limitations. Friction = the card lives twice and
  sits far down the Analyses screen.
- **E. Alert → understand cause → act.** Weakened: the notification list is
  buried beneath the simulator/push card and overlaps the nav; the cause (wind
  threshold + Arrêté) is clear once reached.
- **F. Mobile install & re-open.** PWA manifest + service worker serve 200;
  install banner exists. Re-open navigation hampered only by the bottom overlap.

---

## 6. Proposed information architecture (Notifications — the main offender)

Re-order top → bottom:
1. **Header** (title, unread count, mark-all-read, filter icon).
2. **Filter chips** (Toutes / Non lues / Risques météo / Rappels) — directly
   under the header.
3. **Notification list** (the primary content) — immediately visible.
4. **Streak** — compact single row (not a clipped hero card).
5. **Push permission** — one honest row, labelled "notifications locales
   (application ouverte)" until real Web Push exists.
6. **Simulator** — collapsed by default under a "Démonstration" disclosure.
7. Reserve `pb-[calc(env(safe-area-inset-bottom)+96px)]` so nothing underlaps
   the tab bar.

---

## 7. Top-10 prioritised problems

| # | Sev | Problem | File(s) |
|---|---|---|---|
| 1 | P0 | Notifications: overlapping banner/list/badge behind the tab bar | `NotificationsView.tsx`, `DuoNotificationBanner.tsx`, `AppleTabBar.tsx` |
| 2 | P1 | Advisor card duplicated in both Analyses modes → duplicate `/advisor/ask` calls | `ForecastInsightsView.tsx` (394, 409) |
| 3 | P1 | Push UI implies background delivery; only local notifications implemented | `pushNotificationService.ts`, `NotificationsView.tsx` |
| 4 | P1 | Bottom tab bar overlaps content (Accueil, Analyses, Notifications) | scroll containers + `AppleTabBar.tsx` |
| 5 | P1 | Notifications IA inverted (simulator/push above the real list) | `NotificationsView.tsx` |
| 6 | P1 | Static briefing, time-inconsistent + "hygrométrie favorable" at 90% | `HomeView.tsx` |
| 7 | P1 | Demo fields presented as the user's real farm | `HomeView.tsx`, `MyFieldsView.tsx`, seed data |
| 8 | P1 | Untranslated English limitation string in French UI | `ForecastInsightsView.tsx` / backend note |
| 9 | P2 | Same wind alert repeated across 3 screens | Home/Carte/Analyses |
| 10 | P2 | Pervasive text truncation of titles/field names | multiple |

---

## 8. Recommended corrections + acceptance criteria

**#1 Notifications overlap (P0).** Add bottom safe-area padding to the scroll
container; raise the tab bar z-index above content and lower the Duo banner;
ensure the banner is a toast that does not overlap the nav.
_Acceptance:_ at 375×812 and 390×844, no element overlaps the tab bar on any
scroll position; streak icon fully visible; Lighthouse/visual check clean.

**#2 Advisor duplication (P1).** Render `BedrockAdvisorCard` **once**, outside
the `viewMode` branches (e.g., always at the bottom of Analyses), or lift its
state so a single instance/query is shared.
_Acceptance:_ switching Synthèse↔Explications fires **0 extra** `/advisor/ask`
requests (verify in network panel); card appears exactly once.

**#3 Push honesty (P1).** Relabel to "Notifications locales (quand l'app est
ouverte)"; remove "même quand l'application est fermée" until real Web Push
(VAPID + `pushManager.subscribe` + backend) exists; keep the simulator clearly
"Démonstration".
_Acceptance:_ no UI text claims background/closed-app delivery unless a real push
subscription is implemented and tested.

**#4 Bottom overlap (P1, global).** Standard page wrapper with
`padding-bottom: calc(env(safe-area-inset-bottom) + 88px)`.
_Acceptance:_ last item of every scroll view is fully readable above the tab bar
on all five viewports.

**#5 Notifications IA (P1).** Re-order per §6; collapse the simulator.
_Acceptance:_ the notification list is visible without scrolling on 390×844;
filters sit directly under the header.

**#6 Briefing (P1).** Make the briefing derive from the real current
forecast/time, or clearly label it and fix the hygrometry logic (90% ≠
favourable).
_Acceptance:_ briefing text matches the live time-of-day and the displayed
humidity/wind; no contradiction with the agro rules.

**#7 Demo labelling (P1).** Badge seed fields "Exemple / Démo" and offer "créer
ma première parcelle".
_Acceptance:_ every demo field shows a visible "Démo" badge; first-run copy
invites real field creation.

**#8 Translate limitation (P1).** Localise the harvest limitation to French.
_Acceptance:_ no English strings in the French UI (grep the bundle).

**#9 De-duplicate alert (P2).** Show the wind alert once (Analyses as source of
truth); Accueil/Carte link to it rather than restating full text.
_Acceptance:_ the full alert body appears on one screen; others show a compact
reference.

**#10 Truncation (P2).** Allow 2-line titles or shorter labels; show full field
name on the hero.
_Acceptance:_ primary field name and screen titles are fully legible at 375 px.

---

## 9. Priority roadmap

- **Essential (pre-demo, P0/P1):** #1 overlap fix, #2 advisor single-instance,
  #3 push honesty, #5 Notifications re-order, #6 briefing, #7 demo labels,
  #8 translation. These are small, targeted edits — no redesign.
- **Polish (P2):** #4 global padding token, #9 alert de-duplication, #10
  truncation, desktop sheet/timeline layout, explicit empty/offline states,
  a11y/motion verification.

Preserve the current iOS-inspired visual language, the Légume'Ami name and logo,
the 5-destination navigation, Leaflet map, charts, field management and PWA
controls throughout.

---

## 10. Evidence

Real browser screenshots (system Chrome via Playwright) in
`reports/ux-audit/screenshots/`:
`landing_{iphone_375x812,iphone_390x844,ipad_768x1024,laptop_1366x768,desktop_1920x1080}.png`,
`tab_1_accueil.png`, `tab_2_carte.png`, `tab_3_parcelles.png`,
`tab_4_analyses.png`, `tab_5_alertes.png`, `advisor_card_after.png` (live
`/advisor/ask` rendered). Capture script: `reports/ux-audit/capture_screenshots.py`.
