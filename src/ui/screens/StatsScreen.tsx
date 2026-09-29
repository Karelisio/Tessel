import { useNav } from '@/store/nav';
import { EmptyState, Screen } from '@/ui/kit';

/** Écran provisoire : remplacé par sa version complète. */
export default function StatsScreen() {
  const pop = useNav((s) => s.pop);
  return (
    <Screen title="Stats" onBack={pop}>
      <EmptyState title="Stats" />
    </Screen>
  );
}
