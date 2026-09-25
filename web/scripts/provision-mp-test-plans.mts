import { appendFileSync, readFileSync } from 'node:fs';
import { config } from 'dotenv';
import { PLANS, type PlanKey } from '../features/billing/core';

config({ path: '.env.local' });

if (process.env.MERCADOPAGO_TEST_MODE !== 'true') throw new Error('Solo se permiten planes de prueba.');
const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
const baseUrl = process.env.APP_BASE_URL;
if (!token || !baseUrl?.startsWith('https://')) throw new Error('Faltan credenciales de prueba o APP_BASE_URL HTTPS.');

const localEnv = readFileSync('.env.local', 'utf8');
for (const plan of ['inicial', 'estudio', 'equipo'] as PlanKey[]) {
  const key = `MERCADOPAGO_PLAN_${plan.toUpperCase()}`;
  if (process.env[key]) {
    console.log(`${plan}: ya configurado`);
    continue;
  }
  const price = PLANS[plan];
  const response = await fetch('https://api.mercadopago.com/preapproval_plan', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `fabrica-test-${plan}-v1`,
    },
    body: JSON.stringify({
      reason: `Fabrica ${price.name} (prueba)`,
      back_url: `${baseUrl}/estudio/facturacion`,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: price.amountCents / 100,
        currency_id: price.currency,
      },
    }),
  });
  const body = await response.json() as { id?: string; collector_id?: number };
  if (!response.ok || !body.id) throw new Error(`${plan}: Mercado Pago devolvió HTTP ${response.status}`);
  if (body.collector_id !== 2570246109) throw new Error(`${plan}: vendedor inesperado`);
  appendFileSync('.env.local', `${localEnv.endsWith('\n') ? '' : '\n'}${key}=${body.id}\n`);
  console.log(`${plan}: creado (${body.id})`);
}
