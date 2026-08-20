/* Simplify availability to current week only while preserving the existing matchmaker. */
(() => {
  const PERIODS = {
    morning: { start: '09:00', end: '11:00', label: 'Morning' },
    afternoon: { start: '14:00', end: '16:00', label: 'Afternoon' }
  };
  let busy = false;
  let refreshTimer = null;

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
    const root = document.getElementById('availabilityRoot');
    if (!root || !client() || !user()) return;

    root.querySelectorAll('.week-summary,.week-panel,.demo-note').forEach(el => el.remove());

    const card = root.querySelector('.game-card');
    if (card) {
      const sub = card.querySelector('.game-sub');
      if (sub) sub.textContent = 'Pick the mornings or afternoons you can play this week. Nothing carries into future weeks.';
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
      button.textContent = `${PERIODS[period].label}${active ? ' ✓' : ''}`;
      const past = date < clubToday();
      button.disabled = past;
      button.title = past ? 'This day has already passed.' : '';
    });

    root.querySelectorAll('.match-head strong').forEach(label => {
      label.textContent = label.textContent
        .replace(/\b8[–-]10\b|\b9[–-]11\b|\b10[–-]12\b/g, 'Morning')
        .replace(/\b1[–-]3\b|\b2[–-]4\b|\b3[–-]5\b/g, 'Afternoon');
    });
  }

  function addStyles() {
    if (document.getElementById('simpleWeekStyles')) return;
    const style = document.createElement('style');
    style.id = 'simpleWeekStyles';
    style.textContent = `
      #gameView .week-summary,#gameView .week-panel,#gameView .demo-note{display:none!important}
      .simple-week-note{font-size:.76rem;color:var(--muted);font-weight:850;margin:2px 0 10px}
      .make-game-help{font-size:.76rem;font-weight:800;margin:7px 0;color:var(--muted)}
      .make-game-help.ready{color:var(--green)}
    `;
    document.head.appendChild(style);
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('.routine-chip[data-routine-day][data-routine-period]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    toggleCurrentWeek(button);
  }, true);

  document.addEventListener('click', event => {
    if (event.target.closest('[data-view="gameView"]')) setTimeout(syncButtons, 100);
  });

  addStyles();
  window.addEventListener('clh-auth-ready', () => setTimeout(syncButtons, 0));
  window.addEventListener('clh-app-ready', () => setTimeout(syncButtons, 0));
  setTimeout(syncButtons, 150);
})();

/* Matchmaker game creation: organizer + at least one other player + court. */
(() => {
  const client = () => window.clhSupabase || window.createClhSupabaseClient?.();
  let creating = false;

  function slotFromHeading(text) {
    const value = String(text || '').replace(/BEST MATCH/ig,'').trim();
    const pieces = value.split('·').map(x => x.trim());
    if (pieces.length < 2) return null;
    const dateText = pieces[0];
    const slotText = pieces[1].toLowerCase().replace(/–/g,'-');
    const year = new Intl.DateTimeFormat('en-US',{timeZone:'America/Mazatlan',year:'numeric'}).format(new Date());
    const parsed = new Date(`${dateText}, ${year} 12:00:00`);
    if (Number.isNaN(parsed.getTime())) return null;
    const pad = n => String(n).padStart(2,'0');
    const date = `${parsed.getFullYear()}-${pad(parsed.getMonth()+1)}-${pad(parsed.getDate())}`;
    const ranges = {
      'morning':['09:00','11:00'], '8-10':['08:00','10:00'], '9-11':['09:00','11:00'], '10-12':['10:00','12:00'],
      'afternoon':['14:00','16:00'], '1-3':['13:00','15:00'], '2-4':['14:00','16:00'], '3-5':['15:00','17:00']
    };
    const range = ranges[slotText];
    return range ? {date,start:range[0],end:range[1]} : null;
  }

  function selectedInfo(builder) {
    const players = [...builder.querySelectorAll('.player-pick.active[data-player-key]')];
    const court = builder.querySelector('.court-pick.active[data-match-court]');
    return {
      players,
      userIds: players.map(p => p.dataset.playerKey).filter(Boolean),
      court: court ? Number(court.dataset.matchCourt) : null
    };
  }

  function updateBuilder(builder) {
    if (!builder) return;
    const button = builder.querySelector('[data-make-game]');
    if (!button || button.textContent === 'Making game…') return;
    const info = selectedInfo(builder);
    let help = builder.querySelector('.make-game-help');
    if (!help) {
      help = document.createElement('div');
      help.className = 'make-game-help';
      button.before(help);
    }
    if (info.players.length < 2) {
      button.disabled = true;
      help.classList.remove('ready');
      help.textContent = 'Select at least one other player. You are already included.';
    } else if (!info.court) {
      button.disabled = true;
      help.classList.remove('ready');
      help.textContent = 'Select a court to continue.';
    } else {
      button.disabled = false;
      help.classList.add('ready');
      help.textContent = `Ready — ${info.players.length} players, Court ${info.court}.`;
    }
    const count = builder.querySelector('.picked-count');
    if (count) count.textContent = `${info.players.length} selected`;
  }

  function updateOpenBuilders() {
    document.querySelectorAll('#gameView .builder').forEach(updateBuilder);
  }

  async function createGame(button) {
    if (creating) return;
    const builder = button.closest('.builder');
    const card = button.closest('.match-opportunity');
    if (!builder || !card || !client()) return;
    const info = selectedInfo(builder);
    if (info.players.length < 2) return typeof toast === 'function' && toast('Select at least one other player.');
    if (!info.court) return typeof toast === 'function' && toast('Select a court.');
    const slot = slotFromHeading(card.querySelector('.match-head strong')?.textContent);
    if (!slot) return typeof toast === 'function' && toast('Could not read the game time. Please reopen Who’s Game?');

    creating = true;
    button.disabled = true;
    button.textContent = 'Making game…';
    try {
      const {error} = await client().rpc('create_matched_session', {
        p_title:"Who's Game? Match",
        p_starts_at:`${slot.date}T${slot.start}:00-07:00`,
        p_ends_at:`${slot.date}T${slot.end}:00-07:00`,
        p_format:'quick_play',
        p_level:'All levels',
        p_courts:[info.court],
        p_user_ids:info.userIds,
        p_guest_names:[],
        p_note:`Court ${info.court} still needs to be booked with Club La Huerta.`
      });
      if (error) throw error;
      await window.clhLoadSharedState?.();
      window.clhShowView?.('upcomingView');
      if (typeof toast === 'function') toast('Game made — it’s in Upcoming.');
    } catch (error) {
      console.error('Matchmaker create failed', error);
      button.textContent = 'Make This Game';
      const message = String(error?.message || 'Could not make the game.').replace(/^.*Court conflict:\s*/i,'That court is already being used: ');
      if (typeof toast === 'function') toast(message);
      updateBuilder(builder);
    } finally {
      creating = false;
    }
  }

  document.addEventListener('click', event => {
    const make = event.target.closest('[data-make-game]');
    if (make) {
      event.preventDefault();
      event.stopImmediatePropagation();
      createGame(make);
      return;
    }
    if (event.target.closest('[data-build-match],[data-player-key],[data-match-court]')) {
      setTimeout(updateOpenBuilders, 0);
    }
  }, true);

  window.addEventListener('clh-app-ready', () => setTimeout(updateOpenBuilders, 100));
})();