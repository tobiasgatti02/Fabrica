import { env } from 'cloudflare:workers';
import { and, eq, gt } from 'drizzle-orm';
import { headers } from 'next/headers';
import { cache } from 'react';
import { getChatGPTUser, type ChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { studioSessions, studioUsers } from '@/db/schema';
import { cookieValue, SESSION_COOKIE, sha256 } from './core';

export type FabricaUser = ChatGPTUser & {
  provider: 'chatgpt' | 'google' | 'fabrica';
  created?: number;
};

async function resolveFabricaUser(
  request?: Request,
): Promise<FabricaUser | null> {
  const requestHeaders = request?.headers || (await headers());
  const chatgpt = await getChatGPTUser(requestHeaders);
  const token = cookieValue(requestHeaders.get('cookie'), SESSION_COOKIE);

  if (token && env.DATABASE_URL) {
    try {
      const database = getDb(env.DATABASE_URL);
      const [user] = await database
        .select({
          id: studioUsers.id,
          email: studioUsers.email,
          name: studioUsers.name,
          googleSubject: studioUsers.googleSubject,
          created: studioUsers.created,
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
          provider: user.googleSubject ? 'google' : 'fabrica',
          created: user.created,
        };
      }
    } catch (error) {
      // A broken or temporarily unavailable local session must not prevent the
      // platform identity from working or turn the sign-in screen into a 500.
      console.error('Local session lookup failed', error);
    }
  }

  return chatgpt ? { ...chatgpt, provider: 'chatgpt' } : null;
}

// The layout and page both need the same identity during one server render.
export const getFabricaUser = cache(resolveFabricaUser);
