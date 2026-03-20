# Corner Pocket Effective Target Size

## Source

Based on TP 3.6 ("Effective target sizes for slow shots into a corner pocket
at different angles") by David G. Alciatore, PhD, PE.
Original: <http://billiards.colostate.edu>, last revised 2008-01-29.

This document uses the same general notation as TP 3.5 (side pocket model).

---

## 1. Overview

This module computes the **effective target size** of a corner pocket as a
function of approach angle θ. Unlike the side pocket, the corner pocket
introduces two additional complexities:

- **Rail deflection** — at shallow angles to the rail, the ball can contact
  the cushion *before* the pocket and still be redirected in. This greatly
  increases the effective target at near-rail angles.
- **Multi-wall rattles** — the ball can bounce between the pocket walls
  (facings) multiple times before dropping. The model tracks rattles of up
  to three wall contacts.

The model assumes **slow-speed shots**. All units are inches. All angles are
in radians internally.

---

## 2. Parameters

### 2.1 Ball Parameter

| Symbol | Description | Default |
|--------|-------------|---------|
| R      | Ball radius | 1.125   |

### 2.2 Pocket Parameters

| Symbol   | Description                        | Default  |
|----------|------------------------------------|----------|
| p        | Width of pocket mouth              | 4.5875   |
| α        | Wall angle (facing angle)          | 7°       |
| R_hole   | Radius of the pocket hole          | 2.75     |
| b        | Shelf depth to hole center         | 1.125    |

Note the corner pocket defaults differ from the side pocket: the mouth is
narrower (4.5875 vs 5.0625), the wall angle is shallower (7° vs 14°), the
hole is smaller (2.75 vs 3.0), and the shelf is much deeper (1.125 vs
0.1875).

### 2.3 Table Parameter

| Symbol | Description                             | Default     |
|--------|-----------------------------------------|-------------|
| L      | Rail length (cushion nose to nose)      | 96 (8 ft)   |

The maximum rail-deflection distance depends on table size. The default
`L = 8 * 12 = 96` corresponds to an 8-foot table (long rail, nose to nose).

### 2.4 Angle Convention

**θ** is the approach angle measured from the pocket centerline (the 45°
bisector of the corner).

- θ = 0° means the ball approaches straight into the pocket along the 45°
  bisector.
- θ > 0° means approach from the long-rail side.
- θ < 0° means approach from the short-rail side.

The valid range is approximately −45° ≤ θ ≤ +45° (limited by the rails).

---

## 3. Shared Equations from TP 3.5

The following functions are identical to those in the side pocket model.
They reuse the same pocket parameters but with corner-pocket defaults.

### 3.1 Auxiliary Function A

```
A(α, p, b, R_hole, β_l, θ) =
    1 / sin(2·β_l − θ − α)
    · [ (p/2)·cos(α) − R − R_hole·cos(2·β_l − θ − α) − (R_hole + b)·sin(α) ]
```

### 3.2 Point-Deflection Polynomial (polyβ)

```
polyβ(α, p, b, R_hole, β_l, θ) =
      R·sin(β_l)
    + A(α, p, b, R_hole, β_l, θ) · sin(4·β_l − 2·θ − 2·α)
    + R_hole · cos(4·β_l − 2·θ − 2·α)
    + (p/2) · cos(2·β_l − θ)
    + (R_hole + b) · sin(2·β_l − θ)
```

### 3.3 Inside-Wall Polynomial (polyβ_in)

```
polyβ_in(p, b, R_hole, β_l, θ) =
      −R·sin(β_l)
    + R_hole
    − (p/2)·cos(2·β_l − θ)
    − (R_hole + b)·sin(2·β_l − θ)
```

### 3.4 Solving for β_l

```
β_l(α, p, b, R_hole, θ) = min(
    root(polyβ(α, p, b, R_hole, β, θ), β),
    root(polyβ_in(p, b, R_hole, β, θ), β)
)
```

Initial guess: `β_guess(θ) = 20° + (70/130)·(θ + 60°)`

### 3.5 Left Target Size — Point Deflection (then one wall or straight-in)

```
s_left_point_wall(α, p, b, R_hole, θ) = (p/2)·cos(θ) − R·sin(β_l(α, p, b, R_hole, θ))
```

Note: In TP 3.6 this is named `s_left_point_wall` (not `s_left_point` as in
TP 3.5) because at the steeper corner-pocket wall angle, the ball that
deflects off the point typically also contacts one wall before dropping.

### 3.6 One-Wall Deflection

```
r_wall(α, p, b, R_hole, θ) =
      A(α, p, b, R_hole, 90°, θ) · sin(2·θ + 2·α)
    − R_hole · cos(2·θ + 2·α)
    + (p/2) · cos(θ)
    − (R_hole + b) · sin(θ)

s_left_wall(α, p, b, R_hole, θ) = −( (p/2)·cos(−θ) − r_wall(α, p, b, R_hole, −θ) )
```

---

## 4. Angle Transformations

The corner pocket geometry introduces angle transformations that describe
the ball's effective approach angle after contacting a rail or wall.

### 4.1 After Rail Contact

When the ball deflects off the rail (cushion) adjacent to the pocket, the
approach angle to the pocket becomes:

```
θ_rail(θ) = 90° − θ
```

This is because the rail is at 45° to the pocket centerline. A ball
approaching at angle θ to the pocket hits the rail and enters the pocket
at the complementary angle.

### 4.2 After Wall Contact

When the ball contacts a pocket wall (facing), the wall redirects it by
twice the wall angle:

```
θ_wall(θ) = θ − 2·α
```

### 4.3 After Rail Then Wall Contact

```
θ_rail_wall(θ) = θ_wall(−θ_rail(θ))
```

Expanding: `θ_rail_wall(θ) = (−90° + θ) − 2·α = θ − 90° − 2·α`

---

## 5. Multi-Wall Rattle Equations

These equations handle the case where the ball bounces between the two
pocket walls before dropping into the hole.

### 5.1 Two-Wall Rattle

The ball enters the pocket, hits one wall, crosses to the other, then drops.

```
D_wall_wall(θ) =
    1 / sin(θ − α)
    · ( (p/2)·cos(θ − 2·α) − R·cos(θ − α) + s_left_wall(α, p, b, R_hole, θ_wall(θ)) )

s_left_wall_wall(θ) =
    (p/2)·cos(θ) + D_wall_wall(θ)·sin(θ − α) − R·cos(θ − α)
```

`D_wall_wall` is the distance from the pocket mouth to the first wall
contact, projected along a specific direction.

### 5.2 Three-Wall Rattle

```
D_wall_wall_wall(θ) =
    1 / sin(θ − α)
    · ( (p/2)·cos(θ − 2·α) − R·cos(θ − α) + s_left_wall_wall(θ_wall(θ)) )

s_left_wall_wall_wall(θ) =
    (p/2)·cos(θ) + D_wall_wall_wall(θ)·sin(θ − α) − R·cos(θ − α)
```

Note the recursive structure: the three-wall case feeds `s_left_wall_wall`
evaluated at the redirected angle into a formula with the same geometric
form as the two-wall case.

---

## 6. Rail-Deflection Equations

When the ball approaches at a shallow angle to the rail (large |θ|), it can
contact the rail cushion before reaching the pocket. After reflecting off the
rail, it enters the pocket at the transformed angle `θ_rail(θ)`. The rail
reflection adds a distance `d` that extends the effective target.

All rail-deflection formulas share the same geometric structure:

```
d_X(θ) = 1 / sin(45° − θ)
    · ( s_left_X(..., −θ_rail(θ)) + (p/2)·sin(θ) − R·cos(45° − θ) )

s_left_rail_X(θ) =
    (p/2)·cos(θ) + d_X(θ)·sin(45° − θ) − R·cos(45° − θ)
```

where `X` identifies the pocketing mechanism after the rail bounce. The
specific variants are:

### 6.1 Rail → Point → Wall

```
d_point_wall(θ) =
    1 / sin(45° − θ)
    · ( s_left_point_wall(α, p, b, R_hole, −θ_rail(θ)) + (p/2)·sin(θ) − R·cos(45° − θ) )

s_left_rail_point_wall(θ) =
    (p/2)·cos(θ) + d_point_wall(θ)·sin(45° − θ) − R·cos(45° − θ)
```

### 6.2 Rail → Wall → Wall

```
d_wall_wall(θ) =
    1 / sin(45° − θ)
    · ( s_left_wall_wall(−θ_rail(θ)) + (p/2)·sin(θ) − R·cos(45° − θ) )

s_left_rail_wall_wall(θ) =
    (p/2)·cos(θ) + d_wall_wall(θ)·sin(45° − θ) − R·cos(45° − θ)
```

### 6.3 Rail → Wall (single wall after rail)

```
d_wall(θ) =
    1 / sin(45° − θ)
    · ( s_left_wall(α, p, b, R_hole, −θ_rail(θ)) + (p/2)·sin(θ) − R·cos(45° − θ) )

s_left_rail_wall(θ) =
    (p/2)·cos(θ) + d_wall(θ)·sin(45° − θ) − R·cos(45° − θ)
```

Note: `s_left_rail_wall` is defined in TP 3.6 but does not appear in the
final piecewise assembly. It may be relevant for other pocket geometries
or parameter ranges.

---

## 7. Point Deflection with Two-Wall Rattle (polyβww)

For the case where the ball deflects off the pocket point and then rattles
across both walls before dropping, a separate root-finding polynomial is
needed.

### 7.1 Auxiliary Angles

```
φ_1(β, θ) = 2·β − 90° − θ − 2·α
φ_2(β, θ) = φ_1(β, θ) − 2·α
```

### 7.2 Auxiliary Distances

```
A_2(β, θ) =
    1 / cos(φ_2(β, θ) + α)
    · [ (p/2)·cos(α) − (R_hole + b)·sin(α) + R_hole·sin(φ_2(β, θ) + α) − R ]

A_1(β, θ) =
    1 / cos(φ_1(β, θ) + α)
    · [ (p/2)·cos(α) − R
        + A_2(β, θ)·cos(φ_2(β, θ) − α)
        − R_hole·sin(φ_2(β, θ) − α)
        − (R_hole + b)·sin(α) ]
```

### 7.3 Polynomial

```
polyβww(β, θ) =
      −R·sin(β)
    − A_1(β, θ) · cos(2·β − θ + φ_1(β, θ))
    + A_2(β, θ) · cos(2·β − θ − φ_2(β, θ))
    + R_hole · sin(2·β − θ − φ_2(β, θ))
    − (p/2) · cos(2·β − θ)
    − (R_hole + b) · sin(2·β − θ)
```

### 7.4 Solving

```
β_lww(θ) = root(polyβww(β, θ), β)
```

Initial guess: `β_ww = 75°`

### 7.5 Target Size

```
s_left_point_wall_wall(θ) = (p/2)·cos(θ) − R·sin(β_lww(θ))
```

### 7.6 Rail → Point → Two-Wall Rattle

```
d_point_wall_wall(θ) =
    1 / sin(45° − θ)
    · ( s_left_point_wall_wall(−θ_rail(θ)) + (p/2)·sin(θ) − R·cos(45° − θ) )

s_left_rail_point_wall_wall(θ) =
    (p/2)·cos(θ) + d_point_wall_wall(θ)·sin(45° − θ) − R·cos(45° − θ)
```

---

## 8. Critical Angles

Four critical angles partition the θ domain. These are found by solving for
the intersections between the different pocketing-mechanism curves.

### 8.1 θ_critical_C — Transition: Rail-Point-Wall ↔ Rail-Wall-Wall

Solve for θ in:

```
s_left_rail_point_wall(θ) = s_left_rail_wall_wall(θ)
```

For default parameters: **θ_critical_C ≈ 38.558°**.

### 8.2 θ_critical — Transition: Point-Wall ↔ Wall-Wall

```
θ_critical = θ_critical_C − 90°
```

For default parameters: **θ_critical ≈ −51.442°**.

Verification: at this angle, `s_left_point_wall` and `s_left_wall_wall`
should agree. Also, `θ − α + 90° − β_l ≈ 0` (to machine precision).

### 8.3 θ_critical_D — Transition: Rail-Wall-Wall ↔ Point-Wall-Wall (via rail)

Solve for θ in:

```
s_left_rail_wall_wall(θ) = s_left_point_wall_wall(θ)
```

For default parameters: **θ_critical_D ≈ 28.167°**.

At this angle, `d_wall_wall(θ_critical_D) = 0` (no rail distance needed),
confirming the transition.

### 8.4 θ_max_long — Maximum Rail-Deflection Angle

The rail-deflection distance cannot exceed the physical rail length. The
maximum usable rail distance is:

```
d_max(L) = L − p / cos(45°) − 2·R
```

The maximum angle is found by solving:

```
d_point_wall_wall(θ) = d_max_long
```

where `d_max_long = d_max(L)`. For default parameters (8-foot table):
**d_max_long ≈ 87.262 inches**, **θ_max_long ≈ 44.058°**.

### 8.5 Target Size at Maximum Angle

Beyond θ_max_long, the rail distance is clamped to d_max_long:

```
s_left_rail_max_angle(d_max, θ) =
    (p/2)·cos(θ) + d_max·sin(45° − θ) − R·cos(45° − θ)
```

---

## 9. Piecewise Target-Size Assembly

### 9.1 Left Target Size

```
s_left(θ) =
    s_left_rail_max_angle(d_max_long, θ)    if θ ≥ θ_max_long
    s_left_rail_point_wall(θ)                if θ_critical_C ≤ θ < θ_max_long
    s_left_rail_wall_wall(θ)                 if θ_critical_D ≤ θ < θ_critical_C
    s_left_point_wall_wall(θ)                otherwise
```

### 9.2 Right Target Size

The right side uses the **same piecewise structure** evaluated at `−θ`:

```
s_right(θ) =
    s_left_rail_max_angle(d_max_long, −θ)   if −θ ≥ θ_max_long
    s_left_rail_point_wall(−θ)               if θ_critical_C ≤ −θ < θ_max_long
    s_left_rail_wall_wall(−θ)                if θ_critical_D ≤ −θ < θ_critical_C
    s_left_point_wall_wall(−θ)               otherwise
```

### 9.3 Total Effective Target Size

```
s(θ) = s_left(θ) + s_right(θ)
```

### 9.4 Target Center Offset

```
offset(θ) = (s_right(θ) − s_left(θ)) / 2
```

---

## 10. Margin-of-Error Function

Same form as TP 3.5:

```
r(θ, Δθ) = s(θ) / (2·tan(Δθ))
```

---

## 11. Expected Outputs

For default parameters (8-foot table), the implementation should reproduce
these qualitative features from the plots in TP 3.6:

| θ (deg)  | s (approx, inches) | Notes                            |
|----------|---------------------|----------------------------------|
| 0        | ~1.5                | Local minimum (dip at center)    |
| ±30      | ~1.3                | Near the global minimum          |
| ±45      | ~3.0–3.5            | Near-rail angles, large target   |

The s(θ) curve has a distinctive shape: it dips in the middle (~1.3–1.5
inches near θ = 0° to ±30°) and rises sharply at both ends (near ±45°)
where rail deflection kicks in. This is qualitatively very different from
the side pocket's bell curve.

The offset curve is roughly antisymmetric with sharp features near
the critical angles.

---

## 12. Implementation Notes

1. **Shared code with side pocket:** The functions A, polyβ, polyβ_in, β_l,
   s_left_point_wall (= s_left_point in TP 3.5 terminology), r_wall, and
   s_left_wall are structurally identical to the side pocket model. Only
   the default parameter values differ. Factor these into a shared module.

2. **Recursive rattle equations:** The wall-wall and wall-wall-wall formulas
   are recursive — each layer feeds the previous layer's target size into
   the next. Implement them in order: s_left_wall → s_left_wall_wall →
   s_left_wall_wall_wall. (Note: s_left_wall_wall_wall is defined in TP 3.6
   but does not appear in the final piecewise assembly for default
   parameters. It may become active for different pocket geometries.)

3. **polyβww root-finding:** The point-with-two-wall-rattle polynomial
   (§7.3) involves auxiliary functions that depend on β themselves. Use a
   robust solver. The initial guess of 75° works for default parameters.

4. **Table size dependency:** Unlike the side pocket model, the corner pocket
   model depends on the table rail length L through d_max. This must be
   passed as a parameter.

5. **Precompute critical angles:** θ_critical_C, θ_critical, θ_critical_D,
   and θ_max_long should be computed once at initialization (or when pocket
   or table parameters change).

6. **Domain:** The function is defined for approximately −45° ≤ θ ≤ +45°.
   Unlike the side pocket (which goes to zero at the boundaries), the
   corner pocket target size remains nonzero up to the geometric limits
   because the rail-deflection mechanism extends the reach.

7. **Slow-shot assumption:** As with TP 3.5, this model does not account for
   high-speed rattles or ejection. TP 3.8 covers the fast-shot corner
   pocket case separately.

8. **The r_wall formula here consolidates differently than TP 3.5.** In TP 3.5,
   r_wall was split into r_wall_1 and r_wall_2 and s_left_wall included an
   extra negation pattern. In TP 3.6, r_wall is given as a single expression
   (with a `...` continuation on the second line) and s_left_wall uses the
   same negation pattern. Verify both formulations produce the same result
   for the same parameters.
