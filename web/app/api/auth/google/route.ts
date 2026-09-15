import { env } from 'cloudflare:workers';
import {
  authErrorRedirect,
  createGoogleOAuthState,
  GOOGLE_AUTHORIZATION_ENDPOINT,
  googleOAuthCookie,
  googleRedirectUri,
  safeReturnTo,
} from '@/features/auth/google';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const returnTo = safeReturnTo(requestUrl.searchParams.get('return_to'));
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return Response.redirect(
      authErrorRedirect(request, 'google_unavailable', returnTo),
      302,
    );
  }

  const oauth = await createGoogleOAuthState(returnTo);
  const authorizationUrl = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
  authorizationUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  authorizationUrl.searchParams.set(
    'redirect_uri',
    googleRedirectUri(request, env.GOOGLE_REDIRECT_URI),
  );
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('scope', 'openid email profile');
  authorizationUrl.searchParams.set('state', oauth.value.state);
  authorizationUrl.searchParams.set('code_challenge', oauth.challenge);
  authorizationUrl.searchParams.set('code_challenge_method', 'S256');
  authorizationUrl.searchParams.set('prompt', 'select_account');

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizationUrl.href,
      'Set-Cookie': googleOAuthCookie(oauth.value, request),
      'Cache-Control': 'no-store',
    },
  });
}
