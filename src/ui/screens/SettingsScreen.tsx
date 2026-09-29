import { useNav } from '@/store/nav';
import { EmptyState, Screen } from '@/ui/kit';

/** Écran provisoire : remplacé par sa version complète. */
export default function SettingsScreen() {
  const pop = useNav((s) => s.pop);
  return (
    <Screen title="Settings" onBack={pop}>
      <EmptyState title="Settings" />
    </Screen>
  );
}
