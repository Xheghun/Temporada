import { router } from 'expo-router';
import { BottomNavigation } from './worker-controls';
export function PrimaryNavigation({
  selected,
  documentsEnabled,
}: {
  selected: 'home' | 'documents' | 'job';
  documentsEnabled: boolean;
}) {
  return (
    <BottomNavigation
      selected={selected}
      documentsEnabled={documentsEnabled}
      onNavigate={(destination) =>
        router.replace(
          destination === 'home'
            ? '/(worker)/home'
            : destination === 'documents'
              ? '/(worker)/documents'
              : '/(worker)/job',
        )
      }
    />
  );
}
