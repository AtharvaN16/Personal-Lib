import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role client that bypasses RLS. Server-only — must never be imported from a
 * 'use client' file or a route that isn't explicitly gating access itself (the public
 * /share/[token] page validates the token before using this).
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
