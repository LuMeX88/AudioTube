/**
 * Local Playback Adapter (Version B — Browser)
 *
 * Uses the HTML <audio> element for playback.
 * Provides mock speakers: "Browser", "Wohnzimmer (Mock)", "Küche (Mock)"
 * so that the speaker-selection UI can be tested without Sonos hardware.
 *
 * Implements: PlaybackAdapter interface (see src/core/interfaces.js)
 * @module adapters/local/LocalPlaybackAdapter
 */

import { defaultPlaybackState } from '../../core/models.js';

const MOCK_SPEAKERS = [
  { id: 'browser',       name: 'Browser (lokal)',    type: 'speaker', isAvailable: true,  volume: 50 },
  { id: 'mock-wohnzimmer', name: 'Wohnzimmer (Mock)', type: 'speaker', isAvailable: true,  volume: 70 },
  { id: 'mock-kueche',     name: 'Küche (Mock)',       type: 'speaker', isAvailable: false, volume: 40 },
  { id: 'mock-group-1',    name: 'Erdgeschoss (Gruppe)', type: 'group', isAvailable: true,  volume: 60 },
];

export class LocalPlaybackAdapter {
  #audio = new Audio();
  #speakers = MOCK_SPEAKERS.map(s => ({ ...s }));
  #selectedSpeakerId = 'browser';
  #stateCallbacks = new Set();
  #state = defaultPlaybackState();
  #streamUrlResolver; // async (videoId) => string — provided by SearchClient

  /**
   * @param {Function} streamUrlResolver  async (videoId: string) => Promise<string>
   */
  constructor(streamUrlResolver) {
    this.#streamUrlResolver = streamUrlResolver;
    this.#setupAudioListeners();
  }

  // ─── PlaybackAdapter interface ─────────────────────────────────────────────

  async getSpeakers() {
    return this.#speakers.map(s => ({ ...s }));
  }

  async selectSpeaker(id) {
    const speaker = this.#speakers.find(s => s.id === id);
    if (!speaker) throw new Error(`Lautsprecher "${id}" nicht gefunden.`);
    if (!speaker.isAvailable) throw new Error(`Lautsprecher "${speaker.name}" ist nicht verfügbar.`);
    this.#selectedSpeakerId = id;
    // Apply stored volume for the selected speaker
    this.#audio.volume = speaker.volume / 100;
    this.#patchState({ volume: speaker.volume });
  }

  async play(track) {
    this.#patchState({ status: 'loading', currentTrack: track });

    try {
      // Audio-only: NEVER create a video element (F-10)
      const streamUrl = await this.#streamUrlResolver(track.id);
      this.#audio.src = streamUrl;
      this.#audio.load();
      await this.#audio.play();
      this.#patchState({ status: 'playing', durationSec: this.#audio.duration || 0 });
    } catch (err) {
      console.error('[LocalPlaybackAdapter] play error:', err);
      this.#patchState({ status: 'error', currentTrack: track });
      throw err;
    }
  }

  async pause() {
    this.#audio.pause();
    this.#patchState({ status: 'paused' });
  }

  async resume() {
    await this.#audio.play();
    this.#patchState({ status: 'playing' });
  }

  async stop() {
    this.#audio.pause();
    this.#audio.src = '';
    this.#patchState({ ...defaultPlaybackState() });
  }

  // next/previous are delegated to the queue controller (AppController),
  // which calls play() with the appropriate track.
  async next()     { /* handled by AppController */ }
  async previous() { /* handled by AppController */ }

  async setVolume(level) {
    const clamped = Math.max(0, Math.min(100, level));
    this.#audio.volume = clamped / 100;
    const sp = this.#speakers.find(s => s.id === this.#selectedSpeakerId);
    if (sp) sp.volume = clamped;
    this.#patchState({ volume: clamped });
  }

  async seek(positionSec) {
    this.#audio.currentTime = Math.max(0, Math.min(positionSec, this.#audio.duration || positionSec));
    this.#patchState({ positionSec: this.#audio.currentTime });
  }

  onStateChange(cb) {
    this.#stateCallbacks.add(cb);
    // Immediately emit current state
    cb({ ...this.#state });
  }

  destroy() {
    this.#audio.pause();
    this.#audio.src = '';
    this.#stateCallbacks.clear();
    this.#removeAudioListeners();
  }

  // ─── Audio element listeners ──────────────────────────────────────────────

  #setupAudioListeners() {
    this.#onTimeUpdate = () => {
      this.#patchState({
        positionSec: Math.floor(this.#audio.currentTime),
        durationSec: Math.floor(this.#audio.duration) || this.#state.durationSec,
      });
    };
    this.#onEnded = () => {
      this.#patchState({ status: 'idle', positionSec: 0 });
      this.#emit({ ...this.#state, _event: 'ended' });
    };
    this.#onError = () => {
      console.error('[LocalPlaybackAdapter] Audio error', this.#audio.error);
      this.#patchState({ status: 'error' });
    };
    this.#onPlaying = () => this.#patchState({ status: 'playing' });
    this.#onPause   = () => {
      if (this.#state.status !== 'idle') this.#patchState({ status: 'paused' });
    };

    this.#audio.addEventListener('timeupdate', this.#onTimeUpdate);
    this.#audio.addEventListener('ended',      this.#onEnded);
    this.#audio.addEventListener('error',      this.#onError);
    this.#audio.addEventListener('playing',    this.#onPlaying);
    this.#audio.addEventListener('pause',      this.#onPause);
  }

  #removeAudioListeners() {
    this.#audio.removeEventListener('timeupdate', this.#onTimeUpdate);
    this.#audio.removeEventListener('ended',      this.#onEnded);
    this.#audio.removeEventListener('error',      this.#onError);
    this.#audio.removeEventListener('playing',    this.#onPlaying);
    this.#audio.removeEventListener('pause',      this.#onPause);
  }

  #onTimeUpdate; #onEnded; #onError; #onPlaying; #onPause;

  #patchState(patch) {
    this.#state = { ...this.#state, ...patch };
    this.#emit(this.#state);
  }

  #emit(state) {
    this.#stateCallbacks.forEach(cb => {
      try { cb(state); } catch (e) { console.error('[LocalPlaybackAdapter] callback error', e); }
    });
  }
}
