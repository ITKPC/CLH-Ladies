/* Player-level booking safety and matchmaker organizer defaults. */
(() => {
  const ZONE = 'America/Mazatlan';
  let booked = [];
  let refreshTimer = null;
  let applying = false;

  const client = () => window.clhSupabase || window.createClhSupabaseClient?.();
  const user = () => window.clhAuthUser;

  function parts(value) {
    const d = new Date(value);
    const dateParts = new Intl.DateTimeFormat('en-CA', {timeZone:ZONE, year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(d);
    const timeParts = new Intl.DateTimeFormat('en-US', {timeZone:ZONE, hour:'2-digit', minute:'2-digit', hour12:false}).formatToParts(d);
    const get = (arr, type) => arr.find(p => p.type === type)?.value;
    const hour = get(timeParts, 'hour') === '24' ? '00' : get(timeParts, 'hour');
    return {
      date: `${get(dateParts,'year')}-${get(dateParts,'month')}-${get(dateParts,'day')}`,
      time: `${hour}:${get(timeParts,'minute')}`
    };
  }

  function overlaps(date, start, end) {
    return booked.some(b => b.date === date && b.start < end && b.end > start);
  }

  async function loadBooked() {
    if (!client() || !user()) return;
    const {data:partsRows, error:partError} = await client()
      .from('session_participants')
      .select('session_id')
      .eq('user_id', user().id)
      .eq('status', 'confirmed');
    if (partError) {
      console.warn('Could not load player bookings', partError);
      return;
    }
    const ids = [...new Set((partsRows || []).map(r => r.session_id).filter(Boolean))];
    if (!ids.length) {
      booked = [];
      applyUi();
      return;
    }
    const {data:sessions, error:sessionError} = await client()
      .from('play_sessions')
      .select('id,starts_at,ends_at,cancelled_at')
      .in('id', ids)
      .is('cancelled_at', null);
    if (sessionError) {
      console.warn('Could not load session times', sessionError);
      return;
    }
    booked = (sessions || []).map(s => {
      const a = parts(s.starts_at), b = parts(s.ends_at);
      return {id:s.id, date:a.date, start:a.time, end:b.time};
    });
    applyUi();
  }

  function markBookedSlots() {
    document.querySelectorAll('.time-chip[data-av-date][data-av-start][data-av-end]').forEach(button => {
      const isBooked = overlaps(button.dataset.avDate, button.dataset.avStart, button.dataset.avEnd);
      button.classList.toggle('booked-slot', isBooked);
      if (isBooked) {
        button.disabled = true;
        button.title = "You're already playing during this time.";
        if (!button.dataset.bookedLabel) {
          button.dataset.bookedLabel = '1';
          button.textContent = `${button.textContent.replace(/\s*· booked$/i,'')} · booked`;
        }
      }
    });
  }

  function preselectOrganizer() {
    const id = user()?.id;
    if (!id) return;
    document.querySelectorAll('.builder').forEach(builder => {
      const mine = builder.querySelector(`.player-pick[data-player-key="${CSS.escape(id)}"]`);
      if (mine && !mine.classList.contains('active') && !mine.dataset.autoSelecting) {
        mine.dataset.autoSelecting = '1';
        mine.click();
        return;
      }
      const selectedMine = builder.querySelector(`.player-pick.active[data-player-key="${CSS.escape(id)}"]`);
      if (selectedMine) {
        selectedMine.disabled = true;
        selectedMine.title = 'You are included because you are making this game.';
        if (!/\(you\)/i.test(selectedMine.textContent || '')) selectedMine.append(' (you)');
      }
    });
  }

  function addStyles() {
    if (document.getElementById('playerBookingSafetyStyles')) return;
    const style = document.createElement('style');
    style.id = 'playerBookingSafetyStyles';
    style.textContent = `
      .time-chip.booked-slot{background:#f2f3f4!important;border-color:#cfd5d8!important;color:#7a858b!important;opacity:.72!important;cursor:not-allowed!important;text-decoration:line-through}
      .player-pick.active:disabled{opacity:1;cursor:default}
    `;
    document.head.appendChild(style);
  }

  function applyUi() {
    if (applying) return;
    applying = true;
    try {
      markBookedSlots();
      preselectOrganizer();
    } finally {
      applying = false;
    }
  }

  function scheduleApply() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(applyUi, 30);
  }

  function start() {
    addStyles();
    loadBooked();
    const observer = new MutationObserver(scheduleApply);
    observer.observe(document.querySelector('.app') || document.body, {childList:true, subtree:true});
    window.addEventListener('clh-app-ready', loadBooked);
    window.addEventListener('clh-auth-ready', loadBooked);
    document.addEventListener('click', event => {
      if (event.target.closest('[data-make-game], button[onclick*="join"], .join')) {
        setTimeout(loadBooked, 500);
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
