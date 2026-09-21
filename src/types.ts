/**
 * Core data model.
 *
 * The split that matters: `MercDef` / `Ability` are static content (pure data,
 * safe to author in bulk, never mutated), while `MercState` / `BattleState`
 * are runtime instances. Adding a mercenary should mean adding data, not code;
 * adding a *new kind of* effect means registering one handler in effects.ts.
 */

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export type Role = 'fighter' | 'caster' | 'protector';

export const ROLES: readonly Role[] = ['fighter', 'caster', 'protector'];

/** Who each role deals bonus damage to. Protector > Fighter > Caster > Protector. */
export const ROLE_COUNTERS: Readonly<Record<Role, Role>> = {
  protector: 'fighter',
  fighter: 'caster',
  caster: 'protector',
};

/** Damage multiplier applied when a role attacks the role it counters. */
export const ROLE_BONUS_MULTIPLIER = 2;

export function hasRoleBonus(attacker: Role, defender: Role): boolean {
  return ROLE_COUNTERS[attacker] === defender;
}

// ---------------------------------------------------------------------------
// Targeting
// ---------------------------------------------------------------------------

/** What the controlling player must choose when submitting an order. */
export type Targeting =
  | 'enemy'  // pick one enemy on the board
  | 'ally'   // pick one ally on the board (may include self)
  | 'self'   // no choice
  | 'none';  // no choice; effects pick their own targets

/**
 * Where an individual effect lands. Resolved at resolution time, not at
 * submission time, so a selector always sees the board as it is *now*.
 */
export type Selector =
  | 'chosen'               // whatever the player picked
  | 'self'
  | 'all-enemies'
  | 'all-allies'
  | 'other-allies'
  | 'random-enemy'
  | 'lowest-health-enemy'
  | 'lowest-health-ally'
  | 'highest-attack-enemy'
  | 'chosen-and-adjacent';

// ---------------------------------------------------------------------------
// Damage
// ---------------------------------------------------------------------------

/**
 * Damage is either flat, a multiple of the caster's current attack, or both.
 * A plain weapon swing is `{ attackScale: 1 }`; a fixed nuke is `{ flat: 12 }`.
 */
export interface DamageSpec {
  flat?: number;
  attackScale?: number;
}

// ---------------------------------------------------------------------------
// Statuses
// ---------------------------------------------------------------------------

export type StatusKind =
  | 'attack-buff'   // magnitude added to attack while active
  | 'shield'        // magnitude absorbs incoming damage, then decays
  | 'dot'           // magnitude damage at end of each round
  | 'regen'         // magnitude healing at end of each round
  | 'stun'          // cannot act
  | 'taunt'         // enemy single-target damage redirects here
  | 'immune'        // ignores all incoming damage
  | 'divine-shield'; // negates the next instance of damage

export interface Status {
  kind: StatusKind;
  magnitude: number;
  /** Rounds remaining; `Infinity` for permanent. Ticked at end of round. */
  remaining: number;
  /** Ability id that applied it, for logging and dispel rules. */
  sourceAbility: string;
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

export type Effect =
  | { kind: 'damage'; target: Selector; damage: DamageSpec }
  | { kind: 'multi-hit'; target: Selector; damage: DamageSpec; hits: number }
  | { kind: 'drain'; target: Selector; damage: DamageSpec; healFraction: number }
  | {
      kind: 'execute';
      target: Selector;
      damage: DamageSpec;
      /** Bonus applies when the target is at or below this fraction of max health. */
      threshold: number;
      bonus: DamageSpec;
    }
  | { kind: 'heal'; target: Selector; amount: number }
  | { kind: 'apply-status'; target: Selector; status: Omit<Status, 'sourceAbility'> }
  | { kind: 'cleanse'; target: Selector }
  | { kind: 'dispel'; target: Selector }
  | { kind: 'cooldown-reduce'; target: Selector; rounds: number }
  | { kind: 'revive'; healthFraction: number };

// ---------------------------------------------------------------------------
// Abilities and equipment
// ---------------------------------------------------------------------------

export interface Ability {
  id: string;
  name: string;
  /** 1-9. Lower resolves first. Ties are broken by the round's seeded RNG. */
  speed: number;
  /** Rounds before reuse. `> 0` means unavailable on round 1. */
  cooldown: number;
  /** Party level at which this ability unlocks (1 / 5 / 15 in the source game). */
  unlockLevel: number;
  targeting: Targeting;
  effects: Effect[];
  text: string;
}

export interface Equipment {
  id: string;
  name: string;
  text: string;
  /** Flat stat adjustments applied at battle start. */
  attackBonus?: number;
  healthBonus?: number;
  /** Extra effects appended to a specific ability, or to every ability. */
  grantsTo?: string | 'all';
  grants?: Effect[];
  /** Speed adjustment applied to the granted-to ability (negative is faster). */
  speedDelta?: number;
}

// ---------------------------------------------------------------------------
// Mercenary definitions
// ---------------------------------------------------------------------------

export interface MercDef {
  id: string;
  name: string;
  role: Role;
  /** Pantheon the god belongs to. A synergy axis for pantheon-wide effects. */
  pantheon: string;
  /** Stats at level 1. */
  baseAttack: number;
  baseHealth: number;
  /** Added per level beyond 1. */
  attackGrowth: number;
  healthGrowth: number;
  abilities: Ability[];
  equipment: Equipment[];
}

export const MAX_LEVEL = 30;

export function attackAtLevel(def: MercDef, level: number): number {
  return Math.round(def.baseAttack + def.attackGrowth * (level - 1));
}

export function healthAtLevel(def: MercDef, level: number): number {
  return Math.round(def.baseHealth + def.healthGrowth * (level - 1));
}

// ---------------------------------------------------------------------------
// Runtime state
// ---------------------------------------------------------------------------

export type SideId = 'a' | 'b';

export const BOARD_SLOTS = 3;
export const PARTY_SIZE = 6;

export interface MercState {
  /** Unique per battle instance (a party may hold duplicates of a def). */
  uid: string;
  defId: string;
  name: string;
  role: Role;
  pantheon: string;
  level: number;
  attack: number;
  maxHealth: number;
  health: number;
  statuses: Status[];
  /** abilityId -> rounds remaining before it may be used again. */
  cooldowns: Record<string, number>;
  /** Ability ids unlocked at this merc's level, plus equipment adjustments. */
  abilities: Ability[];
  equippedId: string | null;
  alive: boolean;
  /** 0-2 while on the board, `null` while benched or dead. */
  position: number | null;
}

export interface Side {
  id: SideId;
  /** All party members, board and bench alike. */
  party: MercState[];
  /** Board slots holding merc uids; `null` is an empty slot. */
  board: (string | null)[];
}

export interface Order {
  actorUid: string;
  abilityId: string;
  /** Required when the ability's targeting is 'enemy' or 'ally'. */
  targetUid?: string;
}

export interface RoundOrders {
  a: Order[];
  b: Order[];
}

export interface LogEntry {
  round: number;
  kind: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface BattleState {
  seed: string;
  round: number;
  sides: Record<SideId, Side>;
  log: LogEntry[];
  winner: SideId | 'draw' | null;
}

export function otherSide(id: SideId): SideId {
  return id === 'a' ? 'b' : 'a';
}
