import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  abilityDef, abilityText, chooseCommands, choosePlacement, createBattle, currentSpeed, isAlive, ITEM_BY_ID,
  legalTargets, mercDef, placeUnit, previewOrder, resolveTurn, ROLE_INFO, slotsToFill,
  type BattleEvent, type BattleState, type Command, type OrderSlot, type PartyPick, type Side, type Unit,
} from '../../engine';
import { AbilityCard } from '../components/AbilityCard';
import { Icon } from '../components/Icon';
import { Medallion } from '../components/Medallion';
import { Portrait, ROLE_CLASS, ROLE_ICON, type PortraitStats } from '../components/Portrait';
import { RichText } from '../components/RichText';
import { Director, logLine } from '../battle/director';
import { Arrow } from '../battle/Arrow';
import { isMuted, play, setMuted } from '../sfx';
import { useStage } from '../Stage';

type UiPhase = 'placement' | 'command' | 'resolving' | 'over';

interface LogItem { id: number; text: string; side: 'player' | 'enemy' | 'none' | 'turn' }

const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

const toStats = (u: Unit): PortraitStats => ({
  defId: u.defId, name: u.name, role: u.role, palette: mercDef(u.defId).palette,
  attack: u.attack + u.attackThisTurn + (u.item === 'tome-of-light' && u.taunt > 0 ? 12 : 0),
  baseAttack: u.baseAttack, health: u.health, maxHealth: u.maxHealth, baseMaxHealth: u.baseMaxHealth,
});

let logSeq = 0;

export function Battle({ party, enemy, seed, onRematch, onLeave }: {
  party: PartyPick[]; enemy: PartyPick[]; seed: number; onRematch: () => void; onLeave: () => void;
}) {
  const stage = useStage();
  const initial = useMemo(() => {
    const s = createBattle(party, enemy, seed);
    for (const uid of choosePlacement(s, 'enemy')) placeUnit(s, 'enemy', uid);
    return s;
  }, [party, enemy, seed]);

  const [s, setS] = useState<BattleState>(initial);
  const [view, setView] = useState<BattleState>(initial);
  const [phase, setPhase] = useState<UiPhase>('placement');
  const [draft, setDraft] = useState<string[]>([]);
  const [pcmds, setPcmds] = useState<Command[]>([]);
  const [ecmds, setEcmds] = useState<Command[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [hoverUnit, setHoverUnit] = useState<string | null>(null);
  const [hoverAbility, setHoverAbility] = useState<string | null>(null);
  const [acting, setActing] = useState<{ actor: string; ability: string; side: Side; text: string; name: string; echo: boolean } | null>(null);
  const [log, setLog] = useState<LogItem[]>([]);
  // During combat: the order as it stood when Ready was pressed, minus whoever has acted.
  const [queued, setQueued] = useState<{ order: Record<string, OrderSlot>; cmds: Command[] } | null>(null);
  const [banner, setBanner] = useState<string | null>('Place your mercenaries');
  const [pace, setPace] = useState<number>(() => {
    try { return localStorage.getItem('mercs:pace') === 'fast' ? 0.55 : 1; } catch { return 1; }
  });
  const [muted, setMutedState] = useState(isMuted());

  const els = useRef(new Map<string, HTMLElement>());
  const fxRef = useRef<HTMLDivElement>(null);
  const shakeRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const paceRef = useRef(pace);
  paceRef.current = pace;
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  // ---- placement -----------------------------------------------------------
  const needed = slotsToFill(s, 'player');
  const newlyPlaced = draft.filter((id) => !s.sides.player.board.includes(id));
  const hand = s.sides.player.bench.filter((id) => !draft.includes(id));

  useEffect(() => {
    if (phase === 'placement') setDraft([...s.sides.player.board]);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 1600);
    return () => clearTimeout(t);
  }, [banner]);

  const placeFromHand = (uid: string) => {
    if (newlyPlaced.length >= needed) return;
    play('place');
    setDraft((d) => [...d, uid]);
  };
  const unplace = (uid: string) => {
    play('click');
    setDraft((d) => d.filter((x) => x !== uid));
  };
  const shift = (uid: string, dir: -1 | 1) => {
    play('click');
    setDraft((d) => {
      const i = d.indexOf(uid), j = i + dir;
      if (j < 0 || j >= d.length) return d;
      const n = [...d];
      [n[i], n[j]] = [n[j]!, n[i]!];
      return n;
    });
  };

  const beginCommand = useCallback((state: BattleState) => {
    setEcmds(chooseCommands(state, 'enemy'));
    setPcmds([]);
    setArmed(null);
    const first = state.sides.player.board.find((id) => isAlive(state.units[id]));
    setSelected(first ?? null);
    setPhase('command');
    setBanner(`Turn ${state.turn}`);
  }, []);

  const confirmPlacement = () => {
    if (newlyPlaced.length !== needed) return;
    const next = structuredClone(s);
    draft.forEach((uid, i) => {
      if (!next.sides.player.board.includes(uid)) placeUnit(next, 'player', uid, i);
    });
    next.phase = 'command';
    play('ready');
    setS(next);
    setView(next);
    beginCommand(next);
  };

  // ---- commands ------------------------------------------------------------
  const order: Record<string, OrderSlot> = useMemo(
    () => (phase === 'command' ? previewOrder(s, { player: pcmds, enemy: ecmds }) : phase === 'resolving' ? queued?.order ?? {} : {}),
    [phase, s, pcmds, ecmds, queued],
  );
  const cmdOf = (uid: string) =>
    phase === 'resolving'
      ? queued?.cmds.find((c) => c.actor === uid)
      : pcmds.find((c) => c.actor === uid) ?? ecmds.find((c) => c.actor === uid);
  const legal = useMemo(() => (selected && armed ? legalTargets(s, selected, armed) : []), [s, selected, armed]);

  const commit = (actor: string, ability: string, target: string | null) => {
    play('place');
    const next = [...pcmds.filter((c) => c.actor !== actor), { actor, ability, target }];
    setPcmds(next);
    setArmed(null);
    const pending = s.sides.player.board.find((id) => isAlive(s.units[id]) && !next.some((c) => c.actor === id));
    setSelected(pending ?? null);
  };

  const chooseAbility = (id: string) => {
    if (!selected) return;
    const u = s.units[selected]!;
    const st = u.abilities.find((a) => a.id === id)!;
    if (st.cd > 0) { play('click'); return; }
    const def = abilityDef(id);
    if (def.target === 'none') { commit(selected, id, null); return; }
    play('select');
    setArmed(id);
  };

  const onUnitClick = (uid: string) => {
    const u = view.units[uid];
    if (!u) return;
    if (phase === 'placement') {
      if (newlyPlaced.includes(uid)) unplace(uid);
      return;
    }
    if (phase !== 'command') return;
    if (armed && selected) {
      if (legal.includes(uid)) { commit(selected, armed, uid); return; }
      if (u.side === 'player') { setArmed(null); setSelected(uid); play('select'); }
      return;
    }
    if (u.side === 'player' && !u.isMinion) { play('select'); setSelected(uid); }
  };

  // ---- resolution ----------------------------------------------------------
  const director = useMemo(() => new Director({
    unitEl: (uid) => els.current.get(uid) ?? null,
    fxLayer: () => fxRef.current,
    shakeEl: () => shakeRef.current,
    centerOf: (el) => stage.centerOf(el),
    show: (st) => { if (alive.current) setView(st); },
    onAct: (e, st) => {
      const u = st.units[e.actor]!;
      setQueued((q) => {
        if (!q) return q;
        const { [e.actor]: _gone, ...order } = q.order;
        return { order, cmds: q.cmds.filter((c) => c.actor !== e.actor) };
      });
      setActing({ actor: e.actor, ability: e.ability, side: e.side, text: abilityText(e.ability, u, st), name: u.name, echo: e.echo });
    },
    onEvent: (e: BattleEvent, _before, after) => {
      const line = logLine(e, after);
      if (line) setLog((l) => [...l.slice(-80), { id: ++logSeq, ...line }]);
    },
    pace: () => paceRef.current,
    cancelled: () => !alive.current,
  }), [stage]);

  const fight = async () => {
    if (phase !== 'command') return;
    setPhase('resolving');
    setArmed(null);
    setSelected(null);
    setHoverAbility(null);
    setHoverUnit(null);
    play('ready');
    setLog((l) => [...l, { id: ++logSeq, text: `Turn ${s.turn}`, side: 'turn' }]);
    setQueued({ order: previewOrder(s, { player: pcmds, enemy: ecmds }), cmds: [...pcmds, ...ecmds] });
    const res = resolveTurn(s, { player: pcmds, enemy: ecmds });
    await director.play(res.steps, s);
    if (!alive.current) return;
    setActing(null);
    setQueued(null);
    let next = res.state;
    setS(next);
    setView(next);
    if (next.phase === 'over') {
      await new Promise((r) => setTimeout(r, 500));
      play(next.winner === 'player' ? 'victory' : 'defeat');
      setPhase('over');
      return;
    }
    if (slotsToFill(next, 'enemy') > 0) {
      next = structuredClone(next);
      for (const uid of choosePlacement(next, 'enemy')) placeUnit(next, 'enemy', uid);
      setS(next);
      setView(next);
    }
    if (slotsToFill(next, 'player') > 0) {
      setPhase('placement');
      setBanner('Call in reinforcements');
    } else {
      beginCommand(next);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setArmed(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [log]);

  // ---- derived view --------------------------------------------------------
  const playerRow = phase === 'placement' ? draft : view.sides.player.board;
  const enemyRow = view.sides.enemy.board;
  const selUnit = selected ? s.units[selected] : undefined;
  const allCommanded = phase === 'command' && s.sides.player.board.every((id) => !isAlive(s.units[id]) || pcmds.some((c) => c.actor === id));

  const inspectUnit = hoverUnit ? view.units[hoverUnit] : undefined;
  const inspectCmd = inspectUnit && phase === 'command' ? cmdOf(inspectUnit.uid) : undefined;

  let arrow: { from: string; to: { x: number; y: number } | string; tone: 'aim' | 'player' | 'enemy' } | null = null;
  if (phase === 'command' && armed && selected && pointer) {
    arrow = { from: selected, to: hoverUnit && legal.includes(hoverUnit) ? hoverUnit : pointer, tone: 'aim' };
  } else if (phase === 'command' && inspectCmd?.target) {
    arrow = { from: inspectCmd.actor, to: inspectCmd.target, tone: s.units[inspectCmd.actor]!.side === 'player' ? 'player' : 'enemy' };
  }

  let hint = '';
  if (phase === 'placement') {
    const left = needed - newlyPlaced.length;
    hint = left > 0
      ? `Choose ${left} mercenar${left === 1 ? 'y' : 'ies'} from your bench${s.turn > 1 ? ' to replace the fallen' : ''}.`
      : 'Use the arrows to rearrange, then lock in.';
  } else if (phase === 'command') {
    if (armed) hint = `Choose a target for ${abilityDef(armed).name}. Right-click or Esc to cancel.`;
    else if (selUnit) hint = `Choose an ability for ${selUnit.name}.`;
    else if (allCommanded) hint = 'Orders set. The enemy intents are shown on their side. Press Ready!';
    else hint = 'Select one of your mercenaries.';
  }

  const benchOf = (side: Side) => view.sides[side].bench.filter((id) => !(side === 'player' && phase === 'placement' && draft.includes(id)));
  const fallen = (side: Side) => Object.values(view.units).filter((u) => u.side === side && u.dead && !u.isMinion).length;

  const register = (uid: string) => (el: HTMLElement | null) => {
    if (el) els.current.set(uid, el);
    else els.current.delete(uid);
  };

  const renderUnit = (uid: string, side: Side) => {
    const u = view.units[uid];
    if (!u) return null;
    const cmd = phase === 'command' || phase === 'resolving' ? cmdOf(uid) : undefined;
    const ord = order[uid];
    const isNew = phase === 'placement' && newlyPlaced.includes(uid);
    const targetable = phase === 'command' && !!armed && legal.includes(uid);
    const pendingOrder = phase === 'command' && side === 'player' && !cmd && isAlive(u);
    const cls = [
      selected === uid ? 'is-selected' : '',
      targetable ? `is-targetable target-${abilityDef(armed!).target === 'enemy' ? 'foe' : 'friend'}` : '',
      armed && !targetable && phase === 'command' ? 'is-untargetable' : '',
      pendingOrder ? 'is-awaiting' : '',
      u.taunt > 0 ? 'has-taunt' : '',
      u.immune ? 'is-immune' : '',
      u.dead ? 'is-dead-body' : '',
    ].join(' ');
    return (
      <motion.div
        layout="position"
        key={uid}
        className={`unit-slot side-${side}`}
        initial={{ opacity: 0, y: side === 'enemy' ? -40 : 40, scale: 0.7 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.3 } }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      >
        <div
          ref={register(uid)}
          className={`unit-body ${cls}`}
          onClick={() => onUnitClick(uid)}
          onPointerEnter={() => setHoverUnit(uid)}
          onPointerLeave={() => setHoverUnit((h) => (h === uid ? null : h))}
          onContextMenu={(e) => { e.preventDefault(); setArmed(null); }}
        >
          <Portrait p={toStats(u)} size={u.isMinion ? 118 : 150} dead={u.dead} minion={u.isMinion}>
            {u.taunt > 0 && <><div className="taunt-frame" /><Icon name="templar-shield" className="taunt-shield" /></>}
            {u.immune && <div className="immune-aura" />}
            {targetable && <div className="reticle"><Icon name="swords-emblem" /></div>}
          </Portrait>
          <StatusBadges u={u} rally={!!view.sides[u.side].rally} />
          <AnimatePresence>
            {ord && (
              <motion.div
                key={`${ord.ordinal}${ord.uncertain}`}
                className={`order-bubble side-${side} ${ord.uncertain ? 'is-uncertain' : ''}`}
                initial={{ opacity: 0, scale: 0.4, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ type: 'spring', stiffness: 500, damping: 22 }}
              >
                {ordinal(ord.ordinal)}{ord.uncertain ? '?' : ''}
              </motion.div>
            )}
          </AnimatePresence>
          {cmd && (
            <motion.div
              key={cmd.ability}
              className={`intent side-${side}`}
              initial={{ opacity: 0, scale: 0.3, rotate: -40 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 20 }}
            >
              <Medallion ability={abilityDef(cmd.ability)} speed={currentSpeed(s.units[uid] ?? u, cmd.ability)} size={54} />
            </motion.div>
          )}
          {isNew && (
            <div className="place-controls" onClick={(e) => e.stopPropagation()}>
              <button type="button" aria-label="Move left" onClick={() => shift(uid, -1)} disabled={draft.indexOf(uid) === 0}>‹</button>
              <button type="button" aria-label="Return to bench" className="ret" onClick={() => unplace(uid)}>↩</button>
              <button type="button" aria-label="Move right" onClick={() => shift(uid, 1)} disabled={draft.indexOf(uid) === draft.length - 1}>›</button>
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  const traySpeed = (id: string) => (selUnit ? currentSpeed(selUnit, id) : abilityDef(id).speed);

  return (
    <div
      className={`battle phase-${phase}`}
      onPointerMove={(e) => setPointer(stage.toStage(e.clientX, e.clientY))}
      onContextMenu={(e) => { if (armed) { e.preventDefault(); setArmed(null); } }}
    >
      <div className="battle-bg" />
      <div ref={shakeRef} className="battle-shake">
        <div className="table">
          <div className="table-rail rail-left" />
          <div className="table-rail rail-right" />
          <div className="table-surface">
            <div className="table-crest"><Icon name="crossed-swords" /></div>
          </div>
        </div>

        <div className="row row-enemy">
          <AnimatePresence mode="popLayout">{enemyRow.map((id) => renderUnit(id, 'enemy'))}</AnimatePresence>
        </div>

        {/* Ability tray */}
        <div className={`tray ${phase === 'command' && selUnit ? 'is-open' : ''}`}>
          <div className="tray-plank">
            <AnimatePresence mode="wait">
              {phase === 'command' && selUnit ? (
                <motion.div
                  key={selUnit.uid}
                  className="tray-meds"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }}
                  transition={{ duration: 0.22 }}
                >
                  {selUnit.abilities.map((st, i) => {
                    const def = abilityDef(st.id);
                    const committed = pcmds.find((c) => c.actor === selUnit.uid)?.ability === st.id;
                    const state = st.cd > 0 ? 'cooldown' : armed === st.id ? 'armed' : committed ? 'selected' : 'ready';
                    return (
                      <motion.div key={st.id} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: i * 0.05, type: 'spring', stiffness: 400, damping: 20 }}>
                        <Medallion
                          ability={def}
                          speed={traySpeed(st.id)}
                          cooldown={st.cd}
                          size={112}
                          state={state}
                          onClick={() => chooseAbility(st.id)}
                          onEnter={() => { setHoverAbility(st.id); play('hover'); }}
                          onLeave={() => setHoverAbility((h) => (h === st.id ? null : h))}
                        />
                      </motion.div>
                    );
                  })}
                </motion.div>
              ) : (
                <motion.div key={phase} className="tray-caption" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {phase === 'placement' ? 'Deploy' : phase === 'resolving' ? 'Combat' : phase === 'command' ? 'Orders' : ''}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {selUnit && phase === 'command' && <div className="tray-name">{selUnit.name}</div>}
        </div>

        <div className="row row-player">
          <AnimatePresence mode="popLayout">
            {playerRow.map((id) => renderUnit(id, 'player'))}
            {phase === 'placement' &&
              Array.from({ length: needed - newlyPlaced.length }, (_, i) => (
                <motion.div key={`pad-${i}`} className="unit-slot" layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="pad"><span>{newlyPlaced.length + i + 1}</span></div>
                </motion.div>
              ))}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {hint && (
            <motion.div key={hint} className="hint" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              {hint}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bench hand during placement */}
        <AnimatePresence>
          {phase === 'placement' && (
            <motion.div className="hand" initial={{ y: 160, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 160, opacity: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 26 }}>
              <AnimatePresence mode="popLayout">
                {hand.map((id) => {
                  const u = s.units[id]!;
                  const full = newlyPlaced.length >= needed;
                  return (
                    <motion.button
                      layout
                      key={id}
                      type="button"
                      className={`hand-card ${full ? 'is-full' : ''}`}
                      onClick={() => placeFromHand(id)}
                      onPointerEnter={() => setHoverUnit(id)}
                      onPointerLeave={() => setHoverUnit((h) => (h === id ? null : h))}
                      initial={{ opacity: 0, y: 40 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -60, scale: 0.8 }}
                      whileHover={full ? {} : { y: -14 }}
                    >
                      <Portrait p={toStats(u)} size={100} />
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        <Arrow arrow={arrow} els={els.current} />
        <div ref={fxRef} className="fx-layer" />
      </div>

      {/* Left rail: turn, inspector, log */}
      <div className="rail-l">
        <button className="btn-ghost small" type="button" onClick={() => { play('click'); onLeave(); }}>
          <span aria-hidden="true">‹</span> Retreat
        </button>
        <div className="turn-coin">
          <span className="tc-label">Turn</span>
          <span className="tc-num">{view.turn}</span>
        </div>
      </div>

      <div className="inspect">
        <AnimatePresence mode="wait">
          {acting ? (
            <motion.div
              key={`act-${acting.actor}-${acting.ability}-${acting.echo}`}
              initial={{ opacity: 0, x: -60, rotate: -4 }}
              animate={{ opacity: 1, x: 0, rotate: 0 }}
              exit={{ opacity: 0, x: -30, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            >
              <AbilityCard
                ability={abilityDef(acting.ability)}
                text={acting.text}
                speed={currentSpeed(view.units[acting.actor] ?? s.units[acting.actor]!, acting.ability)}
                cooldown={abilityDef(acting.ability).cooldown}
                tone={acting.side}
                caption={<><span className="cap-side">{acting.side === 'player' ? 'Your' : 'Enemy'}</span> {acting.name}{acting.echo ? ' · casts again' : ''}</>}
                showKeywords={false}
              />
            </motion.div>
          ) : hoverAbility && selUnit ? (
            <motion.div key={`hov-${hoverAbility}`} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={{ duration: 0.15 }}>
              <AbilityCard
                ability={abilityDef(hoverAbility)}
                text={abilityText(hoverAbility, selUnit, s)}
                speed={currentSpeed(selUnit, hoverAbility)}
                cooldown={abilityDef(hoverAbility).cooldown}
                waiting={selUnit.abilities.find((a) => a.id === hoverAbility)?.cd ?? 0}
                tone="player"
              />
            </motion.div>
          ) : inspectUnit && phase !== 'resolving' ? (
            <motion.div key={`unit-${inspectUnit.uid}`} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={{ duration: 0.15 }}>
              <UnitInspector u={inspectUnit} cmd={inspectCmd} s={s} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="log" ref={logRef} aria-live="polite">
        {log.length === 0 && <div className="log-empty">The combat log fills in as abilities resolve.</div>}
        {log.map((l) => (
          <div key={l.id} className={`log-line side-${l.side}`}>{l.text}</div>
        ))}
      </div>

      {/* Right rail: bench, ready */}
      <div className="rail-r">
        <BenchTray label="Enemy bench" side="enemy" ids={benchOf('enemy')} fallen={fallen('enemy')} view={view} />
        <div className="ready-wrap">
          {phase === 'placement' ? (
            <button type="button" className={`ready-btn ${newlyPlaced.length === needed ? 'is-hot' : ''}`} disabled={newlyPlaced.length !== needed} onClick={confirmPlacement}>
              Lock in
            </button>
          ) : (
            <button type="button" className={`ready-btn ${allCommanded ? 'is-hot' : ''}`} disabled={phase !== 'command'} onClick={fight}>
              {phase === 'resolving' ? 'Fighting' : 'Ready!'}
            </button>
          )}
          {phase === 'command' && !allCommanded && <div className="ready-note">Mercs without orders will wait this turn</div>}
        </div>
        <BenchTray label="Your bench" side="player" ids={benchOf('player')} fallen={fallen('player')} view={view} />
        <div className="toggles">
          <button
            type="button"
            className={`toggle ${pace < 1 ? 'is-on' : ''}`}
            onClick={() => {
              const p = pace < 1 ? 1 : 0.55;
              setPace(p);
              try { localStorage.setItem('mercs:pace', p < 1 ? 'fast' : 'normal'); } catch { /* ignore */ }
              play('click');
            }}
            title="Combat speed"
          >
            <Icon name="speedometer" size={20} /> {pace < 1 ? 'Fast' : 'Normal'}
          </button>
          <button
            type="button"
            className={`toggle ${!muted ? 'is-on' : ''}`}
            onClick={() => { setMuted(!muted); setMutedState(!muted); if (muted) play('click'); }}
            title={muted ? 'Sound off' : 'Sound on'}
            aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
          >
            <Icon name={muted ? 'sound-off' : 'sound-on'} size={20} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {banner && phase !== 'over' && (
          <motion.div
            key={banner}
            className="turn-banner"
            initial={{ opacity: 0, scaleX: 0.3 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0, scaleY: 0.4, transition: { duration: 0.25 } }}
            transition={{ duration: 0.35, ease: [0.2, 0.9, 0.2, 1] }}
          >
            <span>{banner}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase === 'over' && (
          <motion.div className="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
            <motion.div
              className={`result-card is-${view.winner}`}
              initial={{ scale: 0.6, y: 40, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 160, damping: 16 }}
            >
              <Icon name={view.winner === 'player' ? 'laurel-crown' : view.winner === 'enemy' ? 'crowned-skull' : 'broken-shield'} size={110} className="result-icon" />
              <h2>{view.winner === 'player' ? 'Victory' : view.winner === 'enemy' ? 'Defeat' : 'Stalemate'}</h2>
              <p>
                {view.winner === 'player'
                  ? `The enemy warband is broken after ${view.turn} turn${view.turn > 1 ? 's' : ''}.`
                  : view.winner === 'enemy'
                    ? `Your party fell on turn ${view.turn}. Try a faster opener, or bring a Protector for their Fighters.`
                    : 'The last blades fell together. Nobody gets paid.'}
              </p>
              <div className="result-actions">
                <button className="btn-brass btn-lg" type="button" onClick={() => { play('click'); onRematch(); }}>Fight another warband</button>
                <button className="btn-ghost" type="button" onClick={() => { play('click'); onLeave(); }}>Change party</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatusBadges({ u, rally }: { u: Unit; rally: boolean }) {
  const badges: { icon: string; label: string; value?: string | number; tone: string }[] = [];
  if (u.taunt > 0) badges.push({ icon: 'templar-shield', label: `Taunt (${u.taunt} turn${u.taunt > 1 ? 's' : ''})`, value: u.taunt, tone: 'neutral' });
  if (u.immune) badges.push({ icon: 'eye-shield', label: 'Immune this turn', tone: 'good' });
  if (u.guardedBy) badges.push({ icon: 'heart-shield', label: 'Guarded by Blessing of Sacrifice', tone: 'good' });
  if (u.pendingSlow > 0) badges.push({ icon: 'snail', label: `Next ability ${u.pendingSlow} slower`, value: `+${u.pendingSlow}`, tone: 'bad' });
  if (u.graceCharges > 0) badges.push({ icon: 'moon', label: "Elune's Grace: next Arcane ability casts twice", tone: 'good' });
  if (u.arcaneDamage > 0) badges.push({ icon: 'star-swirl', label: `+${u.arcaneDamage} Arcane Damage`, value: `+${u.arcaneDamage}`, tone: 'good' });
  if (u.attackThisTurn < 0) badges.push({ icon: 'broken-shield', label: `${u.attackThisTurn} Attack this turn`, value: u.attackThisTurn, tone: 'bad' });
  if (rally && !u.dead) badges.push({ icon: 'rally-the-troops', label: 'Offensive Rally', tone: 'good' });
  if (!badges.length) return null;
  return (
    <div className="badges">
      {badges.map((b) => (
        <span key={b.icon} className={`badge tone-${b.tone}`} title={b.label}>
          <Icon name={b.icon} size={18} />
          {b.value !== undefined && <em>{b.value}</em>}
        </span>
      ))}
    </div>
  );
}

function BenchTray({ label, side, ids, fallen, view }: { label: string; side: Side; ids: string[]; fallen: number; view: BattleState }) {
  return (
    <div className={`bench side-${side}`}>
      <div className="bench-label">{label}</div>
      <div className="bench-coins">
        {ids.map((id) => {
          const u = view.units[id]!;
          const def = mercDef(u.defId);
          return (
            <span key={id} className={`coin ${ROLE_CLASS[def.role]}`} title={`${u.name} (${ROLE_INFO[def.role].label})`}
              style={{ '--c1': def.palette[0], '--c2': def.palette[1] } as React.CSSProperties}>
              <Icon name={ROLE_ICON[def.role]} size={18} />
            </span>
          );
        })}
        {Array.from({ length: fallen }, (_, i) => (
          <span key={`d${i}`} className="coin is-fallen" title="Fallen">
            <Icon name="skull-crack" size={18} />
          </span>
        ))}
        {ids.length === 0 && fallen === 0 && <span className="bench-empty">Empty</span>}
      </div>
    </div>
  );
}

function UnitInspector({ u, cmd, s }: { u: Unit; cmd?: Command; s: BattleState }) {
  const item = u.item ? ITEM_BY_ID[u.item] : null;
  const role = u.role ? ROLE_INFO[u.role] : null;
  const target = cmd?.target ? s.units[cmd.target] : null;
  return (
    <div className={`inspector ${u.role ? ROLE_CLASS[u.role] : 'role-none'} side-${u.side}`}>
      <div className="insp-head">
        <div className="insp-name">{u.name}</div>
        <div className="insp-meta">
          {role ? <><Icon name={ROLE_ICON[u.role!]} size={15} /> {role.label} · beats {ROLE_INFO[role.beats].label}s</> : 'Summoned minion'}
        </div>
        <div className="insp-meta dim">{[u.faction, ...u.types].filter(Boolean).join(' · ')}{u.isMinion ? ' · dies at end of turn' : ''}</div>
      </div>
      {item && (
        <div className="insp-item">
          <span className="insp-item-icon"><Icon name={item.icon} size={30} /></span>
          <span>
            <b>{item.name}</b>
            <RichText text={item.text.replace(/^Passive:/, '**Passive:**')} />
          </span>
        </div>
      )}
      {cmd && (
        <div className="insp-intent">
          <div className="insp-label">{u.side === 'enemy' ? 'Intends to use' : 'Ordered to use'}</div>
          <div className="insp-intent-row">
            <Medallion ability={abilityDef(cmd.ability)} speed={currentSpeed(u, cmd.ability)} size={64} />
            <div>
              <b>{abilityDef(cmd.ability).name}</b>
              {target && <div className="dim">on {target.name}</div>}
              <div className="insp-text"><RichText text={abilityText(cmd.ability, u, s)} /></div>
            </div>
          </div>
        </div>
      )}
      {!cmd && !u.isMinion && (
        <div className="insp-abilities">
          {u.abilities.map((a) => (
            <div key={a.id} className="insp-ab">
              <Medallion ability={abilityDef(a.id)} speed={currentSpeed(u, a.id)} cooldown={a.cd} size={46} />
              <span>{abilityDef(a.id).name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
