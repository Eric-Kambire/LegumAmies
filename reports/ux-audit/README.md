# reports/ux-audit/

Evidence for the Légume'Ami UX/UI diagnostic (see `docs/UX_UI_AUDIT.md`).

- `screenshots/` — real browser screenshots captured with Playwright driving the
  system Google Chrome against the deployed app
  (https://team-testing.doxhuwpoc3ctn.amplifyapp.com), 2026-10-31:
  - `landing_*` — 5 required viewports (375×812, 390×844, 768×1024, 1366×768, 1920×1080)
  - `tab_1_accueil`, `tab_2_carte`, `tab_3_parcelles`, `tab_4_analyses`, `tab_5_alertes`
  - `advisor_card_after` — the live `POST /advisor/ask` response rendered in the UI
- `capture_screenshots.py` — reproducible capture script (`channel="chrome"`, no browser download).

These are screenshots of the real rendered application, not mockups.
