import { render, screen, fireEvent } from '@testing-library/react-native';
import i18n from '../core/i18n';
import { DocumentsContent } from '../features/documents/components/documents-content';
import type { DocumentsState } from '../features/documents/documents-service';
import { assignmentFixture } from './persistence-fixtures';
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
function state(): DocumentsState {
  return {
    workerId: 'carla',
    generation: 1,
    data: {
      assignment: assignmentFixture('carla'),
      actions: [],
      cachedAt: 1,
      refreshNeeded: false,
      refreshError: null,
    },
    loading: false,
    saving: false,
    refreshing: false,
    online: false,
    error: null,
    savedActionId: null,
  };
}
beforeEach(async () => {
  await i18n.changeLanguage('es');
});
test('Spanish catalog renders correction reason and honest unavailable capture action', async () => {
  await render(
    <DocumentsContent state={state()} onHome={() => {}} onRefresh={() => {}} />,
  );
  expect(screen.getByText('Pasaporte')).toBeTruthy();
  expect(
    screen.getByText(i18n.t('documents.status.correction_requested')),
  ).toBeTruthy();
  expect(
    screen.getByText('Motivo: Foto borrosa, vuelva a tomarla'),
  ).toBeTruthy();
  expect(
    screen.getByRole('button', { name: i18n.t('documents.replace') }),
  ).toBeDisabled();
  expect(screen.queryByText('Aprobado')).toBeNull();
});
test('new queued passport shows Pending Sync while the older correction remains in history', async () => {
  const value = state();
  if (!value.data) throw new Error('fixture');
  value.data.actions = [
    {
      sequence: 1,
      id: 'new-action',
      clientActionId: 'new-action',
      workerId: 'carla',
      actionType: 'document_upload',
      payload: {
        kind: 'document_upload',
        clientActionId: 'new-action',
        workerId: 'carla',
        documentType: 'passport',
        localSubmissionId: 'new-action',
        sha256: 'a'.repeat(64),
        replacesSubmissionId: 'seed-carla-passport',
      },
      fileUri: 'file:///private/carla/image.jpg',
      status: 'queued',
      attemptCount: 0,
      nextAttemptAt: 1,
      lastErrorCode: null,
      createdAt: 100,
      updatedAt: 100,
    },
  ];
  await render(
    <DocumentsContent state={value} onHome={() => {}} onRefresh={() => {}} />,
  );
  expect(screen.getByText(i18n.t('ui.saved'))).toBeTruthy();
  expect(screen.getByText('Envíos anteriores')).toBeTruthy();
  expect(
    screen.queryByText('Motivo: Foto borrosa, vuelva a tomarla'),
  ).toBeNull();
  await fireEvent.press(
    screen.getByRole('button', { name: i18n.t('documents.history') }),
  );
  expect(
    screen.getByText('Motivo: Foto borrosa, vuelva a tomarla'),
  ).toBeTruthy();
  expect(
    screen.queryByText(i18n.t('documents.status.pending_review')),
  ).toBeNull();
});
test('English UI keeps free-text correction reason unchanged', async () => {
  await i18n.changeLanguage('en');
  await render(
    <DocumentsContent state={state()} onHome={() => {}} onRefresh={() => {}} />,
  );
  expect(screen.getByText('Passport')).toBeTruthy();
  expect(
    screen.getByText(i18n.t('documents.status.correction_requested')),
  ).toBeTruthy();
  expect(
    screen.getByText('Reason: Foto borrosa, vuelva a tomarla'),
  ).toBeTruthy();
});
