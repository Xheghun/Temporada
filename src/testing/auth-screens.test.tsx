import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { AuthService, AuthError } from '../core/auth/auth-service';
import type { AuthApi, SessionVault } from '../core/auth/auth-service';
import i18n from '../core/i18n';
import SignIn from '../../app/(auth)/sign-in';
import Verify from '../../app/(auth)/verify';
import SelectWorker from '../../app/(auth)/select-worker';
import WorkerIdentity from '../../app/(worker)/identity';
import WorkerLayout from '../../app/(worker)/_layout';
let mockAuth: AuthService;
jest.mock('@/core/auth/auth-provider', () => ({
  useAuth: () => mockAuth,
  useAuthSnapshot: () => {
    const React = jest.requireActual<typeof import('react')>('react');
    return React.useSyncExternalStore(
      mockAuth.subscribe,
      mockAuth.getSnapshot,
      mockAuth.getSnapshot,
    );
  },
}));
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  Redirect: jest.fn(() => null),
  Slot: jest.fn(() => null),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
let api: AuthApi;
beforeEach(async () => {
  await i18n.changeLanguage('es');
  api = {
    requestOtp: jest.fn(async () => {}),
    verify: jest.fn(async (_phone, otp) => {
      if (otp !== '123456') throw new AuthError('invalid_otp');
      return {
        token: 'fictional-ui-token',
        workers: [{ workerId: 'ana', displayName: 'Ana López' }],
      };
    }),
  };
  const vault: SessionVault = {
    async read() {
      return null;
    },
    async write() {},
    async clear() {},
  };
  mockAuth = new AuthService(api, vault);
  await mockAuth.restore();
});
test('Spanish phone validation prevents a request and valid form normalizes the phone', async () => {
  await render(<SignIn />);
  await fireEvent.press(
    screen.getByRole('button', { name: i18n.t('requestCode') }),
  );
  await waitFor(() =>
    expect(
      screen.getByText('Introduce un teléfono válido con el código del país.'),
    ).toBeTruthy(),
  );
  expect(api.requestOtp).not.toHaveBeenCalled();
  await fireEvent.changeText(
    screen.getByLabelText('Número de teléfono'),
    '+52 55 1000 0001',
  );
  await fireEvent.press(
    screen.getByRole('button', { name: i18n.t('requestCode') }),
  );
  await waitFor(() =>
    expect(api.requestOtp).toHaveBeenCalledWith('+525510000001'),
  );
});
test('invalid OTP renders an actionable Spanish error and correct OTP selects Ana', async () => {
  await mockAuth.requestOtp('+525510000001');
  await render(<Verify />);
  await fireEvent.changeText(
    screen.getByLabelText('Código de verificación'),
    '000000',
  );
  await fireEvent.press(screen.getByRole('button', { name: i18n.t('verify') }));
  await waitFor(() =>
    expect(
      screen.getByText(
        'Comprueba el código de seis dígitos e inténtalo de nuevo.',
      ),
    ).toBeTruthy(),
  );
  await fireEvent.changeText(
    screen.getByLabelText('Código de verificación'),
    '123456',
  );
  await fireEvent.press(screen.getByRole('button', { name: i18n.t('verify') }));
  await waitFor(() => expect(mockAuth.current()?.workerId).toBe('ana'));
});
test('English picker shows authorized identities and selection never retains the old identity', async () => {
  api.verify = jest.fn(async () => ({
    token: 'fictional',
    workers: [
      { workerId: 'bruno', displayName: 'Bruno Díaz' },
      { workerId: 'carla', displayName: 'Carla Díaz' },
    ],
  }));
  await mockAuth.requestOtp('+525510000002');
  await mockAuth.verify('123456');
  await i18n.changeLanguage('en');
  await render(<SelectWorker />);
  expect(screen.getByText(i18n.t('pickTitle'))).toBeTruthy();
  expect(screen.queryByText('Ana López')).toBeNull();
  await fireEvent.press(
    screen.getByRole('button', { name: 'Continue as Carla Díaz' }),
  );
  await waitFor(() => expect(mockAuth.current()?.workerId).toBe('carla'));
});
test('identity view clears synchronously on worker switch; signed-out deep link is gated', async () => {
  api.verify = async () => ({
    token: 'fictional',
    workers: [
      { workerId: 'bruno', displayName: 'Bruno Díaz' },
      { workerId: 'carla', displayName: 'Carla Díaz' },
    ],
  });
  await mockAuth.requestOtp('+525510000002');
  await mockAuth.verify('123456');
  await mockAuth.selectWorker('carla');
  const view = await render(<WorkerIdentity />);
  expect(screen.getByText('Carla Díaz')).toBeTruthy();
  await act(async () => {
    await mockAuth.switchWorker();
  });
  expect(screen.queryByText('Carla Díaz')).toBeNull();
  await view.unmount();
  await mockAuth.logout();
  const { Redirect } = jest.requireMock('expo-router');
  Redirect.mockClear();
  await render(<WorkerLayout />);
  expect(Redirect).toHaveBeenCalled();
  expect(Redirect.mock.calls[0][0].href).toBe('/(auth)/sign-in');
});

test('verification phone is memory-only and cleared after leaving verification', async () => {
  await mockAuth.requestOtp('+525510000001');
  expect(mockAuth.getSnapshot().verificationPhone).toBe('+525510000001');
  await render(<Verify />);
  expect(screen.getByText('+525510000001')).toBeTruthy();
  await mockAuth.verify('123456');
  expect(mockAuth.getSnapshot().verificationPhone).toBeNull();
});
test('phone input survives a network failure and busy presses do not duplicate requests', async () => {
  let rejectRequest: ((error: Error) => void) | undefined;
  api.requestOtp = jest.fn(
    () =>
      new Promise<void>((_resolve, reject) => {
        rejectRequest = reject;
      }),
  );
  await render(<SignIn />);
  await fireEvent.changeText(
    screen.getByLabelText(i18n.t('phone')),
    '+525510000001',
  );
  await fireEvent.press(
    screen.getByRole('button', { name: i18n.t('requestCode') }),
  );
  await fireEvent.press(
    screen.getByRole('button', { name: i18n.t('requestCode') }),
  );
  expect(api.requestOtp).toHaveBeenCalledTimes(1);
  await act(async () => {
    rejectRequest?.(new AuthError('network'));
  });
  expect(screen.getByLabelText(i18n.t('phone')).props.value).toBe(
    '+525510000001',
  );
  expect(screen.getByText(i18n.t('errors.network'))).toBeTruthy();
});
