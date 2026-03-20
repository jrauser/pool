# Implementation Notes

Deviations from the plan, surprising constraints, and non-obvious design decisions.

---

## Variable naming clarification

The initial requirements used φ for two different things in different sections: the cut angle in the math, and the execution error in the prose. Resolved by adopting the paper's notation throughout: **φ = cut angle**, **Δφ = execution error**, **Δθ = object ball direction error**. The requirements doc was updated to reflect this.

---

## Tech stack change: Python → pure JS

CLAUDE.md (copied from a prior Python project) required Coverage.py and ruff. The project is a browser visualization with no natural Python component, so we switched to pure JavaScript with Vitest for testing and V8 coverage. The CLAUDE.md instructions were updated to remove the Python-specific tooling requirements.

---

## CORS error: ES modules can't load from file://

Opening `index.html` directly in Chrome gave:

> Access to script at 'file:///…/pool.js' from origin 'null' has been blocked by CORS policy

ES modules require HTTP. Fixed by adding `"start": "python3 -m http.server 8080"` to `package.json`. This uses Python's built-in server (guaranteed available on macOS) with zero added dependencies.

---

## Node.js installation

The system node was unavailable. Homebrew's `node` formula failed partway through (building from source on an older macOS, hitting a formula resolution error for `ada-url`). A pre-built Node 20 binary was already available at `/tmp/node/bin/`. All npm commands are run with `PATH=/tmp/node/bin:$PATH npm …`.

---

## SVG height bug: table top mapped 15px above the felt

The initial SVG_HEIGHT was hardcoded to 400. With SVG_SCALE = 7.7 px/in and TABLE_HEIGHT = 50":

```
TABLE_HEIGHT × SVG_SCALE = 385 px
SVG_HEIGHT − 2×SVG_BORDER = 400 − 30 = 370 px  ← 15px short
```

Consequence: `tableToSVG(100, 50)` (the table corner) returned SVG y = 0 — the very top edge of the canvas, 15px *above* the felt rectangle. The pocket was rendered entirely inside the rail area and appeared disconnected from the playing surface.

Fix: derive SVG_HEIGHT from the scale rather than hardcode it:
```javascript
export const SVG_HEIGHT = 2 * SVG_BORDER + TABLE_HEIGHT * SVG_SCALE; // = 415
```
This ensures the playing surface maps exactly onto the felt rectangle.

---

## Pocket geometry: from BCA spec to SVG

The plan used POCKET_POS = (100", 50") — the table corner — as the aim point. The paper and BCA spec describe the pocket differently:

- **Mouth width**: 4.5" (BCA standard)
- **Facing angle**: 142° interior angle between rail and pocket facing
- **Effective target**: 2.5" (4.5" − 2" per the paper)

For a corner pocket at 45°, the two rails each end `4.5"/√2 ≈ 3.18"` from the corner (so the straight-line distance between the two rail ends equals the mouth width of 4.5"). The aim point (POCKET_POS) is the **midpoint of the mouth** — approximately (98.4", 48.4"), not the corner itself.

The pocket is rendered as a dark triangle: top-rail-end → corner → right-rail-end, with two short facing lines at 142° and a yellow 2.5" target segment across the mouth. The facing directions in SVG (y-down) are:

- From top-rail end: `(cos38°, sin38°)` — right and down
- From right-rail end: `(sin38°, −cos38°)` — right and up

The facing intersection (pocket "back") falls at ≈ (100.33", 47.25") — slightly outside the playing surface, which is physically correct (the pocket is cut into the rail corner).

---

## Make probability: bisection rather than integration

Since Δθ is a nonlinear function of Δφ, computing P(|Δθ| ≤ α) in general requires numerical integration. We avoid this by exploiting monotonicity: Δθ is monotonically increasing in Δφ (verified in tests for representative configurations), so we can bisect for Δφ_max where Δθ = α, then use the Gaussian CDF analytically:

```
P = erf(Δφ_max / (σ√2))
```

A second bisection is needed to first find the domain boundary (where the arcsin argument hits ±1), since Δφ_max must be clamped to that boundary if the tolerance α is never reached within the valid domain.

---

## erf approximation

JavaScript has no `Math.erf`. We use Abramowitz & Stegun 7.1.26 (a degree-5 rational approximation), max error ≈ 1.5×10⁻⁷. A special case for x = 0 is required because the approximation has ~1e-9 floating-point error at zero that would fail a strict `toBe(0)` test.

---

## Coverage of browser-only rendering code

Vitest runs in Node, so `initApp()` (which touches the DOM) can't be covered by tests. The rendering code is wrapped in `/* v8 ignore start/stop */` comments. To keep the math testable, all pure functions (`deltaTheta`, `cutAngle`, `pocketTolerance`, `makeProbability`, `erfApprox`, `conePoints`, `tableToSVG`) are exported at module level. The browser-only guard is:

```javascript
if (typeof document !== 'undefined') { initApp(); }
```

This is also marked `/* v8 ignore next 3 */`.

---

## Plan deviation: no separate pool_math.py

The plan mentioned deriving math in Python (tested) and mirroring in JS. Since we went pure JS from the start, there is only one implementation. The JS is the source of truth.

---

## V2.1: Corner pocket target size model

### Separate module

The TP 3.6 math (~280 lines, 15+ functions) lives in `pocket_geometry.js` rather than `pool.js`. This keeps `pool.js` focused on rendering and shot mechanics. The module exports a factory `createCornerPocketCalculator(params)` that precomputes critical angles once and returns a function `θ → { s, offset, sLeft, sRight }`.

### Root finding

Two root-finding problems arise: polyβ (point deflection angle) and polyβww (point + two-wall rattle). Newton-Raphson with numerical derivative is the primary solver, with bisection as fallback. The bisection fallback has never been triggered in practice — Newton converges reliably for both problems with the initial guesses from the spec (β_guess for polyβ, 75° for polyβww).

### Spec expected values vs actual output

The spec's §11 "Expected Outputs" table gives approximate values eyeballed from the TP 3.6 plots for 8-foot table default params (p=4.5875). Our params differ (p=4.5, L=100 for 9-foot table), so absolute values differ. The qualitative shape matches: dip in the middle (~2.2–2.6"), rise at the edges (~2.8" near ±44°). All structural properties verified in tests: symmetry s(θ)=s(−θ), antisymmetric offset, continuity at critical angles, non-negative output.

### Domain clamping

The model is only valid for |θ| ≲ 45°. Beyond that, `sLeftRailMaxAngle` can return negative values (the rail-deflection distance exceeds the physical rail). Fixed by clamping each side's contribution to max(0, val) in the piecewise assembly. This was caught during manual testing with the ball near the rail close to the pocket.

### pocketTolerance return type change

`pocketTolerance()` previously returned a plain number (α in radians). It now returns `{ alpha, targetSize, offset }`. This required updating all call sites and the existing test suite.

---

## V3: Collision-Induced Throw

### Throw module

The CIT math lives in `throw.js` (~85 lines, 4 exported functions). It implements the TP A-14 model restricted to natural roll (ω_x = v/R) and no sidespin (ω_z = 0). The Marlow exponential friction fit is verified against the three calibration points from the paper.

### Asymmetric make probability

With throw, the OB direction is offset from the pocket center, making the acceptance region for Δφ asymmetric. The original `makeProbability` used a single bisection (exploiting symmetry). The new `makeProbabilityWithThrow` uses two bisections via `bisectDeltaPhi` to find the Δφ values where Δθ equals each pocket edge (α − throwOffset and −α − throwOffset), then uses the normal CDF: P = Φ(Δφ_hi/σ) − Φ(Δφ_lo/σ).

An initial attempt using outward search from Δφ=0 failed when throwOffset > α, because Δφ=0 is outside the makeable region. The bisect-for-Δθ-targets approach handles all cases correctly.

### Ghost ball rotation for CIT compensation

When CIT compensation is on, the ghost ball shifts to cancel throw. The rotation direction (which way to shift the aim) depends on which side of the line-of-centers the cue ball sits. This is determined by the cross product of (OB→pocket) × (OB→cue). The same sign logic is used for the thrown travel line and the offset red cone.

### Throw direction was initially inverted

The original `object_ball_throw_spec.md` described positive throw as the "overcut" direction. This is wrong: friction drags the OB *toward* the CB's path (the undercut direction, making the shot play as though hit fuller). The spec was corrected, but the code's rotation sign was not updated, causing the thrown travel line to deflect the wrong way. Fixed by inverting `rotSign` in the three places that apply throw to the geometry (ghost ball compensation, thrown travel line, and red cone offset).

### Speed-independence at small cut angles is stun-specific

TP A-14 §6.2 states throw is "nearly speed-independent at small cut angles" — this applies to stun shots (ω_x = 0) where the kinematics limit (1/7) dominates. For natural roll, the vertical sliding component (R·ω_x·cos(φ)) significantly changes v_rel, so friction varies with speed even at small angles. The test suite was updated to test speed-independence with stun, not natural roll.

### CIT compensation model: percentage of throw, not fixed angular error

The initial CIT slider treated compensation error as a fixed angular Gaussian (in degrees), combined in quadrature with execution error. This was wrong in two ways: (1) a player's compensation accuracy is better described as a percentage of the throw angle (bigger throw → proportionally bigger error), and (2) the two error sources live in different spaces (execution error in Δφ, CIT error in Δθ) and can't simply be combined in Δφ space.

The redesigned slider goes from 0% to 30% and represents the 95% CI of compensation accuracy as a fraction of the full throw angle. The make probability is computed by integrating `makeProbabilityWithThrow` over the CIT error distribution using 5-point Gauss-Hermite quadrature, which correctly handles the nonlinear Δφ → Δθ mapping. For the error cone visualization, both error contributions are mapped to Δθ space and combined in quadrature there.
