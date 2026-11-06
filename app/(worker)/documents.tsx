import { Redirect, router } from 'expo-router';
import { useCapture } from '@/features/capture';
import { useDocuments, DocumentsContent } from '@/features/documents';
export default function Documents() {
  const { state, service } = useDocuments();
  const capture = useCapture();
  if (!service.isEnabled()) return <Redirect href="/(worker)/home" />;
  return (
    <DocumentsContent
      state={state}
      onCapture={
        capture.service.isEnabled()
          ? (documentType, expectedSubmissionId) => {
              if (state.workerId && state.generation !== null)
                router.push({
                  pathname: '/(worker)/capture',
                  params: {
                    documentType,
                    workerId: state.workerId,
                    generation: String(state.generation),
                    expectedSubmissionId: expectedSubmissionId ?? '',
                  },
                });
            }
          : undefined
      }
      onRefresh={() => {
        void service.refresh();
      }}
      onHome={() => router.replace('/(worker)/home')}
    />
  );
}
