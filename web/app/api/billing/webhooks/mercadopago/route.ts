import { eq } from 'drizzle-orm';
import { billingAccounts, billingCharges, billingSubscriptions, billingWebhookEvents } from '@/db/schema';
import { getAuthorizedPayment, getSubscription, MercadoPagoRequestError, verifyWebhook } from '@/features/billing/mercadopago';
import { billingDb } from '@/features/billing/http';

type Notification = { type?: string; action?: string; data?: { id?: string | number } };

function dateValue(value: unknown) {
  if (typeof value !== 'string') return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null) as Notification | null;
  const url = new URL(request.url);
  const queryId = url.searchParams.get('data.id');
  const bodyId = payload?.data?.id != null ? String(payload.data.id) : null;
  if (queryId && bodyId && queryId !== bodyId)
    return Response.json({ error: 'invalid_notification' }, { status: 400 });
  const resourceId = queryId || bodyId;
  if (!resourceId || !(await verifyWebhook(request, resourceId)))
    return Response.json({ error: 'invalid_signature' }, { status: 401 });

  const topic = url.searchParams.get('type') || url.searchParams.get('topic') || payload?.type || 'unknown';
  if (topic !== 'subscription_preapproval' && topic !== 'subscription_authorized_payment')
    return Response.json({ ok: true });

  const externalKey = `${topic}:${resourceId}:${request.headers.get('x-request-id')}`;
  try {
    const db = billingDb();
    const [seen] = await db.select().from(billingWebhookEvents)
      .where(eq(billingWebhookEvents.externalKey, externalKey)).limit(1);
    if (seen?.processedAt) return Response.json({ ok: true });
    if (!seen) await db.insert(billingWebhookEvents).values({
      id: crypto.randomUUID(), externalKey, topic, resourceId,
      payload: JSON.stringify(payload), receivedAt: Date.now(),
    }).onConflictDoNothing();

    const payment = topic === 'subscription_authorized_payment'
      ? await getAuthorizedPayment(resourceId) : null;
    const externalSubscriptionId = payment ? String(payment.preapproval_id || '') : resourceId;
    const [subscription] = await db.select().from(billingSubscriptions)
      .where(eq(billingSubscriptions.externalId, externalSubscriptionId)).limit(1);
    if (!subscription) {
      // The provider may notify us before subscribe has committed the local row.
      // A real resource must be retried; the dashboard's fictitious ID returns 404.
      await getSubscription(externalSubscriptionId);
      return Response.json({ error: 'subscription_not_ready' }, { status: 503 });
    }
    const provider = await getSubscription(externalSubscriptionId);
    const providerStatus = String(provider.status || 'pending');
    const paymentStatus = payment ? String(payment.status || 'pending') : null;
    const now = Date.now();
    const paidThrough = dateValue(provider.next_payment_date);
    const [account] = await db.select().from(billingAccounts)
      .where(eq(billingAccounts.id, subscription.account)).limit(1);
    if (!account) throw new Error('billing_account_unavailable');

    let state = account.state;
    let graceEnds = account.graceEnds;
    let nextPaidThrough = account.paidThrough;
    if (paymentStatus === 'approved') {
      nextPaidThrough = Math.max(account.paidThrough || 0, paidThrough || 0) || null;
      state = nextPaidThrough && nextPaidThrough > now ? 'active' : 'pending';
      if (state === 'active') graceEnds = null;
    } else if (paymentStatus === 'rejected') {
      if (!account.paidThrough || account.paidThrough <= now) {
        state = 'grace_period';
        graceEnds = now + 5 * 86_400_000;
      }
    } else if (providerStatus === 'cancelled' || providerStatus === 'canceled') {
      state = account.paidThrough && account.paidThrough > now ? 'canceling' : 'canceled';
    } else if (providerStatus === 'paused') {
      state = 'paused';
    }

    await db.update(billingSubscriptions).set({
      providerStatus, state, nextChargeAt: paidThrough, currentPeriodEnd: nextPaidThrough,
      updated: now,
    }).where(eq(billingSubscriptions.id, subscription.id));
    await db.update(billingAccounts).set({
      state, graceEnds, paidThrough: nextPaidThrough, updated: now,
    }).where(eq(billingAccounts.id, subscription.account));
    if (payment) await db.insert(billingCharges).values({
      id: crypto.randomUUID(), subscription: subscription.id,
      externalId: String(payment.id || resourceId), providerStatus: paymentStatus || 'pending',
      amountCents: Math.round(Number(payment.transaction_amount || 0) * 100),
      currency: String(payment.currency_id || subscription.currency),
      occurredAt: dateValue(payment.date_created) || now, created: now,
    }).onConflictDoUpdate({ target: billingCharges.externalId, set: { providerStatus: paymentStatus || 'pending' } });
    await db.update(billingWebhookEvents).set({ processedAt: now, outcome: 'processed' })
      .where(eq(billingWebhookEvents.externalKey, externalKey));
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof MercadoPagoRequestError && error.status === 404) {
      // Dashboard tests use a synthetic resource ID. It has no provider record to reconcile.
      const db = billingDb();
      await db.update(billingWebhookEvents).set({ processedAt: Date.now(), outcome: 'provider_resource_not_found' })
        .where(eq(billingWebhookEvents.externalKey, externalKey)).catch(() => {});
      return Response.json({ ok: true });
    }
    console.error('Mercado Pago webhook processing failed', error instanceof Error ? error.message : 'unknown');
    return Response.json({ error: 'retry' }, { status: 503 });
  }
}
