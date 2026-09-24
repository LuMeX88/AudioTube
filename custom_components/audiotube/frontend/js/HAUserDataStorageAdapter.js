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
import { getConnection } from './haAuth.js?v=20260923-1';
import { LocalStorageAdapter } from '../src/adapters/local/LocalStorageAdapter.js?v=20260924-1';

const KEY_FAVORITES = 'audiotube_favorites';
const KEY_PLAYLISTS = 'audiotube_playlists';
const KEY_GROUPS    = 'audiotube_groups';

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

/**
 * Subscribes to live push updates for a user-data key via HA's
 * `frontend/subscribe_user_data` websocket command, so changes saved from
 * any other device logged into the same HA account arrive here without a
 * manual refresh. Returns an unsubscribe function (always resolves, even on
 * failure, so callers don't need try/catch).
 */
async function subscribeUserData(key, callback) {
  try {
    const conn = await getConnection();
    return await conn.subscribeMessage(msg => callback(msg.value ?? []), {
      type: 'frontend/subscribe_user_data',
      key,
    });
  } catch (err) {
    console.warn(`[HAUserDataStorageAdapter] Failed to subscribe to "${key}":`, err.message);
    return () => {};
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

  async getGroups() {
    const groups = await getUserData(KEY_GROUPS, await this.#local.getGroups());
    this.#local.saveGroups(groups);
    return groups;
  }

  async saveGroups(groups) {
    this.#local.saveGroups(groups);
    await setUserData(KEY_GROUPS, groups);
  }

  async getQueue()             { return this.#local.getQueue(); }
  async saveQueue(items)       { return this.#local.saveQueue(items); }

  async getSettings()          { return this.#local.getSettings(); }
  async saveSettings(settings) { return this.#local.saveSettings(settings); }

  // ─── Live sync (optional capability, not part of the base interface) ──────

  /** @param {(tracks: object[]) => void} callback @returns {Promise<Function>} unsubscribe */
  subscribeFavorites(callback) { return subscribeUserData(KEY_FAVORITES, callback); }

  /** @param {(playlists: object[]) => void} callback @returns {Promise<Function>} unsubscribe */
  subscribePlaylists(callback) { return subscribeUserData(KEY_PLAYLISTS, callback); }

  /** @param {(groups: object[]) => void} callback @returns {Promise<Function>} unsubscribe */
  subscribeGroups(callback) { return subscribeUserData(KEY_GROUPS, callback); }

  // ─── Extra ─────────────────────────────────────────────────────────────────

  async getHistory()           { return this.#local.getHistory(); }
  async saveHistory(history)   { return this.#local.saveHistory(history); }

  clearAll() { this.#local.clearAll(); }
}
