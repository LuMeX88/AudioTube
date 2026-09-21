/**
 * Drag-and-drop reordering for list views.
 *
 * Listeners live on the container rather than the items, so reordering keeps
 * working after a re-render replaces the list's contents.
 */

/**
 * @param {HTMLElement} container      element that stays alive across renders
 * @param {object}   options
 * @param {string}   options.itemSelector   selector for draggable rows
 * @param {string}   options.idAttr         dataset key holding each row's id
 * @param {string}  [options.groupSelector] confines dragging to one sub-list
 * @param {(ids: string[], group: HTMLElement) => void} options.onReorder
 */
export function enableDragReorder(container, { itemSelector, idAttr, groupSelector, onReorder }) {
  let dragged = null;

  const groupOf = el => (groupSelector ? el.closest(groupSelector) : container);

  container.addEventListener('dragstart', e => {
    const item = e.target.closest(itemSelector);
    if (!item || !container.contains(item)) return;
    dragged = item;
    e.dataTransfer.effectAllowed = 'move';
    // Firefox only starts a drag once data has been set.
    e.dataTransfer.setData('text/plain', item.dataset[idAttr] ?? '');
    // Applied late so the drag image still shows the row, not the placeholder.
    requestAnimationFrame(() => item.classList.add('dragging'));
  });

  container.addEventListener('dragover', e => {
    if (!dragged) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const target = e.target.closest(itemSelector);
    if (!target || target === dragged || !container.contains(target)) return;
    if (groupOf(target) !== groupOf(dragged)) return;

    const rect = target.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    slideIntoPlace(groupOf(dragged), itemSelector, dragged, () => {
      target.parentNode.insertBefore(dragged, after ? target.nextSibling : target);
    });
  });

  container.addEventListener('drop', e => {
    if (dragged) e.preventDefault();
  });

  container.addEventListener('dragend', () => {
    if (!dragged) return;
    const group = groupOf(dragged);
    dragged.classList.remove('dragging');
    dragged = null;
    const ids = [...group.querySelectorAll(itemSelector)].map(el => el.dataset[idAttr]);
    onReorder(ids, group);
  });
}

/** Runs `mutate`, then animates every row from its old position to its new one. */
function slideIntoPlace(group, itemSelector, exclude, mutate) {
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) {
    mutate();
    return;
  }

  const rows = [...group.querySelectorAll(itemSelector)].filter(el => el !== exclude);
  const before = new Map(rows.map(el => [el, el.getBoundingClientRect().top]));

  mutate();

  for (const el of rows) {
    const delta = before.get(el) - el.getBoundingClientRect().top;
    if (!delta) continue;
    el.animate(
      [{ transform: `translateY(${delta}px)` }, { transform: 'translateY(0)' }],
      { duration: 160, easing: 'cubic-bezier(.2,.7,.3,1)' },
    );
  }
}
