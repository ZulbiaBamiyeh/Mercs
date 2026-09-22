/**
 * The demo's combat maths, as pure functions.
 *
 * Extracted from the component so the balance harness and the UI resolve a
 * round by exactly the same rules. A sim that re-implements the rules can only
 * tell you about itself.
 *
 * Mock rules, deliberately: no statuses, no damage over time, no bench. The
 * real engine lives in `src/`.
 */

import { ROLES, COUNTERS, ROLE_BONUS, TARGET } from './heroes.jsx';

/** An ability needs a target unless it is aimed at its own caster or the field. */
export const needsTarget = (skill) =>
  skill.target === TARGET.enemy || skill.target === TARGET.ally;

/** Damage a strike would land, role bonus included. */
export function strikeDamage(actor, skill, target) {
  const base = skill.isAttack ? actor.attack + (skill.bonus ?? 0) : (skill.power ?? 0);
  if (base <= 0) return { amount: 0, bonus: false };
  const bonus = Boolean(target) && COUNTERS[actor.role] === target.role;
  return { amount: bonus ? base * ROLE_BONUS : base, bonus };
}

/** Every hero an ability may be aimed at. */
export function rangeOf(heroes, hero, skill) {
  const living = (side) => heroes.filter((h) => h.side === side && h.health > 0).map((h) => h.id);
  const allies = living(hero.side);
  const foes = living(hero.side === 'player' ? 'enemy' : 'player');
  switch (skill.target) {
    case TARGET.self: return [hero.id];
    case TARGET.ally:
    case TARGET.allAllies: return allies;
    default: return foes;
  }
}

/**
 * Order the round. Ascending speed; same-side ties keep team order, so
 * sequencing your own heroes is a decision rather than a coin flip.
 */
export function buildQueue(heroes, orders) {
  const steps = [];
  for (const h of heroes) {
    if (h.health <= 0) continue;
    const order = orders[h.id];
    const skill = order && h.skills.find((s) => s.id === order.skillId);
    if (skill) steps.push({ heroId: h.id, skill, side: h.side, targetId: order.targetId });
  }
  return steps.sort((a, b) => a.skill.speed - b.skill.speed
    || (a.side === b.side ? 0 : a.side === 'player' ? -1 : 1));
}

/**
 * Apply one queued step. Returns the next board plus the events the UI
 * animates - so the UI never has to know the maths.
 */
export function applyStep(heroes, step) {
  const actor = heroes.find((h) => h.id === step.heroId);
  if (!actor || actor.health <= 0) return { heroes, events: [], skipped: true };

  const ids = rangeOf(heroes, actor, step.skill);
  const pool = heroes.filter((h) => ids.includes(h.id) && h.health > 0);
  const chosen = step.targetId && pool.find((h) => h.id === step.targetId);
  const targets = needsTarget(step.skill)
    // A chosen target may have died earlier in the round; fall back to the
    // weakest thing still in range rather than fizzling silently.
    ? [chosen || [...pool].sort((a, b) => a.health / a.maxHealth - b.health / b.maxHealth)[0]].filter(Boolean)
    : pool;

  const next = heroes.map((h) => ({ ...h }));
  const striker = next.find((x) => x.id === actor.id);
  const events = [];

  /** Shields soak first; returns what actually reached health. */
  const dealTo = (victim, raw) => {
    const soaked = Math.min(victim.shield, raw);
    victim.shield -= soaked;
    const through = raw - soaked;
    victim.health = Math.max(0, victim.health - through);
    return through;
  };

  for (const t of targets) {
    const target = next.find((x) => x.id === t.id);
    if (!target) continue;

    if (step.skill.heal) {
      const healed = Math.min(step.skill.heal, target.maxHealth - target.health);
      target.health += healed;
      if (healed > 0) events.push({ heroId: target.id, text: `+${healed}`, kind: 'heal' });
    }
    if (step.skill.shield) {
      target.shield += step.skill.shield;
      events.push({ heroId: target.id, text: 'warded', kind: 'word' });
    }

    const { amount, bonus } = strikeDamage(actor, step.skill, target);
    if (amount > 0) {
      const through = dealTo(target, amount);
      events.push({
        heroId: target.id,
        text: `-${through}${bonus ? ' ×2' : ''}`,
        kind: bonus ? 'crit' : 'dmg',
      });
    }
  }

  // The Attack keyword: the striker takes the defender's Attack back, and
  // takes it even if the blow was lethal - the trade is simultaneous.
  if (step.skill.isAttack && targets.length === 1 && striker) {
    const back = targets[0].attack;
    if (back > 0) {
      const through = dealTo(striker, back);
      events.push({ heroId: striker.id, text: `-${through}`, kind: 'dmg' });
    }
  }

  return { heroes: next, events, skipped: false };
}

/** End of round: cooldowns tick, and the ability just used goes on cooldown. */
export function tickCooldowns(heroes, orders) {
  return heroes.map((h) => {
    const used = orders[h.id]?.skillId;
    const cooldowns = { ...h.cooldowns };
    for (const key of Object.keys(cooldowns)) cooldowns[key] = Math.max(0, cooldowns[key] - 1);
    const skill = used && h.skills.find((s) => s.id === used);
    if (skill?.cooldown) cooldowns[used] = skill.cooldown;
    return { ...h, cooldowns };
  });
}

export function outcomeOf(heroes) {
  const alive = (side) => heroes.some((h) => h.side === side && h.health > 0);
  const players = alive('player');
  const foes = alive('enemy');
  if (players && !foes) return 'won';
  if (!players && foes) return 'lost';
  if (!players && !foes) return 'draw';
  return null;
}
