import { I18n } from 'i18n-js';
import * as Localization from 'expo-localization';
import en from '../locales/en/translation.json';
import hi from '../locales/hi/translation.json';
import ta from '../locales/ta/translation.json';

const i18n = new I18n();

i18n.translations = { en, hi, ta };

// Set fallback to English
i18n.fallbacks = true;
i18n.defaultLocale = 'en';

// Supported languages: English, Hindi, Tamil
const SUPPORTED_LANGUAGES = ['en', 'hi', 'ta'];

// Set default locale to English
let locale = 'en';

// Try to get saved language from AsyncStorage (will be loaded in App.js)
// For now, check device locale but only use if it's supported
if (
  Localization &&
  typeof Localization.locale === 'string' &&
  Localization.locale.length > 0
) {
  const deviceLocale = Localization.locale.includes('-') 
    ? Localization.locale.split('-')[0] 
    : Localization.locale;
  
  // Only use device locale if it's in our supported languages
  if (SUPPORTED_LANGUAGES.includes(deviceLocale)) {
    locale = deviceLocale;
  }
}

i18n.locale = locale;

console.log('[i18n] Using locale:', locale);

// Language change listeners
let languageChangeListeners = [];

// Function to notify all listeners of language change
export const notifyLanguageChange = () => {
  languageChangeListeners.forEach(listener => listener());
};

// Function to add a language change listener
export const addLanguageChangeListener = (listener) => {
  languageChangeListeners.push(listener);
  return () => {
    const index = languageChangeListeners.indexOf(listener);
    if (index > -1) {
      languageChangeListeners.splice(index, 1);
    }
  };
};

// Enhanced setLocale function that notifies listeners
export const setLocale = (locale) => {
  console.log('[i18n] Setting locale to:', locale);
  i18n.locale = locale;
  notifyLanguageChange();
  console.log('[i18n] Notified', languageChangeListeners.length, 'listeners of language change');
};

export default i18n; 
