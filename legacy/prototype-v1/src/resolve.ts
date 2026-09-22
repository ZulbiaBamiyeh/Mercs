/**
 * Round resolution.
 *
 * The signature mechanic: both sides commit orders blind, then everything
 * resolves in ascending speed order. Speed is the whole game - it is why
 * killing a threat first can deny its ability outright, and why a slow
 * high-value ability is a read rather than a certainty.
 *
 * `resolveRound` is a pure function of (state, orders): it clones its input,
 * so the AI search can resolve thousands of hypothetical rounds against a
 * live battle without disturbing it.
 */

import { boardMercs, benchMercs, hasStatus, isDefeated } from './board.ts';
import { cloneBattle } from './clone.ts';
import { applyEffect, markDead, type EffectContext } from './effects.ts';
import { roundRng, type Rng } from './rng.ts';
import {
  BOARD_SLOTS,
  otherSide,
  type Ability,
  type BattleState,
  type MercState,
  type Order,
  type RoundOrders,
  type SideId,
} from './types.ts';

// ---------------------------------------------------------------------------
// Validation and legal-move enumeration
// ---------------------------------------------------------------------------

export function abilityOf(merc: MercState, abilityId: string): Ability | undefined {
  return merc.abilities.find((a) => a.id === abilityId);
}

export function isAbilityReady(merc: MercState, ability: Ability): boolean {
  return (merc.cooldowns[ability.id] ?? 0) <= 0;
}

/** Can this merc submit an order at all? */
export function canAct(merc: MercState): boolean {
  return merc.alive && merc.position !== null && !hasStatus(merc, 'stun');
}

export interface OrderOption {
  actorUid: string;
  abilityId: string;
  targetUid: string | undefined;
}

/**
 * Every legal (ability, target) pair for one merc.
 *
 * This is the branching factor the AI search works against, so it is
 * deliberately exact rather than heuristic - `test/action-space.test.ts`
 * measures it.
 */
export function optionsForMerc(state: BattleState, side: SideId, merc: MercState): OrderOption[] {
  if (!canAct(merc)) return [];
  const out: OrderOption[] = [];

  for (const ability of merc.abilities) {
    if (!isAbilityReady(merc, ability)) continue;

    switch (ability.targeting) {
      case 'none':
      case 'self':
        out.push({ actorUid: merc.uid, abilityId: ability.id, targetUid: undefined });
        break;
      case 'enemy':
        for (const target of boardMercs(state, otherSide(side))) {
          out.push({ actorUid: merc.uid, abilityId: ability.id, targetUid: target.uid });
        }
        break;
      case 'ally':
        for (const target of boardMercs(state, side)) {
          out.push({ actorUid: merc.uid, abilityId: ability.id, targetUid: target.uid });
        }
        break;
    }
  }
  return out;
}

export function validateOrders(state: BattleState, side: SideId, orders: readonly Order[]): void {
  const seen = new Set<string>();

  for (const order of orders) {
    if (seen.has(order.actorUid)) {
      throw new Error(`${order.actorUid} was given two orders this round`);
    }
    seen.add(order.actorUid);

    const actor = state.sides[side].party.find((m) => m.uid === order.actorUid);
    if (!actor) throw new Error(`${order.actorUid} is not on side ${side}`);
    if (!actor.alive) throw new Error(`${actor.name} is defeated and cannot act`);
    if (actor.position === null) throw new Error(`${actor.name} is benched and cannot act`);

    const ability = abilityOf(actor, order.abilityId);
    if (!ability) throw new Error(`${actor.name} has no ability ${order.abilityId}`);
    if (!isAbilityReady(actor, ability)) {
      throw new Error(`${ability.name} is on cooldown for ${actor.name}`);
    }

    const needsTarget = ability.targeting === 'enemy' || ability.targeting === 'ally';
    if (needsTarget) {
      if (order.targetUid === undefined) {
        throw new Error(`${ability.name} requires a target`);
      }
      const wanted = ability.targeting === 'enemy' ? otherSide(side) : side;
      const legal = boardMercs(state, wanted).some((m) => m.uid === order.targetUid);
      if (!legal) throw new Error(`${order.targetUid} is not a legal target for ${ability.name}`);
    }
  }
}

// ---------------------------------------------------------------------------
// The action queue
// ---------------------------------------------------------------------------

export interface QueuedAction {
  side: SideId;
  actorUid: string;
  abilityId: string;
  targetUid: string | undefined;
  speed: number;
  /** Position of this order within its own side's submission, 0-based. */
  submitIndex: number;
  /** Sort key that breaks speed ties; recorded so a replay can show it. */
  tiebreak: number;
}

/**
 * Order the round's actions.
 *
 * Ascending speed, then a tie-break rule with two halves:
 *
 * - **Within one side, ties follow submission order.** Committing a buff
 *   before the attack that should benefit from it is a real decision, so it
 *   must not be undone by a coin flip.
 * - **Across sides, ties are random.** Neither player can know whether their
 *   speed-5 ability lands before the enemy's, which is what keeps a mirrored
 *   speed from being a solved race.
 *
 * Both hold at once because each speed group draws one sorted key per side and
 * hands them out in submission order: same-side keys ascend by construction,
 * while the two sides' keys interleave at random. A single numeric sort key
 * also keeps the comparator transitive, which a pairwise rule would not be.
 */
export function buildQueue(state: BattleState, orders: RoundOrders, rng: Rng): QueuedAction[] {
  const actions: QueuedAction[] = [];

  for (const side of ['a', 'b'] as const) {
    orders[side].forEach((order, submitIndex) => {
      const actor = state.sides[side].party.find((m) => m.uid === order.actorUid)!;
      const ability = abilityOf(actor, order.abilityId)!;
      actions.push({
        side,
        actorUid: order.actorUid,
        abilityId: order.abilityId,
        targetUid: order.targetUid,
        speed: ability.speed,
        submitIndex,
        tiebreak: 0,
      });
    });
  }

  const speeds = [...new Set(actions.map((a) => a.speed))].sort((x, y) => x - y);
  const queue: QueuedAction[] = [];

  for (const speed of speeds) {
    const group = actions.filter((a) => a.speed === speed);

    // Fixed iteration order over speeds and sides keeps the draw sequence
    // deterministic, so a replay reproduces the same order exactly.
    for (const side of ['a', 'b'] as const) {
      const own = group
        .filter((a) => a.side === side)
        .sort((x, y) => x.submitIndex - y.submitIndex);
      if (own.length === 0) continue;

      const keys = Array.from({ length: own.length }, () => rng.next()).sort((x, y) => x - y);
      own.forEach((action, i) => { action.tiebreak = keys[i]!; });
    }

    group.sort((x, y) => x.tiebreak - y.tiebreak);
    queue.push(...group);
  }

  return queue;
}

// ---------------------------------------------------------------------------
// End of round
// ---------------------------------------------------------------------------

function tickEndOfRound(state: BattleState, rng: Rng): void {
  for (const sideId of ['a', 'b'] as const) {
    for (const merc of state.sides[sideId].party) {
      if (!merc.alive) continue;

      const ctx: EffectContext = {
        state,
        actor: merc,
        actorSide: sideId,
        ability: { id: 'end-of-round', name: 'End of round' } as Ability,
        chosenUid: undefined,
        rng,
      };

      for (const status of merc.statuses) {
        if (status.kind === 'dot') {
          merc.health -= status.magnitude;
          state.log.push({
            round: state.round,
            kind: 'dot',
            message: `${merc.name} suffers ${status.magnitude} from a lingering wound`,
            data: { uid: merc.uid, amount: status.magnitude },
          });
        } else if (status.kind === 'regen') {
          merc.health = Math.min(merc.maxHealth, merc.health + status.magnitude);
        }
      }

      if (merc.health <= 0) markDead(ctx, merc);

      // Expire statuses, undoing the ones that changed a derived stat.
      const expired = merc.statuses.filter((s) => s.remaining - 1 <= 0);
      for (const status of expired) {
        if (status.kind === 'attack-buff') merc.attack -= status.magnitude;
      }
      merc.statuses = merc.statuses
        .filter((s) => !expired.includes(s))
        .map((s) => ({ ...s, remaining: s.remaining - 1 }));

      for (const abilityId of Object.keys(merc.cooldowns)) {
        merc.cooldowns[abilityId] = Math.max(0, (merc.cooldowns[abilityId] ?? 0) - 1);
      }
    }
  }
}

/** Fill empty board slots from the bench, in party order. */
function refillBoard(state: BattleState): void {
  for (const sideId of ['a', 'b'] as const) {
    const side = state.sides[sideId];
    const waiting = benchMercs(state, sideId);
    let next = 0;

    for (let slot = 0; slot < BOARD_SLOTS; slot++) {
      if (side.board[slot] !== null) continue;
      const incoming = waiting[next++];
      if (!incoming) break;
      side.board[slot] = incoming.uid;
      incoming.position = slot;
      state.log.push({
        round: state.round,
        kind: 'deploy',
        message: `${incoming.name} steps onto the board`,
        data: { uid: incoming.uid, slot },
      });
    }
  }
}

function checkVictory(state: BattleState): void {
  const aDead = isDefeated(state.sides.a);
  const bDead = isDefeated(state.sides.b);
  if (aDead && bDead) state.winner = 'draw';
  else if (bDead) state.winner = 'a';
  else if (aDead) state.winner = 'b';
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

export interface ResolveOptions {
  /** Drop the log in the returned state. AI search passes this to save copying. */
  keepLog?: boolean;
  /**
   * Skip order validation. Only for callers that enumerated the orders from
   * `optionsForMerc` themselves and are resolving in a hot loop.
   */
  trustOrders?: boolean;
}

/**
 * Resolve one round. Returns a new state; the input is untouched.
 *
 * Throws on illegal orders - callers should enumerate with `optionsForMerc`
 * rather than guess.
 */
export function resolveRound(
  state: BattleState,
  orders: RoundOrders,
  options: ResolveOptions = {},
): BattleState {
  if (state.winner !== null) throw new Error('the battle is already decided');

  if (options.trustOrders !== true) {
    validateOrders(state, 'a', orders.a);
    validateOrders(state, 'b', orders.b);
  }

  const next = cloneBattle(state, { keepLog: options.keepLog ?? true });
  next.round += 1;

  const rng = roundRng(next.seed, next.round);
  const queue = buildQueue(next, orders, rng);

  for (const action of queue) {
    const actor = next.sides[action.side].party.find((m) => m.uid === action.actorUid)!;

    // Both of these are the mechanic working as intended: a faster ally killed
    // the actor, or stunned it, before its own ability came up.
    if (!actor.alive) {
      next.log.push({
        round: next.round,
        kind: 'denied',
        message: `${actor.name} is defeated before acting`,
        data: { uid: actor.uid },
      });
      continue;
    }
    if (hasStatus(actor, 'stun')) {
      next.log.push({
        round: next.round,
        kind: 'denied',
        message: `${actor.name} is stunned and cannot act`,
        data: { uid: actor.uid },
      });
      continue;
    }

    const ability = abilityOf(actor, action.abilityId)!;
    actor.cooldowns[ability.id] = ability.cooldown;

    next.log.push({
      round: next.round,
      kind: 'cast',
      message: `${actor.name} uses ${ability.name}`,
      data: { uid: actor.uid, abilityId: ability.id, speed: ability.speed },
    });

    const ctx: EffectContext = {
      state: next,
      actor,
      actorSide: action.side,
      ability,
      chosenUid: action.targetUid,
      rng,
    };
    for (const effect of ability.effects) applyEffect(ctx, effect);
  }

  tickEndOfRound(next, rng);
  refillBoard(next);
  checkVictory(next);
  return next;
}
