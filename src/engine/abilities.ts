// What each ability does, at tier 5 with tier-4 items (docs/mercs-starter-roster.md).
// Importing this module registers every ability with the engine.

import {
  ABILITIES, attack, buff, dealDamage, heal, isAlive, livingBoard, neighbours, other, processDeaths,
  BOARD_MAX, type AbilityFn, type Ctx,
} from './battle';
import type { Unit } from './types';

const has = (u: Unit, item: string) => u.item === item;

const friends = (ctx: Ctx, u: Unit) => livingBoard(ctx.s, u.side);
const foes = (ctx: Ctx, u: Unit) => livingBoard(ctx.s, other(u.side));
const isOrc = (u: Unit) => u.types.includes('Orc');

/** A random living enemy, avoiding Immune ones when possible. */
function randomFoe(ctx: Ctx, u: Unit, exclude: string[] = []): Unit | undefined {
  const all = foes(ctx, u).filter((f) => !exclude.includes(f.uid));
  const hittable = all.filter((f) => !f.immune);
  return ctx.pick(hittable.length ? hittable : all);
}

function status(ctx: Ctx, u: Unit, text: string, tone: 'good' | 'bad' | 'neutral' = 'good') {
  ctx.emit({ t: 'status', target: u.uid, text, tone });
}

// Numbers shared with text.ts so the card text and the rules never disagree.
export const N = {
  crusadersBlowHeal: 60,
  tauntHeal: 12, tauntTurns: 3,
  sealHeal: 15, sealAttack: 6, judgmentPerAlliance: 4,
  martialHealth: 5, martialFighterHealth: 10, gauntlets: 4,
  holdTurns: 2, holdHeal: 14, enlightenment: 8,
  sacrificeHeal: 10,
  fervorAttack: 15, gorehowlHeal: 20,
  slamDamage: 10, slamSlow: 5, haltingSash: 5,
  furyAttack: 8, bloodthirst: 4,
  arcaneShot: 14, elunesCharm: 15,
  salvo: 12, verdant: 4,
  graceSpeed: 3,
  doubleStrikeAttack: 5,
  whirl: 11, honed: 4,
  tribalAttack: 5, frostwolf: 4,
  rallyAttack: 5, rallyHealth: 10, helmAttack: 2, helmHealth: 4,
  onslaught: 12,
  luminance: 10, luminanceDebuff: 8, radiantDamage: 4, radiantDebuff: 4,
  flashHeal: 15, naaru: 20,
  atonement: 20, atonementStep: 3, atonementThreshold: 20, robes: 10,
  explosion: 8, powder: 5,
  bolt: 12, boltArcane: 3, manaRod: 4,
  missiles: 3, missileDamage: 20,
} as const;

export function atonementDamage(ctx: { s: { sides: Record<string, { healed: number }> } }, u: Unit) {
  const threshold = N.atonementThreshold - (has(u, 'robes-of-purity') ? N.robes : 0);
  const healed = ctx.s.sides[u.side]!.healed;
  return {
    damage: N.atonement + N.atonementStep * Math.floor(healed / threshold),
    remaining: threshold - (healed % threshold),
  };
}

const impl: Record<string, AbilityFn> = {
  // --- Cariel Roame -------------------------------------------------------
  'crusaders-blow': (ctx, u, t) => {
    const r = attack(ctx, u.uid, t!);
    if (!r.killed) return;
    heal(ctx, u.side, u.uid, N.crusadersBlowHeal);
    if (has(u, 'hammer-of-dawn')) {
      for (const f of friends(ctx, u)) if (f.uid !== u.uid) heal(ctx, u.side, f.uid, N.crusadersBlowHeal);
    }
  },
  taunt: (ctx, u) => {
    heal(ctx, u.side, u.uid, N.tauntHeal);
    u.taunt = Math.max(u.taunt, N.tauntTurns);
    status(ctx, u, 'Taunt');
  },
  'seal-of-light': (ctx, u, t) => {
    const target = ctx.u(t!);
    heal(ctx, u.side, target.uid, N.sealHeal);
    const alliance = friends(ctx, u).filter((f) => f.faction === 'Alliance').length;
    const bonus = has(u, 'tome-of-judgment') ? N.judgmentPerAlliance * alliance : 0;
    buff(ctx, target, N.sealAttack + bonus, 0);
  },

  // --- Cornelius Roame ----------------------------------------------------
  'martial-mastery': (ctx, u, t) => {
    const fighter = ctx.u(t!).role === 'FIGHTER';
    const gain = (fighter ? N.martialFighterHealth : N.martialHealth) + (has(u, 'striking-gauntlets') ? N.gauntlets : 0);
    buff(ctx, u, 0, gain);
    attack(ctx, u.uid, t!);
  },
  'hold-the-front': (ctx, u) => {
    u.taunt = Math.max(u.taunt, N.holdTurns);
    status(ctx, u, 'Taunt');
    const amount = N.holdHeal + (has(u, 'band-of-enlightenment') ? N.enlightenment : 0);
    for (const n of neighbours(ctx.s, u)) heal(ctx, u.side, n.uid, amount);
  },
  'blessing-of-sacrifice': (ctx, u, t) => {
    const target = ctx.u(t!);
    heal(ctx, u.side, target.uid, N.sacrificeHeal);
    target.guardedBy = u.uid;
    status(ctx, target, 'Guarded');
  },

  // --- Grommash Hellscream ------------------------------------------------
  'blood-fervor': (ctx, u, t) => {
    const r = attack(ctx, u.uid, t!);
    if (!r.killed) return;
    for (const f of friends(ctx, u)) if (f.faction === 'Horde') buff(ctx, f, N.fervorAttack, 0);
    if (has(u, 'gorehowl')) heal(ctx, u.side, u.uid, N.gorehowlHeal);
  },
  'staggering-slam': (ctx, u, t) => {
    ctx.emit({ t: 'projectile', from: u.uid, to: t!, school: null });
    const dmg = N.slamDamage + (has(u, 'halting-sash') ? N.haltingSash : 0);
    const hit = dealDamage(ctx, u.uid, t!, dmg, { kind: 'spell' });
    const victim = ctx.u(hit.to);
    if (isAlive(victim)) {
      victim.pendingSlow += N.slamSlow;
      status(ctx, victim, `Slowed +${N.slamSlow}`, 'bad');
    }
  },
  battlefury: (ctx, u, t) => {
    buff(ctx, u, N.furyAttack + (has(u, 'bloodthirst-amulet') ? N.bloodthirst : 0), 0);
    const splash = ctx.pick(neighbours(ctx.s, ctx.u(t!)));
    attack(ctx, u.uid, t!);
    if (splash) attack(ctx, u.uid, splash.uid);
  },

  // --- Tyrande Whisperwind ------------------------------------------------
  'arcane-shot': (ctx, u, t) => {
    const target = ctx.u(t!);
    const bonus = has(u, 'elunes-charm') && target.acted ? N.elunesCharm : 0;
    ctx.emit({ t: 'projectile', from: u.uid, to: target.uid, school: 'Arcane' });
    dealDamage(ctx, u.uid, target.uid, N.arcaneShot + bonus, { kind: 'spell', school: 'Arcane' });
  },
  'arcane-salvo': (ctx, u) => {
    const dmg = N.salvo + (has(u, 'verdant-recurve') ? N.verdant : 0);
    for (let wave = 0; wave < 6; wave++) {
      const first = randomFoe(ctx, u);
      if (!first) return;
      const second = randomFoe(ctx, u, [first.uid]);
      const targets = second ? [first, second] : [first];
      for (const f of targets) {
        ctx.emit({ t: 'projectile', from: u.uid, to: f.uid, school: 'Arcane' });
        dealDamage(ctx, u.uid, f.uid, dmg, { kind: 'spell', school: 'Arcane' });
      }
      if (processDeaths(ctx).length === 0) return; // "If any die, repeat this."
    }
  },
  'elunes-grace': (ctx, u) => {
    u.graceCharges = 1;
    status(ctx, u, "Elune's Grace");
  },

  // --- Blademaster Samuro -------------------------------------------------
  'double-strike': (ctx, u, t) => {
    const wasDamaged = ctx.u(t!).damagedThisTurn;
    attack(ctx, u.uid, t!);
    if (wasDamaged && isAlive(u) && isAlive(ctx.u(t!))) {
      buff(ctx, u, N.doubleStrikeAttack, 0);
      attack(ctx, u.uid, t!);
    }
  },
  'mirror-image': (ctx, u, t) => {
    const copies = has(u, 'sash-of-illusion') ? 2 : 1;
    for (let i = 0; i < copies; i++) {
      const board = ctx.s.sides[u.side].board;
      if (board.length >= BOARD_MAX || !isAlive(u)) return;
      const uid = `${u.side[0]}${ctx.s.nextUid++}-image`;
      const copy: Unit = {
        ...structuredClone(u),
        uid, name: 'Mirror Image', role: null, isMinion: true, expires: true, item: null, abilities: [],
        taunt: 0, immune: false, guardedBy: null, acted: true, damagedThisTurn: false, graceCharges: 0,
      };
      ctx.s.units[uid] = copy;
      board.splice(board.indexOf(u.uid) + 1, 0, uid);
      ctx.emit({ t: 'summon', unit: uid, by: u.uid });

      let target = ctx.s.units[t!];
      const foesNow = foes(ctx, u);
      const taunts = foesNow.filter((f) => f.taunt > 0);
      if (taunts.length && !(isAlive(target) && target.taunt > 0)) target = ctx.pick(taunts);
      if (!isAlive(target)) target = randomFoe(ctx, u);
      if (target) attack(ctx, uid, target.uid);
    }
  },
  'whirling-blade': (ctx, u) => {
    ctx.emit({ t: 'nova', from: u.uid, side: other(u.side), school: null });
    const dmg = N.whirl + (has(u, 'honed-blade') ? N.honed : 0);
    for (const f of foes(ctx, u)) dealDamage(ctx, u.uid, f.uid, dmg, { kind: 'spell' });
    processDeaths(ctx);
    if (isAlive(u)) {
      u.immune = true;
      status(ctx, u, 'Immune');
    }
  },

  // --- Rokara -------------------------------------------------------------
  'tribal-warfare': (ctx, u, t) => {
    if (friends(ctx, u).some((f) => f.uid !== u.uid && isOrc(f))) {
      buff(ctx, u, N.tribalAttack + (has(u, 'frostwolf-talisman') ? N.frostwolf : 0), 0);
    }
    attack(ctx, u.uid, t!);
  },
  'offensive-rally': (ctx, u) => {
    const helm = has(u, 'helm-of-inspiration');
    ctx.s.sides[u.side].rally = {
      attack: N.rallyAttack + (helm ? N.helmAttack : 0),
      health: N.rallyHealth + (helm ? N.helmHealth : 0),
    };
    for (const f of friends(ctx, u)) status(ctx, f, 'Rallied');
  },
  'orc-onslaught': (ctx, u, t) => {
    const reps = 1 + friends(ctx, u).filter((f) => f.uid !== u.uid && isOrc(f)).length;
    let target: Unit | undefined = ctx.u(t!);
    for (let i = 0; i < reps; i++) {
      if (!isAlive(target)) target = randomFoe(ctx, u);
      if (!target) return;
      ctx.emit({ t: 'projectile', from: u.uid, to: target.uid, school: null });
      dealDamage(ctx, u.uid, target.uid, N.onslaught, { kind: 'spell' });
      processDeaths(ctx);
    }
  },

  // --- Xyrella ------------------------------------------------------------
  'blinding-luminance': (ctx, u, t) => {
    const wand = has(u, 'radiant-wand');
    ctx.emit({ t: 'projectile', from: u.uid, to: t!, school: 'Holy' });
    const hit = dealDamage(ctx, u.uid, t!, N.luminance + (wand ? N.radiantDamage : 0), { kind: 'spell', school: 'Holy' });
    const victim = ctx.u(hit.to);
    if (isAlive(victim)) {
      const debuff = N.luminanceDebuff + (wand ? N.radiantDebuff : 0);
      victim.attackThisTurn -= debuff;
      status(ctx, victim, `-${debuff} Attack`, 'bad');
    }
  },
  'flash-heal': (ctx, u, t) => {
    heal(ctx, u.side, t!, N.flashHeal + (has(u, 'shard-of-the-naaru') ? N.naaru : 0));
  },
  atonement: (ctx, u, t) => {
    ctx.emit({ t: 'projectile', from: u.uid, to: t!, school: 'Holy' });
    dealDamage(ctx, u.uid, t!, atonementDamage(ctx, u).damage, { kind: 'spell', school: 'Holy' });
  },

  // --- Millhouse Manastorm ------------------------------------------------
  'arcane-explosion': (ctx, u) => {
    ctx.emit({ t: 'nova', from: u.uid, side: other(u.side), school: 'Arcane' });
    const dmg = N.explosion + (has(u, 'arcane-powder') ? N.powder : 0);
    for (const f of foes(ctx, u)) dealDamage(ctx, u.uid, f.uid, dmg, { kind: 'spell', school: 'Arcane' });
  },
  'arcane-bolt': (ctx, u, t) => {
    ctx.emit({ t: 'projectile', from: u.uid, to: t!, school: 'Arcane' });
    dealDamage(ctx, u.uid, t!, N.bolt, { kind: 'spell', school: 'Arcane' });
    const gain = N.boltArcane + (has(u, 'mana-rod') ? N.manaRod : 0);
    if (isAlive(u)) {
      u.arcaneDamage += gain;
      status(ctx, u, `+${gain} Arcane Damage`);
    }
  },
  'greater-arcane-missiles': (ctx, u) => {
    for (let i = 0; i < N.missiles; i++) {
      let target: Unit | undefined;
      if (has(u, 'ley-line-wand')) {
        const pool = foes(ctx, u).filter((f) => !f.immune);
        target = pool.sort((a, b) => a.health - b.health)[0] ?? randomFoe(ctx, u);
      } else {
        target = randomFoe(ctx, u);
      }
      if (!target) return;
      ctx.emit({ t: 'projectile', from: u.uid, to: target.uid, school: 'Arcane' });
      dealDamage(ctx, u.uid, target.uid, N.missileDamage, { kind: 'spell', school: 'Arcane' });
      processDeaths(ctx);
    }
  },
};

Object.assign(ABILITIES, impl);
