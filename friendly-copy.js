/* Friendly, current copy and branding for the shared Supabase app. */
(() => {
  const LOGO = 'assets/Mexican_Pickleball_Logo.png';
  let matchCreatePending = false;
  let availabilityRefreshTimer = null;

  const updateUi = () => {
    document.querySelectorAll('.brand img, .access-mark').forEach(img => {
      if (img.getAttribute('src') !== LOGO) {
        img.setAttribute('src', LOGO);
        img.setAttribute('alt', 'Mexican pickleball');
      }
    });

    document.querySelectorAll('.note').forEach(note => {
      if (/Prototype: sessions and RSVPs/i.test(note.textContent || '')) note.remove();
    });

    const createView = document.getElementById('createView');
    if (createView) {
      const heading = createView.querySelector(':scope > h2');
      const intro = createView.querySelector(':scope > p.small');
      if (heading) heading.textContent = 'Set up a game';
      if (intro) intro.textContent = 'Pick the play, time and courts — then add it to the calendar.';
    }

    document.querySelectorAll('.empty').forEach(box => {
      if (/Nothing scheduled/i.test((box.textContent || '').trim())) {
        box.textContent = 'No games here yet. Tap + Play and get one going!';
      }
    });

    if (matchCreatePending) {
      const toast = document.getElementById('toast');
      const message = (toast?.textContent || '').trim();
      if (toast?.classList.contains('show') && /^Game made/i.test(message)) {
        matchCreatePending = false;
        requestAnimationFrame(() => window.clhShowView?.('upcomingView'));
      } else if (toast?.classList.contains('show') && /(Pick at least|Pick a court|Could not make|court was just taken)/i.test(message)) {
        matchCreatePending = false;
      }
    }
  };

  function refreshMatchmakerSoon() {
    clearTimeout(availabilityRefreshTimer);
    availabilityRefreshTimer = setTimeout(() => {
      const gameTab = document.querySelector('.nav [data-view="gameView"]');
      if (gameTab) gameTab.click();
    }, 350);
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-make-game]')) matchCreatePending = true;
    if (event.target.closest('[data-routine-day], [data-skip-date], [data-av-date]')) {
      refreshMatchmakerSoon();
    }
  }, true);

  updateUi();
  const observer = new MutationObserver(() => requestAnimationFrame(updateUi));
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  if (!document.querySelector('script[data-clh-finish-fix]')) {
    const script = document.createElement('script');
    script.src = 'matchmaker-finish-fix.js';
    script.dataset.clhFinishFix = '1';
    document.body.appendChild(script);
  }
})();
