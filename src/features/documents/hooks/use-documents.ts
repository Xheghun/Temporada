import { createContext, useContext, useSyncExternalStore } from 'react';
import type { DocumentsService } from '../documents-service';
import { useAuthSnapshot } from '../../../core/auth/auth-context';
export const DocumentsContext = createContext<DocumentsService | null>(null);
export function useDocuments() {
  const service = useContext(DocumentsContext);
  if (!service) throw new Error('documents_provider_missing');
  const state = useSyncExternalStore(
    service.subscribe,
    service.getSnapshot,
    service.getSnapshot,
  );
  const auth = useAuthSnapshot();
  return {
    service,
    state:
      state.workerId === auth.selectedWorker?.workerId &&
      state.generation === auth.generation
        ? state
        : { ...state, data: null, loading: true, savedActionId: null },
  };
}
