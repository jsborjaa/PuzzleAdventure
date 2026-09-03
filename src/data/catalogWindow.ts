/** How many campaign indexes on each side of the map center (window ≈ 21 cards). */
export const MAP_WINDOW_RADIUS = 10;

export function windowBounds(
  center: number,
  total: number,
  radius: number = MAP_WINDOW_RADIUS,
): { start: number; end: number } {
  if (total <= 0) return { start: 1, end: 0 };
  const c = Math.min(Math.max(1, center), total);
  return {
    start: Math.max(1, c - radius),
    end: Math.min(total, c + radius),
  };
}

export function shiftCenter(center: number, delta: number, total: number): number {
  if (total <= 0) return 1;
  return Math.min(Math.max(1, center + delta), total);
}

export function mergeExtraLevel<T extends { id: string }>(window: T[], extra: T | undefined): T[] {
  if (!extra) return window;
  if (window.some((row) => row.id === extra.id)) return window;
  return [...window, extra];
}
