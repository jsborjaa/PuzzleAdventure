export type BoardShape = 'square' | 'landscape' | 'portrait';

const SQUARE_EPSILON = 0.08;

export function boardShape(width: number, height: number, epsilon = SQUARE_EPSILON): BoardShape {
  const max = Math.max(width, height);
  if (max <= 0) return 'square';
  if (Math.abs(width - height) / max < epsilon) return 'square';
  return width > height ? 'landscape' : 'portrait';
}
