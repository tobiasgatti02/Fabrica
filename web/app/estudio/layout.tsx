import type { Metadata } from 'next';
import { getFabricaUser } from '@/features/auth/server';
import { StudioTour } from '@/components/fabrica/studio-tour';
import { RenewalReminder } from '@/components/billing/renewal-reminder';
import { StudioChrome, StudioAccountRegistration } from '@/components/fabrica/studio-chrome';
import { Suspense } from 'react';
import './studio.css';
import './studio-shell.css';

export const metadata: Metadata = {
  title: 'Estudio',
  description:
    'Gestioná proyectos, versiones, modelos y conversaciones con clientes en tu estudio de Fabrica.',
  alternates: { canonical: '/estudio' },
  robots: { index: false, follow: false, nocache: true },
};

async function StudioAccountExtras() {
  const user = await getFabricaUser();
  return <>
    <StudioAccountRegistration account={user ? {
      name: user.displayName,
      email: user.email,
      provider: user.provider,
      created: user.created,
    } : null} />
    {user && <RenewalReminder />}
    {(user || import.meta.env.DEV) && <StudioTour account={user?.userId || 'local-preview'} />}
  </>;
}

export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StudioChrome>
      {children}
      <Suspense fallback={null}><StudioAccountExtras /></Suspense>
    </StudioChrome>
  );
}
