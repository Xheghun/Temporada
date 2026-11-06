import { Redirect, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth, useAuthSnapshot } from '@/core/auth/auth-provider';
import { useAssignment, HomeContent } from '@/features/assignment';

export default function Home() {
  const auth = useAuth(),
    identity = useAuthSnapshot(),
    { state, service } = useAssignment(),
    { i18n } = useTranslation();
  if (!service.isEnabled()) return <Redirect href="/(worker)/identity" />;
  return (
    <HomeContent
      state={state}
      workerName={identity.selectedWorker?.displayName ?? ''}
      shared={identity.workers.length > 1}
      onTerms={() => router.push('/(worker)/terms')}
      onRefresh={() => {
        void service.refresh();
      }}
      onLanguage={() => {
        void service.setLanguage(i18n.resolvedLanguage === 'en' ? 'es' : 'en');
      }}
      onSwitch={() => {
        void auth.perform(() => auth.switchWorker());
      }}
      onLogout={() => {
        void auth.perform(() => auth.logout());
      }}
    />
  );
}
