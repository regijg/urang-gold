import { createBrowserClient } from '@supabase/ssr'

// Browser client. Session lives in cookies (shared with server code via @supabase/ssr),
// not in localStorage, so the server can verify the user on every request.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
