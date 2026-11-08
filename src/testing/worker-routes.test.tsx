import { fireEvent, render, screen } from '@testing-library/react-native';
import Home from '../../app/(worker)/home';
import Job from '../../app/(worker)/job';
import Documents from '../../app/(worker)/documents';
import Capture from '../../app/(worker)/capture';
import i18n from '../core/i18n';
import { assignmentFixture } from './persistence-fixtures';
import type { AssignmentState } from '../features/assignment/assignment-service';
const mockReplace = jest.fn(),
  mockPush = jest.fn(),
  mockBack = jest.fn(),
  mockRedirect = jest.fn();
let mockCanGoBack = true;
let mockHomeEnabled = true,
  mockDocumentsEnabled = true,
  mockCaptureEnabled = true;
let mockState: AssignmentState;
jest.mock('expo-router', () => ({
  router: {
    replace: (path: string) => mockReplace(path),
    push: (path: string) => mockPush(path),
    back: () => mockBack(),
    canGoBack: () => mockCanGoBack,
  },
  Redirect: (props: unknown) => {
    mockRedirect(props);
    return null;
  },
  useLocalSearchParams: () => ({
    documentType: 'passport',
    workerId: 'ana',
    generation: '1',
    expectedSubmissionId: '',
  }),
}));
jest.mock('@/core/auth/auth-provider', () => ({
  useAuthSnapshot: () => ({
    selectedWorker: { workerId: 'ana', displayName: 'Ana López' },
    generation: 1,
  }),
}));
jest.mock('@/features/assignment', () => ({
  ...jest.requireActual('@/features/assignment'),
  useAssignment: () => ({
    state: mockState,
    service: { isEnabled: () => mockHomeEnabled, refresh: jest.fn() },
  }),
}));
jest.mock('@/features/documents', () => ({
  ...jest.requireActual('@/features/documents'),
  useDocuments: () => ({
    state: mockState,
    service: { isEnabled: () => mockDocumentsEnabled, refresh: jest.fn() },
  }),
}));
jest.mock('@/features/capture', () => ({
  ...jest.requireActual('@/features/capture'),
  useCapture: () => ({
    state: { phase: 'idle', preview: null, selection: null, error: null },
    service: {
      isEnabled: () => mockCaptureEnabled,
      open: jest.fn(),
      close: jest.fn(),
      choose: jest.fn(),
      save: jest.fn(),
      settingsFailed: jest.fn(),
    },
  }),
}));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
beforeEach(async () => {
  await i18n.changeLanguage('en');
  mockHomeEnabled = true;
  mockDocumentsEnabled = true;
  mockCaptureEnabled = true;
  mockCanGoBack = true;
  mockReplace.mockClear();
  mockPush.mockClear();
  mockBack.mockClear();
  mockRedirect.mockClear();
  mockState = {
    workerId: 'ana',
    generation: 1,
    loading: false,
    saving: false,
    refreshing: false,
    online: false,
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
});
test('Home uses actual worker and cached state, pushing secondary terms and profile', async () => {
  await render(<Home />);
  expect(screen.getByText('Hello, Ana López')).toBeTruthy();
  await fireEvent.press(
    screen.getByRole('button', { name: i18n.t('ui.reviewTerms') }),
  );
  expect(mockPush).toHaveBeenLastCalledWith('/(worker)/terms');
  await fireEvent.press(
    screen.getByRole('button', { name: i18n.t('ui.profile') }),
  );
  expect(mockPush).toHaveBeenLastCalledWith('/(worker)/identity');
});
test('disabled feature deep links redirect rather than show functioning destinations', async () => {
  mockHomeEnabled = false;
  let view = await render(<Home />);
  expect(mockRedirect).toHaveBeenLastCalledWith({ href: '/(worker)/identity' });
  await view.unmount();
  view = await render(<Job />);
  expect(mockRedirect).toHaveBeenLastCalledWith({ href: '/(worker)/identity' });
  await view.unmount();
  mockDocumentsEnabled = false;
  view = await render(<Documents />);
  expect(mockRedirect).toHaveBeenLastCalledWith({ href: '/(worker)/home' });
  await view.unmount();
  mockCaptureEnabled = false;
  await render(<Capture />);
  expect(mockRedirect).toHaveBeenLastCalledWith({
    href: '/(worker)/documents',
  });
});
test('capture returns contextually, with a safe Documents fallback for a deep link', async () => {
  const view = await render(<Capture />);
  await fireEvent.press(
    screen.getByRole('button', { name: i18n.t('capture.back') }),
  );
  expect(mockBack).toHaveBeenCalledTimes(1);
  mockCanGoBack = false;
  await fireEvent.press(
    screen.getByRole('button', { name: i18n.t('capture.back') }),
  );
  expect(mockReplace).toHaveBeenCalledWith('/(worker)/documents');
  await view.unmount();
});
test('Home with missing cached assignment never invents fixture rows or a completed state', async () => {
  mockState.data = null;
  await render(<Home />);
  expect(screen.queryByText('Valle Verde Farms')).toBeNull();
  expect(screen.queryByText(i18n.t('ui.next.complete'))).toBeNull();
  expect(screen.getByText(i18n.t('home.noOfflineData'))).toBeTruthy();
});
