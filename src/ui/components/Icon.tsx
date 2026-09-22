import { GAME_ICONS } from '../icons/gameIcons';

/** A game-icons.net glyph, filled with currentColor. */
export function Icon({ name, size = 24, className, style }: {
  name: string; size?: number | string; className?: string; style?: React.CSSProperties;
}) {
  const d = (GAME_ICONS as Record<string, string>)[name];
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} className={className} style={style} aria-hidden="true">
      {d ? <path d={d} fill="currentColor" /> : null}
    </svg>
  );
}
