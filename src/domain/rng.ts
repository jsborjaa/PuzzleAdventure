/** Deterministic LCG so jigsaw tabs stay stable across resumes. */
export class SeededRng {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed >>> 0 || 1;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  nextBool(): boolean {
    return this.next() > 0.5;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)]!;
  }

  between(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

export function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
