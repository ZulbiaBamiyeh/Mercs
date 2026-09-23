// Data model for the combat engine. Static content (MercDef, AbilityDef,
// ItemDef) is separate from runtime state (Unit, BattleState), and everything
// in BattleState is plain JSON so a snapshot is just structuredClone.

export type Role = 'PROTECTOR' | 'FIGHTER' | 'CASTER';
export type Side = 'player' | 'enemy';
export type School = 'Holy' | 'Arcane' | 'Frost' | 'Shadow' | 'Fire' | 'Nature' | 'Fel';

/** What a player clicks after choosing the ability. */
export type TargetKind = 'enemy' | 'friendly' | 'otherFriendly' | 'none';

export interface AbilityDef {
  id: string;
  name: string;
  speed: number;
  cooldown: number;
  school: School | null;
  target: TargetKind;
  /** True when the ability Attacks, so Taunt restricts its target. */
  isAttack: boolean;
  icon: string;
  /** Attacks twice (the second picks a new target if the first died). */
  windfury?: boolean;
  /** Draw the icon as pixel art, to match pixel portraits. */
  pixel?: boolean;
}

export interface ItemDef {
  id: string;
  name: string;
  text: string;
  icon: string;
  /** The ability this item modifies, or null for a passive. */
  modifies: string | null;
  // Simple passives the engine applies itself.
  health?: number;
  /** Flat damage reduction. */
  reduction?: number;
  /** Damage dealt back to anything that Attacks this merc. */
  thorns?: number;
  /** Permanent speed change for one ability. */
  speed?: { ability: string; delta: number };
  /** Extra cooldown for one ability. */
  cooldown?: { ability: string; delta: number };
  pixel?: boolean;
}

export type RosterId = 'originals' | 'classic' | 'minion';

export interface MercDef {
  id: string;
  name: string;
  role: Role;
  rarity: 'Rare' | 'Epic' | 'Legendary';
  faction: string | null;
  types: string[];
  attack: number;
  health: number;
  abilities: AbilityDef[];
  items: ItemDef[];
  /** Two colours for the placeholder portrait until real art exists. */
  palette: [string, string];
  title: string;
  roster: RosterId;
}

export interface AbilityState {
  id: string;
  /** Turns until usable; 0 means ready. See spec §3. */
  cd: number;
  /** Permanent speed change (Elune's Grace makes this negative). */
  speedMod: number;
}

export interface Unit {
  uid: string;
  defId: string;
  side: Side;
  name: string;
  role: Role | null;
  faction: string | null;
  types: string[];
  baseAttack: number;
  /** Current permanent Attack, including buffs. */
  attack: number;
  baseMaxHealth: number;
  maxHealth: number;
  health: number;
  abilities: AbilityState[];
  item: string | null;
  isMinion: boolean;
  /** Dies at end of turn (Mirror Image). Other minions stay until killed. */
  expires: boolean;
  dead: boolean;

  // statuses
  /** Turns of Taunt left, counting the current one. */
  taunt: number;
  immune: boolean;
  /** Attack change that expires at end of turn (Blinding Luminance). */
  attackThisTurn: number;
  /** Added to this unit's next ability, then cleared (Staggering Slam). */
  pendingSlow: number;
  /** Elune's Grace: the next Arcane ability casts twice. */
  graceCharges: number;
  /** +X Arcane Damage (Arcane Bolt). */
  arcaneDamage: number;
  /** Blessing of Sacrifice: damage to this unit goes to this uid instead. */
  guardedBy: string | null;
  acted: boolean;
  damagedThisTurn: boolean;

  /** Damage taken at end of each turn until healed. */
  bleed: number;
  /** Turns left, counting this one: can't Attack. */
  rooted: number;
  /** Turns left, counting this one: loses its next action. */
  frozen: number;
  /** Absorbs the next damage instance. */
  shield: boolean;
  /** Can't be targeted by enemies until it acts. */
  stealth: boolean;
  /** Turns left: damage this unit deals heals it. */
  lifesteal: number;
  /** Damage dealt back to attackers this turn, on top of item thorns. */
  thorns: number;
  /** This turn: characters that Attack this unit are Frozen until end of next turn. */
  frostArmor: boolean;
  /** Extra damage taken from each school, permanent. */
  weakness: Partial<Record<School, number>>;
  /** Speed change for this turn only. */
  speedThisTurn: number;
}

export interface SideState {
  /** Left to right. Dead units stay in place until end of turn. */
  board: string[];
  bench: string[];
  /** Health restored by this team this fight, for Atonement. */
  healed: number;
  /** Offensive Rally, active for the rest of the turn. */
  rally: { attack: number; health: number } | null;
  /** Abilities this side has resolved this turn, for Combo. */
  resolved: number;
}

export type Phase = 'placement' | 'command' | 'over';

export interface BattleState {
  turn: number;
  phase: Phase;
  units: Record<string, Unit>;
  sides: Record<Side, SideState>;
  rng: number;
  nextUid: number;
  winner: Side | 'draw' | null;
}

export interface Command {
  actor: string;
  ability: string;
  target: string | null;
}

export interface PartyPick {
  defId: string;
  item: string | null;
}

// ---------------------------------------------------------------------------
// Events. Resolution emits one per visible beat, each paired with the state
// right after it, so the UI can animate the beat and then show that state.

export type DamageKind = 'attack' | 'counter' | 'spell';

export type BattleEvent =
  | { t: 'act'; actor: string; ability: string; target: string | null; side: Side; echo: boolean }
  | { t: 'attack'; attacker: string; target: string }
  | { t: 'projectile'; from: string; to: string; school: School | null }
  | { t: 'nova'; from: string; side: Side; school: School | null }
  | { t: 'damage'; target: string; amount: number; crit: boolean; kind: DamageKind; source: string | null; lethal: boolean }
  | { t: 'heal'; target: string; amount: number }
  | { t: 'buff'; target: string; attack: number; health: number }
  | { t: 'status'; target: string; text: string; tone: 'good' | 'bad' | 'neutral' }
  | { t: 'redirect'; from: string; to: string; reason: string }
  | { t: 'death'; unit: string }
  | { t: 'summon'; unit: string; by: string }
  | { t: 'vanish'; unit: string }
  | { t: 'fizzle'; actor: string }
  | { t: 'endTurn'; turn: number };

export interface Step {
  event: BattleEvent;
  state: BattleState;
}
