import { useNav } from '@/store/nav';
import { EmptyState, Screen } from '@/ui/kit';

/** Écran provisoire : remplacé par sa version complète. */
export default function ProfileScreen() {
  const pop = useNav((s) => s.pop);
  return (
    <Screen title="Profile" onBack={pop}>
      <EmptyState title="Profile" />
    </Screen>
  );
}
