# Object Ball Throw Model

## Source

Based on TP A.14 ("The effects of cut angle, speed, and spin on object ball
throw") by David G. Alciatore, PhD, PE.
Original: <http://billiards.colostate.edu>, last revised 2025-05-19.

Prerequisite background: TP A.5 (90° rule), TP A.6 (30° rule), TP A.8
(sidespin effects), TP A.12 (spin rate factor), TP A.25 (sidespin ↔
percent english).

---

## 1. Overview

When the cue ball (CB) strikes the object ball (OB) at a cut angle, friction
between the balls during the collision deflects the OB away from the
"theoretical" cut-angle direction. This deflection is called **throw**. Throw
has two independent sources:

- **Collision-induced throw** — caused by the sliding friction at the contact
  point during an off-center hit (any nonzero cut angle).
- **Spin-induced throw** — caused by sidespin (english) on the CB, which
  creates additional tangential sliding at the contact point.

Both effects are captured by a single unified model. The model also accounts
for speed-dependent friction (slower shots throw more) and for
cling/skid/kick conditions (dirty balls throw more).

### Key Physical Assumptions

- Perfectly elastic collision (coefficient of restitution = 1).
- Equal-mass balls.
- Solid uniform spheres (moment of inertia = 2mR²/5).
- The relative sliding velocity between the balls cannot reverse direction
  during the collision (kinematics constraint).
- Friction coefficient is speed-dependent per the Marlow model (§3).

---

## 2. Coordinate System and Inputs

### 2.1 Coordinate Axes

The coordinate system is defined at the moment of CB-OB contact:

- **n̂** (normal): along the line connecting the ball centers, pointing from
  CB center to OB center. This is the direction of the impact force.
- **t̂** (tangential): perpendicular to n̂ in the plane of the table,
  pointing in the direction of the CB's tangential velocity component.
  Positive throw deflects the OB in the t̂ direction, which makes the
  shot play as though the ball were hit fuller (the undercut direction).
  This is because friction drags the OB toward the CB's path.
- **k̂** (vertical): upward, perpendicular to the table surface.

The cut angle **ϕ** relates these to the CB's incoming direction:
- n̂ components of CB velocity: `v·cos(ϕ)`
- t̂ components of CB velocity: `v·sin(ϕ)`

### 2.2 Input Variables

| Symbol | Description                            | Units   |
|--------|----------------------------------------|---------|
| v      | CB speed at impact                     | m/s     |
| ω_x    | CB spin about the x-axis (follow/draw) | rad/s   |
| ω_z    | CB sidespin about the vertical axis    | rad/s   |
| ϕ      | Cut angle (0 = straight-on, 90 = max)  | rad     |

### 2.3 Sign Conventions

- **ω_x > 0**: follow (topspin). ω_x = v/R for natural roll.
- **ω_x < 0**: draw (backspin).
- **ω_x = 0**: stun (no vertical-plane spin at contact).
- **ω_z > 0**: inside english (spin-induced throw adds to collision throw).
- **ω_z < 0**: outside english (spin-induced throw opposes collision throw).

### 2.4 Derived Quantities

Natural-roll spin rate:

```
ω_roll = v / R
```

Spin rate factor (SRF) and percent english (pE) relation (from TP A.12
and TP A.25):

```
ω_z = SRF · ω_roll = 1.25 · pE · (v / R)
```

where SRF = 1.25 · pE, and pE is the fraction of maximum sidespin
(−1 ≤ pE ≤ 1).

---

## 3. Speed-Dependent Friction Model

The coefficient of friction between the balls varies with the relative
sliding speed at the contact point. This is modeled using an exponential
fit to experimental data from Marlow (*The Physics of Pocket Billiards*,
1995, Table 10, p. 245).

### 3.1 Calibration Data

The Marlow data (with speeds scaled by sin(45°) to reflect his 45° cut
angle experiment):

| Point | v_d (m/s)        | μ_d   |
|-------|------------------|-------|
| 1     | 0.1·sin(45°)     | 0.11  |
| 2     | 1.0·sin(45°)     | 0.06  |
| 3     | 10.0·sin(45°)    | 0.01  |

### 3.2 Friction Model

```
μ(v) = a + b · exp(−c · v)
```

Fitted coefficients (from solving the 3-point system):

```
a = 9.951 × 10⁻³   ≈ 0.00995
b = 0.108
c = 1.088
```

This gives μ ≈ 0.06 at medium speed, rising to ~0.11 at very low speed
and decaying toward ~0.01 at high speed.

### 3.3 Note on the Friction Argument

The argument to `μ(·)` in the throw equations is the **relative sliding
speed** `v_rel` at the contact point (§4.1), not the CB speed directly. This
is the physically correct quantity — friction depends on how fast the
surfaces are sliding past each other.

---

## 4. Core Equations

The entire throw model reduces to two functions: `v_rel` and `θ_throw`.

### 4.1 Relative Sliding Speed

The magnitude of the relative sliding velocity at the CB-OB contact point:

```
v_rel(v, ω_x, ω_z, ϕ) = √( (v·sin(ϕ) − R·ω_z)² + (R·ω_x·cos(ϕ))² )
```

**Derivation context:** The velocity of the contact point B on the CB is
`v⃗_B = v⃗ + ω⃗ × r⃗_{B/O}`, where `r⃗_{B/O} = R·(−sin(ϕ)·î + cos(ϕ)·ĵ)`.
Expanding in tangential/normal/vertical components (Eq. 3 of TP A.14):

- Tangential component: `v_Bt = v·sin(ϕ) − R·ω_z`
- Normal component: `v_Bn = v·cos(ϕ)` (does not contribute to sliding)
- Vertical component: `v_Bz = R·ω_x·cos(ϕ)`

The relative sliding vector is `v⃗_rel = v_Bt · t̂ + v_Bz · k̂` (Eq. 4),
so `v_rel = √(v_Bt² + v_Bz²)`.

**Physical meaning of each term:**

- `v·sin(ϕ) − R·ω_z`: tangential sliding due to the cut angle, reduced (or
  increased) by sidespin. This is the component that produces in-table-plane
  throw.
- `R·ω_x·cos(ϕ)`: vertical sliding due to follow/draw spin. This does not
  directly create throw in the table plane, but it dilutes the friction
  budget available for tangential throw (because friction acts along the
  total sliding direction, not just its horizontal projection).

### 4.2 Throw Angle

```
θ_throw(v, ω_x, ω_z, ϕ) = atan( numerator / denominator )
```

where:

```
numerator:
    if v_rel(v, ω_x, ω_z, ϕ) = 0:
        0
    else:
        min(
            μ(v_rel(v, ω_x, ω_z, ϕ)) · v·cos(ϕ) / v_rel(v, ω_x, ω_z, ϕ),
            1/7
        ) · (v·sin(ϕ) − R·ω_z)

denominator:
    v·cos(ϕ)
```

**Explanation of the min(·, 1/7) term:**

This is the heart of the model. Two independent constraints limit how much
tangential impulse (and therefore throw) friction can impart:

1. **Friction limit** — the friction impulse cannot exceed μ times the normal
   impulse. This gives a contribution proportional to:
   `μ(v_rel) · v·cos(ϕ) · v_Bt / v_rel`
   (the normal impulse is `m·v·cos(ϕ)`, and the friction impulse is projected
   onto the tangential direction by the factor `v_Bt / v_rel`).

2. **Kinematics limit** — the relative sliding between the balls cannot
   reverse direction during impact. This yields a maximum tangential impulse
   of `(m/7)·(v·sin(ϕ) − R·ω_z)`, giving a ratio of `1/7`.

The `min` selects whichever constraint is more restrictive. At small cut
angles, the kinematics limit usually dominates (throw is independent of
speed). At larger cut angles, the friction limit dominates (slower = more
throw).

The factor `(v·sin(ϕ) − R·ω_z)` then converts the impulse ratio into the
actual tangential OB velocity. Dividing by `v·cos(ϕ)` (the normal OB
velocity) and taking arctan gives the throw angle.

### 4.3 Extended Model with Friction Multiplier (Cling/Skid/Kick)

For dirty or clingy ball conditions, a friction multiplier μ_m scales the
base friction coefficient:

```
θ_throw(v, ω_x, ω_z, ϕ, μ_m) = atan( numerator / denominator )
```

where the numerator becomes:

```
    if v_rel = 0:
        0
    else:
        min(
            μ_m · μ(v_rel) · v·cos(ϕ) / v_rel,
            1/7
        ) · (v·sin(ϕ) − R·ω_z)
```

Typical values for μ_m:

| Condition | μ_m |
|-----------|-----|
| Normal    | 1.0 |
| Dirty     | 1.5 |
| Cling     | 2.5 |

The kinematics limit (1/7) is unaffected by μ_m — it's a constraint on
the physics of the collision, not on friction. So at small cut angles,
cling has no additional effect; at large cut angles, it increases throw
substantially.

---

## 5. Constants and Typical Values

### 5.1 Physical Constants

| Symbol | Value            | Description                  |
|--------|------------------|------------------------------|
| R      | 0.02857 m        | Ball radius (1.125 in)       |
| μ_0    | 0.06             | Nominal ball-ball friction    |

### 5.2 Reference Speeds

| Label  | mph | m/s   |
|--------|-----|-------|
| slow   | 1   | 0.447 |
| medium | 3   | 1.341 |
| fast   | 7   | 3.129 |

### 5.3 Reference Spin States

| State         | ω_x         | ω_z | Description                |
|---------------|-------------|-----|----------------------------|
| Stun          | 0           | 0   | No spin at contact         |
| Natural roll  | v/R         | 0   | Pure rolling, no sidespin  |
| Half roll     | 0.5·v/R     | 0   | Partial follow             |
| Quarter roll  | 0.25·v/R    | 0   | Slight follow              |
| Full draw     | −v/R        | 0   | Full backspin              |

For sidespin, `ω_z = SRF · (v/R)` where SRF = 1.25 · pE.

### 5.4 Special Spin: Gearing Outside English

The sidespin rate that exactly cancels collision-induced throw at a given
cut angle (from TP A.12):

```
ω_gearing(ϕ) = v·sin(ϕ) / R
```

This makes `v·sin(ϕ) − R·ω_z = 0`, which zeroes the numerator of the throw
equation. With gearing outside english, there is **zero throw** at any cut
angle.

---

## 6. Expected Behavior (Validation Targets)

The implementation should reproduce the following qualitative behaviors from
the plots in TP A.14:

### 6.1 Collision-Induced Throw (no sidespin, natural roll)

- Throw increases with cut angle, leveling off at larger angles.
- Slower speed → more throw at all cut angles.
- Peak throw for slow natural roll: ~4–5° at large cut angles.
- Peak throw for fast natural roll: ~1° at large cut angles.

### 6.2 Collision-Induced Throw (stun, no sidespin)

- Throw peaks near 30° cut angle (half-ball hit).
- Slow stun at 30° cut: ~5–6° of throw.
- At small cut angles (< ~15°), throw is nearly speed-independent
  (kinematics limit dominates).
- At large cut angles, slow > medium > fast.

### 6.3 Spin-Induced Throw (straight-on, varying sidespin)

- Maximum spin-induced throw: ~4° for stun at medium sidespin.
- Follow reduces throw sensitivity to sidespin.
- Throw saturates — beyond a certain sidespin level, more spin does not
  increase throw (kinematics limit).

### 6.4 Gearing Outside English

- At any cut angle, `ω_z = v·sin(ϕ)/R` produces exactly zero throw.
- For outside english less than gearing, throw is reduced but not
  eliminated.
- For outside english greater than gearing, throw reverses direction.

### 6.5 Cling/Skid/Kick

- At small cut angles (< ~30°), throw is the same regardless of friction
  multiplier (kinematics-limited).
- At large cut angles, cling (μ_m = 2.5) can roughly double the throw
  compared to normal conditions.
- Maximum cling throw for slow stun: ~10° at 50–60° cut angle.

---

## 7. Implementation Notes

1. **Units:** The model is dimensionless in the sense that the throw angle
   depends on ratios like `ω_z·R/v` and `ω_x·R/v`, not on absolute values.
   However, the friction model `μ(v_rel)` takes an absolute speed in m/s.
   Be consistent: either work entirely in SI or convert v_rel to m/s before
   evaluating μ.

2. **The v_rel = 0 guard:** When `v·sin(ϕ) − R·ω_z = 0` AND `ω_x = 0` (or
   ϕ = 90°), there is no sliding and therefore no throw. The implementation
   must handle this to avoid division by zero.

3. **The 1/7 factor:** This comes from the kinematics of equal-mass solid
   spheres: 1/(1 + 1 + 5/2 + 5/2) = 1/7. If you later extend the model to
   unequal masses or different moments of inertia, this factor changes.

4. **Friction model is separable:** The exponential friction function μ(v)
   can be swapped out for a different model without changing the throw
   equations. The Marlow fit is one reasonable choice; others exist.

5. **This model gives the OB throw angle, not the OB's final direction.**
   The OB's actual direction after the collision is the cut-angle direction
   (perpendicular to the line of centers) **plus** the throw angle. In a
   simulator, apply throw as a correction to the OB's post-collision
   velocity vector.

6. **CB post-collision state is not computed here.** TP A.14 focuses on the
   OB throw angle. For the full CB post-collision velocity and spin, see
   TP A.5 and TP A.6.

7. **The model assumes instantaneous collision.** It does not model the
   time-evolution of friction during contact (as a finite-element or
   Hertzian model would). The min(friction, kinematics) approach is a
   well-validated simplification for billiard ball impacts.

8. **Follow/draw does not directly cause throw.** The ω_x term only appears
   inside v_rel. It affects throw indirectly by changing the friction budget
   allocation between the tangential and vertical sliding directions. More
   follow/draw → more of the available friction goes to vertical sliding →
   less available for tangential throw. This is why stun shots throw more
   than rolling shots near a half-ball hit.
