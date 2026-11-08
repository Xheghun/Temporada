import { Redirect, router } from 'expo-router';
import { JobContent, useAssignment } from '@/features/assignment';
import { useDocuments } from '@/features/documents';
import { PrimaryNavigation } from '@/design-system/components/primary-navigation';
export default function Job() {
  const { state, service } = useAssignment();
  const documents = useDocuments();
  if (!service.isEnabled()) return <Redirect href="/(worker)/identity" />;
  return (
    <JobContent
      state={state}
      onTerms={() => router.push('/(worker)/terms')}
      onRefresh={() => {
        void service.refresh();
      }}
      footer={
        <PrimaryNavigation
          selected="job"
          documentsEnabled={documents.service.isEnabled()}
        />
      }
    />
  );
}
