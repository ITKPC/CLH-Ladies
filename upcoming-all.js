/* Upcoming always shows every real future session, regardless of game type. */
(() => {
  function renderAllUpcoming() {
    const root = document.getElementById('upcoming');
    if (!root || !window.state) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const events = (state.events || [])
      .filter(e => {
        if (!e || !e.date) return false;
        // Shared Supabase sessions use UUIDs. Ignore any stale prototype records.
        if (typeof e.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(e.id)) return false;
        const d = new Date(`${e.date}T23:59:59`);
        return !Number.isNaN(d.getTime()) && d >= today;
      })
      .sort((a, b) => `${a.date}T${a.start || '00:00'}`.localeCompare(`${b.date}T${b.start || '00:00'}`));

    root.innerHTML = events.length
      ? events.map(e => eventCard(e)).join('')
      : '<div class="empty">No upcoming games yet. Tap + Play or use Who’s Game? to start one.</div>';
  }

  window.renderUpcoming = renderAllUpcoming;

  const subtitle = document.querySelector('#upcomingView .toprow .small');
  if (subtitle) subtitle.textContent = 'All game types';

  window.addEventListener('clh-auth-ready', () => setTimeout(renderAllUpcoming, 0));
  window.addEventListener('clh-app-ready', () => setTimeout(renderAllUpcoming, 0));
})();
