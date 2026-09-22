// The PvE opponent. It commits before the player (§7.4), so its orders are
// shown as intents. Each order is scored by simulating the turn with only
// its own side acting, then refined once so combos like Offensive Rally
// followed by an Attack are credited.

import { abilityDef } from './data';
import {
  isAlive, legalTargets, livingBoard, other, resolveTurn, slotsToFill, unit,
} from './battle';
import type { BattleState, Command, Side } from './types';

function localRng(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function evaluate(s: BattleState, side: Side, cmds: Command[]): number {
  const foe = other(side);
  const after = resolveTurn(s, { [side]: cmds, [foe]: [] } as Record<Side, Command[]>, { record: false }).state;
  let score = 0;
  for (const id of s.sides[foe].board) {
    const before = unit(s, id);
    const now = after.units[id];
    if (!isAlive(before)) continue;
    if (!now || !isAlive(now)) score += before.health + 35 + before.attack * 1.5;
    else score += before.health - now.health - (now.attack + now.attackThisTurn - before.attack) * 1.2;
  }
  for (const id of s.sides[side].board) {
    const before = unit(s, id);
    const now = after.units[id];
    if (!isAlive(before) || before.isMinion) continue;
    if (!now || !isAlive(now)) { score -= 60; continue; }
    const missing = before.maxHealth - before.health;
    const gained = now.health - before.health;
    // Healing only counts up to what was missing; damage taken counts in full.
    score += gained > 0 ? Math.min(gained, missing + (now.maxHealth - before.maxHealth)) * 0.7 : gained * 0.6;
    score += (now.attack - before.attack) * 2.2;
  }
  return score;
}

/** Value a simulation cannot see because it pays off next turn. */
function futureValue(s: BattleState, side: Side, c: Command): number {
  const u = unit(s, c.actor);
  const allies = livingBoard(s, side).filter((f) => f.uid !== u.uid);
  const hurtAlly = allies.some((a) => a.health < a.maxHealth * 0.5);
  switch (c.ability) {
    case 'taunt':
    case 'hold-the-front':
      return hurtAlly ? 18 : 4;
    case 'elunes-grace':
      return 22;
    case 'blessing-of-sacrifice': {
      const t = c.target ? unit(s, c.target) : null;
      return t && t.health < t.maxHealth * 0.4 ? 20 : 2;
    }
    case 'arcane-bolt':
      return 10;
    default:
      return 0;
  }
}

export function chooseCommands(s: BattleState, side: Side, seed = s.rng ^ (s.turn * 7919)): Command[] {
  const rand = localRng(seed);
  const actors = livingBoard(s, side).filter((u) => !u.isMinion);
  const options = actors.map((u) =>
    u.abilities
      .filter((a) => a.cd === 0)
      .flatMap((a) => {
        const def = abilityDef(a.id);
        const targets = def.target === 'none' ? [null] : legalTargets(s, u.uid, a.id);
        return targets.map((target): Command => ({ actor: u.uid, ability: a.id, target }));
      }),
  );

  const chosen: (Command | null)[] = actors.map(() => null);
  for (let pass = 0; pass < 2; pass++) {
    actors.forEach((_, i) => {
      const rest = chosen.filter((c, j): c is Command => j !== i && c !== null);
      const baseline = evaluate(s, side, rest);
      let best: Command | null = null;
      let bestScore = -Infinity;
      for (const c of options[i]!) {
        const others = [...rest];
        others.splice(Math.min(i, others.length), 0, c);
        const score = evaluate(s, side, others) - baseline + futureValue(s, side, c) + rand() * 6;
        if (score > bestScore) { bestScore = score; best = c; }
      }
      chosen[i] = best;
    });
  }
  return chosen.filter((c): c is Command => c !== null);
}

/** Picks bench mercs to fill empty board slots. */
export function choosePlacement(s: BattleState, side: Side): string[] {
  const n = slotsToFill(s, side);
  const bench = s.sides[side].bench.map((id) => unit(s, id));
  const rand = localRng(s.rng ^ 0x9e3779b9);
  // Prefer one of each role, then the healthiest.
  const picks: string[] = [];
  const roles = new Set(livingBoard(s, side).map((u) => u.role));
  const sorted = [...bench].sort((a, b) => b.health - a.health + (rand() - 0.5) * 20);
  for (const u of sorted) {
    if (picks.length >= n) break;
    if (!roles.has(u.role)) { picks.push(u.uid); roles.add(u.role); }
  }
  for (const u of sorted) {
    if (picks.length >= n) break;
    if (!picks.includes(u.uid)) picks.push(u.uid);
  }
  return picks;
}
