/**
 * Home Assistant playback adapter used when AudioTube is embedded in HA.
 * It reads media_player states and sends playback commands through the HA
 * websocket API using the existing frontend session.
 */
import { defaultPlaybackState } from '../../../src/core/models.js';

const WS_URL = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/websocket`;

export class HAPlaybackAdapter {
  #socket;
  #nextId = 1;
  #pending = new Map();
  #selectedSpeakerId = null;
  #stateCallbacks = new Set();
  #state = defaultPlaybackState();
  #streamUrlResolver;
  #pollTimer;
  #lastRemoteStatus = 'idle';

  constructor(streamUrlResolver) {
    this.#streamUrlResolver = streamUrlResolver;
  }

  async #connect() {
    if (this.#socket?.readyState === WebSocket.OPEN) return;

    const tokens = JSON.parse(localStorage.getItem('hassTokens') || '{}');
    if (!tokens.access_token || (tokens.expires && tokens.expires <= Date.now())) {
      window.top.location.href = '/';
      throw new Error('Home Assistant-Anmeldung abgelaufen.');
    }

    await new Promise((resolve, reject) => {
      const socket = new WebSocket(WS_URL);
      const timeout = setTimeout(() => {
        socket.close();
        reject(new Error('Home Assistant-WebSocket antwortet nicht. Bitte Home Assistant neu laden.'));
      }, 8000);
      const fail = error => {
        clearTimeout(timeout);
        socket.close();
        reject(error);
      };
      socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'auth', access_token: tokens.access_token }));
      };
      socket.onmessage = event => {
        const message = JSON.parse(event.data);
        if (message.type === 'auth_ok') {
          clearTimeout(timeout);
          this.#socket = socket;
          this.#startPolling();
          resolve();
          return;
        }
        if (message.type === 'auth_invalid') {
          fail(new Error('Home Assistant-Anmeldung ist abgelaufen. Bitte Home Assistant neu laden.'));
          window.top.location.href = '/';
          return;
        }
        if (message.id && this.#pending.has(message.id)) {
          const pending = this.#pending.get(message.id);
          this.#pending.delete(message.id);
          if (message.success) pending.resolve(message.result);
          else pending.reject(new Error(message.error?.message || 'Home Assistant request failed.'));
        }
      };
      socket.onerror = () => fail(new Error('Home Assistant-WebSocket konnte nicht verbunden werden.'));
      socket.onclose = () => {
        this.#socket = null;
        for (const pending of this.#pending.values()) pending.reject(new Error('Home Assistant WebSocket geschlossen.'));
        this.#pending.clear();
      };
    });
  }

  async #call(type, payload = {}) {
    await this.#connect();
    const id = this.#nextId++;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#socket.send(JSON.stringify({ id, type, ...payload }));
    });
  }

  async getSpeakers() {
    const states = await this.#apiRequest('/api/states');
    return states
      .filter(state => state.entity_id.startsWith('media_player.'))
      .map(state => ({
        id: state.entity_id,
        name: state.attributes.friendly_name || state.entity_id,
        type: 'speaker',
        isAvailable: !['unavailable', 'unknown'].includes(state.state),
        volume: Math.round((state.attributes.volume_level ?? 0.5) * 100),
      }));
  }

  async selectSpeaker(id) {
    const speakers = await this.getSpeakers();
    if (!speakers.some(speaker => speaker.id === id)) throw new Error(`Lautsprecher "${id}" nicht gefunden.`);
    this.#selectedSpeakerId = id;
    const speaker = speakers.find(item => item.id === id);
    this.#patchState({ volume: speaker.volume });
    this.#startPolling();
  }

  async play(track) {
    if (!this.#selectedSpeakerId) throw new Error('Kein Lautsprecher ausgewählt.');
    this.#lastRemoteStatus = 'playing';
    this.#patchState({ status: 'loading', currentTrack: track });
    const streamUrl = await this.#streamUrlResolver(track.id);
    await this.#apiRequest('/api/services/tube_audio_player/play_media', {
      method: 'POST',
      body: JSON.stringify({
        entity_id: this.#selectedSpeakerId,
        media_url: streamUrl,
        title: track.title,
        artist: track.artist,
      }),
    });
    this.#patchState({ status: 'playing' });
    this.#startPolling();
  }

  async pause() { await this.#callService('media_pause'); this.#patchState({ status: 'paused' }); }
  async resume() { await this.#callService('media_play'); this.#patchState({ status: 'playing' }); }
  async stop() {
    await this.#callService('media_stop');
    this.#lastRemoteStatus = 'idle';
    this.#patchState(defaultPlaybackState());
  }
  async next() { await this.#callService('media_next_track'); }
  async previous() { await this.#callService('media_previous_track'); }

  async setVolume(level) {
    await this.#callService('volume_set', { volume_level: Math.max(0, Math.min(100, level)) / 100 });
    this.#patchState({ volume: level });
  }

  async seek(positionSec) {
    await this.#callService('media_seek', { seek_position: Math.max(0, positionSec) });
    this.#patchState({ positionSec: Math.max(0, positionSec) });
  }

  async #callService(service, serviceData = {}) {
    if (!this.#selectedSpeakerId) return;
    await this.#apiRequest(`/api/services/media_player/${service}`, {
      method: 'POST',
      body: JSON.stringify({ entity_id: this.#selectedSpeakerId, ...serviceData }),
    });
  }

  async #apiRequest(path, options = {}) {
    const tokens = JSON.parse(localStorage.getItem('hassTokens') || '{}');
    if (!tokens.access_token || (tokens.expires && tokens.expires <= Date.now())) {
      window.top.location.href = '/';
      throw new Error('Home Assistant-Anmeldung abgelaufen.');
    }
    const response = await fetch(path, {
      ...options,
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    if (response.status === 401) {
      window.top.location.href = '/';
      throw new Error('Home Assistant-Anmeldung abgelaufen.');
    }
    if (!response.ok) throw new Error(`Home Assistant API Fehler: HTTP ${response.status}`);
    return response.status === 204 ? null : response.json();
  }

  onStateChange(callback) { this.#stateCallbacks.add(callback); callback({ ...this.#state }); }
  destroy() {
    clearInterval(this.#pollTimer);
    this.#socket?.close();
    this.#stateCallbacks.clear();
  }

  #startPolling() {
    if (this.#pollTimer) return;
    this.#pollTimer = setInterval(() => this.#pollState(), 1000);
    this.#pollState();
  }

  async #pollState() {
    if (!this.#selectedSpeakerId) return;
    try {
      const states = await this.#apiRequest('/api/states');
      const remote = states.find(state => state.entity_id === this.#selectedSpeakerId);
      if (!remote) return;

      const attributes = remote.attributes || {};
      const remoteStatus = remote.state;
      const durationSec = Number(attributes.media_duration || this.#state.currentTrack?.durationSec || 0);
      let positionSec = Number(attributes.media_position || 0);
      const updatedAt = Date.parse(attributes.media_position_updated_at || '');
      if (remoteStatus === 'playing' && Number.isFinite(updatedAt)) {
        positionSec += Math.max(0, (Date.now() - updatedAt) / 1000);
      }

      const status = remoteStatus === 'playing' ? 'playing'
        : remoteStatus === 'paused' ? 'paused'
        : remoteStatus === 'buffering' ? 'loading'
        : remoteStatus === 'idle' ? 'idle'
        : this.#state.status;

      this.#patchState({
        status,
        positionSec: Math.min(positionSec, durationSec || positionSec),
        durationSec,
        volume: Math.round((attributes.volume_level ?? this.#state.volume / 100) * 100),
      });

      if (this.#lastRemoteStatus === 'playing' && remoteStatus === 'idle') {
        this.#emit({ ...this.#state, _event: 'ended' });
      }
      this.#lastRemoteStatus = remoteStatus;
    } catch (error) {
      console.warn('[HAPlaybackAdapter] State polling failed:', error.message);
    }
  }

  #patchState(patch) {
    this.#state = { ...this.#state, ...patch };
    this.#emit(this.#state);
  }

  #emit(state) {
    for (const callback of this.#stateCallbacks) callback({ ...state });
  }
}