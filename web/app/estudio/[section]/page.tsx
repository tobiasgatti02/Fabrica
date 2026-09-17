import { notFound } from 'next/navigation';
import Workspace from '@/components/fabrica/workspace';
import { getFabricaUser } from '@/features/auth/server';
import type { WorkspaceSection } from '@/features/workspace/client';
import '../studio.css';
import '../workspace.css';

export const dynamic = 'force-dynamic';

export default async function WorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ project?: string; share?: string; invite?: string }>;
}) {
  const { section } = await params;
  if (!['panel', 'inspiracion', 'equipo'].includes(section))
    notFound();
  const query = await searchParams;
  const user = await getFabricaUser();
  return (
    <Workspace
      section={section as WorkspaceSection}
      initialProject={query.project || ''}
      share={query.share || ''}
      invite={query.invite || ''}
      authenticated={Boolean(user) || import.meta.env.DEV}
    />
  );
}
