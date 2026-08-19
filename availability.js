/* Weekly play availability: When I'm Game -> Who's Game? -> Start This Game. */
(() => {
  const BLOCKS = [
    ['08:00','10:00','8–10'],
    ['09:00','11:00','9–11'],
    ['10:00','12:00','10–12'],
    ['13:00','15:00','1–3'],
    ['14:00','16:00','2–4'],
    ['15:00','17:00','3–5']
  ];
  let weekOffset = 0;
  let availability = [];
  let profiles = new Map();
  let busy = false;

  const client = () => window.clhSupabase || window.createClhSupabaseClient?.();
  const user = () => window.clhAuthUser;
  const pad = n => String(n).padStart(2,'0');
  const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const fmtDay = d => d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
  const fmtRange = (a,b) => `${a.toLocaleDateString(undefined,{month:'short',day:'numeric'})}–${b.toLocaleDateString(undefined,{month:'short',day:'numeric'})}`;

  function mondayFor(offset=0){
    const d=new Date(); d.setHours(12,0,0,0);
    const dow=d.getDay();
    d.setDate(d.getDate() - (dow===0?6:dow-1) + offset*7);
    return d;
  }
  function weekDays(){
    const m=mondayFor(weekOffset);
    return Array.from({length:7},(_,i)=>{const d=new Date(m);d.setDate(m.getDate()+i);return d;});
  }
  function normalizeTime(t){ return String(t||'').slice(0,5); }
  function hasMine(date,start,end){
    return availability.some(a=>a.user_id===user()?.id && a.play_date===date && normalizeTime(a.start_time)===start && normalizeTime(a.end_time)===end);
  }

  function ensureShell(){
    const nav=document.querySelector('.nav');
    if(nav && !nav.querySelector('[data-view="gameView"]')){
      const play=nav.querySelector('[data-view="createView"]');
      const b=document.createElement('button');
      b.dataset.view='gameView';
      b.textContent="Who's Game?";
      nav.insertBefore(b,play||null);
      nav.style.gridTemplateColumns='repeat(4,1fr)';
    }
    const main=document.querySelector('main');
    if(main && !document.getElementById('gameView')){
      const s=document.createElement('section');
      s.className='view'; s.id='gameView';
      s.innerHTML=`<div class="toprow"><h2>Who's Game?</h2><span class="small">Turn free time into court time.</span></div><div id="availabilityRoot"></div>`;
      const create=document.getElementById('createView');
      main.insertBefore(s,create||null);
    }
  }

  function addStyles(){
    if(document.getElementById('availabilityStyles')) return;
    const style=document.createElement('style'); style.id='availabilityStyles';
    style.textContent=`
      .game-card{border:1px solid var(--line);border-radius:16px;padding:14px;margin:13px 0;background:#fff}
      .game-card h3{margin:0 0 4px}.game-sub{font-size:.8rem;color:var(--muted);line-height:1.4;margin-bottom:10px}
      .week-nav{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:10px 0 12px}
      .week-nav button{border:1px solid var(--line);background:#fff;border-radius:9px;padding:7px 10px;font-weight:800;color:var(--ink)}
      .availability-day{padding:10px 0;border-top:1px solid #edf2f3}.availability-day:first-of-type{border-top:0}
      .availability-day-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:7px}.availability-day-head strong{font-size:.86rem}
      .time-chips{display:flex;gap:6px;flex-wrap:wrap}.time-chip{border:1px solid var(--line);background:#fff;border-radius:999px;padding:8px 10px;font-size:.76rem;font-weight:850;color:var(--ink)}
      .time-chip.active{background:var(--teal);border-color:var(--teal);color:#fff}.time-chip:disabled{opacity:.5}
      .my-summary{background:#eff7f8;border-radius:11px;padding:10px 11px;font-size:.8rem;line-height:1.45;margin-top:10px}
      .match-card{border:1px solid var(--line);border-radius:13px;padding:11px;margin:9px 0;background:#fff}
      .match-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.match-count{font-weight:950;color:var(--teal)}
      .match-names{font-size:.8rem;color:#536a75;margin:5px 0}.open-courts{font-size:.76rem;color:var(--green);font-weight:800;margin:4px 0 8px}
      .match-card .primary{width:100%}.solo{color:var(--muted);font-size:.8rem;padding:8px 0}
      @media(max-width:580px){.nav button{font-size:.76rem;padding:12px 4px}.game-card{padding:12px}.time-chip{padding:9px 11px}}
    `;
    document.head.appendChild(style);
  }

  async function load(){
    if(!client()||!user()) return;
    ensureShell(); addStyles();
    const days=weekDays(); const start=dateKey(days[0]), end=dateKey(days[6]);
    const [{data:a,error:ae},{data:p,error:pe}] = await Promise.all([
      client().from('play_availability').select('id,user_id,play_date,start_time,end_time').gte('play_date',start).lte('play_date',end).order('play_date').order('start_time'),
      client().from('profiles').select('id,display_name')
    ]);
    if(ae){ console.error(ae); return toast('Could not load Who’s Game?'); }
    if(pe){ console.error(pe); return; }
    availability=a||[]; profiles=new Map((p||[]).map(x=>[x.id,x.display_name||'Player']));
    render();
  }

  function selectedSummary(){
    const mine=availability.filter(a=>a.user_id===user()?.id);
    if(!mine.length) return 'Tap the times you’d happily play. You can change them anytime.';
    return mine.map(a=>{
      const d=new Date(a.play_date+'T12:00:00');
      const label=BLOCKS.find(b=>b[0]===normalizeTime(a.start_time)&&b[1]===normalizeTime(a.end_time))?.[2] || `${normalizeTime(a.start_time)}–${normalizeTime(a.end_time)}`;
      return `${d.toLocaleDateString(undefined,{weekday:'short'})} ${label}`;
    }).join(' · ');
  }

  function openCourts(date,start,end){
    const used=new Set();
    (window.state?.events||[]).filter(e=>e.date===date && e.start<end && e.end>start).forEach(e=>{
      (String(e.courts).match(/\d+/g)||[]).map(Number).forEach(n=>used.add(n));
    });
    return Array.from({length:10},(_,i)=>i+1).filter(n=>!used.has(n));
  }

  function matches(){
    const map=new Map();
    availability.forEach(a=>{
      const start=normalizeTime(a.start_time), end=normalizeTime(a.end_time);
      const k=`${a.play_date}|${start}|${end}`;
      if(!map.has(k)) map.set(k,{date:a.play_date,start,end,users:[]});
      map.get(k).users.push(a.user_id);
    });
    return [...map.values()].sort((a,b)=>b.users.length-a.users.length || a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  }

  function render(){
    const root=document.getElementById('availabilityRoot'); if(!root) return;
    const days=weekDays();
    const dayHtml=days.map(d=>{
      const date=dateKey(d);
      const chips=BLOCKS.map(([start,end,label])=>`<button type="button" class="time-chip ${hasMine(date,start,end)?'active':''}" data-av-date="${date}" data-av-start="${start}" data-av-end="${end}">${label}</button>`).join('');
      return `<div class="availability-day"><div class="availability-day-head"><strong>${fmtDay(d)}</strong></div><div class="time-chips">${chips}</div></div>`;
    }).join('');

    const groups=matches();
    const matchHtml=groups.length ? groups.map(g=>{
      const names=g.users.map(id=>profiles.get(id)||'Player');
      const mine=g.users.includes(user()?.id);
      const open=openCourts(g.date,g.start,g.end);
      const d=new Date(g.date+'T12:00:00');
      const label=BLOCKS.find(b=>b[0]===g.start&&b[1]===g.end)?.[2]||`${g.start}–${g.end}`;
      return `<div class="match-card"><div class="match-top"><div><strong>${fmtDay(d)} · ${label}</strong></div><div class="match-count">${g.users.length} game${g.users.length===1?'':'s'} to play</div></div><div class="match-names">${names.map(n=>esc(n)).join(' · ')}</div><div class="open-courts">${open.length?`Open courts right now: ${open.join(', ')}`:'No courts currently open for that time'}</div>${g.users.length>=2?`<button type="button" class="primary" data-start-game="1" data-date="${g.date}" data-start="${g.start}" data-end="${g.end}">Start This Game</button>`:`<div class="solo">${mine?'You’re game — waiting for company.':'One player is game so far.'}</div>`}</div>`;
    }).join('') : '<div class="solo">No one has marked a time yet. Be the first to say when you’re game.</div>';

    root.innerHTML=`
      <div class="game-card"><h3>When I’m Game</h3><div class="game-sub">Tap the times that work for you. This is interest, not a booking.</div><div class="week-nav"><button type="button" data-week="-1">‹</button><strong>${fmtRange(days[0],days[6])}</strong><button type="button" data-week="1">›</button></div>${dayHtml}<div class="my-summary"><strong>You’re game:</strong> ${esc(selectedSummary())}</div></div>
      <div class="game-card"><h3>Who’s Game?</h3><div class="game-sub">See where everyone’s free time overlaps. When a time looks good, start the game.</div>${matchHtml}</div>`;
  }

  async function toggleAvailability(button){
    if(busy) return; busy=true;
    document.querySelectorAll('.time-chip').forEach(b=>b.disabled=true);
    const date=button.dataset.avDate,start=button.dataset.avStart,end=button.dataset.avEnd;
    const existing=availability.find(a=>a.user_id===user()?.id&&a.play_date===date&&normalizeTime(a.start_time)===start&&normalizeTime(a.end_time)===end);
    try{
      if(existing){
        const {error}=await client().from('play_availability').delete().eq('id',existing.id).eq('user_id',user().id);
        if(error) throw error;
      } else {
        const {error}=await client().from('play_availability').insert({user_id:user().id,play_date:date,start_time:start,end_time:end});
        if(error) throw error;
      }
      await load();
    }catch(error){console.error(error);toast('Could not change that time.');}
    finally{busy=false;document.querySelectorAll('.time-chip').forEach(b=>b.disabled=false);}
  }

  function startThisGame(button){
    const date=button.dataset.date,start=button.dataset.start,end=button.dataset.end;
    window.clhShowView?.('createView');
    const dateEl=document.getElementById('date'),startEl=document.getElementById('start'),endEl=document.getElementById('end'),nameEl=document.getElementById('name');
    if(dateEl) dateEl.value=date;
    if(startEl) startEl.value=start;
    if(endEl) endEl.value=end;
    if(nameEl && (!nameEl.value || nameEl.value==='Ladies Pickleball')) nameEl.value="Who's Game? Pickleball";
    toast('Game setup is ready — choose courts and add it.');
  }

  document.addEventListener('click',e=>{
    const chip=e.target.closest('[data-av-date]'); if(chip){e.preventDefault();toggleAvailability(chip);return;}
    const week=e.target.closest('[data-week]'); if(week){weekOffset+=Number(week.dataset.week);load();return;}
    const start=e.target.closest('[data-start-game]'); if(start){startThisGame(start);return;}
    const tab=e.target.closest('[data-view="gameView"]'); if(tab) setTimeout(load,0);
  });

  window.addEventListener('clh-auth-ready',()=>{ensureShell();addStyles();load();});
  window.addEventListener('clh-app-ready',()=>{ensureShell();addStyles();if(user())load();});
  if(user()) setTimeout(()=>{ensureShell();addStyles();load();},100);
})();
