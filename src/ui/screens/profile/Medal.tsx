import type { AchievementIcon, Rank } from '@/meta/achievements';
import { AchievementGlyph } from './glyphs';
import './profile.css';

/** Médaille d'un succès : la matière suit le rang, le halo n'apparaît qu'une fois obtenue. */
export function Medal({
  icon,
  rank,
  earned,
  secret = false,
  size = 48,
  pips = false,
}: {
  icon: AchievementIcon;
  rank: Rank;
  earned: boolean;
  /** Secret pas encore obtenu : un point d'interrogation à la place du dessin. */
  secret?: boolean;
  size?: number;
  pips?: boolean;
}) {
  return (
    <span
      className="pf-medal"
      data-rank={rank}
      data-earned={earned}
      style={{ width: size, height: size, fontSize: size * 0.46 }}
    >
      <span className="pf-medal__face">
        {secret ? <b>?</b> : <AchievementGlyph icon={icon} size={Math.round(size * 0.46)} />}
      </span>
      {pips && (
        <span className="pf-medal__pips" aria-hidden>
          {Array.from({ length: rank }, (_, i) => (
            <i key={i} />
          ))}
        </span>
      )}
    </span>
  );
}
