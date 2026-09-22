/**
 * The action space is a design constraint, not just a number.
 *
 * The planned opponent is a per-round Nash solve over joint orders, which is
 * only affordable while the payoff matrix stays small. Content can quietly
 * break that - give every god six targeting options and the matrix grows
 * quadratically. These tests fail loudly if it drifts.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { countJointOrders, enumerateJointOrders, optionsBySide, seededRandomPolicy } from '../src/ai.ts';
import { createBattle, type PartyEntry } from '../src/battle.ts';
import { ROSTER } from '../src/data/roster.ts';
import { resolveRound } from '../src/resolve.ts';
import { makeRng } from '../src/rng.ts';

function party(seed: string): PartyEntry[] {
  const rng = makeRng(seed);
  return rng.shuffled(ROSTER).slice(0, 6).map((def) => ({ def, level: 30, equippedId: null }));
}

/** Peak joint-order count seen over the first `rounds` rounds of random play. */
function peakBranching(seed: string, rounds = 8): number {
  let state = createBattle({ seed, partyA: party(`${seed}-a`), partyB: party(`${seed}-b`) });
  const policyA = seededRandomPolicy(`${seed}-pa`);
  const policyB = seededRandomPolicy(`${seed}-pb`);
  let peak = 0;

  for (let round = 0; round < rounds && state.winner === null; round++) {
    peak = Math.max(peak, countJointOrders(state, 'a'), countJointOrders(state, 'b'));
    state = resolveRound(
      state,
      { a: policyA(state, 'a'), b: policyB(state, 'b') },
      { keepLog: false },
    );
  }
  return peak;
}

describe('branching factor', () => {
  test('stays small enough for a full payoff matrix to be affordable', () => {
    let worst = 0;
    for (let i = 0; i < 40; i++) worst = Math.max(worst, peakBranching(`space-${i}`));

    // At ~27us per resolution, a 1000x1000 matrix would be 27 seconds. The
    // measured peak is an order of magnitude under that; this is the alarm.
    assert.ok(worst < 1000, `joint orders per side peaked at ${worst}, too wide for exact solving`);
    assert.ok(worst > 20, `joint orders peaked at only ${worst} - suspiciously few options`);
  });

  test('every god on the board has at least one legal option', () => {
    for (let i = 0; i < 20; i++) {
      const seed = `options-${i}`;
      const state = createBattle({ seed, partyA: party(`${seed}-a`), partyB: party(`${seed}-b`) });
      for (const side of ['a', 'b'] as const) {
        const perMerc = optionsBySide(state, side);
        assert.equal(perMerc.length, 3, `${seed}/${side}: not all board gods can act`);
        for (const options of perMerc) assert.ok(options.length > 0);
      }
    }
  });
});

describe('enumeration', () => {
  test('enumerates exactly the number it counts', () => {
    const seed = 'enum';
    const state = createBattle({ seed, partyA: party('enum-a'), partyB: party('enum-b') });

    const counted = countJointOrders(state, 'a');
    const { orders, truncated } = enumerateJointOrders(state, 'a');

    assert.equal(truncated, false);
    assert.equal(orders.length, counted);
  });

  test('every enumerated order is legal', () => {
    const seed = 'legal';
    const state = createBattle({ seed, partyA: party('legal-a'), partyB: party('legal-b') });
    const { orders } = enumerateJointOrders(state, 'a');

    for (const joint of orders) {
      // Resolution validates; an illegal order throws.
      assert.doesNotThrow(() => resolveRound(state, { a: joint, b: [] }, { keepLog: false }));
    }
  });

  test('reports truncation rather than silently capping', () => {
    const seed = 'trunc';
    const state = createBattle({ seed, partyA: party('trunc-a'), partyB: party('trunc-b') });
    const { orders, truncated } = enumerateJointOrders(state, 'a', 2);

    assert.equal(truncated, true);
    assert.ok(orders.length <= 2);
  });
});
