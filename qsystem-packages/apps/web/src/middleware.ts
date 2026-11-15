import { NextResponse, type NextRequest } from 'next/server';

/** Routes that need a session; anything else (assets, /login) is untouched. */
const PROTECTED = ['/', '/tasks', '/projects', '/org', '/notifications', '/files', '/account', '/crm', '/social'];

const JWT_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const OPAQUE_TOKEN_RE = /^[A-Za-z0-9_-]{24,512}$/;

function isDemoEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
}

function isValidRefreshToken(token: string | undefined): boolean {
  if (!token) return false;
  if (token === 'dev-session') return isDemoEnabled();
  if (token.length >= 24 && JWT_RE.test(token)) return true;
  return OPAQUE_TOKEN_RE.test(token);
}

function redirectToLogin(request: NextRequest, clearInvalidCookie: boolean): NextResponse {
  const { pathname, search } = request.nextUrl;
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  const res = NextResponse.redirect(url);
  if (clearInvalidCookie) {
    res.cookies.delete('refresh_token');
  }
  return res;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsAuth = PROTECTED.some((p) => (p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(`${p}/`)));
  if (!needsAuth) return NextResponse.next();

  const loggedOut = request.cookies.get('qsystem_logged_out')?.value === '1';
  if (loggedOut) {
    return redirectToLogin(request, request.cookies.has('refresh_token'));
  }

  const rawToken = request.cookies.get('refresh_token')?.value;
  if (rawToken !== undefined) {
    return isValidRefreshToken(rawToken)
      ? NextResponse.next()
      : redirectToLogin(request, true);
  }

  // In local development / demo, issue a dev session cookie unless `?auth=required` is requested.
  if (isDemoEnabled() && request.nextUrl.searchParams.get('auth') !== 'required') {
    const response = NextResponse.next();
    response.cookies.set('refresh_token', 'dev-session', { path: '/', sameSite: 'lax' });
    return response;
  }

  return redirectToLogin(request, false);
}

export const config = {
  matcher: ['/((?!login|_next/static|_next/image|favicon.ico).*)'],
};
