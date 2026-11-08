import { Redirect, router } from 'expo-router';
import { useAssignment, TermsContent } from '@/features/assignment';

export default function Terms() {
  const { state, service } = useAssignment();
  if (!service.isEnabled()) return <Redirect href="/(worker)/identity" />;
  return (
    <TermsContent
      state={state}
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/(worker)/home');
      }}
      onConfirm={(version, generation, replacesActionId) => {
        void service.confirm(version, generation, replacesActionId);
      }}
      onRefresh={() => {
        void service.refresh();
      }}
      onHome={() => router.replace('/(worker)/home')}
    />
  );
}
