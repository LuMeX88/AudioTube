/**
 * Local Storage Adapter (Version B — Browser)
 * Persists all app data in localStorage using namespaced JSON keys.
 *
 * Implements: StorageAdapter interface (see src/core/interfaces.js)
 * @module adapters/local/LocalStorageAdapter
 */

const NS = 'tube-audio-player'; // namespace prefix

function key(name) { return `${NS}:${name}`; }

function load(name, fallback = null) {
  try {
    const raw = localStorage.getItem(key(name));
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.warn(`[LocalStorageAdapter] Failed to load "${name}"`, e);
    return fallback;
  }
}

function save(name, value) {
  try {
    localStorage.setItem(key(name), JSON.stringify(value));
  } catch (e) {
    console.error(`[LocalStorageAdapter] Failed to save "${name}"`, e);
  }
}

export class LocalStorageAdapter {
  // ─── StorageAdapter interface ─────────────────────────────────────────────

  async getFavorites()            { return load('favorites', []); }
  async saveFavorites(tracks)     { save('favorites', tracks); }

  async getPlaylists()            { return load('playlists', []); }
  async savePlaylists(playlists)  { save('playlists', playlists); }

  async getQueue()                { return load('queue', []); }
  async saveQueue(items)          { save('queue', items); }

  async getSettings()             { return load('settings', defaultSettings()); }
  async saveSettings(settings)    { save('settings', settings); }

  // ─── Extra ───────────────────────────────────────────────────────────────

  async getHistory()              { return load('history', []); }
  async saveHistory(history)      { save('history', history.slice(0, 100)); }

  /** Clear ALL stored app data (used for factory reset in settings) */
  clearAll() {
    const keysToDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith(NS + ':')) keysToDelete.push(k);
    }
    keysToDelete.forEach(k => localStorage.removeItem(k));
  }
}

function defaultSettings() {
  return {
    ai: {
      enabled: false,
      baseUrl: '',   // e.g. https://axposervices.azure-api.net/openai
      apiKey: '',
      model: 'gpt-4o-mini',
    },
  };
}
