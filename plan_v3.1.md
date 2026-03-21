# Plan v3.1: Side Pocket + All Pockets + Diamonds

## Goal

Add a side pocket to the table, implement the side pocket target size model
(TP 3.5), allow the user to toggle which pocket to aim at, render all six
pockets, and add diamond markers.

## Scope

This version adds:

1. **Side pocket target size calculator** — a new
   `createSidePocketCalculator` in `pocket_geometry.js` using the spec in
   `reference/side_pocket_target_size_spec.md`.
2. **Side pocket geometry constants** — position, mouth width, facing angles
   for the top-center side pocket.
3. **Pocket selection toggle** — switch between corner and side pocket.
4. **All six pockets rendered** — via rotation/reflection of the corner
   and side pocket geometry.
5. **Diamond markers** — three diamonds between each pair of pockets.

This version does **not** include:

- Automatic pocket selection (user chooses explicitly).
- Changes to the throw or probability models (they are pocket-agnostic).

## Difficulty Assessment

**Moderate.** The side pocket target size math reuses the shared equations
already in `pocket_geometry.js` (auxiliaryA, polyBeta, polyBetaIn, solveBetaL,
sLeftPointWall, rWall, sLeftWall) with different default parameters. The
harder parts are:

- The side pocket has a different approach angle convention (0° =
  perpendicular to rail, not along a 45° bisector).
- Rendering all six pockets requires a coordinate transform system.
- The `pocketTolerance` and `approachAngle` functions in `pool.js` are
  currently hardcoded for the upper-right corner pocket.

## Implementation Plan

### Step 1: Side pocket calculator in `pocket_geometry.js`

The side pocket model from TP 3.5 is simpler than the corner model — no
rail deflection, no multi-wall rattles. The shared equations (§3.1–3.6)
are already implemented and parameterized. We need:

**New defaults:**

```js
export const SIDE_POCKET_DEFAULTS = {
  R: 1.125,           // ball radius
  p: 5.0,             // pocket mouth width (our table, BCA 4⅞"–5⅝")
  alpha: 14 * DEG,    // wall angle
  Rhole: 3.0,         // pocket hole radius
  b: 0.1875,          // shelf depth to hole center
};
```

**New critical angles** (from TP 3.5 §4):

- `θ_max`: solve `polyBeta(params, 90°, θ) = 0`. Approx 68° for defaults.
- `θ_critical`: solve for where `polyBetaIn` root = `β_l + α − 90°`.
  Approx −50° for defaults.
- `θ_min = −θ_max`.

**New factory:**

```js
export function createSidePocketCalculator(params = SIDE_POCKET_DEFAULTS)
```

Returns `θ → { s, offset, sLeft, sRight }` using the piecewise assembly
from TP 3.5 §5:

```
s_left(θ) =
    0                       if θ ≥ θ_max or θ ≤ θ_min
    s_left_wall(θ)          if θ_min < θ < θ_critical
    s_left_point(θ)         otherwise

s_right(θ) = s_left(−θ)
```

The existing `sLeftPointWall` (which is `sLeftPoint` for the side pocket)
and `sLeftWall` functions work directly — they just need the side pocket
parameters.

### Step 2: Tests for side pocket calculator

New test file `side_pocket_geometry.test.js` (or extend `pocket_geometry.test.js`):

- `s(0°)` ≈ 3.35" (perpendicular approach, most forgiving).
- `s(±θ_max)` = 0 (unreachable beyond max angle).
- Symmetry: `s(θ) = s(−θ)`.
- Antisymmetric offset: `offset(θ) = −offset(−θ)`.
- Continuity at `θ_critical` (piecewise transition).
- Non-negative output for all valid angles.
- `θ_max` ≈ 68° for default parameters.

### Step 3: Side pocket constants in `pool.js`

The side pocket sits at the midpoint of the top rail.

```js
export const SIDE_POCKET_MOUTH_WIDTH = 5.0;  // inches
export const SIDE_POCKET_FACING_ANGLE = 103 * Math.PI / 180;  // BCA spec

// Position: center of top rail
export const SIDE_POCKET_POS = [TABLE_WIDTH / 2, TABLE_HEIGHT];

// Rail ends: half the mouth width in each direction along the top rail
const SIDE_POCKET_HALF_MOUTH = SIDE_POCKET_MOUTH_WIDTH / 2;
export const SIDE_POCKET_RAIL_END_LEFT  = [TABLE_WIDTH / 2 - SIDE_POCKET_HALF_MOUTH, TABLE_HEIGHT];
export const SIDE_POCKET_RAIL_END_RIGHT = [TABLE_WIDTH / 2 + SIDE_POCKET_HALF_MOUTH, TABLE_HEIGHT];
```

The approach angle for a side pocket is measured from the perpendicular to
the rail (straight down into the pocket = 0°). This differs from the corner
pocket convention (measured from the 45° bisector).

```js
export function approachAngleSide(objPos, pocketPos) {
  const dx = pocketPos[0] - objPos[0];
  const dy = pocketPos[1] - objPos[1];
  // Direction from OB to pocket; perpendicular to top rail is straight up = π/2
  const angle = Math.atan2(dy, dx);
  return angle - Math.PI / 2;
}
```

### Step 4: Generalize `pocketTolerance` and `approachAngle`

Currently `pocketTolerance` always uses `cornerCalc` and `approachAngle`
assumes the 45° corner bisector. Generalize to accept a pocket type:

```js
const sideCalc = createSidePocketCalculator({ R: BALL_RADIUS, p: SIDE_POCKET_MOUTH_WIDTH });

export function pocketTolerance(objPos, pocketPos, pocketType = 'corner') {
  const dop = Math.hypot(pocketPos[0] - objPos[0], pocketPos[1] - objPos[1]);
  const theta = pocketType === 'corner'
    ? approachAngle(objPos, pocketPos)
    : approachAngleSide(objPos, pocketPos);
  const calc = pocketType === 'corner' ? cornerCalc : sideCalc;
  const { s, offset } = calc(theta);
  const alpha = Math.atan((s / 2) / dop);
  return { alpha, targetSize: s, offset };
}
```

### Step 5: Pocket selection toggle (UI)

Add a toggle group in the control panel, above the execution error slider:

```html
<div class="control-group">
  <label>Target pocket</label>
  <div class="toggle-group" id="pocket-toggle">
    <button data-pocket="corner" class="active">Corner</button>
    <button data-pocket="side">Side</button>
  </div>
</div>
```

The toggle sets a `selectedPocket` state variable (`'corner'` or `'side'`).
When switched, `redraw()` uses the corresponding pocket position, approach
angle function, and target size calculator.

The state variable `pocket` (currently `[...POCKET_POS]`) updates to the
selected pocket's position on toggle change.

### Step 6: Update `redraw` and `updateGeometry` for pocket selection

The `redraw` function currently hardcodes `pocket` as the upper-right
corner. Changes:

- `pocket` reference updates when the toggle changes.
- `pocketTolerance` receives the pocket type.
- `updateGeometry` needs the target line perpendicular direction, which
  differs per pocket type:
  - Corner: perpendicular to the 45° bisector (currently hardcoded as
    `[-1/√2, 1/√2]`).
  - Side: perpendicular to the rail normal, i.e., along the rail
    (`[1, 0]` for the top-center side pocket).
- The SVG pocket reference point (`pocketSvgX`, `pocketSvgY`) must update
  to track the selected pocket.

### Step 7: Render side pocket

Render the side pocket on the top rail:

- A dark rectangle (pocket opening) spanning the mouth width.
- Two facing lines at the BCA 103° angle from the rail.
- The dynamic target line (yellow), as with the corner pocket.

The side pocket shape is simpler than the corner: it's a notch in the
rail rather than a triangle at the corner. Render as a dark rectangle
from the left rail end to the right rail end, extending slightly into
the rail area.

**--- PAUSE HERE for testing. ---**
Steps 1–7 deliver the core side pocket math and a working toggle.
Verify the side pocket target size, approach angle, and visualization
before proceeding to cosmetic rendering.

### Step 8: Render all six pockets

Render all six pockets using rotation/reflection transforms. Define
a pocket as a template shape (set of points in a canonical orientation)
and a transform (rotation angle + translation) to place it on the table.

**Corner pocket template:** The upper-right pocket geometry (triangle +
facings) defined relative to the table corner `(100, 50)`. The other
three corners are produced by reflecting across the table center:

| Pocket | Transform |
|--------|-----------|
| Upper-right | identity |
| Upper-left | reflect x across center (x → 100 − x) |
| Lower-right | reflect y across center (y → 50 − y) |
| Lower-left | reflect both x and y |

**Side pocket template:** The top-center pocket geometry defined
relative to `(50, 50)`. The bottom-center pocket is produced by
reflecting y across center (y → 50 − y).

Implement as a `transformPoint(pt, reflectX, reflectY)` helper that
maps table coordinates through the reflection, then through `tableToSVG`.
Each pocket is a list of SVG elements (polygon + lines) generated from
the template points run through the transform.

The non-active pockets are rendered as static decoration. Only the
selected pocket gets the dynamic target line and participates in the
shot geometry.

### Step 9: Diamond markers

Diamonds are placed 1/4, 1/2, and 3/4 of the distance between adjacent
pockets, on the rail. A standard table has 18 diamonds total (3 per segment,
6 rail segments).

**Rail segments** (for a 100" × 50" table):
- Top rail: upper-left corner pocket → top side pocket → upper-right corner pocket
- Bottom rail: lower-left → bottom side → lower-right
- Left rail: lower-left → upper-left
- Right rail: lower-right → upper-right

Each segment gets 3 diamonds. Diamonds sit on the rail edge (the cushion
nose line), which is at the SVG border boundary.

Render each diamond as a small filled circle or diamond shape on the rail.
A simple circle (r ≈ 3px) in a subtle color (e.g., mother-of-pearl white)
is clean and standard.

The spacing is between pocket mouths (not between table corners), so the
diamond positions account for the pocket opening widths.

### Step 10: Update existing tests

- `pocketTolerance` signature changed — update existing tests to pass
  `'corner'` or verify the default works.
- `approachAngle` is unchanged (still corner-only). New
  `approachAngleSide` tests are in step 2.
- Verify that the corner pocket behavior is completely unchanged when
  `selectedPocket === 'corner'`.

## Rendering Notes

### Target line perpendicular direction

The target line must be drawn perpendicular to the approach direction,
centered on the pocket mouth (adjusted by offset). For each pocket type:

| Pocket | Approach dir | Target line perp |
|--------|-------------|------------------|
| Corner (UR) | 45° (toward UL-to-LR diagonal) | `[-1/√2, 1/√2]` |
| Side (top) | 90° (straight down/up) | `[1, 0]` (along rail) |

These are currently hardcoded in `updateGeometry`. With the pocket toggle,
pass the perpendicular direction as a parameter.

### Side pocket SVG shape

The side pocket is a rectangular notch in the top rail. Render as:
1. A dark rectangle from `SIDE_POCKET_RAIL_END_LEFT` to
   `SIDE_POCKET_RAIL_END_RIGHT`, extending from the felt edge into the
   rail by ~1 pocket depth.
2. Facing lines from each rail end, angled at 103° from the rail
   (i.e., 13° from perpendicular).

## What Changes for the User

- A "Target pocket" toggle appears at the top of the control panel
  (corner / side).
- The top-center side pocket renders with proper geometry.
- All six pockets appear as dark shapes with facings — the table
  looks like a real pool table.
- 18 diamond markers appear on the rails.
- Selecting "Side" re-aims the shot at the side pocket, with the
  correct target size model, approach angle, and pocket tolerance.
- All existing corner pocket behavior is unchanged.
- The make probability, throw, and error cone visualizations all work
  for side pocket shots identically to corner pocket shots.

## Not in Scope

- Automatic nearest-pocket selection.
- Clicking a pocket to select it (toggle only for now).
- Side pocket throw differences (the throw model is angle/speed-based
  and pocket-agnostic).
- Multiple object balls.
