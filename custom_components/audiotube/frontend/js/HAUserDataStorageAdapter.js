/**
 * Storage adapter used when AudioTube is embedded in HA.
 *
 * Favorites and private playlists are stored via Home Assistant's own per-user
 * "frontend user data" websocket API (`frontend/get_user_data` /
 * `frontend/set_user_data`) instead of localStorage. That store is keyed by
 * the logged-in HA user (not by browser/device), so it automatically syncs
 * across every browser tab, phone, and the Companion App as long as they're
 * signed in with the same HA account — unlike localStorage, which never
 * leaves the device it was written on.
 *
 * The queue and shared playlists live in AudioTube's integration-owned HA
 * storage, so every HA user sees the same state and backend playback survives
 * after all browser/app clients disconnect. Settings and history stay local.
 *
 * @module js/HAUserDataStorageAdapter
 */
import { getAccessToken, getConnection } from './haAuth.js?v=20260923-1';
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

async function apiJson(path, options = {}) {
  const accessToken = await getAccessToken();
  const response = await fetch(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  return body;
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
  // Per-device fallback and settings/history storage.
  #local = new LocalStorageAdapter();
  #lastSharedState = null;

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
    const privatePlaylists = await getUserData(KEY_PLAYLISTS, await this.#local.getPlaylists());
    const { playlists: sharedPlaylists = [] } = await apiJson('/api/audiotube/shared-playlists');
    const playlists = [
      ...privatePlaylists.map(playlist => ({ ...playlist, visibility: 'private' })),
      ...sharedPlaylists.map(playlist => ({ ...playlist, visibility: 'shared' })),
    ];
    this.#local.savePlaylists(playlists);
    return playlists;
  }

  async savePlaylists(playlists) {
    this.#local.savePlaylists(playlists);
    const privatePlaylists = playlists.filter(playlist => playlist.visibility !== 'shared');
    const sharedPlaylists = playlists.filter(playlist => playlist.visibility === 'shared');
    await Promise.all([
      setUserData(KEY_PLAYLISTS, privatePlaylists),
      apiJson('/api/audiotube/shared-playlists', {
        method: 'PUT',
        body: JSON.stringify({ playlists: sharedPlaylists }),
      }),
    ]);
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

  async getQueue() {
    const state = await apiJson('/api/audiotube/shared-state');
    this.#lastSharedState = state;
    return state.queue || [];
  }

  getSharedState() { return this.#lastSharedState; }

  async saveQueue() {}

  async commandQueue(command, data = {}) {
    return apiJson('/api/audiotube/shared-state', {
      method: 'POST',
      body: JSON.stringify({ command, baseUrl: location.origin, ...data }),
    });
  }

  async getSettings()          { return this.#local.getSettings(); }
  async saveSettings(settings) { return this.#local.saveSettings(settings); }

  // ─── Live sync (optional capability, not part of the base interface) ──────

  /** @param {(tracks: object[]) => void} callback @returns {Promise<Function>} unsubscribe */
  subscribeFavorites(callback) { return subscribeUserData(KEY_FAVORITES, callback); }

  /** @param {(playlists: object[]) => void} callback @returns {Promise<Function>} unsubscribe */
  async subscribePlaylists(callback) {
    let privatePlaylists = [];
    let sharedPlaylists = [];
    const emit = () => callback([
      ...privatePlaylists.map(playlist => ({ ...playlist, visibility: 'private' })),
      ...sharedPlaylists.map(playlist => ({ ...playlist, visibility: 'shared' })),
    ]);
    const unsubscribePrivate = await subscribeUserData(KEY_PLAYLISTS, value => {
      privatePlaylists = value;
      emit();
    });
    const refreshShared = async () => {
      try {
        ({ playlists: sharedPlaylists = [] } = await apiJson('/api/audiotube/shared-playlists'));
        emit();
      } catch (err) {
        console.warn('[HAUserDataStorageAdapter] Shared playlist refresh failed:', err.message);
      }
    };
    await refreshShared();
    const timer = setInterval(refreshShared, 2000);
    return () => { unsubscribePrivate(); clearInterval(timer); };
  }

  /** @param {(groups: object[]) => void} callback @returns {Promise<Function>} unsubscribe */
  subscribeGroups(callback) { return subscribeUserData(KEY_GROUPS, callback); }

  subscribeQueue(callback) {
    let revision = -1;
    const refresh = async () => {
      try {
        const state = await apiJson('/api/audiotube/shared-state');
        this.#lastSharedState = state;
        if (state.revision !== revision) {
          revision = state.revision;
          callback(state);
        }
      } catch (err) {
        console.warn('[HAUserDataStorageAdapter] Shared queue refresh failed:', err.message);
      }
    };
    refresh();
    const timer = setInterval(refresh, 1000);
    return () => clearInterval(timer);
  }

  // ─── Extra ─────────────────────────────────────────────────────────────────

  async getHistory()           { return this.#local.getHistory(); }
  async saveHistory(history)   { return this.#local.saveHistory(history); }

  clearAll() { this.#local.clearAll(); }
}
