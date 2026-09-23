import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { billingAccounts, billingCharges, billingPriceVersions, billingSubscriptions } from '@/db/schema';
import { getSubscription, searchAuthorizedPayments } from './mercadopago';

type Database = ReturnType<typeof getDb>;
type Account = typeof billingAccounts.$inferSelect;
type Subscription = typeof billingSubscriptions.$inferSelect;
type Invoice = Record<string, unknown> & { payment?: { status?: unknown } };
const text = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : null;
const timestamp = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;

export async function reconcilePendingSubscription(db: Database, account: Account, subscription: Subscription) {
  if (!subscription.externalId || subscription.state !== 'pending') return;
  if (Date.now() - subscription.updated < 10_000 && account.state !== 'pending') return;
  const [provider, search] = await Promise.all([
    getSubscription(subscription.externalId),
    searchAuthorizedPayments(subscription.externalId),
  ]);
  const invoices = Array.isArray(search.results) ? search.results as Invoice[] : [];
  const approved = invoices.find((item) => item.payment?.status === 'approved');
  const now = Date.now();
  const nextChargeAt = timestamp(provider.next_payment_date);
  const providerStatus = text(provider.status) || 'pending';
  if (approved && nextChargeAt && nextChargeAt > now) {
    const [price] = await db.select().from(billingPriceVersions)
      .where(eq(billingPriceVersions.id, subscription.priceVersion)).limit(1);
    if (!price) throw new Error('billing_price_unavailable');
    await db.update(billingSubscriptions).set({
      state: 'active', providerStatus, nextChargeAt, currentPeriodEnd: nextChargeAt, updated: now,
    }).where(eq(billingSubscriptions.id, subscription.id));
    await db.update(billingAccounts).set({
      state: 'active', plan: price.plan, priceVersion: price.id, paidThrough: nextChargeAt,
      graceEnds: null, cancelAt: null, updated: now,
    }).where(eq(billingAccounts.id, account.id));
    const externalId = text(approved.id);
    if (externalId) await db.insert(billingCharges).values({
      id: crypto.randomUUID(), subscription: subscription.id, externalId,
      providerStatus: 'approved',
      amountCents: Math.round(Number(approved.transaction_amount || 0) * 100),
      currency: text(approved.currency_id) || subscription.currency,
      occurredAt: timestamp(approved.date_created) || now, created: now,
    }).onConflictDoUpdate({ target: billingCharges.externalId, set: { providerStatus: 'approved' } });
    return;
  }
  const ended = providerStatus === 'canceled' || providerStatus === 'cancelled' || providerStatus === 'paused';
  await db.update(billingSubscriptions).set({
    state: ended ? providerStatus : 'pending', providerStatus, nextChargeAt, updated: now,
  }).where(eq(billingSubscriptions.id, subscription.id));
  if (account.state === 'pending') await db.update(billingAccounts).set({
    state: account.trialEnds > now ? 'trialing' : 'expired',
    plan: 'prueba', priceVersion: null, updated: now,
  }).where(eq(billingAccounts.id, account.id));
}
