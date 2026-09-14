/**
 * Queue view — shows the current playback queue with remove/skip actions.
 */
import { appState } from '../../../../src/core/state/AppState.js';
import { t }        from '../../../../src/core/i18n/i18n.js';
import { formatDuration } from './helpers.js';

export function renderQueue(container, ctrl) {
  container.innerHTML = `
    <section class="queue-view" aria-label="${t('navQueue')}">
      <div class="view-header">
        <h2>${t('queue')}</h2>
        <button class="btn-secondary btn-clear-queue" id="clearQueueBtn">${t('clearQueue')}</button>
      </div>
      <ol class="queue-list" id="queueList" aria-label="${t('queue')}"></ol>
    </section>
  `;

  const list = container.querySelector('#queueList');

  container.querySelector('#clearQueueBtn').addEventListener('click', () => {
    if (confirm(t('clearQueue') + '?')) ctrl.clearQueue();
  });

  function render() {
    const queue   = appState.get('queue');
    const current = appState.get('queueIndex');

    if (!queue.length) {
      list.innerHTML = `<li class="empty-msg">${t('queueEmpty')}</li>`;
      return;
    }

    list.innerHTML = queue.map((item, i) => `
      <li class="queue-item ${i === current ? 'queue-item--active' : ''}"
          data-queue-id="${item.queueId}"
          aria-current="${i === current ? 'true' : 'false'}">
        <span class="queue-index">${i === current ? '▶' : i + 1}</span>
        <div class="queue-item-info">
          <p class="queue-item-title" title="${escHtml(item.track.title)}">${escHtml(item.track.title)}</p>
          <p class="queue-item-artist">${escHtml(item.track.artist)}</p>
        </div>
        <span class="queue-item-duration">${formatDuration(item.track.durationSec)}</span>
        <button class="btn-icon btn-skip-to"
                data-queue-id="${item.queueId}"
                aria-label="${t('play')} ${escHtml(item.track.title)}"
                title="${t('play')}">▶</button>
        <button class="btn-icon btn-remove-queue"
                data-queue-id="${item.queueId}"
                aria-label="${t('removeFromQueue')} ${escHtml(item.track.title)}"
                title="${t('removeFromQueue')}">✕</button>
      </li>
    `).join('');

    list.querySelectorAll('.btn-skip-to').forEach(btn => {
      btn.addEventListener('click', () => ctrl.skipToQueueItem(btn.dataset.queueId));
    });
    list.querySelectorAll('.btn-remove-queue').forEach(btn => {
      btn.addEventListener('click', () => ctrl.removeFromQueue(btn.dataset.queueId));
    });
  }

  const unsub = appState.on(['queue', 'queueIndex'], render);
  appState.on('activeView', view => { if (view !== 'queue') unsub(); });

  render();
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
