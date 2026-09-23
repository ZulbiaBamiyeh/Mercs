import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ROSTERS, type PartyPick } from '../engine';
import { Stage } from './Stage';
import { Title } from './screens/Title';
import { Party } from './screens/Party';
import { Battle } from './screens/Battle';

type Screen =
  | { id: 'title' }
  | { id: 'party' }
  | { id: 'battle'; enemy: PartyPick[]; seed: number; key: number };

export type RosterKey = keyof typeof ROSTERS;

const DEFAULT_PARTY: Record<RosterKey, PartyPick[]> = {
  originals: [
    { defId: 'brannoc', item: 'magma-core' },
    { defId: 'vessa', item: 'gravebound-axe' },
    { defId: 'nyxa', item: 'venom-vial' },
    { defId: 'lyra', item: 'hawkeye-lens' },
    { defId: 'aurelle', item: 'blessed-beads' },
    { defId: 'ilsa', item: 'rime-shard' },
  ],
  classic: [
    { defId: 'cariel', item: 'tome-of-light' },
    { defId: 'grommash', item: 'gorehowl' },
    { defId: 'tyrande', item: 'elunes-charm' },
    { defId: 'samuro', item: 'burning-blade' },
    { defId: 'xyrella', item: 'shard-of-the-naaru' },
    { defId: 'millhouse', item: 'ley-line-wand' },
  ],
};

function load<T>(key: string, fallback: T, valid: (v: unknown) => boolean): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const v = JSON.parse(raw) as unknown;
      if (valid(v)) return v as T;
    }
  } catch { /* storage unavailable */ }
  return fallback;
}

function save(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ }
}

function loadParty(roster: RosterKey): PartyPick[] {
  return load(`mercs:party:${roster}`, DEFAULT_PARTY[roster], (v) =>
    Array.isArray(v) && v.every((x: PartyPick) => ROSTERS[roster].some((m) => m.id === x.defId)));
}

/** A random warband of six with random equipment. */
export function randomWarband(roster: RosterKey, seed: number): PartyPick[] {
  let a = seed | 0;
  const r = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pool = [...ROSTERS[roster]].sort(() => r() - 0.5).slice(0, 6);
  return pool.map((m) => ({ defId: m.id, item: m.items[Math.floor(r() * m.items.length)]!.id }));
}

export function App() {
  const [screen, setScreen] = useState<Screen>({ id: 'title' });
  const [roster, setRosterState] = useState<RosterKey>(() =>
    load<RosterKey>('mercs:roster', 'originals', (v) => v === 'originals' || v === 'classic'));
  const [party, setPartyState] = useState<PartyPick[]>(() => loadParty(roster));

  const setParty = (p: PartyPick[]) => {
    setPartyState(p);
    save(`mercs:party:${roster}`, p);
  };

  const setRoster = (r: RosterKey) => {
    setRosterState(r);
    save('mercs:roster', r);
    setPartyState(loadParty(r));
  };

  const startBattle = () => {
    const seed = (Math.random() * 2 ** 31) | 0;
    setScreen({ id: 'battle', enemy: randomWarband(roster, seed ^ 0x5bd1e995), seed, key: seed });
  };

  return (
    <Stage>
      <AnimatePresence mode="wait">
        <motion.div
          key={screen.id === 'battle' ? `battle-${screen.key}` : screen.id}
          className="screen"
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.99 }}
          transition={{ duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
        >
          {screen.id === 'title' && <Title onStart={() => setScreen({ id: 'party' })} />}
          {screen.id === 'party' && (
            <Party roster={roster} setRoster={setRoster} party={party} setParty={setParty} onBack={() => setScreen({ id: 'title' })} onFight={startBattle} />
          )}
          {screen.id === 'battle' && (
            <Battle
              party={party}
              enemy={screen.enemy}
              seed={screen.seed}
              onRematch={startBattle}
              onLeave={() => setScreen({ id: 'party' })}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </Stage>
  );
}
