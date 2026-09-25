import { NextResponse, type NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const url = request.nextUrl;
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol === 'http:' && !local) {
    const secure = url.clone();
    secure.protocol = 'https:';
    return NextResponse.redirect(secure, 308);
  }
  const response = NextResponse.next();
  if (url.protocol === 'https:') {
    response.headers.set('Strict-Transport-Security', 'max-age=2592000');
    response.headers.set('Content-Security-Policy', "upgrade-insecure-requests; frame-ancestors 'self'");
  }
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  return response;
}

export const config = { matcher: '/:path*' };
