import { describe, it, expect } from 'vitest';
import {
  CORNER_POCKET_DEFAULTS,
  SIDE_POCKET_DEFAULTS,
  findRoot,
  auxiliaryA,
  polyBeta,
  polyBetaIn,
  solveBetaL,
  sLeftPointWall,
  rWall,
  sLeftWall,
  thetaRail,
  thetaWallTransform,
  dWallWall,
  sLeftWallWall,
  sLeftRailPointWall,
  sLeftRailWallWall,
  polyBetaWW,
  solveBetaLWW,
  sLeftPointWallWall,
  dPointWallWall,
  sLeftRailPointWallWall,
  sLeftRailMaxAngle,
  computeCriticalAngles,
  createCornerPocketCalculator,
  computeSideCriticalAngles,
  createSidePocketCalculator,
} from './pocket_geometry.js';

const DEG = Math.PI / 180;
const params = CORNER_POCKET_DEFAULTS;

// ─── Root Finding ────────────────────────────────────────────────────────────

describe('findRoot', () => {
  it('finds root of a simple linear function', () => {
    expect(findRoot(x => x - 3, 2, 0, 10)).toBeCloseTo(3, 10);
  });

  it('finds root of sin(x) near π', () => {
    expect(findRoot(Math.sin, 3, 2, 4)).toBeCloseTo(Math.PI, 8);
  });

  it('finds root of a quadratic', () => {
    // x² - 4 = 0, root at x = 2
    expect(findRoot(x => x * x - 4, 1.5, 0, 5)).toBeCloseTo(2, 8);
  });
});

// ─── Shared Equations ────────────────────────────────────────────────────────

describe('solveBetaL', () => {
  it('returns a value in (0, π/2) for θ = 0', () => {
    const beta = solveBetaL(params, 0);
    expect(beta).toBeGreaterThan(0);
    expect(beta).toBeLessThan(Math.PI / 2);
  });

  it('satisfies polyβ or polyβ_in at the solution', () => {
    const theta = 10 * DEG;
    const beta = solveBetaL(params, theta);
    const f1 = Math.abs(polyBeta(params, beta, theta));
    const f2 = Math.abs(polyBetaIn(params, beta, theta));
    expect(Math.min(f1, f2)).toBeLessThan(1e-6);
  });
});

describe('sLeftPointWall', () => {
  it('is positive for moderate angles', () => {
    expect(sLeftPointWall(params, 0)).toBeGreaterThan(0);
    expect(sLeftPointWall(params, 20 * DEG)).toBeGreaterThan(0);
    expect(sLeftPointWall(params, -20 * DEG)).toBeGreaterThan(0);
  });
});

describe('sLeftWall', () => {
  it('is positive for moderate angles', () => {
    expect(sLeftWall(params, 0)).toBeGreaterThan(0);
  });
});

// ─── Angle Transformations ───────────────────────────────────────────────────

describe('angle transformations', () => {
  it('thetaRail: θ=0 → 90°', () => {
    expect(thetaRail(0)).toBeCloseTo(Math.PI / 2, 10);
  });

  it('thetaRail: θ=45° → 45°', () => {
    expect(thetaRail(45 * DEG)).toBeCloseTo(45 * DEG, 10);
  });

  it('thetaWallTransform: θ − 2α', () => {
    const theta = 30 * DEG;
    expect(thetaWallTransform(theta, params.alpha)).toBeCloseTo(theta - 2 * params.alpha, 10);
  });
});

// ─── Multi-Wall Rattle ───────────────────────────────────────────────────────

describe('sLeftWallWall', () => {
  it('is positive for moderate positive θ', () => {
    expect(sLeftWallWall(params, 20 * DEG)).toBeGreaterThan(0);
  });
});

// ─── polyβww and sLeftPointWallWall ──────────────────────────────────────────

describe('solveBetaLWW', () => {
  it('returns a value in a reasonable range', () => {
    const beta = solveBetaLWW(params, 0);
    expect(beta).toBeGreaterThan(30 * DEG);
    expect(beta).toBeLessThan(89 * DEG);
  });

  it('satisfies polyβww at the solution', () => {
    const theta = 0;
    const beta = solveBetaLWW(params, theta);
    expect(Math.abs(polyBetaWW(params, beta, theta))).toBeLessThan(1e-6);
  });
});

describe('sLeftPointWallWall', () => {
  it('is positive at θ = 0', () => {
    expect(sLeftPointWallWall(params, 0)).toBeGreaterThan(0);
  });
});

// ─── Critical Angles ─────────────────────────────────────────────────────────

describe('computeCriticalAngles', () => {
  // Note: spec values are for 8-foot table (p=4.5875). Ours differ (p=4.5, L=100).
  // We test structural properties rather than exact spec values.
  const crits = computeCriticalAngles(params);

  it('dMax is positive and reasonable', () => {
    expect(crits.dMax).toBeGreaterThan(80);
    expect(crits.dMax).toBeLessThan(100);
  });

  it('critical angles are ordered correctly', () => {
    expect(crits.thetaCritical).toBeLessThan(crits.thetaCriticalD);
    expect(crits.thetaCriticalD).toBeLessThan(crits.thetaCriticalC);
    expect(crits.thetaCriticalC).toBeLessThan(crits.thetaMaxLong);
  });

  it('θ_critical = θ_critical_C − 90°', () => {
    expect(crits.thetaCritical).toBeCloseTo(crits.thetaCriticalC - Math.PI / 2, 8);
  });

  it('θ_critical_C is in roughly expected range', () => {
    // Spec says ~38.6° for default params; ours differ slightly
    expect(crits.thetaCriticalC / DEG).toBeGreaterThan(30);
    expect(crits.thetaCriticalC / DEG).toBeLessThan(45);
  });

  it('θ_max_long is near 45°', () => {
    expect(crits.thetaMaxLong / DEG).toBeGreaterThan(40);
    expect(crits.thetaMaxLong / DEG).toBeLessThan(45);
  });

  it('s_left curves agree at θ_critical_C', () => {
    const sRPW = sLeftRailPointWall(params, crits.thetaCriticalC);
    const sRWW = sLeftRailWallWall(params, crits.thetaCriticalC);
    expect(sRPW).toBeCloseTo(sRWW, 4);
  });

  it('s_left_point_wall and s_left_wall_wall agree at θ_critical', () => {
    const sPW = sLeftPointWall(params, crits.thetaCritical);
    const sWW = sLeftWallWall(params, crits.thetaCritical);
    expect(sPW).toBeCloseTo(sWW, 3);
  });

  it('d_point_wall_wall equals dMax at θ_max_long', () => {
    const d = dPointWallWall(params, crits.thetaMaxLong);
    expect(d).toBeCloseTo(crits.dMax, 3);
  });
});

// ─── Full Assembly ───────────────────────────────────────────────────────────

describe('createCornerPocketCalculator', () => {
  const calc = createCornerPocketCalculator(params);

  it('returns an object with s, offset, sLeft, sRight', () => {
    const result = calc(0);
    expect(result).toHaveProperty('s');
    expect(result).toHaveProperty('offset');
    expect(result).toHaveProperty('sLeft');
    expect(result).toHaveProperty('sRight');
  });

  it('s is positive across the range', () => {
    for (let deg = -44; deg <= 44; deg += 2) {
      const result = calc(deg * DEG);
      expect(result.s).toBeGreaterThan(0);
    }
  });

  it('s = sLeft + sRight', () => {
    for (let deg = -44; deg <= 44; deg += 5) {
      const result = calc(deg * DEG);
      expect(result.s).toBeCloseTo(result.sLeft + result.sRight, 10);
    }
  });

  it('is symmetric: s(θ) ≈ s(−θ)', () => {
    for (let deg = 1; deg <= 44; deg += 5) {
      const pos = calc(deg * DEG);
      const neg = calc(-deg * DEG);
      expect(pos.s).toBeCloseTo(neg.s, 6);
    }
  });

  it('offset is antisymmetric: offset(θ) ≈ −offset(−θ)', () => {
    for (let deg = 1; deg <= 44; deg += 5) {
      const pos = calc(deg * DEG);
      const neg = calc(-deg * DEG);
      expect(pos.offset).toBeCloseTo(-neg.offset, 6);
    }
  });

  it('offset ≈ 0 at θ = 0', () => {
    const result = calc(0);
    expect(Math.abs(result.offset)).toBeLessThan(0.01);
  });

  // Qualitative expectations from TP 3.6 §11 (adjusted for our params)
  it('θ = 0: s is in a reasonable range (local minimum region)', () => {
    // Spec says ~1.5" for default params (p=4.5875); our p=4.5 gives ~2.6"
    const result = calc(0);
    expect(result.s).toBeGreaterThan(0.8);
    expect(result.s).toBeLessThan(4.0);
  });

  it('near-rail angles have larger target than center', () => {
    const center = calc(0);
    const nearRail = calc(43 * DEG);
    expect(nearRail.s).toBeGreaterThan(center.s);
  });

  it('the curve dips in the middle and rises at the edges', () => {
    const s0 = calc(0).s;
    const s20 = calc(20 * DEG).s;
    const s43 = calc(43 * DEG).s;
    // Center region should be lower than near-rail
    expect(s43).toBeGreaterThan(s0);
    expect(s43).toBeGreaterThan(s20);
  });
});

// ─── Side Pocket ──────────────────────────────────────────────────────────────

const sideParams = SIDE_POCKET_DEFAULTS;

describe('computeSideCriticalAngles', () => {
  const crits = computeSideCriticalAngles(sideParams);

  it('θ_max is near 68° for default params', () => {
    expect(crits.thetaMax / DEG).toBeGreaterThan(60);
    expect(crits.thetaMax / DEG).toBeLessThan(75);
  });

  it('θ_min = −θ_max', () => {
    expect(crits.thetaMin).toBeCloseTo(-crits.thetaMax, 10);
  });

  it('θ_critical is negative and between θ_min and 0', () => {
    expect(crits.thetaCritical).toBeLessThan(0);
    expect(crits.thetaCritical).toBeGreaterThan(crits.thetaMin);
  });

  it('θ_critical is near −50° for default params', () => {
    expect(crits.thetaCritical / DEG).toBeGreaterThan(-60);
    expect(crits.thetaCritical / DEG).toBeLessThan(-40);
  });
});

describe('createSidePocketCalculator', () => {
  const calc = createSidePocketCalculator(sideParams);

  it('returns an object with s, offset, sLeft, sRight', () => {
    const result = calc(0);
    expect(result).toHaveProperty('s');
    expect(result).toHaveProperty('offset');
    expect(result).toHaveProperty('sLeft');
    expect(result).toHaveProperty('sRight');
  });

  it('s(0°) ≈ 3.35" (perpendicular approach)', () => {
    const result = calc(0);
    expect(result.s).toBeGreaterThan(2.8);
    expect(result.s).toBeLessThan(3.8);
  });

  it('s = 0 at ±θ_max', () => {
    const crits = computeSideCriticalAngles(sideParams);
    expect(calc(crits.thetaMax).s).toBeCloseTo(0, 1);
    expect(calc(-crits.thetaMax).s).toBeCloseTo(0, 1);
  });

  it('s is non-negative across the valid range', () => {
    for (let deg = -67; deg <= 67; deg += 2) {
      const result = calc(deg * DEG);
      expect(result.s).toBeGreaterThanOrEqual(0);
    }
  });

  it('s = sLeft + sRight', () => {
    for (let deg = -60; deg <= 60; deg += 5) {
      const result = calc(deg * DEG);
      expect(result.s).toBeCloseTo(result.sLeft + result.sRight, 10);
    }
  });

  it('is symmetric: s(θ) ≈ s(−θ)', () => {
    for (let deg = 1; deg <= 65; deg += 5) {
      const pos = calc(deg * DEG);
      const neg = calc(-deg * DEG);
      expect(pos.s).toBeCloseTo(neg.s, 4);
    }
  });

  it('offset is antisymmetric: offset(θ) ≈ −offset(−θ)', () => {
    for (let deg = 1; deg <= 65; deg += 5) {
      const pos = calc(deg * DEG);
      const neg = calc(-deg * DEG);
      expect(pos.offset).toBeCloseTo(-neg.offset, 4);
    }
  });

  it('offset ≈ 0 at θ = 0', () => {
    const result = calc(0);
    expect(Math.abs(result.offset)).toBeLessThan(0.01);
  });

  it('s is roughly bell-shaped: peaks near 0° and falls at edges', () => {
    const s0 = calc(0).s;
    const s35 = calc(35 * DEG).s;
    const s60 = calc(60 * DEG).s;
    expect(s0).toBeGreaterThan(s35);
    expect(s35).toBeGreaterThan(s60);
  });

  it('s is continuous at θ_critical (piecewise transition)', () => {
    const crits = computeSideCriticalAngles(sideParams);
    const eps = 0.01 * DEG;
    const above = calc(crits.thetaCritical + eps).s;
    const below = calc(crits.thetaCritical - eps).s;
    expect(above).toBeCloseTo(below, 1);
  });
});
