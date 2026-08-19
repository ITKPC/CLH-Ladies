/* Clickable court selector for the 10 Club La Huerta courts. */
(() => {
  const TOTAL_COURTS = 10;

  function parseCourts(value) {
    const text = String(value || '').trim();
    const range = text.match(/^(\d+)\s*[–—-]\s*(\d+)$/);
    if (range) {
      const a = Math.max(1, Math.min(TOTAL_COURTS, Number(range[1])));
      const b = Math.max(1, Math.min(TOTAL_COURTS, Number(range[2])));
      const start = Math.min(a, b), end = Math.max(a, b);
      return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }
    return [...new Set((text.match(/\d+/g) || []).map(Number).filter(n => n >= 1 && n <= TOTAL_COURTS))].sort((a,b)=>a-b);
  }

  function formatCourts(selected) {
    return [...selected].sort((a,b)=>a-b).join(', ');
  }

  function buildPicker(input, selected, compact = false) {
    if (!input || input.dataset.courtPickerReady) return;
    input.dataset.courtPickerReady = '1';
    input.type = 'hidden';

    const wrap = document.createElement('div');
    wrap.className = `court-picker${compact ? ' compact' : ''}`;
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Select courts');

    const selectedSet = new Set(selected);
    const buttons = [];
    for (let n = 1; n <= TOTAL_COURTS; n++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'court-choice';
      btn.textContent = n;
      btn.setAttribute('aria-label', `Court ${n}`);
      btn.addEventListener('click', () => {
        if (selectedSet.has(n)) selectedSet.delete(n); else selectedSet.add(n);
        renderSelection();
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      buttons.push(btn);
      wrap.appendChild(btn);
    }

    const summary = document.createElement('div');
    summary.className = 'court-summary';
    wrap.appendChild(summary);
    input.after(wrap);

    function renderSelection() {
      buttons.forEach((btn, index) => {
        const active = selectedSet.has(index + 1);
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      const list = [...selectedSet].sort((a,b)=>a-b);
      summary.textContent = list.length ? `${list.length} court${list.length === 1 ? '' : 's'} selected: ${list.join(', ')}` : 'Select at least one court';
      summary.classList.toggle('empty', !list.length);
      input.value = formatCourts(selectedSet);
    }

    input.addEventListener('change', () => {
      const fromInput = parseCourts(input.value);
      const current = formatCourts(selectedSet);
      const next = fromInput.join(', ');
      if (next === current) return;
      selectedSet.clear();
      fromInput.forEach(n => selectedSet.add(n));
      renderSelection();
    });

    renderSelection();
  }

  function enhanceCreatePicker() {
    const input = document.getElementById('courts');
    if (!input || input.dataset.courtPickerReady) return;
    let selected = parseCourts(input.value);
    if (!selected.length) selected = [3,4,5,6];
    buildPicker(input, selected);
  }

  function enhanceEditPicker() {
    const input = document.getElementById('editCourts');
    if (!input || input.dataset.courtPickerReady) return;
    buildPicker(input, parseCourts(input.value), true);
  }

  function addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .court-picker{display:grid;grid-template-columns:repeat(10,minmax(42px,1fr));gap:7px;margin-top:2px}
      .court-choice{border:1px solid var(--line,#dbe6e9);border-radius:10px;background:#fff;color:var(--ink,#17324d);padding:11px 5px;font-weight:900;min-height:44px}
      .court-choice.active{background:var(--teal,#087ca1);border-color:var(--teal,#087ca1);color:#fff;box-shadow:0 2px 7px rgba(8,124,161,.18)}
      .court-choice:focus-visible{outline:3px solid rgba(8,124,161,.25);outline-offset:2px}
      .court-summary{grid-column:1/-1;font-size:.76rem;color:var(--muted,#6a7d88);margin-top:2px;font-weight:750}
      .court-summary.empty{color:#9b3030}
      .court-picker.compact{grid-template-columns:repeat(10,minmax(34px,1fr))}
      .court-picker.compact .court-choice{min-height:38px;padding:7px 3px}
      @media(max-width:680px){.court-picker,.court-picker.compact{grid-template-columns:repeat(5,1fr)}}
    `;
    document.head.appendChild(style);
  }

  addStyles();
  enhanceCreatePicker();

  const observer = new MutationObserver(() => {
    enhanceCreatePicker();
    enhanceEditPicker();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  const guard = document.createElement('script');
  guard.src = 'booking-guard.js';
  document.body.appendChild(guard);
})();
