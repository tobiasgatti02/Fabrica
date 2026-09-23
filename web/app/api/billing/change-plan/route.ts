import { and, desc, eq } from 'drizzle-orm';
import { billingAccounts, billingChanges, billingPriceVersions, billingSubscriptions } from '@/db/schema';
import { getBillingStatus } from '@/features/billing/server';
import { updateSubscription } from '@/features/billing/mercadopago';
import { billingFailure, billingJson, requireBillingOwner } from '@/features/billing/http';

export async function POST(request: Request) {
  try {
    const { db, user } = await requireBillingOwner(request);
    const body = await request.json() as { plan?: unknown };
    if (typeof body.plan !== 'string' || body.plan === 'prueba') return billingJson({ error: 'Elegí un plan válido.' }, 400);
    const status = await getBillingStatus(db, user.userId);
    const [price] = await db.select().from(billingPriceVersions).where(and(eq(billingPriceVersions.plan, body.plan), eq(billingPriceVersions.active, 1))).limit(1);
    const [subscription] = await db.select().from(billingSubscriptions).where(eq(billingSubscriptions.account, status.account.id)).orderBy(desc(billingSubscriptions.created)).limit(1);
    if (!price || !subscription?.externalId) return billingJson({ error: 'No hay una suscripción activa para cambiar.' }, 409);
    await updateSubscription(subscription.externalId, { auto_recurring: { transaction_amount: price.amountCents / 100, currency_id: price.currency } }, `change:${subscription.id}:${price.id}`);
    const now = Date.now();
    await db.update(billingSubscriptions).set({ priceVersion: price.id, amountCents: price.amountCents, currency: price.currency, updated: now }).where(eq(billingSubscriptions.id, subscription.id));
    await db.update(billingAccounts).set({ plan: price.plan, priceVersion: price.id, updated: now }).where(eq(billingAccounts.id, status.account.id));
    await db.insert(billingChanges).values({ id: crypto.randomUUID(), account: status.account.id, subscription: subscription.id, action: 'change_plan', fromPlan: status.account.plan, toPlan: price.plan, created: now });
    return billingJson({ ok: true, plan: price.plan });
  } catch (error) { return billingFailure(error); }
}