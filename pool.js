// pool.js — Pool Shot Margin Visualizer
// All angles are in radians internally; degrees only for display.

import { createCornerPocketCalculator, createSidePocketCalculator } from './pocket_geometry.js';
import { throwAngleNaturalRoll, SPEEDS } from './throw.js';

// ─── Constants ───────────────────────────────────────────────────────────────

export const BALL_RADIUS = 1.125; // inches
export const TABLE_WIDTH = 100;   // inches
export const TABLE_HEIGHT = 50;   // inches
export const TABLE_CORNER = [TABLE_WIDTH, TABLE_HEIGHT]; // upper-right table corner
export const POCKET_MOUTH_WIDTH = 4.5;  // inches, BCA standard
// At a 45° corner, each rail ends this far from the corner to give a 4.5" mouth
const POCKET_SHELF = POCKET_MOUTH_WIDTH / Math.SQRT2;
// The two points where the cushions end — the edges of the pocket mouth
export const POCKET_RAIL_END_TOP   = [TABLE_CORNER[0] - POCKET_SHELF, TABLE_CORNER[1]];
export const POCKET_RAIL_END_RIGHT = [TABLE_CORNER[0], TABLE_CORNER[1] - POCKET_SHELF];
// BCA spec: interior angle between rail and pocket facing = 142°
export const POCKET_FACING_ANGLE = 142 * Math.PI / 180;
// Center of the pocket mouth — the aim point for all geometry calculations
export const POCKET_POS = [
  (POCKET_RAIL_END_TOP[0] + POCKET_RAIL_END_RIGHT[0]) / 2,
  (POCKET_RAIL_END_TOP[1] + POCKET_RAIL_END_RIGHT[1]) / 2,
];

// ─── Side pocket geometry ────────────────────────────────────────────────────

export const SIDE_POCKET_MOUTH_WIDTH = 5.0;  // inches, BCA standard
export const SIDE_POCKET_FACING_ANGLE = 103 * Math.PI / 180;  // BCA spec
// Position: center of top rail
export const SIDE_POCKET_POS = [TABLE_WIDTH / 2, TABLE_HEIGHT];
// Rail ends: half the mouth width in each direction along the top rail
const SIDE_POCKET_HALF_MOUTH = SIDE_POCKET_MOUTH_WIDTH / 2;
export const SIDE_POCKET_RAIL_END_LEFT  = [TABLE_WIDTH / 2 - SIDE_POCKET_HALF_MOUTH, TABLE_HEIGHT];
export const SIDE_POCKET_RAIL_END_RIGHT = [TABLE_WIDTH / 2 + SIDE_POCKET_HALF_MOUTH, TABLE_HEIGHT];

// Default ball positions (inches, origin lower-left)
export const DEFAULT_OBJECT_BALL = [70, 25];
export const DEFAULT_CUE_BALL = [45, 15];

// ─── Math utilities ───────────────────────────────────────────────────────────

/**
 * Abramowitz & Stegun 7.1.26 rational approximation for erf.
 * Max error ≈ 1.5e-7.
 *
 * @param {number} x
 * @returns {number}
 */
export function erfApprox(x) {
  if (x === 0) return 0;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const poly =
    t *
    (0.254829592 +
      t *
        (-0.284496736 +
          t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  return sign * (1 - poly * Math.exp(-ax * ax));
}

/**
 * Compute the angular error in the object ball's direction given an execution
 * error in the shooter's aim.
 *
 * Formula (from TP_3-4.pdf):
 *   Δθ(d, φ, Δφ) = φ − Δφ + arcsin( (d / 2R)·sin(Δφ) − sin(φ − Δφ) )
 *
 * @param {number} d       - Distance between ball centers (inches)
 * @param {number} phi     - Cut angle (radians)
 * @param {number} deltaPhi - Execution error (radians)
 * @returns {number|null}  - Δθ in radians, or null if arcsin argument is out of [-1,1]
 */
export function deltaTheta(d, phi, deltaPhi) {
  const arg = (d / (2 * BALL_RADIUS)) * Math.sin(deltaPhi) - Math.sin(phi - deltaPhi);
  if (arg < -1 || arg > 1) return null;
  return phi - deltaPhi + Math.asin(arg);
}

/**
 * Compute the cut angle φ: the angle between the cue-ball-to-object-ball
 * direction and the cue-ball-to-ghost-ball direction.
 *
 * The ghost ball G sits at O + 2R * normalize(O - pocket), i.e., opposite the
 * object ball's intended travel direction.
 *
 * @param {[number,number]} cuePos    - [x, y] cue ball (inches)
 * @param {[number,number]} objPos    - [x, y] object ball (inches)
 * @param {[number,number]} pocketPos - [x, y] pocket (inches)
 * @returns {number} - φ in radians
 */
export function cutAngle(cuePos, objPos, pocketPos) {
  // Vector from object ball to pocket
  const opx = pocketPos[0] - objPos[0];
  const opy = pocketPos[1] - objPos[1];
  const opLen = Math.hypot(opx, opy);

  // Ghost ball position: O - 2R * normalize(pocket - O)
  const gx = objPos[0] - (2 * BALL_RADIUS * opx) / opLen;
  const gy = objPos[1] - (2 * BALL_RADIUS * opy) / opLen;

  // Cut angle = angle at ghost ball between aim line (C→G) and line of centers (G→O)
  // For a straight-in shot these are parallel → φ = 0.
  const cgx = gx - cuePos[0];
  const cgy = gy - cuePos[1];
  const gox = objPos[0] - gx;
  const goy = objPos[1] - gy;

  const cgLen = Math.hypot(cgx, cgy);
  const goLen = Math.hypot(gox, goy); // = 2R

  const dot = cgx * gox + cgy * goy;
  const cosPhi = dot / (cgLen * goLen);

  // Clamp to [-1,1] to guard against floating-point drift
  return Math.acos(Math.min(1, Math.max(-1, cosPhi)));
}

/**
 * Compute the approach angle θ for a corner pocket.
 * θ is measured from the pocket centerline (the 45° bisector of the corner).
 * θ = 0 means straight into the pocket along the diagonal.
 * θ > 0 means approach from the long-rail side.
 * θ < 0 means approach from the short-rail side.
 *
 * @param {[number,number]} objPos    - [x, y] object ball (inches)
 * @param {[number,number]} pocketPos - [x, y] pocket (inches)
 * @returns {number} - θ in radians
 */
export function approachAngle(objPos, pocketPos) {
  const dx = pocketPos[0] - objPos[0];
  const dy = pocketPos[1] - objPos[1];
  // Direction from object ball to pocket in table coords (y up)
  const angle = Math.atan2(dy, dx);
  // Pocket centerline is at 45° (π/4) for upper-right corner
  // Subtract to get θ relative to centerline
  return angle - Math.PI / 4;
}

/**
 * Compute the approach angle θ for a side pocket on the top rail.
 * θ is measured from the perpendicular to the rail (straight into the pocket).
 * θ = 0 means the ball approaches perpendicular to the rail.
 * θ > 0 means approach from the left.
 * θ < 0 means approach from the right.
 *
 * @param {[number,number]} objPos    - [x, y] object ball (inches)
 * @param {[number,number]} pocketPos - [x, y] pocket (inches)
 * @returns {number} - θ in radians
 */
export function approachAngleSide(objPos, pocketPos) {
  const dx = pocketPos[0] - objPos[0];
  const dy = pocketPos[1] - objPos[1];
  const angle = Math.atan2(dy, dx);
  // Perpendicular to top rail (straight up) is π/2
  return angle - Math.PI / 2;
}

// Corner pocket target size calculator (precomputed critical angles)
const cornerCalc = createCornerPocketCalculator({
  R: BALL_RADIUS,
  p: POCKET_MOUTH_WIDTH,
  L: TABLE_WIDTH,
});

// Side pocket target size calculator (precomputed critical angles)
const sideCalc = createSidePocketCalculator({
  R: BALL_RADIUS,
  p: SIDE_POCKET_MOUTH_WIDTH,
});

/**
 * Angular pocket tolerance: the half-angle subtended by the effective pocket
 * opening from the object ball, using the dynamic target size model.
 *
 * @param {[number,number]} objPos    - [x, y] object ball (inches)
 * @param {[number,number]} pocketPos - [x, y] pocket (inches)
 * @param {'corner'|'side'} pocketType - pocket type (default: 'corner')
 * @returns {{ alpha: number, targetSize: number, offset: number }}
 */
export function pocketTolerance(objPos, pocketPos, pocketType = 'corner') {
  const dop = Math.hypot(pocketPos[0] - objPos[0], pocketPos[1] - objPos[1]);
  const theta = pocketType === 'corner'
    ? approachAngle(objPos, pocketPos)
    : approachAngleSide(objPos, pocketPos);
  const { s, offset } = pocketType === 'corner'
    ? cornerCalc(theta)
    : sideCalc(theta);
  const alpha = Math.atan((s / 2) / dop);
  return { alpha, targetSize: s, offset };
}

/**
 * Find the largest Δφ such that deltaTheta(d, phi, Δφ) is still defined
 * (argsin argument in [-1,1]). Returns that domain boundary.
 *
 * @param {number} d   - Shot distance (inches)
 * @param {number} phi - Cut angle (radians)
 * @returns {number}   - Domain boundary of deltaPhi in radians
 */
function findDeltaPhiDomainMax(d, phi) {
  const ITERS = 60;
  let lo = 0;
  let hi = Math.PI / 2;
  // deltaTheta is defined at 0, may become null at some point
  if (deltaTheta(d, phi, hi) !== null) return hi; // entire range valid
  for (let i = 0; i < ITERS; i++) {
    const mid = (lo + hi) / 2;
    if (deltaTheta(d, phi, mid) !== null) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return lo;
}

/**
 * Find Δφ_max by bisection such that deltaTheta(d, phi, Δφ_max) = alpha.
 * If the entire valid domain results in |Δθ| ≤ alpha, returns the domain
 * boundary (any executable shot makes it).
 *
 * @param {number} d     - Shot distance (inches)
 * @param {number} phi   - Cut angle (radians)
 * @param {number} alpha - Pocket tolerance (radians)
 * @returns {number}     - Δφ_max in radians
 */
function findDeltaPhiMax(d, phi, alpha) {
  const ITERS = 60;
  const domainMax = findDeltaPhiDomainMax(d, phi);

  // Check if the worst valid execution error is still within pocket tolerance
  const dtAtDomainMax = deltaTheta(d, phi, domainMax);
  if (dtAtDomainMax === null || Math.abs(dtAtDomainMax) <= alpha) {
    // Entire valid domain is makeable — return domain boundary
    return domainMax;
  }

  // Standard bisection: find Δφ ∈ [0, domainMax] where |Δθ| = alpha
  let lo = 0;
  let hi = domainMax;
  for (let i = 0; i < ITERS; i++) {
    const mid = (lo + hi) / 2;
    const dt = deltaTheta(d, phi, mid);
    if (dt === null || Math.abs(dt) > alpha) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return lo;
}

/**
 * Probability of making the shot (no throw offset — symmetric case).
 *
 * @param {number} d     - Shot distance (inches)
 * @param {number} phi   - Cut angle (radians)
 * @param {number} alpha - Pocket tolerance (radians)
 * @param {number} sigma - Standard deviation of execution error (radians)
 * @returns {number} - Probability in [0, 1]
 */
export function makeProbability(d, phi, alpha, sigma) {
  if (sigma <= 0) return 1;
  const deltaPhiMax = findDeltaPhiMax(d, phi, alpha);
  return erfApprox(deltaPhiMax / (sigma * Math.SQRT2));
}

/**
 * Normal CDF: Φ(x) = (1 + erf(x/√2)) / 2
 *
 * @param {number} x
 * @returns {number}
 */
export function normalCDF(x) {
  return (1 + erfApprox(x / Math.SQRT2)) / 2;
}

/**
 * Find the Δφ where Δθ(Δφ) = target, using bisection over [lo, hi].
 * Returns null if Δθ never reaches target within the interval.
 *
 * @param {number} d      - Shot distance (inches)
 * @param {number} phi    - Cut angle (radians)
 * @param {number} target - Target Δθ value (radians)
 * @param {number} lo     - Lower bound of search (radians)
 * @param {number} hi     - Upper bound of search (radians)
 * @returns {number|null} - Δφ where Δθ ≈ target, or null
 */
function bisectDeltaPhi(d, phi, target, lo, hi) {
  const ITERS = 60;
  const dtLo = deltaTheta(d, phi, lo);
  const dtHi = deltaTheta(d, phi, hi);
  if (dtLo === null || dtHi === null) return null;
  // Check target is between dtLo and dtHi
  if ((dtLo - target) * (dtHi - target) > 0) return null;
  for (let i = 0; i < ITERS; i++) {
    const mid = (lo + hi) / 2;
    const dt = deltaTheta(d, phi, mid);
    if (dt === null) { hi = mid; continue; }
    if ((dt - target) * (dtLo - target) <= 0) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return (lo + hi) / 2;
}

/**
 * Find the most negative Δφ such that deltaTheta(d, phi, Δφ) is defined.
 *
 * @param {number} d   - Shot distance (inches)
 * @param {number} phi - Cut angle (radians)
 * @returns {number}   - Negative domain boundary of deltaPhi in radians
 */
function findDeltaPhiDomainMin(d, phi) {
  const ITERS = 60;
  let lo = -Math.PI / 2;
  let hi = 0;
  if (deltaTheta(d, phi, lo) !== null) return lo;
  for (let i = 0; i < ITERS; i++) {
    const mid = (lo + hi) / 2;
    if (deltaTheta(d, phi, mid) !== null) {
      hi = mid; // mid is valid, try more negative
    } else {
      lo = mid; // mid is invalid, try less negative
    }
  }
  // hi is the most negative valid value
  return hi;
}

/**
 * Probability of making the shot with a throw offset.
 *
 * The OB direction error is Δθ(Δφ) + throwOffset. The shot is made when
 * this falls within [-alpha, alpha]. Since Δθ is monotonic in Δφ, the
 * makeable Δφ interval is contiguous. We find its boundaries by bisecting
 * for the two Δθ targets: alpha - throwOffset and -alpha - throwOffset.
 *
 * @param {number} d           - Shot distance (inches)
 * @param {number} phi         - Cut angle (radians)
 * @param {number} alpha       - Pocket tolerance (radians)
 * @param {number} sigma       - Standard deviation of execution error (radians)
 * @param {number} throwOffset - Throw angle offset (radians, positive = overcut)
 * @returns {number} - Probability in [0, 1]
 */
export function makeProbabilityWithThrow(d, phi, alpha, sigma, throwOffset) {
  if (sigma <= 0) {
    return Math.abs(throwOffset) <= alpha ? 1 : 0;
  }
  if (Math.abs(throwOffset) < 1e-12) {
    return makeProbability(d, phi, alpha, sigma);
  }

  // The makeable condition is -alpha ≤ Δθ(Δφ) + throwOffset ≤ alpha,
  // i.e., Δθ(Δφ) ∈ [-alpha - throwOffset, alpha - throwOffset].
  const dtUpper = alpha - throwOffset;
  const dtLower = -alpha - throwOffset;

  // Domain of Δφ where deltaTheta is defined
  const domainMin = findDeltaPhiDomainMin(d, phi);
  const domainMax = findDeltaPhiDomainMax(d, phi);

  // Δθ at domain boundaries
  const dtAtMin = deltaTheta(d, phi, domainMin);
  const dtAtMax = deltaTheta(d, phi, domainMax);
  if (dtAtMin === null || dtAtMax === null) {
    // Shouldn't happen, but guard
    return 0;
  }

  // Find Δφ where Δθ = dtUpper (the "overcut" boundary)
  let phiHi;
  if (dtAtMax <= dtUpper) {
    phiHi = domainMax; // entire upper domain is within tolerance
  } else if (dtAtMin >= dtUpper) {
    return 0; // Δθ always exceeds upper bound
  } else {
    phiHi = bisectDeltaPhi(d, phi, dtUpper, domainMin, domainMax);
    if (phiHi === null) return 0;
  }

  // Find Δφ where Δθ = dtLower (the "undercut" boundary)
  let phiLo;
  if (dtAtMin >= dtLower) {
    phiLo = domainMin; // entire lower domain is within tolerance
  } else if (dtAtMax <= dtLower) {
    return 0; // Δθ always below lower bound
  } else {
    phiLo = bisectDeltaPhi(d, phi, dtLower, domainMin, domainMax);
    if (phiLo === null) return 0;
  }

  if (phiHi < phiLo) return 0;

  return normalCDF(phiHi / sigma) - normalCDF(phiLo / sigma);
}

// 5-point Gauss-Hermite quadrature nodes and weights for ∫f(x)exp(-x²)dx.
// Symmetric: nodes[0]=0, nodes[±1]≈±0.9586, nodes[±2]≈±2.0202.
const GH_NODES = [0, 0.9585724646138185, -0.9585724646138185, 2.0201828704560856, -2.0201828704560856];
const GH_WEIGHTS = [0.9453087204829419, 0.3936193231522412, 0.3936193231522412, 0.01995324205904591, 0.01995324205904591];

/**
 * Probability of making the shot with CIT compensation and compensation error.
 *
 * The player aims to fully cancel throw, but their compensation fraction
 * varies shot-to-shot: C ~ N(1, σ_frac²). The residual throw is
 * θ_throw × (1 - C) ~ N(0, (σ_frac × θ_throw)²).
 *
 * We integrate makeProbabilityWithThrow over this distribution using
 * 5-point Gauss-Hermite quadrature.
 *
 * @param {number} d          - Shot distance (inches)
 * @param {number} phi        - Cut angle (radians)
 * @param {number} alpha      - Pocket tolerance (radians)
 * @param {number} sigma      - Execution error std dev (radians)
 * @param {number} throwAngle - Throw angle θ_throw (radians)
 * @param {number} sigmaFrac  - Std dev of compensation fraction (dimensionless)
 * @returns {number} - Probability in [0, 1]
 */
export function makeProbabilityWithCIT(d, phi, alpha, sigma, throwAngle, sigmaFrac) {
  const sigmaCitAngle = sigmaFrac * throwAngle;
  if (sigmaCitAngle < 1e-12) {
    return makeProbability(d, phi, alpha, sigma);
  }

  // E[f(X)] where X ~ N(0, σ²) = (1/√π) Σ wᵢ f(√2 σ xᵢ)
  let prob = 0;
  for (let i = 0; i < GH_NODES.length; i++) {
    const residualThrow = Math.SQRT2 * sigmaCitAngle * GH_NODES[i];
    prob += GH_WEIGHTS[i] * makeProbabilityWithThrow(d, phi, alpha, sigma, residualThrow);
  }
  return prob / Math.sqrt(Math.PI);
}

// ─── Rendering helpers (pure, exported for testability) ───────────────────────

export const SVG_WIDTH = 800;
export const SVG_BORDER = 15; // rail border in px
export const SVG_SCALE = (SVG_WIDTH - 2 * SVG_BORDER) / TABLE_WIDTH; // px per inch
export const SVG_HEIGHT = 2 * SVG_BORDER + TABLE_HEIGHT * SVG_SCALE; // preserves 2:1 aspect ratio

/**
 * Convert table coordinates (inches, origin lower-left) to SVG pixel coordinates
 * (origin upper-left).
 *
 * @param {number} x - Table x in inches
 * @param {number} y - Table y in inches
 * @returns {[number, number]} - [svgX, svgY] in pixels
 */
export function tableToSVG(x, y) {
  return [SVG_BORDER + x * SVG_SCALE, SVG_HEIGHT - SVG_BORDER - y * SVG_SCALE];
}

/**
 * Inverse of tableToSVG: convert SVG pixel coordinates to table inches.
 *
 * @param {number} svgX - SVG x in pixels
 * @param {number} svgY - SVG y in pixels
 * @returns {[number, number]} - [tableX, tableY] in inches
 */
export function svgToTable(svgX, svgY) {
  return [
    (svgX - SVG_BORDER) / SVG_SCALE,
    (SVG_HEIGHT - SVG_BORDER - svgY) / SVG_SCALE,
  ];
}

/**
 * Compute the SVG polygon points string for an error cone (wedge).
 *
 * @param {number} originX  - SVG x of the cone apex (pixels)
 * @param {number} originY  - SVG y of the cone apex (pixels)
 * @param {number} dirAngle - Central direction angle (radians, SVG coords)
 * @param {number} halfAngle - Half-angle on the "minus" side of the cone (radians)
 * @param {number} length   - Length of the cone sides (pixels)
 * @param {number} [halfAnglePlus] - Half-angle on the "plus" side (radians); defaults to halfAngle (symmetric)
 * @returns {string} - SVG polygon points attribute value
 */
export function conePoints(originX, originY, dirAngle, halfAngle, length, halfAnglePlus = halfAngle) {
  const a1 = dirAngle - halfAngle;
  const a2 = dirAngle + halfAnglePlus;
  const x1 = originX + length * Math.cos(a1);
  const y1 = originY + length * Math.sin(a1);
  const x2 = originX + length * Math.cos(a2);
  const y2 = originY + length * Math.sin(a2);
  return `${originX},${originY} ${x1},${y1} ${x2},${y2}`;
}

// ─── Rendering (browser only) ─────────────────────────────────────────────────

/* v8 ignore next 3 */
if (typeof document !== 'undefined') {
  initApp();
}

/* v8 ignore start */
function initApp() {
  // ── Build SVG ──────────────────────────────────────────────────────────────

  const svg = document.getElementById('table-svg');
  // Explicit width/height give the SVG its intrinsic aspect ratio so that
  // CSS "height: auto" scales proportionally. The viewBox is also set so that
  // all internal drawing code uses the fixed coordinate system regardless of
  // the rendered pixel size.
  svg.setAttribute('width', SVG_WIDTH);
  svg.setAttribute('height', SVG_HEIGHT);
  svg.setAttribute('viewBox', `0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`);

  // Rail background
  const rail = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rail.setAttribute('x', 0);
  rail.setAttribute('y', 0);
  rail.setAttribute('width', SVG_WIDTH);
  rail.setAttribute('height', SVG_HEIGHT);
  rail.setAttribute('fill', '#6b4c2a');
  svg.appendChild(rail);

  // Felt surface
  const felt = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  felt.setAttribute('x', SVG_BORDER);
  felt.setAttribute('y', SVG_BORDER);
  felt.setAttribute('width', SVG_WIDTH - 2 * SVG_BORDER);
  felt.setAttribute('height', SVG_HEIGHT - 2 * SVG_BORDER);
  felt.setAttribute('fill', '#1a6b2a');
  svg.appendChild(felt);

  // Pocket geometry in SVG coordinates (pocket is fixed — computed once)
  let [pocketSvgX, pocketSvgY] = tableToSVG(POCKET_POS[0], POCKET_POS[1]);
  const [aSvgX, aSvgY]      = tableToSVG(POCKET_RAIL_END_TOP[0],   POCKET_RAIL_END_TOP[1]);
  const [bSvgX, bSvgY]      = tableToSVG(POCKET_RAIL_END_RIGHT[0], POCKET_RAIL_END_RIGHT[1]);
  const [cornerSvgX, cornerSvgY] = tableToSVG(TABLE_CORNER[0], TABLE_CORNER[1]);

  // Dark pocket: triangle from top-rail end → table corner → right-rail end
  const pocketPoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  pocketPoly.setAttribute('points',
    `${aSvgX},${aSvgY} ${cornerSvgX},${cornerSvgY} ${bSvgX},${bSvgY}`);
  pocketPoly.setAttribute('fill', '#111');
  svg.appendChild(pocketPoly);

  // Pocket facings at BCA 142° from each rail.
  // In table coords (y up): facing from A = (cos38°, −sin38°); from B = (sin38°, cos38°).
  // In SVG coords (y down): y-component flips sign.
  const f38Cos = Math.cos(Math.PI - POCKET_FACING_ANGLE); // cos 38° ≈ 0.788
  const f38Sin = Math.sin(Math.PI - POCKET_FACING_ANGLE); // sin 38° ≈ 0.616
  const facingLen = POCKET_SHELF * SVG_SCALE * 0.75;

  const facingA = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  facingA.setAttribute('x1', aSvgX);
  facingA.setAttribute('y1', aSvgY);
  facingA.setAttribute('x2', aSvgX + f38Cos * facingLen);
  facingA.setAttribute('y2', aSvgY - f38Sin * facingLen); // SVG y down = table -y
  facingA.setAttribute('stroke', '#5a3a1a');
  facingA.setAttribute('stroke-width', 2);
  svg.appendChild(facingA);

  const facingB = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  facingB.setAttribute('x1', bSvgX);
  facingB.setAttribute('y1', bSvgY);
  facingB.setAttribute('x2', bSvgX + f38Sin * facingLen);
  facingB.setAttribute('y2', bSvgY - f38Cos * facingLen); // table +y = SVG -y
  facingB.setAttribute('stroke', '#5a3a1a');
  facingB.setAttribute('stroke-width', 2);
  svg.appendChild(facingB);

  // ── Side pocket (top rail) ──────────────────────────────────────────────────

  const [spLeftX, spLeftY] = tableToSVG(SIDE_POCKET_RAIL_END_LEFT[0], SIDE_POCKET_RAIL_END_LEFT[1]);
  const [spRightX, spRightY] = tableToSVG(SIDE_POCKET_RAIL_END_RIGHT[0], SIDE_POCKET_RAIL_END_RIGHT[1]);
  // The pocket extends into the rail (upward in table coords = lower SVG y)
  const spDepth = SIDE_POCKET_MOUTH_WIDTH * 0.5 * SVG_SCALE;

  const sidePocketPoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  sidePocketPoly.setAttribute('points',
    `${spLeftX},${spLeftY} ${spLeftX},${spLeftY - spDepth} ${spRightX},${spRightY - spDepth} ${spRightX},${spRightY}`);
  sidePocketPoly.setAttribute('fill', '#111');
  svg.appendChild(sidePocketPoly);

  // Side pocket facings: BCA 103° interior angle from the rail.
  // The rail runs horizontally. The facing angle from the rail is (180° − 103°) = 77°.
  // Left facing points inward (right and down into pocket): direction (cos77°, −sin77°) in table coords.
  // Right facing points inward (left and down into pocket): direction (−cos77°, −sin77°) in table coords.
  // In SVG coords (y flipped): y-component sign flips.
  const facingAngle = Math.PI - SIDE_POCKET_FACING_ANGLE; // 77°
  const sfCos = Math.cos(facingAngle);
  const sfSin = Math.sin(facingAngle);
  const sideFacingLen = SIDE_POCKET_HALF_MOUTH * SVG_SCALE * 0.6;

  const sideFacingL = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  sideFacingL.setAttribute('x1', spLeftX);
  sideFacingL.setAttribute('y1', spLeftY);
  sideFacingL.setAttribute('x2', spLeftX + sfCos * sideFacingLen);
  sideFacingL.setAttribute('y2', spLeftY - sfSin * sideFacingLen);
  sideFacingL.setAttribute('stroke', '#5a3a1a');
  sideFacingL.setAttribute('stroke-width', 2);
  svg.appendChild(sideFacingL);

  const sideFacingR = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  sideFacingR.setAttribute('x1', spRightX);
  sideFacingR.setAttribute('y1', spRightY);
  sideFacingR.setAttribute('x2', spRightX - sfCos * sideFacingLen);
  sideFacingR.setAttribute('y2', spRightY - sfSin * sideFacingLen);
  sideFacingR.setAttribute('stroke', '#5a3a1a');
  sideFacingR.setAttribute('stroke-width', 2);
  svg.appendChild(sideFacingR);

  // Effective target line: updated dynamically by updateGeometry()
  const targetLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  targetLine.setAttribute('stroke', '#ffe066');
  targetLine.setAttribute('stroke-width', 3);
  svg.appendChild(targetLine);

  // Aim line: cue ball → ghost ball (dashed, updated by updateGeometry)
  const aimLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  aimLine.setAttribute('stroke', 'rgba(255,255,255,0.35)');
  aimLine.setAttribute('stroke-width', 1.5);
  aimLine.setAttribute('stroke-dasharray', '6 4');
  svg.appendChild(aimLine);

  // Ideal travel line: object ball → pocket (always shown, faint when throw active)
  const idealTravelLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  idealTravelLine.setAttribute('stroke', 'rgba(255,255,255,0.35)');
  idealTravelLine.setAttribute('stroke-width', 1.5);
  idealTravelLine.setAttribute('stroke-dasharray', '6 4');
  svg.appendChild(idealTravelLine);

  // Thrown travel line: shows actual OB direction with throw (solid, orange-ish)
  const thrownTravelLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  thrownTravelLine.setAttribute('stroke', 'rgba(255,160,60,0.6)');
  thrownTravelLine.setAttribute('stroke-width', 1.5);
  svg.appendChild(thrownTravelLine);

  // Error cone from cue ball (blue, ±Δφ)
  const cueCone = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  cueCone.setAttribute('fill', 'rgba(60,130,255,0.25)');
  cueCone.setAttribute('stroke', 'rgba(60,130,255,0.6)');
  cueCone.setAttribute('stroke-width', 1);
  svg.appendChild(cueCone);

  // Error cone from object ball (red, ±Δθ)
  const objCone = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  objCone.setAttribute('fill', 'rgba(255,60,60,0.25)');
  objCone.setAttribute('stroke', 'rgba(255,60,60,0.6)');
  objCone.setAttribute('stroke-width', 1);
  svg.appendChild(objCone);

  // Ghost ball (dashed outline showing where cue ball contacts object ball)
  const ghostBallEl = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  ghostBallEl.setAttribute('r', BALL_RADIUS * SVG_SCALE);
  ghostBallEl.setAttribute('fill', 'none');
  ghostBallEl.setAttribute('stroke', 'rgba(255,255,255,0.4)');
  ghostBallEl.setAttribute('stroke-width', 1);
  ghostBallEl.setAttribute('stroke-dasharray', '4 3');
  svg.appendChild(ghostBallEl);

  // Cue ball
  const cueBallEl = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  cueBallEl.setAttribute('r', BALL_RADIUS * SVG_SCALE);
  cueBallEl.setAttribute('fill', 'white');
  cueBallEl.setAttribute('stroke', '#ccc');
  cueBallEl.setAttribute('stroke-width', 1);
  cueBallEl.classList.add('draggable');
  svg.appendChild(cueBallEl);

  // Object ball
  const objBallEl = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  objBallEl.setAttribute('r', BALL_RADIUS * SVG_SCALE);
  objBallEl.setAttribute('fill', '#ffe066');
  objBallEl.setAttribute('stroke', '#c8a000');
  objBallEl.setAttribute('stroke-width', 1);
  objBallEl.classList.add('draggable');
  svg.appendChild(objBallEl);

  // ── Legend (lower-left, overlaid on table) ─────────────────────────────────

  const LEGEND_ITEMS = [
    { fill: 'rgba(60,130,255,0.5)',  stroke: 'rgba(60,130,255,0.8)', label: 'Aim error (±Δφ)' },
    { fill: 'rgba(255,60,60,0.5)',   stroke: 'rgba(255,60,60,0.8)',  label: 'OB direction error (±Δθ)' },
    { fill: '#ffe066',               stroke: '#c8a000',              label: 'Effective pocket window' },
    { fill: 'rgba(255,160,60,0.6)',  stroke: 'rgba(255,160,60,0.8)', label: 'Actual OB path (w/ throw)' },
  ];
  const LEG_PAD_X = 10, LEG_PAD_Y = 8, LEG_ROW_H = 18;
  const LEG_SWATCH_W = 16, LEG_SWATCH_H = 10, LEG_FONT = 11;
  const LEG_W = 195;
  const LEG_H = LEG_PAD_Y * 2 + LEGEND_ITEMS.length * LEG_ROW_H;
  const LEG_X = SVG_BORDER + 8;
  const LEG_Y = SVG_HEIGHT - SVG_BORDER - LEG_H - 8;

  const legendG = document.createElementNS('http://www.w3.org/2000/svg', 'g');

  const legendBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  legendBg.setAttribute('x', LEG_X);
  legendBg.setAttribute('y', LEG_Y);
  legendBg.setAttribute('width', LEG_W);
  legendBg.setAttribute('height', LEG_H);
  legendBg.setAttribute('fill', 'rgba(0,0,0,0.55)');
  legendBg.setAttribute('rx', 4);
  legendG.appendChild(legendBg);

  LEGEND_ITEMS.forEach((item, i) => {
    const rowY = LEG_Y + LEG_PAD_Y + i * LEG_ROW_H;

    const swatch = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    swatch.setAttribute('x', LEG_X + LEG_PAD_X);
    swatch.setAttribute('y', rowY + (LEG_ROW_H - LEG_SWATCH_H) / 2);
    swatch.setAttribute('width', LEG_SWATCH_W);
    swatch.setAttribute('height', LEG_SWATCH_H);
    swatch.setAttribute('fill', item.fill);
    swatch.setAttribute('stroke', item.stroke);
    swatch.setAttribute('stroke-width', 1);
    swatch.setAttribute('rx', 2);
    legendG.appendChild(swatch);

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', LEG_X + LEG_PAD_X + LEG_SWATCH_W + 6);
    label.setAttribute('y', rowY + LEG_ROW_H / 2 + LEG_FONT * 0.35);
    label.setAttribute('font-size', LEG_FONT);
    label.setAttribute('font-family', 'system-ui, -apple-system, sans-serif');
    label.setAttribute('fill', '#ccc');
    label.textContent = item.label;
    legendG.appendChild(label);
  });

  svg.appendChild(legendG);

  // ── Make % display (upper-right, overlaid on table) ────────────────────────

  const MAKE_LABEL_FONT = 12;
  const MAKE_VALUE_FONT = 18;
  const MAKE_PAD_Y = 7;
  const MAKE_W = 118;
  const MAKE_H = MAKE_PAD_Y * 2 + MAKE_LABEL_FONT + 5 + MAKE_VALUE_FONT;
  const MAKE_X = SVG_BORDER + 8;
  const MAKE_Y = SVG_BORDER + 8;

  const makeG = document.createElementNS('http://www.w3.org/2000/svg', 'g');

  const makeBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  makeBg.setAttribute('x', MAKE_X);
  makeBg.setAttribute('y', MAKE_Y);
  makeBg.setAttribute('width', MAKE_W);
  makeBg.setAttribute('height', MAKE_H);
  makeBg.setAttribute('fill', 'rgba(0,0,0,0.55)');
  makeBg.setAttribute('rx', 4);
  makeG.appendChild(makeBg);

  const makeLabelSvg = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  makeLabelSvg.setAttribute('x', MAKE_X + MAKE_W / 2 - 6);
  makeLabelSvg.setAttribute('y', MAKE_Y + MAKE_PAD_Y + MAKE_LABEL_FONT);
  makeLabelSvg.setAttribute('font-size', MAKE_LABEL_FONT);
  makeLabelSvg.setAttribute('font-family', 'system-ui, -apple-system, sans-serif');
  makeLabelSvg.setAttribute('fill', '#aaa');
  makeLabelSvg.setAttribute('text-anchor', 'middle');
  makeLabelSvg.textContent = 'Make probability';
  makeG.appendChild(makeLabelSvg);

  // Info icon — carries data-info so the document click handler can pick it up.
  const makeInfoSvg = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  makeInfoSvg.setAttribute('x', MAKE_X + MAKE_W - 7);
  makeInfoSvg.setAttribute('y', MAKE_Y + MAKE_PAD_Y + MAKE_LABEL_FONT);
  makeInfoSvg.setAttribute('font-size', MAKE_LABEL_FONT);
  makeInfoSvg.setAttribute('font-family', 'system-ui, -apple-system, sans-serif');
  makeInfoSvg.setAttribute('text-anchor', 'middle');
  makeInfoSvg.classList.add('info-btn');
  makeInfoSvg.dataset.info = 'The probability of pocketing the ball on a standard 9-foot table (100″ × 50″), given the current execution error, throw, and compensation settings. Accounts for the full Gaussian error distribution.';
  makeInfoSvg.textContent = '\u2139';
  makeG.appendChild(makeInfoSvg);

  const makeValueSvg = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  makeValueSvg.setAttribute('x', MAKE_X + MAKE_W / 2);
  makeValueSvg.setAttribute('y', MAKE_Y + MAKE_PAD_Y + MAKE_LABEL_FONT + 5 + MAKE_VALUE_FONT);
  makeValueSvg.setAttribute('font-size', MAKE_VALUE_FONT);
  makeValueSvg.setAttribute('font-family', 'system-ui, -apple-system, sans-serif');
  makeValueSvg.setAttribute('fill', '#7ec8e3');
  makeValueSvg.setAttribute('font-weight', '700');
  makeValueSvg.setAttribute('text-anchor', 'middle');
  makeValueSvg.setAttribute('font-variant-numeric', 'tabular-nums');
  makeValueSvg.textContent = '\u2014';
  makeG.appendChild(makeValueSvg);

  svg.appendChild(makeG);

  // ── State ──────────────────────────────────────────────────────────────────

  const cuePos = [...DEFAULT_CUE_BALL];
  const objPos = [...DEFAULT_OBJECT_BALL];
  const pocket = [...POCKET_POS];

  // SVG coords for balls — updated by updateGeometry(), read by updateSlider()
  let cueSvgX, cueSvgY, objSvgX, objSvgY, ghostSvgX, ghostSvgY;

  // ── Constraint helpers ─────────────────────────────────────────────────────

  function clampToBounds(pos) {
    return [
      Math.max(BALL_RADIUS, Math.min(TABLE_WIDTH - BALL_RADIUS, pos[0])),
      Math.max(BALL_RADIUS, Math.min(TABLE_HEIGHT - BALL_RADIUS, pos[1])),
    ];
  }

  function resolveOverlap(movingPos, fixedPos) {
    const minDist = 2 * BALL_RADIUS;
    const dx = movingPos[0] - fixedPos[0];
    const dy = movingPos[1] - fixedPos[1];
    const dist = Math.hypot(dx, dy);
    if (dist >= minDist) return movingPos;
    // Coincident edge case: push straight right
    if (dist < 1e-9) return [fixedPos[0] + minDist, fixedPos[1]];
    return [fixedPos[0] + (minDist * dx) / dist, fixedPos[1] + (minDist * dy) / dist];
  }

  // ── DOM refs ───────────────────────────────────────────────────────────────

  const slider = document.getElementById('error-slider');
  const displayDeltaPhi = document.getElementById('display-delta-phi');
  const displayMake = makeValueSvg; // rendered in SVG, not HTML
  const displayCutAngle = document.getElementById('display-cut-angle');
  const displayDistance = document.getElementById('display-distance');
  const displayAlpha = document.getElementById('display-alpha');
  const displayTargetSize = document.getElementById('display-target-size');
  const displayThrow = document.getElementById('display-throw');
  const degenerateMsg = document.getElementById('degenerate-msg');

  // CIT controls
  const speedToggle = document.getElementById('speed-toggle');
  const citAdjustToggle = document.getElementById('cit-adjust-toggle');
  const citAccuracyGroup = document.getElementById('cit-accuracy-group');
  const citSlider = document.getElementById('cit-slider');
  const displayCitError = document.getElementById('display-cit-error');

  let selectedSpeed = 'medium';
  let selectedPocket = 'corner';

  // Pocket toggle
  const pocketToggle = document.getElementById('pocket-toggle');
  pocketToggle.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-pocket]');
    if (!btn) return;
    pocketToggle.querySelector('.active').classList.remove('active');
    btn.classList.add('active');
    selectedPocket = btn.dataset.pocket;
    // Update pocket position
    if (selectedPocket === 'corner') {
      pocket[0] = POCKET_POS[0];
      pocket[1] = POCKET_POS[1];
    } else {
      pocket[0] = SIDE_POCKET_POS[0];
      pocket[1] = SIDE_POCKET_POS[1];
    }
    // Update SVG pocket reference point
    [pocketSvgX, pocketSvgY] = tableToSVG(pocket[0], pocket[1]);
    redraw();
  });

  // Speed toggle button handler
  speedToggle.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-speed]');
    if (!btn) return;
    speedToggle.querySelector('.active').classList.remove('active');
    btn.classList.add('active');
    selectedSpeed = btn.dataset.speed;
    redraw();
  });

  // CIT adjustment toggle — grey out the accuracy group rather than hide it.
  // We don't set the native `disabled` attribute on the slider because its
  // browser-rendered disabled appearance compounds with the `.disabled` opacity
  // and makes the control invisible. pointer-events:none on the group is
  // sufficient to block interaction.
  citAdjustToggle.addEventListener('change', () => {
    citAccuracyGroup.classList.toggle('disabled', !citAdjustToggle.checked);
    redraw();
  });

  citSlider.addEventListener('input', redraw);

  // ── Render functions ───────────────────────────────────────────────────────

  /**
   * Compute the ghost ball position for a given aim direction.
   * The ghost ball sits at O - 2R * aimDir, where aimDir is the unit vector
   * from the object ball toward the pocket (or a rotated version for CIT).
   */
  function ghostBallPosition(aimDirX, aimDirY) {
    return [
      objPos[0] - 2 * BALL_RADIUS * aimDirX,
      objPos[1] - 2 * BALL_RADIUS * aimDirY,
    ];
  }

  function updateGeometry(targetSize, targetOffset, tThrow, citAdjust) {
    [cueSvgX, cueSvgY] = tableToSVG(cuePos[0], cuePos[1]);
    [objSvgX, objSvgY] = tableToSVG(objPos[0], objPos[1]);

    // Direction from object ball to pocket (unit vector, table coords)
    const opx = pocket[0] - objPos[0];
    const opy = pocket[1] - objPos[1];
    const opLen = Math.hypot(opx, opy);
    const opDirX = opx / opLen;
    const opDirY = opy / opLen;

    // Ghost ball aim direction: rotate line-of-centers by θ_throw if compensating.
    // Throw deflects OB in the undercut direction (toward the cue ball's path,
    // making the shot play as though hit fuller). To compensate, the ghost ball
    // must shift so the line of centers, after throw, points at the pocket.
    // Rotation by tThrow around the object ball rotates the aim direction.
    let aimDirX, aimDirY;
    if (citAdjust && tThrow > 0) {
      // Throw drags the OB toward the CB's path (undercut direction, i.e., a
      // fuller hit). To compensate, rotate the aim toward a thinner cut so that
      // after throw the OB ends up pocket-bound.
      const cosT = Math.cos(tThrow);
      const sinT = Math.sin(tThrow);
      // Determine undercut rotation direction from cue ball position.
      // Throw drags the OB toward the CB's path (undercut direction).
      // Cross product of (OB→pocket) × (OB→cue) gives the rotation sense;
      // we negate it because throw is toward the CB, not away from it.
      const ocx = cuePos[0] - objPos[0];
      const ocy = cuePos[1] - objPos[1];
      const cross = opDirX * ocy - opDirY * ocx;
      const rotSign = cross >= 0 ? -1 : 1;
      aimDirX = opDirX * cosT - rotSign * opDirY * sinT;
      aimDirY = rotSign * opDirX * sinT + opDirY * cosT;
    } else {
      aimDirX = opDirX;
      aimDirY = opDirY;
    }

    const [ghostX, ghostY] = ghostBallPosition(aimDirX, aimDirY);
    [ghostSvgX, ghostSvgY] = tableToSVG(ghostX, ghostY);

    cueBallEl.setAttribute('cx', cueSvgX);
    cueBallEl.setAttribute('cy', cueSvgY);
    objBallEl.setAttribute('cx', objSvgX);
    objBallEl.setAttribute('cy', objSvgY);
    ghostBallEl.setAttribute('cx', ghostSvgX);
    ghostBallEl.setAttribute('cy', ghostSvgY);

    aimLine.setAttribute('x1', cueSvgX);
    aimLine.setAttribute('y1', cueSvgY);
    aimLine.setAttribute('x2', ghostSvgX);
    aimLine.setAttribute('y2', ghostSvgY);

    // Ideal travel line: OB → pocket (always shown)
    idealTravelLine.setAttribute('x1', objSvgX);
    idealTravelLine.setAttribute('y1', objSvgY);
    idealTravelLine.setAttribute('x2', pocketSvgX);
    idealTravelLine.setAttribute('y2', pocketSvgY);

    // Thrown travel line: shows actual OB direction with throw (when not compensating)
    if (!citAdjust && tThrow > 0) {
      idealTravelLine.setAttribute('stroke', 'rgba(255,255,255,0.15)'); // dim the ideal
      // Rotate pocket direction by throw angle to show actual OB path
      const cosT = Math.cos(tThrow);
      const sinT = Math.sin(tThrow);
      const ocx = cuePos[0] - objPos[0];
      const ocy = cuePos[1] - objPos[1];
      const cross = opDirX * ocy - opDirY * ocx;
      const rotSign = cross >= 0 ? -1 : 1;
      const thrownDirX = opDirX * cosT - rotSign * opDirY * sinT;
      const thrownDirY = rotSign * opDirX * sinT + opDirY * cosT;
      const thrownEndX = objPos[0] + thrownDirX * opLen;
      const thrownEndY = objPos[1] + thrownDirY * opLen;
      const [teSvgX, teSvgY] = tableToSVG(thrownEndX, thrownEndY);
      thrownTravelLine.setAttribute('x1', objSvgX);
      thrownTravelLine.setAttribute('y1', objSvgY);
      thrownTravelLine.setAttribute('x2', teSvgX);
      thrownTravelLine.setAttribute('y2', teSvgY);
      thrownTravelLine.style.display = '';
    } else {
      idealTravelLine.setAttribute('stroke', 'rgba(255,255,255,0.35)'); // full brightness
      thrownTravelLine.style.display = 'none';
    }

    // Dynamic target line: aligned with pocket mouth, shifted by offset.
    // Perpendicular to the pocket centerline (direction along the mouth).
    // Corner: mouth is at 45°, so perp is [-1/√2, 1/√2].
    // Side (top): mouth is along the rail (horizontal), so perp is [1, 0].
    const perpX = selectedPocket === 'corner' ? -1 / Math.SQRT2 : 1;
    const perpY = selectedPocket === 'corner' ? 1 / Math.SQRT2 : 0;
    const halfTarget = targetSize / 2;
    const centerX = pocket[0] + targetOffset * perpX;
    const centerY = pocket[1] + targetOffset * perpY;
    const [t1x, t1y] = tableToSVG(centerX - halfTarget * perpX, centerY - halfTarget * perpY);
    const [t2x, t2y] = tableToSVG(centerX + halfTarget * perpX, centerY + halfTarget * perpY);
    targetLine.setAttribute('x1', t1x);
    targetLine.setAttribute('y1', t1y);
    targetLine.setAttribute('x2', t2x);
    targetLine.setAttribute('y2', t2y);
  }

  function updateSlider(phi, d, alpha, targetSize, tThrow, citAdjust) {
    const deltaPhiDeg = parseFloat(slider.value);
    const deltaPhiRad = (deltaPhiDeg * Math.PI) / 180;
    const sigma = deltaPhiRad / 1.96;

    let prob;
    let citPercent = 0;
    if (citAdjust) {
      // CIT compensation on: player aims for 100% throw compensation,
      // but accuracy varies as a % of the throw angle.
      citPercent = parseFloat(citSlider.value);
      const sigmaFrac = (citPercent / 100) / 1.96;
      prob = makeProbabilityWithCIT(d, phi, alpha, sigma, tThrow, sigmaFrac);
      displayCitError.textContent = citPercent.toFixed(0) + '%';
    } else {
      // CIT compensation off: throw shifts the error distribution
      prob = makeProbabilityWithThrow(d, phi, alpha, sigma, tThrow);
    }

    // Asymmetric OB cone: compute Δθ for both edges independently.
    // +Δφ (thin side) and -Δφ (full side) produce different Δθ values
    // because the Δφ→Δθ mapping is nonlinear.
    let dtPlus = deltaTheta(d, phi, deltaPhiRad);
    if (dtPlus === null) {
      // CB misses OB at this Δφ — cap at domain boundary
      const domMax = findDeltaPhiDomainMax(d, phi);
      dtPlus = deltaTheta(d, phi, domMax) ?? 0;
    }
    let dtMinus = deltaTheta(d, phi, -deltaPhiRad);
    if (dtMinus === null) {
      const domMin = findDeltaPhiDomainMin(d, phi);
      dtMinus = deltaTheta(d, phi, domMin) ?? 0;
    }

    // The formula's Δθ sign is 1D. In 2D, the mapping from Δθ sign to SVG
    // angle direction depends on which side of the OB→pocket line the CB is on.
    // When cross(OB→pocket, OB→CB) >= 0: +Δθ → dirAngle + Δθ in SVG.
    // When cross < 0: +Δθ → dirAngle − Δθ in SVG (edges swap).
    const opx2 = pocket[0] - objPos[0];
    const opy2 = pocket[1] - objPos[1];
    const ocx2 = cuePos[0] - objPos[0];
    const ocy2 = cuePos[1] - objPos[1];
    const crossCone = opx2 * ocy2 - opy2 * ocx2;

    // Assign cone edges: halfMinus = edge at (dirAngle - halfMinus),
    // halfPlus = edge at (dirAngle + halfPlus).
    let coneHalfMinus, coneHalfPlus;
    const absDtMinus = Math.abs(dtMinus);
    if (citAdjust) {
      const dtCit95 = (citPercent / 100) * tThrow;
      const dtPlusCombo = Math.hypot(dtPlus, dtCit95);
      const dtMinusCombo = Math.hypot(absDtMinus, dtCit95);
      if (crossCone >= 0) {
        coneHalfMinus = dtMinusCombo;
        coneHalfPlus = dtPlusCombo;
      } else {
        coneHalfMinus = dtPlusCombo;
        coneHalfPlus = dtMinusCombo;
      }
    } else {
      if (crossCone >= 0) {
        coneHalfMinus = absDtMinus;
        coneHalfPlus = dtPlus;
      } else {
        coneHalfMinus = dtPlus;
        coneHalfPlus = absDtMinus;
      }
    }

    displayDeltaPhi.textContent = deltaPhiDeg.toFixed(2) + '\u00b0';
    displayMake.textContent = (prob * 100).toFixed(1) + '%';
    displayCutAngle.textContent = ((phi * 180) / Math.PI).toFixed(1) + '\u00b0';
    displayDistance.textContent = d.toFixed(1) + '"';
    displayAlpha.textContent = ((alpha * 180) / Math.PI).toFixed(2) + '\u00b0';
    displayTargetSize.textContent = targetSize.toFixed(2) + '"';
    displayThrow.textContent = ((tThrow * 180) / Math.PI).toFixed(2) + '\u00b0';

    // Cue cone: ±Δφ about the cue→ghost ball direction
    const cgSvgDx = ghostSvgX - cueSvgX;
    const cgSvgDy = ghostSvgY - cueSvgY;
    const cueConeLen = Math.hypot(cgSvgDx, cgSvgDy) * 1.5;
    const cueDirAngle = Math.atan2(cgSvgDy, cgSvgDx);

    if (deltaPhiRad > 0) {
      cueCone.setAttribute('points', conePoints(cueSvgX, cueSvgY, cueDirAngle, deltaPhiRad, cueConeLen));
    } else {
      cueCone.setAttribute('points', '');
    }

    // Object cone: centered on the thrown direction (compensation off)
    // or the pocket direction (compensation on), with appropriate width
    const opSvgDx = pocketSvgX - objSvgX;
    const opSvgDy = pocketSvgY - objSvgY;
    const objConeLen = Math.hypot(opSvgDx, opSvgDy) * 1.5;
    const opDirAngle = Math.atan2(opSvgDy, opSvgDx);

    // Determine cone center direction
    let coneDirAngle = opDirAngle;
    if (!citAdjust && tThrow > 0) {
      // Cone centered on thrown direction
      const opx = pocket[0] - objPos[0];
      const opy = pocket[1] - objPos[1];
      const opLen2 = Math.hypot(opx, opy);
      const opuX = opx / opLen2;
      const opuY = opy / opLen2;
      const ocx = cuePos[0] - objPos[0];
      const ocy = cuePos[1] - objPos[1];
      const cross = opuX * ocy - opuY * ocx;
      const rotSign = cross >= 0 ? -1 : 1;
      // In SVG coords, y is flipped, so the rotation sign flips too
      coneDirAngle = opDirAngle - rotSign * tThrow;
    }

    if (coneHalfMinus > 0 || coneHalfPlus > 0) {
      objCone.setAttribute('points', conePoints(objSvgX, objSvgY, coneDirAngle, coneHalfMinus, objConeLen, coneHalfPlus));
    } else {
      objCone.setAttribute('points', '');
    }
  }

  function redraw() {
    const phi = cutAngle(cuePos, objPos, pocket);
    const d = Math.hypot(objPos[0] - cuePos[0], objPos[1] - cuePos[1]);
    const { alpha, targetSize, offset } = pocketTolerance(objPos, pocket, selectedPocket);
    const citAdjust = citAdjustToggle.checked;

    // Compute throw angle for current speed and cut angle
    const speed = SPEEDS[selectedSpeed].mps;
    const tThrow = throwAngleNaturalRoll(speed, phi);

    updateGeometry(targetSize, offset, tThrow, citAdjust);

    if (phi >= Math.PI / 2) {
      cueCone.setAttribute('points', '');
      objCone.setAttribute('points', '');
      displayMake.textContent = '\u2014';
      displayCutAngle.textContent = ((phi * 180) / Math.PI).toFixed(1) + '\u00b0';
      displayDistance.textContent = d.toFixed(1) + '"';
      displayAlpha.textContent = ((alpha * 180) / Math.PI).toFixed(2) + '\u00b0';
      displayTargetSize.textContent = targetSize.toFixed(2) + '"';
      displayThrow.textContent = '\u2014';
      displayDeltaPhi.textContent = parseFloat(slider.value).toFixed(2) + '\u00b0';
      degenerateMsg.style.display = 'block';
      thrownTravelLine.style.display = 'none';
      return;
    }

    degenerateMsg.style.display = 'none';
    updateSlider(phi, d, alpha, targetSize, tThrow, citAdjust);
  }

  // ── Drag ───────────────────────────────────────────────────────────────────

  let dragging = null; // 'cue' | 'obj' | null

  function clientToTablePos(clientX, clientY) {
    const rect = svg.getBoundingClientRect();
    // Scale from rendered CSS pixels to SVG internal coordinate space (viewBox).
    const cssToSvg = SVG_WIDTH / rect.width;
    return clampToBounds(svgToTable(
      (clientX - rect.left) * cssToSvg,
      (clientY - rect.top) * cssToSvg,
    ));
  }

  function applyDrag(pos) {
    if (dragging === 'cue') {
      pos = resolveOverlap(pos, objPos);
      cuePos[0] = pos[0];
      cuePos[1] = pos[1];
    } else {
      pos = resolveOverlap(pos, cuePos);
      objPos[0] = pos[0];
      objPos[1] = pos[1];
    }
    redraw();
  }

  // Mouse drag
  cueBallEl.addEventListener('mousedown', (e) => {
    dragging = 'cue';
    svg.classList.add('dragging');
    e.preventDefault();
  });

  objBallEl.addEventListener('mousedown', (e) => {
    dragging = 'obj';
    svg.classList.add('dragging');
    e.preventDefault();
  });

  svg.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    applyDrag(clientToTablePos(e.clientX, e.clientY));
  });

  function stopDrag() {
    dragging = null;
    svg.classList.remove('dragging');
  }

  svg.addEventListener('mouseup', stopDrag);
  svg.addEventListener('mouseleave', stopDrag);

  // Touch drag
  cueBallEl.addEventListener('touchstart', (e) => {
    dragging = 'cue';
    svg.classList.add('dragging');
    e.preventDefault();
  }, { passive: false });

  objBallEl.addEventListener('touchstart', (e) => {
    dragging = 'obj';
    svg.classList.add('dragging');
    e.preventDefault();
  }, { passive: false });

  svg.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    e.preventDefault();
    const touch = e.touches[0];
    applyDrag(clientToTablePos(touch.clientX, touch.clientY));
  }, { passive: false });

  svg.addEventListener('touchend', stopDrag);
  svg.addEventListener('touchcancel', stopDrag);

  // ── Info popups ────────────────────────────────────────────────────────────

  const infoPopup = document.getElementById('info-popup');
  const infoPopupText = document.getElementById('info-popup-text');

  // Single document-level handler covers info buttons anywhere on the page
  // (including the make % banner which is outside #controls).
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.info-btn');
    if (btn) {
      // Prevent label default action (e.g., toggling a nearby checkbox).
      e.preventDefault();
      const text = btn.dataset.info;
      // Toggle off if clicking the same icon again.
      if (infoPopup.style.display !== 'none' && infoPopupText.textContent === text) {
        infoPopup.style.display = 'none';
        return;
      }
      infoPopupText.textContent = text;
      const btnRect = btn.getBoundingClientRect();
      // Keep popup inside viewport horizontally.
      const left = Math.min(window.innerWidth - 292, Math.max(4, btnRect.left));
      infoPopup.style.left = left + 'px';
      infoPopup.style.top = (btnRect.bottom + 6) + 'px';
      infoPopup.style.display = '';
    } else if (!e.target.closest('#info-popup')) {
      infoPopup.style.display = 'none';
    }
  });

  // ── Initial render ─────────────────────────────────────────────────────────

  slider.addEventListener('input', redraw);
  redraw();
}
/* v8 ignore stop */
