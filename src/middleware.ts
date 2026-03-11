import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Define allowed paths
  // We allow root (/), terms, and privacy
  // We also need to allow static files, _next, favicon, etc.
  const isAllowedPath = 
    pathname === '/' || 
    pathname.startsWith('/privacy') || 
    pathname.startsWith('/terms') ||
    pathname.includes('.') || // Static files like .ico, .png, etc.
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') // Keep API alive for now unless told otherwise, but usually dashboard uses these

  if (!isAllowedPath) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
