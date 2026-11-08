import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import {
  LanguageControl,
  LanguagePreferenceContext,
} from '../core/i18n/language-control';
import i18n from '../core/i18n';
test('language selector saves through the existing preference operation and reports failure', async () => {
  await i18n.changeLanguage('en');
  const save = jest.fn(async (language: 'en' | 'es') => {
    await i18n.changeLanguage(language);
  });
  const view = await render(
    <LanguagePreferenceContext.Provider value={save}>
      <LanguageControl />
    </LanguagePreferenceContext.Provider>,
  );
  await fireEvent.press(
    screen.getByRole('button', { name: i18n.t('ui.language') }),
  );
  await waitFor(() => expect(save).toHaveBeenCalledWith('es'));
  expect(screen.getByText(i18n.t('reference.languageCodes'))).toBeTruthy();
  expect(i18n.resolvedLanguage).toBe('es');
  save.mockRejectedValueOnce(new Error('storage_unavailable'));
  await fireEvent.press(
    screen.getByRole('button', { name: i18n.t('ui.language') }),
  );
  await waitFor(() =>
    expect(screen.getByText(i18n.t('errors.language_failed'))).toBeTruthy(),
  );
  expect(i18n.resolvedLanguage).toBe('es');
  await view.unmount();
});
