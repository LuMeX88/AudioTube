/**
 * Observable application state.
 * Uses a simple pub/sub pattern — no external framework required.
 * @module core/state/AppState
 */

import { defaultPlaybackState, generateId } from '../models.js';

const INITIAL_STATE = {
  // Search
  searchQuery: '',
  searchResults: [],
  searchLoading: false,
  searchError: null,

  // Queue
  queue: [],            // QueueItem[]
  queueIndex: -1,       // index of currently playing item

  // Speakers
  speakers: [],         // Speaker[]
  selectedSpeakerId: null,

  // Playback
  playback: defaultPlaybackState(),

  // Favourites & playlists
  favorites: [],        // Track[]
  playlists: [],        // Playlist[]
  groups: [],            // SpeakerGroup[] — user-defined groups of speakers, a speaker can be in several

  // UI state
  activeView: 'search', // 'search' | 'queue' | 'favorites' | 'playlists'
  notification: null,   // { message, type: 'info'|'warn'|'error', id }
};

export class AppState {
  #state;
  #listeners = new Map(); // topic → Set<fn>

  constructor(initialOverrides = {}) {
    this.#state = structuredClone({ ...INITIAL_STATE, ...initialOverrides });
  }

  // ─── Read ────────────────────────────────────────────────────────────────

  get(key) {
    return this.#state[key];
  }

  snapshot() {
    return structuredClone(this.#state);
  }

  // ─── Write ───────────────────────────────────────────────────────────────

  /**
   * Merge partial updates and notify subscribers.
   * @param {Partial<typeof INITIAL_STATE>} patch
   */
  set(patch) {
    const changed = [];
    for (const [key, value] of Object.entries(patch)) {
      if (this.#state[key] !== value) {
        this.#state[key] = value;
        changed.push(key);
      }
    }
    if (changed.length === 0) return;
    this.#emit('*', this.#state);
    changed.forEach(key => this.#emit(key, this.#state[key]));
  }

  /**
   * Deep-merge a nested object key.
   * @param {string} key
   * @param {Object} patch
   */
  merge(key, patch) {
    const current = this.#state[key];
    this.set({ [key]: { ...current, ...patch } });
  }

  // ─── Queue helpers ────────────────────────────────────────────────────────

  get currentQueueItem() {
    const idx = this.#state.queueIndex;
    return idx >= 0 && idx < this.#state.queue.length
      ? this.#state.queue[idx]
      : null;
  }

  get hasNext() {
    return this.#state.queueIndex < this.#state.queue.length - 1;
  }

  get hasPrev() {
    return this.#state.queueIndex > 0;
  }

  // ─── Pub/Sub ──────────────────────────────────────────────────────────────

  /**
   * Subscribe to state changes.
   * @param {string|string[]} keys  - state key(s) or '*' for any change
   * @param {Function} fn
   * @returns {Function} unsubscribe
   */
  on(keys, fn) {
    const topics = Array.isArray(keys) ? keys : [keys];
    topics.forEach(k => {
      if (!this.#listeners.has(k)) this.#listeners.set(k, new Set());
      this.#listeners.get(k).add(fn);
    });
    return () => topics.forEach(k => this.#listeners.get(k)?.delete(fn));
  }

  #emit(topic, value) {
    this.#listeners.get(topic)?.forEach(fn => {
      try { fn(value); } catch (e) { console.error(`[AppState] listener error on "${topic}"`, e); }
    });
  }

  // ─── Notification helper ──────────────────────────────────────────────────

  notify(message, type = 'info', durationMs = 4000) {
    const id = generateId();
    this.set({ notification: { message, type, id } });
    if (durationMs > 0) {
      setTimeout(() => {
        if (this.#state.notification?.id === id) {
          this.set({ notification: null });
        }
      }, durationMs);
    }
  }
}

// Singleton — import this instance everywhere
export const appState = new AppState();
