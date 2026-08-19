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
    const mine = same(e.host, profile);
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
      ${mine ? `<div class="cancelbox"><strong>You started this session.</strong><p class="small">You can change courts, capacity, time or notes if plans change.</p><div class="actions"><button class="danger" onclick="askCancel('${e.id}')">Cancel Session</button></div></div>` : ''}
    `;
    $('modal').classList.add('open');
  };

  window.printPlaySheet = id => {
    const e = state.events.find(x => x.id === id);
    if (!e) return;
    const roster = numberedRoster(e);
    const rosterRows = roster.map(p => `<tr><td>${p.number}</td><td>${esc(p.name)}</td></tr>`).join('');
    const waitRows = e.waitlist.length ? `<div class="wait-print"><h3>Waitlist</h3>${e.waitlist.map((p,i)=>`<div>${i+1}. ${esc(p)}</div>`).join('')}</div>` : '';
    const hint = e.format === 'Round Robin'
      ? 'Use player numbers when assigning partners, opponents and court rotations.'
      : e.format === 'Ladder'
      ? 'Use player numbers when assigning starting courts and ladder positions.'
      : e.format === 'League'
      ? 'Use player numbers when recording teams, matchups and scores.'
      : 'Use player numbers for court assignments or casual rotations.';

    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (!w) return toast('Allow pop-ups to create the PDF.');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(e.name)} - Play Sheet</title><style>
      body{font-family:Arial,sans-serif;color:#17324d;margin:32px;line-height:1.35}h1{margin:0 0 6px;font-size:26px}h2{margin:28px 0 10px;font-size:18px}.meta{color:#536a75;margin-bottom:4px}.format{font-weight:700;margin:12px 0;padding:8px 10px;background:#eef7f8;border-radius:8px;display:inline-block}table{border-collapse:collapse;width:100%;max-width:520px;margin-top:12px}th,td{border-bottom:1px solid #dbe6e9;padding:9px 8px;text-align:left}th:first-child,td:first-child{width:70px;text-align:center;font-weight:700}.instructions{margin-top:22px;padding:12px;border:1px solid #dbe6e9;border-radius:10px}.line{border-bottom:1px solid #999;height:28px;margin-top:8px}.wait-print{margin-top:26px}.print-actions{margin:24px 0}.print-actions button{padding:10px 14px;font-size:15px}@media print{.print-actions{display:none}body{margin:14mm}}
    </style></head><body>
      <h1>${esc(e.name)}</h1>
      <div class="meta">${fmtDate(e.date,{weekday:'long',month:'long',day:'numeric'})}</div>
      <div class="meta">${fmtTime(e.start)}–${fmtTime(e.end)} · Courts ${esc(e.courts)}</div>
      <div class="format">${esc(formatLabel(e.format))} · ${esc(e.level)}</div>
      ${e.note ? `<p>${esc(e.note)}</p>` : ''}
      <h2>Player Numbers</h2>
      <table><thead><tr><th>#</th><th>Player</th></tr></thead><tbody>${rosterRows || '<tr><td colspan="2">No confirmed players</td></tr>'}</tbody></table>
      ${waitRows}
      <div class="instructions"><strong>Play setup</strong><p>${hint}</p><div class="line"></div><div class="line"></div><div class="line"></div><div class="line"></div></div>
      <div class="print-actions"><button onclick="window.print()">Print / Save as PDF</button></div>
    </body></html>`);
    w.document.close();
    w.focus();
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
