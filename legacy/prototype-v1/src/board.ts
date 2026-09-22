/** Board and party queries. Pure reads - nothing here mutates state. */

import {
  BOARD_SLOTS,
  otherSide,
  type BattleState,
  type MercState,
  type Side,
  type SideId,
  type Status,
  type StatusKind,
} from './types.ts';

export function findMerc(state: BattleState, uid: string): MercState | undefined {
  for (const id of ['a', 'b'] as const) {
    const found = state.sides[id].party.find((m) => m.uid === uid);
    if (found) return found;
  }
  return undefined;
}

export function requireMerc(state: BattleState, uid: string): MercState {
  const merc = findMerc(state, uid);
  if (!merc) throw new Error(`no merc with uid ${uid}`);
  return merc;
}

export function sideOf(state: BattleState, uid: string): SideId {
  for (const id of ['a', 'b'] as const) {
    if (state.sides[id].party.some((m) => m.uid === uid)) return id;
  }
  throw new Error(`no merc with uid ${uid}`);
}

/** Living mercs on the board, in slot order. */
export function boardMercs(state: BattleState, side: SideId): MercState[] {
  const out: MercState[] = [];
  for (const uid of state.sides[side].board) {
    if (uid === null) continue;
    const merc = findMerc(state, uid);
    if (merc?.alive) out.push(merc);
  }
  return out;
}

export function enemyBoard(state: BattleState, side: SideId): MercState[] {
  return boardMercs(state, otherSide(side));
}

/** Party members not on the board and still alive. */
export function benchMercs(state: BattleState, side: SideId): MercState[] {
  const onBoard = new Set(state.sides[side].board.filter((u): u is string => u !== null));
  return state.sides[side].party.filter((m) => m.alive && !onBoard.has(m.uid));
}

export function hasStatus(merc: MercState, kind: StatusKind): boolean {
  return merc.statuses.some((s) => s.kind === kind);
}

export function statusMagnitude(merc: MercState, kind: StatusKind): number {
  return merc.statuses.reduce((sum, s) => (s.kind === kind ? sum + s.magnitude : sum), 0);
}

export function getStatus(merc: MercState, kind: StatusKind): Status | undefined {
  return merc.statuses.find((s) => s.kind === kind);
}

/** Slot neighbours of a board position, living only. */
export function adjacentTo(state: BattleState, merc: MercState): MercState[] {
  if (merc.position === null) return [];
  const side = sideOf(state, merc.uid);
  const out: MercState[] = [];
  for (const offset of [-1, 1]) {
    const pos = merc.position + offset;
    if (pos < 0 || pos >= BOARD_SLOTS) continue;
    const uid = state.sides[side].board[pos];
    if (!uid) continue;
    const neighbour = findMerc(state, uid);
    if (neighbour?.alive) out.push(neighbour);
  }
  return out;
}

export function isDefeated(side: Side): boolean {
  return side.party.every((m) => !m.alive);
}

/** Lowest health, ties broken by board order for determinism. */
export function lowestHealth(mercs: readonly MercState[]): MercState | undefined {
  return mercs.reduce<MercState | undefined>(
    (best, m) => (best === undefined || m.health < best.health ? m : best),
    undefined,
  );
}

export function highestAttack(mercs: readonly MercState[]): MercState | undefined {
  return mercs.reduce<MercState | undefined>(
    (best, m) => (best === undefined || m.attack > best.attack ? m : best),
    undefined,
  );
}
