import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { studioProjects } from '@/db/schema';
import { getFabricaUser } from '@/features/auth/server';
import { MercadoPagoRequestError } from './mercadopago';

export const billingDb = () => getDb(env.DATABASE_URL);

export function billingJson(value: unknown, status = 200) {
  return Response.json(value, { status, headers: {
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  } });
}

export async function requireBillingOwner(request: Request) {
  const user = await getFabricaUser(request);
  if (!user) throw new Error('401');
  const db = billingDb();
  const [project] = await db.select({ id: studioProjects.id }).from(studioProjects)
    .where(eq(studioProjects.owner, user.userId)).limit(1);
  if (!project) throw new Error('403');
  return { db, user };
}

export function billingFailure(error: unknown) {
  const code = Number((error as Error)?.message);
  if (code === 401) return billingJson({ error: 'Iniciá sesión para continuar.' }, 401);
  if (code === 403) return billingJson({ error: 'Solo quien administra el estudio puede ver su facturación.' }, 403);
  if (error instanceof MercadoPagoRequestError && error.status === 400) {
    return billingJson({
      error: 'Mercado Pago rechazó la suscripción. Revisá los datos del comprador y la tarjeta de prueba.',
      ...(env.MERCADOPAGO_TEST_MODE === 'true' && error.codes.length ? { providerCodes: error.codes } : {}),
    }, 422);
  }
  console.error('Billing request failed', error instanceof Error ? error.name : 'unknown');
  return billingJson({ error: 'No pudimos consultar la facturación.' }, 503);
}
