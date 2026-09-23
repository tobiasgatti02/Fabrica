import { eq } from 'drizzle-orm';
import { billingAccounts, billingCharges, billingSubscriptions, billingWebhookEvents } from '@/db/schema';
import { getAuthorizedPayment, getSubscription, verifyWebhook } from '@/features/billing/mercadopago';
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
  const resourceId = url.searchParams.get('data.id') || (payload?.data?.id != null ? String(payload.data.id) : null);
  if (!resourceId || !(await verifyWebhook(request, resourceId)))
    return Response.json({ error: 'invalid_signature' }, { status: 401 });

  const topic = url.searchParams.get('type') || url.searchParams.get('topic') || payload?.type || 'unknown';
  if (topic !== 'subscription_preapproval' && topic !== 'subscription_authorized_payment')
    return Response.json({ ok: true });

  const externalKey = `${topic}:${resourceId}:${payload?.action || ''}`;
  const db = billingDb();
  const [seen] = await db.select().from(billingWebhookEvents)
    .where(eq(billingWebhookEvents.externalKey, externalKey)).limit(1);
  if (seen?.processedAt) return Response.json({ ok: true });
  if (!seen) await db.insert(billingWebhookEvents).values({
    id: crypto.randomUUID(), externalKey, topic, resourceId,
    payload: JSON.stringify(payload), receivedAt: Date.now(),
  }).onConflictDoNothing();

  try {
    const payment = topic === 'subscription_authorized_payment'
      ? await getAuthorizedPayment(resourceId) : null;
    const externalSubscriptionId = payment ? String(payment.preapproval_id || '') : resourceId;
    const [subscription] = await db.select().from(billingSubscriptions)
      .where(eq(billingSubscriptions.externalId, externalSubscriptionId)).limit(1);
    if (!subscription) {
      await db.update(billingWebhookEvents).set({ processedAt: Date.now(), outcome: 'unknown_subscription' })
        .where(eq(billingWebhookEvents.externalKey, externalKey));
      return Response.json({ ok: true });
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
      nextPaidThrough = paidThrough && paidThrough > now ? paidThrough : null;
      state = nextPaidThrough ? 'active' : 'pending';
      graceEnds = null;
    } else if (paymentStatus === 'rejected') {
      state = 'grace_period';
      graceEnds = now + 5 * 86_400_000;
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
    }).onConflictDoNothing();
    await db.update(billingWebhookEvents).set({ processedAt: now, outcome: 'processed' })
      .where(eq(billingWebhookEvents.externalKey, externalKey));
    return Response.json({ ok: true });
  } catch (error) {
    console.error('Mercado Pago webhook processing failed', error instanceof Error ? error.name : 'unknown');
    return Response.json({ error: 'retry' }, { status: 503 });
  }
}
