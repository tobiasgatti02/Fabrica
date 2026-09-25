import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { studioSessions, studioUsers } from '@/db/schema';
import {
  randomToken,
  SESSION_DURATION_SECONDS,
  sessionCookie,
  sha256,
} from '@/features/auth/core';
import {
  authErrorRedirect,
  clearGoogleOAuthCookie,
  GOOGLE_TOKEN_ENDPOINT,
  GOOGLE_USERINFO_ENDPOINT,
  googleRedirectUri,
  type GoogleProfile,
  readGoogleOAuthState,
} from '@/features/auth/google';

function redirect(location: URL, request: Request, session?: string) {
  const headers = new Headers({
    Location: location.href,
    'Cache-Control': 'no-store',
  });
  headers.append('Set-Cookie', clearGoogleOAuthCookie(request));
  if (session) headers.append('Set-Cookie', session);
  return new Response(null, { status: 302, headers });
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const oauth = readGoogleOAuthState(request);
  const cancelled = requestUrl.searchParams.has('error');
  if (cancelled) {
    return redirect(
      authErrorRedirect(
        request,
        'google_cancelled',
        oauth?.returnTo || '/estudio/panel',
      ),
      request,
    );
  }

  const code = requestUrl.searchParams.get('code');
  const state = requestUrl.searchParams.get('state');
  if (
    !oauth ||
    !code ||
    !state ||
    state !== oauth.state ||
    !env.GOOGLE_CLIENT_ID ||
    !env.GOOGLE_CLIENT_SECRET
  ) {
    return redirect(
      authErrorRedirect(
        request,
        'google_failed',
        oauth?.returnTo || '/estudio/panel',
      ),
      request,
    );
  }

  try {
    const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: googleRedirectUri(request, env.GOOGLE_REDIRECT_URI),
        grant_type: 'authorization_code',
        code_verifier: oauth.verifier,
      }),
    });
    const tokens = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenResponse.ok || !tokens.access_token) throw new Error('token');

    const profileResponse = await fetch(GOOGLE_USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = (await profileResponse.json()) as Partial<GoogleProfile>;
    if (
      !profileResponse.ok ||
      !profile.sub ||
      !profile.email ||
      profile.email_verified !== true
    ) {
      throw new Error('profile');
    }

    const database = getDb(env.DATABASE_URL);
    const normalizedEmail = profile.email.trim().toLowerCase();
    const [bySubject] = await database
      .select({ id: studioUsers.id })
      .from(studioUsers)
      .where(eq(studioUsers.googleSubject, profile.sub))
      .limit(1);
    const [byEmail] = bySubject
      ? []
      : await database
          .select({ id: studioUsers.id })
          .from(studioUsers)
          .where(eq(studioUsers.email, normalizedEmail))
          .limit(1);

    const userId = bySubject?.id || byEmail?.id || crypto.randomUUID();
    if (byEmail && !bySubject) {
      await database
        .update(studioUsers)
        .set({ googleSubject: profile.sub })
        .where(eq(studioUsers.id, byEmail.id));
    } else if (!bySubject) {
      await database.insert(studioUsers).values({
        id: userId,
        email: normalizedEmail,
        name: profile.name?.trim() || normalizedEmail.split('@')[0],
        passwordHash: null,
        googleSubject: profile.sub,
        created: Date.now(),
      });
    }

    const token = randomToken();
    const now = Date.now();
    await database.insert(studioSessions).values({
      id: crypto.randomUUID(),
      user: userId,
      tokenHash: await sha256(token),
      expires: now + SESSION_DURATION_SECONDS * 1000,
      created: now,
    });

    return redirect(
      new URL(oauth.returnTo, request.url),
      request,
      sessionCookie(token, request),
    );
  } catch (error) {
    console.error('Google authentication failed', error);
    return redirect(
      authErrorRedirect(request, 'google_failed', oauth.returnTo),
      request,
    );
  }
}
