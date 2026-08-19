/* Reliable top-level navigation for the Club La Huerta app. */
(() => {
  function showView(viewId) {
    const target = document.getElementById(viewId);
    if (!target) return;

    document.querySelectorAll('.view').forEach(view => {
      view.classList.toggle('active', view.id === viewId);
    });
    document.querySelectorAll('.nav button[data-view]').forEach(button => {
      button.classList.toggle('active', button.dataset.view === viewId);
    });

    if (viewId === 'calendarView' && typeof renderCalendar === 'function') {
      try { renderCalendar(); } catch (error) { console.warn('Calendar refresh failed', error); }
    }
    if (viewId === 'upcomingView' && typeof renderUpcoming === 'function') {
      try { renderUpcoming(); } catch (error) { console.warn('Upcoming refresh failed', error); }
    }
    if (viewId === 'createView') {
      const date = document.getElementById('date');
      if (date && !date.value && typeof selected !== 'undefined') date.value = selected;
    }

    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function ensureUnlocked() {
    if (window.clhAuthUser && !document.getElementById('accessGate')) {
      document.body.classList.remove('clh-locked');
      const app = document.querySelector('.app');
      if (app) {
        app.style.pointerEvents = '';
        app.style.userSelect = '';
      }
    }
  }

  document.addEventListener('click', event => {
    const tab = event.target.closest('.nav button[data-view]');
    if (!tab) return;
    event.preventDefault();
    event.stopPropagation();
    showView(tab.dataset.view);
  }, true);

  window.clhShowView = showView;
  window.addEventListener('clh-auth-ready', () => {
    ensureUnlocked();
    setTimeout(ensureUnlocked, 100);
  });
  window.addEventListener('clh-app-ready', ensureUnlocked);

  setInterval(ensureUnlocked, 1000);
})();
