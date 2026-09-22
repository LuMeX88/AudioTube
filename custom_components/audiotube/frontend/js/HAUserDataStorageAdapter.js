/**
 * Storage adapter used when AudioTube is embedded in HA.
 *
 * Favorites and playlists are stored via Home Assistant's own per-user
 * "frontend user data" websocket API (`frontend/get_user_data` /
 * `frontend/set_user_data`) instead of localStorage. That store is keyed by
 * the logged-in HA user (not by browser/device), so it automatically syncs
 * across every browser tab, phone, and the Companion App as long as they're
 * signed in with the same HA account — unlike localStorage, which never
 * leaves the device it was written on.
 *
 * Everything else (queue, settings, history) stays in localStorage via the
 * wrapped LocalStorageAdapter: those are legitimately per-device (e.g. you
 * don't want your desktop's selected speaker to override your phone's).
 *
 * @module js/HAUserDataStorageAdapter
 */
import { getConnection } from './haAuth.js';
import { LocalStorageAdapter } from '../src/adapters/local/LocalStorageAdapter.js?v=20260914-3';

const KEY_FAVORITES = 'audiotube_favorites';
const KEY_PLAYLISTS = 'audiotube_playlists';

async function getUserData(key, fallback) {
  try {
    const conn = await getConnection();
    const { value } = await conn.sendMessagePromise({ type: 'frontend/get_user_data', key });
    return value ?? fallback;
  } catch (err) {
    console.warn(`[HAUserDataStorageAdapter] Failed to load "${key}", falling back to local cache:`, err.message);
    return fallback;
  }
}

async function setUserData(key, value) {
  try {
    const conn = await getConnection();
    await conn.sendMessagePromise({ type: 'frontend/set_user_data', key, value });
  } catch (err) {
    console.error(`[HAUserDataStorageAdapter] Failed to save "${key}":`, err.message);
  }
}

export class HAUserDataStorageAdapter {
  // Per-device data (queue/settings/history) still goes through localStorage.
  #local = new LocalStorageAdapter();

  // ─── StorageAdapter interface ─────────────────────────────────────────────

  async getFavorites() {
    // Keep a local copy so a temporary connection hiccup doesn't wipe the UI.
    const favorites = await getUserData(KEY_FAVORITES, await this.#local.getFavorites());
    this.#local.saveFavorites(favorites);
    return favorites;
  }

  async saveFavorites(tracks) {
    this.#local.saveFavorites(tracks);
    await setUserData(KEY_FAVORITES, tracks);
  }

  async getPlaylists() {
    const playlists = await getUserData(KEY_PLAYLISTS, await this.#local.getPlaylists());
    this.#local.savePlaylists(playlists);
    return playlists;
  }

  async savePlaylists(playlists) {
    this.#local.savePlaylists(playlists);
    await setUserData(KEY_PLAYLISTS, playlists);
  }

  async getQueue()             { return this.#local.getQueue(); }
  async saveQueue(items)       { return this.#local.saveQueue(items); }

  async getSettings()          { return this.#local.getSettings(); }
  async saveSettings(settings) { return this.#local.saveSettings(settings); }

  // ─── Extra ─────────────────────────────────────────────────────────────────

  async getHistory()           { return this.#local.getHistory(); }
  async saveHistory(history)   { return this.#local.saveHistory(history); }

  clearAll() { this.#local.clearAll(); }
}
