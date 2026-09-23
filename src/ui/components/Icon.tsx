import { GAME_ICONS } from '../icons/gameIcons';
import { pixelIcon } from '../pixelIcon';

/** A game-icons.net glyph, filled with currentColor, or drawn as pixel art. */
export function Icon({ name, size = 24, className, style, pixel = false }: {
  name: string; size?: number | string; className?: string; style?: React.CSSProperties; pixel?: boolean;
}) {
  const url = pixel ? pixelIcon(name) : undefined;
  if (url) {
    return (
      <img src={url} width={size} height={size} alt="" draggable={false}
        className={`${className ?? ''} pixel-glyph`} style={{ imageRendering: 'pixelated', ...style }} />
    );
  }
  const d = (GAME_ICONS as Record<string, string>)[name];
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} className={className} style={style} aria-hidden="true">
      {d ? <path d={d} fill="currentColor" /> : null}
    </svg>
  );
}
