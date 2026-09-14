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
    const states = await this.#call('get_states');
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
  }

  async play(track) {
    if (!this.#selectedSpeakerId) throw new Error('Kein Lautsprecher ausgewählt.');
    this.#patchState({ status: 'loading', currentTrack: track });
    const streamUrl = await this.#streamUrlResolver(track.id);
    await this.#call('call_service', {
      domain: 'media_player',
      service: 'play_media',
      service_data: {
        entity_id: this.#selectedSpeakerId,
        media_content_id: streamUrl,
        media_content_type: 'music',
      },
    });
    this.#patchState({ status: 'playing' });
  }

  async pause() { await this.#callService('media_pause'); this.#patchState({ status: 'paused' }); }
  async resume() { await this.#callService('media_play'); this.#patchState({ status: 'playing' }); }
  async stop() { await this.#callService('media_stop'); this.#patchState(defaultPlaybackState()); }
  async next() { await this.#callService('media_next_track'); }
  async previous() { await this.#callService('media_previous_track'); }

  async setVolume(level) {
    await this.#callService('volume_set', { volume_level: Math.max(0, Math.min(100, level)) / 100 });
    this.#patchState({ volume: level });
  }

  async #callService(service, serviceData = {}) {
    if (!this.#selectedSpeakerId) return;
    await this.#call('call_service', {
      domain: 'media_player',
      service,
      service_data: { entity_id: this.#selectedSpeakerId, ...serviceData },
    });
  }

  onStateChange(callback) { this.#stateCallbacks.add(callback); callback({ ...this.#state }); }
  destroy() { this.#socket?.close(); this.#stateCallbacks.clear(); }

  #patchState(patch) {
    this.#state = { ...this.#state, ...patch };
    for (const callback of this.#stateCallbacks) callback({ ...this.#state });
  }
}