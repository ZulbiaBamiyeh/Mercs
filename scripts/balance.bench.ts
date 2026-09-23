// AI-vs-AI tournament over a roster. Prints each merc's win rate when it is in
// a party, and each item's win rate when equipped. Not part of `npm test`.
//
//   npm run balance              # originals, 300 matches
//   ROSTER=classic GAMES=200 npm run balance
import { writeFileSync } from 'node:fs';
import { test } from 'vitest';
import {
  chooseCommands, choosePlacement, createBattle, placeUnit, resolveTurn, ROSTERS, type PartyPick,
} from '../src/engine';

const roster = ROSTERS[(process.env.ROSTER as 'originals' | 'classic') ?? 'originals'];
const games = Number(process.env.GAMES ?? 300);

function rng(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function party(r: () => number): PartyPick[] {
  return [...roster].sort(() => r() - 0.5).slice(0, 6)
    .map((m) => ({ defId: m.id, item: m.items[Math.floor(r() * m.items.length)]!.id }));
}

test('balance', { timeout: 3_600_000 }, () => {
  const merc = new Map<string, { w: number; n: number }>();
  const item = new Map<string, { w: number; n: number }>();
  let draws = 0, turns = 0;
  const bump = (m: Map<string, { w: number; n: number }>, k: string, won: number) => {
    const e = m.get(k) ?? { w: 0, n: 0 };
    e.w += won; e.n += 1; m.set(k, e);
  };
  for (let g = 0; g < games; g++) {
    const r = rng(g * 7919 + 13);
    const p = party(r), e = party(r);
    let s = createBattle(p, e, g + 1);
    for (let t = 0; t < 40 && s.phase !== 'over'; t++) {
      for (const side of ['player', 'enemy'] as const) for (const u of choosePlacement(s, side)) placeUnit(s, side, u);
      s.phase = 'command';
      s = resolveTurn(s, { player: chooseCommands(s, 'player'), enemy: chooseCommands(s, 'enemy') }, { record: false }).state;
    }
    turns += s.turn;
    if (s.winner === 'draw' || s.phase !== 'over') { draws++; continue; }
    for (const [side, picks] of [['player', p], ['enemy', e]] as const) {
      const won = s.winner === side ? 1 : 0;
      for (const x of picks) { bump(merc, x.defId, won); bump(item, x.item!, won); }
    }
  }
  const fmt = (m: Map<string, { w: number; n: number }>) =>
    [...m].map(([k, v]) => [k, v.w / v.n, v.n] as const).sort((a, b) => b[1] - a[1])
      .map(([k, wr, n]) => `  ${k.padEnd(22)} ${(wr * 100).toFixed(1).padStart(5)}%  (${n})`).join('\n');
  const report = (`\n${games} games, ${draws} draws, ${(turns / games).toFixed(1)} turns avg\n\nMercs:\n${fmt(merc)}\n\nItems:\n${fmt(item)}\n`);
  writeFileSync('balance-report.txt', report);
  process.stderr.write(report);
});
