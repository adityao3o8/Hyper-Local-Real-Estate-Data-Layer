/**
 * Lazy Supabase client built from env vars (uses the REST API directly so we
 * don't need to pull in @supabase/supabase-js for read-only queries).
 *
 * Falls back gracefully: if SUPABASE_URL/SUPABASE_KEY are unset, callers read
 * from the bundled JSON files instead.
 */

interface SupabaseHandle {
  url: string;
  key: string;
}

function resolveKey(): string | null {
  return (
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    null
  );
}

let _cache: SupabaseHandle | null | undefined;

export function supabaseClient(): SupabaseHandle | null {
  if (_cache !== undefined) return _cache;
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = resolveKey();
  _cache = url && key ? { url, key } : null;
  return _cache;
}

export function supabaseEnabled(): boolean {
  return supabaseClient() !== null;
}
