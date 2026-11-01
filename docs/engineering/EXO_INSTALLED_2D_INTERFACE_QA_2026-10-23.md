# Installed 2D professional interface QA — 2026-10-23

Independent new test: `scripts/qa-exo-installed-2d-professional-interaction-20261023.mjs`.

Endpoint observed live: `http://127.0.0.1:5386/?desktop=1&engine=clothcraft`. Uses Playwright Core with installed Chrome; no source build, app edit, or shared-test modification.

## Results

**1280 × 1000: FAIL.** Pattern Studio's correctly nested `.cc-pattern-studio-glass-arrow` exists, is visible, and has a measurable hitbox, but its pointer-hover action times out because the `select-2d` icon under `.cc-corner-tool-host` intercepts events over the arrow. This is an installed-app overlap defect; the run stopped at the first blocked interaction. Subsequent narrow-width tool/panel checks are therefore **not verified**.

**1720 × 1000: PASS.** The arrow is a direct child of `.cc-v2-board-orientation`, receives real hover, reports pointer cursor, enters Pattern Studio, and returns to main studio. Six left-rail tools each expose their expected accessible button name, are visible/enabled, have measured 29 × 29 CSS-pixel hitboxes and accept real Playwright clicks. Graded-size toggle reports `aria-pressed=true`. Right tool palette and Object Browser remain visible. Four collapse/expand controls restore their respective panels. No page runtime errors were reported.

The arrow's sampled computed `background-color` at 1720 px was transparent, which does not by itself prove visual liquid-glass rendering or absence of glass effects on pseudo-elements/parents. This test checks DOM ancestry and actual hover/click interactions, not pixel-perfect material rendering. Test clicks demonstrate input delivery and the specifically asserted state changes; they do not prove each CAD drawing operation commits valid editable geometry.

## Reproduce

```sh
node scripts/qa-exo-installed-2d-professional-interaction-20261023.mjs
EXO_UI_WIDTHS=1720 node scripts/qa-exo-installed-2d-professional-interaction-20261023.mjs
```

The default covers both 1280 and 1720 px and currently fails due to the 1280 px overlap. `EXO_UI_WIDTHS` accepts 1–5 comma-separated widths from 980 to 3840 px. The script reads `EXO_INSTALLED_URL` and `EXO_CHROME` for environment overrides. Do not force-click the overlapping arrow to mask the defect. Repair requires proper layout/stacking or pointer targeting in a separately authorized implementation lane, followed by replay at narrow, intermediate and wide viewport widths.

Manufacturing certification, vendor DXF compatibility and factory pattern approval are outside this UI interaction test and remain subject to existing gates.
