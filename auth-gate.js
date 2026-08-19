/* Shared group passkey gate + Supabase anonymous identity. */
(() => {
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

  function getClient() {
    if (!window.createClhSupabaseClient) throw new Error('Supabase is not ready.');
    client = client || window.createClhSupabaseClient();
    return client;
  }

  async function ensureAnonymousIdentity(name) {
    const supabase = getClient();
    const { data: current, error: currentError } = await supabase.auth.getSession();
    if (currentError) throw currentError;
    if (current.session?.user) return current.session.user;

    const { data, error } = await supabase.auth.signInAnonymously({
      options: { data: { display_name: name } }
    });
    if (error) throw error;
    return data.user;
  }

  async function approveDevice(name, passkey) {
    const supabase = getClient();
    await ensureAnonymousIdentity(name);
    const { data, error } = await supabase.functions.invoke('group-access', {
      body: { name, passkey }
    });
    if (error) throw new Error(data?.error || error.message || 'Could not verify group access.');
    if (!data?.ok) throw new Error(data?.error || 'Could not verify group access.');

    // Refresh so the newly approved group membership is present in the JWT.
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) throw refreshError;
    return refreshed.user || refreshed.session?.user;
  }

  async function unlock(name, user) {
    localStorage.setItem(PROFILE, name);
    window.clhSupabase = getClient();
    window.clhAuthUser = user;
    document.body.classList.remove('clh-locked');
    document.getElementById('accessGate')?.remove();

    if (typeof profile !== 'undefined') {
      profile = name;
      if (typeof renderAll === 'function') renderAll();
    }
    window.dispatchEvent(new CustomEvent('clh-auth-ready', { detail: { user, name } }));
  }

  async function tryRememberedAccess() {
    const supabase = getClient();
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user) return false;
    const user = data.session.user;
    if (user.app_metadata?.group_approved !== true) return false;
    const name = localStorage.getItem(PROFILE) || user.user_metadata?.display_name || 'Player';
    await unlock(name, user);
    return true;
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
      if (!name) { errorBox.textContent = 'Enter your name.'; return; }
      button.disabled = true;
      button.textContent = 'Checking…';
      try {
        const user = await approveDevice(name, passkey);
        await unlock(name, user);
      } catch (error) {
        const message = error?.message || 'Could not enter the app.';
        errorBox.textContent = /anonymous/i.test(message)
          ? 'Anonymous sign-in needs to be enabled in the Supabase project.'
          : message;
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
    try {
      if (await tryRememberedAccess()) return;
    } catch (error) {
      console.warn('Remembered group access could not be restored', error);
    }
    showGate();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
