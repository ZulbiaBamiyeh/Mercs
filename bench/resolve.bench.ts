/**
 * Resolution throughput and branching factor.
 *
 * These two numbers decide the AI design. A per-round Nash solve needs to
 * evaluate joint action pairs, so the question is: how many pairs are there,
 * and how many resolutions per second can we afford? Run with `npm run bench`.
 */

import { countJointOrders, optionsBySide, seededRandomPolicy } from '../src/ai.ts';
import { createBattle, runBattle, type PartyEntry } from '../src/battle.ts';
import { ROSTER } from '../src/data/roster.ts';
import { resolveRound } from '../src/resolve.ts';
import { makeRng } from '../src/rng.ts';
import type { BattleState } from '../src/types.ts';

function party(seed: string): PartyEntry[] {
  const rng = makeRng(seed);
  return rng.shuffled(ROSTER).slice(0, 6).map((def) => ({
    def,
    level: 30,
    equippedId: def.equipment.length > 0 ? rng.pick(def.equipment).id : null,
  }));
}

function fullBattle(seed: string): BattleState {
  return createBattle({ seed, partyA: party(`${seed}-a`), partyB: party(`${seed}-b`) });
}

const time = <T>(label: string, iterations: number, fn: () => T): void => {
  fn(); // warm up
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) fn();
  const elapsedNs = Number(process.hrtime.bigint() - start);
  const perOp = elapsedNs / iterations;
  const perSecond = 1e9 / perOp;
  console.log(
    `  ${label.padEnd(34)} ${(perOp / 1000).toFixed(1).padStart(8)} us/op` +
      `  ${Math.round(perSecond).toLocaleString().padStart(12)} ops/sec`,
  );
};

console.log('\nBranching factor (full 6v6 parties at level 30)\n');

/**
 * Round 1 is unrepresentative: abilities with a cooldown start spent, so every
 * god has only its cheapest option. Sample across rounds instead.
 */
function branchingByRound(maxRound: number): Map<number, number[]> {
  const byRound = new Map<number, number[]>();

  for (let i = 0; i < 120; i++) {
    const seed = `bf-${i}`;
    let state = fullBattle(seed);
    const policyA = seededRandomPolicy(`${seed}-pa`);
    const policyB = seededRandomPolicy(`${seed}-pb`);

    for (let round = 1; round <= maxRound && state.winner === null; round++) {
      for (const side of ['a', 'b'] as const) {
        const counts = byRound.get(round) ?? [];
        counts.push(countJointOrders(state, side));
        byRound.set(round, counts);
      }
      state = resolveRound(
        state,
        { a: policyA(state, 'a'), b: policyB(state, 'b') },
        { keepLog: false },
      );
    }
  }
  return byRound;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

const byRound = branchingByRound(8);
console.log('  round   mean joint orders    max     mean payoff matrix');
let peakMean = 0;
for (const [round, counts] of [...byRound].sort((x, y) => x[0] - y[0])) {
  const avg = mean(counts);
  peakMean = Math.max(peakMean, avg);
  console.log(
    `  ${String(round).padStart(5)}   ${avg.toFixed(0).padStart(16)}` +
      `   ${Math.max(...counts).toString().padStart(6)}` +
      `   ${Math.round(avg * avg).toLocaleString().padStart(18)}`,
  );
}

const openingState = fullBattle('bf-opening');
const perMerc = optionsBySide(openingState, 'a').map((o) => o.length);
console.log(`\n  options per god on round 1        ${mean(perMerc).toFixed(1)}`);
console.log(`  peak mean joint orders            ${peakMean.toFixed(0)}`);
console.log(`  peak mean payoff matrix           ${Math.round(peakMean * peakMean).toLocaleString()} resolutions`);

console.log('\nThroughput\n');

const state = fullBattle('bench');
const policyA = seededRandomPolicy('bench-a');
const policyB = seededRandomPolicy('bench-b');
const orders = { a: policyA(state, 'a'), b: policyB(state, 'b') };

time('resolveRound (6v6, round 1)', 20_000, () => resolveRound(state, orders));
time('structuredClone of state only', 20_000, () => structuredClone(state));
time('countJointOrders', 20_000, () => countJointOrders(state, 'a'));
time('full battle, random policies', 2_000, () =>
  runBattle(fullBattle('x'), policyA, policyB, 40));

// What the two numbers together mean for the AI.
const perOpSeconds = (() => {
  const start = process.hrtime.bigint();
  for (let i = 0; i < 5_000; i++) resolveRound(state, orders);
  return Number(process.hrtime.bigint() - start) / 5_000 / 1e9;
})();

console.log('\nWhat this implies for a per-round Nash solve\n');
const matrix = peakMean * peakMean;
console.log(`  full enumeration at peak          ${(matrix * perOpSeconds * 1000).toFixed(0)}ms per decision`);
for (const budget of [1_000, 10_000, 50_000]) {
  console.log(
    `  ${budget.toLocaleString().padStart(6)} sampled resolutions        ` +
      `${(budget * perOpSeconds * 1000).toFixed(0).padStart(5)}ms per decision`,
  );
}
console.log('');
