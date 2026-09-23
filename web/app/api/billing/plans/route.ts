import { asc, eq } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { billingPriceVersions } from '@/db/schema';
import { billingFailure, billingJson, requireBillingOwner } from '@/features/billing/http';

export async function GET(request: Request) {
  try {
    const { db } = await requireBillingOwner(request);
    const versions = await db.select().from(billingPriceVersions)
      .where(eq(billingPriceVersions.active, 1)).orderBy(asc(billingPriceVersions.amountCents));
    return billingJson({ publicKey: env.MERCADOPAGO_PUBLIC_KEY || null,
      testMode: env.MERCADOPAGO_TEST_MODE === 'true',
      plans: versions.map((plan) => ({
      id: plan.id, key: plan.plan, version: plan.version, currency: plan.currency,
      amountCents: plan.amountCents,
      rights: { projects: plan.projectLimit, storageBytes: plan.storageLimitBytes,
        professionals: plan.professionalLimit, clients: plan.clientLimit,
        teamPermissions: Boolean(plan.teamPermissions), advancedAdmin: Boolean(plan.advancedAdmin),
        prioritySupport: Boolean(plan.prioritySupport) },
    })) });
  } catch (error) { return billingFailure(error); }
}
