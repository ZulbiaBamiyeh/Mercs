import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { abilityText, ITEM_BY_ID, MERC_BY_ID, ROLE_INFO, ROSTERS, type MercDef, type PartyPick } from '../../engine';
import type { RosterKey } from '../App';
import { AbilityCard } from '../components/AbilityCard';
import { Icon } from '../components/Icon';
import { Medallion } from '../components/Medallion';
import { Portrait, ROLE_CLASS, ROLE_ICON } from '../components/Portrait';
import { RichText } from '../components/RichText';
import { play } from '../sfx';
import { useStage } from '../Stage';

type Hover =
  | { kind: 'ability'; merc: string; ability: string; item: string | null; x: number; y: number; below?: boolean }
  | { kind: 'item'; item: string; x: number; y: number; below?: boolean };

const PARTY_SIZE = 6;

const stats = (m: MercDef, item: string | null) => {
  const hp = m.health + (item === 'ancestral-armor' ? 20 : 0);
  return {
    defId: m.id, name: m.name, role: m.role, palette: m.palette,
    attack: m.attack, baseAttack: m.attack, health: hp, maxHealth: hp, baseMaxHealth: hp,
  };
};

const ROSTER_TABS: { key: RosterKey; label: string; note: string }[] = [
  { key: 'originals', label: 'The Free Companies', note: '12 originals' },
  { key: 'classic', label: 'Classic', note: 'test roster' },
];

export function Party({ roster, setRoster, party, setParty, onBack, onFight }: {
  roster: RosterKey; setRoster: (r: RosterKey) => void;
  party: PartyPick[]; setParty: (p: PartyPick[]) => void; onBack: () => void; onFight: () => void;
}) {
  const MERCS = ROSTERS[roster];
  const stage = useStage();
  const [hover, setHover] = useState<Hover | null>(null);
  const inParty = (id: string) => party.findIndex((p) => p.defId === id);

  const toggle = (m: MercDef) => {
    const i = inParty(m.id);
    if (i >= 0) {
      play('click');
      setParty(party.filter((p) => p.defId !== m.id));
    } else if (party.length < PARTY_SIZE) {
      play('place');
      setParty([...party, { defId: m.id, item: m.items[0]!.id }]);
    }
  };

  const setItem = (defId: string, item: string) => {
    play('select');
    setParty(party.map((p) => (p.defId === defId ? { ...p, item } : p)));
  };

  // Cards float above what they describe, kept on screen. Near the top they drop below instead.
  const anchor = (e: React.SyntheticEvent, extra: Record<string, unknown>) => {
    const c = stage.centerOf(e.currentTarget);
    const x = Math.max(170, Math.min(stage.w - 170, c.x));
    const below = c.y - c.h / 2 < 480;
    return { ...extra, x, y: below ? c.y + c.h / 2 : c.y - c.h / 2, below } as Hover;
  };
  const isMouse = (e: React.PointerEvent) => e.pointerType !== 'touch';

  const full = party.length === PARTY_SIZE;
  const roleCount = (r: MercDef['role']) => party.filter((p) => MERC_BY_ID[p.defId]?.role === r).length;

  return (
    <div className="party-screen" onClick={() => setHover(null)}>
      <div className="party-backdrop" />
      <header className="party-header">
        <button className="btn-ghost" type="button" onClick={() => { play('click'); onBack(); }}>
          <span aria-hidden="true">‹</span> Title
        </button>
        <div>
          <h2 className="screen-title">Assemble your party</h2>
          <p className="screen-sub">Hire six. Three take the table, three wait on the bench to replace the fallen.</p>
        </div>
        <div className="roster-tabs" role="tablist" aria-label="Roster">
          {ROSTER_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={roster === t.key}
              className={`roster-tab ${roster === t.key ? 'is-on' : ''}`}
              onClick={() => { if (roster !== t.key) { play('select'); setRoster(t.key); } }}
            >
              {t.label}<small>{t.note}</small>
            </button>
          ))}
        </div>
      </header>

      <div className={`roster-grid count-${MERCS.length > 8 ? 'wide' : 'narrow'}`} key={roster}>
        {MERCS.map((m, idx) => {
          const pi = inParty(m.id);
          const pick = pi >= 0 ? party[pi]! : null;
          return (
            <motion.button
              type="button"
              key={m.id}
              className={`roster-card ${ROLE_CLASS[m.role]} ${pick ? 'is-picked' : ''} ${!pick && full ? 'is-locked' : ''}`}
              onClick={() => toggle(m)}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * idx, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
              whileHover={{ y: -6 }}
            >
              <span className={`rarity rarity-${m.rarity.toLowerCase()}`}>{m.rarity}</span>
              {pick && <span className="pick-seal">{pi + 1}</span>}
              <Portrait p={stats(m, pick?.item ?? null)} size={MERCS.length > 8 ? 100 : 132} />
              <span className="rc-name">{m.name}</span>
              <span className="rc-meta">
                <Icon name={ROLE_ICON[m.role]} size={15} /> {ROLE_INFO[m.role].label}
              </span>
              <span className="rc-faction">{[m.faction, ...m.types].filter(Boolean).join(' · ')}</span>
              <span className="rc-abilities" onClick={(e) => e.stopPropagation()}>
                {m.abilities.map((a) => (
                  <span
                    key={a.id}
                    className="rc-med-hit"
                    onPointerEnter={(e) => { if (isMouse(e)) setHover(anchor(e, { kind: 'ability', merc: m.id, ability: a.id, item: pick?.item ?? null })); }}
                    onPointerLeave={(e) => { if (isMouse(e)) setHover(null); }}
                    onClick={(e) => {
                      e.stopPropagation();
                      play('hover');
                      setHover(anchor(e, { kind: 'ability', merc: m.id, ability: a.id, item: pick?.item ?? null }));
                    }}
                  >
                    <Medallion ability={a} speed={a.speed} size={MERCS.length > 8 ? 44 : 56} />
                  </span>
                ))}
              </span>
            </motion.button>
          );
        })}
      </div>

      <aside className="party-panel">
        <div className="panel-head">
          <h3>Your party</h3>
          <span className={`count ${full ? 'is-full' : ''}`}>{party.length}/{PARTY_SIZE}</span>
        </div>
        <div className="role-balance">
          {(['PROTECTOR', 'FIGHTER', 'CASTER'] as const).map((r) => (
            <span key={r} className={`balance-chip ${ROLE_CLASS[r]}`}>
              <Icon name={ROLE_ICON[r]} size={16} /> {roleCount(r)}
            </span>
          ))}
        </div>
        <ol className="party-list">
          <AnimatePresence initial={false}>
            {party.map((p, i) => {
              const m = MERC_BY_ID[p.defId]!;
              return (
                <motion.li
                  key={p.defId}
                  layout
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 30, transition: { duration: 0.2 } }}
                  className={`party-row ${ROLE_CLASS[m.role]}`}
                >
                  <span className="pr-slot">{i + 1}</span>
                  <span className="pr-coin" style={{ '--c1': m.palette[0], '--c2': m.palette[1] } as React.CSSProperties}>
                    <Icon name={ROLE_ICON[m.role]} size={22} />
                  </span>
                  <span className="pr-name">
                    {m.name}
                    <small>{p.item ? ITEM_BY_ID[p.item]?.name : 'No equipment'}</small>
                  </span>
                  <span className="pr-items">
                    {m.items.map((it) => (
                      <button
                        type="button"
                        key={it.id}
                        className={`item-btn ${p.item === it.id ? 'is-on' : ''}`}
                        onClick={(e) => { e.stopPropagation(); setItem(m.id, it.id); setHover(anchor(e, { kind: 'item', item: it.id })); }}
                        onPointerEnter={(e) => { if (isMouse(e)) setHover(anchor(e, { kind: 'item', item: it.id })); }}
                        onPointerLeave={(e) => { if (isMouse(e)) setHover(null); }}
                        aria-label={it.name}
                      >
                        <Icon name={it.icon} size={24} pixel={it.pixel} />
                      </button>
                    ))}
                  </span>
                  <button
                    type="button"
                    className="pr-remove"
                    aria-label={`Remove ${m.name}`}
                    onClick={() => { play('click'); setParty(party.filter((x) => x.defId !== p.defId)); }}
                  >
                    ×
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
          {Array.from({ length: PARTY_SIZE - party.length }, (_, i) => (
            <li key={`empty-${i}`} className="party-row is-empty">
              <span className="pr-slot">{party.length + i + 1}</span>
              <span className="pr-empty">Choose a mercenary</span>
            </li>
          ))}
        </ol>
        <p className="panel-note">
          You choose which three start, and where they stand, when the battle begins. Your opponent is a random warband.
        </p>
        <button className="btn-brass btn-lg" type="button" disabled={!full} onClick={() => { play('ready'); onFight(); }}>
          {full ? 'To battle' : `Hire ${PARTY_SIZE - party.length} more`}
        </button>
      </aside>

      <AnimatePresence>
        {hover && (
          <motion.div
            key={hover.kind === 'ability' ? hover.ability : hover.item}
            className={`float-card ${hover.below ? 'is-below' : ''}`}
            style={{ left: hover.x, top: hover.y }}
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.16 }}
          >
            {hover.kind === 'ability' ? (() => {
              const a = MERC_BY_ID[hover.merc]!.abilities.find((x) => x.id === hover.ability)!;
              return (
                <AbilityCard
                  ability={a}
                  text={abilityText(a.id, { item: hover.item })}
                  speed={a.speed}
                  cooldown={a.cooldown}
                />
              );
            })() : (() => {
              const it = ITEM_BY_ID[hover.item]!;
              return (
                <div className="item-card">
                  <div className="item-card-icon"><Icon name={it.icon} size={54} pixel={it.pixel} /></div>
                  <div className="item-card-name">{it.name}</div>
                  <div className="item-card-text"><RichText text={it.text.replace(/^Passive:/, '**Passive:**')} /></div>
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
