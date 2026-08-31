import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** False until SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY are set in the Render
 * dashboard — the server (and local dev with no env vars at all) keeps
 * playing normally either way, it just skips stats writes and token
 * verification silently instead of ever crashing the game over it. */
export const statsConfigured = Boolean(url && serviceRoleKey);

// Service-role client: bypasses RLS by design — every table this touches
// has zero insert/update/delete policies for anon/authenticated, so this
// key (never sent to any client) is the *only* way those rows get written.
export const supabaseAdmin = statsConfigured
  ? createClient(url!, serviceRoleKey!, { auth: { persistSession: false } })
  : null;

/** Verifies a Supabase access token and returns the real user id it belongs
 * to, or null if unconfigured/missing/invalid — never throws, never blocks
 * the caller on a slow/failed network call being treated as fatal. */
export async function verifyUserToken(token: string | null | undefined): Promise<string | null> {
  if (!statsConfigured || !token) return null;
  try {
    const { data, error } = await supabaseAdmin!.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user.id;
  } catch (err) {
    console.error('verifyUserToken failed:', err);
    return null;
  }
}
