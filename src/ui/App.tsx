import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { MERCS, type PartyPick } from '../engine';
import { Stage } from './Stage';
import { Title } from './screens/Title';
import { Party } from './screens/Party';
import { Battle } from './screens/Battle';

type Screen =
  | { id: 'title' }
  | { id: 'party' }
  | { id: 'battle'; enemy: PartyPick[]; seed: number; key: number };

const DEFAULT_PARTY: PartyPick[] = [
  { defId: 'cariel', item: 'tome-of-light' },
  { defId: 'grommash', item: 'gorehowl' },
  { defId: 'tyrande', item: 'elunes-charm' },
  { defId: 'samuro', item: 'burning-blade' },
  { defId: 'xyrella', item: 'shard-of-the-naaru' },
  { defId: 'millhouse', item: 'ley-line-wand' },
];

function loadParty(): PartyPick[] {
  try {
    const raw = localStorage.getItem('mercs:party');
    if (raw) {
      const p = JSON.parse(raw) as PartyPick[];
      if (Array.isArray(p) && p.every((x) => MERCS.some((m) => m.id === x.defId))) return p;
    }
  } catch { /* storage unavailable */ }
  return DEFAULT_PARTY;
}

/** A random warband of six with random equipment. */
export function randomWarband(seed: number): PartyPick[] {
  let a = seed | 0;
  const r = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pool = [...MERCS].sort(() => r() - 0.5).slice(0, 6);
  return pool.map((m) => ({ defId: m.id, item: m.items[Math.floor(r() * m.items.length)]!.id }));
}

export function App() {
  const [screen, setScreen] = useState<Screen>({ id: 'title' });
  const [party, setPartyState] = useState<PartyPick[]>(loadParty);

  const setParty = (p: PartyPick[]) => {
    setPartyState(p);
    try { localStorage.setItem('mercs:party', JSON.stringify(p)); } catch { /* ignore */ }
  };

  const startBattle = () => {
    const seed = (Math.random() * 2 ** 31) | 0;
    setScreen({ id: 'battle', enemy: randomWarband(seed ^ 0x5bd1e995), seed, key: seed });
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
            <Party party={party} setParty={setParty} onBack={() => setScreen({ id: 'title' })} onFight={startBattle} />
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
