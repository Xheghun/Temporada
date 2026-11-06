import { createContext, useContext, useSyncExternalStore } from 'react';
import type { AssignmentService } from '../assignment-service';
import { useAuthSnapshot } from '../../../core/auth/auth-context';
export const AssignmentContext = createContext<AssignmentService | null>(null);
export function useAssignment() {
  const service = useContext(AssignmentContext);
  if (!service) throw new Error('assignment_provider_missing');
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
