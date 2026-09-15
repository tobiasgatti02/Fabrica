import { getDb } from '@/db';
import { eq } from 'drizzle-orm';
import {
  studioClients,
  studioComments,
  studioMeasurements,
  studioPlans,
  studioProjects,
  studioVersions,
} from '@/db/schema';

type Database = ReturnType<typeof getDb>;

const cameraViews = [
  {
    id: 'exterior',
    name: 'Exterior',
    position: [10.8, 7.4, 12.5],
    target: [0, 1.2, 0],
  },
  {
    id: 'estar',
    name: 'Estar',
    position: [4.3, 2.7, 4.7],
    target: [-0.4, 1.35, -0.2],
  },
  {
    id: 'planta',
    name: 'Planta',
    position: [0, 20, 0.01],
    target: [0, 0, 0],
  },
];

/** Creates product data only for a newly created workspace. Migrations stay schema-only. */
export async function createStarterProject(
  database: Database,
  owner: string,
  name = 'Casa Patio',
  existingProjectId?: string,
) {
  const now = Date.now();
  const project = {
    id: existingProjectId || crypto.randomUUID(),
    owner,
    client: crypto.randomUUID(),
    share: crypto.randomUUID(),
    shareEnabled: 1,
    shareExpires: now + 30 * 86400_000,
    name,
    created: now,
  };
  const proposal = crypto.randomUUID();
  const materials = crypto.randomUUID();
  const windowAnchor = crypto.randomUUID();

  await database.insert(studioClients).values({
    id: project.client,
    owner,
    name: 'Marina Costa',
    email: 'marina@costafamilia.com',
    created: now - 20 * 86400_000,
  });
  if (existingProjectId) {
    await database
      .update(studioProjects)
      .set({ client: project.client })
      .where(eq(studioProjects.id, existingProjectId));
  } else {
    await database.insert(studioProjects).values(project);
  }
  await database.insert(studioVersions).values([
    {
      id: proposal,
      project: project.id,
      name: 'Propuesta inicial',
      description: 'Distribución, envolvente y relación con el patio.',
      sequence: 1,
      sourceVersion: null,
      modelKind: 'demo',
      files: '[]',
      views: '[]',
      settings: JSON.stringify({ hiddenObjects: [], palette: 'original' }),
      unit: 'm',
      published: 1,
      created: now - 15 * 86400_000,
    },
    {
      id: materials,
      project: project.id,
      name: 'Materiales cálidos',
      description: 'Ajuste de madera, piedra y luz interior.',
      sequence: 2,
      sourceVersion: proposal,
      modelKind: 'demo',
      files: '[]',
      views: '[]',
      settings: JSON.stringify({ hiddenObjects: [], palette: 'warm' }),
      unit: 'm',
      published: 1,
      created: now - 2 * 86400_000,
    },
  ]);
  await database.insert(studioComments).values([
    {
      id: crypto.randomUUID(),
      project: project.id,
      version: '*',
      author: 'Estudio Norte',
      text: 'La próxima revisión concentra las decisiones del estar y el vínculo con el patio.',
      anchor: 'project',
      parent: null,
      scope: 'project',
      surface: 'Todo el proyecto',
      point: null,
      camera: null,
      state: 'abierto',
      created: now - 36 * 3600_000,
    },
    {
      id: crypto.randomUUID(),
      project: project.id,
      version: materials,
      author: 'Marina Costa',
      text: '¿Podemos ampliar un poco más este paño para que entre luz por la tarde?',
      anchor: windowAnchor,
      parent: null,
      scope: 'point',
      surface: 'Ventanal del estar',
      point: JSON.stringify([-1.1, 1.8, 3.22]),
      camera: JSON.stringify(cameraViews[1]),
      state: 'abierto',
      created: now - 20 * 3600_000,
    },
    {
      id: crypto.randomUUID(),
      project: project.id,
      version: materials,
      author: 'Estudio Norte',
      text: 'Sí. Lo revisamos con estructura y lo incorporamos en la próxima versión.',
      anchor: windowAnchor,
      parent: null,
      scope: 'point',
      surface: 'Ventanal del estar',
      point: JSON.stringify([-1.1, 1.8, 3.22]),
      camera: JSON.stringify(cameraViews[1]),
      state: 'abierto',
      created: now - 18 * 3600_000,
    },
  ]);
  await database.insert(studioMeasurements).values({
    id: crypto.randomUUID(),
    project: project.id,
    version: materials,
    name: 'Ancho del ventanal',
    startPoint: JSON.stringify([-3.05, 0.2, 3.22]),
    endPoint: JSON.stringify([0.9, 0.2, 3.22]),
    value: 3.95,
    unit: 'm',
    createdBy: 'Estudio Norte',
    created: now - 18 * 3600_000,
  });
  await database.insert(studioPlans).values([
    {
      id: crypto.randomUUID(),
      project: project.id,
      version: materials,
      name: 'Planta general',
      sheet: 'A-01',
      mime: 'application/pdf',
      key: null,
      size: 0,
      createdBy: 'Estudio Norte',
      created: now - 2 * 86400_000,
    },
    {
      id: crypto.randomUUID(),
      project: project.id,
      version: materials,
      name: 'Corte patio–estar',
      sheet: 'A-04',
      mime: 'application/pdf',
      key: null,
      size: 0,
      createdBy: 'Estudio Norte',
      created: now - 2 * 86400_000,
    },
  ]);
  return project;
}
