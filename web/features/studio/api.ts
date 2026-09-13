import type { StudioResponse } from './domain';

export async function studioRequest(
  body?: unknown,
  share = '',
  project = '',
): Promise<StudioResponse> {
  const params = new URLSearchParams();
  if (share) params.set('share', share);
  if (project) params.set('project', project);
  const response = await fetch(
    `/api/studio${params.size ? `?${params}` : ''}`,
    body
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : undefined,
  );
  const data = (await response.json()) as StudioResponse;
  if (!response.ok) {
    throw new Error(data.error || 'No se pudo completar la operación.');
  }
  return data;
}
