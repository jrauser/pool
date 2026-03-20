# Plan v3: Collision-Induced Throw

## Goal

Add collision-induced throw (CIT) to the shot model. CIT deflects the
object ball away from the "theoretical" cut-angle direction due to friction
during the collision. The effect is speed-dependent (slower shots throw
more) and substantial enough to change whether shots are makeable.

The math is specified in `object_ball_throw_spec.md` (TP A-14).

## Scope

This version adds:

1. **Throw calculation** — a new `throw.js` module implementing the CIT
   model from TP A-14.
2. **Shot speed toggle** — slow / medium / fast (1 / 3 / 7 mph).
3. **CIT aim adjustment toggle** — controls whether the aim point
   compensates for throw.
4. **CIT accuracy slider** — the shooter's error in compensating for CIT,
   analogous to the existing execution error slider.

This version does **not** include:

- Sidespin / spin-induced throw (future work).
- Cling/skid/kick friction multiplier (future work).
- Side pocket support.

### Simplification: no sidespin, natural roll

For v3 we assume ω_z = 0 (no sidespin) and ω_x = v/R (natural roll).
This is the most common shot condition and simplifies the model to a
function of just speed and cut angle: `θ_throw(v, φ)`. Stun and draw
conditions are future work.

## Difficulty Assessment

**Moderate.** The throw math itself is straightforward (~50 lines of pure
functions). The harder part is integrating throw into the existing geometry
and probability calculations:

- The aim point (ghost ball position) shifts when CIT compensation is on.
- The error cones must account for throw uncertainty.
- The make probability calculation needs to incorporate throw error.

## How Throw Changes the Shot

Without throw, the object ball travels along the line of centers (the
cut-angle direction). With throw, it deflects by θ_throw toward the
"overcut" side. This means:

- **Without CIT compensation:** The player aims as if throw doesn't exist.
  The OB direction is shifted by θ_throw, which may cause a miss.
  The existing error cone (red) shifts off-center from the pocket.
- **With CIT compensation:** The player adjusts their aim to perfectly
  cancel throw. The OB direction is correct on average. But the player has
  some error in this compensation, widening the effective error cone.

## Implementation Plan

### Step 1: Throw module (`throw.js`)

A new module with the pure math from TP A-14 §§3–4, restricted to the
CIT-only case (ω_z = 0).

**Functions:**

1. `frictionCoefficient(vRel)` — Marlow exponential model (§3.2):
   `μ(v) = 0.00995 + 0.108 · exp(−1.088 · v)`.  Argument is in m/s.

2. `relativeSlideSpeed(v, omegaX, phi)` — magnitude of sliding velocity at
   contact point (§4.1):
   `v_rel = √((v·sin(φ))² + (R·ωx·cos(φ))²)`.
   With ω_z = 0 the tangential term is just `v·sin(φ)`.

3. `throwAngle(v, omegaX, phi)` — CIT throw angle (§4.2):
   ```
   ratio = min(μ(v_rel) · v·cos(φ) / v_rel, 1/7)
   θ_throw = atan(ratio · v·sin(φ) / (v·cos(φ)))
   ```
   Returns 0 for straight-on shots (φ = 0) and handles v_rel = 0.

4. `throwAngleNaturalRoll(v, phi)` — convenience wrapper that sets
   ω_x = v/R. This is what the UI calls for v3.

**Constants:**

```js
export const BALL_RADIUS_M = 0.02857;     // meters (1.125 in)
export const SPEEDS = {
  slow:   { mph: 1, mps: 0.447 },
  medium: { mph: 3, mps: 1.341 },
  fast:   { mph: 7, mps: 3.129 },
};
```

**Unit conversion note:** The throw model works in SI (meters, m/s). The
friction function takes m/s. The CB speed `v` is in m/s. The output
`θ_throw` is in radians — dimensionless and directly usable alongside the
existing radian-based geometry in `pool.js`.

### Step 2: Tests for throw module (`throw.test.js`)

- `frictionCoefficient`: verify against Marlow calibration points
  (μ ≈ 0.06 at medium speed, ~0.11 at very low speed).
- `throwAngle`: φ = 0 → 0; verify against TP A-14 §6 qualitative targets:
  - Slow natural roll at large cut: ~4–5° throw.
  - Fast natural roll at large cut: ~1° throw.
  - Speed-independence at small cut angles (kinematics limit).
- `throwAngle` monotonicity in φ for natural roll.
- `throwAngle` sign: always positive for positive φ (overcut direction).
- Edge cases: v_rel = 0, φ = 0, φ = π/2.

### Step 3: Integrate throw into shot geometry (`pool.js`)

This is the core integration step. Two modes controlled by the CIT
adjustment toggle:

#### Mode A: CIT compensation OFF (aim ignoring throw)

The player aims at the normal ghost ball position. After collision, the OB
deflects by θ_throw. The "true" OB direction is the cut-angle direction
*plus* θ_throw.

For the visualization:
- Ghost ball and aim line: unchanged (player aims as if no throw).
- Travel line: rotated by θ_throw from the line-of-centers direction
  to show where the OB actually goes.
- Error cones: the red cone is centered on the thrown direction, not the
  pocket direction. The miss is visible.
- Make probability: computed against the thrown center direction. The
  probability answers "given this aim point and this throw, how often does
  the ball go in?"

Concretely, the make probability becomes:
```
P(make) = P(|Δθ(Δφ) + θ_throw| ≤ α)
```
where Δφ ~ N(0, σ²). The throw shifts the center of the error
distribution away from the pocket. Bisection still works: find Δφ_max
where |Δθ(Δφ_max) + θ_throw| = α, then use the Gaussian CDF.

Actually, because the throw shifts the OB direction asymmetrically, the
acceptance region for Δφ is no longer symmetric around zero. We need to
find *two* boundaries: Δφ_lo and Δφ_hi where the OB direction crosses the
pocket edges. Then:
```
P(make) = Φ(Δφ_hi / σ) − Φ(Δφ_lo / σ)
```
where Φ is the normal CDF. This requires two bisections (one for each
pocket edge) instead of the current single bisection.

#### Mode B: CIT compensation ON (aim adjusted for throw)

The player rotates their aim to cancel the throw. The ghost ball shifts
to a new position such that the line of centers, after applying θ_throw,
points at the pocket.

For the visualization:
- Ghost ball: shifted to the CIT-compensated position.
- Aim line: cue ball → compensated ghost ball.
- Travel line: OB → pocket (on-center, since compensation is perfect).
- Error cones: the execution error cone (blue) produces a red cone
  centered on the pocket, as before — but with an additional spread
  from CIT compensation error.

**Updated:** The CIT accuracy slider controls the player's compensation
accuracy as a percentage of the throw angle. The player's compensation
fraction C ~ N(1, σ_frac²), so the residual throw is N(0, (σ_frac × θ_throw)²).
This error is in Δθ space (OB direction), not Δφ space (cue aim).

The make probability is computed by integrating `makeProbabilityWithThrow`
over the CIT error distribution using 5-point Gauss-Hermite quadrature.
This correctly handles the nonlinear Δφ → Δθ mapping without linearization.

### Step 4: UI changes

#### Speed toggle

A 3-button radio group (slow / medium / fast) in the control panel, below
the execution error slider. Styled as segmented control buttons.

```html
<div class="control-group">
  <label>Shot speed</label>
  <div class="toggle-group" id="speed-toggle">
    <button data-speed="slow">Slow (1 mph)</button>
    <button data-speed="medium" class="active">Medium (3 mph)</button>
    <button data-speed="fast">Fast (7 mph)</button>
  </div>
</div>
```

Default: medium. Changing speed triggers `redraw()`.

#### CIT adjustment toggle

A simple on/off toggle below the speed buttons.

```html
<div class="control-group">
  <label>
    <input type="checkbox" id="cit-adjust-toggle" />
    Adjust aim for throw
  </label>
</div>
```

Default: off (so the user first sees the raw impact of throw on their
shot). Toggling triggers `redraw()`.

#### Throw compensation accuracy slider

**Updated:** The slider now represents the 95% CI of compensation accuracy
as a percentage of the full throw angle, not a fixed angular error. Range
0–30%, step 1%, default 10%. The player aims for 100% compensation; the
slider controls the spread of their accuracy around that target.

#### Updated readouts

Add a "Throw" row to the shot info section showing the throw angle in
degrees. This helps the user understand the magnitude of CIT for the
current shot.

### Step 5: Visualization of throw

#### Thrown travel line

When CIT compensation is off, the travel line (OB → pocket) should show
the *actual* OB direction including throw, not the ideal pocket direction.
This makes the effect of throw visually obvious: the line misses the
pocket.

Option: show both lines — a faint dashed line for the "ideal" direction
(no throw) and a solid line for the "actual" direction (with throw). The
gap between them *is* the throw.

#### Error cone offset

When CIT compensation is off, the red cone shifts to be centered on the
thrown direction. The user can see the cone missing the pocket target.

When CIT compensation is on, the red cone stays centered on the pocket
but is wider (because of combined error sources).

### Step 6: Update `makeProbability` for throw

The current `makeProbability(d, phi, alpha, sigma)` assumes the OB
direction error is centered on the pocket. With throw, we need variants:

**CIT compensation off:**
Replace the symmetric bisection with an asymmetric one. The OB direction
is offset by θ_throw from the pocket center. Find Δφ_lo and Δφ_hi where
the OB direction crosses the pocket tolerance edges (±α from pocket
center, shifted by θ_throw). Then:
```
P = Φ(Δφ_hi/σ) − Φ(Δφ_lo/σ)
```
where Φ(x) = (1 + erf(x/√2)) / 2.

**CIT compensation on:**
Use the existing symmetric formula with σ_eff = √(σ² + σ_CIT²). The aim
point is already adjusted, so the error is centered on the pocket.

### Step 7: Update tests in `pool.test.js`

- Test the new `makeProbability` variant with throw offset.
- Test that CIT compensation on + σ_CIT = 0 gives the same result as the
  non-throw model.
- Test that throw = 0 (straight-on shot) gives the same result as before.

## Resolved Questions

1. **Visualization of two error sources:** Single combined cone for v3.
   The two error sources (execution in Δφ space, CIT in Δθ space) are each
   mapped to Δθ and combined in quadrature for the cone half-angle.

2. **Ghost ball with CIT compensation:** Show only one ghost ball — the
   compensated position when compensation is on, the ideal position when
   off. The user can toggle quickly to see the magnitude of the shift.

3. **Throw direction convention:** TP A-14 defines positive throw as
   the "undercut" direction — friction drags the OB toward the CB's
   path, making the shot play as though hit fuller. An initial
   implementation had this inverted (overcut); fixed by flipping the
   rotation sign in the three places that apply throw to the geometry.

## What Changes for the User

- A speed toggle (slow/medium/fast) appears in the control panel.
- A new "Throw" readout shows the CIT angle for the current shot.
- With default settings (compensation off), the travel line visibly
  misses the pocket for most cut shots — demonstrating why throw matters.
- The make probability drops compared to v2.1, reflecting reality.
- Turning on CIT compensation re-centers the aim but adds a second
  error source. The user can explore the tradeoff with the CIT slider.
- Straight-in shots (φ = 0) are unaffected by throw.
- Slower shots show more throw — the speed toggle makes this obvious.

## Not in Scope

- Sidespin / spin-induced throw (ω_z ≠ 0).
- Stun, draw, or follow spin states (ω_x ≠ v/R).
- Cling/skid/kick friction multiplier.
- Side pocket support.
- Multiple pocket selection.
