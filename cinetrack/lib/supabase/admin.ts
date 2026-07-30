import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Service-role client for trusted, server-only code — currently just the
// TMDb sync job (lib/sync.ts). It bypasses Row Level Security entirely.
//
// NEVER import this into a Server Action or Route Handler that acts on
// behalf of a specific signed-in user without its own auth check first —
// there is no per-user scoping here, only "is this trusted server code".
export function createAdminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
