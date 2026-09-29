import { useNav } from '@/store/nav';
import { EmptyState, Screen } from '@/ui/kit';

/** Écran provisoire : remplacé par sa version complète. */
export default function AchievementsScreen() {
  const pop = useNav((s) => s.pop);
  return (
    <Screen title="Achievements" onBack={pop}>
      <EmptyState title="Achievements" />
    </Screen>
  );
}
