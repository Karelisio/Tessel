import { useNav } from '@/store/nav';
import { EmptyState, Screen } from '@/ui/kit';

/** Écran provisoire : remplacé par sa version complète. */
export default function LibraryScreen() {
  const pop = useNav((s) => s.pop);
  return (
    <Screen title="Library" onBack={pop}>
      <EmptyState title="Library" />
    </Screen>
  );
}
