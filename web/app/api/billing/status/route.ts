import { desc, eq } from 'drizzle-orm';
import { billingAccounts, billingCharges, billingSubscriptions } from '@/db/schema';
import { getBillingStatus } from '@/features/billing/server';
import { reconcilePendingSubscription } from '@/features/billing/reconcile';
import { billingFailure, billingJson, requireBillingOwner } from '@/features/billing/http';

export async function GET(request: Request) {
  try {
    const { db, user } = await requireBillingOwner(request);
    let billing = await getBillingStatus(db, user.userId);
    const [latest] = await db.select().from(billingSubscriptions)
      .where(eq(billingSubscriptions.account, billing.account.id))
      .orderBy(desc(billingSubscriptions.created)).limit(1);
    if (latest?.state === 'pending') {
      try {
        await reconcilePendingSubscription(db, billing.account, latest);
      } catch (error) {
        console.error('Billing reconciliation failed', error instanceof Error ? error.name : 'unknown');
        if (billing.account.state === 'pending') await db.update(billingAccounts).set({
          state: billing.account.trialEnds > Date.now() ? 'trialing' : 'expired',
          plan: 'prueba', priceVersion: null, updated: Date.now(),
        }).where(eq(billingAccounts.id, billing.account.id));
      }
      billing = await getBillingStatus(db, user.userId);
    }
    const { account, state, rights, usage } = billing;
    const [subscription] = await db.select().from(billingSubscriptions)
      .where(eq(billingSubscriptions.account, account.id))
      .orderBy(desc(billingSubscriptions.created)).limit(1);
    const [charge] = subscription ? await db.select().from(billingCharges)
      .where(eq(billingCharges.subscription, subscription.id))
      .orderBy(desc(billingCharges.occurredAt)).limit(1) : [];
    return billingJson({
      state, plan: account.plan, priceVersion: account.priceVersion, rights, usage,
      trialStarted: account.trialStarted, trialEnds: account.trialEnds,
      graceEnds: account.graceEnds, paidThrough: account.paidThrough,
      cancelAt: account.cancelAt,
      subscription: subscription ? {
        state: subscription.state, providerStatus: subscription.providerStatus,
        nextChargeAt: subscription.nextChargeAt,
        amountCents: subscription.amountCents, currency: subscription.currency,
        created: subscription.created,
      } : null,
      lastCharge: charge ? {
        status: charge.providerStatus, amountCents: charge.amountCents,
        currency: charge.currency, occurredAt: charge.occurredAt,
      } : null,
    });
  } catch (error) { return billingFailure(error); }
}
