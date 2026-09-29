import { useState } from 'react';
import { useDailyHistory, useFavoriteColors } from '@/app/queries';
import { CATEGORY_IDS, getCategory } from '@/content/categories';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { MODE_NAMES } from '@/meta/format';
import { MODE_IDS, type ModeId } from '@/modes/types';
import { useNav } from '@/store/nav';
import { Card, EmptyState, Screen, SectionHeader, Segmented, Skeleton } from '@/ui/kit';
import { IconFlame, IconStar } from '@/ui/meta/icons';
import { fmt, formatMinutes } from './profile/format';
import { ActivityChart, Donut, RowBar } from './profile/charts';
import { IconBrush, IconChart, IconClock, IconFrame, IconPalette } from './profile/icons';
import { useMetaView } from './profile/useMetaView';
import { CountUp } from './profile/widgets';
import './profile/stats.css';

const hex = (rgb: number) => `#${rgb.toString(16).padStart(6, '0')}`;

const MODE_COLORS: Readonly<Record<ModeId, string>> = {
  pixel: 'var(--primary)',
  diamond: 'var(--tertiary)',
  crossstitch: 'color-mix(in srgb, var(--primary) 45%, var(--surface-2))',
  mosaic: 'color-mix(in srgb, var(--tertiary) 45%, var(--surface-2))',
};

export default function StatsScreen() {
  const meta = useMetaView();
  const history = useDailyHistory(30);
  const colors = useFavoriteColors(8);
  const [metric, setMetric] = useState<'cells' | 'time'>('cells');

  const tiles = meta
    ? [
        {
          icon: <IconFrame size={20} />,
          value: meta.stat('artworks'),
          label: tr(t('Œuvres terminées', 'Artworks completed')),
        },
        {
          icon: <IconBrush size={20} />,
          value: meta.stat('cells'),
          label: tr(t('Cases posées', 'Cells placed')),
        },
        {
          icon: <IconPalette size={20} />,
          value: meta.stat('colors'),
          label: tr(t('Couleurs terminées', 'Colors completed')),
        },
        {
          icon: <IconChart size={20} />,
          value: meta.stat('days'),
          label: tr(t('Jours de coloriage', 'Coloring days')),
        },
        {
          icon: <IconFlame size={20} />,
          value: meta.snap.streak.current,
          label: tr(t('Série en cours (jours)', 'Current streak (days)')),
        },
        {
          icon: <IconStar size={20} />,
          value: meta.stat('streak.best'),
          label: tr(t('Série record (jours)', 'Best streak (days)')),
        },
      ]
    : null;
  const playMinutes = meta?.stat('playtime.minutes') ?? 0;
  const modeCells = MODE_IDS.map((m) => meta?.stat(`cells.mode.${m}`) ?? 0);
  const modeArtworks = MODE_IDS.map((m) => meta?.stat(`artworks.mode.${m}`) ?? 0);
  const maxArtworks = Math.max(1, ...modeArtworks);
  const categories = CATEGORY_IDS.map((id) => ({ id, n: meta?.stat(`artworks.category.${id}`) ?? 0 }))
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 6);
  const others = meta
    ? ([
        [tr(t('Quêtes du jour terminées', 'Daily quests completed')), meta.stat('quests.daily')],
        [tr(t('Quêtes de la semaine terminées', 'Weekly quests completed')), meta.stat('quests.weekly')],
        [tr(t('Œuvres du jour terminées', 'Daily artworks completed')), meta.stat('artworks.daily')],
        [tr(t('Coffres ouverts', 'Chests opened')), meta.stat('chests')],
        [tr(t('Outils utilisés', 'Tools used')), meta.stat('tools')],
        [tr(t('Jokers de série utilisés', 'Streak freezes used')), meta.stat('freezes.used')],
        [tr(t('Collections terminées', 'Collections completed')), meta.stat('collections')],
        [tr(t('Œuvres tirées de tes photos', 'Artworks from your photos')), meta.stat('artworks.photo')],
        [tr(t('Créations personnelles', 'Your own creations')), meta.stat('artworks.creation')],
      ] as const)
    : null;
  const recentTotal =
    history?.slice(0, 14).reduce((n, h) => n + (metric === 'cells' ? h.cells : h.timeMs), 0) ?? 0;

  return (
    <Screen
      title={tr(t('Statistiques', 'Statistics'))}
      className="st"
      onBack={() => {
        useNav.getState().pop();
      }}
    >
      <div className="pf-stack">
        <Card index={0} className="st-hero">
          <span className="st-hero__icon">
            <IconClock size={26} />
          </span>
          <div>
            <span className="pf-eyebrow">{tr(t('Temps de coloriage', 'Coloring time'))}</span>
            {meta ? (
              <strong className="st-hero__value">
                <CountUp value={playMinutes} format={formatMinutes} />
              </strong>
            ) : (
              <Skeleton width={120} height={30} />
            )}
          </div>
        </Card>
        <div className="pf-summary">
          {tiles
            ? tiles.map((it, i) => (
                <Card key={it.label} index={i + 1} className="pf-tile">
                  <span className="pf-tile__icon">{it.icon}</span>
                  <strong className="pf-tile__value">
                    <CountUp value={it.value} />
                  </strong>
                  <span className="pf-tile__label">{it.label}</span>
                </Card>
              ))
            : Array.from({ length: 6 }, (_, i) => (
                <Card key={i} index={i + 1} className="pf-tile">
                  <Skeleton width={36} height={36} radius={12} />
                  <Skeleton width={60} height={22} />
                  <Skeleton width="80%" height={12} />
                </Card>
              ))}
        </div>
      </div>

      <SectionHeader title={tr(t('Activité', 'Activity'))} />
      <div className="pf-stack">
        <Card index={7}>
          <div className="st-toggle">
            <Segmented
              variant="segmented"
              layoutId="st-metric"
              label={tr(t('Mesure', 'Measure'))}
              value={metric}
              onChange={setMetric}
              options={[
                { id: 'cells', label: tr(t('Cases', 'Cells')) },
                { id: 'time', label: tr(t('Temps', 'Time')) },
              ]}
            />
            <span className="st-toggle__sum">
              {tr(t('14 jours', '14 days'))} ·{' '}
              {metric === 'cells' ? fmt(recentTotal) : formatMinutes(recentTotal / 60_000)}
            </span>
          </div>
          {history && meta ? (
            <ActivityChart history={history} today={meta.snap.day} metric={metric} />
          ) : (
            <Skeleton height={160} radius={16} />
          )}
        </Card>
      </div>

      <SectionHeader title={tr(t('Par mode', 'By mode'))} />
      <div className="pf-stack">
        <Card index={8}>
          {meta ? (
            <>
              <Donut
                unit={tr(t('cases', 'cells'))}
                parts={MODE_IDS.map((m, i) => ({
                  id: m,
                  label: tr(MODE_NAMES[m]),
                  value: modeCells[i] ?? 0,
                  color: MODE_COLORS[m],
                }))}
              />
              <div className="st-rows">
                {MODE_IDS.map((m, i) => (
                  <RowBar
                    key={m}
                    label={tr(MODE_NAMES[m])}
                    value={modeArtworks[i] ?? 0}
                    max={maxArtworks}
                    color={MODE_COLORS[m]}
                    text={`${fmt(modeArtworks[i] ?? 0)} ${tr(t('œuvres', 'artworks'))}`}
                  />
                ))}
              </div>
            </>
          ) : (
            <Skeleton height={140} radius={16} />
          )}
        </Card>
      </div>

      {categories.length > 0 && (
        <>
          <SectionHeader title={tr(t('Catégories préférées', 'Favorite categories'))} />
          <div className="pf-stack">
            <Card index={9}>
              <div className="st-rows">
                {categories.map((c) => (
                  <RowBar
                    key={c.id}
                    label={tr(getCategory(c.id).name)}
                    value={c.n}
                    max={categories[0]?.n ?? 1}
                    text={fmt(c.n)}
                  />
                ))}
              </div>
            </Card>
          </div>
        </>
      )}

      <SectionHeader title={tr(t('Couleurs préférées', 'Favorite colors'))} />
      <div className="pf-stack">
        <Card index={10}>
          {colors === undefined && (
            <div className="pf-swatches">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} width={40} height={40} radius={20} />
              ))}
            </div>
          )}
          {colors && colors.length > 0 && (
            <ul className="st-colors">
              {colors.map((c) => (
                <li key={c.rgb}>
                  <span
                    className="pf-swatch"
                    style={{ background: hex(c.rgb) }}
                    role="img"
                    aria-label={hex(c.rgb)}
                  />
                  <small>{fmt(c.cells)}</small>
                </li>
              ))}
            </ul>
          )}
          {colors?.length === 0 && (
            <EmptyState
              title={tr(t('Pas encore de couleurs', 'No colors yet'))}
              text={tr(
                t(
                  'Pose quelques cases : tes teintes favorites se dessineront ici.',
                  'Place a few cells: your favorite hues will show up here.',
                ),
              )}
            />
          )}
        </Card>
      </div>

      <SectionHeader title={tr(t('En détail', 'In detail'))} />
      <div className="pf-stack">
        <Card index={11} className="pf-card--flush">
          <dl className="st-list">
            {others
              ? others.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{fmt(value)}</dd>
                  </div>
                ))
              : null}
          </dl>
        </Card>
      </div>
    </Screen>
  );
}
