/**
 * App Controller — wires state, adapters, and search together.
 * Handles queue logic, navigation, and persistence.
 * @module apps/local/js/AppController
 */

import { appState } from '../src/core/state/AppState.js';
import { createQueueItem, createPlaylist, trackFromSearchResult } from '../src/core/models.js';
import { t } from '../src/core/i18n/i18n.js';
import { log } from '../src/core/log.js';

export class AppController {
  #playback;    // PlaybackAdapter
  #search;      // SearchClient
  #storage;     // StorageAdapter

  constructor({ playbackAdapter, searchClient, storageAdapter }) {
    this.#playback = playbackAdapter;
    this.#search   = searchClient;
    this.#storage  = storageAdapter;
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  async init() {
    // Load persisted data
    const [favorites, playlists, queue, settings] = await Promise.all([
      this.#storage.getFavorites(),
      this.#storage.getPlaylists(),
      this.#storage.getQueue(),
      this.#storage.getSettings(),
    ]);

    appState.set({ favorites, playlists, queue });

    // Apply settings to search client
    if (settings?.ai) {
      this.#search.updateAiConfig(settings.ai);
    }

    // Do not block the whole app on HA/Sonos discovery. The UI remains usable
    // while the iframe websocket authenticates or reports an error.
    try {
      await Promise.race([
        this.refreshSpeakers(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Lautsprecher-Erkennung timeout.')), 5000)),
      ]);
    } catch (err) {
      log.warn('Speaker discovery unavailable:', err.message);
      appState.set({ speakers: [] });
    }

    // Select first available speaker
    const speakers = appState.get('speakers');
    const first = speakers.find(s => s.isAvailable);
    if (first) {
      await this.#playback.selectSpeaker(first.id);
      appState.set({ selectedSpeakerId: first.id });
    }

    // Listen to playback state from adapter
    this.#playback.onStateChange(ps => {
      appState.merge('playback', ps);
      if (ps._event === 'ended') this.#onTrackEnded();
    });

    // Auto-save queue on changes
    appState.on('queue', q => this.#storage.saveQueue(q));
  }

  // ─── Search ───────────────────────────────────────────────────────────────

  async search(query, type = 'all') {
    if (!query.trim()) return;
    appState.set({ searchLoading: true, searchError: null, searchQuery: query });
    try {
      const results = await this.#search.search(query, type);
      appState.set({ searchResults: results, searchLoading: false });
    } catch (err) {
      log.error('search failed:', { query, type, error: err.message });
      appState.set({ searchError: err.message, searchLoading: false, searchResults: [] });
      appState.notify(err.message || t('searchError'), 'error');
    }
  }

  async resolveUrl(url) {
    appState.set({ searchLoading: true, searchError: null });
    try {
      const results = await this.#search.resolveUrl(url);
      appState.set({ searchResults: results, searchLoading: false });
    } catch (err) {
      log.error('resolveUrl failed:', { url, error: err.message });
      appState.set({ searchError: err.message, searchLoading: false, searchResults: [] });
      appState.notify(err.message, 'error');
    }
  }

  // ─── Playback ─────────────────────────────────────────────────────────────

  async playNow(searchResult) {
    const track = trackFromSearchResult(searchResult);

    if (searchResult.type === 'playlist') {
      await this.#loadPlaylistAndPlay(searchResult);
      return;
    }

    // Replace queue with this single track and play it
    const item = createQueueItem(track);
    appState.set({ queue: [item], queueIndex: 0 });
    await this.#playTrack(track);
  }

  async addToQueue(searchResult) {
    const track = trackFromSearchResult(searchResult);
    const items = [...appState.get('queue'), createQueueItem(track)];
    appState.set({ queue: items });
    appState.notify(`„${track.title}" zur Warteschlange hinzugefügt.`, 'info');

    // Start playing if idle
    if (appState.get('playback').status === 'idle') {
      appState.set({ queueIndex: items.length - 1 });
      await this.#playTrack(track);
    }
  }

  async playNext(searchResult) {
    const track = trackFromSearchResult(searchResult);
    const queue = [...appState.get('queue')];
    const idx   = appState.get('queueIndex');
    queue.splice(idx + 1, 0, createQueueItem(track));
    appState.set({ queue });
    appState.notify(`„${track.title}" als nächstes eingereiht.`, 'info');
  }

  async skipToQueueItem(queueId) {
    const queue = appState.get('queue');
    const idx   = queue.findIndex(i => i.queueId === queueId);
    if (idx === -1) return;
    appState.set({ queueIndex: idx });
    await this.#playTrack(queue[idx].track);
  }

  async next() {
    if (!appState.hasNext) {
      await this.#playback.stop();
      return;
    }
    const newIdx = appState.get('queueIndex') + 1;
    appState.set({ queueIndex: newIdx });
    await this.#playTrack(appState.get('queue')[newIdx].track);
  }

  async previous() {
    const pos = appState.get('playback').positionSec;
    if (pos > 3) {
      // Restart current track if we're past 3 seconds
      await this.#playTrack(appState.currentQueueItem?.track);
      return;
    }
    if (!appState.hasPrev) return;
    const newIdx = appState.get('queueIndex') - 1;
    appState.set({ queueIndex: newIdx });
    await this.#playTrack(appState.get('queue')[newIdx].track);
  }

  async pause()  { await this.#playback.pause(); }
  async resume() { await this.#playback.resume(); }
  async stop()   { await this.#playback.stop(); }

  async setVolume(level) { await this.#playback.setVolume(level); }

  async seek(positionSec) {
    if (this.#playback.seek) await this.#playback.seek(positionSec);
  }

  async selectSpeaker(id) {
    try {
      await this.#playback.selectSpeaker(id);
      appState.set({ selectedSpeakerId: id });
    } catch (err) {
      appState.notify(err.message, 'error');
    }
  }

  async refreshSpeakers() {
    const speakers = await this.#playback.getSpeakers();
    appState.set({ speakers });
  }

  // ─── Queue management ─────────────────────────────────────────────────────

  removeFromQueue(queueId) {
    const queue = appState.get('queue').filter(i => i.queueId !== queueId);
    const idx   = appState.get('queueIndex');
    appState.set({ queue, queueIndex: Math.min(idx, queue.length - 1) });
  }

  clearQueue() {
    this.#playback.stop();
    appState.set({ queue: [], queueIndex: -1 });
  }

  // ─── Favorites ────────────────────────────────────────────────────────────

  toggleFavorite(track) {
    const favs = appState.get('favorites');
    const exists = favs.some(f => f.id === track.id);
    const updated = exists
      ? favs.filter(f => f.id !== track.id)
      : [...favs, track];
    appState.set({ favorites: updated });
    this.#storage.saveFavorites(updated);
    appState.notify(
      exists ? `„${track.title}" aus Favoriten entfernt.` : `„${track.title}" zu Favoriten hinzugefügt.`,
      'info'
    );
  }

  isFavorite(trackId) {
    return appState.get('favorites').some(f => f.id === trackId);
  }

  // ─── Playlists ────────────────────────────────────────────────────────────

  createPlaylist(name) {
    const pl = createPlaylist(name.trim());
    const updated = [...appState.get('playlists'), pl];
    appState.set({ playlists: updated });
    this.#storage.savePlaylists(updated);
    return pl;
  }

  renamePlaylist(id, newName) {
    const updated = appState.get('playlists').map(pl =>
      pl.id === id ? { ...pl, name: newName.trim(), updatedAt: Date.now() } : pl
    );
    appState.set({ playlists: updated });
    this.#storage.savePlaylists(updated);
  }

  deletePlaylist(id) {
    const updated = appState.get('playlists').filter(pl => pl.id !== id);
    appState.set({ playlists: updated });
    this.#storage.savePlaylists(updated);
  }

  addTrackToPlaylist(playlistId, track) {
    const updated = appState.get('playlists').map(pl => {
      if (pl.id !== playlistId) return pl;
      if (pl.tracks.some(t => t.id === track.id)) return pl; // no duplicates
      return { ...pl, tracks: [...pl.tracks, track], updatedAt: Date.now() };
    });
    appState.set({ playlists: updated });
    this.#storage.savePlaylists(updated);
  }

  removeTrackFromPlaylist(playlistId, trackId) {
    const updated = appState.get('playlists').map(pl =>
      pl.id === playlistId
        ? { ...pl, tracks: pl.tracks.filter(t => t.id !== trackId), updatedAt: Date.now() }
        : pl
    );
    appState.set({ playlists: updated });
    this.#storage.savePlaylists(updated);
  }

  async playPlaylist(playlistId) {
    const pl = appState.get('playlists').find(p => p.id === playlistId);
    if (!pl || !pl.tracks.length) return;
    const items = pl.tracks.map(createQueueItem);
    appState.set({ queue: items, queueIndex: 0 });
    await this.#playTrack(pl.tracks[0]);
  }

  addPlaylistToQueue(playlistId) {
    const pl = appState.get('playlists').find(p => p.id === playlistId);
    if (!pl || !pl.tracks.length) return;
    const items = [...appState.get('queue'), ...pl.tracks.map(createQueueItem)];
    appState.set({ queue: items });
    appState.notify(`Playlist „${pl.name}" zur Warteschlange hinzugefügt.`, 'info');
  }

  // ─── Settings ─────────────────────────────────────────────────────────────

  async saveSettings(settings) {
    await this.#storage.saveSettings(settings);
    if (settings.ai) this.#search.updateAiConfig(settings.ai);
    appState.notify('Einstellungen gespeichert.', 'info');
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  async #playTrack(track) {
    if (!track) return;
    try {
      await this.#playback.play(track);
    } catch (err) {
      log.error('playback failed:', { trackId: track.id, error: err.message });
      appState.notify(`${t('errorStream')} ${t('tryNext')}`, 'error');
      // Auto-advance to next track after error
      setTimeout(() => this.next(), 2000);
    }
  }

  #onTrackEnded() {
    const repeat = appState.get('playback').repeat;
    if (repeat === 'one') {
      const track = appState.currentQueueItem?.track;
      if (track) this.#playTrack(track);
      return;
    }
    if (appState.hasNext) {
      this.next();
    } else if (repeat === 'all' && appState.get('queue').length > 0) {
      appState.set({ queueIndex: 0 });
      this.#playTrack(appState.get('queue')[0].track);
    }
  }

  async #loadPlaylistAndPlay(searchResult) {
    // If result has pre-fetched videos (from resolveUrl), use them directly
    const videos = searchResult._videos;
    if (!videos?.length) {
      appState.notify('Playlist enthält keine ladbaren Titel.', 'warn');
      return;
    }
    const items = videos.map(v => createQueueItem(trackFromSearchResult(v)));
    appState.set({ queue: items, queueIndex: 0 });
    await this.#playTrack(items[0].track);
  }
}
