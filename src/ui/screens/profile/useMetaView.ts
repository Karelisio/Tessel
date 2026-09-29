import type { MetaService } from '@/meta/MetaService';
import type { Metric } from '@/meta/metrics';
import { useMetaStore, type MetaSnapshot } from '@/store/meta';
import { metricValue } from './format';

export interface MetaView {
  service: MetaService;
  snap: MetaSnapshot;
  xp: number;
  stat: (metric: Metric) => number;
}

/** Méta-progression prête à lire (null pendant le chargement) ; se met à jour avec chaque instantané. */
export function useMetaView(): MetaView | null {
  const service = useMetaStore((s) => s.service);
  const snap = useMetaStore((s) => s.snap);
  if (!service || !snap) return null;
  return {
    service,
    snap,
    xp: service.xp,
    stat: (metric) => metricValue(service, snap, metric),
  };
}
