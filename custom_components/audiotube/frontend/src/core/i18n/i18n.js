/**
 * Minimal i18n helper.
 * Usage: import { t } from './i18n.js';
 *        t('searchPlaceholder')
 *        t('trackCount', 12)   // calls string function if value is a fn
 */
import de from './de.js?v=20260922-1';
import en from './en.js?v=20260922-1';

const LOCALES = { de, en };
const STORAGE_KEY = 'tap.locale';

function detectInitialLocale() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && LOCALES[saved]) return saved;
  } catch { /* ignore */ }
  const nav = (typeof navigator !== 'undefined' && navigator.language || '').slice(0, 2);
  return LOCALES[nav] ? nav : 'de';
}

let _locale = detectInitialLocale();
let _strings = LOCALES[_locale];
const _listeners = new Set();

export function getLocale() {
  return _locale;
}

export function availableLocales() {
  return Object.keys(LOCALES);
}

export function setLocale(locale) {
  if (!LOCALES[locale]) throw new Error(`Locale "${locale}" not registered.`);
  if (locale === _locale) return;
  _locale = locale;
  _strings = LOCALES[locale];
  try { localStorage.setItem(STORAGE_KEY, locale); } catch { /* ignore */ }
  _listeners.forEach(fn => fn(locale));
}

/** Subscribe to locale changes. Returns an unsubscribe function. */
export function onLocaleChange(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

/**
 * @param {string} key
 * @param {...any} args  - passed to string function if the value is callable
 */
export function t(key, ...args) {
  const val = _strings[key];
  if (val === undefined) {
    console.warn(`[i18n] Missing key "${key}" for locale "${_locale}"`);
    return key;
  }
  return typeof val === 'function' ? val(...args) : val;
}
