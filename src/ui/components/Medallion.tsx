import type { AbilityDef } from '../../engine';
import { Icon } from './Icon';
import { pixelIcon } from '../pixelIcon';

export const schoolClass = (s: AbilityDef['school']) => `school-${(s ?? 'none').toLowerCase()}`;

export interface MedallionProps {
  ability: AbilityDef;
  speed: number;
  cooldown?: number;
  size?: number;
  state?: 'ready' | 'cooldown' | 'selected' | 'armed' | 'plain';
  onClick?: () => void;
  onEnter?: () => void;
  onLeave?: () => void;
  showSpeed?: boolean;
  className?: string;
}

/** A round ability icon: gold ring, speed on a silver wing, hourglass when cooling down. */
export function Medallion({
  ability, speed, cooldown = 0, size = 110, state = 'plain', onClick, onEnter, onLeave, showSpeed = true, className = '',
}: MedallionProps) {
  const speedTone = speed < ability.speed ? 'fast' : speed > ability.speed ? 'slow' : '';
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      className={`medallion ${schoolClass(ability.school)} is-${state} ${className}`}
      style={{ '--m': `${size}px` } as React.CSSProperties}
      onClick={onClick}
      // Touch has no hover: a tap is handled as a click instead.
      onPointerEnter={(e) => { if (e.pointerType !== 'touch') onEnter?.(); }}
      onPointerLeave={(e) => { if (e.pointerType !== 'touch') onLeave?.(); }}
      aria-label={onClick ? `${ability.name}, speed ${speed}${cooldown ? `, ready in ${cooldown}` : ''}` : undefined}
      type={onClick ? 'button' : undefined}
    >
      <span className="med-ring">
        <span className="med-face">
          {ability.pixel && pixelIcon(ability.icon) ? (
            <img src={pixelIcon(ability.icon)} alt="" className="med-icon is-pixel" draggable={false} />
          ) : (
            <Icon name={ability.icon} className="med-icon" />
          )}
          <span className="med-gloss" />
        </span>
      </span>
      {showSpeed && (
        <span className={`med-speed ${speedTone}`}>
          <Icon name="feathered-wing" className="wing" />
          <span className="num">{speed}</span>
        </span>
      )}
      {cooldown > 0 && (
        <span className="med-cd">
          <Icon name="hourglass" className="hg" />
          <span className="num">{cooldown}</span>
        </span>
      )}
    </Tag>
  );
}
