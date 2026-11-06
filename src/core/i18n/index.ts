import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import es from './es.json';
import en from './en.json';
const i18n = createInstance();
void i18n.use(initReactI18next).init({
  resources: { es: { translation: es }, en: { translation: en } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  initAsync: false,
});
export default i18n;
