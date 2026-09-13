import { config } from 'dotenv';
import { asc, eq } from 'drizzle-orm';
import { getDb } from './index';
import {
  studioClients,
  studioComments,
  studioProjects,
  studioVersions,
} from './schema';
import { createStarterProject } from '../features/studio/server/seed';

config({ path: '.env.local' });

const database = getDb(process.env.DATABASE_URL);
const owner = 'local-preview';
const [existing] = await database
  .select({
    id: studioProjects.id,
    name: studioProjects.name,
    client: studioProjects.client,
  })
  .from(studioProjects)
  .where(eq(studioProjects.owner, owner))
  .limit(1);

if (existing) {
  const versions = await database
    .select({ id: studioVersions.id, modelKind: studioVersions.modelKind })
    .from(studioVersions)
    .where(eq(studioVersions.project, existing.id))
    .orderBy(asc(studioVersions.created));
  if (!versions.length) {
    await createStarterProject(database, owner, existing.name, existing.id);
    console.log(`Seed creado en ${existing.name}.`);
  } else if (!versions.some((version) => version.modelKind === 'demo')) {
    for (const [index, version] of versions.entries()) {
      await database
        .update(studioVersions)
        .set({ sequence: index + 3 })
        .where(eq(studioVersions.id, version.id));
    }
    await createStarterProject(database, owner, existing.name, existing.id);
    console.log(`Seed de producto añadido a ${existing.name}.`);
  } else {
    if (!existing.client) {
      const [savedClient] = await database
        .select({ id: studioClients.id })
        .from(studioClients)
        .where(eq(studioClients.owner, owner))
        .orderBy(asc(studioClients.created))
        .limit(1);
      const clientId = savedClient?.id || crypto.randomUUID();
      if (!savedClient) {
        await database.insert(studioClients).values({
          id: clientId,
          owner,
          name: 'Marina Costa',
          email: 'marina@costafamilia.com',
          created: Date.now() - 20 * 86400_000,
        });
      }
      await database
        .update(studioProjects)
        .set({ client: clientId })
        .where(eq(studioProjects.id, existing.id));
    }
    for (const [index, version] of versions.entries()) {
      await database
        .update(studioVersions)
        .set({ sequence: index + 1 })
        .where(eq(studioVersions.id, version.id));
    }
    const comments = await database
      .select({ id: studioComments.id, anchor: studioComments.anchor })
      .from(studioComments)
      .where(eq(studioComments.project, existing.id));
    for (const comment of comments) {
      if (!comment.anchor) {
        await database
          .update(studioComments)
          .set({ anchor: comment.id })
          .where(eq(studioComments.id, comment.id));
      }
    }
    console.log('Seed verificado y datos existentes normalizados.');
  }
} else {
  const project = await createStarterProject(database, owner);
  console.log(`Seed creado: ${project.name}.`);
}
