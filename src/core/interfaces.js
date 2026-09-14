/**
 * Adapter interfaces — documented as JSDoc @typedef so both HA and Local
 * adapters can be validated against them at runtime in dev mode.
 *
 * Both adapters MUST implement every method listed here.
 * @module core/interfaces
 */

// ─── PlaybackAdapter ─────────────────────────────────────────────────────────
/**
 * @interface PlaybackAdapter
 *
 * getSpeakers()                      → Promise<Speaker[]>
 * selectSpeaker(id: string)          → Promise<void>
 * play(track: Track)                 → Promise<void>
 * pause()                            → Promise<void>
 * resume()                           → Promise<void>
 * stop()                             → Promise<void>
 * next()                             → Promise<void>
 * previous()                         → Promise<void>
 * setVolume(level: number)           → Promise<void>   // 0-100
 * onStateChange(cb)                  → void            // cb(PlaybackState)
 * destroy()                          → void
 */

// ─── SearchProvider ───────────────────────────────────────────────────────────
/**
 * @interface SearchProvider
 *
 * search(query, type)                → Promise<SearchResult[]>
 *   type: 'track' | 'playlist' | 'all'
 *
 * resolveUrl(url)                    → Promise<SearchResult[]>
 *   Resolves a YouTube URL (single video or playlist) to SearchResult(s)
 *
 * getAudioStreamUrl(videoId)         → Promise<string>
 *   Returns a direct audio-only stream URL for the given video ID.
 *   Implementation: proxy-server (local) or HA backend (version A).
 */

// ─── StorageAdapter ───────────────────────────────────────────────────────────
/**
 * @interface StorageAdapter
 *
 * getFavorites()                     → Promise<Track[]>
 * saveFavorites(tracks)              → Promise<void>
 *
 * getPlaylists()                     → Promise<Playlist[]>
 * savePlaylists(playlists)           → Promise<void>
 *
 * getQueue()                         → Promise<QueueItem[]>
 * saveQueue(items)                   → Promise<void>
 *
 * getSettings()                      → Promise<Object>
 * saveSettings(settings)             → Promise<void>
 */

// ─── Dev-mode interface guard ─────────────────────────────────────────────────
const PLAYBACK_ADAPTER_METHODS = [
  'getSpeakers', 'selectSpeaker', 'play', 'pause', 'resume',
  'stop', 'next', 'previous', 'setVolume', 'onStateChange', 'destroy',
];

const SEARCH_PROVIDER_METHODS = ['search', 'resolveUrl', 'getAudioStreamUrl'];

const STORAGE_ADAPTER_METHODS = [
  'getFavorites', 'saveFavorites', 'getPlaylists', 'savePlaylists',
  'getQueue', 'saveQueue', 'getSettings', 'saveSettings',
];

/**
 * Validates that an object implements the expected interface.
 * Only runs in development (non-minified) builds.
 * @param {Object} obj
 * @param {string[]} methods
 * @param {string} name
 */
export function validateInterface(obj, methods, name) {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') return;
  const missing = methods.filter(m => typeof obj[m] !== 'function');
  if (missing.length) {
    throw new TypeError(`[Interface] ${name} is missing methods: ${missing.join(', ')}`);
  }
}

export function validatePlaybackAdapter(adapter) {
  validateInterface(adapter, PLAYBACK_ADAPTER_METHODS, 'PlaybackAdapter');
}
export function validateSearchProvider(provider) {
  validateInterface(provider, SEARCH_PROVIDER_METHODS, 'SearchProvider');
}
export function validateStorageAdapter(adapter) {
  validateInterface(adapter, STORAGE_ADAPTER_METHODS, 'StorageAdapter');
}
