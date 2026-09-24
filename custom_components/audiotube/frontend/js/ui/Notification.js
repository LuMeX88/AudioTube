/**
 * Toast notification renderer.
 */
import { appState } from '../../src/core/state/AppState.js?v=20260924-1';

export function renderNotification(container) {
  appState.on('notification', (n) => {
    if (!n) {
      container.classList.add('hidden');
      container.textContent = '';
      return;
    }
    container.textContent = n.message;
    container.className = `notification notification--${n.type}`;
  });
}
