import Studio from '@/components/fabrica/studio';
import { getFabricaUser } from '@/features/auth/server';
import './studio.css';
export const dynamic = 'force-dynamic';

export default async function StudioPage({
  searchParams,
}: {
  searchParams?: Promise<{ share?: string; auth_error?: string }>;
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
  return (
    <Studio
      localPreview={false}
      initialSharedToken={sharedToken}
      initialAuthError={authError}
      user={
        user
          ? {
              name: user.displayName,
              email: user.email,
              provider: user.provider,
            }
          : null
      }
    />
  );
}
