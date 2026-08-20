/* Simplify availability to current week only while preserving the existing matchmaker. */
(() => {
  const PERIODS = {
    morning: { start: '09:00', end: '11:00', label: 'Morning' },
    afternoon: { start: '14:00', end: '16:00', label: 'Afternoon' }
  };
  let busy = false;
  let refreshTimer = null;
  let syncing = false;

  const client = () => window.clhSupabase || window.createClhSupabaseClient?.();
  const user = () => window.clhAuthUser;
  const pad = n => String(n).padStart(2, '0');
  const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const periodFor = start => String(start || '').slice(0,5) < '12:00' ? 'morning' : 'afternoon';

  function clubToday() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mazatlan', year:'numeric', month:'2-digit', day:'2-digit'
    }).formatToParts(new Date());
    const get = type => parts.find(p => p.type === type)?.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  }

  function monday() {
    const d = new Date(`${clubToday()}T12:00:00`);
    const dow = d.getDay();
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    return d;
  }

  function dateForWeekday(weekday) {
    const d = monday();
    d.setDate(d.getDate() + Number(weekday) - 1);
    return dateKey(d);
  }

  function queueRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      const tab = document.querySelector('.nav [data-view="gameView"]');
      if (tab) tab.click();
      setTimeout(syncButtons, 180);
    }, 80);
  }

  async function toggleCurrentWeek(button) {
    if (busy || !client() || !user()) return;
    busy = true;
    const date = dateForWeekday(button.dataset.routineDay);
    const period = button.dataset.routinePeriod;
    const timing = PERIODS[period];
    try {
      const {data, error} = await client()
        .from('play_availability')
        .select('id,start_time')
        .eq('user_id', user().id)
        .eq('play_date', date);
      if (error) throw error;
      const existing = (data || []).filter(row => periodFor(row.start_time) === period);
      if (existing.length) {
        const {error: deleteError} = await client()
          .from('play_availability')
          .delete()
          .in('id', existing.map(row => row.id))
          .eq('user_id', user().id);
        if (deleteError) throw deleteError;
      } else {
        const {error: insertError} = await client()
          .from('play_availability')
          .insert({user_id:user().id, play_date:date, start_time:timing.start, end_time:timing.end});
        if (insertError) throw insertError;
      }
      queueRefresh();
    } catch (error) {
      console.error('Availability update failed', error);
      if (typeof toast === 'function') toast('Could not change your availability.');
    } finally {
      busy = false;
    }
  }

  async function syncButtons() {
    if (syncing) return;
    const root = document.getElementById('availabilityRoot');
    if (!root || !client() || !user()) return;
    syncing = true;
    try {
      const card = root.querySelector('.game-card');
      if (card) {
        const sub = card.querySelector('.game-sub');
        if (sub && sub.textContent !== 'Pick the mornings or afternoons you can play this week. Nothing carries into future weeks.') {
          sub.textContent = 'Pick the mornings or afternoons you can play this week. Nothing carries into future weeks.';
        }
        if (!card.querySelector('.simple-week-note')) {
          const note = document.createElement('div');
          note.className = 'simple-week-note';
          note.textContent = 'This week only';
          const week = card.querySelector('.usual-week');
          if (week) card.insertBefore(note, week);
        }
      }

      const buttons = [...root.querySelectorAll('.routine-chip[data-routine-day][data-routine-period]')];
      if (!buttons.length) return;

      const dates = [...new Set(buttons.map(b => dateForWeekday(b.dataset.routineDay)))];
      const {data, error} = await client()
        .from('play_availability')
        .select('play_date,start_time')
        .eq('user_id', user().id)
        .in('play_date', dates);
      if (error) return console.warn('Could not sync current-week availability', error);

      buttons.forEach(button => {
        const date = dateForWeekday(button.dataset.routineDay);
        const period = button.dataset.routinePeriod;
        const active = (data || []).some(row => row.play_date === date && periodFor(row.start_time) === period);
        button.classList.toggle('active', active);
        const wanted = `${PERIODS[period].label}${active ? ' ✓' : ''}`;
        if (button.textContent !== wanted) button.textContent = wanted;
        const past = date < clubToday();
        button.disabled = past;
        button.title = past ? 'This day has already passed.' : '';
      });

      root.querySelectorAll('.match-head strong').forEach(label => {
        const wanted = label.textContent
          .replace(/\b8[–-]10\b|\b9[–-]11\b|\b10[–-]12\b/g, 'Morning')
          .replace(/\b1[–-]3\b|\b2[–-]4\b|\b3[–-]5\b/g, 'Afternoon');
        if (label.textContent !== wanted) label.textContent = wanted;
      });
    } finally {
      syncing = false;
    }
  }

  function addStyles() {
    if (document.getElementById('simpleWeekStyles')) return;
    const style = document.createElement('style');
    style.id = 'simpleWeekStyles';
    style.textContent = `
      #gameView .week-summary,#gameView .week-panel,#gameView .demo-note{display:none!important}
      .simple-week-note{font-size:.76rem;color:var(--muted);font-weight:850;margin:2px 0 10px}
    `;
    document.head.appendChild(style);
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('.routine-chip[data-routine-day][data-routine-period]');
    if (button) {
      event.preventDefault();
      event.stopImmediatePropagation();
      toggleCurrentWeek(button);
      return;
    }
    if (event.target.closest('.nav [data-view="gameView"]')) setTimeout(syncButtons, 180);
  }, true);

  addStyles();
  window.addEventListener('clh-auth-ready', () => setTimeout(syncButtons, 180));
  window.addEventListener('clh-app-ready', () => setTimeout(syncButtons, 180));
  setTimeout(syncButtons, 250);
})();