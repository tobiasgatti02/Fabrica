import { redirect } from 'next/navigation';

export default async function StudioEntryPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (typeof value === 'string') query.set(key, value);
    else if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
  }
  const suffix = query.toString();
  redirect(`/estudio/panel${suffix ? `?${suffix}` : ''}`);
}
