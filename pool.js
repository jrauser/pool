// pool.js — Pool Shot Margin Visualizer
// All angles are in radians internally; degrees only for display.

// ─── Constants ───────────────────────────────────────────────────────────────

export const BALL_RADIUS = 1.125; // inches
export const TABLE_WIDTH = 100;   // inches
export const TABLE_HEIGHT = 50;   // inches
export const TABLE_CORNER = [TABLE_WIDTH, TABLE_HEIGHT]; // upper-right table corner
export const POCKET_MOUTH_WIDTH = 4.5;           // inches, BCA standard
export const EFFECTIVE_POCKET_HALF_WIDTH = 1.25; // inches (half of 2.5" effective opening)
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
 * Angular pocket tolerance: the half-angle subtended by the effective pocket
 * opening (2.5", half = 1.25") from the object ball.
 *
 * @param {[number,number]} objPos    - [x, y] object ball (inches)
 * @param {[number,number]} pocketPos - [x, y] pocket (inches)
 * @returns {number} - α in radians
 */
export function pocketTolerance(objPos, pocketPos) {
  const dop = Math.hypot(pocketPos[0] - objPos[0], pocketPos[1] - objPos[1]);
  return Math.atan(EFFECTIVE_POCKET_HALF_WIDTH / dop);
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
 * Probability of making the shot.
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
 * Compute the SVG polygon points string for an error cone (wedge).
 *
 * @param {number} originX  - SVG x of the cone apex (pixels)
 * @param {number} originY  - SVG y of the cone apex (pixels)
 * @param {number} dirAngle - Central direction angle (radians, SVG coords)
 * @param {number} halfAngle - Half-angle of the cone (radians)
 * @param {number} length   - Length of the cone sides (pixels)
 * @returns {string} - SVG polygon points attribute value
 */
export function conePoints(originX, originY, dirAngle, halfAngle, length) {
  const a1 = dirAngle - halfAngle;
  const a2 = dirAngle + halfAngle;
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

  // Pocket geometry in SVG coordinates
  const [pocketSvgX, pocketSvgY] = tableToSVG(POCKET_POS[0], POCKET_POS[1]);
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

  // Effective 2.5" target: segment centered at pocket mouth, perpendicular to the diagonal.
  // In table coords the perpendicular to (1,1)/√2 is (−1,1)/√2; in SVG (y down) → (−1,−1)/√2.
  const halfTargetPx = (EFFECTIVE_POCKET_HALF_WIDTH / Math.SQRT2) * SVG_SCALE;
  const targetLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  targetLine.setAttribute('x1', pocketSvgX - halfTargetPx);
  targetLine.setAttribute('y1', pocketSvgY - halfTargetPx);
  targetLine.setAttribute('x2', pocketSvgX + halfTargetPx);
  targetLine.setAttribute('y2', pocketSvgY + halfTargetPx);
  targetLine.setAttribute('stroke', '#ffe066');
  targetLine.setAttribute('stroke-width', 3);
  svg.appendChild(targetLine);

  // Aim line: cue ball → ghost ball (dashed)
  const aimLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  aimLine.setAttribute('stroke', 'rgba(255,255,255,0.35)');
  aimLine.setAttribute('stroke-width', 1.5);
  aimLine.setAttribute('stroke-dasharray', '6 4');
  svg.appendChild(aimLine);

  // Travel line: object ball → pocket (dashed)
  const travelLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  travelLine.setAttribute('stroke', 'rgba(255,255,255,0.35)');
  travelLine.setAttribute('stroke-width', 1.5);
  travelLine.setAttribute('stroke-dasharray', '6 4');
  svg.appendChild(travelLine);

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
  svg.appendChild(cueBallEl);

  // Object ball
  const objBallEl = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  objBallEl.setAttribute('r', BALL_RADIUS * SVG_SCALE);
  objBallEl.setAttribute('fill', '#ffe066');
  objBallEl.setAttribute('stroke', '#c8a000');
  objBallEl.setAttribute('stroke-width', 1);
  svg.appendChild(objBallEl);

  // ── State ──────────────────────────────────────────────────────────────────

  const cuePos = [...DEFAULT_CUE_BALL];
  const objPos = [...DEFAULT_OBJECT_BALL];
  const pocket = [...POCKET_POS];

  const [cueSvgX, cueSvgY] = tableToSVG(cuePos[0], cuePos[1]);
  const [objSvgX, objSvgY] = tableToSVG(objPos[0], objPos[1]);

  // Place static balls
  cueBallEl.setAttribute('cx', cueSvgX);
  cueBallEl.setAttribute('cy', cueSvgY);
  objBallEl.setAttribute('cx', objSvgX);
  objBallEl.setAttribute('cy', objSvgY);

  // Ghost ball position (table coords): O - 2R * normalize(pocket - O)
  const opx = pocket[0] - objPos[0];
  const opy = pocket[1] - objPos[1];
  const opLen = Math.hypot(opx, opy);
  const ghostX = objPos[0] - (2 * BALL_RADIUS * opx) / opLen;
  const ghostY = objPos[1] - (2 * BALL_RADIUS * opy) / opLen;
  const [ghostSvgX, ghostSvgY] = tableToSVG(ghostX, ghostY);

  // Position ghost ball
  ghostBallEl.setAttribute('cx', ghostSvgX);
  ghostBallEl.setAttribute('cy', ghostSvgY);

  // Aim line: cue ball → ghost ball
  aimLine.setAttribute('x1', cueSvgX);
  aimLine.setAttribute('y1', cueSvgY);
  aimLine.setAttribute('x2', ghostSvgX);
  aimLine.setAttribute('y2', ghostSvgY);

  // Travel line: object ball → pocket
  travelLine.setAttribute('x1', objSvgX);
  travelLine.setAttribute('y1', objSvgY);
  travelLine.setAttribute('x2', pocketSvgX);
  travelLine.setAttribute('y2', pocketSvgY);

  // ── Update function ────────────────────────────────────────────────────────

  const slider = document.getElementById('error-slider');
  const displayDeltaPhi = document.getElementById('display-delta-phi');
  const displayMake = document.getElementById('display-make');
  const displayCutAngle = document.getElementById('display-cut-angle');
  const displayDistance = document.getElementById('display-distance');
  const displayAlpha = document.getElementById('display-alpha');

  function update() {
    const deltaPhiDeg = parseFloat(slider.value);
    const deltaPhiRad = (deltaPhiDeg * Math.PI) / 180;
    const sigma = deltaPhiRad / 1.96;

    const phi = cutAngle(cuePos, objPos, pocket);
    const d = Math.hypot(objPos[0] - cuePos[0], objPos[1] - cuePos[1]);
    const alpha = pocketTolerance(objPos, pocket);

    const prob = makeProbability(d, phi, alpha, sigma);
    const dtRaw = deltaTheta(d, phi, deltaPhiRad);
    const deltaT = dtRaw !== null ? dtRaw : alpha; // clamp for display

    displayDeltaPhi.textContent = deltaPhiDeg.toFixed(2) + '\u00b0';
    displayMake.textContent = (prob * 100).toFixed(1) + '%';
    displayCutAngle.textContent = ((phi * 180) / Math.PI).toFixed(1) + '\u00b0';
    displayDistance.textContent = d.toFixed(1) + '"';
    displayAlpha.textContent = ((alpha * 180) / Math.PI).toFixed(2) + '\u00b0';

    // Cone geometry — direction from cue ball to ghost ball (SVG coords, y flipped)
    const cgSvgDx = ghostSvgX - cueSvgX;
    const cgSvgDy = ghostSvgY - cueSvgY;
    const coneLen = Math.hypot(cgSvgDx, cgSvgDy) * 1.5;
    const cueDirAngle = Math.atan2(cgSvgDy, cgSvgDx);

    // Cue cone: ±Δφ about the cue→ghost ball direction
    if (deltaPhiRad > 0) {
      cueCone.setAttribute('points', conePoints(cueSvgX, cueSvgY, cueDirAngle, deltaPhiRad, coneLen));
    } else {
      cueCone.setAttribute('points', '');
    }

    // Direction from object ball to pocket (SVG coords)
    const opSvgDx = pocketSvgX - objSvgX;
    const opSvgDy = pocketSvgY - objSvgY;
    const opLen = Math.hypot(opSvgDx, opSvgDy) * 1.5;
    const opDirAngle = Math.atan2(opSvgDy, opSvgDx);

    // Object cone: ±Δθ about the object→pocket direction
    if (Math.abs(deltaT) > 0) {
      objCone.setAttribute('points', conePoints(objSvgX, objSvgY, opDirAngle, Math.abs(deltaT), opLen));
    } else {
      objCone.setAttribute('points', '');
    }
  }

  slider.addEventListener('input', update);
  update();
}
/* v8 ignore stop */
