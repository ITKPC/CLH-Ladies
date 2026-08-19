/* Shared group passkey gate + Supabase anonymous identity. */
(() => {
  const ACCESS_TOKEN = 'clh-group-access-v1';
  const PROFILE = 'clh-ladies-profile';
  let client;

  function addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      body.clh-locked{overflow:hidden}
      body.clh-locked .app{filter:blur(3px);pointer-events:none;user-select:none}
      .access-gate{position:fixed;inset:0;z-index:1000;background:linear-gradient(145deg,#087ca1,#12a5c3);display:grid;place-items:center;padding:20px}
      .access-card{width:min(420px,100%);background:white;border-radius:22px;padding:24px;box-shadow:0 18px 55px rgba(0,0,0,.24);color:#17324d}
      .access-mark{width:74px;height:74px;border-radius:50%;display:block;margin:0 auto 12px;border:4px solid #eef7f8}
      .access-card h2{text-align:center;margin:0 0 5px;font-size:1.5rem}
      .access-card .access-sub{text-align:center;color:#6a7d88;font-size:.88rem;margin:0 0 18px;line-height:1.45}
      .access-card label{display:block;font-size:.82rem;font-weight:850;margin:12px 0 5px}
      .access-card input{width:100%;padding:12px;border:1px solid #c8d7db;border-radius:11px;font:inherit}
      .access-card button{width:100%;margin-top:16px;border:0;border-radius:11px;padding:12px;background:#087ca1;color:white;font-weight:900;font:inherit;cursor:pointer}
      .access-card button:disabled{opacity:.55;cursor:wait}
      .access-error{min-height:20px;margin-top:10px;color:#9b3030;font-size:.82rem;text-align:center;font-weight:700}
      .access-loading{text-align:center;color:white;font-weight:800}
    `;
    document.head.appendChild(style);
  }

  function gateHtml() {
    return `<div class="access-gate" id="accessGate">
      <div class="access-card">
        <img class="access-mark" src="assets/ladies-pickleball.svg" alt="">
        <h2>Ladies Pickleball</h2>
        <p class="access-sub">Enter the group passkey once on this device.</p>
        <label for="accessName">Your name</label>
        <input id="accessName" autocomplete="name" placeholder="e.g. Nancy M.">
        <label for="accessPasskey">Group passkey</label>
        <input id="accessPasskey" type="password" autocomplete="current-password" placeholder="Group passkey">
        <button id="accessEnter" type="button">Enter</button>
        <div class="access-error" id="accessError"></div>
      </div>
    </div>`;
  }

  async function verifyWithServer(payload) {
    const response = await fetch('/.netlify/functions/group-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || 'Could not verify group access.');
    return data;
  }

  async function ensureSupabaseIdentity(name) {
    if (!window.createClhSupabaseClient) throw new Error('Supabase is not ready.');
    client = client || window.createClhSupabaseClient();

    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;

    let user = sessionData.session?.user;
    if (!user) {
      const { data, error } = await client.auth.signInAnonymously({
        options: { data: { display_name: name } }
      });
      if (error) throw error;
      user = data.user;
    }

    if (user?.id) {
      await client.from('profiles').update({ display_name: name }).eq('id', user.id);
    }

    window.clhSupabase = client;
    window.clhAuthUser = user;
  }

  async function unlock(name) {
    localStorage.setItem(PROFILE, name);
    await ensureSupabaseIdentity(name);
    document.body.classList.remove('clh-locked');
    document.getElementById('accessGate')?.remove();

    // Keep the existing interface in sync until its data layer is moved to Supabase.
    if (typeof profile !== 'undefined') {
      profile = name;
      if (typeof renderAll === 'function') renderAll();
    }
  }

  async function tryRememberedAccess() {
    const token = localStorage.getItem(ACCESS_TOKEN);
    if (!token) return false;
    try {
      const result = await verifyWithServer({ token });
      await unlock(result.name || localStorage.getItem(PROFILE) || 'Player');
      return true;
    } catch {
      localStorage.removeItem(ACCESS_TOKEN);
      return false;
    }
  }

  function showGate() {
    if (document.getElementById('accessGate')) return;
    document.body.insertAdjacentHTML('beforeend', gateHtml());
    const savedName = localStorage.getItem(PROFILE);
    if (savedName) document.getElementById('accessName').value = savedName;

    const submit = async () => {
      const button = document.getElementById('accessEnter');
      const errorBox = document.getElementById('accessError');
      const name = document.getElementById('accessName').value.trim();
      const passkey = document.getElementById('accessPasskey').value;
      errorBox.textContent = '';
      button.disabled = true;
      button.textContent = 'Checking…';
      try {
        const result = await verifyWithServer({ name, passkey });
        localStorage.setItem(ACCESS_TOKEN, result.token);
        await unlock(result.name);
      } catch (error) {
        errorBox.textContent = error.message || 'Could not enter the app.';
        button.disabled = false;
        button.textContent = 'Enter';
      }
    };

    document.getElementById('accessEnter').addEventListener('click', submit);
    document.getElementById('accessPasskey').addEventListener('keydown', e => {
      if (e.key === 'Enter') submit();
    });
  }

  async function start() {
    addStyles();
    document.body.classList.add('clh-locked');
    const remembered = await tryRememberedAccess();
    if (!remembered) showGate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
