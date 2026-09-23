// Plays resolution steps as animation. The board is React; everything
// transient (lunges, projectiles, numbers, bursts) is imperative DOM and Web
// Animations on top of it, so a re-render mid-beat never tears anything out.

import { abilityDef, type BattleEvent, type BattleState, type Step } from '../../engine';
import { play } from '../sfx';

export interface DirectorApi {
  /** The animated body of a unit, by uid. */
  unitEl: (uid: string) => HTMLElement | null;
  fxLayer: () => HTMLElement | null;
  shakeEl: () => HTMLElement | null;
  centerOf: (el: Element) => { x: number; y: number; w: number; h: number };
  show: (s: BattleState) => void;
  onAct: (e: Extract<BattleEvent, { t: 'act' }>, s: BattleState) => void;
  onEvent: (e: BattleEvent, before: BattleState, after: BattleState) => void;
  pace: () => number;
  cancelled: () => boolean;
}

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const SCHOOL_COLOR: Record<string, [string, string]> = {
  Arcane: ['#ffb8ff', '#b04dff'],
  Holy: ['#fff6c2', '#ffbf2e'],
  Frost: ['#e6fbff', '#48b9ff'],
  Shadow: ['#d6b3ff', '#5e2c9c'],
  none: ['#ffe1b0', '#ff7a2e'],
};

const STAR = (() => {
  const pts: string[] = [];
  for (let i = 0; i < 24; i++) {
    const r = i % 2 === 0 ? 50 : 34 + ((i * 7) % 5);
    const a = (Math.PI * 2 * i) / 24 - Math.PI / 2;
    pts.push(`${50 + Math.cos(a) * r},${50 + Math.sin(a) * r}`);
  }
  return pts.join(' ');
})();

export class Director {
  constructor(private api: DirectorApi) {}

  private wait(ms: number) {
    const p = this.api.pace();
    return new Promise<void>((r) => setTimeout(r, ms * p));
  }

  private center(uid: string) {
    const el = this.api.unitEl(uid);
    return el ? this.api.centerOf(el) : null;
  }

  private spawn(cls: string, x: number, y: number, html = ''): HTMLElement | null {
    const layer = this.api.fxLayer();
    if (!layer) return null;
    const d = document.createElement('div');
    d.className = `fx ${cls}`;
    d.style.left = `${x}px`;
    d.style.top = `${y}px`;
    d.innerHTML = html;
    layer.appendChild(d);
    return d;
  }

  private popText(uid: string, text: string, cls: string, life = 1400) {
    const c = this.center(uid);
    if (!c) return;
    const y = cls === 'is-heal' ? c.y - c.h * 0.05 : c.y - c.h * 0.42;
    const d = this.spawn(`fx-chip ${cls}`, c.x, y, `<span>${text}</span>`);
    if (d) setTimeout(() => d.remove(), life * Math.max(0.6, this.api.pace()));
  }

  private burst(uid: string, amount: number, crit: boolean) {
    const c = this.center(uid);
    if (!c) return;
    const d = this.spawn(
      `fx-burst ${crit ? 'is-crit' : ''} ${amount === 0 ? 'is-zero' : ''}`,
      c.x,
      c.y - c.h * 0.08,
      `<svg viewBox="0 0 100 100"><polygon points="${STAR}"/></svg><span class="n">${amount === 0 ? '0' : `-${amount}`}</span>${crit ? '<span class="crit">Critical</span>' : ''}`,
    );
    if (d) setTimeout(() => d.remove(), 1300 * Math.max(0.6, this.api.pace()));
  }

  private flash(uid: string, cls: string) {
    const el = this.api.unitEl(uid);
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 700);
  }

  private shake(uid: string, strength = 8) {
    const el = this.api.unitEl(uid);
    if (!el || reduced()) return;
    el.animate(
      [
        { transform: 'translate(0,0)' },
        { transform: `translate(${-strength}px, ${strength * 0.3}px) rotate(-2deg)` },
        { transform: `translate(${strength}px, ${-strength * 0.2}px) rotate(1.5deg)` },
        { transform: `translate(${-strength * 0.5}px, 0) rotate(-0.5deg)` },
        { transform: 'translate(0,0)' },
      ],
      { duration: 360, easing: 'ease-out' },
    );
  }

  private screenShake(power = 10) {
    const el = this.api.shakeEl();
    if (!el || reduced()) return;
    el.animate(
      [
        { transform: 'translate(0,0)' },
        { transform: `translate(${power}px, ${-power * 0.6}px)` },
        { transform: `translate(${-power * 0.8}px, ${power * 0.5}px)` },
        { transform: `translate(${power * 0.4}px, ${power * 0.3}px)` },
        { transform: 'translate(0,0)' },
      ],
      { duration: 420, easing: 'ease-out' },
    );
  }

  private async lunge(attacker: string, target: string) {
    const el = this.api.unitEl(attacker);
    const a = this.center(attacker);
    const b = this.center(target);
    if (!el || !a || !b) return;
    const dx = (b.x - a.x) * 0.62;
    const dy = (b.y - a.y) * 0.62;
    const p = this.api.pace();
    play('whoosh');
    el.style.zIndex = '30';
    const anim = el.animate(
      [
        { transform: 'translate(0,0) scale(1)', offset: 0 },
        { transform: `translate(${-dx * 0.08}px, ${-dy * 0.08}px) scale(1.04)`, offset: 0.25 },
        { transform: `translate(${dx}px, ${dy}px) scale(1.1)`, offset: 0.55 },
        { transform: `translate(${dx * 0.92}px, ${dy * 0.92}px) scale(1.08)`, offset: 0.68 },
        { transform: 'translate(0,0) scale(1)', offset: 1 },
      ],
      { duration: 820 * p, easing: 'cubic-bezier(.3,.1,.3,1)' },
    );
    anim.onfinish = () => { el.style.zIndex = ''; };
    await this.wait(450); // the moment of impact
  }

  private async projectile(from: string, to: string, school: string | null) {
    const a = this.center(from);
    const b = this.center(to);
    if (!a || !b) return;
    const [c1, c2] = SCHOOL_COLOR[school ?? 'none'] ?? SCHOOL_COLOR.none!;
    play(school ? 'spell' : 'whoosh');
    const d = this.spawn('fx-orb', a.x, a.y);
    if (!d) return;
    d.style.setProperty('--c1', c1);
    d.style.setProperty('--c2', c2);
    const lift = -120 - Math.abs(b.x - a.x) * 0.12;
    const dur = 420 * this.api.pace();
    const anim = d.animate(
      [
        { transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 },
        { transform: `translate(calc(-50% + ${(b.x - a.x) * 0.5}px), calc(-50% + ${(b.y - a.y) * 0.5 + lift}px)) scale(1)`, opacity: 1, offset: 0.5 },
        { transform: `translate(calc(-50% + ${b.x - a.x}px), calc(-50% + ${b.y - a.y}px)) scale(1.3)`, opacity: 1 },
      ],
      { duration: dur, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' },
    );
    await anim.finished.catch(() => {});
    d.remove();
    const imp = this.spawn('fx-impact', b.x, b.y);
    if (imp) {
      imp.style.setProperty('--c1', c1);
      imp.style.setProperty('--c2', c2);
      setTimeout(() => imp.remove(), 700);
    }
  }

  private async nova(from: string, side: string, school: string | null) {
    const a = this.center(from);
    const [c1, c2] = SCHOOL_COLOR[school ?? 'none'] ?? SCHOOL_COLOR.none!;
    play('spell');
    if (a) {
      const ring = this.spawn('fx-nova', a.x, a.y);
      ring?.style.setProperty('--c1', c1);
      ring?.style.setProperty('--c2', c2);
      setTimeout(() => ring?.remove(), 1000);
    }
    const layer = this.api.fxLayer();
    const row = layer?.parentElement?.querySelector(`.row-${side}`);
    if (row) {
      const c = this.api.centerOf(row);
      const sweep = this.spawn('fx-sweep', c.x, c.y);
      sweep?.style.setProperty('--c1', c1);
      sweep?.style.setProperty('--c2', c2);
      setTimeout(() => sweep?.remove(), 900);
    }
    this.screenShake(6);
    await this.wait(420);
  }

  async play(steps: Step[], start: BattleState) {
    let before = start;
    for (let i = 0; i < steps.length; i++) {
      if (this.api.cancelled()) return;
      const { event: e, state } = steps[i]!;
      const next = steps[i + 1]?.event;
      await this.beat(e, before, state, next);
      this.api.onEvent(e, before, state);
      before = state;
    }
  }

  private async beat(e: BattleEvent, before: BattleState, after: BattleState, next: BattleEvent | undefined) {
    const show = () => this.api.show(after);
    switch (e.t) {
      case 'act': {
        show();
        this.api.onAct(e, after);
        const el = this.api.unitEl(e.actor);
        el?.classList.add('is-acting');
        play('select');
        await this.wait(e.echo ? 520 : 900);
        return;
      }
      case 'attack':
        await this.lunge(e.attacker, e.target);
        show();
        return;
      case 'projectile':
        await this.projectile(e.from, e.to, e.school);
        show();
        return;
      case 'nova':
        await this.nova(e.from, e.side, e.school);
        show();
        return;
      case 'damage': {
        show();
        this.burst(e.target, e.amount, e.crit);
        this.flash(e.target, 'is-hit');
        this.shake(e.target, e.crit ? 14 : 8);
        if (e.crit) { play('crit'); this.screenShake(12); } else play('hit');
        // Attack damage and its counter land together.
        const simultaneous = next?.t === 'damage' && next.kind === 'counter';
        await this.wait(simultaneous ? 90 : e.kind === 'spell' && next?.t === 'damage' ? 160 : 560);
        return;
      }
      case 'heal':
        show();
        if (e.amount <= 0) return;
        this.popText(e.target, `+${e.amount}`, 'is-heal');
        this.flash(e.target, 'is-healed');
        play('heal');
        await this.wait(next?.t === 'heal' ? 200 : 560);
        return;
      case 'buff': {
        show();
        const parts = [e.attack ? `+${e.attack} Attack` : '', e.health ? `+${e.health} Health` : ''].filter(Boolean);
        this.popText(e.target, parts.join(' · '), 'is-buff');
        this.flash(e.target, 'is-buffed');
        play('buff');
        await this.wait(next?.t === 'buff' ? 220 : 520);
        return;
      }
      case 'status':
        show();
        this.popText(e.target, e.text, `is-${e.tone}`);
        if (['Immune', 'Taunt', 'Divine Shield', 'Shield breaks', 'Frost Armor'].includes(e.text)) play('shield');
        if (e.text === 'Shield breaks') this.flash(e.target, 'is-shield-break');
        if (e.text === 'Frozen') play('shield');
        await this.wait(next?.t === 'status' ? 160 : 520);
        return;
      case 'redirect':
        this.popText(e.to, e.reason === 'Taunt' ? 'Taunt!' : e.reason === 'Sacrifice' ? 'Intercepted' : 'New target', 'is-neutral');
        play('shield');
        await this.wait(420);
        return;
      case 'death': {
        show();
        const el = this.api.unitEl(e.unit);
        el?.classList.add('is-dying');
        play('death');
        this.screenShake(8);
        await this.wait(800);
        return;
      }
      case 'summon':
        show();
        play('summon');
        await this.wait(520);
        return;
      case 'vanish': {
        const el = this.api.unitEl(e.unit);
        el?.classList.add('is-vanishing');
        await this.wait(420);
        show();
        return;
      }
      case 'fizzle':
        this.popText(e.actor, 'No target', 'is-neutral');
        await this.wait(500);
        return;
      case 'endTurn':
        document.querySelectorAll('.is-acting').forEach((n) => n.classList.remove('is-acting'));
        await this.wait(250);
        show();
        await this.wait(350);
        return;
    }
  }
}

/** One line of the combat log for an event, or null to skip it. */
export function logLine(e: BattleEvent, s: BattleState): { text: string; side: 'player' | 'enemy' | 'none' } | null {
  const name = (uid: string) => s.units[uid]?.name ?? 'Mirror Image';
  const side = (uid: string) => s.units[uid]?.side ?? 'none';
  switch (e.t) {
    case 'act':
      return e.echo ? { text: `${abilityDef(e.ability).name} casts again`, side: e.side }
        : { text: `${name(e.actor)}: ${abilityDef(e.ability).name}`, side: e.side };
    case 'damage':
      return { text: `${name(e.target)} takes ${e.amount}${e.crit ? ' (critical)' : ''}`, side: side(e.target) };
    case 'heal':
      return e.amount > 0 ? { text: `${name(e.target)} restores ${e.amount}`, side: side(e.target) } : null;
    case 'death':
      return { text: `${name(e.unit)} falls`, side: side(e.unit) };
    case 'redirect':
      return e.reason === 'Retarget' ? null : { text: `${name(e.to)} intercepts (${e.reason})`, side: side(e.to) };
    case 'summon':
      return { text: 'A Mirror Image appears', side: side(e.unit) };
    default:
      return null;
  }
}
