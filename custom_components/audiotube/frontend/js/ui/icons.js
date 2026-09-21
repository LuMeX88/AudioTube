/**
 * Inline SVG icon set (currentColor, 24x24 viewBox).
 * Usage: icon('play') → returns an <svg> string.
 */

const PATHS = {
  play:      '<path d="M8 5v14l11-7z"/>',
  pause:     '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>',
  stop:      '<path d="M6 6h12v12H6z"/>',
  prev:      '<path d="M6 6h2v12H6zm3.5 6L18 6v12z"/>',
  next:      '<path d="M16 6h2v12h-2zM6 6l8.5 6L6 18z"/>',
  queue:     '<path d="M3 6h13v2H3zm0 4h13v2H3zm0 4h9v2H3zm12 .5v5l4-2.5z"/>',
  plusList:  '<path d="M3 6h11v2H3zm0 4h11v2H3zm0 4h7v2H3zm11-3h2v3h3v2h-3v3h-2v-3h-3v-2h3z"/>',
  add:       '<path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/>',
  heart:     '<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  heartFill: '<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>',
  edit:      '<path d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75zM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75z"/>',
  trash:     '<path d="M6 7h12l-1 13H7zM9 4h6l1 2H8zM4 6h16v2H4z"/>',
  close:     '<path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3 10.6 10.6 16.9 4.3z"/>',
  speaker:   '<path d="M4 9v6h4l5 5V4L8 9zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z"/>',
  volume:    '<path d="M4 9v6h4l5 5V4L8 9zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/>',
  music:     '<path d="M12 3v10.6A4 4 0 1 0 14 17V7h4V3z"/>',
  refresh:   '<path d="M17.65 6.35A8 8 0 1 0 20 12h-2a6 6 0 1 1-1.76-4.24L13 11h7V4z"/>',
  check:     '<path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/>',
  globe:     '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 6h-3a15 15 0 0 0-1.3-3.6A8 8 0 0 1 18.9 8zM12 4c.8 1.2 1.5 2.5 1.9 4h-3.8c.4-1.5 1.1-2.8 1.9-4zM4.3 14a8 8 0 0 1 0-4h3.4a16 16 0 0 0 0 4zm.8 2h3a15 15 0 0 0 1.3 3.6A8 8 0 0 1 5.1 16zm3-8h-3a8 8 0 0 1 4.3-3.6A15 15 0 0 0 8.1 8zM12 20c-.8-1.2-1.5-2.5-1.9-4h3.8c-.4 1.5-1.1 2.8-1.9 4zm2.3-6H9.7a14 14 0 0 1 0-4h4.6a14 14 0 0 1 0 4zm.6 5.6a15 15 0 0 0 1.3-3.6h3a8 8 0 0 1-4.3 3.6zM16.3 14a16 16 0 0 0 0-4h3.4a8 8 0 0 1 0 4z"/>',
};

/**
 * @param {keyof typeof PATHS} name
 * @param {number} [size=20]
 * @returns {string} SVG markup
 */
export function icon(name, size = 20) {
  const body = PATHS[name] || PATHS.music;
  return `<svg class="icon" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false">${body}</svg>`;
}
