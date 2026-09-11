import { env } from 'cloudflare:workers';
import { eq, lte } from 'drizzle-orm';
import {
  clearSessionCookie,
  fromBase64Url,
  randomToken,
  sessionCookie,
  sha256,
  toBase64Url,
} from '@/app/fabrica-auth';
import { getDb } from '@/db';
import { studioSessions, studioUsers } from '@/db/schema';

const ITERATIONS = 210_000;
const json = (value: unknown, status = 200, cookie?: string) =>
  Response.json(value, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...(cookie ? { 'Set-Cookie': cookie } : {}),
    },
  });

function validOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

async function passwordHash(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    key,
    256,
  );
  return `pbkdf2_sha256$${ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(new Uint8Array(bits))}`;
}

async function verifyPassword(password: string, encoded: string) {
  const [algorithm, rounds, saltValue, expectedValue] = encoded.split('$');
  const iterations = Number(rounds);
  if (
    algorithm !== 'pbkdf2_sha256' ||
    !Number.isSafeInteger(iterations) ||
    iterations < 100_000 ||
    !saltValue ||
    !expectedValue
  ) {
    return false;
  }
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt: fromBase64Url(saltValue),
        iterations,
      },
      key,
      256,
    ),
  );
  const expected = fromBase64Url(expectedValue);
  if (bits.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < bits.length; index++) {
    difference |= bits[index] ^ expected[index];
  }
  return difference === 0;
}

async function createSession(user: string, request: Request) {
  const token = randomToken();
  const database = getDb(env.DATABASE_URL);
  await database.insert(studioSessions).values({
    id: crypto.randomUUID(),
    user,
    tokenHash: await sha256(token),
    expires: Date.now() + 30 * 86400_000,
    created: Date.now(),
  });
  return sessionCookie(token, request);
}

export async function POST(request: Request) {
  if (!validOrigin(request)) {
    return json({ error: 'Solicitud no válida.' }, 403);
  }
  try {
    const database = getDb(env.DATABASE_URL);
    const body = (await request.json()) as {
      action?: string;
      email?: string;
      password?: string;
      name?: string;
    };
    if (body.action === 'logout') {
      const token = request.headers
        .get('cookie')
        ?.match(/(?:^|;\s*)fabrica_session=([^;]+)/)?.[1];
      if (token) {
        await database
          .delete(studioSessions)
          .where(eq(studioSessions.tokenHash, await sha256(token)));
      }
      return json({ ok: true }, 200, clearSessionCookie(request));
    }

    const email = body.email?.trim().toLowerCase() || '';
    const password = body.password || '';
    if (
      !/^\S+@\S+\.\S+$/.test(email) ||
      password.length < 10 ||
      password.length > 200
    ) {
      return json(
        {
          error:
            'Revisá el email y usá una contraseña de al menos 10 caracteres.',
        },
        400,
      );
    }

    if (body.action === 'register') {
      const name = body.name?.trim() || '';
      if (name.length < 2 || name.length > 100) {
        return json({ error: 'Ingresá tu nombre.' }, 400);
      }
      const passwordSignals = [
        /[a-z]/.test(password) && /[A-Z]/.test(password),
        /\d/.test(password),
        /[^A-Za-z0-9]/.test(password),
      ].filter(Boolean).length;
      if (passwordSignals < 1) {
        return json(
          {
            error:
              'Sumá una mayúscula, un número o un símbolo a tu contraseña.',
          },
          400,
        );
      }
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
      await database.insert(studioUsers).values({
        id,
        email,
        name,
        passwordHash: await passwordHash(password),
        created: Date.now(),
      });
      return json({ ok: true, name }, 201, await createSession(id, request));
    }

    if (body.action === 'login') {
      const [user] = await database
        .select({
          id: studioUsers.id,
          name: studioUsers.name,
          passwordHash: studioUsers.passwordHash,
        })
        .from(studioUsers)
        .where(eq(studioUsers.email, email))
        .limit(1);
      if (!user || !(await verifyPassword(password, user.passwordHash))) {
        return json({ error: 'Email o contraseña incorrectos.' }, 401);
      }
      await database
        .delete(studioSessions)
        .where(lte(studioSessions.expires, Date.now()));
      return json(
        { ok: true, name: user.name },
        200,
        await createSession(user.id, request),
      );
    }

    return json({ error: 'Acción no válida.' }, 400);
  } catch (error) {
    console.error('Auth request failed', error);
    return json(
      { error: 'No pudimos completar el acceso. Intentá nuevamente.' },
      503,
    );
  }
}
