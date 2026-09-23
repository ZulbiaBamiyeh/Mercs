import { describe, expect, it } from 'vitest';
import {
  createBattle, legalTargets, O, placeUnit, resolveTurn, ROSTERS,
  type BattleState, type Command, type PartyPick, type Side,
} from '../src/engine';

const pick = (defId: string, item: string | null = null): PartyPick => ({ defId, item });

function battle(player: PartyPick[], enemy: PartyPick[], seed = 1): BattleState {
  const s = createBattle(player, enemy, seed);
  for (const side of ['player', 'enemy'] as const) {
    for (const id of [...s.sides[side].bench].slice(0, 3)) placeUnit(s, side, id);
  }
  for (const u of Object.values(s.units)) for (const a of u.abilities) a.cd = 0;
  s.phase = 'command';
  return s;
}
const id = (s: BattleState, side: Side, i: number) => s.sides[side].board[i]!;
const cmd = (actor: string, ability: string, target: string | null = null): Command => ({ actor, ability, target });
const run = (s: BattleState, player: Command[], enemy: Command[] = []) => resolveTurn(s, { player, enemy });

describe('original roster content', () => {
  it('has 12 mercs, four per role, three factions of four', () => {
    const r = ROSTERS.originals;
    expect(r).toHaveLength(12);
    for (const role of ['PROTECTOR', 'FIGHTER', 'CASTER']) expect(r.filter((m) => m.role === role)).toHaveLength(4);
    const factions = new Map<string, number>();
    for (const m of r) factions.set(m.faction!, (factions.get(m.faction!) ?? 0) + 1);
    expect([...factions.values()]).toEqual([4, 4, 4]);
  });
});

describe('new mechanics', () => {
  it('Bleed ticks at end of turn and any heal cures it', () => {
    const s = battle([pick('lyra'), pick('oona')], [pick('vessa')]);
    const l = id(s, 'player', 0), v = id(s, 'enemy', 0);
    const hp = s.units[v]!.maxHealth;
    let st = run(s, [cmd(l, 'barbed-arrow', v)]).state;
    // Fighter vs Protector: no crit. The hit, then one tick of Bleed.
    expect(st.units[v]!.health).toBe(hp - O.barbed - O.barbedBleed);
    expect(st.units[v]!.bleed).toBe(O.barbedBleed);
    st = run(st, [], [cmd(v, 'bone-wall')]).state; // no heal: bleeds again
    expect(st.units[v]!.health).toBe(hp - O.barbed - O.barbedBleed * 2);
  });

  it('Root cancels an Attack and everything after it', () => {
    const s = battle([pick('lyra')], [pick('rurik')]);
    const l = id(s, 'player', 0), r = id(s, 'enemy', 0);
    // Pinning Shot (2) roots before Boarding Hook (6)
    const { state } = run(s, [cmd(l, 'pinning-shot', r)], [cmd(r, 'boarding-hook', l)]);
    expect(state.units[l]!.health).toBe(76);
  });

  it('Freeze skips an action that has not happened yet', () => {
    const s = battle([pick('ilsa')], [pick('rurik')]);
    const i = id(s, 'player', 0), r = id(s, 'enemy', 0);
    // Blizzard (6) freezes Rurik before Boarding Hook... Boarding Hook is also 6, so slow it first.
    s.units[r]!.speedThisTurn = 2;
    const { state, steps } = run(s, [cmd(i, 'blizzard')], [cmd(r, 'boarding-hook', i)]);
    expect(steps.some((st) => st.event.t === 'status' && st.event.text === 'Frozen')).toBe(true);
    expect(state.units[i]!.health).toBe(68);
  });

  it('Divine Shield absorbs one hit, including a crit', () => {
    const s = battle([pick('aurelle'), pick('brannoc')], [pick('mordekai')]);
    const a = id(s, 'player', 0), b = id(s, 'player', 1), m = id(s, 'enemy', 0);
    const { state } = run(s, [cmd(a, 'aegis-prayer', b)], [cmd(m, 'shadow-bolt', b)]);
    expect(state.units[b]!.health).toBe(state.units[b]!.maxHealth);
    expect(state.units[b]!.shield).toBe(false);
  });

  it('Stealth hides a merc from single-target enemy abilities', () => {
    const s = battle([pick('nyxa'), pick('brannoc')], [pick('mordekai')]);
    const n = id(s, 'player', 0), m = id(s, 'enemy', 0);
    s.units[n]!.stealth = true;
    expect(legalTargets(s, m, 'shadow-bolt')).not.toContain(n);
  });

  it('Windfury Attacks twice', () => {
    const s = battle([pick('torvik')], [pick('vessa')]);
    const t = id(s, 'player', 0), v = id(s, 'enemy', 0);
    const { state } = run(s, [cmd(t, 'twin-axes', v)]);
    expect(state.units[v]!.health).toBe(70 - 9 * 2);
  });

  it('Combo only triggers after a friendly ability resolved earlier this turn', () => {
    const s = battle([pick('rurik'), pick('aurelle')], [pick('vessa')]);
    const r = id(s, 'player', 0), a = id(s, 'player', 1), v = id(s, 'enemy', 0);
    const hp = s.units[v]!.maxHealth, atk = s.units[r]!.attack;
    const alone = run(s, [cmd(r, 'boarding-hook', v)]).state;
    expect(alone.units[v]!.health).toBe(hp - atk);
    const combo = run(s, [cmd(a, 'aegis-prayer', a), cmd(r, 'boarding-hook', v)]).state;
    expect(combo.units[v]!.health).toBe(hp - atk * 2);
  });

  it('Lifesteal heals by the damage dealt', () => {
    const s = battle([pick('vessa')], [pick('torvik')]);
    const v = id(s, 'player', 0), t = id(s, 'enemy', 0);
    s.units[v]!.health = 40;
    const { state } = run(s, [cmd(v, 'grave-cleave', t)]);
    // Protector crits Fighter for 24, takes 9 back: 40 - 9 + 24
    expect(state.units[v]!.health).toBe(55);
  });

  it('Shadow Weakness adds to Shadow damage, before the crit', () => {
    const s = battle([pick('mordekai')], [pick('brannoc')]);
    const m = id(s, 'player', 0), b = id(s, 'enemy', 0);
    s.units[b]!.weakness.Shadow = 4;
    const { state } = run(s, [cmd(m, 'shadow-bolt', b)]);
    expect(state.units[b]!.health).toBe(state.units[b]!.maxHealth - (O.shadowBolt + 4) * 2);
  });

  it('summons stay on the board and can take orders next turn', () => {
    const s = battle([pick('grisk')], [pick('vessa')]);
    const g = id(s, 'player', 0), v = id(s, 'enemy', 0);
    let st = run(s, [cmd(g, 'call-wolf')]).state;
    const wolf = st.sides.player.board[1]!;
    expect(st.units[wolf]!.name).toBe('Fen Wolf');
    st = run(st, [cmd(wolf, 'bite', v)]).state;
    expect(st.units[v]!.health).toBe(70 - O.wolfAttack);
  });

  it('thorns hit back whoever Attacks', () => {
    const s = battle([pick('brannoc')], [pick('torvik')]);
    const b = id(s, 'player', 0), t = id(s, 'enemy', 0);
    const { state } = run(s, [cmd(b, 'molten-bulwark')], [cmd(t, 'berserk', b)]);
    // Berserk: 8 to self, 12 counter from Brannoc, 10 thorns
    expect(state.units[t]!.health).toBe(74 - 8 - 12 - O.bulwarkThorns);
  });

  it('Frost Armor freezes an attacker through the end of next turn', () => {
    const s = battle([pick('ilsa'), pick('brannoc')], [pick('torvik')]);
    const i = id(s, 'player', 0), b = id(s, 'player', 1), t = id(s, 'enemy', 0);
    let st = run(s, [cmd(i, 'frost-armor', b)], [cmd(t, 'twin-axes', b)]).state;
    expect(st.units[t]!.frozen).toBe(1);
    const next = run(st, [], [cmd(t, 'twin-axes', b)]);
    expect(next.steps.some((x) => x.event.t === 'act' && x.event.actor === t)).toBe(false);
    st = next.state;
    expect(st.units[t]!.frozen).toBe(0);
  });
});
