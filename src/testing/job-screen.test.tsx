import { render, screen, fireEvent } from '@testing-library/react-native';
import {
  JobContent,
  formatSeasonDate,
} from '../features/assignment/components/job-content';
import { assignmentFixture } from './persistence-fixtures';
import type { AssignmentState } from '../features/assignment/assignment-service';
import i18n from '../core/i18n';
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
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
for (const language of ['en', 'es'] as const)
  test(`${language} job renders cached values and working terms action`, async () => {
    await i18n.changeLanguage(language);
    const open = jest.fn();
    const value = state();
    value.loading = true;
    await render(
      <JobContent state={value} onTerms={open} onRefresh={() => {}} />,
    );
    expect(screen.getByText('Valle Verde Farms')).toBeTruthy();
    expect(screen.getByText('JO-2026-0142')).toBeTruthy();
    expect(screen.queryByText(i18n.t('home.loading'))).toBeNull();
    await fireEvent.press(
      screen.getByRole('button', { name: i18n.t('home.openTerms') }),
    );
    expect(open).toHaveBeenCalledTimes(1);
  });
test('missing offline cache never invents job details', async () => {
  const value = state();
  value.data = null;
  await render(
    <JobContent state={value} onTerms={() => {}} onRefresh={() => {}} />,
  );
  expect(screen.getByText(i18n.t('home.noOfflineData'))).toBeTruthy();
  expect(screen.queryByText('Valle Verde Farms')).toBeNull();
});
test('date-only season stays in the same day and localizes', () => {
  expect(formatSeasonDate('2026-03-01', 'en-US')).toBe('March 1, 2026');
  expect(formatSeasonDate('2026-03-01', 'es-MX')).toContain('mar');
});
