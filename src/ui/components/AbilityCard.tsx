import type { AbilityDef } from '../../engine';
import { Medallion, schoolClass } from './Medallion';
import { keywordsIn, RichText } from './RichText';

export interface AbilityCardProps {
  ability: AbilityDef;
  text: string;
  speed: number;
  cooldown: number;
  /** Turns until ready, when on cooldown now. */
  waiting?: number;
  caption?: React.ReactNode;
  tone?: 'player' | 'enemy' | 'neutral';
  showKeywords?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/** The parchment card shown on hover and as an ability resolves. */
export function AbilityCard({
  ability, text, speed, cooldown, waiting = 0, caption, tone = 'neutral', showKeywords = true, className = '', style,
}: AbilityCardProps) {
  const kws = showKeywords ? keywordsIn(text) : [];
  return (
    <div className={`acard-wrap ${className}`} style={style}>
      <div className={`acard tone-${tone} ${schoolClass(ability.school)}`}>
        {caption && <div className="acard-caption">{caption}</div>}
        <div className="acard-top">
          <Medallion ability={ability} speed={speed} size={132} />
          {cooldown > 0 && (
            <div className="acard-cooldown" title={`Cooldown ${cooldown}`}>
              <span className="num">{cooldown}</span>
            </div>
          )}
        </div>
        <div className="acard-banner">
          <span className="acard-name">{ability.name}</span>
          <span className="acard-tier">5</span>
        </div>
        <div className="acard-text">
          <RichText text={text} />
          {waiting > 0 && <div className="acard-waiting">Ready in {waiting} turn{waiting > 1 ? 's' : ''}</div>}
        </div>
        <div className="acard-school">{ability.school ?? (ability.isAttack ? 'Attack' : 'Ability')}</div>
      </div>
      {kws.length > 0 && (
        <div className="kw-stack">
          {kws.map(([k, v]) => (
            <div className="kw-tip" key={k}>
              <div className="kw-title">{k}</div>
              <RichText text={v} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
