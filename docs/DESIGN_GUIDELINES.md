# LegumAmies - UI/UX Design Guidelines

Mandatory design standard for the LegumAmies PWA. The **Gemini agent owns the
frontend**; this document is the shared contract so every contributor ships to
the same bar. Backend/data agents must not rewrite frontend components - propose
changes against these rules and the API contract instead.

Target: a premium, production-ready, **iOS-inspired** Progressive Web App that
feels native on iPhone, Android, tablet and desktop.

---

## 1. Principles

1. **Clarity over decoration.** Minimal, elegant, original. No generic
   "AI-style" visuals, no excessive gradients, no decorative motion.
2. **Hierarchy first.** Typography, spacing and alignment carry the design.
3. **Calm, intentional motion.** Animation clarifies state changes; it never
   entertains. If a motion does not help the user understand a transition,
   remove it.
4. **Trust through transparency.** Risk and harvest advice must surface its
   reasoning and sources (see Explainability). Sustainability figures must show
   provenance and that they are *national estimates, not field measurements*.
5. **Graceful degradation.** Every data view has loading, empty, error and
   offline states. Never show a blank screen or a fabricated value.

---

## 2. Design tokens

Define once (CSS variables / a `tokens.ts`) and never hard-code values in
components. Suggested scales (frontend may refine, but keep them tokenised):

**Spacing** (4 pt base): `4, 8, 12, 16, 20, 24, 32, 40, 56`.

**Radii:** `sm 8`, `md 12`, `lg 16`, `xl 22` (cards/sheets), `full 9999`.

**Typography:** system stack
`-apple-system, "SF Pro Text", "SF Pro Display", Inter, system-ui, sans-serif`.
Type scale (px / line-height): `caption 12/16`, `footnote 13/18`,
`subhead 15/20`, `body 17/22`, `title3 20/25`, `title2 22/28`,
`title1 28/34`, `largeTitle 34/41`. Weights 400/500/600/700. Use tabular
numerals for metrics.

**Color:** semantic tokens, resolved per theme -
`bg`, `bg-elevated`, `surface`, `separator`, `label`, `label-secondary`,
`label-tertiary`, `tint` (brand/interactive), plus status `success`,
`warning`, `danger`, `info`. Provide full **light and dark** values. Meet
WCAG AA contrast (>= 4.5:1 text, >= 3:1 large text / UI).

**Elevation:** prefer a hairline `separator` + subtle shadow over heavy
shadows. One elevated surface style for sheets/cards.

**Brand palette:** a restrained agronomy-leaning accent (single `tint`).
Avoid multi-stop gradients; a flat tint or a single soft gradient at most.

---

## 3. Layout, responsiveness, safe areas

- Mobile-first; fluid up to a max content width (~ 720 px) on tablet/desktop,
  centered, with comfortable gutters.
- Honor safe areas: use `env(safe-area-inset-*)` for the header, tab bar and
  bottom sheets. Content never hides under the notch or home indicator.
- Hit targets >= 44x44 pt. Respect dynamic type / user font scaling.
- No horizontal scroll; no layout shift on data load (reserve space).

---

## 4. Navigation & surfaces (native-feeling)

- **Tab bar** for primary sections (e.g. Field / Risk / Harvest / Sustainability).
  Persistent, safe-area aware, with clear selected state.
- **Sheets / modals**: iOS-style bottom sheets with a grabber, rounded top
  corners, backdrop scrim, drag-to-dismiss, and focus trapping.
- **Push navigation** within a tab (list -> detail) with back affordance.
- One navigation metaphor at a time; do not mix a sheet transition with a page
  push for the same action.

---

## 5. Motion (Motion for React - `motion/react`)

Use `motion/react` deliberately and sparingly.

- **Animate only `transform` and `opacity`** for 60 fps. Do not animate
  `width/height/top/left` or box-shadow in hot paths; use `layout` only when
  necessary and test for jank.
- **Timing tokens** (shared): `fast 0.15s`, `base 0.22s`, `slow 0.32s`.
  **Easing**: standard `[0.22, 0.61, 0.36, 1]` (ease-out-ish). Keep timings
  consistent across the app - do not hand-tune per component.
- **`AnimatePresence`** for mount/unmount (sheets, modals, route changes).
  Provide **stable, unique `key`s** (never array index for dynamic lists).
  Always set matching `initial` / `animate` / `exit`.
- **Gestures**: sheet drag uses spring; cap velocity; dismiss threshold ~ 30%
  of height or a downward fling.
- **No animation conflicts.** Map interactions (pan/zoom), page navigation and
  sheet transitions must not run competing animations on the same surface.
  Disable layout animations on the map container.
- **Reduced motion is mandatory.** Respect `prefers-reduced-motion`: replace
  movement with a simple opacity fade (or none) and disable spring/parallax.

```tsx
import { useReducedMotion } from "motion/react";
const reduce = useReducedMotion();
const transition = reduce ? { duration: 0 } : { duration: 0.22, ease: [0.22,0.61,0.36,1] };
```

---

## 6. States (every data-backed view)

- **Loading**: skeletons that match final layout (no spinners for content).
- **Empty**: explain why there is nothing and the next action. HESTIA example:
  "No HESTIA sustainability data published for this crop in France yet."
- **Error**: human message + retry; never a raw stack trace.
- **Offline (PWA)**: show last cached data with a clear "offline / stale"
  badge and the retrieval time; queue nothing silently.

---

## 7. Accessibility

- Semantic roles for tabs, dialogs, buttons; `aria-modal` + focus trap on
  sheets; restore focus on close.
- Visible focus rings (keyboard). Full keyboard operability.
- Color never the sole signal - pair status color with icon/label.
- Announce async results to screen readers (`aria-live` polite for updates).

---

## 8. Explainability in the UI (non-negotiable)

- Every **risk alert** shows: hazard, the threshold and observed value, the
  exposure window, and a link to the **evidence source** with its
  `validation_status` (published / requires_expert_validation / demo).
- Every **harvest recommendation** shows its rank, the `weather_risk_score`,
  the human `explanation`, and the `limitations` label (e.g. "weather-only,
  provisional"). Show the baseline (earliest feasible date) for comparison.
- Every **HESTIA figure** shows unit, release, source citation, licence, and a
  "national estimate, not a field measurement" note.
- No SHAP values yet: SHAP is only introduced if/when a trained ML model is
  added. Until then, explanations are rule/decision traces, not attributions.

---

## 9. Definition of done (UI)

- Tokens used (no magic numbers); light + dark verified; AA contrast checked.
- All four data states implemented; safe areas correct on iOS.
- Motion uses shared timing/easing, `transform`/`opacity` only, reduced-motion
  path verified, stable keys, no competing animations with the map.
- Provenance/explainability visible wherever a prediction or metric appears.
