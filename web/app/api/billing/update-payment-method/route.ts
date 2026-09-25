import { desc, eq } from 'drizzle-orm';
import { validRequestOrigin } from '@/features/auth/core';
import { billingSubscriptions } from '@/db/schema';
import { getBillingStatus } from '@/features/billing/server';
import { updateSubscription } from '@/features/billing/mercadopago';
import { billingFailure, billingJson, requireBillingOwner } from '@/features/billing/http';

export async function POST(request: Request) {
  try {
    if (!validRequestOrigin(request)) return billingJson({ error: 'Origen de solicitud inválido.' }, 403);
    const { db, user } = await requireBillingOwner(request);
    const body = await request.json() as { cardTokenId?: unknown };
    if (typeof body.cardTokenId !== 'string' || !body.cardTokenId)
      return billingJson({ error: 'Completá el nuevo medio de pago.' }, 400);
    const { account, state } = await getBillingStatus(db, user.userId);
    const [subscription] = await db.select().from(billingSubscriptions)
      .where(eq(billingSubscriptions.account, account.id)).orderBy(desc(billingSubscriptions.created)).limit(1);
    if (!subscription?.externalId || ['canceling', 'canceled'].includes(state) ||
      !['active', 'rejected', 'paused'].includes(subscription.state))
      return billingJson({ error: 'No hay una suscripción para actualizar.' }, 409);
    const provider = await updateSubscription(subscription.externalId,
      { card_token_id: body.cardTokenId, status: 'authorized' },
      `payment-method:${subscription.id}:${crypto.randomUUID()}`);
    if (provider.status !== 'authorized') throw new Error('billing_provider_payment_method_unconfirmed');
    await db.update(billingSubscriptions).set({ providerStatus: 'authorized', updated: Date.now() })
      .where(eq(billingSubscriptions.id, subscription.id));
    return billingJson({ ok: true });
  } catch (error) { return billingFailure(error); }
}
