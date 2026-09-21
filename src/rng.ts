/**
 * Deterministic RNG.
 *
 * Every random decision in a battle (speed tie-breaks, random targeting,
 * split damage) must be reproducible from the match seed alone, so a match
 * can be persisted as `(initialState, seed, ordersPerRound[])` and replayed
 * byte-identically on any client. Nothing in the engine may call Math.random.
 */

/** Hash an arbitrary string into a 32-bit integer (FNV-1a). */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [0, boundExclusive). */
  int(boundExclusive: number): number;
  /** Uniform element of `items`. Throws on an empty array. */
  pick<T>(items: readonly T[]): T;
  /** Fisher-Yates copy; leaves the input untouched. */
  shuffled<T>(items: readonly T[]): T[];
}

/** mulberry32 - small, fast, good enough for game decisions. */
export function makeRng(seed: number | string): Rng {
  let state = (typeof seed === 'string' ? hashString(seed) : seed >>> 0) || 1;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (boundExclusive: number): number => {
    if (boundExclusive <= 0) throw new RangeError(`bound must be > 0, got ${boundExclusive}`);
    return Math.floor(next() * boundExclusive);
  };

  return {
    next,
    int,
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new RangeError('cannot pick from an empty array');
      return items[int(items.length)]!;
    },
    shuffled<T>(items: readonly T[]): T[] {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(i + 1);
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    },
  };
}

/**
 * Derive an independent stream for one round.
 *
 * Each round gets its own RNG so that resolving round 7 does not depend on
 * how many random calls rounds 1-6 happened to make. That keeps a round's
 * outcome a pure function of (seed, roundNumber, orders), which is what lets
 * the AI search re-resolve hypothetical rounds without disturbing the match.
 */
export function roundRng(matchSeed: string, round: number): Rng {
  return makeRng(`${matchSeed}:round:${round}`);
}
