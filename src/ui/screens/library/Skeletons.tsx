import { Skeleton } from '@/ui/kit';

/** Squelettes de l'écran pendant le chargement de la bibliothèque. */
export function LibrarySkeleton() {
  return (
    <div className="lib-skel" aria-busy="true">
      <Skeleton height={190} radius={24} />
      <div className="lib-skel__chips">
        <Skeleton width="100%" height={48} radius={16} />
      </div>
      <div className="lib-skel__chips">
        {[64, 92, 84, 100, 78].map((w, i) => (
          <Skeleton key={i} width={w} height={36} radius={12} />
        ))}
      </div>
      <div className="lib-grid">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} height={220} radius={20} />
        ))}
      </div>
    </div>
  );
}

export function HeroSkeleton() {
  return <Skeleton height={190} radius={24} />;
}
