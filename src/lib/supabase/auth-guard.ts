import { createClient } from '@/lib/supabase/server';

/**
 * Validates the current request's Supabase session and returns the user ID.
 * Returns `null` if the user is not authenticated.
 *
 * Use in API routes:
 * ```ts
 * const userId = await getAuthenticatedUserId();
 * if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 * ```
 */
export async function getAuthenticatedUserId(): Promise<string | null> {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        return user?.id ?? null;
    } catch {
        return null;
    }
}
