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
