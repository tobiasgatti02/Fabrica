import { getDb } from '@/db';
import { studioProjects } from '@/db/schema';

type Database = ReturnType<typeof getDb>;

/** Start with an empty project; the product tour explains how to add real data. */
export async function createStarterProject(
  database: Database,
  owner: string,
  name = 'Mi primer proyecto',
  existingProjectId?: string,
) {
  const project = {
    id: existingProjectId || crypto.randomUUID(),
    owner,
    client: null,
    share: crypto.randomUUID(),
    shareEnabled: 0,
    shareExpires: 0,
    name,
    created: Date.now(),
  };
  if (!existingProjectId) await database.insert(studioProjects).values(project);
  return project;
}
