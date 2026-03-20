# Plan: Pool Shot Margin Visualizer

## Goal

An interactive web page that builds visual intuition for how a pool player's execution error maps to missed shots, as a function of cut angle, ball position, and shot distance.

---

## Open Questions / Clarifications Needed

1. **Formula verification**: The formula for Δθ involves d (shot distance). For Δφ near 2° and d near 50", the argument of arcsin reaches ~0.77, which is within bounds. But for larger d or larger Δφ, it could exceed 1 (arcsin undefined). We should handle this gracefully — it physically means the cue ball misses the object ball entirely.

---

## Tech Stack

- **Language**: Pure JavaScript (ES modules), no frameworks
- **Rendering**: SVG (scales cleanly, easy to manipulate from JS)
- **Tests**: [Vitest](https://vitest.dev/) — lightweight, runs in Node, has built-in coverage via V8
- **Serving**: Open `index.html` directly in browser (no server needed); tests run via `npm test`

Vitest is chosen over raw Node test runner for its coverage reporting and friendlier assertion API, with minimal setup overhead.

---

## File Structure

```
pool/
├── initial_requirements.md      (yours, not touched)
├── plan.md                      (this file)
├── package.json                 (vitest dependency + test/coverage scripts)
├── index.html                   (page layout and UI)
├── pool.js                      (all math and rendering logic, ES module)
└── pool.test.js                 (Vitest unit tests, 100% coverage)
```

No build step. `pool.js` is loaded as an ES module directly in `index.html` and also imported by the test file.

---

## Geometry and Coordinates

**Table**: Standard 9-foot playing surface = 100" × 50".
**SVG canvas**: Drawn to scale, e.g., 800px × 400px (2:1 aspect ratio preserved).
**Coordinate origin**: Lower-left corner of the playing surface.
**Pocket**: Upper-right corner, at (100", 50") in table coordinates.
**Ball radius**: R = 1.125"
**Effective pocket target**: 2.5" (4.5" opening minus 2" per the paper)

### Derived geometry

Given cue ball position C and object ball position O:

- **Object ball travel direction** θ: angle of the vector from O toward the pocket center
- **Shot distance** d: |CO| (center to center, inches)
- **Cut angle** φ: the angle between the required cue-ball direction and the line of centers at impact. The ghost ball (cue ball center at impact) sits at distance 2R from O in the direction opposite θ. φ is the angle at C between CO and the ghost-ball direction; φ = 0 for a straight shot, approaching 90° for a maximum cut.
- **Angular pocket tolerance** α: the half-angle subtended by the effective target from O:
  ```
  α = arctan(1.25 / D_op)
  ```
  where D_op is the distance from the object ball center to the pocket center, and 1.25" is half the 2.5" effective opening.

---

## Core Math

### Formula (from reference/TP_3-4.pdf)

Execution error Δφ in the shooter's aim causes an error Δθ in the object ball's direction:

```
Δθ(d, φ, Δφ) = φ − Δφ + arcsin( (d / 2R) · sin(Δφ) − sin(φ − Δφ) )
```

Where:
- d = distance between ball centers (inches); formula valid when d >> R
- R = 1.125" (ball radius)
- φ = cut angle
- Δφ = execution error (shooter's aim error)
- Δθ = resulting error in object ball direction

**Domain constraint**: the arcsin argument must lie in [−1, 1]. For a given (d, φ), there is a maximum |Δφ| for which the formula is defined. Beyond this, the cue ball physically misses the object ball entirely; this case returns `null` (caller treats it as a miss).

### Make Probability

The slider controls the 95% coverage interval of Δφ, treated as N(0, σ²):
```
σ = slider_value / 1.96
```

The ball is pocketed when |Δθ| ≤ α. Since Δθ is monotonically increasing in Δφ (verified in tests), we find Δφ_max by bisection such that Δθ(d, φ, Δφ_max) = α. Then:

```
P(make) = erf(Δφ_max / (σ · √2))
```

JS does not have `erf` in its standard library; we'll use a well-known rational approximation (Abramowitz & Stegun 7.1.26, max error 1.5×10⁻⁷).

If Δφ_max hits the domain constraint before reaching α, the pocket is always hittable for any valid execution: P = 1.

---

## UI Components

### Pool Table (SVG)
- Green felt rectangle; thin contrasting rail border
- Upper-right pocket: gap in the rail with a highlighted 2.5" effective target segment
- Cue ball and object ball as filled circles (static in v1)
- Faint shot line from cue ball through object ball to pocket
- **Error cone from cue ball**: wedge spanning ±Δφ about the aimed direction toward the ghost ball
- **Error cone from object ball**: wedge spanning ±Δθ (= Δθ evaluated at the slider's Δφ) about the intended object-ball-to-pocket line — this is what visually grows with the slider

### Control Panel (right sidebar)
- **Slider**: Δφ (95% execution error), range 0–2°, linear scale
- **Readout**: current Δφ value in degrees
- **Make %**: large prominent number, updates live
- **Shot info** (smaller): cut angle φ, shot distance d, pocket tolerance α

---

## Test Strategy

All tests in `pool.test.js`, run with `npm test`. Coverage enforced with `npm run coverage` (target: 100% of `pool.js`).

### `deltaTheta(d, phi, deltaPhi)`
- Δφ = 0 → Δθ = 0 for any φ
- φ = 0 (straight shot), small Δφ → Δθ ≈ Δφ (numerical check)
- Monotonically increasing in Δφ for representative (d, φ) pairs
- Domain violation (arcsin argument > 1) → returns `null`

### `makeProbability(d, phi, alpha, sigma)`
- σ → 0 → P ≈ 1 (for a makeable shot)
- σ large → P → 0
- Monotonically decreasing in σ

### `cutAngle(cuePos, objPos, pocketPos)`
- Straight-in shot → φ = 0
- Known configurations (e.g., object ball directly left of pocket → 90° cut)

### `pocketTolerance(objPos, pocketPos)`
- Far from pocket → small α
- Close to pocket → large α
- Values match arctan formula

### `erf(x)` approximation
- erf(0) = 0, erf(large) ≈ 1, erf(-x) = -erf(x)
- Accuracy: agree with known values to 5 decimal places

---

## Rendering Approach

A `toSVG(inches)` scale function converts table coordinates (inches) to SVG pixels. The error cones are SVG `<polygon>` elements (two lines from a point, filled with low opacity). On every slider `input` event, a single `update()` function recomputes all derived values and updates the relevant SVG element attributes and the text readouts. No full re-render on each tick — only the dynamic elements are touched.

---

## Phasing

### v1 (this engagement)
- Static ball positions (hardcoded defaults: moderate cut from mid-table)
- Full math and visualization as described above
- 100% Vitest coverage

### Future (not in scope)
- Draggable balls
- Cut-induced throw (friction)
- Side spin and spin-induced throw
- Squirt and swerve
