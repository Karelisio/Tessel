import { useNav } from '@/store/nav';
import { EmptyState, Screen } from '@/ui/kit';

/** Écran provisoire : remplacé par sa version complète. */
export default function QuestsScreen() {
  const pop = useNav((s) => s.pop);
  return (
    <Screen title="Quests" onBack={pop}>
      <EmptyState title="Quests" />
    </Screen>
  );
}
