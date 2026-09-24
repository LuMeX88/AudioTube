/**
 * AI-enhanced Search Client
 *
 * Wraps a SearchProvider and optionally augments results with an
 * OpenAI-compatible LLM (Azure OpenAI, OpenAI, or any
 * OpenAI-compatible endpoint).
 *
 * Configuration via js/config.js (or the AudioTube integration settings).
 *
 * AI enhancement is OPTIONAL and does not replace the core search.
 * App works fully without an AI endpoint.
 *
 * @module core/search/SearchClient
 */

import { appState } from '../state/AppState.js';

export class SearchClient {
  #provider;       // SearchProvider implementation
  #aiConfig;       // { baseUrl, apiKey, model, enabled }

  /**
   * @param {object} provider  - implements SearchProvider interface
   * @param {object} [aiConfig]
   * @param {string} [aiConfig.baseUrl]  - OpenAI-compatible base URL
   * @param {string} [aiConfig.apiKey]
   * @param {string} [aiConfig.model]    - e.g. 'gpt-4o-mini'
   * @param {boolean}[aiConfig.enabled]
   */
  constructor(provider, aiConfig = {}) {
    this.#provider = provider;
    this.#aiConfig = {
      baseUrl: aiConfig.baseUrl || '',
      apiKey: aiConfig.apiKey || '',
      model: aiConfig.model || 'gpt-4o-mini',
      enabled: aiConfig.enabled || false,
    };
  }

  /**
   * Search for tracks and/or playlists.
   * If AI is enabled, sends query through LLM for query rewriting first.
   * @param {string} query
   * @param {'track'|'playlist'|'all'} type
   * @returns {Promise<SearchResult[]>}
   */
  async search(query, type = 'all') {
    const effectiveQuery = this.#aiConfig.enabled
      ? await this.#rewriteQuery(query)
      : query;

    return this.#provider.search(effectiveQuery, type);
  }

  async resolveUrl(url) {
    return this.#provider.resolveUrl(url);
  }

  async getAudioStreamUrl(videoId) {
    return this.#provider.getAudioStreamUrl(videoId);
  }

  async getWaveform(videoId) {
    return this.#provider.getWaveform(videoId);
  }

  async prefetch(videoIds) {
    return this.#provider.prefetch?.(videoIds);
  }

  async setPinnedTracks(videoIds) {
    return this.#provider.setPinnedTracks?.(videoIds);
  }

  // ─── AI query rewriting ────────────────────────────────────────────────────
  // Improves YouTube search quality by normalising artist/track names.
  // Configure the AI endpoint in Settings → AI settings.

  async #rewriteQuery(rawQuery) {
    const { baseUrl, apiKey, model } = this.#aiConfig;
    if (!baseUrl || !apiKey) return rawQuery;

    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content:
                'You are a YouTube search query optimizer. ' +
                'Rewrite the user query to improve YouTube search results for music discovery. ' +
                'Return ONLY the rewritten query — no explanation, no quotes, no formatting.',
            },
            { role: 'user', content: rawQuery },
          ],
          max_tokens: 60,
          temperature: 0.2,
        }),
      });

      if (!res.ok) return rawQuery;
      const data = await res.json();
      return data.choices?.[0]?.message?.content?.trim() || rawQuery;
    } catch (e) {
      console.warn('[SearchClient] AI query rewrite failed, using original:', e.message);
      return rawQuery;
    }
  }

  updateAiConfig(patch) {
    Object.assign(this.#aiConfig, patch);
  }
}
