/* Shared Supabase data layer for Club La Huerta Ladies Pickleball. */
(() => {
  const PREFS = 'clh-ladies-preferences-v1';
  const zone = 'America/Mazatlan';
  const toDbFormat = value => ({'Quick Play':'quick_play','Round Robin':'round_robin','Ladder':'ladder','League':'league'}[value] || 'quick_play');
  const fromDbFormat = value => ({quick_play:'Quick Play',round_robin:'Round Robin',ladder:'Ladder',league:'League'}[value] || 'Quick Play');

  const dateInZone = value => {
    const parts = new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
    const get = t => parts.find(p=>p.type===t)?.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  };
  const timeInZone = value => {
    const parts = new Intl.DateTimeFormat('en-US',{timeZone:zone,hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date(value));
    const h = parts.find(p=>p.type==='hour')?.value || '09';
    const m = parts.find(p=>p.type==='minute')?.value || '00';
    return `${h==='24'?'00':h}:${m}`;
  };
  const zonedIso = (date,time) => `${date}T${time}:00-07:00`;

  function currentClient(){ return window.clhSupabase || window.createClhSupabaseClient?.(); }
  function currentUser(){ return window.clhAuthUser; }

  async function loadSharedState() {
    const client = currentClient();
    if (!client || !currentUser()) return;

    const [{data:sessions,error:sessionError},{data:participants,error:participantError},{data:profiles,error:profileError},{data:guests,error:guestError}] = await Promise.all([
      client.from('play_sessions').select('id,title,starts_at,ends_at,format,level,courts,capacity,note,created_by,cancelled_at').is('cancelled_at',null).order('starts_at'),
      client.from('session_participants').select('session_id,user_id,status,joined_at').in('status',['confirmed','waitlist']).order('joined_at'),
      client.from('profiles').select('id,display_name'),
      client.from('session_guest_players').select('session_id,display_name,is_demo,created_at').order('created_at')
    ]);
    if (sessionError) throw sessionError;
    if (participantError) throw participantError;
    if (profileError) throw profileError;
    if (guestError) throw guestError;

    const names = new Map((profiles||[]).map(p=>[p.id,p.display_name||'Player']));
    const grouped = new Map();
    (participants||[]).forEach(p=>{
      if (!grouped.has(p.session_id)) grouped.set(p.session_id,{confirmed:[],waitlist:[]});
      const target = grouped.get(p.session_id);
      const item = {name:names.get(p.user_id)||'Player', joined_at:p.joined_at, user_id:p.user_id};
      if (p.status==='confirmed') target.confirmed.push(item); else target.waitlist.push(item);
    });
    (guests||[]).forEach(g=>{
      if (!grouped.has(g.session_id)) grouped.set(g.session_id,{confirmed:[],waitlist:[]});
      grouped.get(g.session_id).confirmed.push({name:g.display_name,joined_at:g.created_at,user_id:null,isDemo:g.is_demo});
    });

    state.events = (sessions||[]).map(s=>{
      const people = grouped.get(s.id) || {confirmed:[],waitlist:[]};
      return {
        id:s.id,
        name:s.title,
        date:dateInZone(s.starts_at),
        start:timeInZone(s.starts_at),
        end:timeInZone(s.ends_at),
        format:fromDbFormat(s.format),
        courts:s.courts || 'TBD',
        capacity:s.capacity || 16,
        level:s.level || 'All levels',
        host:names.get(s.created_by)||'Player',
        createdBy:s.created_by,
        note:s.note || '',
        players:people.confirmed.map(x=>x.name),
        waitlist:people.waitlist.map(x=>x.name)
      };
    });

    if (typeof renderAll === 'function') renderAll();
  }

  async function joinShared(id) {
    const client=currentClient();
    const {data,error}=await client.rpc('join_session',{p_session_id:id});
    if(error) return toast(error.message||'Could not join this session.');
    toast(data==='waitlist'?'Added to waitlist.':'You’re in.');
    await loadSharedState();
  }

  async function giveUpShared(id) {
    const client=currentClient();
    const {error}=await client.rpc('give_up_spot',{p_session_id:id});
    if(error) return toast(error.message||'Could not give up your spot.');
    toast('Your spot is available now.');
    await loadSharedState();
  }

  async function cancelShared(id) {
    const client=currentClient();
    const {error}=await client.from('play_sessions').update({cancelled_at:new Date().toISOString()}).eq('id',id).eq('created_by',currentUser().id);
    if(error) return toast(error.message||'Could not cancel session.');
    $('modal').classList.remove('open');
    toast('Session cancelled.');
    await loadSharedState();
  }

  function editShared(id) {
    const e=state.events.find(x=>x.id===id); if(!e)return;
    if(e.createdBy!==currentUser()?.id) return toast('Only the woman who started this session can edit it.');
    $('modalBody').innerHTML=`<h2>Edit Session</h2><label>Name</label><input id="editName" value="${esc(e.name)}"><div class="grid2"><div><label>Start</label><input id="editStart" type="time" value="${e.start}"></div><div><label>End</label><input id="editEnd" type="time" value="${e.end}"></div></div><div class="grid2"><div><label>Courts</label><input id="editCourts" value="${esc(e.courts)}"></div><div><label>Maximum players</label><input id="editCapacity" type="number" min="2" value="${e.capacity}"></div></div><label>Note</label><textarea id="editNote">${esc(e.note)}</textarea><div class="actions" style="margin-top:14px"><button class="primary" id="saveEdit">Save Changes</button></div>`;
    $('saveEdit').onclick=async()=>{
      const start=$('editStart').value,end=$('editEnd').value;
      if(end<=start)return toast('End time must be after start time.');
      const changes={title:$('editName').value.trim()||e.name,starts_at:zonedIso(e.date,start),ends_at:zonedIso(e.date,end),courts:$('editCourts').value.trim()||'TBD',capacity:Number($('editCapacity').value)||e.capacity,note:$('editNote').value.trim()||null};
      const {error}=await currentClient().from('play_sessions').update(changes).eq('id',id).eq('created_by',currentUser().id);
      if(error)return toast(error.message||'Could not update session.');
      $('modal').classList.remove('open');toast('Session updated.');await loadSharedState();
    };
  }

  async function createShared() {
    const date=$('date').value,start=$('start').value,end=$('end').value;
    if(!date||!start||!end)return toast('Add a date and times.');
    if(end<=start)return toast('End time must be after start time.');
    const base={title:$('name').value.trim()||'Ladies Pickleball',starts_at:zonedIso(date,start),ends_at:zonedIso(date,end),format:toDbFormat(format),courts:$('courts').value.trim()||'TBD',capacity:Number($('capacity').value)||16,level:$('level').value,note:$('note').value.trim()||null,created_by:currentUser().id};
    const rows=[base];
    if($('repeat').value==='weekly'){
      for(let i=1;i<8;i++){
        const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+7*i);const ds=d.toISOString().slice(0,10);
        rows.push({...base,starts_at:zonedIso(ds,start),ends_at:zonedIso(ds,end)});
      }
    }
    const {error}=await currentClient().from('play_sessions').insert(rows);
    if(error)return toast(error.message||'Could not add session.');
    savePreferences();
    selected=date;calDate=new Date(date+'T12:00:00');await loadSharedState();document.querySelector('[data-view="calendarView"]').click();toast('Added to calendar.');
  }

  function savePreferences(){
    const prefs={format,level:$('level')?.value,courts:$('courts')?.value,capacity:$('capacity')?.value,start:$('start')?.value,end:$('end')?.value};
    localStorage.setItem(PREFS,JSON.stringify(prefs));
  }
  function restorePreferences(){
    let prefs={};try{prefs=JSON.parse(localStorage.getItem(PREFS)||'{}')}catch{}
    if(prefs.level&&$('level'))$('level').value=prefs.level;
    if(prefs.courts&&$('courts'))$('courts').value=prefs.courts;
    if(prefs.capacity&&$('capacity'))$('capacity').value=prefs.capacity;
    if(prefs.start&&$('start'))$('start').value=prefs.start;
    if(prefs.end&&$('end'))$('end').value=prefs.end;
    if(prefs.format){
      const button=[...document.querySelectorAll('.choice')].find(b=>b.dataset.format===prefs.format);
      if(button){format=prefs.format;document.querySelectorAll('.choice').forEach(x=>x.classList.toggle('active',x===button));}
    }
    ['level','courts','capacity','start','end'].forEach(id=>$(id)?.addEventListener('change',savePreferences));
    document.querySelectorAll('.choice').forEach(b=>b.addEventListener('click',()=>setTimeout(savePreferences,0)));
  }

  async function activate(){
    if(!window.clhAuthUser||!currentClient())return;
    restorePreferences();
    window.join=joinShared;
    window.giveUp=giveUpShared;
    window.cancelSession=cancelShared;
    window.editSession=editShared;
    if($('createBtn'))$('createBtn').onclick=createShared;
    if($('host')){$('host').value=profile||'You';$('host').disabled=true;$('host').title='The session is automatically owned by the woman who creates it.';}
    try{await loadSharedState();}catch(error){console.error('Could not load shared pickleball data',error);toast('Could not load shared sessions.');}
  }

  window.clhLoadSharedState=loadSharedState;
  window.addEventListener('clh-auth-ready',activate);
  if(window.clhAuthUser)setTimeout(activate,0);
})();
