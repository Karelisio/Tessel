import { useNav } from '@/store/nav';
import { EmptyState, Screen } from '@/ui/kit';

/** Écran provisoire : remplacé par sa version complète. */
export default function CollectionsScreen() {
  const pop = useNav((s) => s.pop);
  return (
    <Screen title="Collections" onBack={pop}>
      <EmptyState title="Collections" />
    </Screen>
  );
}
