import { create } from 'zustand';
import type { LevelInfo } from '@/meta/levels';
import type { ModeId } from '@/modes/types';
import type { MetaNotice, MetaService } from '@/meta/MetaService';
import type { Quest } from '@/meta/quests';
import type { ChestSize, ToolId } from '@/meta/rewards';
import type { StreakStatus } from '@/meta/streak';
import { daysBetween, nextWeekStart } from '@/meta/time';

export interface MetaSnapshot {
  level: LevelInfo;
  /** Modes débloqués. */
  modes: ModeId[];
  /** Catégories débloquées. */
  categories: string[];
  tools: Record<ToolId, number>;
  chests: Record<ChestSize, number>;
  freezes: number;
  streak: { current: number; best: number; status: StreakStatus; todayCells: number };
  quests: Quest[];
  canReroll: boolean;
  achievements: number;
  unseen: number;
  /** Jour courant de la méta-progression. */
  day: string;
  /** Jours restants avant les nouvelles quêtes de la semaine. */
  weekDaysLeft: number;
}

export interface Toast {
  id: number;
  notice: MetaNotice;
}

interface MetaState {
  service: MetaService | null;
  snap: MetaSnapshot | null;
  toasts: Toast[];
  attach: (service: MetaService) => () => void;
  refresh: () => void;
  dismiss: (id: number) => void;
}

function snapshot(m: MetaService): MetaSnapshot {
  return {
    level: m.levelInfo,
    modes: m.unlockedModes,
    categories: m.unlockedCategories,
    tools: { loupe: m.tools('loupe'), bucket: m.tools('bucket'), wand: m.tools('wand') },
    chests: { small: m.chests('small'), medium: m.chests('medium'), large: m.chests('large') },
    freezes: m.freezes,
    streak: m.streak,
    quests: m.quests().map((q) => ({ ...q })),
    canReroll: m.canReroll,
    achievements: m.achievementCount,
    unseen: m.unseen().length,
    day: m.day,
    weekDaysLeft: daysBetween(m.day, nextWeekStart(m.day)),
  };
}

let nextToast = 1;
/** Au-delà, les plus anciens toasts cèdent la place. */
const MAX_TOASTS = 4;

/** Reflet de la méta-progression pour l'interface (mis à jour au plus ~7 fois par seconde). */
export const useMetaStore = create<MetaState>((set, get) => ({
  service: null,
  snap: null,
  toasts: [],
  attach: (service) => {
    set({ service, snap: snapshot(service) });
    const offChange = service.subscribe(() => {
      set({ snap: snapshot(service) });
    });
    const offNotice = service.onNotice((notice) => {
      // une journée validée sans rien de particulier n'a pas besoin d'un toast
      if (notice.type === 'streak' && notice.update.milestone === null && notice.update.freezesUsed === 0)
        if (!notice.update.broken && notice.update.state.current !== 1) return;
      set((s) => ({ toasts: [...s.toasts, { id: nextToast++, notice }].slice(-MAX_TOASTS) }));
    });
    return () => {
      offChange();
      offNotice();
      if (get().service === service) set({ service: null, snap: null });
    };
  },
  refresh: () => {
    const { service } = get();
    if (service) set({ snap: snapshot(service) });
  },
  dismiss: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));
