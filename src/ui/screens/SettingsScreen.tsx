import { motion } from 'framer-motion';
import { useState, type ReactNode } from 'react';
import { APP_CONFIG } from '@/config/app';
import { tr } from '@/i18n/locale';
import type { Locale } from '@/i18n/text';
import { t } from '@/i18n/text';
import { useNav } from '@/store/nav';
import { useSettings, type Quality, type Settings } from '@/store/settings';
import { spring } from '@/theme/motion/tokens';
import { UpdateRow } from '@/update/UpdateRow';
import { Button, Card, ListRow, Screen, SectionHeader, Segmented, Sheet, Slider, Switch } from '@/ui/kit';
import { BackupRows } from './profile/BackupRows';
import { IconInfo, IconReplay } from './profile/icons';
import { ThemePicker } from './profile/ThemePicker';
import './profile/profile.css';
import './profile/settings.css';

type BoolKey = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];
type NumKey = 'musicVolume' | 'ambienceVolume' | 'effectsVolume' | 'numberScale' | 'ghost';

function Toggle({ k, label, hint }: { k: BoolKey; label: string; hint?: string }) {
  const value = useSettings((s) => s[k]);
  return (
    <Switch
      label={label}
      {...(hint && { hint })}
      checked={value}
      onChange={(checked) => {
        useSettings.getState().set({ [k]: checked });
      }}
    />
  );
}

function Range({
  k,
  label,
  min = 0,
  max = 1,
  step = 0.05,
  text,
  hint,
}: {
  k: NumKey;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  text: (v: number) => string;
  hint?: string;
}) {
  const value = useSettings((s) => s[k]);
  return (
    <div className="set-range">
      <Slider
        label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        valueText={text(value)}
        {...(hint && { hint })}
        onChange={(v) => {
          useSettings.getState().set({ [k]: v });
        }}
      />
    </div>
  );
}

const percent = (v: number) => `${Math.round(v * 100)} %`;

function Group({ title, index, children }: { title: string; index: number; children: ReactNode }) {
  return (
    <>
      <SectionHeader title={title} />
      <div className="pf-stack">
        <Card index={index} className="pf-card--flush set-group">
          {children}
        </Card>
      </div>
    </>
  );
}

function Block({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="set-block">
      <div className="set-block__head">
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </div>
      {children}
    </div>
  );
}

const ghostText = (v: number) =>
  v <= 0
    ? tr(t('Discret', 'Subtle'))
    : v < 1
      ? tr(t('Doux', 'Soft'))
      : v === 1
        ? tr(t('Équilibré', 'Balanced'))
        : v < 2
          ? tr(t('Prononcé', 'Strong'))
          : tr(t('Marqué', 'Bold'));

export default function SettingsScreen() {
  const quality = useSettings((s) => s.quality);
  const locale = useSettings((s) => s.locale);
  const numberScale = useSettings((s) => s.numberScale);
  const [confirming, setConfirming] = useState(false);
  const [replayed, setReplayed] = useState(false);
  const set = useSettings.getState().set;

  return (
    <Screen
      title={tr(t('Réglages', 'Settings'))}
      className="set"
      onBack={() => {
        useNav.getState().pop();
      }}
    >
      <Group title={tr(t('Apparence', 'Appearance'))} index={0}>
        <Block label={tr(t('Thème', 'Theme'))}>
          <ThemePicker />
        </Block>
        <Toggle
          k="highContrast"
          label={tr(t('Contraste élevé', 'High contrast'))}
          hint={tr(t('Textes et bordures plus francs', 'Bolder text and borders'))}
        />
        <Range
          k="numberScale"
          label={tr(t('Taille des numéros', 'Number size'))}
          min={0.75}
          max={1.5}
          step={0.05}
          text={percent}
          hint={tr(t('Numéros affichés sur les cases de la grille', 'Numbers shown on the grid cells'))}
        />
        <div className="set-numbers" aria-hidden>
          {[3, 12, 7, 24].map((n) => (
            <motion.span
              key={n}
              animate={{ scale: numberScale }}
              transition={{ type: 'spring', ...spring.snappy }}
            >
              {n}
            </motion.span>
          ))}
        </div>
        <Block label={tr(t('Qualité graphique', 'Graphics quality'))}>
          <Segmented<Quality>
            variant="segmented"
            layoutId="set-quality"
            label={tr(t('Qualité graphique', 'Graphics quality'))}
            value={quality}
            onChange={(q) => {
              set({ quality: q });
            }}
            options={[
              { id: 'low', label: tr(t('Économe', 'Saver')) },
              { id: 'medium', label: tr(t('Équilibrée', 'Balanced')) },
              { id: 'high', label: tr(t('Maximale', 'Max')) },
            ]}
          />
        </Block>
      </Group>

      <Group title={tr(t('Jeu', 'Game'))} index={1}>
        <Toggle
          k="autoCorrect"
          label={tr(t('Correction automatique', 'Auto-correct'))}
          hint={tr(
            t(
              'En glissant, seule la couleur choisie est posée',
              'While dragging, only the selected color is placed',
            ),
          )}
        />
        <Toggle
          k="leftHanded"
          label={tr(t('Mode gaucher', 'Left-handed mode'))}
          hint={tr(t('Commandes à gauche de l’écran', 'Controls on the left of the screen'))}
        />
        <Toggle
          k="oneHanded"
          label={tr(t('Une main', 'One hand'))}
          hint={tr(t('Commandes regroupées en bas de l’écran', 'Controls gathered at the bottom'))}
        />
        <Toggle
          k="colorblind"
          label={tr(t('Motifs daltoniens', 'Colorblind patterns'))}
          hint={tr(t('Des motifs s’ajoutent aux numéros', 'Patterns are added to the numbers'))}
        />
        <Range
          k="ghost"
          label={tr(t('Aperçu des couleurs', 'Color preview'))}
          min={0}
          max={2}
          step={0.5}
          text={ghostText}
          hint={tr(t('Teinte des cases encore vides', 'Tint of the cells still empty'))}
        />
        <Toggle
          k="minimap"
          label={tr(t('Minicarte et radar', 'Minimap and radar'))}
          hint={tr(t('Repères quand tu zoomes', 'Landmarks when you zoom in'))}
        />
        <Toggle
          k="keepAwake"
          label={tr(t('Garder l’écran allumé', 'Keep the screen on'))}
          hint={tr(t('Pendant que tu colories', 'While you color'))}
        />
      </Group>

      <Group title={tr(t('Son', 'Sound'))} index={2}>
        <Range k="musicVolume" label={tr(t('Musique', 'Music'))} text={percent} />
        <Range k="ambienceVolume" label={tr(t('Ambiance', 'Ambience'))} text={percent} />
        <Range k="effectsVolume" label={tr(t('Effets', 'Effects'))} text={percent} />
        <Toggle
          k="haptics"
          label={tr(t('Vibrations', 'Vibrations'))}
          hint={tr(t('Un léger retour à chaque case posée', 'A light tap for every cell placed'))}
        />
      </Group>

      <Group title={tr(t('Accessibilité', 'Accessibility'))} index={3}>
        <Toggle
          k="reducedMotion"
          label={tr(t('Réduire les animations', 'Reduce animations'))}
          hint={tr(t('Des transitions plus sobres partout', 'Calmer transitions everywhere'))}
        />
      </Group>

      <Group title={tr(t('Langue', 'Language'))} index={4}>
        <Block label={tr(t('Langue de l’application', 'App language'))}>
          <Segmented<'auto' | Locale>
            variant="segmented"
            layoutId="set-locale"
            label={tr(t('Langue de l’application', 'App language'))}
            value={locale ?? 'auto'}
            onChange={(l) => {
              set({ locale: l === 'auto' ? null : l });
            }}
            options={[
              { id: 'auto', label: tr(t('Automatique', 'Automatic')) },
              { id: 'fr', label: 'Français' },
              { id: 'en', label: 'English' },
            ]}
          />
        </Block>
      </Group>

      <Group title={tr(t('Notifications', 'Notifications'))} index={5}>
        <Toggle
          k="notifications"
          label={tr(t('Rappel doux', 'Gentle reminder'))}
          hint={tr(
            t('Une petite pensée pour ne pas perdre ta série', 'A small nudge so you keep your streak'),
          )}
        />
      </Group>

      <Group title={tr(t('Mises à jour', 'Updates'))} index={6}>
        <UpdateRow />
        <Toggle
          k="autoUpdateCheck"
          label={tr(t('Vérifier automatiquement', 'Check automatically'))}
          hint={tr(t('Une fois par jour, au lancement', 'Once a day, at launch'))}
        />
        <Toggle
          k="includePrereleases"
          label={tr(t('Recevoir les préversions', 'Get pre-releases'))}
          hint={tr(
            t('Des nouveautés en avance, parfois moins stables', 'New features early, sometimes less stable'),
          )}
        />
      </Group>

      <Group title={tr(t('Sauvegarde', 'Backup'))} index={7}>
        <BackupRows />
      </Group>

      <Group title={tr(t('À propos', 'About'))} index={8}>
        <ListRow
          icon={<IconInfo size={20} />}
          title="Tessel"
          subtitle={`${tr(t('Version', 'Version'))} ${APP_CONFIG.version}`}
        />
        <p className="set-credits">
          {tr(
            t(
              'Les œuvres du domaine public, la musique et leurs auteurs sont crédités dans assets/art/CREDITS.md et assets/audio/CREDITS.md (voir docs/ARCHITECTURE.md).',
              'Public-domain artworks, music and their authors are credited in assets/art/CREDITS.md and assets/audio/CREDITS.md (see docs/ARCHITECTURE.md).',
            ),
          )}
        </p>
        <ListRow
          icon={<IconReplay size={20} />}
          title={tr(t('Revoir l’introduction', 'Replay the introduction'))}
          subtitle={
            replayed
              ? tr(t('C’est parti !', 'Here we go!'))
              : tr(t('Le petit tour de bienvenue', 'The little welcome tour'))
          }
          onClick={() => {
            setReplayed(true);
            set({ onboarded: false });
          }}
        />
      </Group>

      <div className="pf-stack set-reset">
        <Button
          variant="tonal"
          onClick={() => {
            setConfirming(true);
          }}
        >
          {tr(t('Réinitialiser les réglages', 'Reset settings'))}
        </Button>
      </div>

      <Sheet
        open={confirming}
        onClose={() => {
          setConfirming(false);
        }}
        label={tr(t('Réinitialiser les réglages', 'Reset settings'))}
      >
        <div className="set-confirm">
          <h3>{tr(t('Réinitialiser les réglages ?', 'Reset settings?'))}</h3>
          <p>
            {tr(
              t(
                'Tes préférences reviennent à leurs valeurs d’origine. Ta progression, tes œuvres et tes succès ne sont pas touchés.',
                'Your preferences go back to their defaults. Your progress, artworks and achievements are untouched.',
              ),
            )}
          </p>
          <div className="set-confirm__actions">
            <Button
              variant="text"
              onClick={() => {
                setConfirming(false);
              }}
            >
              {tr(t('Annuler', 'Cancel'))}
            </Button>
            <Button
              variant="filled"
              onClick={() => {
                useSettings.getState().reset();
                setConfirming(false);
              }}
            >
              {tr(t('Réinitialiser', 'Reset'))}
            </Button>
          </div>
        </div>
      </Sheet>
    </Screen>
  );
}
