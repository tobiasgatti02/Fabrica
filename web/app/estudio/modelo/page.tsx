import type { Metadata } from 'next';
import Studio from '@/components/fabrica/studio';
import { getFabricaUser } from '@/features/auth/server';
import { ownerAccessBlocked } from '@/features/billing/access';
import { redirect } from 'next/navigation';
import '../studio.css';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Modelo 3D',
  alternates: { canonical: '/estudio/modelo' },
};

export default async function StudioPage({
  searchParams,
}: {
  searchParams?: Promise<{
    share?: string;
    project?: string;
    auth_error?: string;
    account?: string;
  }>;
}) {
  const params = await searchParams;
  const sharedToken = params?.share || '';
  const authError =
    params?.auth_error === 'google_unavailable'
      ? 'El acceso con Google todavía no está configurado.'
      : params?.auth_error === 'google_cancelled'
        ? 'No se completó el acceso con Google.'
        : params?.auth_error === 'google_failed'
          ? 'No pudimos ingresar con Google. Intentá nuevamente.'
          : '';
  const user = await getFabricaUser();
  if (user && !sharedToken && await ownerAccessBlocked(user.userId))
    redirect('/estudio/facturacion');
  return (
    <Studio
      localPreview={import.meta.env.DEV}
      initialSharedToken={sharedToken}
      initialProject={params?.project || ''}
      initialAuthError={authError}
      initialAccountOpen={params?.account === '1'}
      user={
        user
          ? {
              name: user.displayName,
              email: user.email,
              provider: user.provider,
              created: user.created,
            }
          : null
      }
    />
  );
}
