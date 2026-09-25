import { cookieValue, fromBase64Url, randomToken, toBase64Url } from './core';

export const GOOGLE_OAUTH_COOKIE = 'fabrica_google_oauth';
export const GOOGLE_AUTHORIZATION_ENDPOINT =
  'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
export const GOOGLE_USERINFO_ENDPOINT =
  'https://openidconnect.googleapis.com/v1/userinfo';

export type GoogleOAuthState = {
  state: string;
  verifier: string;
  returnTo: string;
};

export type GoogleProfile = {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
};

export function safeReturnTo(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/estudio/panel';
  }
  try {
    const parsed = new URL(value, 'https://app.local');
    return parsed.origin === 'https://app.local'
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : '/estudio/panel';
  } catch {
    return '/estudio/panel';
  }
}

export function googleRedirectUri(request: Request, configured?: string) {
  return configured || new URL('/api/auth/google/callback', request.url).href;
}

export async function createGoogleOAuthState(returnTo: string) {
  const state = randomToken();
  const verifier = randomToken(48);
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier),
  );
  return {
    value: { state, verifier, returnTo },
    challenge: toBase64Url(new Uint8Array(digest)),
  };
}

export function googleOAuthCookie(value: GoogleOAuthState, request: Request) {
  const encoded = toBase64Url(new TextEncoder().encode(JSON.stringify(value)));
  return `${GOOGLE_OAUTH_COOKIE}=${encoded}; HttpOnly; SameSite=Lax; Path=/api/auth/google; Max-Age=600${secureCookie(request)}`;
}

export function clearGoogleOAuthCookie(request: Request) {
  return `${GOOGLE_OAUTH_COOKIE}=; HttpOnly; SameSite=Lax; Path=/api/auth/google; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secureCookie(request)}`;
}

export function readGoogleOAuthState(
  request: Request,
): GoogleOAuthState | null {
  const encoded = cookieValue(
    request.headers.get('cookie'),
    GOOGLE_OAUTH_COOKIE,
  );
  if (!encoded) return null;
  try {
    const parsed = JSON.parse(
      new TextDecoder().decode(fromBase64Url(encoded)),
    ) as Partial<GoogleOAuthState>;
    if (
      typeof parsed.state !== 'string' ||
      typeof parsed.verifier !== 'string' ||
      typeof parsed.returnTo !== 'string'
    ) {
      return null;
    }
    return {
      state: parsed.state,
      verifier: parsed.verifier,
      returnTo: safeReturnTo(parsed.returnTo),
    };
  } catch {
    return null;
  }
}

export function authErrorRedirect(
  request: Request,
  error: 'google_unavailable' | 'google_cancelled' | 'google_failed',
  returnTo = '/estudio/panel',
) {
  const target = new URL(safeReturnTo(returnTo), request.url);
  target.searchParams.set('auth_error', error);
  return target;
}

function secureCookie(request: Request) {
  return new URL(request.url).protocol === 'https:' ? '; Secure' : '';
}
