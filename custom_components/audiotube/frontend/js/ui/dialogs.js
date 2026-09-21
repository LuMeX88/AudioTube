/**
 * In-app replacements for window.prompt()/confirm().
 *
 * Native prompt()/confirm() are blocked (or simply unsupported) inside
 * sandboxed iframes such as the Home Assistant panel this app runs in,
 * which silently breaks "create playlist", "rename playlist", "delete
 * playlist" and "clear queue". These helpers render an in-app modal
 * instead and resolve a Promise with the result.
 */
import { t } from '../../src/core/i18n/i18n.js';

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function openDialogModal({ title, bodyHtml, showInput, inputValue = '', confirmLabel }) {
  return new Promise(resolve => {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `
      <div class="modal-box">
        <h2 class="modal-title">${escHtml(title)}</h2>
        ${bodyHtml || ''}
        ${showInput ? `<input type="text" class="dialog-input" value="${escHtml(inputValue)}" />` : ''}
        <div class="modal-actions">
          <button class="btn-secondary" id="dialogCancel">${escHtml(t('cancel'))}</button>
          <button class="btn-primary" id="dialogOk">${escHtml(confirmLabel || t('ok'))}</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const input = modal.querySelector('.dialog-input');
    input?.focus();
    input?.select();

    function finish(result) {
      modal.remove();
      resolve(result);
    }

    modal.querySelector('#dialogCancel').addEventListener('click', () => finish(null));
    modal.querySelector('#dialogOk').addEventListener('click', () => {
      finish(showInput ? input.value : true);
    });
    modal.addEventListener('click', e => { if (e.target === modal) finish(null); });
    modal.addEventListener('keydown', e => {
      if (e.key === 'Escape') finish(null);
      if (e.key === 'Enter' && showInput) finish(input.value);
    });
  });
}

/**
 * Ask the user for a text value. Resolves with the trimmed string, or
 * null if cancelled / left empty.
 */
export async function showPrompt(message, defaultValue = '') {
  const result = await openDialogModal({ title: message, showInput: true, inputValue: defaultValue });
  const trimmed = result?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Ask the user to confirm an action. Resolves with true/false.
 */
export async function showConfirm(message) {
  const result = await openDialogModal({
    title: message,
    showInput: false,
    confirmLabel: t('confirm'),
  });
  return result === true;
}
