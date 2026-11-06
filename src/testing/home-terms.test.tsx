import { fireEvent, render, screen } from '@testing-library/react-native';
import i18n from '../core/i18n';
import {
  TermsContent,
  HomeContent,
} from '../features/assignment/components/worker-content';
import type { AssignmentState } from '../features/assignment/assignment-service';
import { assignmentFixture } from './persistence-fixtures';
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
function state(): AssignmentState {
  return {
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
}
beforeEach(async () => {
  await i18n.changeLanguage('es');
});
test('Terms confirms the displayed version and generation, without implying approval', async () => {
  const onConfirm = jest.fn();
  await render(
    <TermsContent
      state={state()}
      onConfirm={onConfirm}
      onRefresh={() => {}}
      onHome={() => {}}
    />,
  );
  await fireEvent.press(
    screen.getByRole('button', {
      name: i18n.t('terms.confirm', { version: 'v2' }),
    }),
  );
  expect(onConfirm).toHaveBeenCalledWith('v2', 1, undefined);
  expect(screen.queryByText('Approved')).toBeNull();
});
test('Home shows cached assignment, offline state and explicit unavailable document navigation', async () => {
  await render(
    <HomeContent
      state={state()}
      workerName="Ana López"
      onTerms={() => {}}
      onRefresh={() => {}}
      onLanguage={() => {}}
      onSwitch={() => {}}
      onLogout={() => {}}
      shared={false}
    />,
  );
  expect(screen.getByText('Valle Verde Farms')).toBeTruthy();
  expect(screen.getByText(/JO-2026-0142/)).toBeTruthy();
  expect(screen.getByText(i18n.t('home.offline'))).toBeTruthy();
  expect(
    screen.getByRole('button', { name: i18n.t('home.documentsSoon') }),
  ).toBeDisabled();
});
test('English and offline empty state explain how to recover', async () => {
  await i18n.changeLanguage('en');
  const value = state();
  value.data = null;
  await render(
    <TermsContent
      state={value}
      onConfirm={() => {}}
      onRefresh={() => {}}
      onHome={() => {}}
    />,
  );
  expect(screen.getByText(i18n.t('home.noOfflineData'))).toBeTruthy();
  expect(
    screen.getByRole('button', { name: i18n.t('home.refresh') }),
  ).toBeTruthy();
});
test('stale v2 history requires explicit v3 confirmation and never shows an old saved notice for v3', async () => {
  const value = state();
  if (!value.data?.assignment) throw new Error('fixture');
  value.data.assignment.terms.termsVersionId = 'v3';
  value.savedActionId = 'old';
  value.data.actions = [
    {
      sequence: 1,
      id: 'old',
      clientActionId: 'old',
      workerId: 'ana',
      actionType: 'terms_acceptance',
      payload: {
        kind: 'terms_acceptance',
        workerId: 'ana',
        clientActionId: 'old',
        termsVersionId: 'v2',
      },
      fileUri: null,
      status: 'stale',
      attemptCount: 1,
      nextAttemptAt: 0,
      lastErrorCode: 'stale_terms',
      createdAt: 1,
      updatedAt: 1,
    },
  ];
  const onConfirm = jest.fn();
  await render(
    <TermsContent
      state={value}
      onConfirm={onConfirm}
      onRefresh={() => {}}
      onHome={() => {}}
    />,
  );
  expect(screen.getByText(i18n.t('terms.reconfirm'))).toBeTruthy();
  expect(screen.queryByText(i18n.t('terms.saved'))).toBeNull();
  expect(onConfirm).not.toHaveBeenCalled();
  await fireEvent.press(
    screen.getByRole('button', {
      name: i18n.t('terms.confirmNew', { version: 'v3' }),
    }),
  );
  expect(onConfirm).toHaveBeenCalledWith('v3', 1, undefined);
});

for (const version of ['v2', 'v3']) {
  test(`failed v2 offers explicit ${version} replacement instead of leaving confirmation disabled`, async () => {
    const value = state();
    if (!value.data?.assignment) throw new Error('fixture');
    value.data.assignment.terms.termsVersionId = version;
    value.data.actions = [
      {
        sequence: 1,
        id: 'failed-v2',
        clientActionId: 'failed-v2',
        workerId: 'ana',
        actionType: 'terms_acceptance',
        payload: {
          kind: 'terms_acceptance',
          workerId: 'ana',
          clientActionId: 'failed-v2',
          termsVersionId: 'v2',
        },
        fileUri: null,
        status: 'failed_permanent',
        attemptCount: 1,
        nextAttemptAt: 0,
        lastErrorCode: 'validation_failed',
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    const onConfirm = jest.fn();
    await render(
      <TermsContent
        state={value}
        onConfirm={onConfirm}
        onRefresh={() => {}}
        onHome={() => {}}
      />,
    );
    const button = screen.getByRole('button', {
      name: i18n.t('terms.replaceFailed', { version }),
    });
    expect(button).toBeEnabled();
    expect(onConfirm).not.toHaveBeenCalled();
    await fireEvent.press(button);
    expect(onConfirm).toHaveBeenCalledWith(version, 1, 'failed-v2');
  });
}
