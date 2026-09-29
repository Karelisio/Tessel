import type { ReactNode } from 'react';
import { EmptyState, Screen } from '@/ui/kit';

/** Écran en attente de sa version complète (galerie : étape 9, création : étape 10). */
export function PlaceholderScreen({ title, icon, text }: { title: string; icon: ReactNode; text: string }) {
  return (
    <Screen title={title}>
      <EmptyState icon={icon} title={title} text={text} />
    </Screen>
  );
}
