/**
 * Fast battle-state cloning.
 *
 * `structuredClone` is correct but deep-copies everything, and most of a
 * battle state is immutable content: ability definitions, their effect lists,
 * their rules text. Copying those every round made the clone ~85% of the cost
 * of `resolveRound`, which is the difference between an AI search that can
 * afford thousands of rollouts per decision and one that cannot.
 *
 * This clone copies exactly what resolution mutates and shares the rest by
 * reference. The invariant it relies on:
 *
 *   Ability objects and Effect objects are built once at battle setup and are
 *   never mutated afterwards.
 *
 * `test/clone.test.ts` checks this clone against `structuredClone` on real
 * battle states, so a future change that breaks the invariant shows up as a
 * failing test rather than a mystery aliasing bug.
 */

import type { BattleState, MercState, Side, SideId } from './types.ts';

function cloneMerc(merc: MercState): MercState {
  return {
    uid: merc.uid,
    defId: merc.defId,
    name: merc.name,
    role: merc.role,
    pantheon: merc.pantheon,
    level: merc.level,
    attack: merc.attack,
    maxHealth: merc.maxHealth,
    health: merc.health,
    // Statuses are mutated in place (shield decay, duration ticks), so both
    // the array and each entry need copying.
    statuses: merc.statuses.map((s) => ({ ...s })),
    cooldowns: { ...merc.cooldowns },
    // Immutable after setup - shared by reference deliberately.
    abilities: merc.abilities,
    equippedId: merc.equippedId,
    alive: merc.alive,
    position: merc.position,
  };
}

function cloneSide(side: Side): Side {
  return {
    id: side.id,
    party: side.party.map(cloneMerc),
    board: side.board.slice(),
  };
}

export interface CloneOptions {
  /**
   * Carry the log into the clone. AI search does not read the log, and a long
   * battle's log is the largest remaining thing to copy, so search passes
   * `false`.
   */
  keepLog?: boolean;
}

export function cloneBattle(state: BattleState, options: CloneOptions = {}): BattleState {
  const sides = {} as Record<SideId, Side>;
  sides.a = cloneSide(state.sides.a);
  sides.b = cloneSide(state.sides.b);

  return {
    seed: state.seed,
    round: state.round,
    sides,
    // Log entries are never mutated once appended, so a shallow copy is safe.
    log: options.keepLog === false ? [] : state.log.slice(),
    winner: state.winner,
  };
}
