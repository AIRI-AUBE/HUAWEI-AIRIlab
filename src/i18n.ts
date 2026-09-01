import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import chs from './locales/chs.json';

const savedLanguage = localStorage.getItem('airi-language');
i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, chs: { translation: chs } },
    lng: savedLanguage ?? 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
});
export default i18n;
