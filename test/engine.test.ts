import { describe, expect, it } from 'vitest';
import {
  chooseCommands, choosePlacement, createBattle, legalTargets, placeUnit, previewOrder, resolveTurn,
  type BattleState, type Command, type PartyPick, type Side,
} from '../src/engine';

const pick = (defId: string, item: string | null = null): PartyPick => ({ defId, item });

/** A battle with the given mercs already on the board, left to right. */
function battle(player: PartyPick[], enemy: PartyPick[], seed = 1): BattleState {
  const s = createBattle(player, enemy, seed);
  for (const side of ['player', 'enemy'] as const) {
    for (const id of [...s.sides[side].bench].slice(0, 3)) placeUnit(s, side, id);
  }
  s.phase = 'command';
  return s;
}

const id = (s: BattleState, side: Side, i: number) => s.sides[side].board[i]!;
const cmd = (actor: string, ability: string, target: string | null = null): Command => ({ actor, ability, target });
const run = (s: BattleState, player: Command[], enemy: Command[] = []) =>
  resolveTurn(s, { player, enemy });

describe('speed and order', () => {
  it('resolves lower speed first, across sides (spec test 1)', () => {
    const s = battle([pick('xyrella')], [pick('millhouse')]);
    const x = id(s, 'player', 0), m = id(s, 'enemy', 0);
    // Blinding Luminance (3) beats Arcane Bolt (6)
    const { steps } = run(s, [cmd(x, 'blinding-luminance', m)], [cmd(m, 'arcane-bolt', x)]);
    const acts = steps.filter((st) => st.event.t === 'act').map((st) => (st.event as { actor: string }).actor);
    expect(acts).toEqual([x, m]);
  });

  it('keeps command order for same-side ties (spec test 2)', () => {
    const s = battle([pick('cornelius'), pick('rokara')], [pick('millhouse')]);
    const c = id(s, 'player', 0), r = id(s, 'player', 1);
    s.units[c]!.abilities.forEach((a) => (a.cd = 0));
    s.units[r]!.abilities.forEach((a) => (a.cd = 0));
    // Both speed 2, commanded Rokara first
    const { steps } = run(s, [cmd(r, 'offensive-rally'), cmd(c, 'hold-the-front')]);
    const acts = steps.filter((st) => st.event.t === 'act').map((st) => (st.event as { actor: string }).actor);
    expect(acts).toEqual([r, c]);
  });

  it('a merc killed early never acts (spec test 3)', () => {
    const s = battle([pick('xyrella')], [pick('millhouse')]);
    const x = id(s, 'player', 0), m = id(s, 'enemy', 0);
    s.units[m]!.health = 5;
    const { state, steps } = run(s, [cmd(x, 'blinding-luminance', m)], [cmd(m, 'arcane-bolt', x)]);
    expect(steps.some((st) => st.event.t === 'act' && st.event.actor === m)).toBe(false);
    expect(state.units[x]!.health).toBe(68);
  });

  it('marks cross-side ties as uncertain', () => {
    const s = battle([pick('tyrande')], [pick('cariel')]);
    const t = id(s, 'player', 0), c = id(s, 'enemy', 0);
    const order = previewOrder(s, { player: [cmd(t, 'arcane-shot', c)], enemy: [cmd(c, 'crusaders-blow', t)] });
    expect(order[t]!.uncertain).toBe(false);
    expect(order[t]!.ordinal).toBe(2);
    expect(order[c]!.ordinal).toBe(1);
  });
});

describe('attacks and damage', () => {
  it('trades Attack both ways, crit only on the attacker (spec tests 6-7)', () => {
    // Cariel (Protector 11) attacks Samuro (Fighter 10): 22 dealt, 10 back.
    const s = battle([pick('cariel')], [pick('samuro')]);
    const c = id(s, 'player', 0), sa = id(s, 'enemy', 0);
    const { state } = run(s, [cmd(c, 'crusaders-blow', sa)]);
    expect(state.units[sa]!.health).toBe(66 - 22);
    expect(state.units[c]!.health).toBe(73 - 10);
  });

  it('applies damage reduction before the crit (spec test 8)', () => {
    // Millhouse (Caster) bolts Cornelius (Protector, Shield of Dawn): (12-3)*2
    const s = battle([pick('millhouse')], [pick('cornelius', 'shield-of-dawn')]);
    const m = id(s, 'player', 0), c = id(s, 'enemy', 0);
    const { state } = run(s, [cmd(m, 'arcane-bolt', c)]);
    expect(state.units[c]!.health).toBe(79 - 18);
  });

  it('forces Attacks onto Taunt but lets spells through (spec test 5)', () => {
    const s = battle([pick('grommash')], [pick('cariel'), pick('xyrella')]);
    const g = id(s, 'player', 0), c = id(s, 'enemy', 0), x = id(s, 'enemy', 1);
    s.units[c]!.taunt = 2;
    expect(legalTargets(s, g, 'blood-fervor')).toEqual([c]);
    expect(legalTargets(s, g, 'staggering-slam')).toEqual([c, x]);
  });

  it('retargets when the target died earlier in the turn (spec test 4)', () => {
    const s = battle([pick('xyrella'), pick('cariel')], [pick('millhouse'), pick('tyrande')]);
    const x = id(s, 'player', 0), c = id(s, 'player', 1);
    const m = id(s, 'enemy', 0), t = id(s, 'enemy', 1);
    s.units[m]!.health = 5;
    const { state } = run(s, [cmd(x, 'blinding-luminance', m), cmd(c, 'crusaders-blow', m)]);
    expect(state.units[m]!.dead).toBe(true);
    expect(state.units[t]!.health).toBeLessThan(81);
  });

  it('Deathblow fires only when the ability kills', () => {
    const s = battle([pick('cariel')], [pick('millhouse'), pick('xyrella')]);
    const c = id(s, 'player', 0), m = id(s, 'enemy', 0);
    s.units[c]!.health = 20;
    s.units[m]!.health = 5;
    const { state } = run(s, [cmd(c, 'crusaders-blow', m)]);
    // 20 - 5 counter + 60 heal, capped at 73
    expect(state.units[c]!.health).toBe(73);
  });
});

describe('cooldowns', () => {
  it('cooldown 1: blocked turn 1, usable turn 2, blocked turn 3 (spec test 12)', () => {
    let s = battle([pick('cariel'), pick('xyrella')], [pick('millhouse')]);
    const c = id(s, 'player', 0);
    const seal = () => s.units[c]!.abilities.find((a) => a.id === 'seal-of-light')!.cd;
    expect(seal()).toBe(1);
    s = run(s, []).state;
    expect(seal()).toBe(0);
    s = run(s, [cmd(c, 'seal-of-light', c)]).state;
    expect(seal()).toBe(1);
    s = run(s, []).state;
    expect(seal()).toBe(0);
  });

  it('bench cooldowns tick too', () => {
    const s = createBattle([pick('cariel'), pick('xyrella'), pick('millhouse'), pick('rokara')], [pick('tyrande')], 3);
    for (const u of [...s.sides.player.bench].slice(0, 3)) placeUnit(s, 'player', u);
    placeUnit(s, 'enemy', s.sides.enemy.bench[0]!);
    const benched = s.sides.player.bench[0]!;
    const next = run(s, []).state;
    expect(next.units[benched]!.abilities.find((a) => a.id === 'orc-onslaught')!.cd).toBe(0);
  });
});

describe('abilities', () => {
  it('Atonement grows with team healing', () => {
    const s = battle([pick('xyrella')], [pick('grommash')]);
    const x = id(s, 'player', 0), g = id(s, 'enemy', 0);
    s.sides.player.healed = 45; // two steps of 20
    s.units[x]!.abilities.forEach((a) => (a.cd = 0));
    const { state } = run(s, [cmd(x, 'atonement', g)]);
    expect(state.units[g]!.health).toBe(74 - (20 + 6) * 2); // caster crits protector
  });

  it('Staggering Slam delays an ability that has not acted yet', () => {
    const s = battle([pick('grommash'), pick('cariel')], [pick('millhouse')]);
    const g = id(s, 'player', 0), c = id(s, 'player', 1), m = id(s, 'enemy', 0);
    // Arcane Explosion (4) would go before Crusader's Blow (6); slowed by 5 it goes after.
    const { steps } = run(s, [cmd(g, 'staggering-slam', m), cmd(c, 'crusaders-blow', m)], [cmd(m, 'arcane-explosion')]);
    const acts = steps.filter((st) => st.event.t === 'act').map((st) => (st.event as { ability: string }).ability);
    expect(acts).toEqual(['staggering-slam', 'crusaders-blow', 'arcane-explosion']);
  });

  it('Elune\'s Grace doubles the next Arcane ability and speeds it up permanently', () => {
    let s = battle([pick('tyrande')], [pick('grommash')]);
    const t = id(s, 'player', 0), g = id(s, 'enemy', 0);
    s.units[t]!.abilities.forEach((a) => (a.cd = 0));
    s = run(s, [cmd(t, 'elunes-grace')]).state;
    const { state, steps } = run(s, [cmd(t, 'arcane-shot', g)]);
    expect(steps.filter((st) => st.event.t === 'act').length).toBe(2);
    expect(state.units[g]!.health).toBe(74 - 28);
    expect(state.units[t]!.abilities.find((a) => a.id === 'arcane-shot')!.speedMod).toBe(-3);
  });

  it('Mirror Image summons a copy that attacks and vanishes', () => {
    const s = battle([pick('samuro')], [pick('xyrella')]);
    const sa = id(s, 'player', 0), x = id(s, 'enemy', 0);
    s.units[sa]!.abilities.forEach((a) => (a.cd = 0));
    const { state, steps } = run(s, [cmd(sa, 'mirror-image', x)]);
    expect(steps.some((st) => st.event.t === 'summon')).toBe(true);
    expect(state.units[x]!.health).toBe(68 - 10); // minions never crit
    expect(state.sides.player.board).toEqual([sa]);
  });

  it('Offensive Rally buffs later Attacks', () => {
    const s = battle([pick('rokara'), pick('grommash')], [pick('xyrella')]);
    const r = id(s, 'player', 0), g = id(s, 'player', 1), x = id(s, 'enemy', 0);
    s.units[r]!.abilities.forEach((a) => (a.cd = 0));
    const { state } = run(s, [cmd(r, 'offensive-rally'), cmd(g, 'blood-fervor', x)]);
    expect(state.units[g]!.attack).toBe(12 + 5);
    expect(state.units[x]!.health).toBe(68 - 17);
  });

  it('Blessing of Sacrifice redirects damage to Cornelius', () => {
    const s = battle([pick('cornelius'), pick('xyrella')], [pick('millhouse')]);
    const c = id(s, 'player', 0), x = id(s, 'player', 1), m = id(s, 'enemy', 0);
    s.units[c]!.abilities.forEach((a) => (a.cd = 0));
    const { state } = run(s, [cmd(c, 'blessing-of-sacrifice', x)], [cmd(m, 'arcane-bolt', x)]);
    expect(state.units[x]!.health).toBe(68);
    expect(state.units[c]!.health).toBe(79 - 24); // caster crits protector
  });

  it('Whirling Blade grants Immune after dealing damage', () => {
    const s = battle([pick('samuro')], [pick('xyrella'), pick('millhouse')]);
    const sa = id(s, 'player', 0), m = id(s, 'enemy', 1);
    s.units[sa]!.abilities.forEach((a) => (a.cd = 0));
    // Whirling Blade (5) then Arcane Bolt (6) is absorbed
    const { state } = run(s, [cmd(sa, 'whirling-blade')], [cmd(m, 'arcane-bolt', sa)]);
    expect(state.units[sa]!.health).toBe(66);
  });
});

describe('match flow', () => {
  it('declares a draw when both sides die together (spec test 16)', () => {
    const s = battle([pick('grommash')], [pick('rokara')]);
    const g = id(s, 'player', 0), r = id(s, 'enemy', 0);
    s.units[g]!.health = 5;
    s.units[r]!.health = 5;
    const { state } = run(s, [cmd(g, 'blood-fervor', r)]);
    expect(state.winner).toBe('draw');
  });

  it('plays a full AI-vs-AI match to a result without errors', () => {
    const all = ['cariel', 'cornelius', 'grommash', 'tyrande', 'samuro', 'rokara', 'xyrella', 'millhouse'];
    for (let seed = 1; seed <= 12; seed++) {
      let s = createBattle(all.slice(0, 6).map((d) => pick(d)), all.slice(2).map((d) => pick(d)), seed);
      for (let turn = 0; turn < 60 && s.phase !== 'over'; turn++) {
        for (const side of ['player', 'enemy'] as const) {
          for (const u of choosePlacement(s, side)) placeUnit(s, side, u);
        }
        s.phase = 'command';
        s = resolveTurn(s, { player: chooseCommands(s, 'player'), enemy: chooseCommands(s, 'enemy') }).state;
      }
      expect(s.phase).toBe('over');
    }
  });
});
