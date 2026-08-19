/* Matchmaker availability: When I'm Game -> Who's Game? -> Start This Game. */
(() => {
  const BLOCKS={morning:[['08:00','10:00','8–10'],['09:00','11:00','9–11'],['10:00','12:00','10–12']],afternoon:[['13:00','15:00','1–3'],['14:00','16:00','2–4'],['15:00','17:00','3–5']]};
  const DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  let weekOffset=0, weekly=[], recurring=[], exceptions=[], demo=[], profiles=new Map(), busy=false;
  const client=()=>window.clhSupabase||window.createClhSupabaseClient?.();
  const user=()=>window.clhAuthUser;
  const pad=n=>String(n).padStart(2,'0');
  const dateKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const normalize=t=>String(t||'').slice(0,5);
  const fmtDay=d=>d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
  const escHtml=s=>typeof esc==='function'?esc(s):String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function mondayFor(offset=0){const d=new Date();d.setHours(12,0,0,0);const dow=d.getDay();d.setDate(d.getDate()-(dow===0?6:dow-1)+offset*7);return d;}
  function weekDays(){const m=mondayFor(weekOffset);return Array.from({length:7},(_,i)=>{const d=new Date(m);d.setDate(m.getDate()+i);return d;});}
  function fmtRange(days){return `${days[0].toLocaleDateString(undefined,{month:'short',day:'numeric'})}–${days[6].toLocaleDateString(undefined,{month:'short',day:'numeric'})}`;}
  function recurringOn(weekday,period){return recurring.some(r=>r.user_id===user()?.id&&r.weekday===weekday&&r.period===period);}
  function skipped(date,period){return exceptions.some(x=>x.user_id===user()?.id&&x.play_date===date&&x.period===period&&x.unavailable);}
  function weeklyMine(date,start,end){return weekly.some(a=>a.user_id===user()?.id&&a.play_date===date&&normalize(a.start_time)===start&&normalize(a.end_time)===end);}

  function ensureShell(){
    const nav=document.querySelector('.nav');
    if(nav&&!nav.querySelector('[data-view="gameView"]')){const play=nav.querySelector('[data-view="createView"]');const b=document.createElement('button');b.dataset.view='gameView';b.textContent="Who's Game?";nav.insertBefore(b,play||null);nav.style.gridTemplateColumns='repeat(4,1fr)';}
    const main=document.querySelector('main');
    if(main&&!document.getElementById('gameView')){const s=document.createElement('section');s.className='view';s.id='gameView';s.innerHTML=`<div class="toprow"><h2>Who's Game?</h2><span class="small">Your pickleball matchmaker.</span></div><div id="availabilityRoot"></div>`;main.insertBefore(s,document.getElementById('createView')||null);}
  }

  function addStyles(){
    if(document.getElementById('availabilityStyles'))return;
    const style=document.createElement('style');style.id='availabilityStyles';style.textContent=`
      .game-card{border:1px solid var(--line);border-radius:16px;padding:14px;margin:13px 0;background:#fff}.game-card h3{margin:0 0 4px}.game-sub{font-size:.8rem;color:var(--muted);line-height:1.4;margin-bottom:10px}
      .routine-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}.routine-chip{border:1px solid var(--line);border-radius:11px;padding:10px 8px;background:#fff;font-weight:850;color:var(--ink);text-align:left}.routine-chip.active{background:#e9f6f8;border-color:var(--teal);color:var(--teal)}.routine-chip small{display:block;font-weight:650;color:var(--muted);margin-top:2px}.routine-chip.active small{color:var(--teal)}
      .week-nav{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:15px 0 8px}.week-nav button{border:1px solid var(--line);background:#fff;border-radius:9px;padding:7px 10px;font-weight:800;color:var(--ink)}
      .availability-day{padding:11px 0;border-top:1px solid #edf2f3}.availability-day-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:7px}.availability-day-head strong{font-size:.86rem}.daypart{margin:7px 0}.daypart-head{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:.73rem;color:var(--muted);font-weight:850;text-transform:uppercase;letter-spacing:.04em}.skipbtn{border:0;background:transparent;color:var(--teal);font-size:.72rem;font-weight:850;padding:3px}
      .time-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:5px}.time-chip{border:1px solid var(--line);background:#fff;border-radius:999px;padding:8px 10px;font-size:.76rem;font-weight:850;color:var(--ink)}.time-chip.active{background:var(--teal);border-color:var(--teal);color:#fff}.time-chip.routine{background:#e9f6f8;border-color:var(--teal);color:var(--teal)}.time-chip:disabled{opacity:.5}
      .my-summary{background:#eff7f8;border-radius:11px;padding:10px 11px;font-size:.8rem;line-height:1.45;margin-top:10px}.demo-note{background:#fff7e5;border:1px solid #f0dfb7;border-radius:10px;padding:9px 10px;font-size:.75rem;color:#795f24;margin-bottom:10px}
      .match-card{border:1px solid var(--line);border-radius:13px;padding:11px;margin:9px 0;background:#fff}.match-card.best{border-color:var(--teal);box-shadow:0 3px 12px rgba(8,124,161,.12)}.match-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.match-count{font-weight:950;color:var(--teal)}.match-names{font-size:.8rem;color:#536a75;margin:5px 0}.open-courts{font-size:.76rem;color:var(--green);font-weight:800;margin:4px 0 8px}.match-card .primary{width:100%}.solo{color:var(--muted);font-size:.8rem;padding:8px 0}.best-label{font-size:.68rem;background:var(--teal);color:white;border-radius:999px;padding:3px 7px;font-weight:900;margin-left:5px}
      @media(max-width:580px){.nav button{font-size:.72rem;padding:12px 3px}.game-card{padding:12px}.routine-grid{grid-template-columns:1fr 1fr}.routine-chip{padding:9px 7px}.time-chip{padding:9px 11px}}
    `;document.head.appendChild(style);
  }

  async function load(){
    if(!client()||!user())return;ensureShell();addStyles();
    const days=weekDays(),start=dateKey(days[0]),end=dateKey(days[6]);
    const results=await Promise.all([
      client().from('play_availability').select('id,user_id,play_date,start_time,end_time').gte('play_date',start).lte('play_date',end),
      client().from('play_availability_recurring').select('id,user_id,weekday,period'),
      client().from('play_availability_exceptions').select('id,user_id,play_date,period,unavailable').gte('play_date',start).lte('play_date',end),
      client().from('demo_play_availability').select('id,demo_name,weekday,period').eq('enabled',true),
      client().from('profiles').select('id,display_name')
    ]);
    if(results.some(r=>r.error)){console.error(results.map(r=>r.error));return toast('Could not load the matchmaker.');}
    weekly=results[0].data||[];recurring=results[1].data||[];exceptions=results[2].data||[];demo=results[3].data||[];profiles=new Map((results[4].data||[]).map(p=>[p.id,p.display_name||'Player']));render();
  }

  function effectiveSlots(){
    const days=weekDays(), map=new Map();
    const add=(date,start,end,key,name,isDemo=false)=>{const k=`${date}|${start}|${end}`;if(!map.has(k))map.set(k,{date,start,end,people:new Map()});map.get(k).people.set(key,{name,isDemo});};
    weekly.forEach(a=>add(a.play_date,normalize(a.start_time),normalize(a.end_time),a.user_id,profiles.get(a.user_id)||'Player'));
    recurring.forEach(r=>{const d=days[r.weekday-1];if(!d)return;const date=dateKey(d);if(exceptions.some(x=>x.user_id===r.user_id&&x.play_date===date&&x.period===r.period&&x.unavailable))return;BLOCKS[r.period].forEach(([s,e])=>add(date,s,e,r.user_id,profiles.get(r.user_id)||'Player'));});
    demo.forEach(r=>{const d=days[r.weekday-1];if(!d)return;const date=dateKey(d);BLOCKS[r.period].forEach(([s,e])=>add(date,s,e,`demo:${r.demo_name}`,r.demo_name,true));});
    return [...map.values()];
  }

  function openCourts(date,start,end){const used=new Set();(window.state?.events||[]).filter(e=>e.date===date&&e.start<end&&e.end>start).forEach(e=>(String(e.courts).match(/\d+/g)||[]).map(Number).forEach(n=>used.add(n)));return Array.from({length:10},(_,i)=>i+1).filter(n=>!used.has(n));}

  function render(){
    const root=document.getElementById('availabilityRoot');if(!root)return;const days=weekDays();
    const routines=DAYS.map((day,i)=>['morning','afternoon'].map(period=>{const active=recurringOn(i+1,period);return `<button type="button" class="routine-chip ${active?'active':''}" data-routine-day="${i+1}" data-routine-period="${period}"><strong>${day} ${period==='morning'?'morning':'afternoon'}</strong><small>${active?'Every week ✓':'Make this my usual'}</small></button>`;}).join('')).join('');
    const dayHtml=days.map((d,i)=>{const date=dateKey(d);const parts=['morning','afternoon'].map(period=>{const routine=recurringOn(i+1,period),skip=skipped(date,period);const chips=BLOCKS[period].map(([s,e,label])=>{const one=weeklyMine(date,s,e),eff=routine&&!skip;return `<button type="button" class="time-chip ${one?'active':eff?'routine':''}" data-av-date="${date}" data-av-start="${s}" data-av-end="${e}" ${eff?'disabled title="From your weekly routine"':''}>${label}${eff?' · usual':''}</button>`;}).join('');return `<div class="daypart"><div class="daypart-head"><span>${period}</span>${routine?`<button type="button" class="skipbtn" data-skip-date="${date}" data-skip-period="${period}">${skip?'Use my usual this week':'Skip this '+period+' this week'}</button>`:''}</div><div class="time-chips">${chips}</div></div>`;}).join('');return `<div class="availability-day"><div class="availability-day-head"><strong>${fmtDay(d)}</strong></div>${parts}</div>`;}).join('');

    const groups=effectiveSlots().sort((a,b)=>b.people.size-a.people.size||a.date.localeCompare(b.date)||a.start.localeCompare(b.start));
    const viable=groups.filter(g=>g.people.size>=2);const best=viable[0];
    const matchHtml=(viable.length?viable.slice(0,12):groups.slice(0,8)).map(g=>{const people=[...g.people.values()],open=openCourts(g.date,g.start,g.end),d=new Date(g.date+'T12:00:00'),label=[...BLOCKS.morning,...BLOCKS.afternoon].find(b=>b[0]===g.start&&b[1]===g.end)?.[2]||`${g.start}–${g.end}`,isBest=best&&g.date===best.date&&g.start===best.start&&g.end===best.end;return `<div class="match-card ${isBest?'best':''}"><div class="match-top"><div><strong>${fmtDay(d)} · ${label}</strong>${isBest?'<span class="best-label">BEST MATCH</span>':''}</div><div class="match-count">${people.length} game</div></div><div class="match-names">${people.map(p=>escHtml(p.name)).join(' · ')}</div><div class="open-courts">${open.length?`Open courts: ${open.join(', ')}`:'No courts currently open'}</div>${people.length>=2?`<button type="button" class="primary" data-start-game="1" data-date="${g.date}" data-start="${g.start}" data-end="${g.end}">Start This Game</button>`:'<div class="solo">Waiting for another player.</div>'}</div>`;}).join('')||'<div class="solo">No matches yet.</div>';

    root.innerHTML=`<div class="game-card"><h3>When I’m Game</h3><div class="game-sub">Set your usual rhythm once. Then tweak any particular week when life changes.</div><div class="routine-grid">${routines}</div><div class="week-nav"><button type="button" data-week="-1">‹</button><strong>${fmtRange(days)}</strong><button type="button" data-week="1">›</button></div>${dayHtml}<div class="my-summary"><strong>How it works:</strong> teal = one-off choice · pale blue = your usual weekly rhythm. You can change either anytime.</div></div><div class="game-card"><h3>Who’s Game?</h3><div class="game-sub">The matchmaker looks for the strongest overlap and shows the best opportunities first.</div><div class="demo-note">Demo mode: names marked “(demo)” are temporary sample players so we can see matching behavior. They are stored separately and can be deleted cleanly later.</div>${matchHtml}</div>`;
  }

  async function toggleRoutine(btn){if(busy)return;busy=true;const weekday=Number(btn.dataset.routineDay),period=btn.dataset.routinePeriod,existing=recurring.find(r=>r.user_id===user()?.id&&r.weekday===weekday&&r.period===period);try{if(existing){const {error}=await client().from('play_availability_recurring').delete().eq('id',existing.id).eq('user_id',user().id);if(error)throw error;}else{const {error}=await client().from('play_availability_recurring').insert({user_id:user().id,weekday,period});if(error)throw error;}await load();}catch(e){console.error(e);toast('Could not change your usual time.');}finally{busy=false;}}
  async function toggleSkip(btn){if(busy)return;busy=true;const date=btn.dataset.skipDate,period=btn.dataset.skipPeriod,existing=exceptions.find(x=>x.user_id===user()?.id&&x.play_date===date&&x.period===period);try{if(existing){const {error}=await client().from('play_availability_exceptions').delete().eq('id',existing.id).eq('user_id',user().id);if(error)throw error;}else{const {error}=await client().from('play_availability_exceptions').insert({user_id:user().id,play_date:date,period,unavailable:true});if(error)throw error;}await load();}catch(e){console.error(e);toast('Could not change this week.');}finally{busy=false;}}
  async function toggleWeekly(btn){if(busy)return;busy=true;const date=btn.dataset.avDate,start=btn.dataset.avStart,end=btn.dataset.avEnd,existing=weekly.find(a=>a.user_id===user()?.id&&a.play_date===date&&normalize(a.start_time)===start&&normalize(a.end_time)===end);try{if(existing){const {error}=await client().from('play_availability').delete().eq('id',existing.id).eq('user_id',user().id);if(error)throw error;}else{const {error}=await client().from('play_availability').insert({user_id:user().id,play_date:date,start_time:start,end_time:end});if(error)throw error;}await load();}catch(e){console.error(e);toast('Could not change that time.');}finally{busy=false;}}
  function startGame(btn){window.clhShowView?.('createView');const vals={date:btn.dataset.date,start:btn.dataset.start,end:btn.dataset.end};Object.entries(vals).forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.value=v;});const name=document.getElementById('name');if(name)name.value='Ladies Pickleball';toast('Match found — choose courts and add it.');}

  document.addEventListener('click',e=>{const r=e.target.closest('[data-routine-day]');if(r){e.preventDefault();toggleRoutine(r);return;}const sk=e.target.closest('[data-skip-date]');if(sk){e.preventDefault();toggleSkip(sk);return;}const chip=e.target.closest('[data-av-date]');if(chip&&!chip.disabled){e.preventDefault();toggleWeekly(chip);return;}const week=e.target.closest('[data-week]');if(week){weekOffset+=Number(week.dataset.week);load();return;}const start=e.target.closest('[data-start-game]');if(start){startGame(start);return;}if(e.target.closest('[data-view="gameView"]'))setTimeout(load,0);});
  window.addEventListener('clh-auth-ready',()=>{ensureShell();addStyles();load();});window.addEventListener('clh-app-ready',()=>{ensureShell();addStyles();if(user())load();});if(user())setTimeout(()=>{ensureShell();addStyles();load();},100);
})();
