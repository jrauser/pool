// pocket_geometry.js — Corner pocket effective target size
// Based on TP 3.6 by David G. Alciatore
// All angles in radians, all lengths in inches.

// ─── Default Parameters ─────────────────────────────────────────────────────

const DEG = Math.PI / 180;

export const CORNER_POCKET_DEFAULTS = {
  R: 1.125,           // ball radius
  p: 4.5,             // pocket mouth width (our table)
  alpha: 7 * DEG,     // wall angle (facing angle)
  Rhole: 2.75,        // pocket hole radius
  b: 1.125,           // shelf depth to hole center
  L: 100,             // rail length nose-to-nose (9-foot table)
};

export const SIDE_POCKET_DEFAULTS = {
  R: 1.125,           // ball radius
  p: 5.0,             // pocket mouth width (our table, BCA 4⅞"–5⅝")
  alpha: 14 * DEG,    // wall angle
  Rhole: 3.0,         // pocket hole radius
  b: 0.1875,          // shelf depth to hole center
};

// ─── Root Finding ────────────────────────────────────────────────────────────

const ROOT_TOL = 1e-10;
const ROOT_MAX_ITER = 100;
const DERIV_H = 1e-8;

/**
 * Find a root of f(x) = 0 using Newton-Raphson with numerical derivative.
 * Falls back to bisection if Newton steps leave the bracket.
 */
export function findRoot(f, guess, lo = guess - 1, hi = guess + 1) {
  // First try Newton-Raphson
  let x = guess;
  for (let i = 0; i < ROOT_MAX_ITER; i++) {
    const fx = f(x);
    if (Math.abs(fx) < ROOT_TOL) return x;
    const dfx = (f(x + DERIV_H) - f(x - DERIV_H)) / (2 * DERIV_H);
    if (Math.abs(dfx) < 1e-15) break; // zero derivative, fall back
    const step = fx / dfx;
    const xNew = x - step;
    if (xNew < lo || xNew > hi) break; // out of bracket, fall back
    x = xNew;
  }

  // Bisection fallback
  let fLo = f(lo);
  for (let i = 0; i < ROOT_MAX_ITER; i++) {
    const mid = (lo + hi) / 2;
    if (hi - lo < ROOT_TOL) return mid;
    const fMid = f(mid);
    if (Math.abs(fMid) < ROOT_TOL) return mid;
    if (fLo * fMid < 0) {
      hi = mid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}

// ─── Shared Equations (TP 3.5 §3) ───────────────────────────────────────────

/** Auxiliary function A (§3.1) */
export function auxiliaryA(params, betaL, theta) {
  const { p, alpha, Rhole, b, R } = params;
  const angle = 2 * betaL - theta - alpha;
  return (1 / Math.sin(angle)) *
    ((p / 2) * Math.cos(alpha) - R - Rhole * Math.cos(angle) - (Rhole + b) * Math.sin(alpha));
}

/** Point-deflection polynomial (§3.2) — find root in β for given θ */
export function polyBeta(params, betaL, theta) {
  const { p, alpha, Rhole, b, R } = params;
  const A = auxiliaryA(params, betaL, theta);
  const angle1 = 4 * betaL - 2 * theta - 2 * alpha;
  const angle2 = 2 * betaL - theta;
  return R * Math.sin(betaL) +
    A * Math.sin(angle1) +
    Rhole * Math.cos(angle1) +
    (p / 2) * Math.cos(angle2) +
    (Rhole + b) * Math.sin(angle2);
}

/** Inside-wall polynomial (§3.3) */
export function polyBetaIn(params, betaL, theta) {
  const { p, Rhole, b, R } = params;
  const angle = 2 * betaL - theta;
  return -R * Math.sin(betaL) +
    Rhole -
    (p / 2) * Math.cos(angle) -
    (Rhole + b) * Math.sin(angle);
}

/** Solve for β_l: min of roots from polyβ and polyβ_in (§3.4) */
export function solveBetaL(params, theta) {
  const guessRad = 20 * DEG + (70 / 130) * (theta + 60 * DEG);
  const lo = 0;
  const hi = Math.PI / 2;

  const root1 = findRoot(beta => polyBeta(params, beta, theta), guessRad, lo, hi);
  const root2 = findRoot(beta => polyBetaIn(params, beta, theta), guessRad, lo, hi);
  return Math.min(root1, root2);
}

/** Left target size — point deflection (§3.5) */
export function sLeftPointWall(params, theta) {
  const betaL = solveBetaL(params, theta);
  return (params.p / 2) * Math.cos(theta) - params.R * Math.sin(betaL);
}

/** One-wall deflection: r_wall (§3.6) */
export function rWall(params, theta) {
  const { p, alpha, Rhole, b } = params;
  const A = auxiliaryA(params, Math.PI / 2, theta);
  return A * Math.sin(2 * theta + 2 * alpha) -
    Rhole * Math.cos(2 * theta + 2 * alpha) +
    (p / 2) * Math.cos(theta) -
    (Rhole + b) * Math.sin(theta);
}

/** Left target size — wall deflection (§3.6) */
export function sLeftWall(params, theta) {
  return -((params.p / 2) * Math.cos(-theta) - rWall(params, -theta));
}

// ─── Angle Transformations (§4) ─────────────────────────────────────────────

/** After rail contact (§4.1) */
export function thetaRail(theta) {
  return Math.PI / 2 - theta;
}

/** After wall contact (§4.2) */
export function thetaWallTransform(theta, alpha) {
  return theta - 2 * alpha;
}

// ─── Multi-Wall Rattle (§5) ─────────────────────────────────────────────────

/** Two-wall rattle distance D (§5.1) */
export function dWallWall(params, theta) {
  const { p, alpha, R } = params;
  const thetaW = thetaWallTransform(theta, alpha);
  return (1 / Math.sin(theta - alpha)) *
    ((p / 2) * Math.cos(theta - 2 * alpha) - R * Math.cos(theta - alpha) +
      sLeftWall(params, thetaW));
}

/** Two-wall rattle target size (§5.1) */
export function sLeftWallWall(params, theta) {
  const { p, alpha, R } = params;
  return (p / 2) * Math.cos(theta) +
    dWallWall(params, theta) * Math.sin(theta - alpha) -
    R * Math.cos(theta - alpha);
}

/** Three-wall rattle distance D (§5.2) */
export function dWallWallWall(params, theta) {
  const { p, alpha, R } = params;
  const thetaW = thetaWallTransform(theta, alpha);
  return (1 / Math.sin(theta - alpha)) *
    ((p / 2) * Math.cos(theta - 2 * alpha) - R * Math.cos(theta - alpha) +
      sLeftWallWall(params, thetaW));
}

/** Three-wall rattle target size (§5.2) */
export function sLeftWallWallWall(params, theta) {
  const { p, alpha, R } = params;
  return (p / 2) * Math.cos(theta) +
    dWallWallWall(params, theta) * Math.sin(theta - alpha) -
    R * Math.cos(theta - alpha);
}

// ─── Rail-Deflection Equations (§6) ─────────────────────────────────────────

const PI_4 = Math.PI / 4; // 45°

/** Rail → Point → Wall (§6.1) */
export function sLeftRailPointWall(params, theta) {
  const thetaR = thetaRail(theta);
  const sInner = sLeftPointWall(params, -thetaR);
  const sinArg = PI_4 - theta;
  const d = (1 / Math.sin(sinArg)) *
    (sInner + (params.p / 2) * Math.sin(theta) - params.R * Math.cos(sinArg));
  return (params.p / 2) * Math.cos(theta) + d * Math.sin(sinArg) - params.R * Math.cos(sinArg);
}

/** Rail → Wall → Wall (§6.2) */
export function sLeftRailWallWall(params, theta) {
  const thetaR = thetaRail(theta);
  const sInner = sLeftWallWall(params, -thetaR);
  const sinArg = PI_4 - theta;
  const d = (1 / Math.sin(sinArg)) *
    (sInner + (params.p / 2) * Math.sin(theta) - params.R * Math.cos(sinArg));
  return (params.p / 2) * Math.cos(theta) + d * Math.sin(sinArg) - params.R * Math.cos(sinArg);
}

/** Rail → Wall (§6.3) — defined in spec but not used in final assembly */
export function sLeftRailWall(params, theta) {
  const thetaR = thetaRail(theta);
  const sInner = sLeftWall(params, -thetaR);
  const sinArg = PI_4 - theta;
  const d = (1 / Math.sin(sinArg)) *
    (sInner + (params.p / 2) * Math.sin(theta) - params.R * Math.cos(sinArg));
  return (params.p / 2) * Math.cos(theta) + d * Math.sin(sinArg) - params.R * Math.cos(sinArg);
}

// ─── Point Deflection with Two-Wall Rattle (§7) ─────────────────────────────

/** Auxiliary angles φ_1 and φ_2 (§7.1) */
function phi1(beta, theta, alpha) {
  return 2 * beta - Math.PI / 2 - theta - 2 * alpha;
}

function phi2(beta, theta, alpha) {
  return phi1(beta, theta, alpha) - 2 * alpha;
}

/** Auxiliary distance A_2 (§7.2) */
function auxA2(params, beta, theta) {
  const { p, alpha, Rhole, b, R } = params;
  const p2 = phi2(beta, theta, alpha);
  return (1 / Math.cos(p2 + alpha)) *
    ((p / 2) * Math.cos(alpha) - (Rhole + b) * Math.sin(alpha) +
      Rhole * Math.sin(p2 + alpha) - R);
}

/** Auxiliary distance A_1 (§7.2) */
function auxA1(params, beta, theta) {
  const { p, alpha, Rhole, b, R } = params;
  const p1 = phi1(beta, theta, alpha);
  const p2 = phi2(beta, theta, alpha);
  const a2 = auxA2(params, beta, theta);
  return (1 / Math.cos(p1 + alpha)) *
    ((p / 2) * Math.cos(alpha) - R +
      a2 * Math.cos(p2 - alpha) -
      Rhole * Math.sin(p2 - alpha) -
      (Rhole + b) * Math.sin(alpha));
}

/** polyβww polynomial (§7.3) */
export function polyBetaWW(params, beta, theta) {
  const { p, alpha, Rhole, b, R } = params;
  const p1 = phi1(beta, theta, alpha);
  const p2 = phi2(beta, theta, alpha);
  const a1 = auxA1(params, beta, theta);
  const a2 = auxA2(params, beta, theta);
  const twoB = 2 * beta - theta;
  return -R * Math.sin(beta) -
    a1 * Math.cos(twoB + p1) +
    a2 * Math.cos(twoB - p2) +
    Rhole * Math.sin(twoB - p2) -
    (p / 2) * Math.cos(twoB) -
    (Rhole + b) * Math.sin(twoB);
}

/** Solve for β_lww (§7.4) */
export function solveBetaLWW(params, theta) {
  const guess = 75 * DEG;
  return findRoot(beta => polyBetaWW(params, beta, theta), guess, 30 * DEG, 89 * DEG);
}

/** Point deflection + two-wall rattle target size (§7.5) */
export function sLeftPointWallWall(params, theta) {
  const betaLWW = solveBetaLWW(params, theta);
  return (params.p / 2) * Math.cos(theta) - params.R * Math.sin(betaLWW);
}

/** Rail-deflection distance for point-wall-wall path (§7.6) */
export function dPointWallWall(params, theta) {
  const thetaR = thetaRail(theta);
  const sInner = sLeftPointWallWall(params, -thetaR);
  const sinArg = PI_4 - theta;
  return (1 / Math.sin(sinArg)) *
    (sInner + (params.p / 2) * Math.sin(theta) - params.R * Math.cos(sinArg));
}

/** Rail → Point → Two-Wall Rattle target size (§7.6) */
export function sLeftRailPointWallWall(params, theta) {
  const d = dPointWallWall(params, theta);
  const sinArg = PI_4 - theta;
  return (params.p / 2) * Math.cos(theta) + d * Math.sin(sinArg) - params.R * Math.cos(sinArg);
}

// ─── Target Size at Maximum Angle (§8.5) ────────────────────────────────────

/** Target size when rail distance is clamped to dMax */
export function sLeftRailMaxAngle(params, dMax, theta) {
  const sinArg = PI_4 - theta;
  return (params.p / 2) * Math.cos(theta) + dMax * Math.sin(sinArg) - params.R * Math.cos(sinArg);
}

// ─── Critical Angles (§8) ───────────────────────────────────────────────────

/**
 * Compute the four critical angles and dMax for a given set of parameters.
 * These partition the θ domain into piecewise regions.
 */
export function computeCriticalAngles(params) {
  const { p, L } = params;

  // d_max: maximum usable rail distance (§8.4)
  const dMax = L - p / Math.cos(PI_4) - 2 * params.R;

  // θ_critical_C: where s_left_rail_point_wall = s_left_rail_wall_wall (§8.1)
  const thetaCriticalC = findRoot(
    theta => sLeftRailPointWall(params, theta) - sLeftRailWallWall(params, theta),
    38 * DEG,
    20 * DEG,
    44 * DEG
  );

  // θ_critical = θ_critical_C − 90° (§8.2)
  const thetaCritical = thetaCriticalC - Math.PI / 2;

  // θ_critical_D: where s_left_rail_wall_wall = s_left_point_wall_wall (§8.3)
  const thetaCriticalD = findRoot(
    theta => sLeftRailWallWall(params, theta) - sLeftPointWallWall(params, theta),
    28 * DEG,
    15 * DEG,
    40 * DEG
  );

  // θ_max_long: where d_point_wall_wall = dMax (§8.4)
  const thetaMaxLong = findRoot(
    theta => dPointWallWall(params, theta) - dMax,
    44 * DEG,
    40 * DEG,
    45 * DEG
  );

  return { dMax, thetaCriticalC, thetaCritical, thetaCriticalD, thetaMaxLong };
}

// ─── Piecewise Assembly (§9) ────────────────────────────────────────────────

/**
 * Create a corner pocket target size calculator for the given parameters.
 * Returns a function θ → { s, offset, sLeft, sRight }.
 *
 * Critical angles are precomputed once.
 */
export function createCornerPocketCalculator(params = CORNER_POCKET_DEFAULTS) {
  const merged = { ...CORNER_POCKET_DEFAULTS, ...params };
  const { dMax, thetaCriticalC, thetaCritical, thetaCriticalD, thetaMaxLong } =
    computeCriticalAngles(merged);

  /** Evaluate s_left for a single side (§9.1), clamped to non-negative. */
  function sLeft(theta) {
    let val;
    if (theta >= thetaMaxLong) {
      val = sLeftRailMaxAngle(merged, dMax, theta);
    } else if (theta >= thetaCriticalC) {
      val = sLeftRailPointWall(merged, theta);
    } else if (theta >= thetaCriticalD) {
      val = sLeftRailWallWall(merged, theta);
    } else {
      val = sLeftPointWallWall(merged, theta);
    }
    // The model is only valid for |θ| ≲ 45°; clamp to zero beyond that.
    return Math.max(0, val);
  }

  /**
   * Compute the effective target size for approach angle θ.
   * @param {number} theta - approach angle in radians (0 = pocket centerline)
   * @returns {{ s: number, offset: number, sLeft: number, sRight: number }}
   */
  return function cornerTargetSize(theta) {
    const sL = sLeft(theta);
    const sR = sLeft(-theta); // §9.2: s_right(θ) = s_left(−θ)
    const s = sL + sR;
    const offset = (sR - sL) / 2;
    return { s, offset, sLeft: sL, sRight: sR };
  };
}

// ─── Side Pocket (TP 3.5) ─────────────────────────────────────────────────────

/**
 * Compute critical angles for the side pocket model (TP 3.5 §4).
 *
 * θ_max: maximum angle where point deflection is possible (β_l = 90°).
 * θ_critical: transition between point deflection and wall deflection.
 * θ_min = −θ_max (by symmetry).
 */
export function computeSideCriticalAngles(params) {
  // θ_max: solve polyBeta(params, 90°, θ) = 0 for θ (§4.1)
  const thetaMax = findRoot(
    theta => polyBeta(params, Math.PI / 2, theta),
    60 * DEG,
    30 * DEG,
    85 * DEG
  );

  // θ_critical: where β_l + α − 90° = θ (§4.2)
  // Equivalently, solve polyBetaIn at the θ where θ = β − 90° + α.
  // Use iteration: guess θ, solve for β via polyBetaIn, check θ = β + α − 90°.
  const thetaCritical = findRoot(
    theta => {
      const beta = findRoot(
        b => polyBetaIn(params, b, theta),
        45 * DEG, 0, Math.PI / 2
      );
      return theta - (beta + params.alpha - Math.PI / 2);
    },
    -50 * DEG,
    -80 * DEG,
    0
  );

  return { thetaMax, thetaCritical, thetaMin: -thetaMax };
}

/**
 * Create a side pocket target size calculator for the given parameters.
 * Returns a function θ → { s, offset, sLeft, sRight }.
 *
 * The side pocket model (TP 3.5) uses only point deflection and wall
 * deflection — no rail bounces or multi-wall rattles.
 */
export function createSidePocketCalculator(params = SIDE_POCKET_DEFAULTS) {
  const merged = { ...SIDE_POCKET_DEFAULTS, ...params };
  const { thetaMax, thetaCritical, thetaMin } = computeSideCriticalAngles(merged);

  function sLeft(theta) {
    if (theta >= thetaMax || theta <= thetaMin) return 0;
    if (theta < thetaCritical) {
      return Math.max(0, sLeftWall(merged, theta));
    }
    return Math.max(0, sLeftPointWall(merged, theta));
  }

  return function sideTargetSize(theta) {
    const sL = sLeft(theta);
    const sR = sLeft(-theta);
    const s = sL + sR;
    const offset = (sR - sL) / 2;
    return { s, offset, sLeft: sL, sRight: sR };
  };
}
