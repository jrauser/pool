# Plan v2.1: Dynamic Pocket Target Size

## Goal

Replace the fixed 2.5" effective pocket opening with a dynamic target size
that varies with the object ball's approach angle, as specified in
`corner_pocket_target_size_spec.md` (based on TP 3.6).

When the user drags the object ball, the yellow target line should change
in width, position, and orientation to reflect the actual effective target
for that approach angle.

## Difficulty Assessment

**Moderate-high.** The rendering changes are straightforward, but the
underlying math is substantial:

- ~15 interdependent functions from the corner pocket spec
- Two separate root-finding problems (polyβ and polyβww)
- Four critical angles computed via additional root-finding
- A 4-branch piecewise assembly for s_left(θ)
- Numerical edge cases throughout

The side pocket spec (`side_pocket_target_size_spec.md`) shares several
base equations but is not needed yet — the only target pocket is the
upper-right corner. We'll structure the code so the shared functions can
be reused later.

## Approach Angle θ

The corner pocket centerline is the 45° bisector of the corner. The
approach angle θ is measured from this centerline:

```
θ = atan2(opy, opx) − 135°     (in table coords, origin lower-left)
```

where `(opx, opy)` is the vector from the object ball to the pocket
center. θ = 0 means the ball approaches along the 45° diagonal; θ > 0
means from the long-rail side; θ < 0 means from the short-rail side.

Valid range: approximately −45° to +45°.

## Implementation Plan

### Step 1: Pocket geometry module

Create `pocket_geometry.js` with all the math from the corner pocket spec.
This keeps `pool.js` focused on rendering and shot mechanics.

**Functions to implement (in dependency order):**

1. `auxiliaryA(params, betaL, theta)` — shared eq §3.1
2. `polyBeta(params, betaL, theta)` — point-deflection polynomial §3.2
3. `polyBetaIn(params, betaL, theta)` — inside-wall polynomial §3.3
4. `findRoot(f, guess, tol)` — Newton-Raphson with numerical derivative
5. `solveBetaL(params, theta)` — root of min(polyβ, polyβ_in) §3.4
6. `sLeftPointWall(params, theta)` — point deflection target §3.5
7. `rWall(params, theta)` and `sLeftWall(params, theta)` — wall deflection §3.6
8. `thetaRail(theta)`, `thetaWall(theta, alpha)` — angle transforms §4
9. `dWallWall(params, theta)`, `sLeftWallWall(params, theta)` — 2-wall rattle §5.1
10. `dWallWallWall(params, theta)`, `sLeftWallWallWall(params, theta)` — 3-wall rattle §5.2
11. Rail-deflection variants §6: `sLeftRailPointWall`, `sLeftRailWallWall`, `sLeftRailWall`
12. `polyBetaWW(params, beta, theta)` — point + 2-wall rattle polynomial §7
13. `sLeftPointWallWall(params, theta)` — via polyβww root §7.5
14. `sLeftRailPointWallWall(params, theta)` — rail + point + 2-wall §7.6
15. `sLeftRailMaxAngle(params, dMax, theta)` — beyond θ_max_long §8.5
16. `computeCriticalAngles(params)` — θ_critical_C, θ_critical, θ_critical_D, θ_max_long §8
17. `cornerTargetSize(params, theta)` — piecewise assembly §9: returns `{ s, offset, sLeft, sRight }`

**Parameters object:**
```js
{ R: 1.125, p: 4.5875, alpha: 7°, Rhole: 2.75, b: 1.125, L: 100 }
```

Note: L = 100" for a 9-foot table (rail nose-to-nose). The spec defaults
to 96" for an 8-foot table; we adjust for our 9-foot table.

### Step 2: Tests for pocket geometry

Thorough unit tests in `pocket_geometry.test.js`:

- Each intermediate function against expected values from the spec
- The critical angles against spec values (adjusting for 9-ft table)
- The assembled s(θ) against the qualitative expectations in §11:
  - θ = 0°: s ≈ 1.5" (local minimum)
  - θ = ±30°: s ≈ 1.3" (near global minimum)
  - θ = ±45°: s ≈ 3.0–3.5" (rail deflection)
- Symmetry: s(θ) should be symmetric about θ = 0° for symmetric pocket params
- Continuity at critical angles
- Edge cases: θ at domain boundaries

### Step 3: Integrate into pool.js

1. Import `cornerTargetSize` from `pocket_geometry.js`
2. Compute approach angle θ from object ball position
3. Replace `pocketTolerance()`:
   - Currently: `atan(1.25 / d_op)` (fixed 2.5" opening)
   - New: `atan((s / 2) / d_op)` where `s` comes from `cornerTargetSize`
4. Pass `s` and `offset` to the rendering code

### Step 4: Update target visualization

The yellow target line currently has fixed endpoints. Update it to:

1. **Width**: proportional to `s(θ)` instead of fixed 2.5"
2. **Center offset**: shift along the pocket mouth by `offset(θ)`
3. **Orientation**: perpendicular to the approach direction (the line from
   object ball to pocket), not fixed along the pocket diagonal

The target line endpoints in table coords:
```
perpendicular = rotate(normalize(pocket - objPos), 90°)
center = pocketPos + offset * perpendicular
endpoint1 = center - (s/2) * perpendicular
endpoint2 = center + (s/2) * perpendicular
```

### Step 5: Update readouts

- Change the "Pocket tolerance" display to show the effective target size
  in inches alongside the angular tolerance, so the user can see both.

## What Changes for the User

- The yellow target line grows and shrinks as the object ball moves
- Near-rail shots (θ near ±45°) show a much larger target (rail deflection)
- Straight-on diagonal shots show a smaller target (~1.5")
- The make probability updates accordingly — near-rail corner shots are
  easier than they might appear
- The target shifts slightly off-center at oblique angles

## Resolved Questions

1. **L for 9-foot table**: L = 100" (our TABLE_WIDTH). The spec defaults
   to 96" for an 8-foot table; we use 100" for our 9-foot table.

2. **Target orientation**: Keep aligned with the pocket mouth (faithful
   to the model — s(θ) is defined as a width at the pocket mouth).

3. **Pocket parameters**: Keep our existing POCKET_MOUTH_WIDTH = 4.5".
   The pocket geometry module will use p = 4.5 (not the spec's 4.5875).

## Not in Scope

- Side pocket target size (future work, different pocket type)
- Multiple target pockets (currently only upper-right corner)
- Fast-shot corrections (TP 3.8)
- Cut-induced throw / spin effects
