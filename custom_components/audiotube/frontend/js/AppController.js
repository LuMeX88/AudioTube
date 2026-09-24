/**
 * App Controller — wires state, adapters, and search together.
 * Handles queue logic, navigation, and persistence.
 * @module apps/local/js/AppController
 */

import { appState } from '../src/core/state/AppState.js?v=20260924-1';
import { createQueueItem, createPlaylist, createGroup as createSpeakerGroup, trackFromSearchResult } from '../src/core/models.js?v=20260924-1';
import { t } from '../src/core/i18n/i18n.js?v=20260924-2';
import { log } from '../src/core/log.js';
import { stringify as toYaml, parse as fromYaml } from '../src/core/yaml.js?v=20260923-1';

const THEMES = ['light', 'dark', 'system', 'oled', 'sepia', 'contrast'];

function applyTheme(theme) {
  if (theme && theme !== 'system') {
    document.documentElement.setAttribute('data-theme', theme);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

/** Combine two id-keyed lists, keeping existing entries and adding only new ids. */
function mergeById(existing, incoming) {
  const existingIds = new Set(existing.map(item => item.id));
  return [...existing, ...incoming.filter(item => !existingIds.has(item.id))];
}

export class AppController {
  #playback;    // PlaybackAdapter
  #search;      // SearchClient
  #storage;     // StorageAdapter
  #navigating = false; // guards next()/previous() against overlapping calls (fast double-clicks, auto-advance)

  constructor({ playbackAdapter, searchClient, storageAdapter }) {
    this.#playback = playbackAdapter;
    this.#search   = searchClient;
    this.#storage  = storageAdapter;
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  async init() {
    // Load persisted data
    const [favorites, playlists, groups, queue, settings] = await Promise.all([
      this.#storage.getFavorites(),
      this.#storage.getPlaylists(),
      this.#storage.getGroups(),
      this.#storage.getQueue(),
      this.#storage.getSettings(),
    ]);

    appState.set({ favorites, playlists, groups, queue });
    applyTheme(settings?.theme);

    // Apply settings to search client
    if (settings?.ai) {
      this.#search.updateAiConfig(settings.ai);
    }

    // Live sync: if the storage adapter supports it (HA per-user storage),
    // pick up favorites/playlists changes made from any other device logged
    // into the same account, without needing to leave and reopen this panel.
    this.#storage.subscribeFavorites?.(favs => appState.set({ favorites: favs }));
    this.#storage.subscribePlaylists?.(pls  => appState.set({ playlists: pls }));
    this.#storage.subscribeGroups?.(groups  => appState.set({ groups }));

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

    // Restore the previously used target (a plain speaker or a `group:<id>`
    // saved target), falling back to the first available speaker.
    const targets = this.getSelectableTargets();
    const target = targets.find(s => s.id === settings?.selectedSpeakerId && s.isAvailable)
      ?? targets.find(s => s.type === 'speaker' && s.isAvailable);
    if (target) {
      await this.selectSpeaker(target.id);
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
    if (this.#navigating) return;
    this.#navigating = true;
    try {
      if (!appState.hasNext) {
        await this.#playback.stop();
        return;
      }
      const newIdx = appState.get('queueIndex') + 1;
      appState.set({ queueIndex: newIdx });
      await this.#playTrack(appState.get('queue')[newIdx].track);
    } finally {
      this.#navigating = false;
    }
  }

  async previous() {
    if (this.#navigating) return;
    this.#navigating = true;
    try {
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
    } finally {
      this.#navigating = false;
    }
  }

  async pause()  { await this.#playback.pause(); }
  async resume() { await this.#playback.resume(); }
  async stop()   { await this.#playback.stop(); }

  async setVolume(level) { await this.#playback.setVolume(level); }

  /** Real analyzed amplitude peaks (0..1) for a track's waveform progress bar. */
  async getWaveform(videoId) {
    return this.#search.getWaveform(videoId);
  }

  async seek(positionSec) {
    if (this.#playback.seek) await this.#playback.seek(positionSec);
  }

  async selectSpeaker(id) {
    try {
      const memberIds = this.#resolveGroupMemberIds(id);
      await this.#playback.selectSpeaker(id, memberIds);
      appState.set({ selectedSpeakerId: id });
      const settings = await this.#storage.getSettings();
      await this.#storage.saveSettings({ ...settings, selectedSpeakerId: id });
    } catch (err) {
      appState.notify(err.message, 'error');
    }
  }

  async refreshSpeakers() {
    const speakers = await this.#playback.getSpeakers();
    appState.set({ speakers });
  }

  /**
   * Speakers plus user-defined groups, combined into one list for the
   * speaker-picker UI (groups shown as `group:<id>` synthetic targets).
   * @returns {Array} Speaker[] with type 'speaker' or 'group'
   */
  getSelectableTargets() {
    const speakers = appState.get('speakers');
    const groups = appState.get('groups');
    const groupEntries = groups.map(g => {
      const members = speakers.filter(s => g.speakerIds.includes(s.id));
      return {
        id: `group:${g.id}`,
        name: g.name,
        type: 'group',
        isAvailable: members.some(m => m.isAvailable),
        volume: members[0]?.volume ?? 50,
      };
    });
    return [...speakers, ...groupEntries];
  }

  /** @returns {string[]|null} member entity ids if `id` is a `group:<id>` target, else null. */
  #resolveGroupMemberIds(id) {
    if (!id?.startsWith('group:')) return null;
    const groupId = id.slice('group:'.length);
    const group = appState.get('groups').find(g => g.id === groupId);
    if (!group) throw new Error('Gruppe nicht gefunden.');
    const speakers = appState.get('speakers');
    const memberIds = group.speakerIds.filter(sid => speakers.some(s => s.id === sid && s.isAvailable));
    if (!memberIds.length) throw new Error(`Kein verfügbarer Lautsprecher in Gruppe „${group.name}".`);
    return memberIds;
  }

  // ─── Speaker groups ───────────────────────────────────────────────────────

  createGroup(name, speakerIds = []) {
    const group = createSpeakerGroup(name.trim(), speakerIds);
    const updated = [...appState.get('groups'), group];
    appState.set({ groups: updated });
    this.#storage.saveGroups(updated);
    return group;
  }

  renameGroup(id, newName) {
    const updated = appState.get('groups').map(g =>
      g.id === id ? { ...g, name: newName.trim(), updatedAt: Date.now() } : g
    );
    appState.set({ groups: updated });
    this.#storage.saveGroups(updated);
  }

  deleteGroup(id) {
    const updated = appState.get('groups').filter(g => g.id !== id);
    appState.set({ groups: updated });
    this.#storage.saveGroups(updated);
    // If the deleted group was the active playback target, fall back to nothing selected.
    if (appState.get('selectedSpeakerId') === `group:${id}`) {
      appState.set({ selectedSpeakerId: null });
    }
  }

  /** Replace a group's member speaker ids (a speaker may be in several groups). */
  setGroupMembers(id, speakerIds) {
    const updated = appState.get('groups').map(g =>
      g.id === id ? { ...g, speakerIds: [...speakerIds], updatedAt: Date.now() } : g
    );
    appState.set({ groups: updated });
    this.#storage.saveGroups(updated);
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

  /** Reorder the queue to match the given queueIds, keeping the current track current. */
  reorderQueue(queueIds) {
    const queue = appState.get('queue');
    const playingId = queue[appState.get('queueIndex')]?.queueId;

    const reordered = queueIds
      .map(id => queue.find(item => item.queueId === id))
      .filter(Boolean);
    if (reordered.length !== queue.length) return;

    appState.set({
      queue: reordered,
      queueIndex: playingId
        ? reordered.findIndex(item => item.queueId === playingId)
        : appState.get('queueIndex'),
    });
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

  /** Reorder one playlist's tracks to match the given track ids. */
  reorderPlaylist(playlistId, trackIds) {
    const updated = appState.get('playlists').map(pl => {
      if (pl.id !== playlistId) return pl;
      const tracks = trackIds.map(id => pl.tracks.find(t => t.id === id)).filter(Boolean);
      if (tracks.length !== pl.tracks.length) return pl;
      return { ...pl, tracks, updatedAt: Date.now() };
    });
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

  async getSettings() {
    return this.#storage.getSettings();
  }

  async saveSettings(settings) {
    await this.#storage.saveSettings(settings);
    if (settings.ai) this.#search.updateAiConfig(settings.ai);
    appState.notify('Einstellungen gespeichert.', 'info');
  }

  async setTheme(theme) {
    if (!THEMES.includes(theme)) return;
    applyTheme(theme);
    const settings = await this.#storage.getSettings();
    await this.#storage.saveSettings({ ...settings, theme });
  }

  // ─── Backup (export/import favorites & playlists as YAML) ─────────────────

  /** @returns {string} a YAML document with the current favorites and playlists. */
  exportBackupYaml() {
    return toYaml({
      favorites: appState.get('favorites'),
      playlists: appState.get('playlists'),
    });
  }

  /**
   * Imports favorites/playlists from a previously exported YAML document.
   * @param {string} yamlText
   * @param {{ replace?: boolean }} [options] - replace=true overwrites
   *   existing data instead of merging (deduping by id) into it.
   * @returns {{ favoritesCount: number, playlistsCount: number }}
   */
  async importBackupYaml(yamlText, { replace = false } = {}) {
    const data = fromYaml(yamlText);
    const importedFavorites = Array.isArray(data.favorites) ? data.favorites : [];
    const importedPlaylists = Array.isArray(data.playlists) ? data.playlists : [];

    const favorites = replace
      ? importedFavorites
      : mergeById(appState.get('favorites'), importedFavorites);
    const playlists = replace
      ? importedPlaylists
      : mergeById(appState.get('playlists'), importedPlaylists);

    appState.set({ favorites, playlists });
    await Promise.all([
      this.#storage.saveFavorites(favorites),
      this.#storage.savePlaylists(playlists),
    ]);

    return { favoritesCount: importedFavorites.length, playlistsCount: importedPlaylists.length };
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
