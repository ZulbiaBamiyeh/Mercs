/**
 * Baseline decision procedures.
 *
 * These are deliberately simple: a random policy for fuzzing and a greedy
 * one-ply policy for sanity checks and balance sweeps. The real opponent is a
 * per-round Nash solve over the joint action space (regret matching), which
 * needs the numbers `countJointOrders` reports here to be worth building -
 * so measuring comes first.
 */

import { boardMercs, enemyBoard } from './board.ts';
import { rawDamage } from './effects.ts';
import { makeRng, type Rng } from './rng.ts';
import { abilityOf, optionsForMerc, type OrderOption } from './resolve.ts';
import {
  hasRoleBonus,
  ROLE_BONUS_MULTIPLIER,
  type BattleState,
  type MercState,
  type Order,
  type SideId,
} from './types.ts';

// ---------------------------------------------------------------------------
// The action space
// ---------------------------------------------------------------------------

/** Legal options for every merc that can act, one list per merc. */
export function optionsBySide(state: BattleState, side: SideId): OrderOption[][] {
  return boardMercs(state, side)
    .map((merc) => optionsForMerc(state, side, merc))
    .filter((options) => options.length > 0);
}

/**
 * Size of one side's joint action space this round - the product of each
 * acting merc's option count. This is the branching factor a Nash solve has
 * to cover, so it decides whether full enumeration or sampling is the right
 * approach.
 */
export function countJointOrders(state: BattleState, side: SideId): number {
  return optionsBySide(state, side).reduce((total, options) => total * options.length, 1);
}

/**
 * Every joint order for one side, up to `limit`.
 *
 * Returns `{ truncated: true }` rather than silently capping, because a
 * search that quietly saw half the options is worse than one that knows it
 * needs to sample.
 */
export function enumerateJointOrders(
  state: BattleState,
  side: SideId,
  limit = 100_000,
): { orders: Order[][]; truncated: boolean } {
  const perMerc = optionsBySide(state, side);
  let combos: Order[][] = [[]];

  for (const options of perMerc) {
    const next: Order[][] = [];
    for (const combo of combos) {
      for (const option of options) {
        if (next.length >= limit) return { orders: next, truncated: true };
        next.push([...combo, toOrder(option)]);
      }
    }
    combos = next;
  }
  return { orders: combos, truncated: false };
}

function toOrder(option: OrderOption): Order {
  return option.targetUid === undefined
    ? { actorUid: option.actorUid, abilityId: option.abilityId }
    : { actorUid: option.actorUid, abilityId: option.abilityId, targetUid: option.targetUid };
}

// ---------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------

/** Uniformly random legal orders. The fuzzing workhorse. */
export function randomPolicy(rng: Rng) {
  return (state: BattleState, side: SideId): Order[] =>
    optionsBySide(state, side).map((options) => toOrder(rng.pick(options)));
}

/** Convenience wrapper: a random policy seeded from a string. */
export function seededRandomPolicy(seed: string) {
  return randomPolicy(makeRng(seed));
}

/**
 * Score one option in isolation. No lookahead, no opponent model - this is a
 * floor to measure a real search against, not a serious opponent.
 */
function scoreOption(state: BattleState, side: SideId, actor: MercState, option: OrderOption): number {
  const ability = abilityOf(actor, option.abilityId)!;
  const allies = boardMercs(state, side);
  const enemies = enemyBoard(state, side);
  let score = 0;

  for (const effect of ability.effects) {
    switch (effect.kind) {
      case 'damage':
      case 'multi-hit':
      case 'drain':
      case 'execute': {
        const hits = effect.kind === 'multi-hit' ? effect.hits : 1;
        const spread = effect.target === 'all-enemies' ? enemies : enemies.slice(0, 1);
        for (const target of spread) {
          const base = rawDamage(actor, effect.damage) * hits;
          const dealt = hasRoleBonus(actor.role, target.role) ? base * ROLE_BONUS_MULTIPLIER : base;
          // Overkill is wasted; a lethal hit is worth a bonus on top.
          score += Math.min(dealt, target.health) + (dealt >= target.health ? 15 : 0);
        }
        break;
      }
      case 'heal': {
        const spread = effect.target === 'all-allies' ? allies : allies.slice(0, 1);
        for (const target of spread) {
          score += Math.min(effect.amount, target.maxHealth - target.health) * 0.8;
        }
        break;
      }
      case 'apply-status': {
        const { kind, magnitude } = effect.status;
        if (kind === 'stun') score += 12;
        else if (kind === 'taunt') score += 6;
        else if (kind === 'dot') score += magnitude * 2;
        else score += magnitude * 1.5;
        break;
      }
      case 'revive':
        score += state.sides[side].party.some((m) => !m.alive) ? 40 : -100;
        break;
      default:
        score += 3;
    }
  }

  // Prefer the target the option actually names, when it names one.
  if (option.targetUid !== undefined) {
    const target = [...allies, ...enemies].find((m) => m.uid === option.targetUid);
    if (target) {
      const helping = ability.targeting === 'ally';
      score += helping
        ? (target.maxHealth - target.health) * 0.5
        : hasRoleBonus(actor.role, target.role)
          ? 10
          : 0;
    }
  }

  // Faster is better when scores are otherwise close: it lands before the
  // enemy can deny it.
  return score - ability.speed * 0.5;
}

/** Greedy one-ply policy: each merc independently takes its best-scoring option. */
export function greedyPolicy(state: BattleState, side: SideId): Order[] {
  return optionsBySide(state, side).map((options) => {
    const actor = state.sides[side].party.find((m) => m.uid === options[0]!.actorUid)!;
    let best = options[0]!;
    let bestScore = -Infinity;
    for (const option of options) {
      const score = scoreOption(state, side, actor, option);
      if (score > bestScore) {
        bestScore = score;
        best = option;
      }
    }
    return toOrder(best);
  });
}
