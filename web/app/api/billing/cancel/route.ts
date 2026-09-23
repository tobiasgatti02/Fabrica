import { desc, eq } from 'drizzle-orm';
import { billingAccounts, billingChanges, billingSubscriptions } from '@/db/schema';
import { getBillingStatus } from '@/features/billing/server';
import { updateSubscription } from '@/features/billing/mercadopago';
import { billingFailure, billingJson, requireBillingOwner } from '@/features/billing/http';

export async function POST(request: Request) {
  try {
    const { db, user } = await requireBillingOwner(request);
    const { account } = await getBillingStatus(db, user.userId);
    const [subscription] = await db.select().from(billingSubscriptions)
      .where(eq(billingSubscriptions.account, account.id)).orderBy(desc(billingSubscriptions.created)).limit(1);
    if (!subscription?.externalId) return billingJson({ error: 'No hay una suscripción activa.' }, 409);
    await updateSubscription(subscription.externalId, { status: 'canceled' }, `cancel:${subscription.id}:${Date.now()}`);
    const now = Date.now();
    await db.update(billingAccounts).set({ state: account.paidThrough && account.paidThrough > now ? 'canceling' : 'canceled', cancelAt: account.paidThrough || now, updated: now }).where(eq(billingAccounts.id, account.id));
    await db.insert(billingChanges).values({ id: crypto.randomUUID(), account: account.id, subscription: subscription.id, action: 'cancel', fromState: account.state, toState: 'canceling', reason: 'user_request', created: now });
    return billingJson({ ok: true, cancelAt: account.paidThrough || now });
  } catch (error) { return billingFailure(error); }
}