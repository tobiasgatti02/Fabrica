import { clearSessionCookie, hasSession, makeSession, sessionCookie, validPassword } from './auth';
import { getDashboard } from './data';
import { page } from './page';
import { getProductAnalytics } from './posthog';

const baseHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...baseHeaders, ...extra, 'Content-Type': 'application/json; charset=utf-8' } });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.hostname !== 'admin.f4brica.app' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') return new Response('Not found', { status: 404 });
    if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD_HASH || !env.ADMIN_PASSWORD_SALT || !env.ADMIN_SESSION_SECRET || !env.DATABASE_URL) {
      console.error('Admin environment incomplete');
      return json({ error: 'Service unavailable' }, 503);
    }
    if (request.method === 'POST') {
      if (request.headers.get('origin') !== url.origin) return json({ error: 'Invalid origin' }, 403);
      if (url.pathname === '/api/login') {
        if (Number(request.headers.get('content-length') || 0) > 4096) return json({ error: 'Invalid request' }, 413);
        let input: { username?: string; password?: string };
        try { input = await request.json(); } catch { return json({ error: 'Invalid request' }, 400); }
        const username = typeof input.username === 'string' ? input.username : '';
        const password = typeof input.password === 'string' ? input.password : '';
        if (password.length > 200 || username.length > 200) return json({ error: 'Invalid request' }, 400);
        const correctPassword = await validPassword(password, env.ADMIN_PASSWORD_SALT, env.ADMIN_PASSWORD_HASH);
        if (username !== env.ADMIN_USERNAME || !correctPassword) return json({ error: 'Invalid credentials' }, 401);
        return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(await makeSession(env.ADMIN_SESSION_SECRET)) });
      }
      if (url.pathname === '/api/logout') return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie });
      return json({ error: 'Not found' }, 404);
    }
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
    if (url.pathname === '/') return new Response(page, { headers: { ...baseHeaders, 'Content-Type': 'text/html; charset=utf-8' } });
    if (!await hasSession(request, env.ADMIN_SESSION_SECRET)) return json({ error: 'Unauthorized' }, 401);
    if (url.pathname === '/api/dashboard') {
      try {
        const [dashboard, product] = await Promise.all([getDashboard(env.DATABASE_URL), getProductAnalytics(env.POSTHOG_PERSONAL_API_KEY)]);
        return json({ ...dashboard, product });
      } catch (error) {
        console.error('Admin dashboard query failed', error);
        return json({ error: 'Data unavailable' }, 503);
      }
    }
    return json({ error: 'Not found' }, 404);
  },
} satisfies ExportedHandler<Env>;
