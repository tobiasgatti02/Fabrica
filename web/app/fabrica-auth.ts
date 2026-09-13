import { env } from 'cloudflare:workers';
import { and, eq, gt } from 'drizzle-orm';
import { headers } from 'next/headers';
import { getChatGPTUser, type ChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { studioSessions, studioUsers } from '@/db/schema';

const SESSION_COOKIE = 'fabrica_session';

export type FabricaUser = ChatGPTUser & { provider: 'chatgpt' | 'fabrica' };

type FabricaAuthOptions = {
  allowChatGPT?: boolean;
};

function cookieValue(cookie: string | null, name: string) {
  return (
    cookie
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.slice(name.length + 1) || ''
  );
}

export async function sha256(value: string) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return toBase64Url(new Uint8Array(bytes));
}

export async function getFabricaUser(
  request?: Request,
  { allowChatGPT = true }: FabricaAuthOptions = {},
): Promise<FabricaUser | null> {
  const requestHeaders = request?.headers || (await headers());
  const token = cookieValue(requestHeaders.get('cookie'), SESSION_COOKIE);
  if (token && env.DATABASE_URL) {
    const database = getDb(env.DATABASE_URL);
    const [user] = await database
      .select({
        id: studioUsers.id,
        email: studioUsers.email,
        name: studioUsers.name,
      })
      .from(studioSessions)
      .innerJoin(studioUsers, eq(studioUsers.id, studioSessions.user))
      .where(
        and(
          eq(studioSessions.tokenHash, await sha256(token)),
          gt(studioSessions.expires, Date.now()),
        ),
      )
      .limit(1);
    if (user) {
      return {
        userId: `fabrica:${user.id}`,
        displayName: user.name,
        email: user.email,
        fullName: user.name,
        provider: 'fabrica',
      };
    }
  }

  if (allowChatGPT) {
    const chatgpt = await getChatGPTUser(requestHeaders);
    if (chatgpt) return { ...chatgpt, provider: 'chatgpt' };
  }

  return null;
}

export function sessionCookie(token: string, request: Request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${secure}`;
}

export function clearSessionCookie(request: Request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
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
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
