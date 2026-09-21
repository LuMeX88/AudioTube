/**
 * Minimal namespaced console logger for AudioTube.
 * Prefixes every message so AudioTube output is easy to filter in DevTools.
 * @module core/log
 */
const PREFIX = '[AudioTube]';

export const log = {
  debug: (...args) => console.debug(PREFIX, ...args),
  info:  (...args) => console.info(PREFIX, ...args),
  warn:  (...args) => console.warn(PREFIX, ...args),
  error: (...args) => console.error(PREFIX, ...args),
};
