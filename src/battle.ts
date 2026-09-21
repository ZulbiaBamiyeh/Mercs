/**
 * Battle setup and the match loop.
 *
 * A party is 6 mercenaries; the first 3 start on the board and the rest
 * rotate in as slots open. Equipment is folded into the merc's abilities at
 * setup, so the resolver never has to know equipment exists.
 */

import { resolveRound } from './resolve.ts';
import {
  attackAtLevel,
  healthAtLevel,
  BOARD_SLOTS,
  PARTY_SIZE,
  type Ability,
  type BattleState,
  type Equipment,
  type MercDef,
  type MercState,
  type RoundOrders,
  type Side,
  type SideId,
} from './types.ts';

/** A party slot: which mercenary, at what level, holding what. */
export interface PartyEntry {
  def: MercDef;
  level?: number;
  equippedId?: string | null;
}

function applyEquipment(abilities: Ability[], equipment: Equipment | null): Ability[] {
  if (!equipment) return abilities;

  return abilities.map((ability) => {
    const applies = equipment.grantsTo === 'all' || equipment.grantsTo === ability.id;
    if (!applies) return ability;
    return {
      ...ability,
      speed: Math.max(1, ability.speed + (equipment.speedDelta ?? 0)),
      effects: [...ability.effects, ...(equipment.grants ?? [])],
    };
  });
}

/**
 * Build a runtime god from a party entry.
 *
 * `uid` must be unique within a battle; `createSide` always supplies one. It
 * defaults to the definition id for standalone inspection (tools, tests).
 */
export function createMerc(entry: PartyEntry, uid: string = entry.def.id): MercState {
  const level = entry.level ?? 30;
  const { def } = entry;

  const equipment =
    entry.equippedId == null ? null : def.equipment.find((e) => e.id === entry.equippedId) ?? null;
  if (entry.equippedId != null && !equipment) {
    throw new Error(`${def.name} has no equipment ${entry.equippedId}`);
  }

  const abilities = applyEquipment(
    def.abilities.filter((a) => a.unlockLevel <= level).map((a) => ({ ...a })),
    equipment,
  );
  if (abilities.length === 0) {
    throw new Error(`${def.name} has no abilities unlocked at level ${level}`);
  }

  const maxHealth = healthAtLevel(def, level) + (equipment?.healthBonus ?? 0);

  // Abilities that have a cooldown start on it, so a party cannot open with
  // its heaviest hits on round one.
  const cooldowns: Record<string, number> = {};
  for (const ability of abilities) cooldowns[ability.id] = ability.cooldown;

  return {
    uid,
    defId: def.id,
    name: def.name,
    role: def.role,
    pantheon: def.pantheon,
    level,
    attack: attackAtLevel(def, level) + (equipment?.attackBonus ?? 0),
    maxHealth,
    health: maxHealth,
    statuses: [],
    cooldowns,
    abilities,
    equippedId: equipment?.id ?? null,
    alive: true,
    position: null,
  };
}

function createSide(id: SideId, party: readonly PartyEntry[]): Side {
  if (party.length === 0 || party.length > PARTY_SIZE) {
    throw new Error(`a party must hold 1-${PARTY_SIZE} mercenaries, got ${party.length}`);
  }

  const mercs = party.map((entry, index) => createMerc(entry, `${id}${index}`));
  const board: (string | null)[] = Array.from({ length: BOARD_SLOTS }, () => null);

  for (let slot = 0; slot < Math.min(BOARD_SLOTS, mercs.length); slot++) {
    const merc = mercs[slot]!;
    board[slot] = merc.uid;
    merc.position = slot;
  }

  return { id, party: mercs, board };
}

export interface BattleOptions {
  seed?: string;
  partyA: readonly PartyEntry[];
  partyB: readonly PartyEntry[];
}

export function createBattle(options: BattleOptions): BattleState {
  return {
    seed: options.seed ?? 'default-seed',
    round: 0,
    sides: {
      a: createSide('a', options.partyA),
      b: createSide('b', options.partyB),
    },
    log: [],
    winner: null,
  };
}

/** A decision procedure for one side. */
export type OrderSource = (state: BattleState, side: SideId) => RoundOrders['a'];

export interface RunResult {
  final: BattleState;
  rounds: number;
  /** Orders per round, which together with the seed replay the match exactly. */
  history: RoundOrders[];
}

/**
 * Play a battle to completion.
 *
 * A round cap is required: two defensive parties with sustain can stall
 * forever, and an unbounded loop in a balance sweep is a hang, not a draw.
 */
export function runBattle(
  state: BattleState,
  chooseA: OrderSource,
  chooseB: OrderSource,
  maxRounds = 30,
): RunResult {
  let current = state;
  const history: RoundOrders[] = [];

  while (current.winner === null && current.round < maxRounds) {
    const orders: RoundOrders = { a: chooseA(current, 'a'), b: chooseB(current, 'b') };
    history.push(orders);
    current = resolveRound(current, orders);
  }

  if (current.winner === null) {
    current = { ...current, winner: 'draw', log: [...current.log, {
      round: current.round,
      kind: 'timeout',
      message: `neither party fell within ${maxRounds} rounds`,
    }] };
  }

  return { final: current, rounds: current.round, history };
}
