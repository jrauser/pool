# Side Pocket Effective Target Size

## Source

Based on TP 3.5 ("Effective target sizes for slow shots into a side pocket at
different angles") by David G. Alciatore, PhD, PE.
Original: <http://billiards.colostate.edu>, last revised 2023-01-22.

---

## 1. Overview

This module computes the **effective target size** of a side pocket as a
function of the approach angle θ. The target size accounts for the pocket
geometry (mouth width, hole radius, shelf depth, wall angle) and the two
mechanisms by which a ball can enter the pocket:

- **Point deflection** — the ball grazes the point (cushion nose) at the mouth
  of the pocket and is redirected into the hole.
- **Wall deflection** — the ball contacts the inside wall of the pocket and is
  redirected into the hole.

The model assumes **slow-speed shots** (no bouncing off the back of the
pocket). All units are inches unless stated otherwise. All angles are in
radians internally; degrees are used only for display.

---

## 2. Parameters

### 2.1 Ball Parameter

| Symbol | Description | Default |
|--------|-------------|---------|
| R      | Ball radius | 1.125   |

### 2.2 Pocket Parameters

| Symbol   | Description                        | Default  |
|----------|------------------------------------|----------|
| p        | Width of pocket mouth              | 5.0625   |
| α        | Wall angle (from shelf surface)    | 14°      |
| R_hole   | Radius of the pocket hole          | 3.0      |
| b        | Shelf depth to hole center         | 0.1875   |

All pocket parameters should be configurable per-pocket. The defaults above
correspond to a typical side pocket on a regulation 9-foot table.

### 2.3 Angle Convention

**θ** is the approach angle measured from the line perpendicular to the
cushion through the center of the pocket mouth.

- θ = 0° means the ball approaches straight into the pocket (perpendicular to
  the rail).
- θ > 0° means the ball approaches from the left (toward the "point" side for
  the left target boundary).
- θ < 0° means the ball approaches from the right.

The model is **not** symmetric about θ = 0° in its individual left/right
components, but exploits the geometric symmetry of the pocket via
`s_right(θ) = s_left(-θ)`.

---

## 3. Core Equations

### 3.1 Auxiliary Function A

This term arises from the vector-loop geometry around the pocket point:

```
A(α, p, b, R_hole, β_l, θ) =
    1 / sin(2·β_l − θ − α)
    · [ (p/2)·cos(α) − R − R_hole·cos(2·β_l − θ − α) − (R_hole + b)·sin(α) ]
```

### 3.2 Point-Deflection Polynomial (polyβ)

The angle β_l (the deflection angle at the pocket point) is found as a root
of the following polynomial in β, with θ as a parameter:

```
polyβ(α, p, b, R_hole, β_l, θ) =
      R·sin(β_l)
    + A(α, p, b, R_hole, β_l, θ) · sin(4·β_l − 2·θ − 2·α)
    + R_hole · cos(4·β_l − 2·θ − 2·α)
    + (p/2) · cos(2·β_l − θ)
    + (R_hole + b) · sin(2·β_l − θ)
```

### 3.3 Inside-Wall Polynomial (polyβ_in)

For the case where the ball contacts the inside wall of the pocket (relevant
at negative θ, i.e., steep angles from the far side):

```
polyβ_in(p, b, R_hole, β_l, θ) =
      −R·sin(β_l)
    + R_hole
    − (p/2)·cos(2·β_l − θ)
    − (R_hole + b)·sin(2·β_l − θ)
```

Note: this function does **not** depend on α.

### 3.4 Solving for β_l

For a given θ, find β_l by solving both polynomials and taking the minimum:

```
β_l(α, p, b, R_hole, θ) = min(
    root(polyβ(α, p, b, R_hole, β, θ), β),
    root(polyβ_in(p, b, R_hole, β, θ), β)
)
```

**Root-finding notes:**

- Use a numerical root finder (e.g., Brent's method, Newton-Raphson).
- An initial guess that works well:
  `β_guess(θ) = 20° + (70/130)·(θ + 60°)`
- Both roots should be sought; the physically meaningful solution is the
  minimum of the two.

### 3.5 Left Target Size — Point Deflection

```
s_left_point(α, p, b, R_hole, θ) = (p/2)·cos(θ) − R·sin(β_l(α, p, b, R_hole, θ))
```

### 3.6 Left Target Size — Wall Deflection

For steep angles (large |θ| on the far side), the ball can enter by
deflecting off the inside wall. The wall-deflection contribution is computed
as follows:

```
r_wall_1(α, p, b, R_hole, θ) =
    A(α, p, b, R_hole, 90°, θ) · sin(2·θ + 2·α) − R_hole·cos(2·θ + 2·α)

r_wall_2(p, b, R_hole, θ) =
    (p/2)·cos(θ) − (R_hole + b)·sin(θ)

r_wall(α, p, b, R_hole, θ) = r_wall_1(α, p, b, R_hole, θ) + r_wall_2(p, b, R_hole, θ)

s_left_wall(α, p, b, R_hole, θ) = −( (p/2)·cos(−θ) − r_wall(α, p, b, R_hole, −θ) )
```

**Important:** Note the negations on θ in the `s_left_wall` formula. The wall
deflection for the left boundary involves evaluating `r_wall` at `−θ`.

---

## 4. Critical Angles

Three critical angles partition the θ domain into regions with different
pocketing mechanisms.

### 4.1 θ_max — Maximum Angle for Point Deflection and Rattle-In

Solve for θ in:

```
polyβ(α, p, b, R_hole, 90°, θ) = 0
```

This is the angle at which the ball just barely fits past the point with
β_l = 90° (grazing contact). For default parameters: **θ_max ≈ 68.292°**.

Verification check: `r_wall(α, p, b, R_hole, θ_max) = R` (the ball radius).

### 4.2 θ_critical — Transition Between Far-Point Rattle-In and Far-Wall Deflection

```
θ_critical = β_l(α, p, b, R_hole, θ_critical) + α − 90°
```

In practice, solve `polyβ_in` at the specific θ value where
`θ − α + 90° − β = 0`, yielding **θ_critical ≈ −49.964°** for default
parameters.

### 4.3 θ_min — Minimum Angle (Symmetry Limit)

```
θ_min = −θ_max ≈ −68.292°
```

---

## 5. Piecewise Target-Size Assembly

### 5.1 Left Target Size

```
s_left(θ) =
    0                                        if θ ≥ θ_max
    0                                        if θ ≤ θ_min
    s_left_wall(α, p, b, R_hole, θ)         if θ_min < θ < θ_critical
    s_left_point(α, p, b, R_hole, θ)        otherwise
```

### 5.2 Right Target Size (by Symmetry)

```
s_right(θ) = s_left(−θ)
```

### 5.3 Total Effective Target Size

```
s(θ) = s_left(θ) + s_right(θ)
```

### 5.4 Target Center Offset

The offset of the effective target center from the geometric center of the
pocket mouth:

```
offset(θ) = (s_right(θ) − s_left(θ)) / 2
```

---

## 6. Margin-of-Error Function

The function `m` converts the effective target size into the number of ball
diameters of aiming error the shooter can tolerate, at a given aiming
uncertainty Δθ:

```
m(Δθ) = s / (2·tan(Δθ))
```

This represents the distance from the pocket at which the target subtends an
angle of Δθ — in other words, how far away a player with aiming precision Δθ
can be and still pocket the ball. The result is in inches; divide by the table
length or ball diameter as appropriate for your application.

---

## 7. Expected Outputs

For default parameters, the implementation should reproduce these values:

| θ (deg) | s (approx, inches) | offset (approx, inches) |
|---------|---------------------|-------------------------|
| 0       | ~3.35               | ~0.0                    |
| ±35     | ~2.0                | (see offset plot)       |
| ±68.29  | 0.0                 | —                       |

The s(θ) curve should be roughly bell-shaped and nearly symmetric, peaking
near θ = 0°. The offset curve is antisymmetric with a kink near
θ_critical ≈ −50°.

---

## 8. Implementation Notes

1. **Units:** All lengths in inches. All angles in radians internally.

2. **Root finding:** The `polyβ` and `polyβ_in` equations each require a
   scalar root solve per evaluation of `s_left_point`. Use a bracketed
   method (Brent) or Newton's method. The initial guess formula in §3.4
   is reliable for the `polyβ` root. For `polyβ_in`, the same guess
   region works but the two roots should be compared.

3. **Precompute critical angles:** θ_max, θ_critical, and θ_min should be
   computed once at initialization (or whenever pocket parameters change),
   not per-query.

4. **Continuity:** The piecewise function `s_left` is continuous but has
   slope discontinuities at θ_critical. This is physically correct — it
   reflects the transition between pocketing mechanisms.

5. **Domain:** The function is only defined for `−θ_max ≤ θ ≤ θ_max`.
   Outside this range, `s = 0` (the pocket is unreachable at that angle).

6. **This model is for side pockets only.** Corner pockets have different
   geometry (no wall deflection in the same sense). A separate model would
   be needed for corner pockets.

7. **Slow-shot assumption:** The model does not account for balls bouncing
   off the back of the pocket at high speed, which can eject balls that
   would otherwise be pocketed. For high-speed shots, the effective target
   size may be smaller.
