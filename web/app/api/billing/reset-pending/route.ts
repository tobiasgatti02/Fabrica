import { desc, eq } from 'drizzle-orm';
import { billingAccounts, billingSubscriptions } from '@/db/schema';
import { getBillingStatus } from '@/features/billing/server';
import { searchAuthorizedPayments, updateSubscription } from '@/features/billing/mercadopago';
import { billingFailure, billingJson, requireBillingOwner } from '@/features/billing/http';

export async function POST(request: Request) {
  try {
    const { db, user } = await requireBillingOwner(request);
    const { account } = await getBillingStatus(db, user.userId);
    const [subscription] = await db.select().from(billingSubscriptions)
      .where(eq(billingSubscriptions.account, account.id))
      .orderBy(desc(billingSubscriptions.created)).limit(1);
    if (!subscription?.externalId || subscription.state !== 'pending')
      return billingJson({ error: 'No hay un intento pendiente.' }, 409);
    if (Date.now() - subscription.created < 120_000)
      return billingJson({ error: 'El pago todavía se está verificando. Esperá dos minutos antes de reintentarlo.' }, 409);
    const search = await searchAuthorizedPayments(subscription.externalId);
    const invoices = Array.isArray(search.results) ? search.results as { payment?: { status?: string } }[] : [];
    if (invoices.some((invoice) => invoice.payment?.status === 'approved'))
      return billingJson({ error: 'El pago ya fue aprobado. Actualizá la página para activar tu plan.' }, 409);
    await updateSubscription(subscription.externalId, { status: 'canceled' }, `reset:${subscription.id}`);
    const now = Date.now();
    await db.update(billingSubscriptions).set({ state: 'canceled', providerStatus: 'canceled', updated: now })
      .where(eq(billingSubscriptions.id, subscription.id));
    if (account.state === 'pending') await db.update(billingAccounts).set({
      state: account.trialEnds > now ? 'trialing' : 'expired',
      plan: 'prueba', priceVersion: null, updated: now,
    }).where(eq(billingAccounts.id, account.id));
    return billingJson({ ok: true });
  } catch (error) { return billingFailure(error); }
}
