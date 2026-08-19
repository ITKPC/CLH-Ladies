/* Database-backed session creation/editing with court conflict protection. */
(() => {
  const zoneOffset = '-07:00';
  const toDbFormat = value => ({'Quick Play':'quick_play','Round Robin':'round_robin','Ladder':'ladder','League':'league'}[value] || 'quick_play');
  const zonedIso = (date,time) => `${date}T${time}:00${zoneOffset}`;

  function client(){ return window.clhSupabase || window.createClhSupabaseClient?.(); }
  function courtsFrom(inputId){
    return [...new Set((document.getElementById(inputId)?.value.match(/\d+/g)||[]).map(Number).filter(n=>n>=1&&n<=10))].sort((a,b)=>a-b);
  }
  function friendly(error){
    const msg = error?.message || 'Could not save the session.';
    if (/Court conflict:/i.test(msg)) return msg.replace(/^.*Court conflict:\s*/i,'Those courts are already booked: ');
    if (/already added/i.test(msg)) return 'That session was already added.';
    return msg;
  }

  async function guardedCreate(){
    const button=document.getElementById('createBtn');
    if(!button || button.disabled) return;
    const date=document.getElementById('date')?.value;
    const start=document.getElementById('start')?.value;
    const end=document.getElementById('end')?.value;
    const selectedCourts=courtsFrom('courts');
    if(!date||!start||!end) return toast('Add a date and times.');
    if(end<=start) return toast('End time must be after start time.');
    if(!selectedCourts.length) return toast('Select at least one court.');

    button.disabled=true;
    const oldText=button.textContent;
    button.textContent='Adding…';
    try{
      const dates=[date];
      if(document.getElementById('repeat')?.value==='weekly'){
        for(let i=1;i<8;i++){
          const d=new Date(date+'T12:00:00');
          d.setDate(d.getDate()+7*i);
          dates.push(d.toISOString().slice(0,10));
        }
      }

      for(const ds of dates){
        const {error}=await client().rpc('create_play_session',{
          p_title:document.getElementById('name')?.value.trim()||'Ladies Pickleball',
          p_starts_at:zonedIso(ds,start),
          p_ends_at:zonedIso(ds,end),
          p_format:toDbFormat(window.format || (typeof format!=='undefined'?format:'Quick Play')),
          p_level:document.getElementById('level')?.value||'All levels',
          p_courts:selectedCourts,
          p_capacity:Number(document.getElementById('capacity')?.value)||16,
          p_note:document.getElementById('note')?.value.trim()||null
        });
        if(error) throw error;
      }

      if(typeof selected!=='undefined') selected=date;
      if(typeof calDate!=='undefined') calDate=new Date(date+'T12:00:00');
      await window.clhLoadSharedState?.();
      document.querySelector('[data-view="calendarView"]')?.click();
      toast(dates.length>1?'Sessions added to calendar.':'Added to calendar.');
    }catch(error){
      toast(friendly(error));
    }finally{
      button.disabled=false;
      button.textContent=oldText;
    }
  }

  function guardedEdit(id){
    const e=state.events.find(x=>x.id===id); if(!e)return;
    if(e.createdBy!==window.clhAuthUser?.id) return toast('Only the woman who started this session can edit it.');
    document.getElementById('modalBody').innerHTML=`<h2>Edit Session</h2><label>Name</label><input id="editName" value="${esc(e.name)}"><div class="grid2"><div><label>Start</label><input id="editStart" type="time" value="${e.start}"></div><div><label>End</label><input id="editEnd" type="time" value="${e.end}"></div></div><div class="grid2"><div><label>Courts</label><input id="editCourts" value="${esc(e.courts)}"><div></div></div><div><label>Maximum players</label><input id="editCapacity" type="number" min="2" value="${e.capacity}"></div></div><label>Note</label><textarea id="editNote">${esc(e.note)}</textarea><div class="actions" style="margin-top:14px"><button class="primary" id="saveEdit">Save Changes</button></div>`;

    setTimeout(()=>document.dispatchEvent(new CustomEvent('clh-edit-courts-ready')),0);
    document.getElementById('saveEdit').onclick=async()=>{
      const save=document.getElementById('saveEdit');
      if(save.disabled)return;
      const start=document.getElementById('editStart').value,end=document.getElementById('editEnd').value;
      const selectedCourts=courtsFrom('editCourts');
      if(end<=start)return toast('End time must be after start time.');
      if(!selectedCourts.length)return toast('Select at least one court.');
      save.disabled=true;const old=save.textContent;save.textContent='Saving…';
      try{
        const {error}=await client().rpc('update_play_session',{
          p_session_id:id,
          p_title:document.getElementById('editName').value.trim()||e.name,
          p_starts_at:zonedIso(e.date,start),
          p_ends_at:zonedIso(e.date,end),
          p_courts:selectedCourts,
          p_capacity:Number(document.getElementById('editCapacity').value)||e.capacity,
          p_note:document.getElementById('editNote').value.trim()||null
        });
        if(error)throw error;
        document.getElementById('modal').classList.remove('open');
        await window.clhLoadSharedState?.();
        toast('Session updated.');
      }catch(error){toast(friendly(error));}
      finally{save.disabled=false;save.textContent=old;}
    };
  }

  function install(){
    const create=document.getElementById('createBtn');
    if(create) create.onclick=guardedCreate;
    window.editSession=guardedEdit;
  }

  window.addEventListener('clh-auth-ready',()=>setTimeout(install,0));
  setTimeout(install,50);
})();
