import { env } from 'cloudflare:workers';
import { asc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { billingPriceVersions } from '@/db/schema';

export async function GET() {
  try {
    const plans = await getDb(env.DATABASE_URL).select().from(billingPriceVersions)
      .where(eq(billingPriceVersions.active, 1)).orderBy(asc(billingPriceVersions.amountCents));
    return Response.json({ plans: plans.map((plan) => ({
      key: plan.plan, amountCents: plan.amountCents, currency: plan.currency,
      rights: { projects: plan.projectLimit, storageBytes: plan.storageLimitBytes,
        professionals: plan.professionalLimit, clients: plan.clientLimit,
        teamPermissions: Boolean(plan.teamPermissions), advancedAdmin: Boolean(plan.advancedAdmin),
        prioritySupport: Boolean(plan.prioritySupport) },
    })) }, { headers: { 'Cache-Control': 'public, max-age=60' } });
  } catch {
    return Response.json({ error: 'No se pudieron cargar los planes.' }, { status: 503 });
  }
}
