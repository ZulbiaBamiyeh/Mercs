// What the original roster's abilities do. Numbers come from O in
// originals.ts, which the card text also uses.

import {
  ABILITIES, attack, buff, dealDamage, effectiveAttack, heal, isAlive, livingBoard, neighbours, other,
  processDeaths, summon, type AbilityFn, type Ctx,
} from './battle';
import { O } from './originals';
import type { School, Unit } from './types';

const has = (u: Unit, item: string) => u.item === item;
const friends = (ctx: Ctx, u: Unit) => livingBoard(ctx.s, u.side);
const foes = (ctx: Ctx, u: Unit) => livingBoard(ctx.s, other(u.side));

function status(ctx: Ctx, u: Unit, text: string, tone: 'good' | 'bad' | 'neutral' = 'good') {
  ctx.emit({ t: 'status', target: u.uid, text, tone });
}

/** A random enemy that can be targeted: not Stealthed, preferring non-Immune. */
function randomFoe(ctx: Ctx, u: Unit): Unit | undefined {
  const all = foes(ctx, u).filter((f) => !f.stealth);
  const pool = all.filter((f) => !f.immune);
  return ctx.pick(pool.length ? pool : all.length ? all : foes(ctx, u));
}

/** A new Attack target when the old one died: Taunt first, like Windfury (§4.1). */
function nextAttackTarget(ctx: Ctx, u: Unit): Unit | undefined {
  const all = foes(ctx, u).filter((f) => !f.stealth);
  const taunts = all.filter((f) => f.taunt > 0);
  return ctx.pick(taunts.length ? taunts : all);
}

function bolt(ctx: Ctx, u: Unit, target: string, amount: number, school: School | null) {
  ctx.emit({ t: 'projectile', from: u.uid, to: target, school });
  return dealDamage(ctx, u.uid, target, amount, { kind: 'spell', school });
}

function root(ctx: Ctx, v: Unit) {
  if (!isAlive(v)) return;
  v.rooted = Math.max(v.rooted, 1);
  status(ctx, v, 'Rooted', 'bad');
}

function freeze(ctx: Ctx, v: Unit, turns: number) {
  if (!isAlive(v)) return;
  v.frozen = Math.max(v.frozen, turns);
  status(ctx, v, 'Frozen', 'bad');
}

function addBleed(ctx: Ctx, v: Unit, n: number) {
  if (!isAlive(v)) return;
  v.bleed += n;
  status(ctx, v, `Bleed ${v.bleed}`, 'bad');
}

function giveShield(ctx: Ctx, v: Unit) {
  if (!isAlive(v)) return;
  v.shield = true;
  status(ctx, v, 'Divine Shield');
}

function taunt(ctx: Ctx, u: Unit, turns: number) {
  u.taunt = Math.max(u.taunt, turns);
  status(ctx, u, 'Taunt');
}

const impl: Record<string, AbilityFn> = {
  // --- Brannoc Emberhelm --------------------------------------------------
  'anvil-strike': (ctx, u, t) => {
    const r = attack(ctx, u.uid, t!);
    const v = ctx.u(t!);
    if (r.dealt >= 0 && isAlive(v)) {
      const slow = O.anvilSlow + (has(u, 'cindersteel-hammer') ? O.cindersteel : 0);
      v.pendingSlow += slow;
      status(ctx, v, `Slowed +${slow}`, 'bad');
    }
  },
  'forge-ward': (ctx, u) => {
    taunt(ctx, u, 1);
    giveShield(ctx, u);
    heal(ctx, u.side, u.uid, O.forgeWardHeal + (has(u, 'runed-aegis') ? O.forgeHeal : 0));
  },
  'molten-bulwark': (ctx, u) => {
    taunt(ctx, u, O.bulwarkTaunt);
    u.thorns += O.bulwarkThorns + (has(u, 'magma-core') ? O.magmaCore : 0);
    status(ctx, u, 'Molten');
  },

  // --- Captain Rurik Saltmane ---------------------------------------------
  'boarding-hook': (ctx, u, t) => {
    const combo = ctx.s.sides[u.side].resolved > 0;
    if (has(u, 'barbed-hook')) buff(ctx, u, O.hookAttack, 0);
    attack(ctx, u.uid, t!);
    if (!combo || !isAlive(u)) return;
    status(ctx, u, 'Combo!');
    const again = isAlive(ctx.u(t!)) ? ctx.u(t!) : nextAttackTarget(ctx, u);
    if (again) attack(ctx, u.uid, again.uid);
  },
  'hold-fast': (ctx, u) => {
    taunt(ctx, u, O.holdTaunt);
    giveShield(ctx, u);
    if (has(u, 'iron-buckler')) for (const n of neighbours(ctx.s, u)) giveShield(ctx, n);
  },
  'rally-the-crew': (ctx, u) => {
    for (const f of friends(ctx, u)) {
      if (f.uid === u.uid) continue;
      f.speedThisTurn -= O.crewSpeed;
      status(ctx, f, `Faster -${O.crewSpeed}`);
    }
    if (has(u, 'oathbound-banner')) {
      for (const f of friends(ctx, u)) if (f.faction === 'Ironvow') {
        f.attackThisTurn += O.bannerAttack;
        status(ctx, f, `+${O.bannerAttack} Attack`);
      }
    }
  },

  // --- Mother Gorsebark ---------------------------------------------------
  'bramble-lash': (ctx, u, t) => {
    const hit = bolt(ctx, u, t!, O.brambleDamage + (has(u, 'strangling-vines') ? O.strangling : 0), 'Nature');
    root(ctx, ctx.u(hit.to));
  },
  'deep-roots': (ctx, u) => {
    taunt(ctx, u, O.rootsTaunt);
    heal(ctx, u.side, u.uid, O.rootsHeal);
    if (has(u, 'heartwood-sap')) {
      for (const f of friends(ctx, u)) if (f.uid !== u.uid && f.faction === 'Thornwild') heal(ctx, u.side, f.uid, O.heartwoodHeal);
    }
  },
  entangle: (ctx, u) => {
    ctx.emit({ t: 'nova', from: u.uid, side: other(u.side), school: 'Nature' });
    for (const f of foes(ctx, u)) root(ctx, f);
  },

  // --- Vessa Nightcoil ----------------------------------------------------
  'grave-cleave': (ctx, u, t) => {
    if (has(u, 'gravebound-axe')) {
      u.attackThisTurn += O.graveAxe;
      status(ctx, u, `+${O.graveAxe} Attack`);
    }
    attack(ctx, u.uid, t!, { lifesteal: true });
  },
  'bone-wall': (ctx, u) => {
    taunt(ctx, u, O.boneTaunt);
    u.lifesteal = Math.max(u.lifesteal, O.boneTaunt);
    status(ctx, u, 'Lifesteal');
  },
  'soul-harvest': (ctx, u) => {
    ctx.emit({ t: 'nova', from: u.uid, side: other(u.side), school: 'Shadow' });
    const dmg = O.harvest + (has(u, 'reapers-sigil') ? O.reaper : 0);
    for (const f of foes(ctx, u)) dealDamage(ctx, u.uid, f.uid, dmg, { kind: 'spell', school: 'Shadow', lifesteal: true });
  },

  // --- Nyxa the Pale ------------------------------------------------------
  'serrated-strike': (ctx, u, t) => {
    attack(ctx, u.uid, t!);
    addBleed(ctx, ctx.u(t!), O.serratedBleed + (has(u, 'venom-vial') ? O.venom : 0));
  },
  vanish: (ctx, u) => {
    u.stealth = true;
    status(ctx, u, 'Stealth');
    buff(ctx, u, O.vanishAttack + (has(u, 'ghost-silk') ? O.ghostSilk : 0), 0);
  },
  eviscerate: (ctx, u, t) => {
    const v = ctx.u(t!);
    const dmg = effectiveAttack(u) * (v.bleed > 0 ? 2 : 1);
    ctx.emit({ t: 'attack', attacker: u.uid, target: v.uid });
    dealDamage(ctx, u.uid, v.uid, dmg, { kind: 'spell' });
  },

  // --- Torvik Stormbrand --------------------------------------------------
  'twin-axes': (ctx, u, t) => {
    attack(ctx, u.uid, t!);
    if (!isAlive(u)) return;
    const again = isAlive(ctx.u(t!)) ? ctx.u(t!) : nextAttackTarget(ctx, u);
    if (again) attack(ctx, u.uid, again.uid);
  },
  thunderclap: (ctx, u) => {
    ctx.emit({ t: 'nova', from: u.uid, side: other(u.side), school: 'Nature' });
    const dmg = O.thunderclap + (has(u, 'storm-rune') ? O.stormRune : 0);
    for (const f of foes(ctx, u)) dealDamage(ctx, u.uid, f.uid, dmg, { kind: 'spell', school: 'Nature' });
    processDeaths(ctx);
    for (const f of foes(ctx, u)) if (!f.acted) f.speedThisTurn += O.thunderSlow;
  },
  berserk: (ctx, u, t) => {
    dealDamage(ctx, null, u.uid, O.berserkSelf, { kind: 'spell', noCrit: true });
    processDeaths(ctx);
    if (!isAlive(u)) return;
    const gain = O.berserkAttack + (has(u, 'bloodrage-torc') ? O.bloodrage : 0);
    u.attackThisTurn += gain;
    status(ctx, u, `+${gain} Attack`);
    const target = isAlive(ctx.u(t!)) ? ctx.u(t!) : nextAttackTarget(ctx, u);
    if (target) attack(ctx, u.uid, target.uid);
  },

  // --- Lyra Thornquill ----------------------------------------------------
  'barbed-arrow': (ctx, u, t) => {
    const hit = bolt(ctx, u, t!, O.barbed + (has(u, 'hawkeye-lens') ? O.hawkeye : 0), 'Nature');
    addBleed(ctx, ctx.u(hit.to), O.barbedBleed);
  },
  'pinning-shot': (ctx, u, t) => {
    const hit = bolt(ctx, u, t!, O.pinning, 'Nature');
    const v = ctx.u(hit.to);
    root(ctx, v);
    if (has(u, 'weighted-shafts') && isAlive(v)) v.speedThisTurn += O.weightedSlow;
  },
  volley: (ctx, u) => {
    const arrows = has(u, 'quiver-of-thorns') ? 4 : 3;
    for (let i = 0; i < arrows; i++) {
      const v = randomFoe(ctx, u);
      if (!v) return;
      bolt(ctx, u, v.uid, O.volley + (v.bleed > 0 ? O.volleyBleeding : 0), 'Nature');
      processDeaths(ctx);
    }
  },

  // --- Grisk Tallowtooth --------------------------------------------------
  gore: (ctx, u, t) => {
    attack(ctx, u.uid, t!);
    const n = O.goreBeast + (has(u, 'tusk-charm') ? O.tuskCharm : 0);
    for (const f of friends(ctx, u)) if (f.types.includes('Beast')) buff(ctx, f, n, n);
  },
  'call-wolf': (ctx, u) => {
    const collar = has(u, 'alphas-collar');
    summon(ctx, u, 'wolf', {
      attack: O.wolfAttack + (collar ? O.collarAttack : 0),
      health: O.wolfHealth + (collar ? O.collarHealth : 0),
    });
  },
  'feral-howl': (ctx, u) => {
    const n = O.howl + (has(u, 'war-drum') ? O.warDrum : 0);
    for (const f of friends(ctx, u)) {
      f.attackThisTurn += n;
      status(ctx, f, `+${n} Attack`);
    }
  },

  // --- Sister Aurelle -----------------------------------------------------
  smite: (ctx, u, t) => {
    bolt(ctx, u, t!, O.smite + (has(u, 'censer-of-dawn') ? O.censer : 0), 'Holy');
  },
  'aegis-prayer': (ctx, u, t) => {
    const v = ctx.u(t!);
    giveShield(ctx, v);
    heal(ctx, u.side, v.uid, O.aegisHeal + (has(u, 'blessed-beads') ? O.beads : 0));
  },
  dawnfire: (ctx, u, t) => {
    const hit = bolt(ctx, u, t!, O.dawnfire + (has(u, 'sunstone-pendant') ? O.sunstone : 0), 'Fire');
    processDeaths(ctx);
    const lowest = [...friends(ctx, u)].sort((a, b) => a.health - b.health)[0];
    if (lowest && hit.amount > 0) heal(ctx, u.side, lowest.uid, hit.amount);
  },

  // --- Oona of the Fen ----------------------------------------------------
  'lightning-surge': (ctx, u, t) => {
    const splashTargets = neighbours(ctx.s, ctx.u(t!));
    bolt(ctx, u, t!, O.surge, 'Nature');
    const splash = O.surgeSplash + (has(u, 'storm-totem') ? O.stormTotem : 0);
    for (const n of splashTargets) dealDamage(ctx, u.uid, n.uid, splash, { kind: 'spell', school: 'Nature' });
  },
  'healing-tide': (ctx, u) => {
    const n = O.tide + (has(u, 'tidestone') ? O.tidestone : 0);
    for (const f of friends(ctx, u)) heal(ctx, u.side, f.uid, n);
  },
  whirlpool: (ctx, u, t) => {
    const hit = bolt(ctx, u, t!, O.whirlpool + (has(u, 'riptide-pearl') ? O.riptide : 0), 'Frost');
    const v = ctx.u(hit.to);
    if (isAlive(v) && !v.acted) {
      v.speedThisTurn += O.whirlpoolSlow;
      status(ctx, v, `Slowed +${O.whirlpoolSlow}`, 'bad');
    }
  },

  // --- Mordekai Hollowspire -----------------------------------------------
  'shadow-bolt': (ctx, u, t) => {
    bolt(ctx, u, t!, O.shadowBolt + (has(u, 'soulbound-grimoire') ? O.grimoire : 0), 'Shadow');
  },
  'curse-of-frailty': (ctx, u, t) => {
    ctx.emit({ t: 'projectile', from: u.uid, to: t!, school: 'Shadow' });
    const v = ctx.u(t!);
    if (!isAlive(v)) return;
    const minus = O.curseAttack + (has(u, 'hex-candle') ? O.hexCandle : 0);
    v.attack -= minus;
    v.weakness.Shadow = (v.weakness.Shadow ?? 0) + O.curseWeakness;
    status(ctx, v, `-${minus} Attack · Shadow Weakness`, 'bad');
  },
  'raise-dead': (ctx, u) => {
    const court = friends(ctx, u).some((f) => f.uid !== u.uid && !f.isMinion && f.faction === 'Hollow Court');
    const count = has(u, 'grave-dust') && court ? 2 : 1;
    for (let i = 0; i < count; i++) {
      summon(ctx, u, 'skeleton', { attack: O.skeletonAttack, health: O.skeletonHealth }, { taunt: 99 });
    }
  },

  // --- Ilsa Frostveil -----------------------------------------------------
  'ice-lance': (ctx, u, t) => {
    const v = ctx.u(t!);
    const bonus = has(u, 'rime-shard') ? O.rime : 0;
    bolt(ctx, u, v.uid, (v.frozen > 0 ? O.iceLanceFrozen : O.iceLance) + bonus, 'Frost');
  },
  blizzard: (ctx, u) => {
    ctx.emit({ t: 'nova', from: u.uid, side: other(u.side), school: 'Frost' });
    const dmg = O.blizzard + (has(u, 'winters-crown') ? O.wintersCrown : 0);
    for (const f of foes(ctx, u)) dealDamage(ctx, u.uid, f.uid, dmg, { kind: 'spell', school: 'Frost' });
    processDeaths(ctx);
    const pending = foes(ctx, u).filter((f) => !f.acted);
    const v = ctx.pick(pending);
    if (v) freeze(ctx, v, 1);
  },
  'frost-armor': (ctx, u, t) => {
    const v = ctx.u(t!);
    giveShield(ctx, v);
    v.frostArmor = true;
    status(ctx, v, 'Frost Armor');
    if (has(u, 'glacial-mantle')) heal(ctx, u.side, v.uid, O.mantleHeal);
  },

  // --- Minions ------------------------------------------------------------
  bite: (ctx, u, t) => { attack(ctx, u.uid, t!); },
  'bone-claw': (ctx, u, t) => { attack(ctx, u.uid, t!); },
};

Object.assign(ABILITIES, impl);
