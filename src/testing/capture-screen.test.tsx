import { render, screen, fireEvent } from '@testing-library/react-native';
import i18n from '../core/i18n';
import { CaptureContent } from '../features/capture/components/capture-content';
import type { CaptureState } from '../features/capture/capture-service';
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('expo-image', () => ({ Image: jest.fn(() => null) }));
function state(): CaptureState {
  return {
    selection: {
      workerId: 'ana',
      generation: 1,
      documentType: 'passport',
      expectedSubmissionId: null,
    },
    preview: null,
    phase: 'idle',
    error: null,
    savedActionId: null,
  };
}
beforeEach(async () => {
  await i18n.changeLanguage('es');
});
test('permission denial offers gallery and settings recovery without claiming queued success', async () => {
  const value = state();
  value.error = 'capture_camera_denied';
  const choose = jest.fn(),
    settings = jest.fn();
  await render(
    <CaptureContent
      state={value}
      label="Pasaporte"
      onChoose={choose}
      onSettings={settings}
      onSave={() => {}}
      onBack={() => {}}
    />,
  );
  await fireEvent.press(
    screen.getByRole('button', { name: i18n.t('capture.gallery') }),
  );
  expect(choose).toHaveBeenCalledWith('gallery');
  await fireEvent.press(
    screen.getByRole('button', { name: i18n.t('capture.settings') }),
  );
  expect(settings).toHaveBeenCalled();
  expect(screen.queryByText(i18n.t('capture.saved'))).toBeNull();
});
test('measured preview needs an explicit save, and queued feedback never implies staff review or approval', async () => {
  const value = state();
  value.preview = {
    workerId: 'ana',
    uri: 'file:///private/image.jpg',
    byteSize: 1234,
    sha256: 'a'.repeat(64),
  };
  const save = jest.fn();
  await render(
    <CaptureContent
      state={value}
      label="Pasaporte"
      onChoose={() => {}}
      onSettings={() => {}}
      onSave={save}
      onBack={() => {}}
    />,
  );
  expect(
    screen.queryByText(i18n.t('capture.bytes', { count: 1234 })),
  ).toBeNull();
  const { Image } = jest.requireMock('expo-image');
  expect(Image.mock.calls.at(-1)[0].source.uri).toBe(value.preview.uri);
  expect(Image.mock.calls.at(-1)[0].cachePolicy).toBe('none');
  expect(save).not.toHaveBeenCalled();
  await fireEvent.press(
    screen.getByRole('button', { name: i18n.t('capture.save') }),
  );
  expect(save).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Aprobado')).toBeNull();
});

test('saved capture feedback can advance to actual delivery evidence without claiming approval', async () => {
  const value = state();
  value.phase = 'saved';
  value.savedActionId = 'saved-action';
  const view = await render(
    <CaptureContent
      state={value}
      label="Pasaporte"
      savedStatus={i18n.t('ui.saved')}
      onChoose={() => {}}
      onSettings={() => {}}
      onSave={() => {}}
      onBack={() => {}}
    />,
  );
  expect(screen.getByText(i18n.t('ui.saved'))).toBeTruthy();
  await view.rerender(
    <CaptureContent
      state={value}
      label="Pasaporte"
      savedStatus={i18n.t('documents.status.pending_review')}
      onChoose={() => {}}
      onSettings={() => {}}
      onSave={() => {}}
      onBack={() => {}}
    />,
  );
  expect(screen.queryByText(i18n.t('ui.saved'))).toBeNull();
  expect(
    screen.getByText(i18n.t('documents.status.pending_review')),
  ).toBeTruthy();
  expect(screen.queryByText(i18n.t('documents.status.approved'))).toBeNull();
});
