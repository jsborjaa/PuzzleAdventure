import { describe, expect, it } from 'vitest';
import { canSnap, normalizeAngle } from './snapRules';

describe('snapRules', () => {
  const base = {
    x: 100,
    y: 100,
    angle: 0,
    correctX: 100,
    correctY: 100,
    isSolved: false,
  };

  it('snaps when close and upright', () => {
    expect(canSnap({ ...base, x: 110, y: 105 })).toBe(true);
  });

  it('rejects rotated or far pieces', () => {
    expect(canSnap({ ...base, angle: 90 })).toBe(false);
    expect(canSnap({ ...base, x: 200 })).toBe(false);
    expect(canSnap({ ...base, isSolved: true })).toBe(false);
  });

  it('normalizes angles', () => {
    expect(normalizeAngle(360)).toBe(0);
    expect(normalizeAngle(450)).toBe(90);
    expect(normalizeAngle(-90)).toBe(270);
  });
});
