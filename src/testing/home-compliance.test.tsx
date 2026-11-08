import { useSyncExternalStore } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import i18n from '../core/i18n';
import {
  AssignmentService,
  type AssignmentState,
} from '../features/assignment/assignment-service';
import { HomeContent } from '../features/assignment/components/worker-content';
import { homeOverview } from '../features/assignment/domain/home-overview';
import {
  documentViews,
  documentPresentationFacts,
} from '../features/documents/domain/document-view';
import type {
  DeliveryStatus,
  OutboxAction,
  WorkerViewData,
} from '../core/offline/domain/types';
import type { SyncSession } from '../core/sync/types';
import { assignmentFixture } from './persistence-fixtures';
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
function cachedState(): AssignmentState {
  return {
    workerId: 'ana',
    generation: 1,
    online: false,
    loading: false,
    saving: false,
    refreshing: false,
    error: null,
    savedActionId: null,
    data: {
      assignment: assignmentFixture('ana'),
      actions: [],
      cachedAt: 1,
      refreshNeeded: false,
      refreshError: null,
    },
  };
}
function confirmation(status: DeliveryStatus): OutboxAction {
  return {
    id: 'stable-action',
    clientActionId: 'stable-action',
    workerId: 'ana',
    sequence: 1,
    actionType: 'terms_acceptance',
    payload: {
      kind: 'terms_acceptance',
      workerId: 'ana',
      clientActionId: 'stable-action',
      termsVersionId: 'v2',
    },
    status,
    fileUri: null,
    attemptCount: 1,
    nextAttemptAt: 100,
    lastErrorCode: status === 'retry_wait' ? 'server_error' : null,
    createdAt: 1,
    updatedAt: 1,
  };
}
function home(state: AssignmentState, documentsEnabled = true) {
  return (
    <HomeContent
      state={state}
      workerName={state.data?.assignment?.worker.displayName ?? ''}
      overview={homeOverview(
        state.error === 'local_data_error' ? null : state.data,
        documentsEnabled && state.data
          ? documentPresentationFacts(documentViews(state.data))
          : null,
      )}
      onTerms={() => {}}
      onRefresh={() => {}}
    />
  );
}
beforeEach(async () => {
  await i18n.changeLanguage('en');
});
test.each(['en', 'es'])(
  'all required Home facts appear directly in %s offline and during failed refresh',
  async (language) => {
    await i18n.changeLanguage(language);
    const state = cachedState();
    state.data!.refreshNeeded = true;
    state.data!.refreshError = 'server_error';
    const view = await render(home(state));
    expect(screen.getByText('Valle Verde Farms')).toBeTruthy();
    expect(screen.getByText('Yuma, Arizona')).toBeTruthy();
    expect(
      screen.getByText(i18n.t('home.order', { id: 'JO-2026-0142' })),
    ).toBeTruthy();
    expect(screen.getByText(/2026.*2026/)).toBeTruthy();
    expect(
      screen.getByText(i18n.t('terms.version', { version: 'v2' })),
    ).toBeTruthy();
    expect(
      screen.getByText(
        state.data!.assignment!.terms.summary[language === 'es' ? 'es' : 'en'],
      ),
    ).toBeTruthy();
    expect(screen.getAllByText(i18n.t('terms.status.unconfirmed')).length).toBe(
      2,
    );
    expect(screen.getByText(i18n.t('home.timeline'))).toBeTruthy();
    expect(screen.getByText(i18n.t('home.deliveryTitle'))).toBeTruthy();
    expect(screen.getByText(i18n.t('home.reviewTitle'))).toBeTruthy();
    expect(screen.getByText(i18n.t('home.refreshFailed'))).toBeTruthy();
    expect(screen.getByText(i18n.t('home.pending', { count: 0 }))).toBeTruthy();
    expect(screen.getByText(i18n.t('home.offline'))).toBeTruthy();
    state.online = true;
    await view.rerender(home(state));
    expect(screen.getByText(i18n.t('home.online'))).toBeTruthy();
    expect(screen.getByText(i18n.t('home.pending', { count: 0 }))).toBeTruthy();
  },
);
test('unknown queue, disabled progress and a known empty catalog never fabricate completion', async () => {
  const state = cachedState();
  state.data = null;
  state.loading = true;
  const view = await render(home(state));
  expect(screen.getByText(i18n.t('home.queueLoading'))).toBeTruthy();
  expect(screen.queryByText(i18n.t('home.pending', { count: 0 }))).toBeNull();
  state.loading = false;
  state.error = 'local_data_error';
  await view.rerender(home(state));
  expect(screen.getByText(i18n.t('home.queueUnavailable'))).toBeTruthy();
  expect(
    screen.getAllByText(i18n.t('errors.local_data_error')).length,
  ).toBeGreaterThan(0);
  const cached = cachedState();
  await view.rerender(home(cached, false));
  expect(screen.getAllByText(i18n.t('home.progressUnavailable')).length).toBe(
    2,
  );
  expect(screen.getByText(i18n.t('home.pending', { count: 0 }))).toBeTruthy();
  cached.data!.assignment!.requiredDocuments = [];
  await view.rerender(home(cached));
  expect(screen.getByText(i18n.t('home.noRequired'))).toBeTruthy();
  expect(screen.getByText(i18n.t('home.noReviewRequired'))).toBeTruthy();
});
test('network and persistent data events update mounted Home without re-entry; late old-worker reads cannot restore it', async () => {
  let data = cachedState().data!;
  let selected: SyncSession = {
    workerId: 'ana',
    generation: 1,
    token: 'fictional',
  };
  let online = false;
  const networkListeners = new Set<() => void>();
  const sessionListeners = new Set<() => void>();
  const dataListeners = new Set<(workerId: string) => void>();
  let delayedRead: Promise<WorkerViewData> | null = null;
  const service = new AssignmentService({
    enabled: () => true,
    session: {
      current: () => selected,
      invalidate: () => {},
      subscribeSession(callback) {
        sessionListeners.add(callback);
        return () => {
          sessionListeners.delete(callback);
        };
      },
    },
    repository: (workerId) => ({
      readView: async () =>
        workerId === 'ana'
          ? (delayedRead ?? data)
          : { ...data, assignment: assignmentFixture(workerId), actions: [] },
      enqueueTerms: async () => confirmation('queued'),
    }),
    online: () => online,
    subscribeNetwork(callback) {
      networkListeners.add(callback);
      return () => {
        networkListeners.delete(callback);
      };
    },
    subscribeData(callback) {
      dataListeners.add(callback);
      return () => {
        dataListeners.delete(callback);
      };
    },
    notifyEnqueued: () => {},
    refresh: async () => {},
    setLanguage: async () => {},
  });
  await service.reload();
  function LiveHome() {
    return home(useSyncExternalStore(service.subscribe, service.getSnapshot));
  }
  const view = await render(<LiveHome />);
  try {
    expect(screen.getByText(i18n.t('home.pending', { count: 0 }))).toBeTruthy();
    data = { ...data, actions: [confirmation('queued')] };
    await act(async () => {
      dataListeners.forEach((callback) => callback('ana'));
    });
    expect(screen.getByText(i18n.t('home.pending', { count: 1 }))).toBeTruthy();
    await act(async () => {
      online = true;
      networkListeners.forEach((callback) => callback());
    });
    expect(screen.getByText(i18n.t('home.online'))).toBeTruthy();
    expect(screen.getByText(i18n.t('home.pending', { count: 1 }))).toBeTruthy();
    data = { ...data, actions: [confirmation('retry_wait')] };
    await act(async () => {
      dataListeners.forEach((callback) => callback('ana'));
    });
    expect(screen.getByText(i18n.t('ui.retry'))).toBeTruthy();
    expect(screen.getByText(i18n.t('home.pending', { count: 1 }))).toBeTruthy();
    await act(async () => {
      online = false;
      networkListeners.forEach((callback) => callback());
    });
    expect(screen.getByText(i18n.t('home.offline'))).toBeTruthy();
    data = {
      ...data,
      assignment: {
        ...data.assignment!,
        terms: {
          ...data.assignment!.terms,
          serverAcceptanceStatus: 'accepted',
        },
      },
      actions: [confirmation('delivered')],
    };
    await act(async () => {
      dataListeners.forEach((callback) => callback('ana'));
    });
    expect(screen.getByText(i18n.t('home.pending', { count: 0 }))).toBeTruthy();
    expect(screen.getAllByText(i18n.t('terms.status.accepted')).length).toBe(2);
    let resolveOldRead!: (value: WorkerViewData) => void;
    delayedRead = new Promise((resolve) => {
      resolveOldRead = resolve;
    });
    let oldRead!: Promise<void>;
    await act(async () => {
      oldRead = service.reload();
    });
    await act(async () => {
      selected = { workerId: 'bruno', generation: 2, token: 'fictional' };
      sessionListeners.forEach((callback) => callback());
    });
    expect(screen.queryByText('Hello, Ana López')).toBeNull();
    expect(screen.getByText('Hello, Bruno Díaz')).toBeTruthy();
    await act(async () => {
      resolveOldRead(data);
      await oldRead;
    });
    expect(screen.getByText('Hello, Bruno Díaz')).toBeTruthy();
    expect(screen.queryByText('Hello, Ana López')).toBeNull();
  } finally {
    await view.unmount();
    service.dispose();
  }
});
test('refresh remains busy and terms/job links preserve callbacks', async () => {
  const state = cachedState();
  state.refreshing = true;
  const onRefresh = jest.fn(),
    onTerms = jest.fn(),
    onJob = jest.fn();
  await render(
    <HomeContent
      state={state}
      workerName="Ana López"
      onRefresh={onRefresh}
      onTerms={onTerms}
      onJob={onJob}
    />,
  );
  expect(
    screen.getByRole('button', { name: i18n.t('home.refresh') }),
  ).toBeDisabled();
  expect(
    screen.getByRole('button', { name: i18n.t('home.refresh') }),
  ).toHaveProp('accessibilityState', { disabled: true, busy: true });
  await fireEvent.press(
    screen.getByRole('button', { name: i18n.t('home.openTerms') }),
  );
  expect(onTerms).toHaveBeenCalledTimes(1);
  await fireEvent.press(
    screen.getByRole('button', { name: 'Valle Verde Farms' }),
  );
  expect(onJob).toHaveBeenCalledTimes(1);
  expect(onRefresh).not.toHaveBeenCalled();
});
