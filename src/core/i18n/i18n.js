/**
 * Minimal i18n helper.
 * Usage: import { t } from './i18n.js';
 *        t('searchPlaceholder')
 *        t('trackCount', 12)   // calls string function if value is a fn
 */
import de from './de.js';

const LOCALES = { de };
let _locale = 'de';
let _strings = LOCALES[_locale];

export function setLocale(locale) {
  if (!LOCALES[locale]) throw new Error(`Locale "${locale}" not registered.`);
  _locale = locale;
  _strings = LOCALES[locale];
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
