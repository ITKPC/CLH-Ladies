// Club La Huerta Supabase client configuration.
// This file contains only the browser-safe project URL and publishable key.
// Never place a Supabase secret/service-role key in frontend code.

window.CLH_SUPABASE_CONFIG = {
  url: 'https://ucuzjvvkucmxukolyzwu.supabase.co',
  publishableKey: 'sb_publishable_kiAeTW_f0sryFdU68DeTow_9OhznDbt'
};

window.createClhSupabaseClient = function createClhSupabaseClient() {
  if (!window.supabase || !window.supabase.createClient) {
    throw new Error('Supabase client library has not loaded.');
  }

  const { url, publishableKey } = window.CLH_SUPABASE_CONFIG;
  return window.supabase.createClient(url, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
};
