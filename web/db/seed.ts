import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { getDb } from './index';
import { studioProjects } from './schema';
import { createStarterProject } from '../features/studio/server/seed';

config({ path: '.env.local' });
const database = getDb(process.env.DATABASE_URL);
const owner = 'local-preview';
const [existing] = await database
  .select({ id: studioProjects.id })
  .from(studioProjects)
  .where(eq(studioProjects.owner, owner))
  .limit(1);
if (!existing) {
  const project = await createStarterProject(database, owner);
  console.log(`Proyecto vacío creado: ${project.name}.`);
} else {
  console.log('El estudio ya tiene un proyecto.');
}
