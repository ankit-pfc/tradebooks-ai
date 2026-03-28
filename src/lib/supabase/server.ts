/**
 * server.ts
 * Server-side Supabase client for use in Server Components, API routes,
 * and middleware. Uses cookie-based session management.
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  // Dynamic access prevents Next.js from inlining empty strings at build time
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL']!;
  const key = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!;

  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll is called from Server Component — silently ignore.
            // The middleware will refresh the session before the response.
          }
        },
      },
    },
  );
}
