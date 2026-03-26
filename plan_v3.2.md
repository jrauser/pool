# Plan: V3.2 Visual Redesign

## Goal

Rearrange the app into a compact single-column layout optimized for both desktop and mobile.  Remove the title.  Overlay the legend on the pool table.

## Current layout

Two-column flex row (`#layout`):
- Left: `#table-container` (SVG)
- Right: `#controls` (stacked vertically: make%, pocket toggle, error slider, speed toggle, CIT checkbox, CIT slider, shot-info table, degenerate msg, legend, info-popup)

## Target layout

Single column, top to bottom:

1. **Make % banner** — large `###.#%` with label, full-width strip
2. **Pool table SVG** — full available width; color legend overlaid in the lower-left corner of the SVG itself (drawn in JS, not in the HTML sidebar)
3. **Controls** — two-column CSS grid:
   | Left | Right |
   |------|-------|
   | Target pocket toggle | Shot speed toggle |
   | Execution error slider | "Correct for throw" checkbox |
   | *(empty)* | Throw correction slider (always visible; disabled/greyed when CIT off) |
4. **Outputs** — two-column CSS grid of the five shot-info metrics (cut angle, distance, pocket tolerance, target size, throw); degenerate-msg spans full width below
5. **Footer** credits (unchanged)

The `#info-popup` (floating tooltip) stays positioned relative to the nearest positioned ancestor; it will follow the new layout naturally.

## Key changes

### index.html
- Remove `<h1>` title.
- Flatten `#layout` into a simple single column `div` (remove the flex-row wrapper or repurpose it).
- Move `#make-display` above the table container.
- Move `#legend` out of `#controls` — it will be rendered inside the SVG by `pool.js`.
- Reorganize remaining controls into a 2×N grid (`#controls-grid`).
- Reorganize `#shot-info` rows into a 2-column grid (`#outputs-grid`).
- Keep `#degenerate-msg` below outputs, full width.

### pool.css
- Remove the flex-row `#layout` rule; replace with single-column flow.
- Add `#controls-grid`: `display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px;`
- Add `#outputs-grid`: `display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px;`
- Make `#table-svg` responsive: `width: 100%; height: auto; max-width: 100%;`  (JS already sizes it; we'll need to handle resize — see below).
- On mobile (`max-width: 600px`): `#controls-grid` and `#outputs-grid` collapse to single column.
- Remove / repurpose the old `#controls` max-width constraint (was 320px) since controls now sit below the table, not beside it.
- Style `#make-display` as a full-width banner (no card border needed, or keep it subtle).
- Add a disabled/greyed style for the CIT slider group (reduced opacity, `pointer-events: none`) applied via a `.disabled` class toggled in JS.

### pool.js
- **Legend**: Draw the legend as SVG `<g>` elements in the lower-left of the table SVG instead of HTML. Use a semi-transparent background rect so it reads clearly regardless of what's behind it. Implement a `drawLegend(svg, ...)` helper called from the main render path.
- **Responsive SVG sizing**: Use a `ResizeObserver` on `#table-container` to redraw the table at the correct pixel size when the container width changes. The table has a fixed aspect ratio so the SVG height is derived from its width. This keeps the approach consistent with existing code (explicit pixel coordinates) rather than switching to a `viewBox` approach.
- **CIT slider state**: Replace `display:none` show/hide logic with enabled/disabled toggling. When "Correct for throw" is unchecked, the slider and its label are visible but `disabled` and styled with reduced opacity.
- No logic changes — all physics/math remains untouched.

## Files touched
- `index.html` — structural HTML changes
- `pool.css` — layout rules
- `pool.js` — legend rendering moved to SVG; ResizeObserver for responsive sizing

## Out of scope
- No changes to `pocket_geometry.js`, `throw.js`, or any test files.
- No changes to physics, math, or interaction logic.
