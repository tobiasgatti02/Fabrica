import type { Metadata } from 'next';
import { getFabricaUser } from '@/features/auth/server';
import { StudioTour } from '@/components/fabrica/studio-tour';
import { RenewalReminder } from '@/components/billing/renewal-reminder';
import './studio.css';
import './studio-shell.css';

export const metadata: Metadata = {
  title: 'Estudio',
  description:
    'Gestioná proyectos, versiones, modelos y conversaciones con clientes en tu estudio de Fabrica.',
  alternates: { canonical: '/estudio' },
  robots: { index: false, follow: false, nocache: true },
};

export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getFabricaUser();
  return (
    <>
      {children}
      {user && <RenewalReminder />}
      {(user || import.meta.env.DEV) && (
        <StudioTour account={user?.userId || 'local-preview'} />
      )}
    </>
  );
}
