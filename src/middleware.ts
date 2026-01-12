import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Allow access to auth pages and API routes
  if (pathname.startsWith('/api/auth') || pathname.startsWith('/login') || pathname.startsWith('/register')) {
    return NextResponse.next();
  }

  // Check for session cookie
  const session = request.cookies.get('session');
  
  // If no session and trying to access protected route, redirect to login
  if (!session && !pathname.startsWith('/api/auth')) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
