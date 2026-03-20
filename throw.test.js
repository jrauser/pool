import { describe, it, expect } from 'vitest';
import {
  BALL_RADIUS_M,
  SPEEDS,
  frictionCoefficient,
  relativeSlideSpeed,
  throwAngle,
  throwAngleNaturalRoll,
} from './throw.js';

const DEG = Math.PI / 180;

describe('frictionCoefficient', () => {
  it('returns ~0.06 at medium sliding speed', () => {
    // Marlow calibration point 2: v_d = 1.0·sin(45°) ≈ 0.707 m/s → μ ≈ 0.06
    const mu = frictionCoefficient(1.0 * Math.sin(Math.PI / 4));
    expect(mu).toBeCloseTo(0.06, 2);
  });

  it('returns ~0.11 at very low sliding speed', () => {
    // Marlow calibration point 1: v_d = 0.1·sin(45°) ≈ 0.0707 m/s → μ ≈ 0.11
    const mu = frictionCoefficient(0.1 * Math.sin(Math.PI / 4));
    expect(mu).toBeCloseTo(0.11, 2);
  });

  it('returns ~0.01 at very high sliding speed', () => {
    // Marlow calibration point 3: v_d = 10.0·sin(45°) ≈ 7.07 m/s → μ ≈ 0.01
    const mu = frictionCoefficient(10.0 * Math.sin(Math.PI / 4));
    expect(mu).toBeCloseTo(0.01, 2);
  });

  it('is monotonically decreasing with speed', () => {
    const speeds = [0.01, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0];
    for (let i = 1; i < speeds.length; i++) {
      expect(frictionCoefficient(speeds[i])).toBeLessThan(
        frictionCoefficient(speeds[i - 1])
      );
    }
  });

  it('approaches FRICTION_A at very high speed', () => {
    const mu = frictionCoefficient(100);
    expect(mu).toBeCloseTo(0.00995, 4);
  });
});

describe('relativeSlideSpeed', () => {
  it('returns v·sin(φ) for stun shots (ω_x = 0)', () => {
    const v = 1.341; // medium
    const phi = 30 * DEG;
    const vRel = relativeSlideSpeed(v, 0, phi);
    expect(vRel).toBeCloseTo(v * Math.sin(phi), 10);
  });

  it('is larger than v·sin(φ) for natural roll (vertical component adds)', () => {
    const v = 1.341;
    const phi = 30 * DEG;
    const omegaX = v / BALL_RADIUS_M;
    const vRel = relativeSlideSpeed(v, omegaX, phi);
    expect(vRel).toBeGreaterThan(v * Math.sin(phi));
  });

  it('returns 0 for straight-on stun (φ=0, ω_x=0)', () => {
    expect(relativeSlideSpeed(1.0, 0, 0)).toBe(0);
  });

  it('returns R·ω_x for straight-on natural roll (φ=0)', () => {
    const v = 1.341;
    const omegaX = v / BALL_RADIUS_M;
    const vRel = relativeSlideSpeed(v, omegaX, 0);
    expect(vRel).toBeCloseTo(BALL_RADIUS_M * omegaX, 10);
  });
});

describe('throwAngle', () => {
  it('returns 0 for straight-on shots (φ=0)', () => {
    expect(throwAngle(1.341, 0, 0)).toBe(0);
    expect(throwAngle(1.341, 1.341 / BALL_RADIUS_M, 0)).toBe(0);
  });

  it('returns 0 when v_rel = 0', () => {
    // v_rel = 0 when φ=0 and ω_x=0
    expect(throwAngle(1.0, 0, 0)).toBe(0);
  });

  it('is positive for positive cut angles', () => {
    for (const phi of [10, 20, 30, 45, 60, 75]) {
      const theta = throwAngle(1.341, 1.341 / BALL_RADIUS_M, phi * DEG);
      expect(theta).toBeGreaterThan(0);
    }
  });

  it('is monotonically increasing with cut angle for natural roll', () => {
    const v = 1.341;
    const omegaX = v / BALL_RADIUS_M;
    const angles = [5, 10, 15, 20, 30, 45, 60, 75];
    let prev = 0;
    for (const deg of angles) {
      const theta = throwAngle(v, omegaX, deg * DEG);
      expect(theta).toBeGreaterThan(prev);
      prev = theta;
    }
  });

  it('slow shots throw more than fast shots at moderate cut angles', () => {
    const phi = 30 * DEG;
    const tSlow = throwAngleNaturalRoll(SPEEDS.slow.mps, phi);
    const tMed = throwAngleNaturalRoll(SPEEDS.medium.mps, phi);
    const tFast = throwAngleNaturalRoll(SPEEDS.fast.mps, phi);
    expect(tSlow).toBeGreaterThan(tMed);
    expect(tMed).toBeGreaterThan(tFast);
  });

  // TP A-14 §6.1: peak throw for slow natural roll ~4–5° at large cut angles
  it('slow natural roll at large cut gives ~4-5° throw', () => {
    const theta = throwAngleNaturalRoll(SPEEDS.slow.mps, 60 * DEG);
    const thetaDeg = theta / DEG;
    expect(thetaDeg).toBeGreaterThan(3);
    expect(thetaDeg).toBeLessThan(6);
  });

  // TP A-14 §6.1: peak throw for fast natural roll ~1° at large cut angles
  it('fast natural roll at large cut gives ~1° throw', () => {
    const theta = throwAngleNaturalRoll(SPEEDS.fast.mps, 60 * DEG);
    const thetaDeg = theta / DEG;
    expect(thetaDeg).toBeGreaterThan(0.5);
    expect(thetaDeg).toBeLessThan(2);
  });

  // TP A-14 §6.2: at small cut angles with stun, throw is nearly speed-independent
  // (kinematics limit dominates). This is specific to stun (ω_x = 0).
  it('stun throw is nearly speed-independent at small cut angles', () => {
    const phi = 10 * DEG;
    const tSlow = throwAngle(SPEEDS.slow.mps, 0, phi);
    const tFast = throwAngle(SPEEDS.fast.mps, 0, phi);
    // Within a factor of 2 at small angles (kinematics limit dominates)
    expect(tSlow / tFast).toBeLessThan(2);
    expect(tSlow / tFast).toBeGreaterThan(0.5);
  });
});

describe('throwAngleNaturalRoll', () => {
  it('matches throwAngle with ω_x = v/R', () => {
    const v = 1.341;
    const phi = 30 * DEG;
    const fromConvenience = throwAngleNaturalRoll(v, phi);
    const fromDirect = throwAngle(v, v / BALL_RADIUS_M, phi);
    expect(fromConvenience).toBe(fromDirect);
  });
});
