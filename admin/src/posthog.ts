type QueryResponse = { results?: (string | number | null)[][] };

async function query(apiKey: string, statement: string): Promise<QueryResponse> {
  const response = await fetch('https://us.posthog.com/api/projects/628665/query/', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query: statement } }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`PostHog query failed: ${response.status}`);
  return response.json() as Promise<QueryResponse>;
}

export async function getProductAnalytics(apiKey?: string) {
  if (!apiKey) return { connected: false, reason: 'missing_api_key' };
  try {
    const [overview, topPages, errors] = await Promise.all([
      query(apiKey, `SELECT count(DISTINCT person_id) AS users, countIf(event = '$pageview') AS pageviews, countIf(event = '$exception') AS exceptions FROM events WHERE timestamp >= now() - INTERVAL 30 DAY`),
      query(apiKey, `SELECT properties.$pathname AS path, count() AS visits FROM events WHERE event = '$pageview' AND timestamp >= now() - INTERVAL 30 DAY GROUP BY path ORDER BY visits DESC LIMIT 8`),
      query(apiKey, `SELECT properties.$exception_type AS type, count() AS occurrences FROM events WHERE event = '$exception' AND timestamp >= now() - INTERVAL 24 HOUR GROUP BY type ORDER BY occurrences DESC LIMIT 5`),
    ]);
    return { connected: true, overview: overview.results?.[0] || [0, 0, 0], topPages: topPages.results || [], errors: errors.results || [] };
  } catch (error) {
    console.error('PostHog analytics unavailable', error);
    return { connected: false, reason: 'query_failed' };
  }
}
