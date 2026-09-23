import { useId } from 'react';
import type { Role } from '../../engine';
import { portrait } from '../art';
import { Icon } from './Icon';

export const ROLE_CLASS: Record<Role, string> = {
  PROTECTOR: 'role-protector',
  FIGHTER: 'role-fighter',
  CASTER: 'role-caster',
};

export const ROLE_ICON: Record<Role, string> = {
  PROTECTOR: 'shield',
  FIGHTER: 'broadsword',
  CASTER: 'crystal-ball',
};

export interface PortraitStats {
  defId: string;
  name: string;
  role: Role | null;
  palette: [string, string];
  attack: number;
  baseAttack: number;
  health: number;
  maxHealth: number;
  baseMaxHealth: number;
}

const initials = (name: string) =>
  name.split(' ').filter((w) => /^[A-Z]/.test(w)).slice(0, 2).map((w) => w[0]).join('');

/** The attack gem. Its shape tells the role, as in the source game. */
function AttackGem({ role, value, tone }: { role: Role | null; value: number; tone: string }) {
  const id = useId();
  return (
    <div className={`gem gem-atk ${tone}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--gem-hi)" />
            <stop offset="1" stopColor="var(--gem-lo)" />
          </linearGradient>
          <linearGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff3c4" />
            <stop offset=".45" stopColor="#c89236" />
            <stop offset="1" stopColor="#5d3a12" />
          </linearGradient>
        </defs>
        {role === 'PROTECTOR' ? (
          <path d="M50 5 L90 17 V47 C90 73 71 88 50 96 C29 88 10 73 10 47 V17 Z" fill={`url(#${id}g)`} stroke={`url(#${id}r)`} strokeWidth="6" />
        ) : role === 'FIGHTER' ? (
          <>
            <path d="M18 88 L70 18 L84 8 L80 26 L28 94 Z" fill="#d9dde3" stroke="#3b3f47" strokeWidth="3" />
            <circle cx="48" cy="54" r="34" fill={`url(#${id}g)`} stroke={`url(#${id}r)`} strokeWidth="6" />
          </>
        ) : role === 'CASTER' ? (
          <>
            <circle cx="50" cy="52" r="40" fill={`url(#${id}g)`} stroke={`url(#${id}r)`} strokeWidth="6" />
            <circle cx="37" cy="36" r="10" fill="#fff" opacity=".35" />
          </>
        ) : (
          <circle cx="50" cy="52" r="38" fill="#4a4550" stroke={`url(#${id}r)`} strokeWidth="6" />
        )}
      </svg>
      <span className="num">{value}</span>
    </div>
  );
}

function HealthGem({ value, tone }: { value: number; tone: string }) {
  const id = useId();
  return (
    <div className={`gem gem-hp ${tone}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <radialGradient id={`${id}g`} cx=".38" cy=".55" r=".7">
            <stop offset="0" stopColor="var(--gem-hi)" />
            <stop offset="1" stopColor="var(--gem-lo)" />
          </radialGradient>
          <linearGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff3c4" />
            <stop offset=".45" stopColor="#c89236" />
            <stop offset="1" stopColor="#5d3a12" />
          </linearGradient>
        </defs>
        <path d="M50 4 C58 20 88 46 88 66 A38 34 0 0 1 12 66 C12 46 42 20 50 4 Z" fill={`url(#${id}g)`} stroke={`url(#${id}r)`} strokeWidth="6" />
        <path d="M34 58 C34 48 42 40 46 34" stroke="#fff" strokeOpacity=".4" strokeWidth="6" fill="none" strokeLinecap="round" />
      </svg>
      <span className="num">{value}</span>
    </div>
  );
}

export function Portrait({ p, size = 150, children, className = '', dead, minion }: {
  p: PortraitStats; size?: number; children?: React.ReactNode; className?: string; dead?: boolean; minion?: boolean;
}) {
  const art = portrait(p.defId);
  const atkTone = p.attack > p.baseAttack ? 'up' : p.attack < p.baseAttack ? 'down' : '';
  const hpTone = p.health < p.maxHealth ? 'down' : p.maxHealth > p.baseMaxHealth ? 'up' : '';
  const roleCls = p.role ? ROLE_CLASS[p.role] : 'role-none';
  return (
    <div
      className={`portrait ${roleCls} ${dead ? 'is-dead' : ''} ${minion ? 'is-minion' : ''} ${className}`}
      style={{ '--w': `${size}px`, '--c1': p.palette[0], '--c2': p.palette[1] } as React.CSSProperties}
    >
      <div className="portrait-frame">
        <div className="portrait-art">
          {art ? (
            <img src={art.url} alt="" draggable={false} className={art.pixel ? 'is-pixel' : undefined} />
          ) : (
            <div className="portrait-placeholder">
              {p.role && <Icon name={ROLE_ICON[p.role]} className="ph-emblem" />}
              <span className="ph-mono">{initials(p.name)}</span>
            </div>
          )}
          <div className="portrait-sheen" />
          <div className="portrait-flash" />
        </div>
      </div>
      <div className="portrait-plinth" />
      <AttackGem role={p.role} value={Math.max(0, p.attack)} tone={atkTone} />
      <HealthGem value={Math.max(0, p.health)} tone={hpTone} />
      {children}
    </div>
  );
}
