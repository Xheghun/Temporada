import { render, screen, fireEvent } from '@testing-library/react-native';
import { PrimaryNavigation } from '../design-system/components/primary-navigation';
import i18n from '../core/i18n';
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (path: string) => mockReplace(path) },
}));
test('primary destinations replace existing routes without building competing history', async () => {
  await i18n.changeLanguage('en');
  await render(<PrimaryNavigation selected="home" documentsEnabled />);
  for (const [label, path] of [
    ['Documents', '/(worker)/documents'],
    ['My Job', '/(worker)/job'],
    ['Home', '/(worker)/home'],
  ] as const) {
    await fireEvent.press(screen.getByRole('tab', { name: label }));
    expect(mockReplace).toHaveBeenLastCalledWith(path);
  }
});
