import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { achievementRewards, type AchievementDef } from '@/meta/achievements';
import { ACHIEVEMENT_TEXT } from '@/meta/achievements.text';
import { mergeRewards } from '@/meta/rewards';
import { Sheet } from '@/ui/kit';
import { achievementDescription, achievementTitle, rewardLabel } from '@/ui/meta/labels';
import { FAMILY_NAMES } from './families';
import { fmt, formatDate, formatMinutes, RANK_LABEL } from './format';
import { IconCheckBold } from './icons';
import { Medal } from './Medal';
import { Bar } from './widgets';
import './achievements.css';

export interface AchievementStatus {
  def: AchievementDef;
  earnedAt: number | undefined;
  value: number;
  /** Position dans sa famille (1-based) et taille de la famille. */
  index: number;
  count: number;
}

const showValue = (def: AchievementDef, n: number) =>
  def.metric === 'playtime.minutes' ? formatMinutes(n) : fmt(n);

/** Détail d'un succès : médaille, description ou indice (secrets), progression, date, récompenses. */
export function AchievementSheet({
  status,
  open,
  onClose,
}: {
  status: AchievementStatus | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} label={tr(t('Détail du succès', 'Achievement details'))}>
      {status && <Detail status={status} />}
    </Sheet>
  );
}

function Detail({ status }: { status: AchievementStatus }) {
  const { def, earnedAt, value, index, count } = status;
  const earned = earnedAt !== undefined;
  const secret = def.kind === 'secret' && !earned;
  const hint = ACHIEVEMENT_TEXT[def.id]?.hint;
  const rewards = mergeRewards(achievementRewards(def));
  const ratio = Math.min(1, value / def.target);
  return (
    <div className="ach-sheet">
      <div className="ach-sheet__medal">
        <Medal icon={def.icon} rank={def.rank} earned={earned} secret={secret} size={92} pips />
      </div>
      <span className="pf-eyebrow">
        {tr(FAMILY_NAMES[def.group] ?? t('Succès', 'Achievement'))}
        {def.kind === 'tiered' && count > 1 && ` · ${tr(t('Palier', 'Tier'))} ${index} / ${count}`}
      </span>
      <h3 className="ach-sheet__title">{secret ? '???' : achievementTitle(def.id)}</h3>
      <p className="ach-sheet__desc">
        {secret
          ? hint
            ? tr(hint)
            : tr(t('Un succès secret à découvrir.', 'A secret achievement to discover.'))
          : achievementDescription(def.id, def.target)}
      </p>
      {earned ? (
        <div className="ach-sheet__earned">
          <IconCheckBold size={18} />
          {tr(t('Obtenu le', 'Earned on'))} {formatDate(earnedAt)}
        </div>
      ) : (
        !secret && (
          <div className="ach-sheet__progress">
            <Bar
              value={ratio}
              label={`${tr(t('Progression', 'Progress'))} ${showValue(def, value)} / ${showValue(def, def.target)}`}
            />
            <span>
              {showValue(def, Math.min(value, def.target))} / {showValue(def, def.target)}
            </span>
          </div>
        )
      )}
      <div className="ach-sheet__rewards">
        <span className="pf-eyebrow">
          {RANK_LABEL(def.rank)} · {tr(t('Récompenses', 'Rewards'))}
        </span>
        <ul>
          {rewards.map((r) => (
            <li key={rewardLabel(r)} data-earned={earned}>
              {rewardLabel(r)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
