import { desc, eq } from 'drizzle-orm';
import { billingCharges, billingSubscriptions } from '@/db/schema';
import { getBillingStatus } from '@/features/billing/server';
import { billingFailure, billingJson, requireBillingOwner } from '@/features/billing/http';

export async function GET(request: Request) {
  try {
    const { db, user } = await requireBillingOwner(request);
    const { account, state, rights, usage } = await getBillingStatus(db, user.userId);
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
      } : null,
      lastCharge: charge ? {
        status: charge.providerStatus, amountCents: charge.amountCents,
        currency: charge.currency, occurredAt: charge.occurredAt,
      } : null,
    });
  } catch (error) { return billingFailure(error); }
}
