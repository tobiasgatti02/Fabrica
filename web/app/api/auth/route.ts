import { env } from 'cloudflare:workers';
import { eq, lte } from 'drizzle-orm';
import {
  clearSessionCookie,
  cookieValue,
  hashPassword,
  randomToken,
  SESSION_COOKIE,
  SESSION_DURATION_SECONDS,
  sessionCookie,
  sha256,
  validRequestOrigin,
  validateAuthPayload,
  verifyPassword,
} from '@/features/auth/core';
import { getDb } from '@/db';
import { studioSessions, studioUsers } from '@/db/schema';

const json = (value: unknown, status = 200, cookie?: string) =>
  Response.json(value, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      Vary: 'Cookie',
      ...(cookie ? { 'Set-Cookie': cookie } : {}),
    },
  });

async function sessionRecord(user: string, request: Request) {
  const token = randomToken();
  const now = Date.now();
  return {
    cookie: sessionCookie(token, request),
    values: {
      id: crypto.randomUUID(),
      user,
      tokenHash: await sha256(token),
      expires: now + SESSION_DURATION_SECONDS * 1000,
      created: now,
    },
  };
}

async function logout(request: Request) {
  const clearCookie = clearSessionCookie(request);
  const token = cookieValue(request.headers.get('cookie'), SESSION_COOKIE);

  // Clearing the browser cookie is the critical operation. Database cleanup is
  // best effort so users can always sign out during a database outage.
  if (token && env.DATABASE_URL) {
    try {
      await getDb(env.DATABASE_URL)
        .delete(studioSessions)
        .where(eq(studioSessions.tokenHash, await sha256(token)));
    } catch (error) {
      console.error('Session cleanup failed during logout', error);
    }
  }

  return json({ ok: true }, 200, clearCookie);
}

function isUniqueViolation(error: unknown) {
  const candidate = error as {
    code?: string;
    cause?: { code?: string };
    message?: string;
  };
  return (
    candidate.code === '23505' ||
    candidate.cause?.code === '23505' ||
    candidate.message?.includes('studio_users_email_unique')
  );
}

export async function POST(request: Request) {
  if (!validRequestOrigin(request)) {
    return json({ error: 'Solicitud no válida.' }, 403);
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return json({ error: 'El cuerpo de la solicitud no es JSON válido.' }, 400);
  }

  const parsed = validateAuthPayload(rawBody);
  if (!parsed.ok) return json({ error: parsed.error }, 400);
  if (parsed.value.action === 'logout') return logout(request);

  try {
    const database = getDb(env.DATABASE_URL);
    const { action, email, password, name } = parsed.value;

    if (action === 'register') {
      const [existing] = await database
        .select({ id: studioUsers.id })
        .from(studioUsers)
        .where(eq(studioUsers.email, email))
        .limit(1);
      if (existing) {
        return json(
          { error: 'Ya existe una cuenta con ese email. Iniciá sesión.' },
          409,
        );
      }

      const id = crypto.randomUUID();
      const session = await sessionRecord(id, request);
      try {
        // Neon executes a batch in one transaction: an account can no longer be
        // created without its initial session if the second write fails.
        await database.batch([
          database.insert(studioUsers).values({
            id,
            email,
            name,
            passwordHash: await hashPassword(password),
            created: Date.now(),
          }),
          database.insert(studioSessions).values(session.values),
        ]);
      } catch (error) {
        if (isUniqueViolation(error)) {
          return json(
            { error: 'Ya existe una cuenta con ese email. Iniciá sesión.' },
            409,
          );
        }
        throw error;
      }

      return json({ ok: true, name }, 201, session.cookie);
    }

    const [user] = await database
      .select({
        id: studioUsers.id,
        name: studioUsers.name,
        passwordHash: studioUsers.passwordHash,
      })
      .from(studioUsers)
      .where(eq(studioUsers.email, email))
      .limit(1);
    if (
      !user ||
      !user.passwordHash ||
      !(await verifyPassword(password, user.passwordHash))
    ) {
      return json({ error: 'Email o contraseña incorrectos.' }, 401);
    }

    const session = await sessionRecord(user.id, request);
    await database.insert(studioSessions).values(session.values);
    try {
      await database
        .delete(studioSessions)
        .where(lte(studioSessions.expires, Date.now()));
    } catch (error) {
      // Expired rows are maintenance; they must never invalidate a successful
      // login after the new session has already been persisted.
      console.error('Expired session cleanup failed', error);
    }

    return json({ ok: true, name: user.name }, 200, session.cookie);
  } catch (error) {
    console.error('Auth request failed', error);
    return json(
      {
        error:
          'El servicio de acceso no está disponible en este momento. Intentá nuevamente.',
      },
      503,
    );
  }
}
