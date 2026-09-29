import { motion } from 'framer-motion';
import { useFavoriteColors, useCompletedArtworks } from '@/app/queries';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { COLLECTIONS, collectionProgress } from '@/content/collections';
import { prestigeBadge } from '@/meta/catalog';
import { ACHIEVEMENTS } from '@/meta/achievements.data';
import { xpToNext } from '@/meta/levels';
import { levelRewards } from '@/meta/unlocks';
import { useNav } from '@/store/nav';
import { spring, staggerDelay } from '@/theme/motion/tokens';
import { Badge, Card, IconButton, ListRow, Screen, SectionHeader, Skeleton } from '@/ui/kit';
import { IconChevron, IconSettings } from '@/ui/kit/icons';
import { IconChest, IconBucket, IconLoupe, IconSnow, IconTrophy, IconWand } from '@/ui/meta/icons';
import { rewardLabel } from '@/ui/meta/labels';
import { fmt } from './profile/format';
import { IconBrush, IconChart, IconCollections, IconFrame, IconLockSmall, IconSpark } from './profile/icons';
import { LevelBadge } from './profile/LevelBadge';
import { nextUnlock, prestigeTier } from './profile/next';
import { useMetaView } from './profile/useMetaView';
import { Bar, CountUp } from './profile/widgets';
import './profile/profile.css';

const hex = (rgb: number) => `#${rgb.toString(16).padStart(6, '0')}`;

function IdentityCard() {
  const meta = useMetaView();
  if (!meta) return <ProfileSkeleton />;
  const { level } = meta.snap;
  const tier = prestigeTier(level.level);
  const next = nextUnlock(level.level);
  const rewards = levelRewards(level.level + 1);
  return (
    <Card index={0} className="pf-identity">
      <div className="pf-identity__top">
        <LevelBadge level={level.level} progress={level.progress} />
        <div className="pf-identity__text">
          <span className="pf-eyebrow">
            {tr(t('Niveau', 'Level'))} {level.level}
          </span>
          <strong className="pf-identity__level">
            <CountUp value={meta.xp} /> <small>XP</small>
          </strong>
          {tier > 0 && (
            <motion.span
              className="pf-prestige"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', ...spring.bouncy, delay: 0.3 }}
            >
              <IconSpark size={14} />
              {tr(prestigeBadge(tier).name)}
            </motion.span>
          )}
        </div>
      </div>
      <div className="pf-identity__bar">
        <Bar
          value={level.progress}
          label={tr(t('Progression vers le niveau suivant', 'Progress to the next level'))}
        />
        <div className="pf-identity__bar-text">
          <span>
            {fmt(level.into)} / {fmt(xpToNext(level.level))} XP
          </span>
          <span>
            {tr(t('Niveau', 'Level'))} {level.level + 1}
          </span>
        </div>
      </div>
      <div className="pf-next">
        <div className="pf-next__row">
          <span className="pf-next__icon">
            <IconSpark size={18} />
          </span>
          <div className="pf-next__text">
            <small>
              {tr(t('Au niveau', 'At level'))} {level.level + 1}
            </small>
            <strong>{rewards.map(rewardLabel).join(' · ')}</strong>
          </div>
        </div>
        {next && next.level > level.level + 1 && (
          <div className="pf-next__row">
            <span className="pf-next__icon pf-next__icon--lock">
              <IconLockSmall size={18} />
            </span>
            <div className="pf-next__text">
              <small>
                {tr(t('Prochain déblocage', 'Next unlock'))} · {tr(t('niveau', 'level'))} {next.level}
              </small>
              <strong>{next.rewards.map(rewardLabel).join(' · ')}</strong>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function ProfileSkeleton() {
  return (
    <Card index={0} className="pf-identity">
      <div className="pf-identity__top">
        <Skeleton width={116} height={116} radius={58} />
        <div className="pf-identity__text" style={{ gap: 10 }}>
          <Skeleton width={70} height={14} />
          <Skeleton width={90} height={34} />
          <Skeleton width={130} height={14} />
        </div>
      </div>
      <Skeleton height={10} radius={5} />
      <Skeleton height={60} radius={16} />
    </Card>
  );
}

function Summary() {
  const meta = useMetaView();
  const items = meta
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
          icon: <IconChart size={20} />,
          value: meta.stat('streak.best'),
          label: tr(t('Record de série', 'Best streak')),
        },
        {
          icon: <IconTrophy size={20} />,
          value: meta.snap.achievements,
          label: `${tr(t('Succès', 'Achievements'))} (${tr(t('sur', 'of'))} ${ACHIEVEMENTS.length})`,
        },
      ]
    : null;
  return (
    <div className="pf-summary">
      {items
        ? items.map((it, i) => (
            <Card key={it.label} index={i + 1} className="pf-tile">
              <span className="pf-tile__icon">{it.icon}</span>
              <strong className="pf-tile__value">
                <CountUp value={it.value} />
              </strong>
              <span className="pf-tile__label">{it.label}</span>
            </Card>
          ))
        : [0, 1, 2, 3].map((i) => (
            <Card key={i} index={i + 1} className="pf-tile">
              <Skeleton width={36} height={36} radius={12} />
              <Skeleton width={60} height={24} />
              <Skeleton width="80%" height={12} />
            </Card>
          ))}
    </div>
  );
}

function FavoriteColors() {
  const colors = useFavoriteColors(8);
  return (
    <Card index={5}>
      <div className="pf-swatches" aria-busy={colors === undefined}>
        {colors === undefined &&
          Array.from({ length: 8 }, (_, i) => <Skeleton key={i} width={34} height={34} radius={17} />)}
        {colors?.map((c, i) => (
          <motion.span
            key={c.rgb}
            className="pf-swatch"
            role="img"
            aria-label={`${hex(c.rgb)} · ${fmt(c.cells)} ${tr(t('cases', 'cells'))}`}
            title={`${hex(c.rgb)} · ${fmt(c.cells)}`}
            style={{ background: hex(c.rgb) }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileTap={{ scale: 0.88 }}
            transition={{ type: 'spring', ...spring.bouncy, delay: staggerDelay(i, 40) / 1000 }}
          />
        ))}
      </div>
      {colors?.length === 0 && (
        <p className="pf-muted">
          {tr(
            t(
              'Tes couleurs préférées apparaîtront ici dès que tu auras colorié.',
              'Your favorite colors will show up here once you start coloring.',
            ),
          )}
        </p>
      )}
    </Card>
  );
}

function Bag() {
  const meta = useMetaView();
  if (!meta) return null;
  const { tools, chests, freezes } = meta.snap;
  const items = [
    { icon: <IconLoupe size={18} />, n: tools.loupe, label: tr(t('Loupes', 'Magnifiers')) },
    { icon: <IconBucket size={18} />, n: tools.bucket, label: tr(t('Pots de peinture', 'Paint buckets')) },
    { icon: <IconWand size={18} />, n: tools.wand, label: tr(t('Baguettes', 'Magic wands')) },
    {
      icon: <IconChest size={18} />,
      n: chests.small + chests.medium + chests.large,
      label: tr(t('Coffres', 'Chests')),
    },
    { icon: <IconSnow size={18} />, n: freezes, label: tr(t('Jokers de série', 'Streak freezes')) },
  ];
  return (
    <Card index={6}>
      <div className="pf-bag">
        {items.map((it) => (
          <div key={it.label} className="pf-bag__item" role="group" aria-label={`${it.label} : ${it.n}`}>
            <span className="pf-bag__icon">{it.icon}</span>
            <strong>×{it.n}</strong>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Links() {
  const meta = useMetaView();
  const completed = useCompletedArtworks();
  const push = useNav((s) => s.push);
  const unseen = meta?.snap.unseen ?? 0;
  const done = completed
    ? COLLECTIONS.filter((c) => collectionProgress(c, completed) === c.artworks.length).length
    : null;
  return (
    <Card index={7} className="pf-card--flush">
      <ListRow
        icon={<IconTrophy size={20} />}
        title={tr(t('Succès', 'Achievements'))}
        {...(meta && {
          subtitle: `${meta.snap.achievements} / ${ACHIEVEMENTS.length} ${tr(t('obtenus', 'earned'))}`,
        })}
        trailing={
          <span className="pf-row-end">
            {unseen > 0 && (
              <Badge>
                <span aria-label={`${unseen} ${tr(t('nouveautés', 'new'))}`}>{unseen}</span>
              </Badge>
            )}
            <IconChevron size={18} />
          </span>
        }
        onClick={() => {
          push('achievements');
        }}
      />
      <ListRow
        icon={<IconCollections size={20} />}
        title={tr(t('Collections', 'Collections'))}
        {...(done !== null && {
          subtitle: `${done} / ${COLLECTIONS.length} ${tr(t('terminées', 'completed'))}`,
        })}
        onClick={() => {
          push('collections');
        }}
      />
      <ListRow
        icon={<IconChart size={20} />}
        title={tr(t('Statistiques', 'Statistics'))}
        subtitle={tr(t('Temps de jeu, modes, activité', 'Play time, modes, activity'))}
        onClick={() => {
          push('stats');
        }}
      />
      <ListRow
        icon={<IconSettings size={20} />}
        title={tr(t('Réglages', 'Settings'))}
        subtitle={tr(t('Apparence, jeu, son, langue', 'Appearance, game, sound, language'))}
        onClick={() => {
          push('settings');
        }}
      />
    </Card>
  );
}

export default function ProfileScreen() {
  const push = useNav((s) => s.push);
  return (
    <Screen
      title={tr(t('Profil', 'Profile'))}
      className="pf"
      actions={
        <IconButton
          label={tr(t('Réglages', 'Settings'))}
          onClick={() => {
            push('settings');
          }}
        >
          <IconSettings size={22} />
        </IconButton>
      }
    >
      <div className="pf-stack">
        <IdentityCard />
        <Summary />
      </div>
      <SectionHeader title={tr(t('Couleurs préférées', 'Favorite colors'))} />
      <div className="pf-stack">
        <FavoriteColors />
      </div>
      <SectionHeader title={tr(t('Ton sac', 'Your bag'))} />
      <div className="pf-stack">
        <Bag />
      </div>
      <SectionHeader title={tr(t('Explorer', 'Explore'))} />
      <div className="pf-stack">
        <Links />
      </div>
    </Screen>
  );
}
