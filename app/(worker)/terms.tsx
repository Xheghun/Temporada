import { Redirect, router } from 'expo-router';
import { useAssignment, TermsContent } from '@/features/assignment';

export default function Terms() {
  const { state, service } = useAssignment();
  if (!service.isEnabled()) return <Redirect href="/(worker)/identity" />;
  return (
    <TermsContent
      state={state}
      onConfirm={(version, generation) => {
        void service.confirm(version, generation);
      }}
      onRefresh={() => {
        void service.refresh();
      }}
      onHome={() => router.replace('/(worker)/home')}
    />
  );
}
