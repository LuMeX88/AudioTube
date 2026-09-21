/**
 * Fixed bottom player bar — Now Playing, transport controls, volume.
 */
import { appState } from '../../src/core/state/AppState.js';
import { t }        from '../../src/core/i18n/i18n.js';
import { formatDuration } from './helpers.js';
import { icon }     from './icons.js';

export function renderPlayerBar(container, ctrl) {
  container.innerHTML = `
    <div class="player-bar-inner">
      <!-- Now Playing -->
      <div class="now-playing">
        <div class="now-playing-thumb" id="nowThumb">
          <span>${icon('music', 22)}</span>
        </div>
        <div class="now-playing-info">
          <p class="now-title"  id="nowTitle">${t('noTrack')}</p>
          <p class="now-artist" id="nowArtist"></p>
        </div>
      </div>

      <!-- Transport -->
      <div class="transport">
        <button class="btn-transport" id="btnPrev"
                aria-label="${t('previous')}" title="${t('previous')}">${icon('prev', 22)}</button>
        <button class="btn-transport btn-play-pause" id="btnPlayPause"
                aria-label="${t('play')}" title="${t('play')}">${icon('play', 26)}</button>
        <button class="btn-transport" id="btnNext"
                aria-label="${t('next')}" title="${t('next')}">${icon('next', 22)}</button>
        <button class="btn-transport" id="btnStop"
                aria-label="${t('stop')}" title="${t('stop')}">${icon('stop', 20)}</button>
      </div>

      <!-- Progress -->
      <div class="progress-area">
        <span class="time" id="timePos">0:00</span>
        <input type="range" class="progress-bar" id="progressBar"
               min="0" max="100" value="0"
               aria-label="Wiedergabeposition"/>
        <span class="time" id="timeDur">0:00</span>
      </div>

      <!-- Volume -->
      <div class="volume-area">
        <span class="volume-icon" aria-hidden="true">${icon('volume', 18)}</span>
        <input type="range" class="volume-slider" id="volumeSlider"
               min="0" max="100" value="50"
               aria-label="${t('volume')}"/>
        <span class="volume-label" id="volumeLabel">50</span>
      </div>
    </div>
  `;

  const btnPrev       = container.querySelector('#btnPrev');
  const btnPlayPause  = container.querySelector('#btnPlayPause');
  const btnNext       = container.querySelector('#btnNext');
  const btnStop       = container.querySelector('#btnStop');
  const progressBar   = container.querySelector('#progressBar');
  const volumeSlider  = container.querySelector('#volumeSlider');
  const volumeLabel   = container.querySelector('#volumeLabel');
  const nowTitle      = container.querySelector('#nowTitle');
  const nowArtist     = container.querySelector('#nowArtist');
  const nowThumb      = container.querySelector('#nowThumb');
  const timePos       = container.querySelector('#timePos');
  const timeDur       = container.querySelector('#timeDur');

  let isScrubbing = false;

  // Buttons
  btnPrev.addEventListener('click',      () => ctrl.previous());
  btnNext.addEventListener('click',      () => ctrl.next());
  btnStop.addEventListener('click',      () => ctrl.stop());
  btnPlayPause.addEventListener('click', () => {
    const status = appState.get('playback').status;
    if (status === 'playing') ctrl.pause();
    else if (status === 'paused') ctrl.resume();
  });

  // Progress scrub
  progressBar.addEventListener('mousedown', () => { isScrubbing = true; });
  progressBar.addEventListener('mouseup', () => {
    isScrubbing = false;
    seekToProgress();
  });
  progressBar.addEventListener('touchend', () => {
    isScrubbing = false;
    seekToProgress();
  });
  progressBar.addEventListener('change', seekToProgress);

  function seekToProgress() {
    const duration = appState.get('playback').durationSec;
    if (duration > 0) ctrl.seek((Number(progressBar.value) / 100) * duration);
  }

  // Volume
  volumeSlider.addEventListener('input', () => {
    const v = parseInt(volumeSlider.value, 10);
    volumeLabel.textContent = v;
    ctrl.setVolume(v);
  });

  // Keyboard accessibility for transport
  [btnPrev, btnPlayPause, btnNext, btnStop].forEach(btn => {
    btn.setAttribute('tabindex', '0');
  });

  // State subscription
  appState.on('playback', (ps) => {
    const track = ps.currentTrack;

    // Track info
    if (track) {
      nowTitle.textContent  = track.title;
      nowArtist.textContent = track.artist;
      if (track.thumbnailUrl) {
        nowThumb.innerHTML = `<img src="${track.thumbnailUrl}" alt="${escHtml(track.title)}" class="now-thumb-img">`;
      } else {
        nowThumb.innerHTML = `<span>${icon('music', 22)}</span>`;
      }
    } else {
      nowTitle.textContent  = t('noTrack');
      nowArtist.textContent = '';
      nowThumb.innerHTML    = `<span>${icon('music', 22)}</span>`;
    }

    // Play/pause icon
    const isPlaying = ps.status === 'playing';
    btnPlayPause.innerHTML     = isPlaying ? icon('pause', 26) : icon('play', 26);
    btnPlayPause.setAttribute('aria-label', isPlaying ? t('pause') : t('play'));
    btnPlayPause.title          = isPlaying ? t('pause') : t('play');

    // Progress
    if (!isScrubbing) {
      const pct = ps.durationSec > 0 ? (ps.positionSec / ps.durationSec) * 100 : 0;
      progressBar.value = pct;
      timePos.textContent = formatDuration(ps.positionSec);
      timeDur.textContent = formatDuration(ps.durationSec);
    }

    // Volume
    volumeSlider.value  = ps.volume;
    volumeLabel.textContent = ps.volume;

    // Disable controls when idle
    const disabled = ps.status === 'idle';
    [btnPrev, btnPlayPause, btnNext, btnStop, progressBar].forEach(el => {
      el.disabled = disabled;
    });
  });
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
