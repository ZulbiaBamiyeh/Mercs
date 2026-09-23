// Two playable rosters: the originals (src/engine/originals.ts) and the
// classic Hearthstone starters, kept for testing.
//
// The classic roster is built from src/data/roster.json. The JSON owns stats, speeds,
// cooldowns and item names. This file adds what the JSON does not say: how an
// ability targets, which icon it uses, and placeholder portrait colours.

import raw from '../data/roster.json';
import { MINIONS, ORIGINAL_MERCS } from './originals';
import type { AbilityDef, ItemDef, MercDef, Role, RosterId, School, TargetKind } from './types';

export const slug = (s: string) =>
  s.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const ABILITY_META: Record<string, { target: TargetKind; isAttack?: boolean; icon: string }> = {
  'crusaders-blow': { target: 'enemy', isAttack: true, icon: 'sparkling-sabre' },
  taunt: { target: 'none', icon: 'templar-shield' },
  'seal-of-light': { target: 'friendly', icon: 'holy-symbol' },
  'martial-mastery': { target: 'enemy', isAttack: true, icon: 'mailed-fist' },
  'hold-the-front': { target: 'none', icon: 'arrows-shield' },
  'blessing-of-sacrifice': { target: 'otherFriendly', icon: 'heart-shield' },
  'blood-fervor': { target: 'enemy', isAttack: true, icon: 'war-axe' },
  'staggering-slam': { target: 'enemy', icon: 'hammer-drop' },
  battlefury: { target: 'enemy', isAttack: true, icon: 'axe-swing' },
  'arcane-shot': { target: 'enemy', icon: 'energy-arrow' },
  'arcane-salvo': { target: 'none', icon: 'striking-arrows' },
  'elunes-grace': { target: 'none', icon: 'moon' },
  'double-strike': { target: 'enemy', isAttack: true, icon: 'crossed-swords' },
  'mirror-image': { target: 'enemy', isAttack: true, icon: 'two-shadows' },
  'whirling-blade': { target: 'none', icon: 'sword-spin' },
  'tribal-warfare': { target: 'enemy', isAttack: true, icon: 'crossed-axes' },
  'offensive-rally': { target: 'none', icon: 'rally-the-troops' },
  'orc-onslaught': { target: 'enemy', icon: 'wolf-howl' },
  'blinding-luminance': { target: 'enemy', icon: 'sun-radiations' },
  'flash-heal': { target: 'friendly', icon: 'healing' },
  atonement: { target: 'enemy', icon: 'sunrise' },
  'arcane-explosion': { target: 'none', icon: 'magic-swirl' },
  'arcane-bolt': { target: 'enemy', icon: 'star-swirl' },
  'greater-arcane-missiles': { target: 'none', icon: 'missile-swarm' },
};

const ITEM_META: Record<string, Pick<ItemDef, 'icon' | 'modifies' | 'health' | 'reduction' | 'cooldown'>> = {
  'hammer-of-dawn': { icon: 'warhammer', modifies: 'crusaders-blow' },
  'tome-of-judgment': { icon: 'spell-book', modifies: 'seal-of-light' },
  'tome-of-light': { icon: 'book-cover', modifies: null },
  'striking-gauntlets': { icon: 'gauntlet', modifies: 'martial-mastery' },
  'band-of-enlightenment': { icon: 'ring', modifies: 'hold-the-front' },
  'shield-of-dawn': { icon: 'magic-shield', modifies: null, reduction: 3 },
  gorehowl: { icon: 'battle-axe', modifies: 'blood-fervor' },
  'halting-sash': { icon: 'belt', modifies: 'staggering-slam' },
  'bloodthirst-amulet': { icon: 'gem-pendant', modifies: 'battlefury' },
  'elunes-charm': { icon: 'feather-necklace', modifies: 'arcane-shot' },
  'verdant-recurve': { icon: 'pocket-bow', modifies: 'arcane-salvo' },
  'band-of-the-wilds': { icon: 'engagement-ring', modifies: 'elunes-grace' },
  'sash-of-illusion': { icon: 'black-belt', modifies: 'mirror-image' },
  'honed-blade': { icon: 'ancient-sword', modifies: 'whirling-blade' },
  'burning-blade': { icon: 'flaming-claw', modifies: null },
  'frostwolf-talisman': { icon: 'wolf-head', modifies: 'tribal-warfare' },
  'helm-of-inspiration': { icon: 'horned-helm', modifies: 'offensive-rally' },
  'ancestral-armor': { icon: 'armor-vest', modifies: null, health: 20 },
  'radiant-wand': { icon: 'crystal-wand', modifies: 'blinding-luminance' },
  'shard-of-the-naaru': { icon: 'crystal-growth', modifies: 'flash-heal', cooldown: { ability: 'flash-heal', delta: 1 } },
  'robes-of-purity': { icon: 'robe', modifies: 'atonement' },
  'arcane-powder': { icon: 'powder-bag', modifies: 'arcane-explosion' },
  'mana-rod': { icon: 'wizard-staff', modifies: 'arcane-bolt', cooldown: { ability: 'arcane-bolt', delta: 1 } },
  'ley-line-wand': { icon: 'orb-wand', modifies: 'greater-arcane-missiles' },
};

const MERC_META: Record<string, { palette: [string, string]; title: string }> = {
  cariel: { palette: ['#f3c86b', '#8a4b1c'], title: 'Paladin of the Silver Hand' },
  cornelius: { palette: ['#e8e1c7', '#5b6a8c'], title: 'Lord of Stormwind' },
  grommash: { palette: ['#c9563c', '#3a1c14'], title: 'Warchief of the Horde' },
  tyrande: { palette: ['#b9a6ff', '#2b2a6b'], title: 'High Priestess of Elune' },
  samuro: { palette: ['#f08a4b', '#2d1f33'], title: 'The Burning Blade' },
  rokara: { palette: ['#8fcf6a', '#23402a'], title: 'Frostwolf Champion' },
  xyrella: { palette: ['#ffe39a', '#6b3f86'], title: 'Light of the Naaru' },
  millhouse: { palette: ['#7ed8ff', '#2b3f7a'], title: 'Master Arcanist, Allegedly' },
};

interface RawAbility { name: string; speed: number; cooldown: number; school: string | null }
interface RawItem { name: string; text: string }
interface RawMerc {
  id: string; name: string; role: string; rarity: string; faction: string | null; types: string[];
  attack: number; health: number; abilities: RawAbility[]; equipment: RawItem[];
}

function buildAbility(a: RawAbility): AbilityDef {
  const id = slug(a.name);
  const meta = ABILITY_META[id];
  if (!meta) throw new Error(`No ability logic for ${a.name}`);
  return {
    id,
    name: a.name,
    speed: a.speed,
    cooldown: a.cooldown,
    school: (a.school as School | null) ?? null,
    target: meta.target,
    isAttack: meta.isAttack ?? false,
    icon: meta.icon,
  };
}

function buildItem(i: RawItem): ItemDef {
  const id = slug(i.name);
  const meta = ITEM_META[id];
  if (!meta) throw new Error(`No item metadata for ${i.name}`);
  return { id, name: i.name, text: i.text, ...meta };
}

export const CLASSIC_MERCS: MercDef[] = (raw.mercs as RawMerc[]).map((m) => {
  const meta = MERC_META[m.id];
  if (!meta) throw new Error(`No portrait metadata for ${m.id}`);
  return {
    id: m.id,
    name: m.name,
    role: m.role as Role,
    rarity: m.rarity as MercDef['rarity'],
    faction: m.faction,
    types: m.types,
    attack: m.attack,
    health: m.health,
    abilities: m.abilities.map(buildAbility),
    items: m.equipment.map(buildItem),
    palette: meta.palette,
    title: meta.title,
    roster: 'classic' as const,
  };
});

export const ROSTERS: Record<Exclude<RosterId, 'minion'>, MercDef[]> = {
  originals: ORIGINAL_MERCS,
  classic: CLASSIC_MERCS,
};

/** Every playable merc, both rosters. */
export const MERCS: MercDef[] = [...ORIGINAL_MERCS, ...CLASSIC_MERCS];

const ALL = [...MERCS, ...MINIONS];

export const MERC_BY_ID: Record<string, MercDef> = Object.fromEntries(ALL.map((m) => [m.id, m]));

export const ABILITY_BY_ID: Record<string, AbilityDef> = Object.fromEntries(
  ALL.flatMap((m) => m.abilities.map((a) => [a.id, a])),
);

export const ITEM_BY_ID: Record<string, ItemDef> = Object.fromEntries(
  ALL.flatMap((m) => m.items.map((i) => [i.id, i])),
);

{
  const ids = ALL.flatMap((m) => m.abilities.map((a) => a.id));
  const dup = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dup) throw new Error(`Duplicate ability id ${dup}`);
}

export function mercDef(id: string): MercDef {
  const d = MERC_BY_ID[id];
  if (!d) throw new Error(`Unknown merc ${id}`);
  return d;
}

export function abilityDef(id: string): AbilityDef {
  const d = ABILITY_BY_ID[id];
  if (!d) throw new Error(`Unknown ability ${id}`);
  return d;
}
