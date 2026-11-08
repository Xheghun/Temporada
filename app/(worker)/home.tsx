import { useCapture } from '@/features/capture';
import { Redirect, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthSnapshot } from '@/core/auth/auth-provider';
import {
  useDocuments,
  documentViews,
  documentPresentationFacts,
  submissionStatusKey,
} from '@/features/documents';
import {
  useAssignment,
  HomeContent,
  nextWorkerAction,
} from '@/features/assignment';
import { PrimaryNavigation } from '@/design-system/components/primary-navigation';
export default function Home() {
  const identity = useAuthSnapshot();
  const { state, service } = useAssignment();
  const documents = useDocuments();
  const capture = useCapture();
  const { t: translate, i18n } = useTranslation();
  if (!service.isEnabled()) return <Redirect href="/(worker)/identity" />;
  // Project both features from the same worker-scoped atomic cache read.
  const rows = state.data ? documentViews(state.data) : [];
  const documentsEnabled = documents.service.isEnabled();
  return (
    <HomeContent
      state={state}
      workerName={identity.selectedWorker?.displayName ?? ''}
      nextAction={
        state.data
          ? nextWorkerAction(
              state.data,
              documentPresentationFacts(rows),
              documentsEnabled,
              capture.service.isEnabled(),
            )
          : 'refresh'
      }
      documentRows={rows.map((document) => ({
        title: document.label[i18n.resolvedLanguage === 'es' ? 'es' : 'en'],
        status: translate(submissionStatusKey(document.current)),
      }))}
      onDocuments={
        documentsEnabled
          ? () => router.replace('/(worker)/documents')
          : undefined
      }
      onTerms={() => router.push('/(worker)/terms')}
      onJob={() => router.replace('/(worker)/job')}
      onProfile={() => router.push('/(worker)/identity')}
      onRefresh={() => {
        void service.refresh();
      }}
      footer={
        <PrimaryNavigation
          selected="home"
          documentsEnabled={documentsEnabled}
        />
      }
    />
  );
}
