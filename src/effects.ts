/**
 * Effect resolution.
 *
 * Abilities are data: a list of `Effect` records. This module is the only
 * place that interprets them, so a new mercenary needs no code at all and a
 * new *kind* of effect needs exactly one branch in `applyEffect`.
 *
 * Everything here mutates `ctx.state` in place and appends to the log. Order
 * of application within one ability is the order the effects are authored in.
 */

import {
  adjacentTo,
  boardMercs,
  enemyBoard,
  findMerc,
  getStatus,
  hasStatus,
  highestAttack,
  lowestHealth,
  statusMagnitude,
} from './board.ts';
import type { Rng } from './rng.ts';
import {
  hasRoleBonus,
  otherSide,
  ROLE_BONUS_MULTIPLIER,
  type Ability,
  type BattleState,
  type DamageSpec,
  type Effect,
  type MercState,
  type Selector,
  type SideId,
} from './types.ts';

export interface EffectContext {
  state: BattleState;
  actor: MercState;
  actorSide: SideId;
  ability: Ability;
  /** The uid the controlling player picked, if the ability required a pick. */
  chosenUid: string | undefined;
  rng: Rng;
}

function log(ctx: EffectContext, kind: string, message: string, data?: Record<string, unknown>): void {
  ctx.state.log.push(
    data === undefined
      ? { round: ctx.state.round, kind, message }
      : { round: ctx.state.round, kind, message, data },
  );
}

// ---------------------------------------------------------------------------
// Target selection
// ---------------------------------------------------------------------------

/**
 * A lone hostile target is pulled to a taunting defender. Deliberately does
 * not apply to area effects - taunt should protect against a focused hit, not
 * soak a sweep.
 */
function redirectForTaunt(ctx: EffectContext, target: MercState): MercState {
  const defendingSide = otherSide(ctx.actorSide);
  if (!ctx.state.sides[defendingSide].party.some((m) => m.uid === target.uid)) return target;
  if (hasStatus(target, 'taunt')) return target;

  const taunter = boardMercs(ctx.state, defendingSide).find((m) => hasStatus(m, 'taunt'));
  if (!taunter) return target;

  log(ctx, 'taunt', `${taunter.name} intercepts the attack meant for ${target.name}`, {
    from: target.uid,
    to: taunter.uid,
  });
  return taunter;
}

export function selectTargets(ctx: EffectContext, selector: Selector): MercState[] {
  const { state, actor, actorSide, rng } = ctx;
  const allies = boardMercs(state, actorSide);
  const enemies = enemyBoard(state, actorSide);

  const single = (merc: MercState | undefined): MercState[] =>
    merc && merc.alive ? [redirectForTaunt(ctx, merc)] : [];

  switch (selector) {
    case 'chosen': {
      // A single-target ability whose mark died earlier in the round fizzles.
      // That is the whole point of speed: killing the threat first denies it.
      if (ctx.chosenUid === undefined) return [];
      return single(findMerc(state, ctx.chosenUid));
    }
    case 'self':
      return actor.alive ? [actor] : [];
    case 'all-enemies':
      return enemies;
    case 'all-allies':
      return allies;
    case 'other-allies':
      return allies.filter((m) => m.uid !== actor.uid);
    case 'random-enemy':
      return enemies.length === 0 ? [] : single(rng.pick(enemies));
    case 'lowest-health-enemy':
      return single(lowestHealth(enemies));
    case 'lowest-health-ally':
      return lowestHealth(allies) ? [lowestHealth(allies)!] : [];
    case 'highest-attack-enemy':
      return single(highestAttack(enemies));
    case 'chosen-and-adjacent': {
      if (ctx.chosenUid === undefined) return [];
      const primary = findMerc(state, ctx.chosenUid);
      if (!primary?.alive) return [];
      return [primary, ...adjacentTo(state, primary)];
    }
  }
}

// ---------------------------------------------------------------------------
// Damage
// ---------------------------------------------------------------------------

/** Raw damage before role bonus and mitigation. */
export function rawDamage(source: MercState, spec: DamageSpec): number {
  const flat = spec.flat ?? 0;
  const scaled = spec.attackScale === undefined ? 0 : Math.floor(source.attack * spec.attackScale);
  return Math.max(0, flat + scaled);
}

export interface DamageResult {
  dealt: number;
  absorbed: number;
  roleBonus: boolean;
  negated: boolean;
  killed: boolean;
}

export function dealDamage(
  ctx: EffectContext,
  source: MercState,
  target: MercState,
  spec: DamageSpec,
): DamageResult {
  const base = rawDamage(source, spec);
  const roleBonus = hasRoleBonus(source.role, target.role);
  let amount = roleBonus ? base * ROLE_BONUS_MULTIPLIER : base;

  if (!target.alive) {
    return { dealt: 0, absorbed: 0, roleBonus, negated: true, killed: false };
  }

  if (hasStatus(target, 'immune')) {
    log(ctx, 'immune', `${target.name} is immune and takes no damage`);
    return { dealt: 0, absorbed: 0, roleBonus, negated: true, killed: false };
  }

  const divine = getStatus(target, 'divine-shield');
  if (divine) {
    target.statuses = target.statuses.filter((s) => s !== divine);
    log(ctx, 'divine-shield', `${target.name}'s shield absorbs the hit entirely`);
    return { dealt: 0, absorbed: amount, roleBonus, negated: true, killed: false };
  }

  // Shields soak damage and are consumed by what they soak.
  let absorbed = 0;
  if (amount > 0 && statusMagnitude(target, 'shield') > 0) {
    for (const status of target.statuses) {
      if (status.kind !== 'shield' || amount <= 0) continue;
      const soaked = Math.min(status.magnitude, amount);
      status.magnitude -= soaked;
      amount -= soaked;
      absorbed += soaked;
    }
    target.statuses = target.statuses.filter((s) => !(s.kind === 'shield' && s.magnitude <= 0));
  }

  target.health -= amount;
  const killed = target.health <= 0;
  if (killed) target.health = 0;

  log(
    ctx,
    'damage',
    `${source.name} hits ${target.name} for ${amount}` +
      (roleBonus ? ' (role bonus)' : '') +
      (absorbed > 0 ? ` (${absorbed} absorbed)` : ''),
    { source: source.uid, target: target.uid, amount, absorbed, roleBonus },
  );

  if (killed) markDead(ctx, target);
  return { dealt: amount, absorbed, roleBonus, negated: false, killed };
}

export function markDead(ctx: EffectContext, merc: MercState): void {
  if (!merc.alive) return;
  merc.alive = false;
  merc.health = 0;
  merc.statuses = [];
  log(ctx, 'death', `${merc.name} is defeated`, { uid: merc.uid });

  // Vacate the board slot; the bench fills it at end of round, not now, so a
  // replacement cannot be hit by abilities still resolving this round.
  for (const sideId of ['a', 'b'] as const) {
    const board = ctx.state.sides[sideId].board;
    const slot = board.indexOf(merc.uid);
    if (slot !== -1) board[slot] = null;
  }
  merc.position = null;
}

export function healMerc(ctx: EffectContext, target: MercState, amount: number): number {
  if (!target.alive || amount <= 0) return 0;
  const healed = Math.min(amount, target.maxHealth - target.health);
  target.health += healed;
  if (healed > 0) {
    log(ctx, 'heal', `${target.name} recovers ${healed}`, { target: target.uid, amount: healed });
  }
  return healed;
}

// ---------------------------------------------------------------------------
// Effect dispatch
// ---------------------------------------------------------------------------

export function applyEffect(ctx: EffectContext, effect: Effect): void {
  switch (effect.kind) {
    case 'damage': {
      for (const target of selectTargets(ctx, effect.target)) {
        dealDamage(ctx, ctx.actor, target, effect.damage);
      }
      break;
    }

    case 'multi-hit': {
      for (let hit = 0; hit < effect.hits; hit++) {
        // Re-select per hit so a random-target flurry spreads, and so hits
        // stop landing on something that died mid-flurry.
        const targets = selectTargets(ctx, effect.target);
        if (targets.length === 0) break;
        for (const target of targets) dealDamage(ctx, ctx.actor, target, effect.damage);
      }
      break;
    }

    case 'drain': {
      for (const target of selectTargets(ctx, effect.target)) {
        const result = dealDamage(ctx, ctx.actor, target, effect.damage);
        healMerc(ctx, ctx.actor, Math.floor(result.dealt * effect.healFraction));
      }
      break;
    }

    case 'execute': {
      for (const target of selectTargets(ctx, effect.target)) {
        const wounded = target.health <= target.maxHealth * effect.threshold;
        const spec = wounded
          ? {
              flat: (effect.damage.flat ?? 0) + (effect.bonus.flat ?? 0),
              attackScale: (effect.damage.attackScale ?? 0) + (effect.bonus.attackScale ?? 0),
            }
          : effect.damage;
        if (wounded) log(ctx, 'execute', `${target.name} is wounded - the blow lands harder`);
        dealDamage(ctx, ctx.actor, target, spec);
      }
      break;
    }

    case 'heal': {
      for (const target of selectTargets(ctx, effect.target)) {
        healMerc(ctx, target, effect.amount);
      }
      break;
    }

    case 'apply-status': {
      for (const target of selectTargets(ctx, effect.target)) {
        if (!target.alive) continue;
        target.statuses.push({ ...effect.status, sourceAbility: ctx.ability.id });
        if (effect.status.kind === 'attack-buff') {
          target.attack += effect.status.magnitude;
        }
        log(ctx, 'status', `${target.name} gains ${effect.status.kind}`, {
          target: target.uid,
          kind: effect.status.kind,
          magnitude: effect.status.magnitude,
        });
      }
      break;
    }

    case 'cleanse': {
      const harmful: ReadonlySet<string> = new Set(['dot', 'stun']);
      for (const target of selectTargets(ctx, effect.target)) {
        const before = target.statuses.length;
        target.statuses = target.statuses.filter((s) => !harmful.has(s.kind));
        if (target.statuses.length !== before) {
          log(ctx, 'cleanse', `${target.name} is cleansed`, { target: target.uid });
        }
      }
      break;
    }

    case 'dispel': {
      for (const target of selectTargets(ctx, effect.target)) {
        for (const status of target.statuses) {
          if (status.kind === 'attack-buff') target.attack -= status.magnitude;
        }
        if (target.statuses.length > 0) {
          log(ctx, 'dispel', `${target.name} loses all effects`, { target: target.uid });
        }
        target.statuses = [];
      }
      break;
    }

    case 'cooldown-reduce': {
      for (const target of selectTargets(ctx, effect.target)) {
        for (const abilityId of Object.keys(target.cooldowns)) {
          const remaining = target.cooldowns[abilityId] ?? 0;
          target.cooldowns[abilityId] = Math.max(0, remaining - effect.rounds);
        }
        log(ctx, 'cooldown', `${target.name}'s abilities refresh`, { target: target.uid });
      }
      break;
    }

    case 'revive': {
      const fallen = ctx.state.sides[ctx.actorSide].party.filter((m) => !m.alive);
      if (fallen.length === 0) break;
      const target = ctx.rng.pick(fallen);
      target.alive = true;
      target.health = Math.max(1, Math.floor(target.maxHealth * effect.healthFraction));
      target.statuses = [];
      log(ctx, 'revive', `${target.name} returns to the fight at ${target.health} health`, {
        target: target.uid,
      });
      break;
    }
  }
}
