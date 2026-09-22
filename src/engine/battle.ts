// The combat engine: setup, placement, command legality, turn resolution and
// end of turn. Rules follow docs/mercs-mechanics-spec.md; section numbers in
// comments point there.

import { abilityDef, mercDef } from './data';
import type {
  AbilityDef, BattleEvent, BattleState, Command, DamageKind, PartyPick, Role, School, Side, Step, Unit,
} from './types';

export const BOARD_MERCS = 3;
export const BOARD_MAX = 6; // 3 mercs plus up to 3 minions (§6)

// ---------------------------------------------------------------------------
// RNG: mulberry32, with its state inside BattleState so a battle is replayable.

export function rngNext(s: BattleState): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function rngPick<T>(s: BattleState, arr: readonly T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(rngNext(s) * arr.length)];
}

// ---------------------------------------------------------------------------
// Queries

export const other = (side: Side): Side => (side === 'player' ? 'enemy' : 'player');

export function unit(s: BattleState, uid: string): Unit {
  const u = s.units[uid];
  if (!u) throw new Error(`Unknown unit ${uid}`);
  return u;
}

export const isAlive = (u: Unit | undefined): u is Unit => !!u && !u.dead && u.health > 0;

export function onBoard(s: BattleState, u: Unit): boolean {
  return s.sides[u.side].board.includes(u.uid);
}

/** Living units on a side's board, left to right. */
export function livingBoard(s: BattleState, side: Side): Unit[] {
  return s.sides[side].board.map((id) => unit(s, id)).filter(isAlive);
}

export function boardMercCount(s: BattleState, side: Side): number {
  return s.sides[side].board.filter((id) => !unit(s, id).isMinion && isAlive(unit(s, id))).length;
}

/** The nearest living neighbours on the same board. */
export function neighbours(s: BattleState, u: Unit): Unit[] {
  const board = s.sides[u.side].board;
  const i = board.indexOf(u.uid);
  const out: Unit[] = [];
  for (let j = i - 1; j >= 0; j--) {
    const n = unit(s, board[j]!);
    if (isAlive(n)) { out.push(n); break; }
  }
  for (let j = i + 1; j < board.length; j++) {
    const n = unit(s, board[j]!);
    if (isAlive(n)) { out.push(n); break; }
  }
  return out;
}

export function roleAdvantage(src: Role | null, tgt: Role | null): boolean {
  return (
    (src === 'PROTECTOR' && tgt === 'FIGHTER') ||
    (src === 'FIGHTER' && tgt === 'CASTER') ||
    (src === 'CASTER' && tgt === 'PROTECTOR')
  );
}

/** Attack including this-turn changes and Tome of Light. */
export function effectiveAttack(u: Unit): number {
  const tome = u.item === 'tome-of-light' && u.taunt > 0 ? 12 : 0;
  return Math.max(0, u.attack + u.attackThisTurn + tome);
}

export function effectiveCooldown(item: string | null, a: AbilityDef): number {
  if (item === 'shard-of-the-naaru' && a.id === 'flash-heal') return a.cooldown + 1;
  if (item === 'mana-rod' && a.id === 'arcane-bolt') return a.cooldown + 1;
  return a.cooldown;
}

export function currentSpeed(u: Unit, abilityId: string): number {
  const st = u.abilities.find((a) => a.id === abilityId);
  const base = abilityDef(abilityId).speed;
  return Math.max(0, base + (st?.speedMod ?? 0) + u.pendingSlow);
}

export function sideAlive(s: BattleState, side: Side): boolean {
  const sd = s.sides[side];
  return [...sd.board, ...sd.bench].some((id) => {
    const u = unit(s, id);
    return !u.isMinion && isAlive(u);
  });
}

// ---------------------------------------------------------------------------
// Setup and placement (§2.1)

function makeUnit(s: BattleState, side: Side, pick: PartyPick): Unit {
  const def = mercDef(pick.defId);
  const health = def.health + (pick.item === 'ancestral-armor' ? 20 : 0);
  const uid = `${side[0]}${s.nextUid++}-${def.id}`;
  return {
    uid, defId: def.id, side, name: def.name, role: def.role, faction: def.faction, types: [...def.types],
    baseAttack: def.attack, attack: def.attack, baseMaxHealth: health, maxHealth: health, health,
    abilities: def.abilities.map((a) => ({ id: a.id, cd: effectiveCooldown(pick.item, a), speedMod: 0 })),
    item: pick.item, isMinion: false, dead: false,
    taunt: 0, immune: false, attackThisTurn: 0, pendingSlow: 0, graceCharges: 0, arcaneDamage: 0,
    guardedBy: null, acted: false, damagedThisTurn: false,
  };
}

export function createBattle(player: PartyPick[], enemy: PartyPick[], seed: number): BattleState {
  const s: BattleState = {
    turn: 1, phase: 'placement', units: {}, rng: seed | 0, nextUid: 1, winner: null,
    sides: {
      player: { board: [], bench: [], healed: 0, rally: null },
      enemy: { board: [], bench: [], healed: 0, rally: null },
    },
  };
  for (const [side, party] of [['player', player], ['enemy', enemy]] as const) {
    for (const p of party) {
      const u = makeUnit(s, side, p);
      s.units[u.uid] = u;
      s.sides[side].bench.push(u.uid);
    }
  }
  return s;
}

/** How many mercs a side must place now: the initial 3, or refills after deaths (§2.7). */
export function slotsToFill(s: BattleState, side: Side): number {
  return Math.max(0, Math.min(BOARD_MERCS - boardMercCount(s, side), s.sides[side].bench.length));
}

/** Moves a bench merc onto the board at `index` (default: rightmost). */
export function placeUnit(s: BattleState, side: Side, uid: string, index?: number): void {
  const sd = s.sides[side];
  const bi = sd.bench.indexOf(uid);
  if (bi < 0) throw new Error(`${uid} is not on the ${side} bench`);
  if (boardMercCount(s, side) >= BOARD_MERCS) throw new Error('Board is full');
  sd.bench.splice(bi, 1);
  const at = index === undefined ? sd.board.length : Math.max(0, Math.min(index, sd.board.length));
  sd.board.splice(at, 0, uid);
}

// ---------------------------------------------------------------------------
// Commands (§2.3)

export function isReady(u: Unit, abilityId: string): boolean {
  return u.abilities.some((a) => a.id === abilityId && a.cd === 0);
}

/** Legal targets at command time. Attacks must pick a Taunt unit when one exists. */
export function legalTargets(s: BattleState, actorId: string, abilityId: string): string[] {
  const actor = unit(s, actorId);
  const def = abilityDef(abilityId);
  switch (def.target) {
    case 'none':
      return [];
    case 'enemy': {
      const foes = livingBoard(s, other(actor.side));
      const taunts = foes.filter((f) => f.taunt > 0);
      return (def.isAttack && taunts.length ? taunts : foes).map((f) => f.uid);
    }
    case 'friendly':
      return livingBoard(s, actor.side).map((f) => f.uid);
    case 'otherFriendly':
      return livingBoard(s, actor.side).filter((f) => f.uid !== actor.uid && !f.isMinion).map((f) => f.uid);
  }
}

export function isLegalCommand(s: BattleState, c: Command): boolean {
  const u = s.units[c.actor];
  if (!isAlive(u) || !onBoard(s, u) || !isReady(u, c.ability)) return false;
  const def = abilityDef(c.ability);
  if (def.target === 'none') return c.target === null;
  return c.target !== null && legalTargets(s, c.actor, c.ability).includes(c.target);
}

export interface OrderSlot { ordinal: number; uncertain: boolean; speed: number }

/**
 * The 1st/2nd/3rd bubbles (§2.3). A position is uncertain ("?") when it ties
 * on speed with the other side, because cross-side ties are a coin flip.
 */
export function previewOrder(s: BattleState, cmds: Record<Side, Command[]>): Record<string, OrderSlot> {
  const entries = (['player', 'enemy'] as const).flatMap((side) =>
    cmds[side].map((c, idx) => ({ c, side, idx, speed: currentSpeed(unit(s, c.actor), c.ability) })),
  );
  entries.sort((a, b) => a.speed - b.speed || (a.side === b.side ? a.idx - b.idx : a.side === 'player' ? -1 : 1));
  const out: Record<string, OrderSlot> = {};
  entries.forEach((e, i) => {
    const uncertain = entries.some((o) => o.side !== e.side && o.speed === e.speed);
    out[e.c.actor] = { ordinal: i + 1, uncertain, speed: e.speed };
  });
  return out;
}

// ---------------------------------------------------------------------------
// Resolution context

export class Ctx {
  readonly steps: Step[] = [];
  constructor(readonly s: BattleState, private readonly record: boolean) {}

  emit(event: BattleEvent): void {
    if (this.record) this.steps.push({ event, state: structuredClone(this.s) });
  }
  u(uid: string): Unit {
    return unit(this.s, uid);
  }
  rand(): number {
    return rngNext(this.s);
  }
  pick<T>(arr: readonly T[]): T | undefined {
    return rngPick(this.s, arr);
  }
}

interface DamageOpts { kind: DamageKind; school?: School | null; noCrit?: boolean }

/** The damage pipeline (§4.3). Returns who actually took it and how much. */
export function dealDamage(
  ctx: Ctx, sourceId: string | null, targetId: string, base: number, opts: DamageOpts,
): { to: string; amount: number } {
  let target = ctx.u(targetId);
  if (!isAlive(target)) return { to: targetId, amount: 0 };

  // Blessing of Sacrifice: the guard takes it instead.
  if (target.guardedBy) {
    const guard = ctx.s.units[target.guardedBy];
    if (isAlive(guard) && guard.uid !== target.uid) {
      ctx.emit({ t: 'redirect', from: target.uid, to: guard.uid, reason: 'Sacrifice' });
      target = guard;
    }
  }

  const src = sourceId ? ctx.s.units[sourceId] ?? null : null;
  let amount = base;
  if (src && opts.kind === 'spell' && opts.school === 'Arcane') amount += src.arcaneDamage;
  if (target.item === 'shield-of-dawn') amount -= 3;
  amount = Math.max(0, amount);
  const crit = !!src && !opts.noCrit && opts.kind !== 'counter' && amount > 0 && roleAdvantage(src.role, target.role);
  if (crit) amount *= 2;

  if (target.immune) {
    ctx.emit({ t: 'status', target: target.uid, text: 'Immune', tone: 'good' });
    return { to: target.uid, amount: 0 };
  }
  if (amount === 0 && opts.kind === 'counter') return { to: target.uid, amount: 0 };

  target.health -= amount;
  if (amount > 0) target.damagedThisTurn = true;
  ctx.emit({
    t: 'damage', target: target.uid, amount, crit, kind: opts.kind, source: sourceId, lethal: target.health <= 0,
  });
  return { to: target.uid, amount };
}

/** Marks everyone at 0 health as dead. Returns who died. */
export function processDeaths(ctx: Ctx): string[] {
  const died: string[] = [];
  for (const side of ['player', 'enemy'] as const) {
    for (const id of ctx.s.sides[side].board) {
      const u = ctx.u(id);
      if (!u.dead && u.health <= 0) {
        u.dead = true;
        u.taunt = 0;
        died.push(id);
        ctx.emit({ t: 'death', unit: id });
      }
    }
  }
  return died;
}

export function heal(ctx: Ctx, healerSide: Side, targetId: string, amount: number): number {
  const t = ctx.u(targetId);
  if (!isAlive(t)) return 0;
  const restored = Math.max(0, Math.min(amount, t.maxHealth - t.health));
  t.health += restored;
  ctx.s.sides[healerSide].healed += restored;
  ctx.emit({ t: 'heal', target: targetId, amount: restored });
  return restored;
}

export function buff(ctx: Ctx, u: Unit, attack: number, health: number): void {
  if (!isAlive(u)) return;
  u.attack += attack;
  u.maxHealth += health;
  u.health += health;
  ctx.emit({ t: 'buff', target: u.uid, attack, health });
}

/** The Attack keyword (§4.1): both sides deal their Attack at once. */
export function attack(ctx: Ctx, attackerId: string, targetId: string): { killed: boolean; dealt: number } {
  const a = ctx.u(attackerId);
  const t = ctx.u(targetId);
  if (!isAlive(a) || !isAlive(t)) return { killed: false, dealt: 0 };

  const rally = ctx.s.sides[a.side].rally;
  if (rally) buff(ctx, a, rally.attack, rally.health);
  if (a.item === 'burning-blade') buff(ctx, a, 2, 2);

  ctx.emit({ t: 'attack', attacker: a.uid, target: t.uid });
  const outgoing = effectiveAttack(a);
  const incoming = effectiveAttack(t);
  const hit = dealDamage(ctx, a.uid, t.uid, outgoing, { kind: 'attack' });
  dealDamage(ctx, t.uid, a.uid, incoming, { kind: 'counter' });
  const died = processDeaths(ctx);
  return { killed: died.includes(hit.to), dealt: hit.amount };
}

// ---------------------------------------------------------------------------
// Turn resolution (§2.4)

/** Validates a queued target at resolution time, retargeting when needed. */
function resolveTarget(ctx: Ctx, actor: Unit, def: AbilityDef, target: string | null): string | null | undefined {
  if (def.target === 'none') return null;

  if (def.target === 'enemy') {
    const foes = livingBoard(ctx.s, other(actor.side));
    if (foes.length === 0) return undefined;
    const taunts = foes.filter((f) => f.taunt > 0);
    const current = target ? ctx.s.units[target] : undefined;
    const valid = isAlive(current) && onBoard(ctx.s, current);

    if (def.isAttack && taunts.length) {
      if (valid && current.taunt > 0) return current.uid;
      const to = ctx.pick(taunts)!;
      if (current) ctx.emit({ t: 'redirect', from: current.uid, to: to.uid, reason: 'Taunt' });
      return to.uid;
    }
    if (valid && !current.immune) return current.uid;
    // Every enemy-targeted ability here deals damage, so Immune targets are skipped.
    const pool = foes.filter((f) => !f.immune);
    if (pool.length === 0) return valid ? current.uid : ctx.pick(foes)!.uid;
    const to = ctx.pick(pool)!;
    if (current) ctx.emit({ t: 'redirect', from: current.uid, to: to.uid, reason: 'Retarget' });
    return to.uid;
  }

  const friends = livingBoard(ctx.s, actor.side).filter(
    (f) => def.target === 'friendly' || (f.uid !== actor.uid && !f.isMinion),
  );
  if (friends.length === 0) return undefined;
  const current = target ? ctx.s.units[target] : undefined;
  if (isAlive(current) && friends.includes(current)) return current.uid;
  return ctx.pick(friends)!.uid;
}

export type AbilityFn = (ctx: Ctx, actor: Unit, target: string | null) => void;

// Filled in by abilities.ts. Kept as a registry so this file has no content.
export const ABILITIES: Record<string, AbilityFn> = {};

export interface ResolveResult { state: BattleState; steps: Step[] }

export function resolveTurn(
  input: BattleState, cmds: Record<Side, Command[]>, opts: { record?: boolean } = {},
): ResolveResult {
  const s = structuredClone(input);
  const ctx = new Ctx(s, opts.record ?? true);

  // One tie-break roll per (side, speed): same-side ties keep command order,
  // cross-side ties are a coin flip (§2.4).
  const rolls = new Map<string, number>();
  const roll = (side: Side, speed: number) => {
    const k = `${side}:${speed}`;
    if (!rolls.has(k)) rolls.set(k, ctx.rand());
    return rolls.get(k)!;
  };

  // One order per unit; a later order for the same unit replaces the earlier one.
  const pending = (['player', 'enemy'] as const).flatMap((side) =>
    cmds[side]
      .filter((c, i, all) => isLegalCommand(s, c) && !all.slice(i + 1).some((o) => o.actor === c.actor))
      .map((c, idx) => ({ c, side, idx })),
  );
  const speedOf = (e: (typeof pending)[number]) => currentSpeed(ctx.u(e.c.actor), e.c.ability);

  while (pending.length) {
    // Re-sorted every step, because speeds can change mid-combat (§5).
    pending.sort((x, y) => {
      const sx = speedOf(x), sy = speedOf(y);
      return sx - sy || roll(x.side, sx) - roll(y.side, sy) || x.idx - y.idx;
    });
    const { c, side } = pending.shift()!;
    const actor = ctx.u(c.actor);
    if (!isAlive(actor) || !onBoard(s, actor)) continue; // dead mercs never act
    const st = actor.abilities.find((a) => a.id === c.ability);
    if (!st || st.cd > 0) continue;
    if (!sideAlive(s, 'player') || !sideAlive(s, 'enemy')) break; // the fight is decided

    const def = abilityDef(c.ability);
    actor.acted = true;
    actor.pendingSlow = 0;
    st.cd = effectiveCooldown(actor.item, def) + 1;

    let casts = 1;
    if (actor.graceCharges > 0 && def.school === 'Arcane' && def.id !== 'elunes-grace') {
      casts = 2;
      actor.graceCharges = 0;
      st.speedMod -= 3;
    }

    for (let k = 0; k < casts; k++) {
      if (!isAlive(actor)) break;
      ctx.emit({ t: 'act', actor: actor.uid, ability: def.id, target: c.target, side, echo: k > 0 });
      const target = resolveTarget(ctx, actor, def, c.target);
      if (target === undefined) {
        ctx.emit({ t: 'fizzle', actor: actor.uid });
        continue;
      }
      const fn = ABILITIES[def.id];
      if (!fn) throw new Error(`No implementation for ${def.id}`);
      fn(ctx, actor, target);
      processDeaths(ctx);
    }
  }

  endOfTurn(ctx);
  return { state: s, steps: ctx.steps };
}

/** §2.5: expire this-turn effects, tick durations and cooldowns, check for a winner. */
function endOfTurn(ctx: Ctx): void {
  const s = ctx.s;
  for (const side of ['player', 'enemy'] as const) {
    for (const id of s.sides[side].board) {
      const u = ctx.u(id);
      if (u.isMinion && !u.dead) {
        u.dead = true;
        ctx.emit({ t: 'vanish', unit: id });
      }
    }
  }
  for (const u of Object.values(s.units)) {
    u.attackThisTurn = 0;
    u.immune = false;
    u.guardedBy = null;
    u.acted = false;
    u.damagedThisTurn = false;
    if (u.taunt > 0) u.taunt--;
    if (!u.dead && !u.isMinion) for (const a of u.abilities) a.cd = Math.max(0, a.cd - 1);
  }
  for (const side of ['player', 'enemy'] as const) {
    const sd = s.sides[side];
    sd.rally = null;
    sd.board = sd.board.filter((id) => !ctx.u(id).dead);
    // Dead minions have no graveyard; drop them so the state stays small.
    for (const id of Object.keys(s.units)) {
      const u = ctx.u(id);
      if (u.isMinion && u.dead && u.side === side) delete s.units[id];
    }
  }

  const p = sideAlive(s, 'player');
  const e = sideAlive(s, 'enemy');
  if (!p || !e) {
    s.winner = !p && !e ? 'draw' : p ? 'player' : 'enemy';
    s.phase = 'over';
  } else {
    s.turn++;
  }
  ctx.emit({ t: 'endTurn', turn: s.turn });
}
