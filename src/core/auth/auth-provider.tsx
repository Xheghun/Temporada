import { useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import '../i18n';
import { createWorkerRuntime } from './runtime';
import type { WorkerRuntime } from './runtime';
import { CaptureContext } from '../../features/capture/hooks/use-capture';
import { DocumentsContext } from '../../features/documents/hooks/use-documents';
import { AssignmentContext } from '../../features/assignment/hooks/use-assignment';
import { AuthContext } from './auth-context';
export { useAuth, useAuthSnapshot } from './auth-context';
export function AuthProvider({ children }: PropsWithChildren) {
  const { t: translate } = useTranslation();
  const [state, setState] = useState<
    | { kind: 'loading' | 'disabled' }
    | { kind: 'error'; message: 'runtimeError' | 'configurationError' }
    | { kind: 'ready'; runtime: WorkerRuntime }
  >({ kind: 'loading' });
  useEffect(() => {
    let active = true;
    let runtime: WorkerRuntime | null = null;
    void createWorkerRuntime().then(
      async (value) => {
        runtime = value;
        if (!active) {
          await value?.dispose();
          return;
        }
        setState(
          value ? { kind: 'ready', runtime: value } : { kind: 'disabled' },
        );
      },
      (error: unknown) => {
        if (active)
          setState({
            kind: 'error',
            message:
              error instanceof Error &&
              error.message === 'api_configuration_missing'
                ? 'configurationError'
                : 'runtimeError',
          });
      },
    );
    return () => {
      active = false;
      void runtime?.dispose();
    };
  }, []);
  if (state.kind === 'ready')
    return (
      <AuthContext.Provider value={state.runtime.auth}>
        <AssignmentContext.Provider value={state.runtime.assignment}>
          <DocumentsContext.Provider value={state.runtime.documents}>
            <CaptureContext.Provider value={state.runtime.capture}>
              {children}
            </CaptureContext.Provider>
          </DocumentsContext.Provider>
        </AssignmentContext.Provider>
      </AuthContext.Provider>
    );
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
      {state.kind === 'loading' ? (
        <ActivityIndicator accessibilityLabel={translate('loading')} />
      ) : null}
      <Text selectable>
        {translate(
          state.kind === 'loading'
            ? 'loading'
            : state.kind === 'disabled'
              ? 'unavailable'
              : state.kind === 'error'
                ? state.message
                : 'runtimeError',
        )}
      </Text>
    </View>
  );
}
