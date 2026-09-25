import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { studioProjects } from '@/db/schema';
import { getBillingStatus } from './server';

export async function ownerAccessBlocked(userId: string) {
  const db = getDb(env.DATABASE_URL);
  const [owned] = await db.select({ id: studioProjects.id }).from(studioProjects)
    .where(eq(studioProjects.owner, userId)).limit(1);
  if (!owned) return false;
  const { state } = await getBillingStatus(db, userId);
  return ['pending', 'paused', 'canceled', 'expired'].includes(state);
}
