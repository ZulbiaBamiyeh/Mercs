/**
 * Whole-battle invariants, checked by fuzzing.
 *
 * The resolver has a lot of interacting effects, and the failure mode that
 * matters is not a wrong damage number but a corrupt state - negative health,
 * a god on the board twice, a battle that never ends. Random play across many
 * seeds is the cheapest way to find those.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { greedyPolicy, seededRandomPolicy } from '../src/ai.ts';
import { createBattle, runBattle, type PartyEntry } from '../src/battle.ts';
import { ROSTER } from '../src/data/roster.ts';
import { resolveRound } from '../src/resolve.ts';
import { makeRng } from '../src/rng.ts';
import { BOARD_SLOTS, type BattleState } from '../src/types.ts';

function randomParty(seed: string, size = 6): PartyEntry[] {
  const rng = makeRng(seed);
  return rng.shuffled(ROSTER).slice(0, size).map((def) => ({
    def,
    level: 30,
    equippedId: def.equipment.length > 0 ? rng.pick(def.equipment).id : null,
  }));
}

/** Every invariant that must hold at every point in every battle. */
function assertSane(state: BattleState, context: string): void {
  for (const sideId of ['a', 'b'] as const) {
    const side = state.sides[sideId];

    for (const merc of side.party) {
      assert.ok(merc.health >= 0, `${context}: ${merc.name} has negative health`);
      assert.ok(merc.health <= merc.maxHealth, `${context}: ${merc.name} above max health`);
      assert.ok(merc.attack >= 0, `${context}: ${merc.name} has negative attack`);
      assert.ok(Number.isFinite(merc.attack), `${context}: ${merc.name} has non-finite attack`);

      if (!merc.alive) {
        assert.equal(merc.position, null, `${context}: ${merc.name} is dead but positioned`);
        assert.equal(merc.health, 0, `${context}: ${merc.name} is dead with health left`);
      }
      for (const status of merc.statuses) {
        assert.ok(status.remaining > 0, `${context}: ${merc.name} holds an expired status`);
      }
      for (const [abilityId, remaining] of Object.entries(merc.cooldowns)) {
        assert.ok(remaining >= 0, `${context}: ${merc.name}/${abilityId} has negative cooldown`);
      }
    }

    const onBoard = side.board.filter((uid): uid is string => uid !== null);
    assert.equal(new Set(onBoard).size, onBoard.length, `${context}: duplicate board entries`);
    assert.ok(side.board.length === BOARD_SLOTS, `${context}: board is not ${BOARD_SLOTS} slots`);

    for (const uid of onBoard) {
      const merc = side.party.find((m) => m.uid === uid);
      assert.ok(merc, `${context}: board holds unknown uid ${uid}`);
      assert.ok(merc.alive, `${context}: dead god ${merc.name} still on the board`);
    }

    // An empty slot is only legal when the bench is exhausted.
    const emptySlots = side.board.filter((uid) => uid === null).length;
    if (emptySlots > 0) {
      const benchAlive = side.party.filter((m) => m.alive && m.position === null).length;
      assert.equal(benchAlive, 0, `${context}: ${benchAlive} on the bench with ${emptySlots} slots open`);
    }
  }
}

describe('random play', () => {
  test('200 random battles finish without corrupting state', () => {
    for (let i = 0; i < 200; i++) {
      const seed = `fuzz-${i}`;
      const state = createBattle({
        seed,
        partyA: randomParty(`${seed}-a`),
        partyB: randomParty(`${seed}-b`),
      });

      const result = runBattle(
        state,
        seededRandomPolicy(`${seed}-pa`),
        seededRandomPolicy(`${seed}-pb`),
        40,
      );

      assertSane(result.final, seed);
      assert.ok(result.final.winner !== null, `${seed}: battle did not conclude`);
      assert.ok(result.rounds > 0, `${seed}: no rounds were played`);
    }
  });

  test('greedy play also finishes cleanly, and mostly beats random', () => {
    let greedyWins = 0;
    const games = 60;

    for (let i = 0; i < games; i++) {
      const seed = `greedy-${i}`;
      const party = randomParty(`${seed}-shared`);
      // Mirror match: identical parties, so only the policy differs.
      const state = createBattle({ seed, partyA: party, partyB: party });
      const result = runBattle(state, greedyPolicy, seededRandomPolicy(`${seed}-r`), 40);

      assertSane(result.final, seed);
      if (result.final.winner === 'a') greedyWins += 1;
    }

    // A one-ply heuristic is not strong, but losing a mirror match to uniform
    // random play would mean the scoring function is actively wrong.
    assert.ok(
      greedyWins / games > 0.6,
      `greedy won only ${greedyWins}/${games} mirror matches against random`,
    );
  });
});

describe('replay', () => {
  test('a recorded match replays to an identical final state', () => {
    const seed = 'replay-1';
    const partyA = randomParty('replay-a');
    const partyB = randomParty('replay-b');

    const first = runBattle(
      createBattle({ seed, partyA, partyB }),
      seededRandomPolicy('pa'),
      seededRandomPolicy('pb'),
      40,
    );

    // Replay from the seed and the recorded orders alone - no policies.
    let replayed = createBattle({ seed, partyA, partyB });
    for (const orders of first.history) {
      replayed = resolveRound(replayed, orders);
    }

    assert.deepEqual(replayed, first.final);
  });
});

describe('the round cap', () => {
  test('a stalemate is called a draw rather than looping forever', () => {
    // Two parties that can only heal each other can never resolve a winner.
    const healer = ROSTER.find((d) => d.id === 'isis')!;
    const party = [{ def: healer, level: 30, equippedId: null }];
    const state = createBattle({ seed: 'stall', partyA: party, partyB: party });

    const result = runBattle(
      state,
      (s, side) => [{ actorUid: s.sides[side].party[0]!.uid, abilityId: 'mothers-mending', targetUid: s.sides[side].party[0]!.uid }],
      (s, side) => [{ actorUid: s.sides[side].party[0]!.uid, abilityId: 'mothers-mending', targetUid: s.sides[side].party[0]!.uid }],
      10,
    );

    assert.equal(result.final.winner, 'draw');
    assert.equal(result.rounds, 10);
  });
});
