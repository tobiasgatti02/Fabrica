let recentStatus: Promise<unknown> | null = null;
let requestedAt = 0;

/** Share a concurrent status read across the header, reminder and billing page. */
export async function readBillingStatus<T>({ fresh = false }: { fresh?: boolean } = {}): Promise<T> {
  const now = Date.now();
  if (!fresh && recentStatus && now - requestedAt < 2_000) return recentStatus as Promise<T>;
  const request = fetch('/api/billing/status', { cache: 'no-store' }).then(async (response) => {
    if (!response.ok) throw new Error(response.status === 401
      ? 'Iniciá sesión para ver tu facturación.'
      : 'No pudimos cargar la facturación.');
    return response.json() as Promise<T>;
  });
  recentStatus = request;
  requestedAt = now;
  try {
    return await request;
  } catch (error) {
    if (recentStatus === request) recentStatus = null;
    throw error;
  }
}
