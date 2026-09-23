import { env } from 'cloudflare:workers';
import { and, eq } from 'drizzle-orm';
import { billingAccounts, billingPriceVersions, billingSubscriptions } from '@/db/schema';
import { getBillingStatus } from '@/features/billing/server';
import { createSubscription } from '@/features/billing/mercadopago';
import { billingFailure, billingJson, requireBillingOwner } from '@/features/billing/http';

export async function POST(request: Request) {
  try {
    const { db, user } = await requireBillingOwner(request);
    const body = await request.json() as { plan?: unknown; cardTokenId?: unknown; payerEmail?: unknown };
    if (typeof body.plan !== 'string' || typeof body.cardTokenId !== 'string' || !body.cardTokenId ||
      typeof body.payerEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.payerEmail))
      return billingJson({ error: 'Elegí un plan y completá el medio de pago.' }, 400);
    const status = await getBillingStatus(db, user.userId);
    if (!env.APP_BASE_URL) throw new Error('billing_base_url_unconfigured');
    if (!env.APP_BASE_URL.startsWith('https://') && !env.APP_BASE_URL.startsWith('http://localhost:'))
      throw new Error('billing_base_url_invalid');
    if (env.MERCADOPAGO_TEST_MODE === 'true' && !body.payerEmail.toLowerCase().endsWith('@testuser.com'))
      return billingJson({ error: 'Para pruebas, usá el correo del comprador de prueba de Mercado Pago.' }, 400);
    if (status.account.state === 'pending' || status.account.state === 'active')
      return billingJson({ error: 'Ya hay una suscripción en curso para este estudio.' }, 409);
    const [price] = await db.select().from(billingPriceVersions).where(and(
      eq(billingPriceVersions.plan, body.plan), eq(billingPriceVersions.active, 1),
    )).limit(1);
    if (!price || price.plan === 'prueba') return billingJson({ error: 'El plan no está disponible.' }, 400);
    const externalReference = `fabrica:${status.account.id}:${crypto.randomUUID()}`;
    const subscriptionId = crypto.randomUUID();
    const subscription = await createSubscription({
      plan: price.plan,
      email: body.payerEmail,
      externalReference,
      cardTokenId: body.cardTokenId,
      notificationUrl: `${env.APP_BASE_URL}/api/billing/webhooks/mercadopago`,
      backUrl: `${env.APP_BASE_URL}/estudio/facturacion`,
      idempotencyKey: externalReference,
    });
    if (typeof subscription.id !== 'string' || !subscription.id) throw new Error('billing_provider_invalid_response');
    await db.insert(billingSubscriptions).values({
      id: subscriptionId, account: status.account.id, externalId: subscription.id,
      externalReference, priceVersion: price.id, providerStatus: String(subscription.status || 'pending'),
      state: 'pending', currency: price.currency, amountCents: price.amountCents,
      created: Date.now(), updated: Date.now(),
    });
    await db.update(billingAccounts).set({
      plan: price.plan, priceVersion: price.id, state: 'pending', updated: Date.now(),
    }).where(eq(billingAccounts.id, status.account.id));
    return billingJson({ ok: true, subscriptionId, providerStatus: subscription.status }, 201);
  } catch (error) { return billingFailure(error); }
}
