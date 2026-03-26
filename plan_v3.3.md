# Plan v3.3: Sight Picture

## Goal

Add a "sight picture" diagram showing what the shooter sees along the cue ball's line of aim at the moment of contact: two overlapping circles (CB and OB) plus two comparison rectangles (execution error width vs. target window width). This gives visual intuition for how much margin a shot has.

## Placement

The sight picture lives in the upper-left corner of the SVG, below the existing Make Probability box. It is an SVG group (`<g>`) overlaid on the table, with a semi-transparent dark background matching the legend and make-% boxes.

## What It Shows

### 1. Ball overlap diagram

Two circles representing the CB and OB as seen from behind the cue ball along the aim line. The OB appears at a lateral offset determined by the cut angle:

- **Center-to-center offset** = `2R × sin(φ)` (in ball-radius units).
- At φ = 0° (straight shot), the circles overlap completely.
- At φ = 90°, the circles barely touch at one edge.

The CB is drawn in white (matching the table), the OB in red (to distinguish from the yellow object ball on the table, per requirements). The overlap region — the "contact patch" visible to the shooter — is the key visual cue.

### 2. Comparison rectangles

Two thin horizontal rectangles, vertically centered on the ball diagram, stacked so the target window is on top and the error cone is below:

```
    <--->          ← target window (yellow, #ffe066)
<---------->       ← execution error (blue, rgba(60,130,255))
```

- **Execution error rectangle**: width = arc length of ±Δφ at the CB-to-OB distance, i.e., `2 × Δφ × d`, converted to the sight-picture's scale. This represents how much the cue ball's contact point wanders on the OB surface due to aiming error. Color: blue, matching the CB error cone on the table.

- **Target window rectangle**: width = effective pocket target size as seen from the shooter's perspective. Because the shooter views the OB-to-pocket line at the cut angle φ, the apparent target width foreshortens: `apparent = targetSize × cos(φ)`. Color: yellow (#ffe066), matching the pocket window line on the table.

Both rectangles are drawn at the same scale (inches of lateral displacement at OB contact distance), so their relative widths directly show whether the shot is makeable: if the yellow rectangle is wider than the blue one, there's margin to spare.

### 3. Scale

The two ball circles are drawn at a fixed pixel radius (`SIGHT_BALL_R = 24` px) — they never change size. Only the lateral offset between them changes (with φ), and only the rectangle widths change (with Δφ, d, and target size).

All widths share a common unit: **lateral displacement at the OB surface** (inches), converted to pixels by `SIGHT_BALL_R / BALL_RADIUS` (≈ 21.3 px/inch):
- Ball diameter: `2R = 2.25"` → `48 px` (fixed)
- Execution error: `2 × Δφ × d` inches
- Apparent target window: `targetSize × cos(φ)` inches

## Color Change

The object ball on the table is currently yellow (`#ffe066`). Per requirements, it needs to change to red so that yellow is reserved for the pocket window. A good choice:
- OB fill: `#e05040` (a muted red)
- OB stroke: `#a03020`

This affects `objBallEl` in pool.js and the legend entry for the pocket window (which is already yellow, so no change there). The legend doesn't have an OB entry. The OB direction error cone is already red (`rgba(255,60,60,...)`), which is fine — it matches the new OB color thematically.

## Files to Change

- **pool.js**: Add sight picture SVG group creation, update it in `updateSlider()` and `redraw()`. Change OB color from yellow to red.
- **pool.css**: No changes expected (the sight picture is pure SVG).
- **index.html**: No changes expected.

## Implementation Details

### SVG group creation (after the Make % group, ~line 787)

Create a `<g>` for the sight picture containing:
1. A background rect (same style as legend/make boxes: `rgba(0,0,0,0.55)`, rounded corners)
2. Two `<circle>` elements for CB and OB silhouettes (simple opacity blending for overlap)
3. Two `<rect>` elements for the comparison bars (light fill + heavier border stroke)
4. An info icon (`ⓘ`) with popup — no text label

Position: below the make-% box. `SIGHT_X = MAKE_X`, `SIGHT_Y = MAKE_Y + MAKE_H + 6`.

Sizing: The box width should accommodate two ball diameters side by side at maximum offset (φ = 90°). With `SIGHT_BALL_R = 24` px, max width = `4 × 24 + padding = 120` px. Make it ~130 px wide and ~70 px tall (two ball diameters + rectangles + padding).

### Rendering the overlap

Simple opacity blending — no clipPath needed:
- Draw OB circle: filled red, ~0.5 opacity
- Draw CB circle: filled white, ~0.5 opacity
- The overlap shows as a natural pinkish-white blend

### Rectangle styling and clipping

Rectangles have a lighter semi-transparent fill and a heavier opaque border (stroke). Both are clipped to the sight picture box bounds. When a rectangle is wider than the box, the missing left/right border edges serve as a natural visual indicator that the true width extends beyond the visible area.

### Updating in `updateSlider()`

After computing `phi`, `d`, `deltaPhiRad`, and `targetSize`:

```js
// Sight picture
const sightScale = SIGHT_BALL_R / BALL_RADIUS; // px per inch
const obOffsetPx = 2 * BALL_RADIUS * Math.sin(phi) * sightScale;
// Position OB circle offset from CB
sightOB.setAttribute('cx', sightCenterX + obOffsetPx);

// Error rectangle: width in inches = 2 × Δφ × d
const errWidthIn = 2 * deltaPhiRad * d;
const errWidthPx = errWidthIn * sightScale;
sightErrRect.setAttribute('width', errWidthPx);
sightErrRect.setAttribute('x', sightCenterX - errWidthPx / 2);

// Target rectangle: apparent width = targetSize × cos(φ)
const tgtWidthIn = targetSize * Math.cos(phi);
const tgtWidthPx = tgtWidthIn * sightScale;
sightTgtRect.setAttribute('width', tgtWidthPx);
sightTgtRect.setAttribute('x', sightCenterX - tgtWidthPx / 2);
```

### Degenerate case (`φ ≥ 90°`)

Hide or grey out the sight picture — the shot isn't makeable, so there's no meaningful sight picture. Or show the balls at maximum separation with no rectangles.

## Object Ball Color Change

Change from yellow to red in these places:
1. `objBallEl.setAttribute('fill', '#e05040')` and stroke `'#a03020'`
2. Legend: the OB direction error entry is already red. No OB entry in legend.
3. The pocket window legend entry stays yellow — no conflict now.

## What Is NOT Changing

- All math functions and physics models
- The pocket geometry, throw calculations, error cone rendering
- The controls layout
- Tests (pure rendering addition)
- index.html structure

## Decisions

1. **Overlap rendering**: Simple opacity blending (no clipPath).
2. **Rectangle height**: Start at 6 px — adjust after visual testing.
3. **Label**: No text label. An info icon (ⓘ) in the upper-right corner of the box with this popup text:

   > "Sight picture: the view along the aim line at the moment of contact. The white circle is the cue ball; the red circle is the object ball. The blue bar shows the width of your execution error (±Δφ) at the object ball. The yellow bar shows the apparent width of the pocket window from this angle. When the yellow bar is wider than the blue bar, you have margin to spare."

4. **Overflow**: Rectangles are clipped to the box. They have a light fill and heavier border; when clipped, the missing side borders signal that the true width extends beyond the box.

## Verification

1. `npm start`, open http://localhost:8080
2. Confirm the sight picture box appears below the make-% readout in the upper left
3. Drag OB to create various cut angles:
   - Straight shot (φ ≈ 0°): circles nearly overlap, target rect ≈ full width
   - Medium cut (φ ≈ 30°): partial overlap, target rect foreshortened
   - Thin cut (φ ≈ 60°+): minimal overlap, very narrow target rect
4. Adjust execution error slider: blue error rect grows/shrinks
5. Verify colors: CB white, OB red (in sight picture AND on table), error rect blue, target rect yellow
6. Check degenerate case (φ ≥ 90°): sight picture handled gracefully
7. Mobile: verify the sight picture doesn't overflow or cause layout issues
