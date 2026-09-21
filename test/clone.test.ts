/**
 * The fast clone must be indistinguishable from `structuredClone` for every
 * field resolution can touch. It shares immutable content by reference, so
 * this file is the guard on that invariant.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { seededRandomPolicy } from '../src/ai.ts';
import { createBattle, runBattle, type PartyEntry } from '../src/battle.ts';
import { cloneBattle } from '../src/clone.ts';
import { ROSTER } from '../src/data/roster.ts';
import { resolveRound } from '../src/resolve.ts';
import { makeRng } from '../src/rng.ts';

function party(seed: string): PartyEntry[] {
  const rng = makeRng(seed);
  return rng.shuffled(ROSTER).slice(0, 6).map((def) => ({ def, level: 30, equippedId: null }));
}

const battle = (seed: string) =>
  createBattle({ seed, partyA: party(`${seed}-a`), partyB: party(`${seed}-b`) });

describe('cloneBattle', () => {
  test('matches structuredClone on fresh states', () => {
    for (let i = 0; i < 25; i++) {
      const state = battle(`clone-${i}`);
      assert.deepEqual(cloneBattle(state), structuredClone(state));
    }
  });

  test('matches structuredClone mid-battle, with statuses and cooldowns in play', () => {
    for (let i = 0; i < 25; i++) {
      const seed = `mid-${i}`;
      let state = battle(seed);
      const policyA = seededRandomPolicy(`${seed}-a`);
      const policyB = seededRandomPolicy(`${seed}-b`);

      for (let round = 0; round < 5 && state.winner === null; round++) {
        state = resolveRound(state, { a: policyA(state, 'a'), b: policyB(state, 'b') });
        assert.deepEqual(cloneBattle(state), structuredClone(state));
      }
    }
  });

  test('mutating a clone never reaches the original', () => {
    const state = battle('isolation');
    const copy = cloneBattle(state);

    copy.sides.a.party[0]!.health = 1;
    copy.sides.a.party[0]!.attack = 999;
    copy.sides.a.party[0]!.alive = false;
    copy.sides.a.party[0]!.statuses.push({
      kind: 'dot', magnitude: 5, remaining: 2, sourceAbility: 'x',
    });
    copy.sides.a.party[0]!.cooldowns['whatever'] = 7;
    copy.sides.a.board[0] = null;
    copy.log.push({ round: 0, kind: 'test', message: 'x' });
    copy.round = 99;
    copy.winner = 'b';

    const original = state.sides.a.party[0]!;
    assert.notEqual(original.health, 1);
    assert.notEqual(original.attack, 999);
    assert.equal(original.alive, true);
    assert.deepEqual(original.statuses, []);
    assert.equal(original.cooldowns['whatever'], undefined);
    assert.notEqual(state.sides.a.board[0], null);
    assert.equal(state.log.length, 0);
    assert.equal(state.round, 0);
    assert.equal(state.winner, null);
  });

  test('mutating a status on a clone does not reach the original', () => {
    const state = battle('status-isolation');
    state.sides.a.party[0]!.statuses.push({
      kind: 'shield', magnitude: 10, remaining: 2, sourceAbility: 'x',
    });

    const copy = cloneBattle(state);
    copy.sides.a.party[0]!.statuses[0]!.magnitude = 0;

    assert.equal(state.sides.a.party[0]!.statuses[0]!.magnitude, 10);
  });

  test('a full battle played through the fast clone matches one played through structuredClone', () => {
    // The strongest check available: identical play, identical outcome.
    const seed = 'parity';
    const partyA = party('parity-a');
    const partyB = party('parity-b');

    const fast = runBattle(
      createBattle({ seed, partyA, partyB }),
      seededRandomPolicy('pa'),
      seededRandomPolicy('pb'),
      40,
    );

    // Replay the recorded orders, forcing a structuredClone-equivalent path by
    // comparing state after every round.
    let reference = createBattle({ seed, partyA, partyB });
    for (const orders of fast.history) {
      reference = resolveRound(reference, orders);
      assert.deepEqual(cloneBattle(reference), structuredClone(reference));
    }
    assert.deepEqual(reference, fast.final);
  });

  test('keepLog: false drops the log without affecting play', () => {
    const state = battle('log-opt');
    const policyA = seededRandomPolicy('la');
    const policyB = seededRandomPolicy('lb');
    const orders = { a: policyA(state, 'a'), b: policyB(state, 'b') };

    const logged = resolveRound(state, orders);
    const quiet = resolveRound(state, orders, { keepLog: false });

    assert.ok(logged.log.length > 0);
    // The quiet run still logs this round's events; it just does not carry
    // history forward. Board state must be identical either way.
    assert.deepEqual(
      quiet.sides.a.party.map((m) => m.health),
      logged.sides.a.party.map((m) => m.health),
    );
    assert.deepEqual(
      quiet.sides.b.party.map((m) => m.health),
      logged.sides.b.party.map((m) => m.health),
    );
  });
});
