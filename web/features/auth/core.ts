export const SESSION_COOKIE = 'fabrica_session';
export const SESSION_DURATION_SECONDS = 30 * 24 * 60 * 60;
export const PASSWORD_HASH_ITERATIONS = 100_000;

export type AuthAction = 'login' | 'register' | 'logout';

export type AuthPayload = {
  action: AuthAction;
  email: string;
  password: string;
  name: string;
};

export type AuthValidation =
  | { ok: true; value: AuthPayload }
  | { ok: false; error: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function passwordChecks(password: string) {
  return {
    length: password.length >= 10 && password.length <= 200,
    letters: /[a-z]/.test(password) && /[A-Z]/.test(password),
    number: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
}

export function validateAuthPayload(value: unknown): AuthValidation {
  if (!value || typeof value !== 'object') {
    return { ok: false, error: 'Solicitud no válida.' };
  }

  const input = value as Record<string, unknown>;
  const action = input.action;
  if (action !== 'login' && action !== 'register' && action !== 'logout') {
    return { ok: false, error: 'Acción no válida.' };
  }

  if (action === 'logout') {
    return {
      ok: true,
      value: { action, email: '', password: '', name: '' },
    };
  }

  const email = normalizeEmail(input.email);
  const password = typeof input.password === 'string' ? input.password : '';
  const name = typeof input.name === 'string' ? input.name.trim() : '';

  if (
    !email ||
    email.length > 254 ||
    !EMAIL_PATTERN.test(email) ||
    password.length < 10 ||
    password.length > 200
  ) {
    return {
      ok: false,
      error:
        'Revisá el email y usá una contraseña de entre 10 y 200 caracteres.',
    };
  }

  if (action === 'register') {
    if (name.length < 2 || name.length > 100) {
      return { ok: false, error: 'Ingresá un nombre de 2 a 100 caracteres.' };
    }
    const checks = passwordChecks(password);
    if (
      !checks.length ||
      [checks.letters, checks.number, checks.symbol].filter(Boolean).length < 2
    ) {
      return {
        ok: false,
        error: 'Combiná mayúsculas y minúsculas con un número o un símbolo.',
      };
    }
  }

  return { ok: true, value: { action, email, password, name } };
}

export function cookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return '';
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    return part.slice(separator + 1).trim();
  }
  return '';
}

export function sessionCookie(token: string, request: Request) {
  return serializeSessionCookie(token, request, SESSION_DURATION_SECONDS);
}

export function clearSessionCookie(request: Request) {
  return serializeSessionCookie('', request, 0);
}

function serializeSessionCookie(
  token: string,
  request: Request,
  maxAge: number,
) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  const expires =
    maxAge === 0
      ? '; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
      : `; Expires=${new Date(Date.now() + maxAge * 1000).toUTCString()}`;
  return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${expires}${secure}; Priority=High`;
}

export function validRequestOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function sha256(value: string) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return toBase64Url(new Uint8Array(bytes));
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await derivePassword(
    password,
    salt,
    PASSWORD_HASH_ITERATIONS,
  );
  return `pbkdf2_sha256$${PASSWORD_HASH_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(derived)}`;
}

export async function verifyPassword(password: string, encoded: string) {
  try {
    const parts = encoded.split('$');
    if (parts.length !== 4) return false;
    const [algorithm, rounds, saltValue, expectedValue] = parts;
    const iterations = Number(rounds);
    if (
      algorithm !== 'pbkdf2_sha256' ||
      !Number.isSafeInteger(iterations) ||
      iterations < 100_000 ||
      iterations > 1_000_000 ||
      !saltValue ||
      !expectedValue
    ) {
      return false;
    }

    const actual = await derivePassword(
      password,
      fromBase64Url(saltValue),
      iterations,
    );
    const expected = fromBase64Url(expectedValue);
    return constantTimeEqual(actual, expected);
  } catch {
    return false;
  }
}

async function derivePassword(
  password: string,
  salt: Uint8Array,
  iterations: number,
) {
  const stableSalt = new Uint8Array(salt);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: stableSalt, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

function constantTimeEqual(actual: Uint8Array, expected: Uint8Array) {
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index++) {
    difference |= actual[index] ^ expected[index];
  }
  return difference === 0;
}

export function randomToken(bytes = 32) {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return toBase64Url(value);
}

export function toBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function fromBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error('Invalid base64url value.');
  }
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(
    `${value.replace(/-/g, '+').replace(/_/g, '/')}${padding}`,
  );
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
