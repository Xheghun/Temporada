import { Redirect, router } from 'expo-router';
import { useDocuments, DocumentsContent } from '@/features/documents';
export default function Documents() {
  const { state, service } = useDocuments();
  if (!service.isEnabled()) return <Redirect href="/(worker)/home" />;
  return (
    <DocumentsContent
      state={state}
      onRefresh={() => {
        void service.refresh();
      }}
      onHome={() => router.replace('/(worker)/home')}
    />
  );
}
