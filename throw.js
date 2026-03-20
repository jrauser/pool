// throw.js — Collision-Induced Throw Model (TP A-14)
// All angles in radians, speeds in m/s unless noted.

// ─── Constants ───────────────────────────────────────────────────────────────

export const BALL_RADIUS_M = 0.02857; // meters (1.125 inches)

// Marlow exponential friction fit coefficients (§3.2)
const FRICTION_A = 0.00995;
const FRICTION_B = 0.108;
const FRICTION_C = 1.088;

// Kinematics limit for equal-mass solid spheres: 1/(1+1+5/2+5/2) = 1/7
const KINEMATICS_LIMIT = 1 / 7;

// Reference shot speeds (§5.2)
export const SPEEDS = {
  slow:   { label: 'Slow (1 mph)',   mph: 1, mps: 0.447 },
  medium: { label: 'Medium (3 mph)', mph: 3, mps: 1.341 },
  fast:   { label: 'Fast (7 mph)',   mph: 7, mps: 3.129 },
};

// ─── Core functions ──────────────────────────────────────────────────────────

/**
 * Speed-dependent ball-ball friction coefficient (Marlow model, §3.2).
 *
 * @param {number} vRel - Relative sliding speed at contact point (m/s)
 * @returns {number} μ (dimensionless)
 */
export function frictionCoefficient(vRel) {
  return FRICTION_A + FRICTION_B * Math.exp(-FRICTION_C * vRel);
}

/**
 * Magnitude of the relative sliding velocity at the CB-OB contact point (§4.1).
 *
 * @param {number} v     - CB speed at impact (m/s)
 * @param {number} omegaX - CB follow/draw spin about x-axis (rad/s)
 * @param {number} phi   - Cut angle (radians)
 * @returns {number} v_rel (m/s)
 */
export function relativeSlideSpeed(v, omegaX, phi) {
  const tangential = v * Math.sin(phi); // ω_z = 0 for CIT-only
  const vertical = BALL_RADIUS_M * omegaX * Math.cos(phi);
  return Math.hypot(tangential, vertical);
}

/**
 * Collision-induced throw angle (§4.2).
 *
 * Positive throw deflects the OB in the "undercut" direction — toward the
 * CB's path, making the shot play as though the ball were hit fuller.
 *
 * @param {number} v      - CB speed at impact (m/s)
 * @param {number} omegaX - CB follow/draw spin (rad/s), v/R for natural roll
 * @param {number} phi    - Cut angle (radians, 0 = straight-on)
 * @returns {number} θ_throw (radians), ≥ 0 for positive cut angles
 */
export function throwAngle(v, omegaX, phi) {
  if (phi === 0) return 0;

  const vSinPhi = v * Math.sin(phi);
  const vCosPhi = v * Math.cos(phi);
  const vRel = relativeSlideSpeed(v, omegaX, phi);

  if (vRel === 0) return 0;

  // min(friction limit, kinematics limit) per §4.2
  const frictionRatio = frictionCoefficient(vRel) * vCosPhi / vRel;
  const ratio = Math.min(frictionRatio, KINEMATICS_LIMIT);

  // With ω_z = 0, the tangential term is just v·sin(φ)
  return Math.atan(ratio * vSinPhi / vCosPhi);
}

/**
 * Convenience: throw angle for natural roll (ω_x = v/R), no sidespin.
 *
 * @param {number} v   - CB speed at impact (m/s)
 * @param {number} phi - Cut angle (radians)
 * @returns {number} θ_throw (radians)
 */
export function throwAngleNaturalRoll(v, phi) {
  return throwAngle(v, v / BALL_RADIUS_M, phi);
}
