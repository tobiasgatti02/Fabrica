import { desc, eq } from 'drizzle-orm';
import { validRequestOrigin } from '@/features/auth/core';
import { billingAccounts, billingChanges, billingSubscriptions } from '@/db/schema';
import { getBillingStatus } from '@/features/billing/server';
import { updateSubscription } from '@/features/billing/mercadopago';
import { billingFailure, billingJson, requireBillingOwner } from '@/features/billing/http';

export async function POST(request: Request) {
  try {
    if (!validRequestOrigin(request)) return billingJson({ error: 'Origen de solicitud inválido.' }, 403);
    const { db, user } = await requireBillingOwner(request);
    const { account, state } = await getBillingStatus(db, user.userId);
    const [subscription] = await db.select().from(billingSubscriptions)
      .where(eq(billingSubscriptions.account, account.id)).orderBy(desc(billingSubscriptions.created)).limit(1);
    if (!subscription?.externalId || ['canceling', 'canceled'].includes(state) ||
      !['active', 'rejected', 'paused'].includes(subscription.state))
      return billingJson({ error: 'No hay una suscripción activa.' }, 409);
    await updateSubscription(subscription.externalId, { status: 'canceled' }, `cancel:${subscription.id}:${Date.now()}`);
    const now = Date.now();
    const nextState = account.paidThrough && account.paidThrough > now ? 'canceling' : account.trialEnds > now ? 'trialing' : 'canceled';
    await db.update(billingAccounts).set({ state: nextState, cancelAt: account.paidThrough || now,
      ...(nextState === 'trialing' ? { plan: 'prueba', priceVersion: null } : {}), updated: now }).where(eq(billingAccounts.id, account.id));
    await db.update(billingSubscriptions).set({ state: 'canceled', providerStatus: 'canceled', updated: now })
      .where(eq(billingSubscriptions.id, subscription.id));
    await db.insert(billingChanges).values({ id: crypto.randomUUID(), account: account.id, subscription: subscription.id, action: 'cancel', fromState: account.state, toState: nextState, reason: 'user_request', created: now });
    return billingJson({ ok: true, cancelAt: account.paidThrough || now });
  } catch (error) { return billingFailure(error); }
}
