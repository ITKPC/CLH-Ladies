/* Numbered roster + session detail / print sheet enhancements. */
(() => {
  const formatLabel = value => value === 'Quick Play' ? 'Drop-In / Quick Play' : value;

  function numberedRoster(e) {
    return e.players.map((p, i) => ({ number: i + 1, name: p }));
  }

  function numberedRosterHtml(e) {
    const roster = numberedRoster(e);
    if (!roster.length) return '<div class="small">No one yet.</div>';
    return roster.map(player => `
      <div class="person player-number-row">
        <span class="player-number">${player.number}</span>
        <span class="player-name">${esc(player.name)}</span>
      </div>
    `).join('');
  }

  function waitlistHtml(e) {
    if (!e.waitlist.length) return '';
    return `<h3>Waitlist · ${e.waitlist.length}</h3><div class="roster">${e.waitlist.map((p, i) => `
      <div class="person wait"><span>${i + 1}. ${esc(p)}</span></div>
    `).join('')}</div>`;
  }

  function sessionToolsHtml(e, mine) {
    return `<div class="play-tools">
      <button class="secondary" onclick="printPlaySheet('${e.id}')">Print / Save PDF</button>
      ${mine ? `<button class="ghost" onclick="editSession('${e.id}')">Edit Session</button>` : ''}
    </div>`;
  }

  window.showRoster = id => {
    const e = state.events.find(x => x.id === id);
    if (!e) return;
    const mine = !!(e.createdBy && e.createdBy === window.clhAuthUser?.id);
    const isMatch = /^Who['’]s Game\? Match$/i.test(e.name || '');
    const cancelLabel = isMatch ? 'Cancel Match' : 'Cancel Session';
    const ownerHelp = isMatch
      ? 'You made this match. Cancelling it removes it from Upcoming for everyone.'
      : 'You can change courts, capacity, time or notes if plans change.';
    $('modalBody').innerHTML = `
      <h2>${esc(e.name)}</h2>
      <p><strong>${fmtDate(e.date,{weekday:'long',month:'long',day:'numeric'})}</strong><br>${fmtTime(e.start)}–${fmtTime(e.end)} · Courts ${esc(e.courts)}</p>
      <p><span class="badge">${esc(formatLabel(e.format))}</span><span class="badge">${esc(e.level)}</span></p>
      ${e.note ? `<p class="note">${esc(e.note)}</p>` : ''}
      <p class="small">Started by ${esc(e.host)}</p>
      <h3>Player Numbers · ${e.players.length}/${e.capacity}</h3>
      <div class="number-help">These numbers are the player numbers used on court and on the play sheet.</div>
      <div class="roster">${numberedRosterHtml(e)}</div>
      ${waitlistHtml(e)}
      ${sessionToolsHtml(e, mine)}
      ${mine ? `<div class="cancelbox"><strong>You started this ${isMatch ? 'match' : 'session'}.</strong><p class="small">${ownerHelp}</p><div class="actions"><button class="danger" onclick="askCancel('${e.id}')">${cancelLabel}</button></div></div>` : ''}
    `;
    $('modal').classList.add('open');
  };

  window.printPlaySheet = id => {
    const e = state.events.find(x => x.id === id);
    if (!e) return;

    const roster = numberedRoster(e);
    const rosterCards = roster.map(p => `<div class="roster-item"><span class="num">${p.number}</span><span>${esc(p.name)}</span></div>`).join('');
    const waitRows = e.waitlist.length ? `<div class="wait-print"><strong>Waitlist:</strong> ${e.waitlist.map((p,i)=>`${i+1}. ${esc(p)}`).join(' · ')}</div>` : '';
    const hint = e.format === 'Round Robin'
      ? 'Use player numbers for partners, opponents and court rotations.'
      : e.format === 'Ladder'
      ? 'Use player numbers for starting courts and ladder positions.'
      : e.format === 'League'
      ? 'Use player numbers for teams, matchups and scores.'
      : 'Use player numbers for court assignments or casual rotations.';

    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(e.name)} - Play Sheet</title><style>
      @page{size:portrait;margin:8mm}
      *{box-sizing:border-box}
      body{font-family:Arial,sans-serif;color:#17324d;margin:18px;line-height:1.2;background:#fff;font-size:12px}
      h1{margin:0 0 3px;font-size:22px;line-height:1.05}
      h2{margin:12px 0 6px;font-size:15px}
      .meta{color:#536a75;margin:1px 0}
      .format{font-weight:700;margin:6px 0;padding:5px 7px;background:#eef7f8;border-radius:6px;display:inline-block}
      .note{margin:5px 0}
      .roster-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:3px 10px;margin-top:5px}
      .roster-item{display:grid;grid-template-columns:24px 1fr;gap:5px;align-items:center;border-bottom:1px solid #dbe6e9;padding:3px 2px;min-width:0}
      .roster-item .num{font-weight:800;text-align:center}
      .roster-item span:last-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .wait-print{margin-top:8px;font-size:10.5px;line-height:1.3}
      .instructions{margin-top:10px;padding:7px 9px;border:1px solid #dbe6e9;border-radius:7px;font-size:10.5px}
      .instructions p{margin:3px 0 5px}
      .line{border-bottom:1px solid #999;height:17px;margin-top:3px}
      .print-actions{margin:14px 0}.print-actions button{padding:10px 14px;font-size:14px;border:0;border-radius:8px;background:#087ca1;color:white;font-weight:700}
      @media print{
        .print-actions{display:none}
        html,body{width:100%;height:auto}
        body{margin:0;font-size:10.5px}
        h1{font-size:19px}
        h2{font-size:13px;margin:9px 0 4px}
        .format{margin:4px 0;padding:4px 6px}
        .roster-grid{gap:2px 8px;margin-top:3px}
        .roster-item{padding:2px 1px}
        .instructions{margin-top:7px;padding:5px 7px}
        .line{height:14px}
      }
      @media(max-width:560px){body{margin:14px}.roster-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    </style></head><body>
      <h1>${esc(e.name)}</h1>
      <div class="meta">${fmtDate(e.date,{weekday:'long',month:'long',day:'numeric'})} · ${fmtTime(e.start)}–${fmtTime(e.end)} · Courts ${esc(e.courts)}</div>
      <div class="format">${esc(formatLabel(e.format))} · ${esc(e.level)} · ${e.players.length} players</div>
      ${e.note ? `<div class="note">${esc(e.note)}</div>` : ''}
      <h2>Player Numbers</h2>
      <div class="roster-grid">${rosterCards || '<div>No confirmed players</div>'}</div>
      ${waitRows}
      <div class="instructions"><strong>Play setup</strong><p>${hint}</p><div class="line"></div><div class="line"></div></div>
      <div class="print-actions"><button type="button" onclick="window.print()">Print / Save as PDF</button></div>
    </body></html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, '_blank');
    if (!opened) {
      URL.revokeObjectURL(url);
      return toast('Allow pop-ups to create the play sheet.');
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  function makeCardsClickable() {
    document.querySelectorAll('.event').forEach(card => {
      if (card.dataset.sessionClickBound) return;
      const btn = card.querySelector('button[onclick*="showRoster"]');
      const match = btn?.getAttribute('onclick')?.match(/showRoster\('([^']+)'\)/);
      if (!match) return;
      const id = match[1];
      card.dataset.sessionClickBound = '1';
      card.classList.add('clickable-session');
      card.addEventListener('click', event => {
        if (event.target.closest('button')) return;
        showRoster(id);
      });
    });
  }

  function addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .clickable-session{cursor:pointer}.clickable-session:hover{border-color:var(--teal)}
      .player-number-row{display:grid;grid-template-columns:42px 1fr;align-items:center;justify-content:initial}
      .player-number{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:var(--teal);color:white;font-weight:950;font-size:.9rem}
      .player-name{font-weight:800}.number-help{font-size:.78rem;color:var(--muted);margin:-4px 0 10px}
      .play-tools{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:14px 0}
      @media(max-width:520px){.play-tools{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  addStyles();
  makeCardsClickable();
  const observer = new MutationObserver(() => requestAnimationFrame(makeCardsClickable));
  observer.observe(document.querySelector('.app') || document.body, {childList:true,subtree:true});
})();
