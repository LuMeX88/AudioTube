/**
 * Fixed bottom player bar — Now Playing, transport controls, volume.
 */
import { appState } from '../../src/core/state/AppState.js?v=20260924-1';
import { t }        from '../../src/core/i18n/i18n.js?v=20260924-2';
import { formatDuration } from './helpers.js';
import { icon }     from './icons.js?v=20260924-1';

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
        <div class="progress-waveform-wrap">
          <canvas class="progress-waveform" id="waveformCanvas"></canvas>
          <input type="range" class="progress-bar" id="progressBar"
                 min="0" max="100" value="0"
                 aria-label="Wiedergabeposition"/>
        </div>
        <span class="time" id="timeDur">0:00</span>
      </div>

      <!-- Volume -->
      <div class="volume-area">
        <div class="volume-control">
          <button type="button" class="volume-toggle" id="volumeToggle"
                  aria-label="${t('volume')}" title="${t('volume')}"
                  aria-haspopup="true" aria-expanded="false">${icon('volume', 18)}</button>
          <div class="volume-popover" id="volumePopover">
            <button type="button" class="volume-step volume-step--inc" id="volumeIncrease"
                    aria-label="${t('volumeIncrease')}" title="${t('volumeIncrease')}">${icon('add', 14)}</button>
            <span class="volume-label" id="volumeLabel">50</span>
            <div class="volume-track" id="volumeTrack">
              <div class="volume-fill" id="volumeFill"></div>
              <input type="range" class="volume-slider" id="volumeSlider"
                     min="0" max="100" value="50" orient="vertical"
                     aria-label="${t('volume')}"/>
            </div>
            <button type="button" class="volume-step volume-step--dec" id="volumeDecrease"
                    aria-label="${t('volumeDecrease')}" title="${t('volumeDecrease')}">${icon('minus', 14)}</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const btnPrev       = container.querySelector('#btnPrev');
  const btnPlayPause  = container.querySelector('#btnPlayPause');
  const btnNext       = container.querySelector('#btnNext');
  const btnStop       = container.querySelector('#btnStop');
  const progressBar   = container.querySelector('#progressBar');
  const waveformCanvas = container.querySelector('#waveformCanvas');
  const waveformCtx    = waveformCanvas.getContext('2d');
  const volumeToggle  = container.querySelector('#volumeToggle');
  const volumePopover = container.querySelector('#volumePopover');
  const volumeSlider  = container.querySelector('#volumeSlider');
  const volumeLabel   = container.querySelector('#volumeLabel');
  const volumeFill    = container.querySelector('#volumeFill');
  const volumeIncrease = container.querySelector('#volumeIncrease');
  const volumeDecrease = container.querySelector('#volumeDecrease');
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
  progressBar.addEventListener('pointerdown', () => { isScrubbing = true; });
  progressBar.addEventListener('input', () => {
    isScrubbing = true;
    timePos.textContent = formatDuration(progressPositionSec());
    drawWaveformAtScrubPct();
  });
  // Released outside the slider still ends the scrub, so the bar keeps updating.
  window.addEventListener('pointerup', () => {
    if (!isScrubbing) return;
    isScrubbing = false;
    seekToProgress();
  });
  progressBar.addEventListener('change', seekToProgress);

  // Waveform: real per-track amplitude peaks (analyzed server-side from the
  // cached audio file, see AudioTubeWaveformView), cached in memory by video
  // id so switching back to an already-loaded track doesn't refetch.
  const waveformCache = new Map(); // videoId -> number[] peaks (0..1)
  let currentPeaks = null;
  let currentWaveformTrackId = null;

  async function loadWaveformFor(track) {
    const videoId = track?.id || null;
    if (videoId === currentWaveformTrackId) return;
    currentWaveformTrackId = videoId;
    currentPeaks = null;
    drawWaveform();
    if (!videoId) return;

    if (waveformCache.has(videoId)) {
      currentPeaks = waveformCache.get(videoId);
      drawWaveform();
      return;
    }
    await fetchWaveformWithRetry(videoId);
  }

  /**
   * The waveform endpoint returns `null` (peaks) while the audio itself is
   * still downloading for playback — retry a few times with a short delay
   * instead of giving up, without ever blocking/delaying playback itself
   * (this whole function is fire-and-forget from the caller's perspective).
   */
  async function fetchWaveformWithRetry(videoId, attempt = 0) {
    try {
      const peaks = await ctrl.getWaveform(videoId);
      // The track may have changed again while this request was in flight.
      if (currentWaveformTrackId !== videoId) return;
      if (peaks) {
        waveformCache.set(videoId, peaks);
        currentPeaks = peaks;
        drawWaveform();
      } else if (attempt < 8) {
        setTimeout(() => fetchWaveformWithRetry(videoId, attempt + 1), 2000);
      }
    } catch {
      // No real data available (e.g. offline) — falls back to the plain
      // placeholder pattern drawn by drawWaveform() below.
    }
  }

  function resizeWaveformCanvas() {
    const rect = waveformCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    waveformCanvas.width  = Math.max(1, Math.round(rect.width * dpr));
    waveformCanvas.height = Math.max(1, Math.round(rect.height * dpr));
  }

  function drawWaveform(progressOverride) {
    const { width, height } = waveformCanvas;
    waveformCtx.clearRect(0, 0, width, height);
    const progress = progressOverride ?? (appState.get('playback').durationSec > 0
      ? appState.get('playback').positionSec / appState.get('playback').durationSec
      : 0);

    const playedColor   = getComputedStyle(waveformCanvas).getPropertyValue('--wf-played').trim()   || '#64b5f6';
    const unplayedColor = getComputedStyle(waveformCanvas).getPropertyValue('--wf-unplayed').trim() || 'rgba(255,255,255,.25)';

    const peaks = currentPeaks && currentPeaks.length ? currentPeaks : new Array(80).fill(0.12);
    const barGap = 2 * (window.devicePixelRatio || 1);
    const barWidth = Math.max(1, width / peaks.length - barGap);
    const centerY = height / 2;

    peaks.forEach((peak, i) => {
      const x = i * (barWidth + barGap);
      const barHeight = Math.max(2, peak * height);
      waveformCtx.fillStyle = (i / peaks.length) <= progress ? playedColor : unplayedColor;
      waveformCtx.fillRect(x, centerY - barHeight / 2, barWidth, barHeight);
    });
  }

  function drawWaveformAtScrubPct() {
    drawWaveform(Number(progressBar.value) / 100);
  }

  window.addEventListener('resize', () => { resizeWaveformCanvas(); drawWaveform(); });
  resizeWaveformCanvas();

  function progressPositionSec() {
    const duration = appState.get('playback').durationSec;
    return duration > 0 ? (Number(progressBar.value) / 100) * duration : 0;
  }

  function seekToProgress() {
    const duration = appState.get('playback').durationSec;
    if (duration > 0) ctrl.seek(progressPositionSec());
  }

  // Volume
  let volumeInert = false; // "temporarily inert" (idle) vs. truly disabled step/track controls

  function applyVolume(v) {
    const clamped = Math.max(0, Math.min(100, v));
    volumeSlider.value = clamped;
    volumeLabel.textContent = clamped;
    volumeFill.style.height = `${clamped}%`;
    return clamped;
  }

  function closeVolumePopover() {
    volumePopover.classList.remove('open');
    volumeToggle.setAttribute('aria-expanded', 'false');
  }

  function positionVolumePopover() {
    // `.app-layout` has `overflow: hidden` for its grid rows, so an
    // absolutely-positioned popover anchored inside the player bar would be
    // clipped as soon as it grows taller than the bar itself. Using a fixed
    // position computed from the toggle button's real screen rect sidesteps
    // that ancestor clipping entirely.
    // The popover's bottom end is pulled DOWN so it overlaps into the (same
    // dark-colored) player bar behind the icon, instead of floating with a
    // gap above it — that overlap is what makes it read as "part of the bar"
    // rather than an unrelated card hovering over the lighter page content.
    const rect = volumeToggle.getBoundingClientRect();
    const popoverRect = volumePopover.getBoundingClientRect();
    const overlap = rect.height + 14;
    volumePopover.style.left = `${Math.max(8, rect.right - popoverRect.width)}px`;
    volumePopover.style.top  = `${Math.max(8, rect.top - popoverRect.height + overlap)}px`;
  }

  function toggleVolumePopover() {
    if (volumeInert) return;
    const open = !volumePopover.classList.contains('open');
    if (open) positionVolumePopover();
    volumePopover.classList.toggle('open', open);
    volumeToggle.setAttribute('aria-expanded', String(open));
  }

  volumeToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleVolumePopover();
  });

  document.addEventListener('click', (e) => {
    if (!volumePopover.classList.contains('open')) return;
    if (e.target === volumeToggle || volumePopover.contains(e.target)) return;
    closeVolumePopover();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeVolumePopover();
  });

  volumeSlider.addEventListener('input', () => {
    const v = applyVolume(parseInt(volumeSlider.value, 10));
    ctrl.setVolume(v);
  });

  volumeIncrease.addEventListener('click', () => {
    const v = applyVolume(parseInt(volumeSlider.value, 10) + 5);
    ctrl.setVolume(v);
  });

  volumeDecrease.addEventListener('click', () => {
    const v = applyVolume(parseInt(volumeSlider.value, 10) - 5);
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
    loadWaveformFor(track);
    // While scrubbing, the drag preview (drawWaveformAtScrubPct) owns the
    // canvas — redrawing from the (not-yet-seeked) real position here would
    // otherwise fight it on every ~1s poll tick.
    if (!isScrubbing) drawWaveform();

    // Volume
    applyVolume(ps.volume);

    // Disable controls when idle
    const disabled = ps.status === 'idle';
    [btnPrev, btnPlayPause, btnNext, btnStop, progressBar].forEach(el => {
      el.disabled = disabled;
    });
    waveformCanvas.classList.toggle('is-inert', disabled);

    // Volume popover: keep the icon reachable ("temporarily inert") instead of
    // truly disabling it, so it can be reopened once playback resumes; the
    // popover's own contents are genuinely disabled.
    volumeInert = disabled;
    volumeToggle.setAttribute('aria-disabled', String(disabled));
    volumeToggle.classList.toggle('is-inert', disabled);
    [volumeSlider, volumeIncrease, volumeDecrease].forEach(el => {
      el.disabled = disabled;
    });
    if (disabled) closeVolumePopover();
  });
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
