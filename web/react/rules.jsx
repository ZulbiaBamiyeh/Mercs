/**
 * The demo's combat maths, as pure functions.
 *
 * Extracted from the component so the balance harness and the UI resolve a
 * round by exactly the same rules - a harness that re-implements the rules can
 * only tell you about itself.
 *
 * Models the parts of Mercenaries that `docs/mercenaries-reference.md` records
 * as confirmed: the Attack keyword's mutual damage, Taunt, Divine Shield,
 * ranked Retaliation, Bleed, and shields that **expire**. That last one is not
 * a detail: an earlier version let shields accumulate at cooldown 0 and the
 * harness found it made both Protectors unkillable and every well-played match
 * a draw.
 *
 * Still simplified against `src/`: no bench, no revive, no stealth.
 */

import { COUNTERS, ROLE_BONUS, TARGET } from './heroes.jsx';

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
 * Order the round.
 *
 * Ascending speed. Ties split two ways, as the reference records: **within one
 * side** they keep submission order, so sequencing your own heroes is a
 * decision rather than a coin flip; **across sides** they are random.
 *
 * The coin lives in `tieSeed` rather than `Math.random()` so the order the UI
 * previews is the order that actually resolves - one seed per round, and every
 * tied speed in that round is decided by it.
 */
export function buildQueue(heroes, orders, tieSeed = 1) {
  const steps = [];
  for (const h of heroes) {
    if (h.health <= 0) continue;
    const order = orders[h.id];
    const skill = order && h.skills.find((s) => s.id === order.skillId);
    if (skill) steps.push({ heroId: h.id, skill, side: h.side, targetId: order.targetId });
  }

  const playerFirstAt = (speed) => {
    const x = (Math.imul(tieSeed >>> 0, 2654435761) ^ Math.imul(speed, 40503)) >>> 0;
    return ((x >>> 13) & 1) === 0;
  };

  // Array.prototype.sort is stable, so returning 0 for a same-side tie leaves
  // submission order intact.
  return steps.sort((a, b) => {
    if (a.skill.speed !== b.skill.speed) return a.skill.speed - b.skill.speed;
    if (a.side === b.side) return 0;
    const playerFirst = playerFirstAt(a.skill.speed);
    const aFirst = a.side === 'player' ? playerFirst : !playerFirst;
    return aFirst ? -1 : 1;
  });
}

/** Fresh runtime state for a hero definition. */
export function spawn(def, side) {
  return {
    ...def,
    side,
    health: def.maxHealth,
    shield: 0,
    shieldRounds: 0,
    divineShield: false,
    tauntRounds: 0,
    retaliation: 0,
    retaliationRounds: 0,
    bleed: 0,
    bleedRounds: 0,
    cooldowns: Object.fromEntries(def.skills.map((s) => [s.id, s.cooldown])),
  };
}

/**
 * Apply one queued step. Returns the next board plus the events the UI
 * animates, so the UI never has to know the maths.
 */
export function applyStep(heroes, step) {
  const actor = heroes.find((h) => h.id === step.heroId);
  if (!actor || actor.health <= 0) return { heroes, events: [], skipped: true };

  const next = heroes.map((h) => ({ ...h }));
  const striker = next.find((x) => x.id === actor.id);
  const events = [];
  const say = (heroId, text, kind) => events.push({ heroId, text, kind });

  /** Divine Shield first, then a shield pool; returns what reached health. */
  const hurt = (victim, raw) => {
    if (raw <= 0 || victim.health <= 0) return 0;
    if (victim.divineShield) {
      victim.divineShield = false;
      say(victim.id, 'blocked', 'word');
      return 0;
    }
    const soaked = Math.min(victim.shield, raw);
    victim.shield -= soaked;
    if (victim.shield <= 0) victim.shieldRounds = 0;
    const through = raw - soaked;
    victim.health = Math.max(0, victim.health - through);
    return through;
  };

  /** A lone hostile hit is pulled to a defender with Taunt. */
  const throughTaunt = (intended) => {
    if (intended.side === actor.side || intended.tauntRounds > 0) return intended;
    const wall = next.find((h) => h.side === intended.side && h.health > 0 && h.tauntRounds > 0);
    if (!wall) return intended;
    say(wall.id, 'intercept', 'word');
    return wall;
  };

  const ids = rangeOf(heroes, actor, step.skill);
  const pool = heroes.filter((h) => ids.includes(h.id) && h.health > 0);
  const chosen = step.targetId && pool.find((h) => h.id === step.targetId);
  const picked = needsTarget(step.skill)
    // A chosen target may have died earlier in the round; fall back to the
    // weakest thing still in range rather than fizzling silently.
    ? [chosen || [...pool].sort((a, b) => a.health / a.maxHealth - b.health / b.maxHealth)[0]].filter(Boolean)
    : pool;

  const single = picked.length === 1;
  const targets = picked
    .map((t) => next.find((x) => x.id === t.id))
    .filter(Boolean)
    .map((t) => (single ? throughTaunt(t) : t));

  let drained = 0;

  for (const target of targets) {
    if (step.skill.heal) {
      const healed = Math.min(step.skill.heal, target.maxHealth - target.health);
      target.health += healed;
      if (healed > 0) say(target.id, `+${healed}`, 'heal');
    }
    if (step.skill.shield) {
      target.shield = Math.max(target.shield, step.skill.shield);
      target.shieldRounds = Math.max(target.shieldRounds, step.skill.shieldRounds ?? 2);
      say(target.id, 'warded', 'word');
    }
    if (step.skill.divineShield) {
      target.divineShield = true;
      say(target.id, 'blessed', 'word');
    }
    if (step.skill.taunt) {
      target.tauntRounds = Math.max(target.tauntRounds, step.skill.taunt);
      say(target.id, 'taunt', 'word');
    }
    if (step.skill.retaliation) {
      target.retaliation = Math.max(target.retaliation, step.skill.retaliation);
      target.retaliationRounds = Math.max(target.retaliationRounds, step.skill.retaliationRounds ?? 2);
      say(target.id, `retaliation ${step.skill.retaliation}`, 'word');
    }
    if (step.skill.cleanse) {
      target.bleed = 0;
      target.bleedRounds = 0;
      say(target.id, 'cleansed', 'word');
    }

    const { amount, bonus } = strikeDamage(actor, step.skill, target);
    if (amount > 0) {
      const through = hurt(target, amount);
      if (through > 0) {
        say(target.id, `-${through}${bonus ? ' ×2' : ''}`, bonus ? 'crit' : 'dmg');
        drained += through;
      }
      if (step.skill.bleed) {
        target.bleed = Math.max(target.bleed, step.skill.bleed);
        target.bleedRounds = Math.max(target.bleedRounds, step.skill.bleedRounds ?? 2);
      }
      // Retaliation answers a hit on any hero that has it up. Ranked keyword,
      // so the number lives on the keyword itself.
      if (target.retaliationRounds > 0 && target.retaliation > 0 && target.side !== actor.side) {
        const back = hurt(striker, target.retaliation);
        if (back > 0) say(striker.id, `-${back}`, 'dmg');
      }
    }
  }

  if (step.skill.drain && drained > 0) {
    const healed = Math.min(Math.floor(drained / 2), striker.maxHealth - striker.health);
    if (healed > 0) {
      striker.health += healed;
      say(striker.id, `+${healed}`, 'heal');
    }
  }

  // The Attack keyword: the striker takes the defender's Attack back, and
  // takes it even if the blow was lethal - the trade is simultaneous.
  if (step.skill.isAttack && targets.length === 1 && striker) {
    const back = hurt(striker, targets[0].attack);
    if (back > 0) say(striker.id, `-${back}`, 'dmg');
  }

  return { heroes: next, events, skipped: false };
}

/**
 * End of round: bleed ticks, every duration decrements, cooldowns tick, and
 * the ability just used goes on cooldown.
 */
export function endRound(heroes, orders) {
  const events = [];
  const next = heroes.map((h) => {
    const hero = { ...h };
    if (hero.health > 0 && hero.bleedRounds > 0 && hero.bleed > 0) {
      hero.health = Math.max(0, hero.health - hero.bleed);
      events.push({ heroId: hero.id, text: `-${hero.bleed}`, kind: 'dmg' });
    }

    hero.shieldRounds = Math.max(0, hero.shieldRounds - 1);
    if (hero.shieldRounds === 0) hero.shield = 0;
    hero.tauntRounds = Math.max(0, hero.tauntRounds - 1);
    hero.retaliationRounds = Math.max(0, hero.retaliationRounds - 1);
    if (hero.retaliationRounds === 0) hero.retaliation = 0;
    hero.bleedRounds = Math.max(0, hero.bleedRounds - 1);
    if (hero.bleedRounds === 0) hero.bleed = 0;

    const used = orders[hero.id]?.skillId;
    const cooldowns = { ...hero.cooldowns };
    for (const key of Object.keys(cooldowns)) cooldowns[key] = Math.max(0, cooldowns[key] - 1);
    const skill = used && hero.skills.find((s) => s.id === used);
    if (skill?.cooldown) cooldowns[used] = skill.cooldown;
    hero.cooldowns = cooldowns;

    return hero;
  });
  return { heroes: next, events };
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

/**
 * A capped-out match is decided on remaining health share rather than called a
 * draw - a stalled clock is not a result anyone wants to look at.
 */
export function decideOnHealth(heroes) {
  const share = (side) => heroes
    .filter((h) => h.side === side)
    .reduce((a, h) => a + h.health / h.maxHealth, 0);
  const mine = share('player');
  const theirs = share('enemy');
  if (Math.abs(mine - theirs) < 0.05) return 'draw';
  return mine > theirs ? 'won' : 'lost';
}
