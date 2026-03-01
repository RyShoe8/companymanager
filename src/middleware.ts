import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Block common WordPress and other CMS probe paths to reduce log noise
  const blockedPaths = [
    '/wp-admin',
    '/wp-login.php',
    '/wp-content',
    '/wp-includes',
    '/administrator',
    '/phpmyadmin',
    '/.env',
    '/.git',
  ];
  
  if (blockedPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  
  // Allow access to sitemap and robots files (must be first)
  if (pathname === '/sitemap.xml' || pathname === '/robots.txt') {
    return NextResponse.next();
  }
  
  // Allow access to auth pages, setup page, admin page, public pages, and API routes
  if (
    pathname === '/' ||
    pathname.startsWith('/api/auth') || 
    pathname.startsWith('/api/invitations/') || 
    pathname.startsWith('/api/portal/') ||
    pathname.startsWith('/api/organization') ||
    pathname.startsWith('/api/profile') ||
    pathname.startsWith('/api/admin') ||
    pathname.startsWith('/api/contact') ||
    pathname.startsWith('/login') || 
    pathname.startsWith('/register') ||
    pathname === '/setup-organization' ||
    pathname === '/admin' ||
    pathname === '/about' ||
    pathname === '/contact' ||
    pathname === '/terms' ||
    pathname === '/privacy' ||
    pathname.startsWith('/features/') ||
    pathname.startsWith('/portal/')
  ) {
    return NextResponse.next();
  }

  // Check for session cookie
  const session = request.cookies.get('session');
  
  // If no session and trying to access protected route, redirect to login
  if (!session && !pathname.startsWith('/api/auth') && !pathname.startsWith('/api/invitations/') && !pathname.startsWith('/api/portal/')) {
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
     * - uploads (uploaded user files)
     * - images (static images)
     * - sitemap.xml (sitemap file)
     * - robots.txt (robots file)
     */
    '/((?!_next/static|_next/image|favicon.ico|uploads|images|sitemap.xml|robots.txt).*)',
  ],
};
