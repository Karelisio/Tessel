import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications';
import { nextEvent } from '@/content/events';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { useMetaStore } from '@/store/meta';
import { useSettings } from '@/store/settings';

const CHANNEL = 'tessel-doux';
const IDS = { daily: 101, streak: 102, event: 103 } as const;

/** Notifications locales facultatives : œuvre du jour, série en cours, événement saisonnier. */
async function schedule(): Promise<void> {
  await LocalNotifications.cancel({ notifications: Object.values(IDS).map((id) => ({ id })) });
  if (!useSettings.getState().notifications) return;
  const perm = await LocalNotifications.checkPermissions();
  if (perm.display !== 'granted') return;
  await LocalNotifications.createChannel({
    id: CHANNEL,
    name: tr(t('Rappels doux', 'Gentle reminders')),
    importance: 3,
    visibility: 1,
  }).catch(() => undefined);
  const list: LocalNotificationSchema[] = [];
  // chaque matin : l'œuvre du jour
  list.push({
    id: IDS.daily,
    channelId: CHANNEL,
    title: tr(t('Ton œuvre du jour t’attend', 'Your daily artwork is waiting')),
    body: tr(t('Un petit moment de couleurs, tout en douceur.', 'A little moment of colour, nice and slow.')),
    schedule: { on: { hour: 9, minute: 7 }, allowWhileIdle: true },
  });
  // en fin de journée, si la série n'est pas encore validée aujourd'hui
  const snap = useMetaStore.getState().snap;
  const evening = new Date();
  evening.setHours(19, 33, 0, 0);
  if (
    snap &&
    snap.streak.current > 0 &&
    snap.streak.status !== 'done' &&
    evening.getTime() > Date.now() + 60_000
  ) {
    const n = snap.streak.current;
    list.push({
      id: IDS.streak,
      channelId: CHANNEL,
      title: tr(t(`Ta série de ${n} jours continue ?`, `Keep your ${n}-day streak?`)),
      body: tr(t('Quelques cases suffisent pour la garder.', 'A few cells are enough to keep it.')),
      schedule: { at: evening, allowWhileIdle: true },
    });
  }
  // début du prochain événement saisonnier
  if (snap) {
    const next = nextEvent(snap.day);
    if (next.inDays > 0 && next.inDays <= 60) {
      const at = new Date();
      at.setDate(at.getDate() + next.inDays);
      at.setHours(10, 3, 0, 0);
      list.push({
        id: IDS.event,
        channelId: CHANNEL,
        title: tr(t(`${tr(next.event.name)} commence !`, `${tr(next.event.name)} begins!`)),
        body: tr(t('De nouvelles œuvres de saison sont arrivées.', 'New seasonal artworks have arrived.')),
        schedule: { at, allowWhileIdle: true },
      });
    }
  }
  await LocalNotifications.schedule({ notifications: list });
}

function resync(): void {
  void schedule().catch((e: unknown) => {
    console.error('Notifications non programmées', e);
  });
}

/** Demande l'autorisation quand le joueur active les notifications ; les désactive si refusée. */
async function onToggle(enabled: boolean): Promise<void> {
  if (enabled) {
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') {
      useSettings.getState().set({ notifications: false });
      return;
    }
  }
  resync();
}

/** Programme les rappels et les tient à jour (réglage, mise en arrière-plan). */
export function listenNotifications(): () => void {
  if (!Capacitor.isNativePlatform()) return () => undefined;
  resync();
  const offSettings = useSettings.subscribe((s, prev) => {
    if (s.notifications !== prev.notifications || s.locale !== prev.locale) void onToggle(s.notifications);
  });
  // la série peut avoir été validée entre-temps
  const bg = CapApp.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) resync();
  });
  return () => {
    offSettings();
    void bg.then((h) => h.remove());
  };
}
