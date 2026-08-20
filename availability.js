/* Simple matchmaker: When I'm Game -> Who's Game? -> pick players -> Make This Game. */
(() => {
  const BLOCKS = {
    morning: [['08:00','10:00','8–10'],['09:00','11:00','9–11'],['10:00','12:00','10–12']],
    afternoon: [['13:00','15:00','1–3'],['14:00','16:00','2–4'],['15:00','17:00','3–5']]
  };
  const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  let weekOffset = 0, weekly = [], recurring = [], exceptions = [], profiles = new Map(), busy = false, showWeek = false, builder = null;

  const client = () => window.clhSupabase || window.createClhSupabaseClient?.();
  const user = () => window.clhAuthUser;
  const pad = n => String(n).padStart(2,'0');
  const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const normalize = t => String(t || '').slice(0,5);
  const normalizeName = name => String(name || '').trim().toLowerCase().replace(/\s+/g,' ');
  const escHtml = s => typeof esc === 'function' ? esc(s) : String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDay = d => d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
  const zonedIso = (date,time) => `${date}T${time}:00-07:00`;

  function mondayFor(offset=0) {
    const d = new Date(); d.setHours(12,0,0,0);
    const dow = d.getDay();
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1) + offset * 7);
    return d;
  }
  function weekDays() {
    const m = mondayFor(weekOffset);
    return Array.from({length:7},(_,i) => { const d = new Date(m); d.setDate(m.getDate()+i); return d; });
  }
  function fmtRange(days) { return `${days[0].toLocaleDateString(undefined,{month:'short',day:'numeric'})}–${days[6].toLocaleDateString(undefined,{month:'short',day:'numeric'})}`; }
  function recurringOn(weekday,period) { return recurring.some(r => r.user_id === user()?.id && r.weekday === weekday && r.period === period); }
  function skipped(date,period) { return exceptions.some(x => x.user_id === user()?.id && x.play_date === date && x.period === period && x.unavailable); }
  function weeklyMine(date,start,end) { return weekly.some(a => a.user_id === user()?.id && a.play_date === date && normalize(a.start_time) === start && normalize(a.end_time) === end); }
  function periodFor(start) { return start < '12:00' ? 'morning' : 'afternoon'; }
  function labelFor(start,end) { return [...BLOCKS.morning,...BLOCKS.afternoon].find(b => b[0] === start && b[1] === end)?.[2] || `${start}–${end}`; }
  function myName() { return profiles.get(user()?.id) || profile || 'You'; }
  function myNameKey() { return normalizeName(myName()); }

  function ensureShell() {
    const nav = document.querySelector('.nav');
    if (nav && !nav.querySelector('[data-view="gameView"]')) {
      const play = nav.querySelector('[data-view="createView"]');
      const b = document.createElement('button');
      b.dataset.view = 'gameView'; b.textContent = "Who's Game?";
      nav.insertBefore(b, play || null); nav.style.gridTemplateColumns = 'repeat(4,1fr)';
    }
    const main = document.querySelector('main');
    if (main && !document.getElementById('gameView')) {
      const s = document.createElement('section'); s.className = 'view'; s.id = 'gameView';
      s.innerHTML = `<div class="toprow"><h2>Who's Game?</h2><span class="small">Your pickleball matchmaker.</span></div><div id="availabilityRoot"></div>`;
      main.insertBefore(s, document.getElementById('createView') || null);
    }
  }

  function addStyles() {
    if (document.getElementById('availabilityStyles')) return;
    const style = document.createElement('style'); style.id = 'availabilityStyles'; style.textContent = `
      .game-card{border:1px solid var(--line);border-radius:16px;padding:14px;margin:13px 0;background:#fff}.game-card h3{margin:0 0 4px}.game-sub{font-size:.8rem;color:var(--muted);line-height:1.4;margin-bottom:10px}
      .usual-week{display:grid;gap:7px}.usual-row{display:grid;grid-template-columns:48px 1fr 1fr;gap:7px;align-items:center}.usual-row strong{font-size:.78rem}.routine-chip{border:1px solid var(--line);border-radius:10px;padding:9px 7px;background:#fff;font-weight:850;color:var(--ink)}.routine-chip.active{background:#e9f6f8;border-color:var(--teal);color:var(--teal)}
      .week-summary{display:flex;justify-content:space-between;align-items:center;gap:10px;background:#f5f8f8;border-radius:11px;padding:9px 10px;margin-top:11px;font-size:.79rem}.week-summary button{border:0;background:transparent;color:var(--teal);font-weight:850;padding:4px}
      .week-panel{margin-top:10px;border-top:1px solid var(--line);padding-top:7px}.week-nav{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:6px 0}.week-nav button{border:1px solid var(--line);background:#fff;border-radius:9px;padding:7px 10px;font-weight:800;color:var(--ink)}
      .availability-day{padding:9px 0;border-top:1px solid #edf2f3}.availability-day:first-of-type{border-top:0}.availability-day-head{font-size:.82rem;font-weight:900;margin-bottom:5px}.daypart{margin:6px 0}.daypart-head{display:flex;justify-content:space-between;align-items:center;font-size:.7rem;color:var(--muted);font-weight:850;text-transform:uppercase}.skipbtn{border:0;background:transparent;color:var(--teal);font-size:.7rem;font-weight:850;padding:2px}
      .time-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}.time-chip{border:1px solid var(--line);background:#fff;border-radius:999px;padding:8px 10px;font-size:.75rem;font-weight:850;color:var(--ink)}.time-chip.active{background:var(--teal);border-color:var(--teal);color:#fff}.time-chip.routine{background:#e9f6f8;border-color:var(--teal);color:var(--teal)}.time-chip:disabled{opacity:.65}
      .match-opportunity{border:1px solid var(--line);border-radius:14px;padding:12px;margin:9px 0}.match-opportunity.best{border-color:var(--teal);box-shadow:0 3px 12px rgba(8,124,161,.10)}.match-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.match-head strong{font-size:.9rem}.match-count{font-weight:950;color:var(--teal);white-space:nowrap}.best-label{display:inline-block;margin-left:5px;font-size:.64rem;background:var(--teal);color:#fff;border-radius:999px;padding:3px 6px;font-weight:900}.match-hint{font-size:.76rem;color:var(--muted);margin:5px 0 9px}.match-opportunity .primary{width:100%}
      .builder{margin-top:10px;border-top:1px solid var(--line);padding-top:11px}.builder h4{margin:0 0 5px}.builder-step{font-size:.74rem;text-transform:uppercase;letter-spacing:.05em;font-weight:900;color:var(--muted);margin:11px 0 6px}.player-picks,.court-picks{display:flex;gap:7px;flex-wrap:wrap}.player-pick,.court-pick{border:1px solid var(--line);background:#fff;border-radius:999px;padding:9px 11px;font-weight:850;color:var(--ink)}.player-pick.active,.court-pick.active{background:var(--teal);border-color:var(--teal);color:#fff}.player-pick.active:disabled{opacity:1;cursor:default}.picked-count{font-size:.78rem;color:var(--muted);margin-top:7px}.club-note{background:#fff7e5;border:1px solid #f0dfb7;border-radius:10px;padding:9px 10px;font-size:.76rem;color:#795f24;margin:11px 0}.make-game{width:100%}.make-game:disabled{opacity:.45;cursor:not-allowed}.solo{font-size:.8rem;color:var(--muted);padding:9px 0;line-height:1.45}
      @media(max-width:580px){.nav button{font-size:.72rem;padding:12px 3px}.game-card{padding:12px}.usual-row{grid-template-columns:42px 1fr 1fr}.routine-chip{padding:9px 5px}.player-pick,.court-pick{padding:10px 11px}}
    `;
    document.head.appendChild(style);
  }

  async function load() {
    if (!client() || !user()) return;
    ensureShell(); addStyles();
    const days = weekDays(), start = dateKey(days[0]), end = dateKey(days[6]);
    const results = await Promise.all([
      client().from('play_availability').select('id,user_id,play_date,start_time,end_time').gte('play_date',start).lte('play_date',end),
      client().from('play_availability_recurring').select('id,user_id,weekday,period'),
      client().from('play_availability_exceptions').select('id,user_id,play_date,period,unavailable').gte('play_date',start).lte('play_date',end),
      client().from('profiles').select('id,display_name')
    ]);
    if (results.some(r => r.error)) { console.error(results.map(r => r.error)); return toast('Could not load the matchmaker.'); }
    weekly = results[0].data || [];
    recurring = results[1].data || [];
    exceptions = results[2].data || [];
    profiles = new Map((results[3].data || []).map(p => [p.id,p.display_name || 'Player']));
    builder = null;
    render();
  }

  function effectiveSlots() {
    const days = weekDays(), map = new Map();
    const add = (date,start,end,userId,name) => {
      const slotKey = `${date}|${start}|${end}`;
      if (!map.has(slotKey)) map.set(slotKey,{date,start,end,people:new Map()});
      const personKey = normalizeName(name);
      if (!personKey) return;
      const current = map.get(slotKey).people.get(personKey);
      const isMe = personKey === myNameKey();
      const person = {key:userId,id:userId,name,isMe};
      if (!current || userId === user()?.id) map.get(slotKey).people.set(personKey,person);
    };
    weekly.forEach(a => add(a.play_date,normalize(a.start_time),normalize(a.end_time),a.user_id,profiles.get(a.user_id) || 'Player'));
    recurring.forEach(r => {
      const d = days[r.weekday-1]; if (!d) return;
      const date = dateKey(d);
      if (exceptions.some(x => x.user_id === r.user_id && x.play_date === date && x.period === r.period && x.unavailable)) return;
      BLOCKS[r.period].forEach(([s,e]) => add(date,s,e,r.user_id,profiles.get(r.user_id) || 'Player'));
    });
    return [...map.values()];
  }

  function openCourts(date,start,end) {
    const used = new Set();
    const events = typeof state !== 'undefined' ? (state.events || []) : [];
    events.filter(e => e.date === date && e.start < end && e.end > start).forEach(e => (String(e.courts).match(/\d+/g) || []).map(Number).forEach(n => used.add(n)));
    return Array.from({length:10},(_,i) => i+1).filter(n => !used.has(n));
  }

  function opportunities() {
    const bestByDayPart = new Map();
    effectiveSlots().forEach(slot => {
      if (!slot.people.has(myNameKey())) return;
      const otherCount = slot.people.size - 1;
      if (otherCount < 1) return;
      const period = periodFor(slot.start), key = `${slot.date}|${period}`;
      const current = bestByDayPart.get(key);
      if (!current || slot.people.size > current.people.size) bestByDayPart.set(key,slot);
    });
    const all = [...bestByDayPart.values()].sort((a,b) => b.people.size-a.people.size || a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
    const enough = all.filter(x => x.people.size >= 4);
    return enough.length ? enough.slice(0,3) : all.slice(0,3);
  }

  function hasMyAvailability() {
    return effectiveSlots().some(slot => slot.people.has(myNameKey()));
  }

  function weeklySummary() {
    const days = weekDays(), parts = [];
    days.forEach((d,i) => {
      const date = dateKey(d), labels = [];
      ['morning','afternoon'].forEach(period => {
        const routine = recurringOn(i+1,period) && !skipped(date,period);
        const one = BLOCKS[period].some(([s,e]) => weeklyMine(date,s,e));
        if (routine || one) labels.push(period === 'morning' ? 'AM' : 'PM');
      });
      if (labels.length) parts.push(`${DAYS[i]} ${labels.join('/')}`);
    });
    return parts.length ? parts.join(' · ') : 'Nothing marked yet';
  }

  function weekPanelHtml(days) {
    if (!showWeek) return '';
    const dayHtml = days.map((d,i) => {
      const date = dateKey(d);
      const parts = ['morning','afternoon'].map(period => {
        const routine = recurringOn(i+1,period), skip = skipped(date,period);
        const chips = BLOCKS[period].map(([s,e,label]) => {
          const one = weeklyMine(date,s,e), inherited = routine && !skip;
          return `<button type="button" class="time-chip ${one?'active':inherited?'routine':''}" data-av-date="${date}" data-av-start="${s}" data-av-end="${e}" ${inherited?'disabled':''}>${label}</button>`;
        }).join('');
        return `<div class="daypart"><div class="daypart-head"><span>${period}</span>${routine?`<button type="button" class="skipbtn" data-skip-date="${date}" data-skip-period="${period}">${skip?'Use usual':'Skip this week'}</button>`:''}</div><div class="time-chips">${chips}</div></div>`;
      }).join('');
      return `<div class="availability-day"><div class="availability-day-head">${fmtDay(d)}</div>${parts}</div>`;
    }).join('');
    return `<div class="week-panel"><div class="week-nav"><button type="button" data-week="-1">‹</button><strong>${fmtRange(days)}</strong><button type="button" data-week="1">›</button></div>${dayHtml}</div>`;
  }

  function builderHtml(match,index) {
    if (!builder || builder.index !== index) return '';
    const people = [...match.people.values()];
    const courts = openCourts(match.date,match.start,match.end);
    const selected = builder.selected;
    const playerHtml = people.map(p => `<button type="button" class="player-pick ${selected.has(p.key)?'active':''}" data-player-key="${escHtml(p.key)}" ${p.isMe?'disabled':''}>${selected.has(p.key)?'✓ ':''}${escHtml(p.name)}${p.isMe?' (you)':''}</button>`).join('');
    const courtHtml = courts.length ? courts.map(c => `<button type="button" class="court-pick ${builder.court===c?'active':''}" data-match-court="${c}">Court ${c}</button>`).join('') : '<div class="solo">No courts are open in the app at this time.</div>';
    return `<div class="builder"><h4>Build the game</h4><div class="builder-step">1 · Pick the women</div><div class="player-picks">${playerHtml}</div><div class="picked-count">${selected.size} selected${selected.size<4?' · pick at least 4 total':''}</div><div class="builder-step">2 · Pick a court to use</div><div class="court-picks">${courtHtml}</div><div class="club-note">This does not reserve the physical court at Club La Huerta. Someone still needs to book the court with the club.</div><button type="button" class="primary make-game" data-make-game="${index}" ${selected.size<4||!builder.court?'disabled':''}>Make This Game</button></div>`;
  }

  function render() {
    const root = document.getElementById('availabilityRoot'); if (!root) return;
    const days = weekDays();
    const usualRows = DAYS.map((day,i) => `<div class="usual-row"><strong>${day}</strong><button type="button" class="routine-chip ${recurringOn(i+1,'morning')?'active':''}" data-routine-day="${i+1}" data-routine-period="morning">Morning${recurringOn(i+1,'morning')?' ✓':''}</button><button type="button" class="routine-chip ${recurringOn(i+1,'afternoon')?'active':''}" data-routine-day="${i+1}" data-routine-period="afternoon">Afternoon${recurringOn(i+1,'afternoon')?' ✓':''}</button></div>`).join('');

    const matches = opportunities();
    const matchHtml = matches.length ? matches.map((m,index) => {
      const d = new Date(m.date+'T12:00:00'), otherCount = m.people.size - 1, enough = m.people.size >= 4, best = index === 0 && enough;
      const otherLabel = `${otherCount} other${otherCount === 1 ? '' : 's'} available`;
      return `<div class="match-opportunity ${best?'best':''}"><div class="match-head"><div><strong>${fmtDay(d)} · ${labelFor(m.start,m.end)}</strong>${best?'<span class="best-label">BEST MATCH</span>':''}</div><div class="match-count">${otherLabel}</div></div><div class="match-hint">${enough?'You have enough for a game. You’re already included — pick the other women you want on court.':`You’re in, plus ${otherCount} other${otherCount===1?'':'s'} at this time.`}</div><button type="button" class="primary" data-build-match="${index}">${builder&&builder.index===index?'Close':'Pick Players'}</button>${builderHtml(m,index)}</div>`;
    }).join('') : (hasMyAvailability()
      ? '<div class="solo"><strong>No other players have added matching times yet.</strong><br>Your availability is saved. When someone else overlaps with you, they’ll show up here.</div>'
      : '<div class="solo">Add your availability above and the matchmaker will look for other players who overlap with you.</div>');

    root.innerHTML = `<div class="game-card"><h3>When I’m Game</h3><div class="game-sub">Set your usual week with quick blocks. You only need the detailed times when you want to change a particular week.</div><div class="usual-week">${usualRows}</div><div class="week-summary"><div><strong>This week:</strong> ${escHtml(weeklySummary())}</div><button type="button" data-toggle-week="1">${showWeek?'Hide details':'Adjust this week'}</button></div>${weekPanelHtml(days)}</div><div class="game-card"><h3>Who’s Game?</h3><div class="game-sub">We look only at your available times and show other players who overlap with you.</div>${matchHtml}</div>`;
  }

  async function toggleRoutine(btn) {
    if (busy) return; busy = true;
    const weekday = Number(btn.dataset.routineDay), period = btn.dataset.routinePeriod, existing = recurring.find(r => r.user_id === user()?.id && r.weekday === weekday && r.period === period);
    try {
      if (existing) { const {error} = await client().from('play_availability_recurring').delete().eq('id',existing.id).eq('user_id',user().id); if (error) throw error; }
      else { const {error} = await client().from('play_availability_recurring').insert({user_id:user().id,weekday,period}); if (error) throw error; }
      await load();
    } catch (e) { console.error(e); toast('Could not change your usual time.'); } finally { busy = false; }
  }

  async function toggleSkip(btn) {
    if (busy) return; busy = true;
    const date = btn.dataset.skipDate, period = btn.dataset.skipPeriod, existing = exceptions.find(x => x.user_id === user()?.id && x.play_date === date && x.period === period);
    try {
      if (existing) { const {error} = await client().from('play_availability_exceptions').delete().eq('id',existing.id).eq('user_id',user().id); if (error) throw error; }
      else { const {error} = await client().from('play_availability_exceptions').insert({user_id:user().id,play_date:date,period,unavailable:true}); if (error) throw error; }
      await load();
    } catch (e) { console.error(e); toast('Could not change this week.'); } finally { busy = false; }
  }

  async function toggleWeekly(btn) {
    if (busy) return; busy = true;
    const date = btn.dataset.avDate, start = btn.dataset.avStart, end = btn.dataset.avEnd, existing = weekly.find(a => a.user_id === user()?.id && a.play_date === date && normalize(a.start_time) === start && normalize(a.end_time) === end);
    try {
      if (existing) { const {error} = await client().from('play_availability').delete().eq('id',existing.id).eq('user_id',user().id); if (error) throw error; }
      else { const {error} = await client().from('play_availability').insert({user_id:user().id,play_date:date,start_time:start,end_time:end}); if (error) throw error; }
      await load();
    } catch (e) { console.error(e); toast('Could not change that time.'); } finally { busy = false; }
  }

  function openBuilder(index) {
    const matches = opportunities(), match = matches[index]; if (!match) return;
    if (builder && builder.index === index) { builder = null; render(); return; }
    const me = [...match.people.values()].find(p => p.isMe);
    builder = {index,selected:new Set(me ? [me.key] : []),court:null};
    render();
  }

  function togglePlayer(key) {
    if (!builder) return;
    const matches = opportunities(), match = matches[builder.index];
    const person = match ? [...match.people.values()].find(p => p.key === key) : null;
    if (person?.isMe) return;
    if (builder.selected.has(key)) builder.selected.delete(key); else builder.selected.add(key);
    render();
  }
  function chooseCourt(court) { if (!builder) return; builder.court = Number(court); render(); }

  async function makeGame(index) {
    const matches = opportunities(), match = matches[index]; if (!match || !builder || builder.index !== index) return;
    const people = [...match.people.values()].filter(p => builder.selected.has(p.key));
    if (people.length < 4) return toast('Pick at least 4 players total.');
    if (!builder.court) return toast('Pick a court.');
    const userIds = people.map(p => p.id).filter(Boolean);
    const button = document.querySelector('[data-make-game]');
    if (button) { button.disabled = true; button.textContent = 'Making game…'; }
    try {
      const {error} = await client().rpc('create_matched_session', {
        p_title:"Who's Game? Match",
        p_starts_at:zonedIso(match.date,match.start),
        p_ends_at:zonedIso(match.date,match.end),
        p_format:'quick_play',
        p_level:'All levels',
        p_courts:[builder.court],
        p_user_ids:userIds,
        p_guest_names:[],
        p_note:`Court ${builder.court} still needs to be booked with Club La Huerta.`
      });
      if (error) throw error;
      await window.clhLoadSharedState?.();
      if (typeof selected !== 'undefined') selected = match.date;
      if (typeof calDate !== 'undefined') calDate = new Date(match.date+'T12:00:00');
      builder = null;
      window.clhShowView?.('upcomingView');
      toast('Game made — it’s in Upcoming.');
    } catch (e) {
      console.error(e);
      toast((e.message || 'Could not make the game.').replace(/^.*Court conflict:\s*/i,'That court was just taken: '));
      if (button) { button.disabled = false; button.textContent = 'Make This Game'; }
    }
  }

  document.addEventListener('click', e => {
    const routine = e.target.closest('[data-routine-day]'); if (routine) { e.preventDefault(); toggleRoutine(routine); return; }
    const toggle = e.target.closest('[data-toggle-week]'); if (toggle) { showWeek = !showWeek; render(); return; }
    const week = e.target.closest('[data-week]'); if (week) { weekOffset += Number(week.dataset.week); load(); return; }
    const skip = e.target.closest('[data-skip-date]'); if (skip) { toggleSkip(skip); return; }
    const chip = e.target.closest('[data-av-date]'); if (chip) { toggleWeekly(chip); return; }
    const build = e.target.closest('[data-build-match]'); if (build) { openBuilder(Number(build.dataset.buildMatch)); return; }
    const person = e.target.closest('[data-player-key]'); if (person) { togglePlayer(person.dataset.playerKey); return; }
    const court = e.target.closest('[data-match-court]'); if (court) { chooseCourt(court.dataset.matchCourt); return; }
    const make = e.target.closest('[data-make-game]'); if (make) { makeGame(Number(make.dataset.makeGame)); return; }
    const tab = e.target.closest('[data-view="gameView"]'); if (tab) setTimeout(load,0);
  });

  window.addEventListener('clh-auth-ready', () => { ensureShell(); addStyles(); load(); });
  window.addEventListener('clh-app-ready', () => { ensureShell(); addStyles(); if (user()) load(); });
  if (user()) setTimeout(() => { ensureShell(); addStyles(); load(); },100);
})();