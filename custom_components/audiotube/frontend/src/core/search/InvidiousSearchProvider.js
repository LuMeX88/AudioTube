/**
 * AudioTube built-in search provider.
 * Talks only to the AudioTube Home Assistant integration's own HTTP API
 * (search, resolve, audio) — no external proxy or Invidious instance needed.
 * @module core/search/InvidiousSearchProvider
 */
import { log } from '../log.js';
import { getAccessToken } from '../../../js/haAuth.js';

const DEFAULT_TIMEOUT_MS = 30000;
const PREPARE_TIMEOUT_MS = 180000;

export class InvidiousSearchProvider {
  // ─── SearchProvider interface ─────────────────────────────────────────────

  /**
   * @param {string} query
   * @param {'track'|'playlist'|'all'} type
   * @returns {Promise<SearchResult[]>}
   */
  async search(query, type = 'all') {
    if (!query.trim() || type === 'playlist') return [];
    const params = new URLSearchParams({ q: query });
    return this.#fetchJson(`/api/audiotube/search?${params}`);
  }

  /**
   * Resolves a YouTube video or playlist URL to SearchResult(s).
   * @param {string} url
   * @returns {Promise<SearchResult[]>}
   */
  async resolveUrl(url) {
    const params = new URLSearchParams({ url });
    const results = await this.#fetchJson(`/api/audiotube/resolve?${params}`);
    if (results.length <= 1) return results;

    // Multiple entries: treat as a playlist so the queue can expand them.
    return [{
      type: 'playlist',
      id: results[0]?.id || url,
      title: 'Playlist',
      artist: '',
      durationSec: 0,
      trackCount: results.length,
      thumbnailUrl: results[0]?.thumbnailUrl || '',
      videoUrl: url,
      _videos: results,
    }];
  }

  /**
   * Returns the audio-only stream URL for a video, served by the integration itself.
   * Absolute, so LAN speakers (e.g. Sonos) can resolve it independent of the
   * browser's page context. The file is downloaded and cached first, because
   * speakers time out if the very first request has to wait for yt-dlp.
   * @param {string} videoId
   * @returns {Promise<string>}
   */
  async getAudioStreamUrl(videoId) {
    await this.#fetchJson(
      `/api/audiotube/prepare/${encodeURIComponent(videoId)}`,
      PREPARE_TIMEOUT_MS,
    );
    return `${location.origin}/api/audiotube/audio/${encodeURIComponent(videoId)}.mp3`;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  async #fetchJson(url, timeoutMs = DEFAULT_TIMEOUT_MS, retried = false) {
    const accessToken = await getAccessToken();
    log.debug('request', { url, hasToken: Boolean(accessToken) });
    const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await fetch(url, { headers, signal: controller.signal });
    } catch (err) {
      log.error('fetch threw before a response was received', { url, error: err.message });
      throw err;
    } finally {
      clearTimeout(timer);
    }
    log.debug('response', { url, status: res.status });
    if (res.status === 401) {
      // The token can be stale for a moment after a refresh; force a fresh one and retry once.
      if (!retried) {
        await getAccessToken({ force: true });
        return this.#fetchJson(url, timeoutMs, true);
      }
      log.error('unauthorized', { url, hasToken: Boolean(accessToken) });
      throw new Error('Home Assistant-Anmeldung abgelaufen. Bitte Home Assistant neu laden.');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      log.error('request failed', { url, status: res.status, body: err });
      throw new Error(err.error || `Anfrage fehlgeschlagen: HTTP ${res.status}`);
    }
    return res.json();
  }
}

