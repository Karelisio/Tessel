import { useNav } from '@/store/nav';
import { EmptyState, Screen } from '@/ui/kit';

/** Écran provisoire : remplacé par sa version complète. */
export default function DailyScreen() {
  const pop = useNav((s) => s.pop);
  return (
    <Screen title="Daily" onBack={pop}>
      <EmptyState title="Daily" />
    </Screen>
  );
}
