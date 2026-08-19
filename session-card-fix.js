/* Always open the session currently displayed on a card, never a stale captured ID. */
(() => {
  function idFromCard(card) {
    const button = card?.querySelector('button[onclick*="showRoster"]');
    const onclick = button?.getAttribute('onclick') || '';
    return onclick.match(/showRoster\('([^']+)'\)/)?.[1] || null;
  }

  document.addEventListener('click', event => {
    if (event.target.closest('button, a, input, select, textarea, label')) return;
    const card = event.target.closest('.event');
    if (!card) return;
    const id = idFromCard(card);
    if (!id) return;

    // Stop the older per-card listener, which may have captured an ID before a refresh.
    event.preventDefault();
    event.stopImmediatePropagation();
    if (typeof window.showRoster === 'function') window.showRoster(id);
  }, true);
})();
