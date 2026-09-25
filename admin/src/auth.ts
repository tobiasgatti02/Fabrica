const encoder = new TextEncoder();
const COOKIE = 'fabrica_admin';

function b64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function unb64(value: string): Uint8Array {
  const raw = atob(value.replaceAll('-', '+').replaceAll('_', '/'));
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function validPassword(input: string, salt: string, expected: string): Promise<boolean> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(input), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100_000, hash: 'SHA-256' }, key, 256);
  const actual = new Uint8Array(bits);
  const target = unb64(expected);
  if (actual.length !== target.length) return false;
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual[i] ^ target[i];
  return difference === 0;
}

export async function makeSession(secret: string): Promise<string> {
  const payload = b64(encoder.encode(JSON.stringify({ exp: Date.now() + 12 * 60 * 60 * 1000 })));
  const signature = b64(new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(payload))));
  return `${payload}.${signature}`;
}

export async function hasSession(request: Request, secret: string): Promise<boolean> {
  const token = request.headers.get('cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!token) return false;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra || payload.length > 300) return false;
  try {
    const valid = await crypto.subtle.verify('HMAC', await hmacKey(secret), unb64(signature).buffer as ArrayBuffer, encoder.encode(payload));
    if (!valid) return false;
    const data = JSON.parse(new TextDecoder().decode(unb64(payload))) as { exp?: number };
    return typeof data.exp === 'number' && data.exp > Date.now();
  } catch { return false; }
}

export const sessionCookie = (token: string) => `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200`;
export const clearSessionCookie = `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
