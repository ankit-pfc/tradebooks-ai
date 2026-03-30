import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/** Paths that never require authentication. */
const PUBLIC_PATHS = ['/', '/login', '/signup', '/login/verify-mfa', '/privacy', '/terms'];

function isPublicPath(pathname: string): boolean {
    return (
        PUBLIC_PATHS.includes(pathname) ||
        pathname.startsWith('/_next') ||
        pathname.startsWith('/api/auth') ||
        pathname.startsWith('/auth') ||
        pathname.includes('.') ||
        pathname.startsWith('/favicon')
    );
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Use SUPABASE_URL (server-only, not inlined by Next.js at build time)
    // with NEXT_PUBLIC_* as fallback for local dev.
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Skip Supabase session refresh if env vars are not configured
    if (!supabaseUrl || !supabaseAnonKey) {
        return NextResponse.next();
    }

    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(
        supabaseUrl,
        supabaseAnonKey,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value),
                    );
                    supabaseResponse = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options),
                    );
                },
            },
        },
    );

    // Refresh the session — this keeps the auth cookie alive
    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Redirect unauthenticated users away from protected routes
    if (!user && !isPublicPath(pathname)) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        url.searchParams.set('redirectTo', pathname);
        return NextResponse.redirect(url);
    }

    // Redirect authenticated users away from login/signup (but not verify-mfa)
    if (user && (pathname === '/login' || pathname === '/signup')) {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
    }

    // MFA enforcement: if user has TOTP factors but hasn't verified yet (aal1),
    // redirect to the MFA verification page
    if (user && !isPublicPath(pathname)) {
        const { data: aalData } =
            await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

        if (
            aalData &&
            aalData.nextLevel === 'aal2' &&
            aalData.currentLevel === 'aal1'
        ) {
            const url = request.nextUrl.clone();
            url.pathname = '/login/verify-mfa';
            url.searchParams.set('redirectTo', pathname);
            return NextResponse.redirect(url);
        }
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
