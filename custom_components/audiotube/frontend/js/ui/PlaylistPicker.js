/**
 * Add-to-playlist picker modal.
 * Lets the user pick an existing playlist or create a new one, then adds the track.
 */
import { appState } from '../../src/core/state/AppState.js?v=20260924-1';
import { t }        from '../../src/core/i18n/i18n.js?v=20260924-2';
import { icon }     from './icons.js?v=20260924-1';
import { trackFromSearchResult } from '../../src/core/models.js?v=20260924-1';
import { showPrompt } from './dialogs.js?v=20260923-2';

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/**
 * Open the picker for a given search result / track.
 * @param {object} source  a search result or track object
 * @param {import('../AppController.js').AppController} ctrl
 */
export function openPlaylistPicker(source, ctrl) {
  const track = trackFromSearchResult({ ...source, type: 'track' });

  let modal = document.getElementById('playlistPickerModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'playlistPickerModal';
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    document.body.appendChild(modal);
  }

  function close() { modal.classList.add('hidden'); }

  function render() {
    const playlists = appState.get('playlists');
    modal.innerHTML = `
      <div class="modal-box picker-box">
        <div class="picker-head">
          <h2 class="modal-title">${t('addToPlaylistTitle')}</h2>
          <button class="btn-icon picker-close" title="${t('close')}" aria-label="${t('close')}">${icon('close', 18)}</button>
        </div>
        <p class="picker-track" title="${escHtml(track.title)}">${icon('music', 16)} ${escHtml(track.title)}</p>
        <ul class="picker-list">
          ${playlists.length
            ? playlists.map(pl => {
                const has = pl.tracks.some(tr => tr.id === track.id);
                return `
                  <li>
                    <button class="picker-item ${has ? 'in-list' : ''}" data-id="${pl.id}" ${has ? 'disabled' : ''}>
                      <span class="picker-item-name">${escHtml(pl.name)}</span>
                      <span class="picker-item-meta">${has ? icon('check', 18) : t('trackCount', pl.tracks.length)}</span>
                    </button>
                  </li>`;
              }).join('')
            : `<li class="picker-empty">${t('noPlaylistsYet')}</li>`
          }
        </ul>
        <button class="picker-new" id="pickerNew">${icon('add', 18)} ${t('newPlaylistInline')}</button>
      </div>
    `;

    modal.querySelector('.picker-close').addEventListener('click', close);

    modal.querySelectorAll('.picker-item:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => {
        ctrl.addTrackToPlaylist(btn.dataset.id, track);
        const pl = appState.get('playlists').find(p => p.id === btn.dataset.id);
        appState.notify(t('addedToPlaylist', track.title, pl?.name || ''), 'info');
        close();
      });
    });

    modal.querySelector('#pickerNew').addEventListener('click', async () => {
      const name = await showPrompt(t('newPlaylistPrompt'));
      if (!name) return;
      const pl = ctrl.createPlaylist(name);
      ctrl.addTrackToPlaylist(pl.id, track);
      appState.notify(t('addedToPlaylist', track.title, pl.name), 'info');
      close();
    });
  }

  modal.onclick = (e) => { if (e.target === modal) close(); };
  render();
  modal.classList.remove('hidden');
}
