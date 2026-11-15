import { NextResponse, type NextRequest } from 'next/server';

/** Routes that need a session; anything else (assets, /login) is untouched. */
const PROTECTED = ['/', '/tasks', '/projects', '/org', '/notifications', '/files', '/account', '/crm', '/social'];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const needsAuth = PROTECTED.some((p) => (p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(`${p}/`)));
  if (!needsAuth || request.cookies.has('refresh_token')) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!login|_next/static|_next/image|favicon.ico).*)'],
};
