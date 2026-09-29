import { useMetaStore } from '@/store/meta';

/** Remplace une quête par une autre, puis rafraîchit l'interface. */
export function useReroll() {
  const service = useMetaStore((s) => s.service);
  const refresh = useMetaStore((s) => s.refresh);
  return (id: string) => {
    service?.rerollQuest(id);
    refresh();
  };
}
