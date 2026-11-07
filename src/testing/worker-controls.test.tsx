import { fireEvent, render, screen } from '@testing-library/react-native';
import {
  BottomNavigation,
  Disclosure,
  ListRow,
} from '../design-system/components/worker-controls';
import i18n from '../core/i18n';

test('history is hidden until explicitly expanded', async () => {
  await render(
    <Disclosure title="Previous submissions">
      <ListRow title="Previous correction" />
    </Disclosure>,
  );
  expect(screen.queryByText('Previous correction')).toBeNull();
  await fireEvent.press(
    screen.getByRole('button', { name: 'Previous submissions' }),
  );
  expect(screen.getByText('Previous correction')).toBeTruthy();
  expect(
    screen.getByRole('button', { name: 'Previous submissions' }).props
      .accessibilityState,
  ).toEqual({ expanded: true });
});
test('navigation excludes unavailable documents and exposes selected destination', async () => {
  await i18n.changeLanguage('en');
  const navigate = jest.fn();
  await render(
    <BottomNavigation
      selected="home"
      documentsEnabled={false}
      onNavigate={navigate}
    />,
  );
  expect(screen.queryByRole('tab', { name: 'Documents' })).toBeNull();
  await fireEvent.press(screen.getByRole('tab', { name: 'My Job' }));
  expect(navigate).toHaveBeenCalledWith('job');
  expect(
    screen.getByRole('tab', { name: 'Home' }).props.accessibilityState,
  ).toEqual({ selected: true });
});
