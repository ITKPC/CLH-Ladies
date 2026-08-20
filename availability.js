/* Current-week Who's Game matchmaker. Morning/Afternoon are the only availability units. */
(() => {
  const ZONE = 'America/Mazatlan';
  const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const PERIODS = {
    morning: {label:'Morning', start:'09:00', end:'11:00'},
    afternoon: {label:'Afternoon', start:'14:00', end:'16:00'}
  };
  let availability = [], profiles = new Map(), builder = null, busy = false;
  const client = () => window.clhSupabase || window.createClhSupabaseClient?.();
  const user = () => window.clhAuthUser;
  const normalizeTime = value => String(value || '').slice(0,5);
  const normalizeName = value => String(value || '').trim().toLowerCase().replace(/\s+/g,' ');
  const escHtml = value => typeof esc === 'function' ? esc(value) : String(value || '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function clubToday() {
    const parts = new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const get = type => parts.find(p => p.type === type)?.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  }
  function weekDates() {
    const base = new Date(`${clubToday()}T12:00:00Z`);
    const dow = base.getUTCDay();
    base.setUTCDate(base.getUTCDate()-(dow===0?6:dow-1));
    return Array.from({length:7},(_,i)=>{const d=new Date(base);d.setUTCDate(base.getUTCDate()+i);return d.toISOString().slice(0,10);});
  }
  function displayDate(date) { return new Date(`${date}T12:00:00`).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}); }
  function periodFor(row) { return normalizeTime(row.start_time) < '12:00' ? 'morning' : 'afternoon'; }
  function myRow(date,period) { return availability.find(r=>r.user_id===user()?.id&&r.play_date===date&&periodFor(r)===period); }
  function myName() { return profiles.get(user()?.id) || (typeof profile !== 'undefined' ? profile : '') || 'You'; }

  function ensureShell() {
    const nav=document.querySelector('.nav');
    if(nav&&!nav.querySelector('[data-view="gameView"]')){const play=nav.querySelector('[data-view="createView"]');const b=document.createElement('button');b.dataset.view='gameView';b.textContent="Who's Game?";nav.insertBefore(b,play||null);nav.style.gridTemplateColumns='repeat(4,1fr)';}
    const main=document.querySelector('main');
    if(main&&!document.getElementById('gameView')){const s=document.createElement('section');s.id='gameView';s.className='view';s.innerHTML=`<div class="toprow"><h2>Who's Game?</h2><span class="small">Your pickleball matchmaker.</span></div><div id="availabilityRoot"></div>`;main.insertBefore(s,document.getElementById('createView')||null);}
  }
  function addStyles() {
    if(document.getElementById('availabilityStyles')) return;
    const style=document.createElement('style');style.id='availabilityStyles';style.textContent=`
      .game-card{border:1px solid var(--line);border-radius:16px;padding:14px;margin:13px 0;background:#fff}.game-card h3{margin:0 0 4px}.game-sub{font-size:.8rem;color:var(--muted);line-height:1.4;margin-bottom:10px}
      .usual-week{display:grid;gap:7px}.usual-row{display:grid;grid-template-columns:48px 1fr 1fr;gap:7px;align-items:center}.usual-row strong{font-size:.78rem}.routine-chip{border:1px solid var(--line);border-radius:10px;padding:10px 7px;background:#fff;font-weight:850;color:var(--ink)}.routine-chip.active{background:#e9f6f8;border-color:var(--teal);color:var(--teal)}.routine-chip:disabled{opacity:.42;cursor:not-allowed}
      .match-opportunity{border:1px solid var(--line);border-radius:14px;padding:12px;margin:9px 0}.match-opportunity.best{border-color:var(--teal);box-shadow:0 3px 12px rgba(8,124,161,.10)}.match-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.match-count{font-weight:950;color:var(--teal);white-space:nowrap}.best-label{display:inline-block;margin-left:5px;font-size:.64rem;background:var(--teal);color:#fff;border-radius:999px;padding:3px 6px;font-weight:900}.match-hint{font-size:.76rem;color:var(--muted);margin:5px 0 9px}.match-opportunity .primary{width:100%}
      .builder{margin-top:10px;border-top:1px solid var(--line);padding-top:11px}.builder h4{margin:0 0 5px}.builder-step{font-size:.74rem;text-transform:uppercase;letter-spacing:.05em;font-weight:900;color:var(--muted);margin:11px 0 6px}.player-picks,.court-picks{display:flex;gap:7px;flex-wrap:wrap}.player-pick,.court-pick{border:1px solid var(--line);background:#fff;border-radius:999px;padding:9px 11px;font-weight:850;color:var(--ink)}.player-pick.active,.court-pick.active{background:var(--teal);border-color:var(--teal);color:#fff}.player-pick.active:disabled{opacity:1;cursor:default}.picked-count{font-size:.78rem;color:var(--muted);margin-top:7px}.club-note{background:#fff7e5;border:1px solid #f0dfb7;border-radius:10px;padding:9px 10px;font-size:.76rem;color:#795f24;margin:11px 0}.make-game{width:100%}.make-game:disabled{opacity:.45;cursor:not-allowed}.solo{font-size:.8rem;color:var(--muted);padding:9px 0;line-height:1.45}
      @media(max-width:580px){.nav button{font-size:.72rem;padding:12px 3px}.game-card{padding:12px}.usual-row{grid-template-columns:42px 1fr 1fr}.routine-chip{padding:10px 5px}.player-pick,.court-pick{padding:10px 11px}}
    `;document.head.appendChild(style);
  }

  async function load() {
    if(!client()||!user()) return;
    ensureShell();addStyles();
    const dates=weekDates();
    const [a,p]=await Promise.all([
      client().from('play_availability').select('id,user_id,play_date,start_time,end_time').gte('play_date',dates[0]).lte('play_date',dates[6]),
      client().from('profiles').select('id,display_name')
    ]);
    if(a.error||p.error){console.error(a.error||p.error);if(typeof toast==='function')toast('Could not load Who’s Game.');return;}
    availability=a.data||[];profiles=new Map((p.data||[]).map(x=>[x.id,x.display_name||'Player']));builder=null;render();
  }

  function groups() {
    const map=new Map(), meName=normalizeName(myName());
    availability.forEach(row=>{
      const period=periodFor(row), key=`${row.play_date}|${period}`;
      if(!map.has(key))map.set(key,{date:row.play_date,period,people:new Map(),mine:false});
      const group=map.get(key), name=profiles.get(row.user_id)||'Player', nameKey=normalizeName(name);
      if(row.user_id===user()?.id){group.mine=true;group.people.set(`me:${user().id}`,{key:user().id,id:user().id,name:myName(),isMe:true});return;}
      if(!nameKey||nameKey===meName) return;
      if(![...group.people.values()].some(x=>!x.isMe&&normalizeName(x.name)===nameKey))group.people.set(`player:${row.user_id}`,{key:row.user_id,id:row.user_id,name,isMe:false});
    });
    return [...map.values()];
  }
  function opportunities(){return groups().filter(g=>g.mine&&[...g.people.values()].some(p=>!p.isMe)).sort((a,b)=>b.people.size-a.people.size||a.date.localeCompare(b.date)||a.period.localeCompare(b.period));}
  function hasMyAvailability(){return availability.some(r=>r.user_id===user()?.id);}
  function openCourts(match){const t=PERIODS[match.period],used=new Set(),events=typeof state!=='undefined'?(state.events||[]):[];events.filter(e=>e.date===match.date&&e.start<t.end&&e.end>t.start).forEach(e=>(String(e.courts).match(/\d+/g)||[]).map(Number).forEach(n=>used.add(n)));return Array.from({length:10},(_,i)=>i+1).filter(n=>!used.has(n));}

  function builderHtml(match,index){
    if(!builder||builder.index!==index)return '';
    const people=[...match.people.values()],selected=builder.selected,courts=openCourts(match);
    const players=people.map(p=>`<button type="button" class="player-pick ${selected.has(p.key)?'active':''}" data-player-key="${escHtml(p.key)}" ${p.isMe?'disabled':''}>${selected.has(p.key)?'✓ ':''}${escHtml(p.name)}${p.isMe?' (you)':''}</button>`).join('');
    const courtHtml=courts.length?courts.map(c=>`<button type="button" class="court-pick ${builder.court===c?'active':''}" data-match-court="${c}">Court ${c}</button>`).join(''):'<div class="solo">No courts are open in the app for this time.</div>';
    const otherSelected=people.filter(p=>!p.isMe&&selected.has(p.key)).length,ready=otherSelected>=1&&!!builder.court;
    const status=otherSelected<1?'Select at least one other player. You are already included.':!builder.court?'Select a court to continue.':`Ready — ${otherSelected+1} players, Court ${builder.court}.`;
    return `<div class="builder"><h4>Build the game</h4><div class="builder-step">1 · Pick the women</div><div class="player-picks">${players}</div><div class="picked-count">${escHtml(status)}</div><div class="builder-step">2 · Pick a court to use</div><div class="court-picks">${courtHtml}</div><div class="club-note">This does not reserve the physical court at Club La Huerta. Someone still needs to book the court with the club.</div><button type="button" class="primary make-game" data-make-game="${index}" ${ready?'':'disabled'}>Make This Game</button></div>`;
  }

  function render(){
    const root=document.getElementById('availabilityRoot');if(!root)return;
    const dates=weekDates(),today=clubToday();
    const rows=DAYS.map((day,i)=>{const date=dates[i];const buttons=['morning','afternoon'].map(period=>{const active=!!myRow(date,period),past=date<today;return `<button type="button" class="routine-chip ${active?'active':''}" data-availability-date="${date}" data-availability-period="${period}" ${past?'disabled':''}>${PERIODS[period].label}${active?' ✓':''}</button>`;}).join('');return `<div class="usual-row"><strong>${day}</strong>${buttons}</div>`;}).join('');
    const matches=opportunities();
    const matchHtml=matches.length?matches.map((m,index)=>{const others=[...m.people.values()].filter(p=>!p.isMe).length,enough=m.people.size>=4,best=index===0&&enough;return `<div class="match-opportunity ${best?'best':''}"><div class="match-head"><div><strong>${displayDate(m.date)} · ${PERIODS[m.period].label}</strong>${best?'<span class="best-label">BEST MATCH</span>':''}</div><div class="match-count">${others} other${others===1?'':'s'} available</div></div><div class="match-hint">${enough?'You have enough for a full game. You’re already included.':`You’re in, plus ${others} other${others===1?'':'s'} at this time.`}</div><button type="button" class="primary" data-build-match="${index}">${builder&&builder.index===index?'Close':'Pick Players'}</button>${builderHtml(m,index)}</div>`;}).join(''):hasMyAvailability()?'<div class="solo"><strong>No other players have matching availability yet.</strong><br>Your times are saved. When someone else picks the same day and Morning/Afternoon, they’ll appear here.</div>':'<div class="solo">Pick the mornings or afternoons you can play this week. Who’s Game will show other players who chose the same time.</div>';
    root.innerHTML=`<div class="game-card"><h3>When I’m Game</h3><div class="game-sub">Pick the mornings or afternoons you can play this week. Nothing carries into future weeks.</div><div class="usual-week">${rows}</div></div><div class="game-card"><h3>Who’s Game?</h3><div class="game-sub">We only show other players who overlap one of your selected times.</div>${matchHtml}</div>`;
  }

  async function toggleAvailability(button){
    if(busy||!client()||!user())return;busy=true;
    const date=button.dataset.availabilityDate,period=button.dataset.availabilityPeriod,existing=myRow(date,period),t=PERIODS[period];
    try{if(existing){const {error}=await client().from('play_availability').delete().eq('id',existing.id).eq('user_id',user().id);if(error)throw error;}else{const {error}=await client().from('play_availability').insert({user_id:user().id,play_date:date,start_time:t.start,end_time:t.end});if(error)throw error;}await load();}catch(error){console.error(error);if(typeof toast==='function')toast('Could not change your availability.');}finally{busy=false;}
  }
  function openBuilder(index){const matches=opportunities(),match=matches[index];if(!match)return;if(builder&&builder.index===index){builder=null;render();return;}builder={index,selected:new Set([user().id]),court:null};render();}
  function togglePlayer(key){if(!builder||key===user()?.id)return;if(builder.selected.has(key))builder.selected.delete(key);else builder.selected.add(key);render();}
  function chooseCourt(value){if(!builder)return;builder.court=Number(value);render();}

  async function makeGame(index){
    const matches=opportunities(),match=matches[index];if(!match||!builder||builder.index!==index)return;
    const people=[...match.people.values()].filter(p=>builder.selected.has(p.key)),otherCount=people.filter(p=>!p.isMe).length;
    if(otherCount<1)return typeof toast==='function'&&toast('Select at least one other player.');
    if(!builder.court)return typeof toast==='function'&&toast('Select a court.');
    const t=PERIODS[match.period],button=document.querySelector('[data-make-game]');if(button){button.disabled=true;button.textContent='Making game…';}
    try{const {error}=await client().rpc('create_matched_session',{p_title:"Who's Game? Match",p_starts_at:`${match.date}T${t.start}:00-07:00`,p_ends_at:`${match.date}T${t.end}:00-07:00`,p_format:'quick_play',p_level:'All levels',p_courts:[builder.court],p_user_ids:people.map(p=>p.id).filter(Boolean),p_guest_names:[],p_note:`Court ${builder.court} still needs to be booked with Club La Huerta.`});if(error)throw error;await window.clhLoadSharedState?.();builder=null;window.clhShowView?.('upcomingView');if(typeof window.clhRefreshUpcoming==='function')await window.clhRefreshUpcoming();if(typeof toast==='function')toast('Game made — it’s in Upcoming.');}catch(error){console.error(error);if(typeof toast==='function')toast((error.message||'Could not make the game.').replace(/^.*Court conflict:\s*/i,'That court was just taken: '));if(button){button.disabled=false;button.textContent='Make This Game';}}
  }

  document.addEventListener('click',event=>{const a=event.target.closest('[data-availability-date]');if(a){toggleAvailability(a);return;}const build=event.target.closest('[data-build-match]');if(build){openBuilder(Number(build.dataset.buildMatch));return;}const player=event.target.closest('[data-player-key]');if(player){togglePlayer(player.dataset.playerKey);return;}const court=event.target.closest('[data-match-court]');if(court){chooseCourt(court.dataset.matchCourt);return;}const make=event.target.closest('[data-make-game]');if(make){makeGame(Number(make.dataset.makeGame));return;}const tab=event.target.closest('[data-view="gameView"]');if(tab)setTimeout(load,0);});
  window.addEventListener('clh-auth-ready',()=>{ensureShell();addStyles();load();});
  window.addEventListener('clh-app-ready',()=>{ensureShell();addStyles();if(user())load();});
  if(user())setTimeout(()=>{ensureShell();addStyles();load();},100);
})();