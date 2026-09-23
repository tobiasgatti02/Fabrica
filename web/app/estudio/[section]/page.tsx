import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Workspace from '@/components/fabrica/workspace';
import { getFabricaUser } from '@/features/auth/server';
import type { WorkspaceSection } from '@/features/workspace/client';
import '../studio.css';
import '../workspace.css';

export const dynamic = 'force-dynamic';

const sectionMetadata = {
  panel: {
    title: 'Panel del proyecto',
    description: 'Revisá el estado, las decisiones y los próximos pasos del proyecto.',
  },
  inspiracion: {
    title: 'Inspiración',
    description: 'Organizá referencias e ideas visuales del proyecto.',
  },
  equipo: {
    title: 'Equipo',
    description: 'Gestioná el equipo y los permisos del proyecto.',
  },
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}): Promise<Metadata> {
  const { section } = await params;
  const content = sectionMetadata[section as keyof typeof sectionMetadata];
  if (!content) return {};
  return {
    ...content,
    alternates: { canonical: `/estudio/${section}` },
    robots: { index: false, follow: false, nocache: true },
  };
}

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
