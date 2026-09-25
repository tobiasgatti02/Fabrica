import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { billingAccounts, billingCharges, billingPriceVersions, billingSubscriptions, billingWebhookEvents } from '@/db/schema';
import { getAuthorizedPayment, getSubscription, MercadoPagoRequestError, verifyWebhook } from '@/features/billing/mercadopago';
import { billingDb } from '@/features/billing/http';

type Notification = { type?: string; action?: string; data?: { id?: string | number } };

function dateValue(value: unknown) {
  if (typeof value !== 'string') return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function resourceValue(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
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

  const topic = payload?.type || url.searchParams.get('type') || url.searchParams.get('topic') || 'unknown';
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
    const externalSubscriptionId = payment ? resourceValue(payment.preapproval_id) : resourceId;
    if (!externalSubscriptionId) throw new Error('billing_provider_invalid_subscription_id');
    const [subscription] = await db.select().from(billingSubscriptions)
      .where(eq(billingSubscriptions.externalId, externalSubscriptionId)).limit(1);
    if (!subscription) {
      // The provider may notify us before subscribe has committed the local row.
      // A real resource must be retried; the dashboard's fictitious ID returns 404.
      const provider = await getSubscription(externalSubscriptionId);
      if (provider.status === 'canceled' || provider.status === 'cancelled') {
        await db.update(billingWebhookEvents).set({ processedAt: Date.now(), outcome: 'subscription_canceled_or_deleted' })
          .where(eq(billingWebhookEvents.externalKey, externalKey));
        return Response.json({ ok: true });
      }
      return Response.json({ error: 'subscription_not_ready' }, { status: 503 });
    }
    const provider = await getSubscription(externalSubscriptionId);
    const providerStatus = resourceValue(provider.status) || 'pending';
    const paymentStatus = payment
      ? resourceValue((payment.payment as Record<string, unknown> | undefined)?.status) || 'pending'
      : null;
    const now = Date.now();
    const paidThrough = dateValue(provider.next_payment_date);
    const [account] = await db.select().from(billingAccounts)
      .where(eq(billingAccounts.id, subscription.account)).limit(1);
    if (!account) throw new Error('billing_account_unavailable');

    let state = account.state;
    let subscriptionState = subscription.state;
    let graceEnds = account.graceEnds;
    let nextPaidThrough = account.paidThrough;
    if (paymentStatus === 'approved')
      nextPaidThrough = Math.max(account.paidThrough || 0, paidThrough || 0) || null;
    if (providerStatus === 'cancelled' || providerStatus === 'canceled') {
      state = nextPaidThrough && nextPaidThrough > now ? 'canceling' : account.trialEnds > now ? 'trialing' : 'expired';
      subscriptionState = 'canceled';
    } else if (providerStatus === 'paused') {
      state = nextPaidThrough && nextPaidThrough > now ? 'paused' : account.trialEnds > now ? 'trialing' : 'expired';
      subscriptionState = 'paused';
    } else if (paymentStatus === 'approved') {
      state = nextPaidThrough && nextPaidThrough > now ? 'active' : 'pending';
      subscriptionState = state;
      if (state === 'active') graceEnds = null;
    } else if (paymentStatus === 'rejected' && (!account.paidThrough || account.paidThrough <= now)) {
      state = account.trialEnds > now ? 'trialing' : 'expired';
      subscriptionState = 'rejected';
    }

    await db.update(billingSubscriptions).set({
      providerStatus, state: subscriptionState, nextChargeAt: paidThrough, currentPeriodEnd: nextPaidThrough,
      updated: now,
    }).where(eq(billingSubscriptions.id, subscription.id));
    const [price] = state === 'active'
      ? await db.select().from(billingPriceVersions).where(eq(billingPriceVersions.id, subscription.priceVersion)).limit(1)
      : [];
    await db.update(billingAccounts).set({
      state, graceEnds, paidThrough: nextPaidThrough, updated: now,
      ...(price ? { plan: price.plan, priceVersion: price.id } : {}),
    }).where(eq(billingAccounts.id, subscription.account));
    if (payment) await db.insert(billingCharges).values({
      id: crypto.randomUUID(), subscription: subscription.id,
      externalId: resourceValue(payment.id) || resourceId, providerStatus: paymentStatus || 'pending',
      amountCents: Math.round(Number(payment.transaction_amount || 0) * 100),
      currency: resourceValue(payment.currency_id) || subscription.currency,
      occurredAt: dateValue(payment.date_created) || now, created: now,
    }).onConflictDoUpdate({ target: billingCharges.externalId, set: { providerStatus: paymentStatus || 'pending' } });
    await db.update(billingWebhookEvents).set({ processedAt: now, outcome: 'processed' })
      .where(eq(billingWebhookEvents.externalKey, externalKey));
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof MercadoPagoRequestError && error.status === 404 &&
      env.MERCADOPAGO_TEST_MODE === 'true' && resourceId === '123456') {
      // The dashboard's documented test payload uses this synthetic resource ID.
      const db = billingDb();
      await db.update(billingWebhookEvents).set({ processedAt: Date.now(), outcome: 'provider_resource_not_found' })
        .where(eq(billingWebhookEvents.externalKey, externalKey)).catch(() => {});
      return Response.json({ ok: true });
    }
    console.error('Mercado Pago webhook processing failed', error instanceof Error ? error.message : 'unknown');
    return Response.json({ error: 'retry' }, { status: 503 });
  }
}
