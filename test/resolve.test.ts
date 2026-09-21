/**
 * Resolver mechanics.
 *
 * These are the rules the whole game rests on: speed order, the role
 * triangle, denial, and the purity guarantee the AI search depends on.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createBattle } from '../src/battle.ts';
import { findMerc } from '../src/board.ts';
import { resolveRound, buildQueue, optionsForMerc } from '../src/resolve.ts';
import { roundRng } from '../src/rng.ts';
import { damage, flat, heal, shield, status, stun, swing, taunt } from '../src/data/authoring.ts';
import type { BattleState, RoundOrders } from '../src/types.ts';
import { statBlock, testAbility } from './helpers.ts';

const hit = (id: string, speed: number, amount: number) =>
  testAbility({ id, speed, effects: [damage('chosen', flat(amount))], targeting: 'enemy' });

function battleOf(a: Parameters<typeof createBattle>[0]['partyA'], b: Parameters<typeof createBattle>[0]['partyB']): BattleState {
  return createBattle({ seed: 'test', partyA: a, partyB: b });
}

const uid = (state: BattleState, side: 'a' | 'b', index: number) => state.sides[side].party[index]!.uid;

describe('speed ordering', () => {
  test('the faster ability resolves first', () => {
    const fast = statBlock('fighter', 10, 100, [hit('fast', 1, 10)]);
    const slow = statBlock('fighter', 10, 100, [hit('slow', 9, 10)]);
    const state = battleOf([{ def: fast }], [{ def: slow }]);

    const queue = buildQueue(state, {
      a: [{ actorUid: uid(state, 'a', 0), abilityId: 'fast', targetUid: uid(state, 'b', 0) }],
      b: [{ actorUid: uid(state, 'b', 0), abilityId: 'slow', targetUid: uid(state, 'a', 0) }],
    }, roundRng('test', 1));

    assert.equal(queue[0]!.abilityId, 'fast');
    assert.equal(queue[1]!.abilityId, 'slow');
  });

  test('a lethal fast hit denies the slower ability entirely', () => {
    // 10 health, taking 20 damage at speed 1, trying to swing back at speed 9.
    const sniper = statBlock('fighter', 10, 100, [hit('snipe', 1, 20)]);
    const victim = statBlock('fighter', 10, 10, [hit('riposte', 9, 50)]);
    const state = battleOf([{ def: sniper }], [{ def: victim }]);

    const next = resolveRound(state, {
      a: [{ actorUid: uid(state, 'a', 0), abilityId: 'snipe', targetUid: uid(state, 'b', 0) }],
      b: [{ actorUid: uid(state, 'b', 0), abilityId: 'riposte', targetUid: uid(state, 'a', 0) }],
    });

    assert.equal(findMerc(next, uid(state, 'b', 0))!.alive, false);
    // The sniper is untouched: the riposte never happened.
    assert.equal(findMerc(next, uid(state, 'a', 0))!.health, 100);
    assert.ok(next.log.some((e) => e.kind === 'denied'));
  });

  test('speed ties are broken deterministically by the seed', () => {
    const left = statBlock('fighter', 10, 100, [hit('left', 5, 10)]);
    const right = statBlock('fighter', 10, 100, [hit('right', 5, 10)]);
    const state = battleOf([{ def: left }], [{ def: right }]);
    const orders: RoundOrders = {
      a: [{ actorUid: uid(state, 'a', 0), abilityId: 'left', targetUid: uid(state, 'b', 0) }],
      b: [{ actorUid: uid(state, 'b', 0), abilityId: 'right', targetUid: uid(state, 'a', 0) }],
    };

    const first = buildQueue(state, orders, roundRng('test', 1)).map((q) => q.abilityId);
    const again = buildQueue(state, orders, roundRng('test', 1)).map((q) => q.abilityId);
    assert.deepEqual(first, again);
  });
});

describe('the role triangle', () => {
  const cases = [
    { attacker: 'protector', defender: 'fighter' },
    { attacker: 'fighter', defender: 'caster' },
    { attacker: 'caster', defender: 'protector' },
  ] as const;

  for (const { attacker, defender } of cases) {
    test(`${attacker} deals double damage to ${defender}`, () => {
      const striker = statBlock(attacker, 10, 100, [hit('strike', 5, 10)]);
      const target = statBlock(defender, 10, 100, [hit('idle', 9, 0)]);
      const state = battleOf([{ def: striker }], [{ def: target }]);

      const next = resolveRound(state, {
        a: [{ actorUid: uid(state, 'a', 0), abilityId: 'strike', targetUid: uid(state, 'b', 0) }],
        b: [],
      });

      assert.equal(findMerc(next, uid(state, 'b', 0))!.health, 80, 'should take 20, not 10');
    });
  }

  test('the reverse matchup takes no bonus', () => {
    const striker = statBlock('fighter', 10, 100, [hit('strike', 5, 10)]);
    const target = statBlock('protector', 10, 100, [hit('idle', 9, 0)]);
    const state = battleOf([{ def: striker }], [{ def: target }]);

    const next = resolveRound(state, {
      a: [{ actorUid: uid(state, 'a', 0), abilityId: 'strike', targetUid: uid(state, 'b', 0) }],
      b: [],
    });
    assert.equal(findMerc(next, uid(state, 'b', 0))!.health, 90);
  });
});

describe('denial and control', () => {
  test('a stun applied by a faster ability denies the action', () => {
    const stunner = statBlock('fighter', 10, 100, [
      testAbility({ id: 'lock', speed: 1, targeting: 'enemy', effects: [stun('chosen', 1)] }),
    ]);
    const victim = statBlock('fighter', 10, 100, [hit('swing', 5, 30)]);
    const state = battleOf([{ def: stunner }], [{ def: victim }]);

    const next = resolveRound(state, {
      a: [{ actorUid: uid(state, 'a', 0), abilityId: 'lock', targetUid: uid(state, 'b', 0) }],
      b: [{ actorUid: uid(state, 'b', 0), abilityId: 'swing', targetUid: uid(state, 'a', 0) }],
    });

    assert.equal(findMerc(next, uid(state, 'a', 0))!.health, 100, 'the stunned swing should not land');
    assert.ok(next.log.some((e) => e.kind === 'denied' && e.message.includes('stunned')));
  });

  test('a stunned god cannot be given an order at all next round', () => {
    const victim = statBlock('fighter', 10, 100, [hit('swing', 5, 10)]);
    const state = battleOf([{ def: victim }], [{ def: victim }]);
    const target = state.sides.a.party[0]!;
    target.statuses.push({ kind: 'stun', magnitude: 0, remaining: 2, sourceAbility: 'test' });

    assert.deepEqual(optionsForMerc(state, 'a', target), []);
  });
});

describe('taunt', () => {
  test('a single-target hit is pulled to the taunting defender', () => {
    const striker = statBlock('fighter', 10, 100, [hit('strike', 5, 10)]);
    const wall = statBlock('fighter', 10, 100, [
      testAbility({ id: 'guard', speed: 1, targeting: 'self', effects: [taunt('self', 1)] }),
    ]);
    const squishy = statBlock('fighter', 10, 100, [hit('idle', 9, 0)]);
    const state = battleOf([{ def: striker }], [{ def: wall }, { def: squishy }]);

    const next = resolveRound(state, {
      a: [{ actorUid: uid(state, 'a', 0), abilityId: 'strike', targetUid: uid(state, 'b', 1) }],
      b: [{ actorUid: uid(state, 'b', 0), abilityId: 'guard' }],
    });

    assert.equal(findMerc(next, uid(state, 'b', 1))!.health, 100, 'the squishy target is spared');
    assert.equal(findMerc(next, uid(state, 'b', 0))!.health, 90, 'the wall took the hit');
  });

  test('area damage ignores taunt', () => {
    const sweeper = statBlock('fighter', 10, 100, [
      testAbility({ id: 'sweep', speed: 5, targeting: 'none', effects: [damage('all-enemies', flat(10))] }),
    ]);
    const wall = statBlock('fighter', 10, 100, [
      testAbility({ id: 'guard', speed: 1, targeting: 'self', effects: [taunt('self', 1)] }),
    ]);
    const other = statBlock('fighter', 10, 100, [hit('idle', 9, 0)]);
    const state = battleOf([{ def: sweeper }], [{ def: wall }, { def: other }]);

    const next = resolveRound(state, {
      a: [{ actorUid: uid(state, 'a', 0), abilityId: 'sweep' }],
      b: [{ actorUid: uid(state, 'b', 0), abilityId: 'guard' }],
    });

    assert.equal(findMerc(next, uid(state, 'b', 0))!.health, 90);
    assert.equal(findMerc(next, uid(state, 'b', 1))!.health, 90, 'the sweep hit both');
  });
});

describe('mitigation', () => {
  test('a shield absorbs damage and is consumed by it', () => {
    const striker = statBlock('fighter', 10, 100, [hit('strike', 5, 10)]);
    const guarded = statBlock('fighter', 10, 100, [
      testAbility({ id: 'ward', speed: 1, targeting: 'self', effects: [shield('self', 6, 2)] }),
    ]);
    const state = battleOf([{ def: striker }], [{ def: guarded }]);

    const next = resolveRound(state, {
      a: [{ actorUid: uid(state, 'a', 0), abilityId: 'strike', targetUid: uid(state, 'b', 0) }],
      b: [{ actorUid: uid(state, 'b', 0), abilityId: 'ward' }],
    });

    // 6 of the 10 soaked, so 4 lands.
    assert.equal(findMerc(next, uid(state, 'b', 0))!.health, 96);
  });

  test('immune takes nothing', () => {
    const striker = statBlock('fighter', 10, 100, [hit('strike', 5, 40)]);
    const immune = statBlock('fighter', 10, 100, [
      testAbility({ id: 'phase', speed: 1, targeting: 'self', effects: [status('self', 'immune', 0, 1)] }),
    ]);
    const state = battleOf([{ def: striker }], [{ def: immune }]);

    const next = resolveRound(state, {
      a: [{ actorUid: uid(state, 'a', 0), abilityId: 'strike', targetUid: uid(state, 'b', 0) }],
      b: [{ actorUid: uid(state, 'b', 0), abilityId: 'phase' }],
    });
    assert.equal(findMerc(next, uid(state, 'b', 0))!.health, 100);
  });

  test('a divine shield negates one hit, then expires', () => {
    const striker = statBlock('fighter', 10, 100, [
      testAbility({ id: 'twin', speed: 5, targeting: 'none', effects: [{ kind: 'multi-hit', target: 'random-enemy', damage: flat(10), hits: 2 }] }),
    ]);
    const guarded = statBlock('fighter', 10, 100, [
      testAbility({ id: 'bless', speed: 1, targeting: 'self', effects: [status('self', 'divine-shield', 0, Infinity)] }),
    ]);
    const state = battleOf([{ def: striker }], [{ def: guarded }]);

    const next = resolveRound(state, {
      a: [{ actorUid: uid(state, 'a', 0), abilityId: 'twin' }],
      b: [{ actorUid: uid(state, 'b', 0), abilityId: 'bless' }],
    });

    // First hit negated, second lands in full.
    assert.equal(findMerc(next, uid(state, 'b', 0))!.health, 90);
  });

  test('healing cannot exceed maximum health', () => {
    const medic = statBlock('caster', 10, 100, [
      testAbility({ id: 'mend', speed: 1, targeting: 'ally', effects: [heal('chosen', 999)] }),
    ]);
    const state = battleOf([{ def: medic }], [{ def: medic }]);
    state.sides.a.party[0]!.health = 50;

    const next = resolveRound(state, {
      a: [{ actorUid: uid(state, 'a', 0), abilityId: 'mend', targetUid: uid(state, 'a', 0) }],
      b: [],
    });
    assert.equal(findMerc(next, uid(state, 'a', 0))!.health, 100);
  });
});

describe('cooldowns', () => {
  test('an ability with a cooldown is unavailable on round one', () => {
    const def = statBlock('fighter', 10, 100, [
      hit('basic', 5, 10),
      testAbility({ id: 'heavy', speed: 6, cooldown: 2, effects: [damage('chosen', flat(30))] }),
    ]);
    const state = battleOf([{ def }], [{ def }]);
    const options = optionsForMerc(state, 'a', state.sides.a.party[0]!);
    assert.ok(options.every((o) => o.abilityId !== 'heavy'), 'heavy should start on cooldown');
    assert.ok(options.some((o) => o.abilityId === 'basic'));
  });

  test('using an ability puts it on cooldown, which ticks down each round', () => {
    const def = statBlock('fighter', 10, 100, [
      testAbility({ id: 'strike', speed: 5, cooldown: 1, effects: [damage('chosen', flat(5))] }),
      hit('filler', 4, 1),
    ]);
    const state = battleOf([{ def }], [{ def }]);
    // `strike` starts on a 1-round cooldown; spend a round to clear it.
    let current = resolveRound(state, {
      a: [{ actorUid: uid(state, 'a', 0), abilityId: 'filler', targetUid: uid(state, 'b', 0) }],
      b: [],
    });
    assert.equal(current.sides.a.party[0]!.cooldowns['strike'], 0);

    current = resolveRound(current, {
      a: [{ actorUid: uid(state, 'a', 0), abilityId: 'strike', targetUid: uid(state, 'b', 0) }],
      b: [],
    });
    // Set to 1 on use, then ticked at end of round.
    assert.equal(current.sides.a.party[0]!.cooldowns['strike'], 0);
  });

  test('an illegal order is rejected rather than silently dropped', () => {
    const def = statBlock('fighter', 10, 100, [
      testAbility({ id: 'heavy', speed: 6, cooldown: 3, effects: [damage('chosen', flat(30))] }),
      hit('basic', 5, 10),
    ]);
    const state = battleOf([{ def }], [{ def }]);

    assert.throws(
      () => resolveRound(state, {
        a: [{ actorUid: uid(state, 'a', 0), abilityId: 'heavy', targetUid: uid(state, 'b', 0) }],
        b: [],
      }),
      /cooldown/,
    );
  });
});

describe('the board', () => {
  test('a fallen god is replaced from the bench at end of round', () => {
    const striker = statBlock('fighter', 10, 100, [hit('strike', 1, 999)]);
    const frail = statBlock('fighter', 10, 5, [hit('idle', 9, 0)]);
    const reserve = statBlock('fighter', 10, 50, [hit('idle', 9, 0)]);
    const state = battleOf(
      [{ def: striker }],
      [{ def: frail }, { def: frail }, { def: frail }, { def: reserve }],
    );

    const next = resolveRound(state, {
      a: [{ actorUid: uid(state, 'a', 0), abilityId: 'strike', targetUid: uid(state, 'b', 0) }],
      b: [],
    });

    assert.equal(findMerc(next, uid(state, 'b', 0))!.alive, false);
    assert.equal(next.sides.b.board[0], uid(state, 'b', 3), 'the reserve filled the empty slot');
    assert.equal(findMerc(next, uid(state, 'b', 3))!.position, 0);
  });

  test('a battle is won when every enemy has fallen', () => {
    const striker = statBlock('fighter', 10, 100, [
      testAbility({ id: 'wipe', speed: 1, targeting: 'none', effects: [damage('all-enemies', flat(999))] }),
    ]);
    const frail = statBlock('fighter', 10, 5, [hit('idle', 9, 0)]);
    const state = battleOf([{ def: striker }], [{ def: frail }, { def: frail }]);

    const next = resolveRound(state, {
      a: [{ actorUid: uid(state, 'a', 0), abilityId: 'wipe' }],
      b: [],
    });
    assert.equal(next.winner, 'a');
  });
});

describe('purity and determinism', () => {
  test('resolveRound does not mutate the state it was given', () => {
    const def = statBlock('fighter', 10, 100, [hit('strike', 5, 10)]);
    const state = battleOf([{ def }], [{ def }]);
    const before = structuredClone(state);

    resolveRound(state, {
      a: [{ actorUid: uid(state, 'a', 0), abilityId: 'strike', targetUid: uid(state, 'b', 0) }],
      b: [{ actorUid: uid(state, 'b', 0), abilityId: 'strike', targetUid: uid(state, 'a', 0) }],
    });

    assert.deepEqual(state, before);
  });

  test('the same seed and orders produce byte-identical results', () => {
    const def = statBlock('fighter', 10, 100, [
      testAbility({ id: 'spray', speed: 5, targeting: 'none', effects: [{ kind: 'multi-hit', target: 'random-enemy', damage: flat(7), hits: 4 }] }),
    ]);
    const build = () => battleOf([{ def }], [{ def }, { def }, { def }]);

    const orders = (s: BattleState): RoundOrders => ({
      a: [{ actorUid: uid(s, 'a', 0), abilityId: 'spray' }],
      b: [],
    });

    const one = resolveRound(build(), orders(build()));
    const two = resolveRound(build(), orders(build()));
    assert.deepEqual(one, two);
  });

  test('a different seed changes random targeting', () => {
    const def = statBlock('fighter', 10, 200, [
      testAbility({ id: 'spray', speed: 5, targeting: 'none', effects: [{ kind: 'multi-hit', target: 'random-enemy', damage: flat(7), hits: 6 }] }),
    ]);
    const run = (seed: string) => {
      const state = createBattle({ seed, partyA: [{ def }], partyB: [{ def }, { def }, { def }] });
      const next = resolveRound(state, {
        a: [{ actorUid: state.sides.a.party[0]!.uid, abilityId: 'spray' }],
        b: [],
      });
      return next.sides.b.party.map((m) => m.health).join(',');
    };

    // Not a guarantee for any specific pair of seeds, but across these the
    // spread should differ - if it does not, the RNG is not being consumed.
    const spreads = new Set(['s1', 's2', 's3', 's4'].map(run));
    assert.ok(spreads.size > 1, 'random targeting should vary with the seed');
  });
});

describe('fizzling', () => {
  test('a single-target ability whose mark died says so in the log', () => {
    const sniper = statBlock('fighter', 10, 100, [hit('snipe', 1, 999)]);
    const slow = statBlock('fighter', 10, 100, [hit('slow', 9, 10)]);
    const frail = statBlock('fighter', 10, 5, [hit('idle', 5, 0)]);
    const state = battleOf([{ def: sniper }, { def: slow }], [{ def: frail }, { def: frail }]);

    // Both allies target the same frail enemy; the fast one kills it first.
    const next = resolveRound(state, {
      a: [
        { actorUid: uid(state, 'a', 0), abilityId: 'snipe', targetUid: uid(state, 'b', 0) },
        { actorUid: uid(state, 'a', 1), abilityId: 'slow', targetUid: uid(state, 'b', 0) },
      ],
      b: [],
    });

    assert.ok(
      next.log.some((e) => e.kind === 'fizzle'),
      'the wasted ability should be reported, not silently do nothing',
    );
    // The second attacker's damage went nowhere - the other enemy is untouched.
    assert.equal(findMerc(next, uid(state, 'b', 1))!.health, 5);
  });
});
