import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import chs from './locales/chs.json';

let savedLanguage: string | null = null;
try {
    savedLanguage = localStorage.getItem('airi-language');
} catch {
    // Storage can be disabled by browser privacy settings.
}
const language = savedLanguage === 'chs' ? 'chs' : 'en';
document.documentElement.lang = language === 'chs' ? 'zh-CN' : 'en';
i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, chs: { translation: chs } },
    lng: language,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
});
export default i18n;
