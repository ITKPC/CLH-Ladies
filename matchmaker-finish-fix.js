/* Recover the matchmaker UI if the database succeeds but the post-create refresh stalls. */
(() => {
  const client = () => window.clhSupabase || window.createClhSupabaseClient?.();
  const user = () => window.clhAuthUser;
  let token = 0;

  async function recover(button, startedAt, myToken, attempt = 0) {
    if (myToken !== token) return;
    if (!button?.isConnected) return;
    if (!/making game/i.test(button.textContent || '')) return;
    if (!client() || !user()) return;

    try {
      const { data, error } = await client()
        .from('play_sessions')
        .select('id,created_at,title,created_by')
        .eq('created_by', user().id)
        .eq('title', "Who's Game? Match")
        .gte('created_at', startedAt)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && data?.length) {
        try {
          await Promise.race([
            Promise.resolve(window.clhLoadSharedState?.()),
            new Promise(resolve => setTimeout(resolve, 2200))
          ]);
        } catch {}

        button.disabled = false;
        button.textContent = 'Make This Game';
        window.clhShowView?.('upcomingView');
        if (typeof toast === 'function') toast('Game made — it’s in Upcoming.');
        token++;
        return;
      }
    } catch (error) {
      console.warn('Matchmaker completion check failed', error);
    }

    if (attempt < 12) {
      setTimeout(() => recover(button, startedAt, myToken, attempt + 1), 500);
      return;
    }

    if (/making game/i.test(button.textContent || '')) {
      button.disabled = false;
      button.textContent = 'Make This Game';
      if (typeof toast === 'function') toast('That took too long. Please try again.');
    }
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-make-game]');
    if (!button) return;
    const myToken = ++token;
    const startedAt = new Date(Date.now() - 3000).toISOString();
    setTimeout(() => recover(button, startedAt, myToken), 350);
  });
})();
