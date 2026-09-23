// The original roster: 12 mercenaries across three factions, four per role.
// Pure data and card text; what the abilities do lives in originals-impl.ts.
//
// Factions (each has one of every role, plus one more):
//   Ironvow       oath-sworn dwarves and humans. Shields, fire, the Attack keyword.
//   Thornwild     druids, beasts and fen-folk. Root, Bleed, healing, summons.
//   Hollow Court  the restless dead. Lifesteal, curses, Freeze, Stealth.
//
// Stat budgets follow the classic starters at max power: Protectors ~11/78,
// Fighters ~9/70, Casters ~5/67.

import type { AbilityDef, ItemDef, MercDef, Role, School, TargetKind } from './types';

/** Card text for one ability, given who holds it (for item bonuses). */
export type TextFn = (u: { item: string | null } | null) => string;

export const ORIGINAL_TEXT: Record<string, TextFn> = {};

/** Numbers shared by the rules and the card text. */
export const O = {
  anvilSlow: 3, cindersteel: 2,
  forgeWardHeal: 8, forgeHeal: 12,
  bulwarkThorns: 12, magmaCore: 7, bulwarkTaunt: 2,
  hookAttack: 3,
  holdTaunt: 2,
  crewSpeed: 3, bannerAttack: 4,
  brambleDamage: 8, strangling: 6,
  rootsHeal: 10, heartwoodHeal: 8, rootsTaunt: 2,
  graveAxe: 4, boneTaunt: 2, harvest: 8, reaper: 3, ossuary: 2,
  serratedBleed: 5, venom: 4, vanishAttack: 6, ghostSilk: 4, shadowstep: 2,
  thunderclap: 6, stormRune: 4, thunderSlow: 2,
  berserkSelf: 8, berserkAttack: 12, bloodrage: 6, girdle: 20,
  barbed: 8, barbedBleed: 3, hawkeye: 5,
  pinning: 6, weightedSlow: 3,
  volley: 7, volleyBleeding: 6,
  goreBeast: 3, tuskCharm: 2,
  wolfAttack: 9, wolfHealth: 26, collarAttack: 4, collarHealth: 10,
  howl: 5, warDrum: 3,
  smite: 11, censer: 4,
  aegisHeal: 10, beads: 10,
  dawnfire: 15, sunstone: 6,
  surge: 9, surgeSplash: 4, stormTotem: 4,
  tide: 10, tidestone: 6,
  whirlpool: 6, whirlpoolSlow: 4, riptide: 6,
  shadowBolt: 14, grimoire: 4,
  curseAttack: 4, curseWeakness: 4, hexCandle: 3,
  skeletonAttack: 7, skeletonHealth: 16,
  iceLance: 10, iceLanceFrozen: 22, rime: 4,
  blizzard: 7, wintersCrown: 3,
  mantleHeal: 12,
} as const;

const up = (base: number, bonus: number) => (bonus ? `{${base + bonus}}` : `${base}`);

interface AbilitySpec {
  id: string;
  name: string;
  speed: number;
  cooldown: number;
  school: School | null;
  target: TargetKind;
  isAttack?: boolean;
  windfury?: boolean;
  icon: string;
  text: TextFn;
}

interface ItemSpec extends Omit<ItemDef, 'modifies'> { modifies?: string | null }

interface MercSpec {
  id: string;
  name: string;
  title: string;
  role: Role;
  rarity: MercDef['rarity'];
  faction: string;
  types: string[];
  attack: number;
  health: number;
  palette: [string, string];
  abilities: AbilitySpec[];
  items: ItemSpec[];
}

const has = (u: { item: string | null } | null, item: string) => u?.item === item;

const SPECS: MercSpec[] = [
  // ======================================================== PROTECTORS ====
  {
    id: 'brannoc', name: 'Brannoc Emberhelm', title: 'Forgewarden of the Ironvow',
    role: 'PROTECTOR', rarity: 'Rare', faction: 'Ironvow', types: ['Dwarf'],
    attack: 12, health: 84, palette: ['#ff9a4a', '#4a2014'],
    abilities: [
      { id: 'anvil-strike', name: 'Anvil Strike', speed: 5, cooldown: 0, school: 'Fire', target: 'enemy', isAttack: true, icon: 'anvil-impact',
        text: (u) => `**Attack** an enemy. Its next ability is (${up(O.anvilSlow, has(u, 'cindersteel-hammer') ? O.cindersteel : 0)}) Speed slower.` },
      { id: 'forge-ward', name: 'Forge Ward', speed: 2, cooldown: 1, school: 'Holy', target: 'none', icon: 'shield-reflect',
        text: (u) => `Gain **Taunt** this turn and **Divine Shield**. Restore ${up(O.forgeWardHeal, has(u, 'runed-aegis') ? O.forgeHeal : 0)} Health to this Merc.` },
      { id: 'molten-bulwark', name: 'Molten Bulwark', speed: 3, cooldown: 1, school: 'Fire', target: 'none', icon: 'fire-shield',
        text: (u) => `Gain **Taunt** for ${O.bulwarkTaunt} turns. Whenever this Merc is **Attacked** this turn, deal ${up(O.bulwarkThorns, has(u, 'magma-core') ? O.magmaCore : 0)} damage to the attacker.` },
    ],
    items: [
      { id: 'cindersteel-hammer', name: 'Cindersteel Hammer', icon: 'warhammer', modifies: 'anvil-strike', text: `Anvil Strike slows by (${O.cindersteel}) more.` },
      { id: 'runed-aegis', name: 'Runed Aegis', icon: 'magic-shield', modifies: 'forge-ward', text: `Forge Ward restores ${O.forgeHeal} more Health.` },
      { id: 'magma-core', name: 'Magma Core', icon: 'fire-bowl', modifies: 'molten-bulwark', text: `Molten Bulwark deals ${O.magmaCore} more damage.` },
    ],
  },
  {
    id: 'rurik', name: 'Captain Rurik Saltmane', title: 'Master of the Oathbreaker',
    role: 'PROTECTOR', rarity: 'Epic', faction: 'Ironvow', types: ['Human'],
    attack: 13, health: 80, palette: ['#6fb7d8', '#1d2f4a'],
    abilities: [
      { id: 'boarding-hook', name: 'Boarding Hook', speed: 6, cooldown: 0, school: null, target: 'enemy', isAttack: true, icon: 'pirate-hook',
        text: (u) => `${has(u, 'barbed-hook') ? `Gain {+${O.hookAttack}} Attack. ` : ''}**Attack** an enemy. **Combo:** **Attack** it again.` },
      { id: 'hold-fast', name: 'Hold Fast', speed: 2, cooldown: 1, school: null, target: 'none', icon: 'anchor',
        text: (u) => `Gain **Taunt** for ${O.holdTaunt} turns and **Divine Shield**.${has(u, 'iron-buckler') ? ' Give adjacent allies {Divine Shield}.' : ''}` },
      { id: 'rally-the-crew', name: 'Rally the Crew', speed: 3, cooldown: 1, school: null, target: 'none', icon: 'bugle-call',
        text: (u) => `Your other characters' abilities this turn are (${O.crewSpeed}) Speed faster.${has(u, 'oathbound-banner') ? ` Your Ironvow characters also get {+${O.bannerAttack}} Attack this turn.` : ''}` },
    ],
    items: [
      { id: 'barbed-hook', name: 'Barbed Hook', icon: 'hook', modifies: 'boarding-hook', text: `Boarding Hook gives this Merc +${O.hookAttack} Attack first.` },
      { id: 'iron-buckler', name: 'Iron Buckler', icon: 'round-shield', modifies: 'hold-fast', text: 'Hold Fast also gives adjacent allies Divine Shield.' },
      { id: 'oathbound-banner', name: 'Oathbound Banner', icon: 'flying-flag', modifies: 'rally-the-crew', text: `Rally the Crew also gives your Ironvow characters +${O.bannerAttack} Attack this turn.` },
    ],
  },
  {
    id: 'gorsebark', name: 'Mother Gorsebark', title: 'Eldest of the Thornwild',
    role: 'PROTECTOR', rarity: 'Legendary', faction: 'Thornwild', types: ['Treant'],
    attack: 9, health: 92, palette: ['#9ccf62', '#2c3a1a'],
    abilities: [
      { id: 'bramble-lash', name: 'Bramble Lash', speed: 5, cooldown: 0, school: 'Nature', target: 'enemy', icon: 'vine-whip',
        text: (u) => `Deal ${up(O.brambleDamage, has(u, 'strangling-vines') ? O.strangling : 0)} damage to an enemy and **Root** it this turn.` },
      { id: 'deep-roots', name: 'Deep Roots', speed: 1, cooldown: 0, school: 'Nature', target: 'none', icon: 'tree-roots',
        text: (u) => `Gain **Taunt** for ${O.rootsTaunt} turns and restore ${O.rootsHeal} Health to this Merc.${has(u, 'heartwood-sap') ? ` Restore {${O.heartwoodHeal}} Health to your other Thornwild characters.` : ''}` },
      { id: 'entangle', name: 'Entangle', speed: 3, cooldown: 2, school: 'Nature', target: 'none', icon: 'curling-vines',
        text: () => '**Root** all enemies this turn.' },
    ],
    items: [
      { id: 'thorned-bark', name: 'Thorned Bark', icon: 'thorny-vine', thorns: 5, text: '**Passive:** Whenever this Merc is Attacked, deal 5 damage to the attacker.' },
      { id: 'heartwood-sap', name: 'Heartwood Sap', icon: 'heart-bottle', modifies: 'deep-roots', text: `Deep Roots also restores ${O.heartwoodHeal} Health to your other Thornwild characters.` },
      { id: 'strangling-vines', name: 'Strangling Vines', icon: 'vines', modifies: 'bramble-lash', text: `Bramble Lash deals ${O.strangling} more damage.` },
    ],
  },
  {
    id: 'vessa', name: 'Vessa Nightcoil', title: 'Knight of the Hollow Court',
    role: 'PROTECTOR', rarity: 'Rare', faction: 'Hollow Court', types: ['Revenant'],
    attack: 12, health: 70, palette: ['#b48cff', '#1c1330'],
    abilities: [
      { id: 'grave-cleave', name: 'Grave Cleave', speed: 6, cooldown: 0, school: 'Shadow', target: 'enemy', isAttack: true, icon: 'reaper-scythe',
        text: (u) => `${has(u, 'gravebound-axe') ? `Gain {+${O.graveAxe}} Attack this turn. ` : ''}**Attack** an enemy. **Lifesteal**.` },
      { id: 'bone-wall', name: 'Bone Wall', speed: 2, cooldown: 1, school: 'Shadow', target: 'none', icon: 'ribcage',
        text: () => `Gain **Taunt** and **Lifesteal** for ${O.boneTaunt} turns.` },
      { id: 'soul-harvest', name: 'Soul Harvest', speed: 7, cooldown: 1, school: 'Shadow', target: 'none', icon: 'soul-vessel',
        text: (u) => `Deal ${up(O.harvest, has(u, 'reapers-sigil') ? O.reaper : 0)} damage to all enemies. **Lifesteal**.` },
    ],
    items: [
      { id: 'gravebound-axe', name: 'Gravebound Axe', icon: 'bone-mace', modifies: 'grave-cleave', text: `Grave Cleave gives this Merc +${O.graveAxe} Attack this turn first.` },
      { id: 'ossuary-plate', name: 'Ossuary Plate', icon: 'breastplate', reduction: O.ossuary, text: `**Passive:** Take ${O.ossuary} less damage.` },
      { id: 'reapers-sigil', name: "Reaper's Sigil", icon: 'crossed-bones', modifies: 'soul-harvest', text: `Soul Harvest deals ${O.reaper} more damage.` },
    ],
  },

  // ========================================================== FIGHTERS ====
  {
    id: 'nyxa', name: 'Nyxa the Pale', title: 'Knife of the Hollow Court',
    role: 'FIGHTER', rarity: 'Epic', faction: 'Hollow Court', types: ['Shade'],
    attack: 10, health: 66, palette: ['#9fb4c8', '#141820'],
    abilities: [
      { id: 'serrated-strike', name: 'Serrated Strike', speed: 4, cooldown: 0, school: null, target: 'enemy', isAttack: true, icon: 'serrated-slash',
        text: (u) => `**Attack** an enemy and give it **Bleed** ${up(O.serratedBleed, has(u, 'venom-vial') ? O.venom : 0)}.` },
      { id: 'vanish', name: 'Vanish', speed: 1, cooldown: 1, school: 'Shadow', target: 'none', icon: 'invisible',
        text: (u) => `Gain **Stealth** and +${up(O.vanishAttack, has(u, 'ghost-silk') ? O.ghostSilk : 0)} Attack.` },
      { id: 'eviscerate', name: 'Eviscerate', speed: 7, cooldown: 1, school: null, target: 'enemy', icon: 'curvy-knife',
        text: () => "Deal damage equal to this Merc's Attack to an enemy. Double it if the enemy is **Bleeding**." },
    ],
    items: [
      { id: 'venom-vial', name: 'Venom Vial', icon: 'poison-bottle', modifies: 'serrated-strike', text: `Serrated Strike gives ${O.venom} more Bleed.` },
      { id: 'ghost-silk', name: 'Ghost Silk', icon: 'cloak', modifies: 'vanish', text: `Vanish gives ${O.ghostSilk} more Attack.` },
      { id: 'shadowstep-boots', name: 'Shadowstep Boots', icon: 'leather-boot', modifies: 'eviscerate',
        speed: { ability: 'eviscerate', delta: -O.shadowstep }, text: `Eviscerate is (${O.shadowstep}) Speed faster.` },
    ],
  },
  {
    id: 'torvik', name: 'Torvik Stormbrand', title: 'Berserker of the Ironvow',
    role: 'FIGHTER', rarity: 'Rare', faction: 'Ironvow', types: ['Dwarf'],
    attack: 9, health: 74, palette: ['#ffd05a', '#4a2a10'],
    abilities: [
      { id: 'twin-axes', name: 'Twin Axes', speed: 5, cooldown: 0, school: null, target: 'enemy', isAttack: true, windfury: true, icon: 'crossed-axes',
        text: () => '**Windfury.** **Attack** an enemy.' },
      { id: 'thunderclap', name: 'Thunderclap', speed: 3, cooldown: 1, school: 'Nature', target: 'none', icon: 'thunder-struck',
        text: (u) => `Deal ${up(O.thunderclap, has(u, 'storm-rune') ? O.stormRune : 0)} damage to all enemies. Their abilities this turn are (${O.thunderSlow}) Speed slower.` },
      { id: 'berserk', name: 'Berserk', speed: 6, cooldown: 1, school: null, target: 'enemy', isAttack: true, icon: 'enrage',
        text: (u) => `Take ${O.berserkSelf} damage. Gain +${up(O.berserkAttack, has(u, 'bloodrage-torc') ? O.bloodrage : 0)} Attack this turn and **Attack** an enemy.` },
    ],
    items: [
      { id: 'storm-rune', name: 'Storm Rune', icon: 'lightning-helix', modifies: 'thunderclap', text: `Thunderclap deals ${O.stormRune} more damage.` },
      { id: 'bloodrage-torc', name: 'Bloodrage Torc', icon: 'gem-pendant', modifies: 'berserk', text: `Berserk gives ${O.bloodrage} more Attack.` },
      { id: 'ironhide-girdle', name: 'Ironhide Girdle', icon: 'belt', health: O.girdle, text: `**Passive:** +${O.girdle} Health.` },
    ],
  },
  {
    id: 'lyra', name: 'Lyra Thornquill', title: 'Warden of the Deep Green',
    role: 'FIGHTER', rarity: 'Rare', faction: 'Thornwild', types: ['Elf'],
    attack: 7, health: 76, palette: ['#c6e38a', '#23361f'],
    abilities: [
      { id: 'barbed-arrow', name: 'Barbed Arrow', speed: 6, cooldown: 0, school: 'Nature', target: 'enemy', icon: 'barbed-arrow',
        text: (u) => `Deal ${up(O.barbed, has(u, 'hawkeye-lens') ? O.hawkeye : 0)} damage to an enemy and give it **Bleed** ${O.barbedBleed}.` },
      { id: 'pinning-shot', name: 'Pinning Shot', speed: 2, cooldown: 1, school: 'Nature', target: 'enemy', icon: 'pierced-body',
        text: (u) => `Deal ${O.pinning} damage to an enemy and **Root** it this turn.${has(u, 'weighted-shafts') ? ` Its ability this turn is ({${O.weightedSlow}}) Speed slower.` : ''}` },
      { id: 'volley', name: 'Volley', speed: 5, cooldown: 1, school: 'Nature', target: 'none', icon: 'arrow-cluster',
        text: (u) => `Shoot ${has(u, 'quiver-of-thorns') ? '{four}' : 'three'} arrows at random enemies that deal ${O.volley} damage each, or ${O.volley + O.volleyBleeding} to **Bleeding** enemies.` },
    ],
    items: [
      { id: 'hawkeye-lens', name: 'Hawkeye Lens', icon: 'crystal-eye', modifies: 'barbed-arrow', text: `Barbed Arrow deals ${O.hawkeye} more damage.` },
      { id: 'weighted-shafts', name: 'Weighted Shafts', icon: 'arrowhead', modifies: 'pinning-shot', text: `Pinning Shot also makes the target's ability this turn (${O.weightedSlow}) Speed slower.` },
      { id: 'quiver-of-thorns', name: 'Quiver of Thorns', icon: 'quiver', modifies: 'volley', text: 'Volley shoots a fourth arrow.' },
    ],
  },
  {
    id: 'grisk', name: 'Grisk Tallowtooth', title: 'Packmaster of the Fen',
    role: 'FIGHTER', rarity: 'Epic', faction: 'Thornwild', types: ['Goblin'],
    attack: 9, health: 70, palette: ['#e3b25a', '#3d2a14'],
    abilities: [
      { id: 'gore', name: 'Gore', speed: 5, cooldown: 0, school: null, target: 'enemy', isAttack: true, icon: 'fangs',
        text: (u) => `**Attack** an enemy. Give your Beasts +${up(O.goreBeast, has(u, 'tusk-charm') ? O.tuskCharm : 0)}/+${up(O.goreBeast, has(u, 'tusk-charm') ? O.tuskCharm : 0)}.` },
      { id: 'call-wolf', name: 'Call the Pack', speed: 4, cooldown: 2, school: 'Nature', target: 'none', icon: 'direwolf',
        text: (u) => `Summon a ${up(O.wolfAttack, has(u, 'alphas-collar') ? O.collarAttack : 0)}/${up(O.wolfHealth, has(u, 'alphas-collar') ? O.collarHealth : 0)} Wolf. It stays and takes orders.` },
      { id: 'feral-howl', name: 'Feral Howl', speed: 2, cooldown: 1, school: null, target: 'none', icon: 'wolf-howl',
        text: (u) => `Give your characters +${up(O.howl, has(u, 'war-drum') ? O.warDrum : 0)} Attack this turn.` },
    ],
    items: [
      { id: 'alphas-collar', name: "Alpha's Collar", icon: 'wolf-head', modifies: 'call-wolf', text: `Call the Pack's Wolf has +${O.collarAttack}/+${O.collarHealth}.` },
      { id: 'tusk-charm', name: 'Tusk Charm', icon: 'gem-necklace', modifies: 'gore', text: `Gore gives your Beasts +${O.tuskCharm}/+${O.tuskCharm} more.` },
      { id: 'war-drum', name: 'War Drum', icon: 'drum', modifies: 'feral-howl', text: `Feral Howl gives ${O.warDrum} more Attack.` },
    ],
  },

  // =========================================================== CASTERS ====
  {
    id: 'aurelle', name: 'Sister Aurelle', title: 'Lamp of the Ironvow',
    role: 'CASTER', rarity: 'Rare', faction: 'Ironvow', types: ['Human'],
    attack: 5, health: 68, palette: ['#ffe9a8', '#7a4a1e'],
    abilities: [
      { id: 'smite', name: 'Smite', speed: 5, cooldown: 0, school: 'Holy', target: 'enemy', icon: 'sunbeams',
        text: (u) => `Deal ${up(O.smite, has(u, 'censer-of-dawn') ? O.censer : 0)} damage to an enemy.` },
      { id: 'aegis-prayer', name: 'Aegis Prayer', speed: 2, cooldown: 1, school: 'Holy', target: 'friendly', icon: 'prayer',
        text: (u) => `Give a friendly character **Divine Shield** and restore ${up(O.aegisHeal, has(u, 'blessed-beads') ? O.beads : 0)} Health to it.` },
      { id: 'dawnfire', name: 'Dawnfire', speed: 8, cooldown: 1, school: 'Fire', target: 'enemy', icon: 'sun',
        text: (u) => `Deal ${up(O.dawnfire, has(u, 'sunstone-pendant') ? O.sunstone : 0)} damage to an enemy. Restore that much Health to your lowest Health character.` },
    ],
    items: [
      { id: 'censer-of-dawn', name: 'Censer of Dawn', icon: 'lantern-flame', modifies: 'smite', text: `Smite deals ${O.censer} more damage.` },
      { id: 'blessed-beads', name: 'Blessed Beads', icon: 'holy-water', modifies: 'aegis-prayer', text: `Aegis Prayer restores ${O.beads} more Health.` },
      { id: 'sunstone-pendant', name: 'Sunstone Pendant', icon: 'crystal-cluster', modifies: 'dawnfire', text: `Dawnfire deals ${O.sunstone} more damage.` },
    ],
  },
  {
    id: 'oona', name: 'Oona of the Fen', title: 'Tidecaller of the Thornwild',
    role: 'CASTER', rarity: 'Rare', faction: 'Thornwild', types: ['Tortle'],
    attack: 5, health: 72, palette: ['#6fd6c4', '#15343a'],
    abilities: [
      { id: 'lightning-surge', name: 'Lightning Surge', speed: 4, cooldown: 0, school: 'Nature', target: 'enemy', icon: 'chain-lightning',
        text: (u) => `Deal ${O.surge} damage to an enemy and ${up(O.surgeSplash, has(u, 'storm-totem') ? O.stormTotem : 0)} to its neighbors.` },
      { id: 'healing-tide', name: 'Healing Tide', speed: 5, cooldown: 1, school: 'Nature', target: 'none', icon: 'wave-crest',
        text: (u) => `Restore ${up(O.tide, has(u, 'tidestone') ? O.tidestone : 0)} Health to all friendly characters.` },
      { id: 'whirlpool', name: 'Whirlpool', speed: 3, cooldown: 1, school: 'Frost', target: 'enemy', icon: 'vortex',
        text: (u) => `Deal ${up(O.whirlpool, has(u, 'riptide-pearl') ? O.riptide : 0)} damage to an enemy. Its ability this turn is (${O.whirlpoolSlow}) Speed slower.` },
    ],
    items: [
      { id: 'storm-totem', name: 'Storm Totem', icon: 'totem', modifies: 'lightning-surge', text: `Lightning Surge deals ${O.stormTotem} more to neighbors.` },
      { id: 'tidestone', name: 'Tidestone', icon: 'water-drop', modifies: 'healing-tide', text: `Healing Tide restores ${O.tidestone} more Health.` },
      { id: 'riptide-pearl', name: 'Riptide Pearl', icon: 'water-splash', modifies: 'whirlpool', text: `Whirlpool deals ${O.riptide} more damage.` },
    ],
  },
  {
    id: 'mordekai', name: 'Mordekai Hollowspire', title: 'Bone-Reader of the Court',
    role: 'CASTER', rarity: 'Epic', faction: 'Hollow Court', types: ['Revenant'],
    attack: 6, health: 66, palette: ['#9be07a', '#1a2418'],
    abilities: [
      { id: 'shadow-bolt', name: 'Shadow Bolt', speed: 5, cooldown: 0, school: 'Shadow', target: 'enemy', icon: 'shadow-grasp',
        text: (u) => `Deal ${up(O.shadowBolt, has(u, 'soulbound-grimoire') ? O.grimoire : 0)} damage to an enemy.` },
      { id: 'curse-of-frailty', name: 'Curse of Frailty', speed: 3, cooldown: 1, school: 'Shadow', target: 'enemy', icon: 'cursed-star',
        text: (u) => `Give an enemy -${up(O.curseAttack, has(u, 'hex-candle') ? O.hexCandle : 0)} Attack and **Shadow Weakness** ${O.curseWeakness}.` },
      { id: 'raise-dead', name: 'Raise Dead', speed: 6, cooldown: 2, school: 'Shadow', target: 'none', icon: 'raise-skeleton',
        text: (u) => `Summon a ${O.skeletonAttack}/${O.skeletonHealth} Skeleton with **Taunt**.${has(u, 'grave-dust') ? ' Summon {two} if you control another Hollow Court character.' : ''}` },
    ],
    items: [
      { id: 'soulbound-grimoire', name: 'Soulbound Grimoire', icon: 'spell-book', modifies: 'shadow-bolt', text: `Shadow Bolt deals ${O.grimoire} more damage.` },
      { id: 'hex-candle', name: 'Hex Candle', icon: 'candle-holder', modifies: 'curse-of-frailty', text: `Curse of Frailty gives -${O.hexCandle} more Attack.` },
      { id: 'grave-dust', name: 'Grave Dust', icon: 'powder-bag', modifies: 'raise-dead', text: 'Raise Dead summons two Skeletons if you control another Hollow Court character.' },
    ],
  },
  {
    id: 'ilsa', name: 'Ilsa Frostveil', title: 'The Winter Widow',
    role: 'CASTER', rarity: 'Legendary', faction: 'Hollow Court', types: ['Wraith'],
    attack: 5, health: 68, palette: ['#bfe8ff', '#1a2a44'],
    abilities: [
      { id: 'ice-lance', name: 'Ice Lance', speed: 4, cooldown: 0, school: 'Frost', target: 'enemy', icon: 'ice-spear',
        text: (u) => `Deal ${up(O.iceLance, has(u, 'rime-shard') ? O.rime : 0)} damage to an enemy, or ${up(O.iceLanceFrozen, has(u, 'rime-shard') ? O.rime : 0)} if it's **Frozen**.` },
      { id: 'blizzard', name: 'Blizzard', speed: 6, cooldown: 1, school: 'Frost', target: 'none', icon: 'snowflake-2',
        text: (u) => `Deal ${up(O.blizzard, has(u, 'winters-crown') ? O.wintersCrown : 0)} damage to all enemies. **Freeze** a random one that hasn't acted yet.` },
      { id: 'frost-armor', name: 'Frost Armor', speed: 2, cooldown: 1, school: 'Frost', target: 'friendly', icon: 'ice-shield',
        text: (u) => `Give a friendly character **Divine Shield**${has(u, 'glacial-mantle') ? ` and restore {${O.mantleHeal}} Health to it` : ''}. Characters that **Attack** it this turn are **Frozen** until the end of next turn.` },
    ],
    items: [
      { id: 'rime-shard', name: 'Rime Shard', icon: 'ice-bolt', modifies: 'ice-lance', text: `Ice Lance deals ${O.rime} more damage.` },
      { id: 'winters-crown', name: "Winter's Crown", icon: 'crown', modifies: 'blizzard', text: `Blizzard deals ${O.wintersCrown} more damage.` },
      { id: 'glacial-mantle', name: 'Glacial Mantle', icon: 'cape', modifies: 'frost-armor', text: `Frost Armor also restores ${O.mantleHeal} Health.` },
    ],
  },
];

/** Summoned minions. They have no role and carry their own Attack ability. */
const MINION_SPECS: MercSpec[] = [
  {
    id: 'wolf', name: 'Fen Wolf', title: 'Summoned by Call the Pack',
    role: 'FIGHTER', rarity: 'Rare', faction: 'Thornwild', types: ['Beast'],
    attack: O.wolfAttack, health: O.wolfHealth, palette: ['#b9a58a', '#2a2018'],
    abilities: [
      { id: 'bite', name: 'Bite', speed: 3, cooldown: 0, school: null, target: 'enemy', isAttack: true, icon: 'bone-gnawer',
        text: () => '**Attack** an enemy.' },
    ],
    items: [],
  },
  {
    id: 'skeleton', name: 'Risen Skeleton', title: 'Summoned by Raise Dead',
    role: 'PROTECTOR', rarity: 'Rare', faction: 'Hollow Court', types: ['Undead'],
    attack: O.skeletonAttack, health: O.skeletonHealth, palette: ['#e8e2cc', '#2a2632'],
    abilities: [
      { id: 'bone-claw', name: 'Bone Claw', speed: 4, cooldown: 0, school: null, target: 'enemy', isAttack: true, icon: 'skeletal-hand',
        text: () => '**Attack** an enemy.' },
    ],
    items: [],
  },
];

function build(spec: MercSpec, roster: MercDef['roster']): MercDef {
  const abilities: AbilityDef[] = spec.abilities.map(({ text, ...a }) => {
    ORIGINAL_TEXT[a.id] = text;
    return { ...a, isAttack: a.isAttack ?? false };
  });
  return {
    id: spec.id, name: spec.name, title: spec.title, role: spec.role, rarity: spec.rarity,
    faction: spec.faction, types: spec.types, attack: spec.attack, health: spec.health,
    palette: spec.palette, roster,
    abilities,
    items: spec.items.map((i) => ({ ...i, modifies: i.modifies ?? null })),
  };
}

export const ORIGINAL_MERCS: MercDef[] = SPECS.map((s) => build(s, 'originals'));
export const MINIONS: MercDef[] = MINION_SPECS.map((s) => build(s, 'minion'));
