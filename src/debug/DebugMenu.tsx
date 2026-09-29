import { Preferences } from '@capacitor/preferences';
import { useState } from 'react';
import { debugClock, DEBUG_OFFSET_KEY, getServices } from '@/app/services';
import { TRANSPARENT } from '@/content/grid';
import { ACHIEVEMENTS } from '@/meta/achievements.data';
import { CATALOG } from '@/meta/catalog';
import { reward, type Reward } from '@/meta/rewards';
import { useMetaStore } from '@/store/meta';
import { useSettings } from '@/store/settings';
import { APP_CONFIG } from '@/config/app';
import { Button, Sheet } from '@/ui/kit';
import { useDebug } from './debugTap';
import './debug.css';

/**
 * Menu de debug caché (7 appuis rapides sur l'onglet Profil) : compléter l'œuvre, forcer la date,
 * ajouter de l'XP et des outils, rejouer les animations clés. Textes non traduits (outil interne).
 */
const DAY = 86_400_000;

async function shiftDays(days: number | null): Promise<void> {
  debugClock.offsetMs = days === null ? 0 : debugClock.offsetMs + days * DAY;
  await Preferences.set({ key: DEBUG_OFFSET_KEY, value: String(debugClock.offsetMs) });
  const { meta } = await getServices();
  meta.refresh();
  useMetaStore.getState().refresh();
}

async function grant(rewards: Reward[]): Promise<void> {
  const { meta } = await getServices();
  meta.debugGrant(rewards);
  useMetaStore.getState().refresh();
}

/** Remplit l'œuvre en cours sauf une case, puis pose la dernière : fin d'œuvre normale (XP, succès…). */
function completeArtwork(): boolean {
  const game = window.__tessel?.game;
  if (!game || game.phase !== 'playing') return false;
  let last = -1;
  for (let i = game.grid.cells.length - 1; i >= 0; i--) {
    if (game.grid.cells[i] !== TRANSPARENT && !game.progress.filled.get(i)) {
      last = i;
      break;
    }
  }
  if (last < 0) return false;
  game.debugFillExcept([last]);
  game.placeIndex(last);
  return true;
}

function replayLevelUp(): void {
  const level = useMetaStore.getState().snap?.level.level ?? 5;
  useMetaStore.getState().celebrate({
    from: Math.max(1, level - 1),
    level,
    rewards: [reward.unlock('frame:or'), reward.tool('wand', 2), reward.xp(500)],
  });
}

function replayAchievement(): void {
  const def = ACHIEVEMENTS[Math.floor(Math.random() * ACHIEVEMENTS.length)];
  if (def) useMetaStore.getState().push({ type: 'achievement', def, rewards: [reward.xp(200)] });
}

export function DebugMenu() {
  const open = useDebug((s) => s.open);
  const snap = useMetaStore((s) => s.snap);
  const [note, setNote] = useState('');
  const close = () => {
    useDebug.getState().set(false);
  };
  const run = (label: string, action: () => unknown) => {
    void Promise.resolve(action()).then(
      () => {
        setNote(`✓ ${label}`);
      },
      (e: unknown) => {
        setNote(`✗ ${label} : ${String(e)}`);
      },
    );
  };
  const offsetDays = Math.round(debugClock.offsetMs / DAY);
  return (
    <Sheet open={open} onClose={close} label="Debug">
      <div className="dbg">
        <h3>Debug</h3>
        <p className="dbg__info">
          v{APP_CONFIG.version} · jour {snap?.day ?? '…'}{' '}
          {offsetDays !== 0 && `(décalage ${String(offsetDays)} j)`} · niveau {snap?.level.level ?? '…'}
        </p>
        {note && <p className="dbg__note">{note}</p>}
        <h4>Date</h4>
        <div className="dbg__row">
          {[-1, 1, 7, 30].map((d) => (
            <Button
              key={d}
              variant="tonal"
              onClick={() => {
                run(`${d > 0 ? '+' : ''}${String(d)} j`, () => shiftDays(d));
              }}
            >
              {d > 0 ? '+' : ''}
              {d} j
            </Button>
          ))}
          <Button
            variant="text"
            onClick={() => {
              run('date réelle', () => shiftDays(null));
            }}
          >
            Réelle
          </Button>
        </div>
        <h4>Progression</h4>
        <div className="dbg__row">
          <Button
            variant="tonal"
            onClick={() => {
              run('+1 000 XP', () => grant([reward.xp(1000)]));
            }}
          >
            +1 000 XP
          </Button>
          <Button
            variant="tonal"
            onClick={() => {
              run('+20 000 XP', () => grant([reward.xp(20000)]));
            }}
          >
            +20 000 XP
          </Button>
          <Button
            variant="tonal"
            onClick={() => {
              run('+5 outils', () =>
                grant([reward.tool('loupe', 5), reward.tool('bucket', 5), reward.tool('wand', 5)]),
              );
            }}
          >
            +5 outils
          </Button>
          <Button
            variant="tonal"
            onClick={() => {
              run('+coffres', () =>
                grant([
                  { kind: 'chest', size: 'small', count: 1 },
                  { kind: 'chest', size: 'medium', count: 1 },
                  { kind: 'chest', size: 'large', count: 1 },
                ]),
              );
            }}
          >
            +3 coffres
          </Button>
          <Button
            variant="tonal"
            onClick={() => {
              run('+1 joker', () => grant([reward.freeze(1)]));
            }}
          >
            +1 joker
          </Button>
          <Button
            variant="tonal"
            onClick={() => {
              run('tout débloqué', () => grant(CATALOG.map((i) => reward.unlock(i.key))));
            }}
          >
            Tout débloquer
          </Button>
        </div>
        <h4>Œuvre</h4>
        <div className="dbg__row">
          <Button
            variant="filled"
            onClick={() => {
              run('œuvre complétée', () => {
                if (!completeArtwork()) throw new Error('aucune œuvre en cours');
                close();
              });
            }}
          >
            Compléter l’œuvre en cours
          </Button>
        </div>
        <h4>Rejouer</h4>
        <div className="dbg__row">
          <Button
            variant="tonal"
            onClick={() => {
              close();
              replayLevelUp();
            }}
          >
            Montée de niveau
          </Button>
          <Button
            variant="tonal"
            onClick={() => {
              run('succès', replayAchievement);
            }}
          >
            Succès
          </Button>
          <Button
            variant="tonal"
            onClick={() => {
              run('coffre', () => grant([{ kind: 'chest', size: 'large', count: 1 }]));
            }}
          >
            Coffre (onglet Du jour)
          </Button>
          <Button
            variant="tonal"
            onClick={() => {
              const game = window.__tessel?.game;
              if (game?.phase === 'finished') {
                close();
                game.playTimelapse();
              } else setNote('✗ termine d’abord une œuvre');
            }}
          >
            Timelapse
          </Button>
          <Button
            variant="tonal"
            onClick={() => {
              close();
              useSettings.getState().set({ onboarded: false });
            }}
          >
            Introduction
          </Button>
          <Button
            variant="tonal"
            onClick={() => {
              location.reload();
            }}
          >
            Démarrage
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
