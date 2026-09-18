import { getFabricaUser } from '@/features/auth/server';
import { StudioTour } from '@/components/fabrica/studio-tour';
import './studio.css';
import './studio-shell.css';

export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getFabricaUser();
  return (
    <>
      {children}
      {(user || import.meta.env.DEV) && (
        <StudioTour account={user?.userId || 'local-preview'} />
      )}
    </>
  );
}
