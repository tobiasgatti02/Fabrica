import { env } from 'cloudflare:workers';

const API = 'https://api.mercadopago.com';

type ProviderResponse = Record<string, unknown>;

export class MercadoPagoRequestError extends Error {
  constructor(public readonly status: number, public readonly codes: string[]) {
    super(`billing_provider_http_${status}`);
  }
}

function providerErrorCodes(body: ProviderResponse) {
  const values = [body.error, ...(
    Array.isArray(body.cause) ? body.cause.map((cause: unknown) =>
      cause && typeof cause === 'object' ? (cause as Record<string, unknown>).code : null) : []
  )];
  return values.filter((value): value is string =>
    typeof value === 'string' && /^[a-zA-Z0-9_.-]{1,80}$/.test(value));
}

function accessToken() {
  if (!env.MERCADOPAGO_ACCESS_TOKEN) throw new Error('billing_provider_unconfigured');
  return env.MERCADOPAGO_ACCESS_TOKEN;
}

export function planIdFor(plan: string) {
  const value = env[`MERCADOPAGO_PLAN_${plan.toUpperCase()}` as keyof typeof env];
  if (typeof value !== 'string' || !value) throw new Error('billing_plan_unconfigured');
  return value;
}

async function request(path: string, init: RequestInit = {}, idempotencyKey?: string) {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${accessToken()}`);
  headers.set('Content-Type', 'application/json');
  if (idempotencyKey) headers.set('X-Idempotency-Key', idempotencyKey);
  const response = await fetch(`${API}${path}`, { ...init, headers, signal: AbortSignal.timeout(8_000) });
  const body = (await response.json().catch(() => ({}))) as ProviderResponse;
  if (!response.ok) {
    const codes = providerErrorCodes(body);
    console.error('Mercado Pago request failed', response.status, codes.join(','));
    throw new MercadoPagoRequestError(response.status, codes);
  }
  return body;
}

export function webhookManifest(request: Request, bodyId?: string) {
  const signature = request.headers.get('x-signature');
  const requestId = request.headers.get('x-request-id');
  const dataId = new URL(request.url).searchParams.get('data.id') || bodyId;
  if (!signature || !requestId || !dataId || !env.MERCADOPAGO_WEBHOOK_SECRET) return null;
  const parts = Object.fromEntries(signature.split(',').map((part) => {
    const [key, value] = part.trim().split('=', 2);
    return [key, value];
  }));
  if (!parts.ts || !/^[a-f0-9]{64}$/i.test(parts.v1 || '')) return null;
  const fields = [`id:${dataId.toLowerCase()}`, `request-id:${requestId}`, `ts:${parts.ts}`];
  return { value: fields.join(';') + ';', signature: parts.v1, secret: env.MERCADOPAGO_WEBHOOK_SECRET };
}

export async function verifyWebhook(request: Request, bodyId?: string) {
  const manifest = webhookManifest(request, bodyId);
  if (!manifest) return false;
  const expected = await crypto.subtle.sign(
    'HMAC',
    await crypto.subtle.importKey('raw', new TextEncoder().encode(manifest.secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
    new TextEncoder().encode(manifest.value),
  );
  const hex = [...new Uint8Array(expected)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  let difference = 0;
  const actual = manifest.signature.toLowerCase();
  for (let i = 0; i < hex.length; i++) difference |= hex.charCodeAt(i) ^ actual.charCodeAt(i);
  return difference === 0;
}

export function createSubscription(input: {
  plan: string;
  email: string;
  externalReference: string;
  cardTokenId: string;
  backUrl: string;
  idempotencyKey: string;
}) {
  return request('/preapproval', {
    method: 'POST',
    body: JSON.stringify({
      preapproval_plan_id: planIdFor(input.plan),
      payer_email: input.email,
      external_reference: input.externalReference,
      card_token_id: input.cardTokenId,
      status: 'authorized',
      back_url: input.backUrl,
    }),
  }, input.idempotencyKey);
}

export function getSubscription(id: string) {
  return request(`/preapproval/${encodeURIComponent(id)}`);
}

export function updateSubscription(id: string, body: Record<string, unknown>, idempotencyKey: string) {
  return request(`/preapproval/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  }, idempotencyKey);
}

export function getAuthorizedPayment(id: string) {
  return request(`/authorized_payments/${encodeURIComponent(id)}`);
}
