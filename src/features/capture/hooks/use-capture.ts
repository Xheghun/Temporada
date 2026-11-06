import { createContext, useContext, useSyncExternalStore } from 'react';
import type { CaptureService } from '../capture-service';
import { useAuthSnapshot } from '../../../core/auth/auth-context';
export const CaptureContext = createContext<CaptureService | null>(null);
export function useCapture() {
  const service = useContext(CaptureContext);
  if (!service) throw new Error('capture_provider_missing');
  const state = useSyncExternalStore(
    service.subscribe,
    service.getSnapshot,
    service.getSnapshot,
  );
  const auth = useAuthSnapshot();
  return {
    service,
    state:
      state.selection !== null &&
      state.selection.workerId === auth.selectedWorker?.workerId &&
      state.selection.generation === auth.generation
        ? state
        : { ...state, selection: null, preview: null, savedActionId: null },
  };
}
