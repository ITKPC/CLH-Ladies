/* Upcoming always shows every real future session, regardless of game type. */
(() => {
  let refreshing = false;

  function clubToday() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mazatlan', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    const get = type => parts.find(p => p.type === type)?.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  }

  function renderAllUpcoming() {
    const root = document.getElementById('upcoming');
    if (!root || !window.state) return;

    const today = clubToday();
    const events = (state.events || [])
      .filter(e => {
        if (!e || !e.date) return false;
        if (typeof e.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(e.id)) return false;
        return e.date >= today;
      })
      .sort((a, b) => `${a.date}T${a.start || '00:00'}`.localeCompare(`${b.date}T${b.start || '00:00'}`));

    root.innerHTML = events.length
      ? events.map(e => eventCard(e)).join('')
      : '<div class="empty">No upcoming games yet. Tap + Play or use Who’s Game? to start one.</div>';
  }

  async function refreshAndRender() {
    if (refreshing) return;
    refreshing = true;
    try {
      if (typeof window.clhLoadSharedState === 'function') {
        await window.clhLoadSharedState();
      }
    } catch (error) {
      console.warn('Upcoming refresh failed', error);
    } finally {
      renderAllUpcoming();
      refreshing = false;
    }
  }

  window.renderUpcoming = renderAllUpcoming;
  window.clhRefreshUpcoming = refreshAndRender;

  const subtitle = document.querySelector('#upcomingView .toprow .small');
  if (subtitle) subtitle.textContent = 'All game types';

  document.addEventListener('click', event => {
    const tab = event.target.closest('.nav [data-view="upcomingView"]');
    if (!tab) return;
    setTimeout(refreshAndRender, 0);
  }, true);

  window.addEventListener('clh-auth-ready', () => setTimeout(refreshAndRender, 0));
  window.addEventListener('clh-app-ready', () => setTimeout(refreshAndRender, 0));
})();
