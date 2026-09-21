/**
 * Invidious Search Provider
 * Uses public Invidious instances (open-source YouTube frontend).
 * No Google API key required. No login required.
 *
 * Invidious API docs: https://docs.invidious.io/api/
 *
 * NF-01 / NF-02 / NF-03 compliant: anonymous, no key, no premium.
 * @module core/search/InvidiousSearchProvider
 */

/** Public Invidious instances — tried in order, first success wins. */
const INVIDIOUS_INSTANCES = [
  'https://invidious.nerdvpn.de',
  'https://yt.artemislena.eu',
  'https://invidious.privacyredirect.com',
  'https://invidious.fdn.fr',
];

const DEFAULT_TIMEOUT_MS = 30000;
const MAX_RESULTS = 30;

export class InvidiousSearchProvider {
  #proxyBaseUrl;  // e.g. 'http://localhost:3001' — used for stream URL only

  /**
   * @param {object} options
   * @param {string} [options.proxyBaseUrl] - URL of the local dev proxy server
   */
  constructor({ proxyBaseUrl = '' } = {}) {
    this.#proxyBaseUrl = proxyBaseUrl;
  }

  // ─── SearchProvider interface ─────────────────────────────────────────────

  /**
   * @param {string} query
   * @param {'track'|'playlist'|'all'} type
   * @returns {Promise<SearchResult[]>}
   */
  async search(query, type = 'all') {
    if (!query.trim()) return [];

    const results = [];

    if (type === 'track' || type === 'all') {
      const videos = await this.#searchVideos(query);
      results.push(...videos);
    }

    if (type === 'playlist' || type === 'all') {
      const playlists = await this.#searchPlaylists(query);
      results.push(...playlists);
    }

    return results;
  }

  /**
   * Resolves a YouTube URL (video or playlist) to SearchResult(s).
   * @param {string} url
   * @returns {Promise<SearchResult[]>}
   */
  async resolveUrl(url) {
    const videoId = this.#extractVideoId(url);
    const playlistId = this.#extractPlaylistId(url);

    if (playlistId) return this.#fetchPlaylistItems(playlistId);
    if (videoId)   return [await this.#fetchVideoById(videoId)];

    throw new Error('Ungültige YouTube-URL.');
  }

  /**
   * Returns a proxied audio-only stream URL.
   * Requires the local proxy server (proxy-server.js) to be running.
   * @param {string} videoId
   * @returns {Promise<string>}
   */
  async getAudioStreamUrl(videoId) {
    if (!this.#proxyBaseUrl) {
      throw new Error('Proxy-Server URL nicht konfiguriert (Einstellungen → Proxy URL).');
    }
    const url = `${this.#proxyBaseUrl}/api/stream?videoId=${encodeURIComponent(videoId)}`;
    const res = await this.#fetchWithTimeout(url);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Stream-Fehler: HTTP ${res.status}`);
    }
    const data = await res.json();
    // The proxy may return a relative URL (e.g. /api/audio?...); resolve it
    // against the proxy base so the browser targets the proxy, not the app host.
    const streamUrl = data.streamUrl;
    if (streamUrl && streamUrl.startsWith('/')) {
      return `${this.#proxyBaseUrl}${streamUrl}`;
    }
    return streamUrl;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  async #searchVideos(query) {
    const params = new URLSearchParams({
      q: query,
      type: 'video',
      fields: 'videoId,title,author,lengthSeconds,videoThumbnails',
    });
    const data = await this.#fetchFromAnyInstance(`/api/v1/search?${params}`);
    return (data || []).slice(0, MAX_RESULTS).map(item => this.#mapVideo(item));
  }

  async #searchPlaylists(query) {
    const params = new URLSearchParams({
      q: query,
      type: 'playlist',
      fields: 'playlistId,title,author,videoCount,playlistThumbnail',
    });
    const data = await this.#fetchFromAnyInstance(`/api/v1/search?${params}`);
    return (data || []).slice(0, MAX_RESULTS / 2).map(item => this.#mapPlaylist(item));
  }

  async #fetchPlaylistItems(playlistId) {
    const params = new URLSearchParams({
      fields: 'title,playlistId,author,videos',
    });
    const data = await this.#fetchFromAnyInstance(
      `/api/v1/playlists/${encodeURIComponent(playlistId)}?${params}`
    );
    // Return single playlist result; caller can expand videos when playing
    return [this.#mapPlaylistDetail(data)];
  }

  async #fetchVideoById(videoId) {
    const data = await this.#fetchFromAnyInstance(`/api/v1/videos/${encodeURIComponent(videoId)}`);
    return this.#mapVideo(data);
  }

  /**
   * Tries each Invidious instance until one succeeds.
   *
   * When a proxy server is configured, the request is routed through it
   * (`<proxy>/api/invidious?path=...`). This avoids browser CORS failures,
   * since public Invidious instances do not send `Access-Control-Allow-Origin`.
   * @param {string} path  - API path starting with /
   */
  async #fetchFromAnyInstance(path) {
    if (this.#proxyBaseUrl) {
      const url = `${this.#proxyBaseUrl}/api/invidious?path=${encodeURIComponent(path)}`;
      const res = await this.#fetchWithTimeout(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Suche fehlgeschlagen: HTTP ${res.status}`);
      }
      return await res.json();
    }

    let lastError;
    for (const base of INVIDIOUS_INSTANCES) {
      try {
        const res = await this.#fetchWithTimeout(base + path);
        if (!res.ok) continue;
        return await res.json();
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError || new Error('Alle Invidious-Instanzen nicht erreichbar.');
  }

  async #fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  // ─── Mappers ──────────────────────────────────────────────────────────────

  #mapVideo(item) {
    return {
      type: 'track',
      id: item.videoId,
      title: item.title || 'Unbekannter Titel',
      artist: item.author || 'Unbekannter Kanal',
      durationSec: item.lengthSeconds || 0,
      trackCount: 0,
      thumbnailUrl: this.#bestThumbnail(item.videoThumbnails),
      videoUrl: `https://www.youtube.com/watch?v=${item.videoId}`,
    };
  }

  #mapPlaylist(item) {
    return {
      type: 'playlist',
      id: item.playlistId,
      title: item.title || 'Unbekannte Playlist',
      artist: item.author || '',
      durationSec: 0,
      trackCount: item.videoCount || 0,
      thumbnailUrl: item.playlistThumbnail || '',
      videoUrl: `https://www.youtube.com/playlist?list=${item.playlistId}`,
    };
  }

  #mapPlaylistDetail(item) {
    return {
      type: 'playlist',
      id: item.playlistId,
      title: item.title || 'Unbekannte Playlist',
      artist: item.author || '',
      durationSec: 0,
      trackCount: (item.videos || []).length,
      thumbnailUrl: (item.videos?.[0]?.videoThumbnails
        ? this.#bestThumbnail(item.videos[0].videoThumbnails)
        : ''),
      videoUrl: `https://www.youtube.com/playlist?list=${item.playlistId}`,
      // Extra: raw video list for immediate queue expansion
      _videos: (item.videos || []).map(v => this.#mapVideo(v)),
    };
  }

  #bestThumbnail(thumbnails) {
    if (!Array.isArray(thumbnails) || !thumbnails.length) return '';
    // Prefer medium quality (~320px) thumbnail
    const medium = thumbnails.find(t => t.quality === 'medium' || t.quality === 'sddefault');
    return (medium || thumbnails[0]).url || '';
  }

  #extractVideoId(url) {
    try {
      const u = new URL(url);
      if (u.hostname.includes('youtu.be')) return u.pathname.slice(1);
      if (u.hostname.includes('youtube.com')) return u.searchParams.get('v');
    } catch { /* not a URL */ }
    return null;
  }

  #extractPlaylistId(url) {
    try {
      const u = new URL(url);
      return u.searchParams.get('list');
    } catch { /* not a URL */ }
    return null;
  }
}
