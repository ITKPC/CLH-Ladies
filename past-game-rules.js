/* Completed-game behavior: past dates are history, not actionable play. */
(() => {
  const zone = 'America/Mazatlan';

  function clubToday() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    const get = type => parts.find(p => p.type === type)?.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  }

  const isPast = date => Boolean(date && date < clubToday());
  const eventFor = id => window.state?.events?.find(e => e.id === id);

  function decoratePastCardHtml(html, event) {
    if (!isPast(event?.date)) return html;
    const template = document.createElement('template');
    template.innerHTML = html;
    const card = template.content.firstElementChild;
    if (!card) return html;
    card.classList.add('completed-game');
    const badges = card.querySelector('.badges');
    if (badges && !badges.querySelector('.completed-badge')) {
      const badge = document.createElement('span');
      badge.className = 'badge completed-badge';
      badge.textContent = 'Completed';
      badges.appendChild(badge);
    }
    card.querySelectorAll('button').forEach(button => {
      const label = (button.textContent || '').trim();
      if (/^(Join|Give Up Spot|Edit|Cancel)/i.test(label)) button.remove();
    });
    return template.innerHTML;
  }

  function installCardRules() {
    if (typeof window.eventCard !== 'function' || window.eventCard.__clhPastRules) return;
    const original = window.eventCard;
    const wrapped = function(event) {
      return decoratePastCardHtml(original(event), event);
    };
    wrapped.__clhPastRules = true;
    window.eventCard = wrapped;
  }

  function installDetailRules() {
    if (typeof window.showRoster !== 'function' || window.showRoster.__clhPastRules) return;
    const original = window.showRoster;
    const wrapped = function(id) {
      original(id);
      const event = eventFor(id);
      if (!isPast(event?.date)) return;
      const body = document.getElementById('modalBody');
      if (!body) return;
      const h2 = body.querySelector('h2');
      if (h2 && !body.querySelector('.completed-detail')) {
        const badge = document.createElement('span');
        badge.className = 'badge completed-detail';
        badge.textContent = 'Completed';
        h2.insertAdjacentElement('afterend', badge);
      }
      body.querySelectorAll('button').forEach(button => {
        const label = (button.textContent || '').trim();
        if (/^(Edit Session|Cancel Session|Cancel Match|Give Up Spot|Join)$/i.test(label)) button.remove();
      });
      body.querySelector('.cancelbox')?.remove();
    };
    wrapped.__clhPastRules = true;
    window.showRoster = wrapped;
  }

  function guardAction(name, message) {
    const fn = window[name];
    if (typeof fn !== 'function' || fn.__clhPastRules) return;
    const wrapped = function(id, ...rest) {
      const event = eventFor(id);
      if (isPast(event?.date)) {
        if (typeof toast === 'function') toast(message || 'This game is completed.');
        return;
      }
      return fn.call(this, id, ...rest);
    };
    wrapped.__clhPastRules = true;
    window[name] = wrapped;
  }

  function parseMatchDate(text) {
    const label = String(text || '').split('·')[0].trim();
    if (!label) return null;
    const today = clubToday();
    const year = today.slice(0, 4);
    const parsed = new Date(`${label}, ${year} 12:00:00`);
    if (Number.isNaN(parsed.getTime())) return null;
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const dd = String(parsed.getDate()).padStart(2, '0');
    return `${parsed.getFullYear()}-${mm}-${dd}`;
  }

  function applyMatchmakerRules() {
    document.querySelectorAll('[data-av-date]').forEach(button => {
      if (isPast(button.dataset.avDate)) {
        button.disabled = true;
        button.classList.add('past-availability');
        button.title = 'This day has already passed.';
      }
    });

    document.querySelectorAll('#gameView .match-opportunity').forEach(card => {
      const date = parseMatchDate(card.querySelector('.match-head strong')?.textContent);
      if (date && isPast(date)) card.remove();
    });
  }

  function install() {
    installCardRules();
    installDetailRules();
    guardAction('join', 'That game has already happened.');
    guardAction('giveUp', 'That game has already happened.');
    guardAction('editSession', 'Completed games can no longer be edited.');
    guardAction('cancelSession', 'Completed games can no longer be cancelled.');
    applyMatchmakerRules();
    if (document.getElementById('upcomingView')?.classList.contains('active') && typeof window.renderUpcoming === 'function') {
      window.renderUpcoming();
    }
  }

  const style = document.createElement('style');
  style.textContent = `
    .completed-game{opacity:.72;background:#f7f8f8}
    .completed-badge,.completed-detail{background:#edf0f1!important;color:#667780!important}
    .past-availability{opacity:.4!important;text-decoration:line-through;cursor:not-allowed!important}
  `;
  document.head.appendChild(style);

  install();
  window.addEventListener('clh-auth-ready', () => setTimeout(install, 0));
  window.addEventListener('clh-app-ready', () => setTimeout(install, 0));
  const observer = new MutationObserver(() => requestAnimationFrame(applyMatchmakerRules));
  observer.observe(document.querySelector('.app') || document.body, { childList: true, subtree: true });
})();
