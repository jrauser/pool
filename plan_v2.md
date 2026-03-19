# Plan: Pool Shot Margin Visualizer — v2 (Draggable Balls)

## Goal

Allow the user to reposition the cue ball and object ball by dragging them on the SVG table.
All geometry (ghost ball, aim line, travel line, error cones, stats) must update live as balls move.

---

## Scope

This is a pure front-end change to `pool.js`. The math in `pool.js` (everything above the
`initApp` function) is already correct and position-agnostic. We are only changing the browser
rendering layer.

No new files are needed. No new npm dependencies.

---

## Key Design Decisions

### Coordinate transform round-trip

`tableToSVG(x, y)` already exists. We need its inverse `svgToTable(svgX, svgY)` to convert
mouse event coordinates back to table inches during a drag. This is a trivial arithmetic
inversion and should be exported and unit-tested alongside the existing transform.

### Refactoring `initApp`

Currently `initApp` mixes one-time setup (creating SVG elements) with position-dependent
rendering (setting `cx`/`cy`, aim line endpoints, ghost ball). Position-dependent rendering
must move into a dedicated `updateGeometry()` function that runs on every drag tick and
on initial load.

The existing `update()` function (slider-driven) only recomputes the cones and stats. After
refactoring it will call `updateGeometry()` too, so a full redraw always happens from one place.

**Call hierarchy after refactor:**
```
redraw()
  └── updateGeometry()   // recomputes ghost ball, aims lines, ball positions
  └── updateSlider()     // recomputes cones + stats readouts (reads slider value)
```

Any drag event and the slider `input` event both call `redraw()`.

### Drag state machine

A simple three-event model on the SVG element:

1. `mousedown` on a ball circle → record which ball is being dragged, set `dragging` flag
2. `mousemove` on SVG → if dragging, compute new table position from mouse coords, apply
   constraints, update state, call `redraw()`
3. `mouseup` / `mouseleave` on SVG → clear `dragging` flag

Using `mousemove`/`mouseup` on the **SVG element** (not the circle) avoids losing the drag
when the mouse moves faster than the render loop.

Touch events (`touchstart`/`touchmove`/`touchend`) are out of scope for v2 but should not
be actively broken.

### Constraints

Two constraints are enforced during drag, in this order:

1. **Table boundary**: clamp the ball center so it stays at least `BALL_RADIUS` inches from
   each edge of the playing surface.
2. **No overlap**: cue ball and object ball centers must be at least `2 * BALL_RADIUS` apart.
   If a drag would cause overlap, push the dragged ball to the nearest valid position on the
   circle of radius `2R` centered on the stationary ball.

The pocket position is fixed; no constraint is needed there.

### Cursor feedback

Set `cursor: grab` on both ball circles via SVG `style` or a CSS class. Set `cursor: grabbing`
on the SVG during an active drag (add/remove a CSS class). This is a CSS-only change and
requires a small addition to `pool.css`.

---

## File Changes

### `pool.js`

1. **Export `svgToTable(svgX, svgY)`** — inverse of `tableToSVG`. Pure function, easy to test.
2. **Refactor `initApp`**:
   - Extract `updateGeometry(cuePos, objPos)` — repositions all static SVG elements that
     depend on ball positions (ball circles, ghost ball, aim line, travel line).
   - Extract `updateSlider()` — existing `update()` logic for cones and readouts.
   - Add `redraw()` that calls both. `redraw()` checks `phi >= π/2` first; if so, it
     hides both cones and shows the degenerate-state message instead of calling `updateSlider()`.
   - Add drag event listeners on the SVG and ball circles.
   - Implement `clampToBounds(pos)` and `resolveOverlap(movingPos, fixedPos)` as internal
     helpers (not exported — pure geometry used only in the drag handler).

### `index.html`

- Add a small `<div id="degenerate-msg">` element in the control panel, hidden by default,
  shown when φ ≥ 90°. No structural changes otherwise.

### `pool.css`

- Add `.draggable` cursor style (`cursor: grab`) applied to both ball circles.
- Add `.dragging` cursor style (`cursor: grabbing`) applied to the SVG during drag.

### `pool.test.js`

- Add tests for `svgToTable`: verify it is the exact inverse of `tableToSVG` at several points.
- Round-trip property: `svgToTable(...tableToSVG(x, y))` returns `[x, y]` for arbitrary `(x, y)`.

---

## What Is NOT Changing

- All math functions (`deltaTheta`, `cutAngle`, `pocketTolerance`, `makeProbability`, `erfApprox`,
  `conePoints`) — zero changes.
- The pocket position — fixed at upper-right corner, not draggable.
- The slider UI and control panel HTML.
- The test coverage target (100% of `pool.js`; drag event handlers remain in the
  `/* v8 ignore */` block as browser-only code).

---

## Resolved Decisions

1. **Snap to default positions?** No reset button. Page refresh is sufficient.

2. **Object ball dragged onto pocket?** No exclusion zone. Let the user place it wherever
   they like; the math degenerates gracefully to a trivially high make probability.

3. **Cue ball position producing φ ≥ 90°?** Do not prevent it. Instead, detect `phi >= π/2`
   in `redraw()` and render a degenerate state: hide both cones, show `—` for make
   probability, and display a short note (e.g. *"Cut angle ≥ 90° — not makeable"*).
   This is simpler to implement than constraining the drag and is more educational —
   the user can see why the position is impossible and drag back to a valid one.
