/**
 * Shared UI helpers.
 */

/**
 * Format seconds to M:SS or H:MM:SS
 * @param {number} totalSec
 * @returns {string}
 */
export function formatDuration(totalSec) {
  if (!totalSec || totalSec <= 0) return '–';
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

/**
 * Pick a thumbnail URL from a search result.
 * Accepts either a direct string or an object with a `thumbnail` property.
 * @param {string|{thumbnail?:string}} src
 * @returns {string}
 */
export function isoThumb(src) {
  if (!src) return '';
  if (typeof src === 'string') return src;
  return src.thumbnail || '';
}
