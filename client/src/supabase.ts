import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** False until VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY are set (Vercel env vars + local .env). */
export const supabaseConfigured = Boolean(url && anonKey);

// createClient throws on a malformed URL even before any network call, so a
// syntactically valid placeholder keeps the app usable (login just fails
// with a clear message) instead of crashing the whole client at boot.
export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder-anon-key');
