import { env } from 'cloudflare:workers';
import { and, asc, eq, gt, inArray, isNull, max, or } from 'drizzle-orm';
import { randomToken } from '@/features/auth/core';
import { getFabricaUser } from '@/features/auth/server';
import { getDb } from '@/db';
import {
  studioClients,
  studioComments,
  studioMeasurements,
  studioPlans,
  studioProjects,
  studioTeamMembers,
  studioUploads,
  studioVersions,
} from '@/db/schema';
import { createStarterProject } from '@/features/studio/server/seed';

const PART = 8 * 1024 * 1024;
const MAX_FILE = 5 * 1024 ** 3;
type StudioBody = {
  action?: unknown;
  text?: unknown;
  scope?: unknown;
  surface?: unknown;
  point?: unknown;
  camera?: { position?: unknown; target?: unknown };
  version?: unknown;
  name?: unknown;
  size?: unknown;
  id?: unknown;
  parts?: unknown;
  files?: unknown;
  position?: unknown;
  target?: unknown;
  description?: unknown;
  sourceVersion?: unknown;
  hiddenObjects?: unknown;
  anchor?: unknown;
  parent?: unknown;
  startPoint?: unknown;
  endPoint?: unknown;
  value?: unknown;
  unit?: unknown;
  key?: unknown;
  sheet?: unknown;
  mime?: unknown;
  client?: unknown;
  email?: unknown;
  days?: unknown;
  upAxis?: unknown;
};
const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });

function db() {
  return getDb(env.DATABASE_URL);
}

export async function context(request: Request) {
  const database = db();
  const share = new URL(request.url).searchParams.get('share');
  if (share) {
    const [project] = await database
      .select()
      .from(studioProjects)
      .where(
        and(
          eq(studioProjects.share, share),
          eq(studioProjects.shareEnabled, 1),
          or(
            eq(studioProjects.shareExpires, 0),
            gt(studioProjects.shareExpires, Date.now()),
          ),
        ),
      )
      .limit(1);
    if (!project) throw new Error('404');

    const authenticated = await getFabricaUser(request);
    const [client] = project.client
      ? await database
          .select({
            name: studioClients.name,
            email: studioClients.email,
            account: studioClients.account,
          })
          .from(studioClients)
          .where(eq(studioClients.id, project.client))
          .limit(1)
      : [];
    if (
      authenticated &&
      client &&
      project.client &&
      client.email &&
      authenticated.email.toLowerCase() === client.email.toLowerCase() &&
      (!client.account || client.account === authenticated.userId)
    ) {
      await database
        .update(studioClients)
        .set({ account: authenticated.userId })
        .where(
          and(
            eq(studioClients.id, project.client),
            or(
              isNull(studioClients.account),
              eq(studioClients.account, authenticated.userId),
            ),
          ),
        );
    }
    const identity =
      authenticated ||
      ({
        userId: `guest:${project.id}`,
        displayName: client?.name || 'Cliente invitado',
        email: client?.email || '',
        fullName: client?.name || null,
        provider: 'guest' as const,
      } as const);
    return { project, projects: [], clients: [], identity, owner: false, accountOwner: false };
  }

  const user = await getFabricaUser(request);
  // This identity exists only in the local development build, never on the hosted site.
  const identity =
    user ||
    (import.meta.env.DEV
      ? {
          userId: 'local-preview',
          displayName: 'Estudio local',
          email: 'local-preview@example.invalid',
          fullName: null,
          provider: 'fabrica' as const,
        }
      : null);
  if (!identity) throw new Error('401');
  const requestedProject = new URL(request.url).searchParams.get('project');

  let projects = await database
    .select()
    .from(studioProjects)
    .where(eq(studioProjects.owner, identity.userId))
    .orderBy(asc(studioProjects.created));
  let teamRole = '';
  let teamMemberships: { project: string | null; role: string }[] = [];
  if (!projects.length || (requestedProject && !projects.some((item) => item.id === requestedProject))) {
    const memberships = await database
      .select()
      .from(studioTeamMembers)
      .where(eq(studioTeamMembers.user, identity.userId));
    const [requested] = requestedProject
      ? await database.select({ owner: studioProjects.owner }).from(studioProjects).where(eq(studioProjects.id, requestedProject)).limit(1)
      : [];
    const memberOwner = requested?.owner || memberships[0]?.owner;
    const accepted = memberships.filter((item) => item.accepted && item.owner === memberOwner);
    if (accepted.length) {
      teamMemberships = accepted;
      const studioOwner = accepted[0].owner;
      const sameStudio = accepted;
      const allProjects = await database
        .select()
        .from(studioProjects)
        .where(eq(studioProjects.owner, studioOwner))
        .orderBy(asc(studioProjects.created));
      projects = sameStudio.some((item) => !item.project)
        ? allProjects
        : allProjects.filter((item) =>
            sameStudio.some((membership) => membership.project === item.id),
          );
      teamRole = 'viewer';
    }
  }
  if (!projects.length) {
    const linkedClients = await database
      .select({ id: studioClients.id })
      .from(studioClients)
      .where(eq(studioClients.account, identity.userId));
    if (linkedClients.length) {
      projects = await database
        .select()
        .from(studioProjects)
        .where(
          inArray(
            studioProjects.client,
            linkedClients.map((client) => client.id),
          ),
        )
        .orderBy(asc(studioProjects.created));
    }
  }
  if (!projects.length) {
    await createStarterProject(database, identity.userId);
    projects = await database
      .select()
      .from(studioProjects)
      .where(eq(studioProjects.owner, identity.userId))
      .orderBy(asc(studioProjects.created));
  }
  const project = requestedProject
    ? projects.find((item) => item.id === requestedProject)
    : projects[0];
  if (!project) throw new Error(requestedProject ? '404' : '503');
  if (teamRole) {
    const applicable = teamMemberships.filter((item) => !item.project || item.project === project.id);
    teamRole = applicable.some((item) => item.role === 'architect')
      ? 'architect'
      : applicable.some((item) => item.role === 'collaborator')
        ? 'collaborator'
        : 'viewer';
  }
  const ownsProjects = project.owner === identity.userId;
  const canEdit = ownsProjects || Boolean(teamRole && teamRole !== 'viewer');
  if (!canEdit) {
    return { project, projects, clients: [], identity, owner: false, accountOwner: false };
  }
  const clients = await database
    .select()
    .from(studioClients)
    .where(eq(studioClients.owner, projects[0].owner))
    .orderBy(asc(studioClients.name), asc(studioClients.created));
  const visibleClients = ownsProjects
    ? clients
    : clients.filter((client) => projects.some((item) => item.client === client.id));
  return { project, projects, clients: visibleClients, identity, owner: true, accountOwner: ownsProjects };
}

function failure(error: unknown) {
  const code = Number((error as Error).message);
  if ([400, 401, 403, 404, 413].includes(code)) {
    return json(
      {
        error: (
          {
            400: 'Datos inválidos.',
            401: 'Iniciá sesión para continuar.',
            403: 'Esta acción requiere acceso profesional al proyecto.',
            404: 'No se encontró el recurso.',
            413: 'El archivo supera el límite de almacenamiento de 5 GB por archivo.',
          } as Record<number, string>
        )[code],
      },
      code,
    );
  }
  console.error('Studio request failed', error);
  return json(
    { error: 'No se pudo guardar o cargar el proyecto. Volvé a intentar.' },
    503,
  );
}

export async function GET(request: Request) {
  try {
    const { project, projects, clients, identity, owner, accountOwner } =
      await context(request);
    const database = db();
    const params = new URL(request.url).searchParams;
    const asset = params.get('asset');
    if (asset) {
      const versions = await database
        .select({ id: studioVersions.id, files: studioVersions.files })
        .from(studioVersions)
        .where(
          owner
            ? eq(studioVersions.project, project.id)
            : and(
                eq(studioVersions.project, project.id),
                eq(studioVersions.published, 1),
              ),
        );
      if (!versions.length) throw new Error('404');
      const plans = await database
        .select({ key: studioPlans.key })
        .from(studioPlans)
        .where(
          and(
            eq(studioPlans.project, project.id),
            inArray(
              studioPlans.version,
              versions.map((version) => version.id),
            ),
          ),
        );
      const isVersionFile = versions.some((version) =>
        (JSON.parse(version.files) as { key: string }[]).some(
          (file) => file.key === asset,
        ),
      );
      const isPlanFile = plans.some((plan) => plan.key === asset);
      if (!isVersionFile && !isPlanFile) {
        throw new Error('404');
      }
      const file = await env.FILES.get(asset);
      if (!file) throw new Error('404');
      return new Response(file.body, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(file.size),
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    const publishedVersionIds = database
      .select({ id: studioVersions.id })
      .from(studioVersions)
      .where(
        and(
          eq(studioVersions.project, project.id),
          eq(studioVersions.published, 1),
        ),
      );
    const versions = await database
      .select()
      .from(studioVersions)
      .where(
        owner
          ? eq(studioVersions.project, project.id)
          : and(
              eq(studioVersions.project, project.id),
              eq(studioVersions.published, 1),
            ),
      )
      .orderBy(asc(studioVersions.sequence), asc(studioVersions.created));
    const comments = await database
      .select()
      .from(studioComments)
      .where(
        owner
          ? eq(studioComments.project, project.id)
          : and(
              eq(studioComments.project, project.id),
              or(
                eq(studioComments.version, '*'),
                inArray(studioComments.version, publishedVersionIds),
              ),
            ),
      )
      .orderBy(asc(studioComments.created));
    const measurements = await database
      .select()
      .from(studioMeasurements)
      .where(
        owner
          ? eq(studioMeasurements.project, project.id)
          : and(
              eq(studioMeasurements.project, project.id),
              inArray(studioMeasurements.version, publishedVersionIds),
            ),
      )
      .orderBy(asc(studioMeasurements.created));
    const plans = await database
      .select()
      .from(studioPlans)
      .where(
        owner
          ? eq(studioPlans.project, project.id)
          : and(
              eq(studioPlans.project, project.id),
              inArray(studioPlans.version, publishedVersionIds),
            ),
      )
      .orderBy(asc(studioPlans.created));

    return json({
      versions,
      comments,
      measurements,
      plans,
      share: owner && project.shareEnabled ? project.share : null,
      shareEnabled: owner ? Boolean(project.shareEnabled) : true,
      shareExpires: owner ? project.shareExpires : 0,
      owner,
      accountOwner,
      viewer: {
        name: identity.displayName,
        guest: identity.provider === 'guest',
      },
      project: {
        id: project.id,
        name: project.name,
        client: owner ? project.client : null,
      },
      clients: owner
        ? clients.map((item) => ({
            id: item.id,
            name: item.name,
            email: item.email,
          }))
        : [],
      projects: projects.map((item) => ({
        id: item.id,
        name: item.name,
        client: owner ? item.client : null,
      })),
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    if (
      request.headers.get('origin') &&
      request.headers.get('origin') !== new URL(request.url).origin
    ) {
      throw new Error('403');
    }
    const { project, owner, identity, accountOwner } = await context(request);
    const database = db();
    if (Number(request.headers.get('content-length') || 0) > 1024 * 1024) {
      throw new Error('400');
    }
    const body = (await request.json()) as StudioBody;

    if (body.action === 'comment') {
      const scope = body.scope === 'project' ? 'project' : 'point';
      const validPoint =
        Array.isArray(body.point) &&
        body.point.length === 3 &&
        body.point.every(
          (number: unknown) =>
            typeof number === 'number' && Number.isFinite(number),
        );
      if (
        typeof body.text !== 'string' ||
        !body.text.trim() ||
        body.text.length > 5000 ||
        (scope === 'point' &&
          (typeof body.version !== 'string' ||
            !body.version ||
            typeof body.surface !== 'string' ||
            !body.surface.trim() ||
            body.surface.length > 500 ||
            !validPoint)) ||
        (body.camera !== undefined &&
          (!body.camera ||
            !Array.isArray(body.camera.position) ||
            !Array.isArray(body.camera.target) ||
            body.camera.position.length !== 3 ||
            body.camera.target.length !== 3 ||
            [...body.camera.position, ...body.camera.target].some(
              (number: unknown) =>
                typeof number !== 'number' || !Number.isFinite(number),
            )))
      ) {
        throw new Error('400');
      }
      const commentVersion =
        scope === 'project' ? '*' : (body.version as string);
      const commentSurface =
        scope === 'project'
          ? 'Todo el proyecto'
          : (body.surface as string).trim();
      if (scope === 'point') {
        const [version] = await database
          .select({ id: studioVersions.id })
          .from(studioVersions)
          .where(
            owner
              ? and(
                  eq(studioVersions.id, commentVersion),
                  eq(studioVersions.project, project.id),
                )
              : and(
                  eq(studioVersions.id, commentVersion),
                  eq(studioVersions.project, project.id),
                  eq(studioVersions.published, 1),
                ),
          )
          .limit(1);
        if (!version) throw new Error('404');
      }
      let anchor = scope === 'project' ? 'project' : crypto.randomUUID();
      if (
        scope === 'point' &&
        typeof body.anchor === 'string' &&
        body.anchor.length <= 100
      ) {
        const [existingAnchor] = await database
          .select({ anchor: studioComments.anchor })
          .from(studioComments)
          .where(
            and(
              eq(studioComments.project, project.id),
              eq(studioComments.version, commentVersion),
              eq(studioComments.anchor, body.anchor),
            ),
          )
          .limit(1);
        if (existingAnchor) anchor = existingAnchor.anchor;
      }
      await database.insert(studioComments).values({
        id: crypto.randomUUID(),
        project: project.id,
        version: commentVersion,
        author: identity.displayName,
        text: body.text.trim(),
        anchor,
        parent:
          typeof body.parent === 'string' && body.parent.length <= 100
            ? body.parent
            : null,
        scope,
        surface: commentSurface,
        point: scope === 'point' ? JSON.stringify(body.point) : null,
        camera: body.camera ? JSON.stringify(body.camera) : null,
        state: 'abierto',
        created: Date.now(),
      });
      return json({ ok: true });
    }

    if (!owner) throw new Error('403');
    if (body.action === 'create-client') {
      if (!accountOwner) throw new Error('403');
      if (
        typeof body.name !== 'string' ||
        !body.name.trim() ||
        body.name.trim().length > 120 ||
        (body.email !== undefined &&
          (typeof body.email !== 'string' || body.email.trim().length > 200))
      ) {
        throw new Error('400');
      }
      const email =
        typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('400');
      }
      const created = {
        id: crypto.randomUUID(),
        owner: identity.userId,
        name: body.name.trim(),
        email,
        created: Date.now(),
      };
      await database.insert(studioClients).values(created);
      return json(
        {
          client: {
            id: created.id,
            name: created.name,
            email: created.email,
          },
        },
        201,
      );
    } else if (body.action === 'create-project') {
      if (!accountOwner) throw new Error('403');
      if (
        typeof body.name !== 'string' ||
        !body.name.trim() ||
        body.name.trim().length > 120 ||
        (body.client !== undefined &&
          body.client !== null &&
          typeof body.client !== 'string')
      ) {
        throw new Error('400');
      }
      const clientId =
        typeof body.client === 'string' && body.client ? body.client : null;
      if (clientId) {
        const [client] = await database
          .select({ id: studioClients.id })
          .from(studioClients)
          .where(
            and(
              eq(studioClients.id, clientId),
              eq(studioClients.owner, identity.userId),
            ),
          )
          .limit(1);
        if (!client) throw new Error('400');
      }
      const created = {
        id: crypto.randomUUID(),
        owner: identity.userId,
        client: clientId,
        share: crypto.randomUUID(),
        shareEnabled: 1,
        shareExpires: Date.now() + 30 * 86400_000,
        name: body.name.trim(),
        created: Date.now(),
      };
      await database.insert(studioProjects).values(created);
      return json(
        {
          project: {
            id: created.id,
            name: created.name,
            client: created.client,
          },
        },
        201,
      );
    } else if (body.action === 'share') {
      const days = Number(body.days);
      if (![7, 30, 90].includes(days)) throw new Error('400');
      const token = randomToken();
      const expires = Date.now() + days * 86400_000;
      await database
        .update(studioProjects)
        .set({ share: token, shareEnabled: 1, shareExpires: expires })
        .where(eq(studioProjects.id, project.id));
      return json({ share: token, shareEnabled: true, shareExpires: expires });
    } else if (body.action === 'revoke-share') {
      await database
        .update(studioProjects)
        .set({
          share: randomToken(),
          shareEnabled: 0,
          shareExpires: Date.now(),
        })
        .where(eq(studioProjects.id, project.id));
      return json({ share: '', shareEnabled: false, shareExpires: 0 });
    } else if (body.action === 'resolve') {
      if (typeof body.id !== 'string' || !body.id) throw new Error('400');
      await database
        .update(studioComments)
        .set({ state: 'resuelto' })
        .where(
          and(
            eq(studioComments.project, project.id),
            eq(studioComments.id, body.id),
          ),
        );
    } else if (body.action === 'begin') {
      if (
        typeof body.name !== 'string' ||
        !body.name ||
        body.name.length > 500 ||
        typeof body.size !== 'number' ||
        !Number.isSafeInteger(body.size) ||
        body.size <= 0
      ) {
        throw new Error('400');
      }
      if (body.size > MAX_FILE) throw new Error('413');
      const id = crypto.randomUUID();
      const key = `${project.id}/${id}`;
      const upload = await env.FILES.createMultipartUpload(key);
      await database.insert(studioUploads).values({
        id,
        project: project.id,
        key,
        uploadId: upload.uploadId,
        name: body.name,
        size: body.size,
      });
      return json({ id, partSize: PART });
    } else if (body.action === 'finish' || body.action === 'abort') {
      const [upload] = await database
        .select()
        .from(studioUploads)
        .where(
          and(
            eq(studioUploads.id, typeof body.id === 'string' ? body.id : ''),
            eq(studioUploads.project, project.id),
            eq(studioUploads.completed, 0),
          ),
        )
        .limit(1);
      if (!upload) throw new Error('404');
      const multipart = env.FILES.resumeMultipartUpload(
        upload.key,
        upload.uploadId,
      );
      if (body.action === 'abort') {
        await multipart.abort();
        await database
          .delete(studioUploads)
          .where(eq(studioUploads.id, upload.id));
      } else {
        if (
          !Array.isArray(body.parts) ||
          body.parts.length !== Math.ceil(upload.size / PART) ||
          !body.parts.every((part: unknown, index: number) => {
            if (!part || typeof part !== 'object') return false;
            const candidate = part as { partNumber?: unknown; etag?: unknown };
            return (
              candidate.partNumber === index + 1 &&
              typeof candidate.etag === 'string'
            );
          })
        ) {
          throw new Error('400');
        }
        const object = await multipart.complete(
          body.parts as { partNumber: number; etag: string }[],
        );
        if (object.size !== upload.size) {
          await env.FILES.delete(upload.key);
          throw new Error('400');
        }
        await database
          .update(studioUploads)
          .set({ completed: 1 })
          .where(eq(studioUploads.id, upload.id));
        return json({ key: upload.key, name: upload.name, size: upload.size });
      }
    } else if (body.action === 'version') {
      if (
        !Array.isArray(body.files) ||
        body.files.length < 1 ||
        body.files.length > 200 ||
        !body.files.every((key: unknown) => typeof key === 'string') ||
        typeof body.name !== 'string' ||
        !body.name.trim() ||
        body.name.length > 150 ||
        !['auto', 'x', 'y', 'z'].includes(String(body.upAxis || 'auto'))
      ) {
        throw new Error('400');
      }
      const files = [];
      for (const key of body.files as string[]) {
        const [upload] = await database
          .select({
            key: studioUploads.key,
            name: studioUploads.name,
            size: studioUploads.size,
          })
          .from(studioUploads)
          .where(
            and(
              eq(studioUploads.key, key),
              eq(studioUploads.project, project.id),
              eq(studioUploads.completed, 1),
            ),
          )
          .limit(1);
        if (!upload) throw new Error('400');
        files.push(upload);
      }
      const [{ nextSequence }] = await database
        .select({ nextSequence: max(studioVersions.sequence) })
        .from(studioVersions)
        .where(eq(studioVersions.project, project.id));
      const id = crypto.randomUUID();
      await database.insert(studioVersions).values({
        id,
        project: project.id,
        name: body.name.trim(),
        description: '',
        sequence: (nextSequence || 0) + 1,
        sourceVersion: null,
        modelKind: 'files',
        files: JSON.stringify(files),
        views: '[]',
        settings: JSON.stringify({
          hiddenObjects: [],
          palette: 'warm',
          upAxis: body.upAxis || 'auto',
        }),
        unit: 'm',
        published: 0,
        created: Date.now(),
      });
      return json({ id });
    } else if (body.action === 'create-version') {
      if (
        typeof body.name !== 'string' ||
        !body.name.trim() ||
        body.name.trim().length > 150 ||
        (body.description !== undefined &&
          (typeof body.description !== 'string' ||
            body.description.trim().length > 1000)) ||
        typeof body.sourceVersion !== 'string'
      ) {
        throw new Error('400');
      }
      const [source] = await database
        .select()
        .from(studioVersions)
        .where(
          and(
            eq(studioVersions.id, body.sourceVersion),
            eq(studioVersions.project, project.id),
          ),
        )
        .limit(1);
      if (!source) throw new Error('404');
      const [{ lastSequence }] = await database
        .select({ lastSequence: max(studioVersions.sequence) })
        .from(studioVersions)
        .where(eq(studioVersions.project, project.id));
      const id = crypto.randomUUID();
      await database.insert(studioVersions).values({
        id,
        project: project.id,
        name: body.name.trim(),
        description:
          typeof body.description === 'string' ? body.description.trim() : '',
        sequence: (lastSequence || 0) + 1,
        sourceVersion: source.id,
        modelKind: source.modelKind,
        files: source.files,
        views: source.views,
        settings: source.settings,
        unit: source.unit,
        published: 0,
        created: Date.now(),
      });
      return json({ id }, 201);
    } else if (body.action === 'view') {
      if (
        typeof body.version !== 'string' ||
        typeof body.name !== 'string' ||
        !body.name.trim() ||
        body.name.trim().length > 80 ||
        !Array.isArray(body.position) ||
        !Array.isArray(body.target) ||
        body.position.length !== 3 ||
        body.target.length !== 3 ||
        [...body.position, ...body.target].some(
          (number: unknown) =>
            typeof number !== 'number' || !Number.isFinite(number),
        )
      ) {
        throw new Error('400');
      }
      const [stored] = await database
        .select({ views: studioVersions.views })
        .from(studioVersions)
        .where(
          and(
            eq(studioVersions.id, body.version),
            eq(studioVersions.project, project.id),
          ),
        )
        .limit(1);
      if (!stored) throw new Error('404');
      const current = JSON.parse(stored.views) as unknown[];
      if (!Array.isArray(current) || current.length >= 20)
        throw new Error('400');
      current.push({
        id: crypto.randomUUID(),
        name: body.name.trim(),
        position: body.position,
        target: body.target,
      });
      await database
        .update(studioVersions)
        .set({ views: JSON.stringify(current) })
        .where(eq(studioVersions.id, body.version));
      return json({ ok: true });
    } else if (body.action === 'visibility') {
      if (
        typeof body.version !== 'string' ||
        !Array.isArray(body.hiddenObjects) ||
        body.hiddenObjects.length > 500 ||
        !body.hiddenObjects.every(
          (item: unknown) => typeof item === 'string' && item.length <= 500,
        )
      ) {
        throw new Error('400');
      }
      const [stored] = await database
        .select({ settings: studioVersions.settings })
        .from(studioVersions)
        .where(
          and(
            eq(studioVersions.id, body.version),
            eq(studioVersions.project, project.id),
          ),
        )
        .limit(1);
      if (!stored) throw new Error('404');
      let settings: Record<string, unknown> = {};
      try {
        settings = JSON.parse(stored.settings) as Record<string, unknown>;
      } catch {}
      settings.hiddenObjects = Array.from(
        new Set(body.hiddenObjects as string[]),
      );
      await database
        .update(studioVersions)
        .set({ settings: JSON.stringify(settings) })
        .where(eq(studioVersions.id, body.version));
    } else if (body.action === 'measurement') {
      const points = [body.startPoint, body.endPoint];
      if (
        typeof body.version !== 'string' ||
        typeof body.name !== 'string' ||
        !body.name.trim() ||
        body.name.trim().length > 100 ||
        !points.every(
          (point) =>
            Array.isArray(point) &&
            point.length === 3 &&
            point.every(
              (number: unknown) =>
                typeof number === 'number' && Number.isFinite(number),
            ),
        ) ||
        !['m', 'cm', 'mm'].includes(String(body.unit))
      ) {
        throw new Error('400');
      }
      const [start, end] = points as [number[], number[]];
      const value = Math.hypot(
        end[0] - start[0],
        end[1] - start[1],
        end[2] - start[2],
      );
      if (value <= 0 || value > 1_000_000) throw new Error('400');
      const [version] = await database
        .select({ id: studioVersions.id })
        .from(studioVersions)
        .where(
          and(
            eq(studioVersions.id, body.version),
            eq(studioVersions.project, project.id),
          ),
        )
        .limit(1);
      if (!version) throw new Error('404');
      const id = crypto.randomUUID();
      await database.insert(studioMeasurements).values({
        id,
        project: project.id,
        version: version.id,
        name: body.name.trim(),
        startPoint: JSON.stringify(body.startPoint),
        endPoint: JSON.stringify(body.endPoint),
        value,
        unit: String(body.unit),
        createdBy: identity.displayName,
        created: Date.now(),
      });
      return json({ id }, 201);
    } else if (body.action === 'plan') {
      if (
        typeof body.version !== 'string' ||
        typeof body.name !== 'string' ||
        !body.name.trim() ||
        body.name.trim().length > 150 ||
        typeof body.key !== 'string' ||
        typeof body.size !== 'number' ||
        typeof body.mime !== 'string' ||
        !['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(
          body.mime,
        ) ||
        (body.sheet !== undefined &&
          (typeof body.sheet !== 'string' || body.sheet.trim().length > 40))
      ) {
        throw new Error('400');
      }
      const [version] = await database
        .select({ id: studioVersions.id })
        .from(studioVersions)
        .where(
          and(
            eq(studioVersions.id, body.version),
            eq(studioVersions.project, project.id),
          ),
        )
        .limit(1);
      const [upload] = await database
        .select()
        .from(studioUploads)
        .where(
          and(
            eq(studioUploads.key, body.key),
            eq(studioUploads.project, project.id),
            eq(studioUploads.completed, 1),
          ),
        )
        .limit(1);
      if (!version || !upload || upload.size !== body.size) {
        throw new Error('400');
      }
      const id = crypto.randomUUID();
      await database.insert(studioPlans).values({
        id,
        project: project.id,
        version: version.id,
        name: body.name.trim(),
        sheet: typeof body.sheet === 'string' ? body.sheet.trim() : '',
        mime: body.mime,
        key: upload.key,
        size: upload.size,
        createdBy: identity.displayName,
        created: Date.now(),
      });
      return json({ id }, 201);
    } else if (body.action === 'delete-version') {
      if (typeof body.id !== 'string' || !body.id) throw new Error('400');
      const [version] = await database.select({ id: studioVersions.id })
        .from(studioVersions)
        .where(and(eq(studioVersions.id, body.id), eq(studioVersions.project, project.id)))
        .limit(1);
      if (!version) throw new Error('404');
      // Atomic metadata deletion. Original uploads can be shared by derived
      // versions, so they remain in storage rather than breaking those models.
      await database.batch([
        database.delete(studioComments).where(and(eq(studioComments.project, project.id), eq(studioComments.version, version.id))),
        database.delete(studioMeasurements).where(and(eq(studioMeasurements.project, project.id), eq(studioMeasurements.version, version.id))),
        database.delete(studioPlans).where(and(eq(studioPlans.project, project.id), eq(studioPlans.version, version.id))),
        database.update(studioVersions).set({ sourceVersion: null }).where(and(eq(studioVersions.project, project.id), eq(studioVersions.sourceVersion, version.id))),
        database.delete(studioVersions).where(and(eq(studioVersions.project, project.id), eq(studioVersions.id, version.id))),
      ]);
    } else if (body.action === 'publish') {
      if (typeof body.id !== 'string' || !body.id) throw new Error('400');
      await database
        .update(studioVersions)
        .set({ published: 1 })
        .where(
          and(
            eq(studioVersions.id, body.id),
            eq(studioVersions.project, project.id),
          ),
        );
    } else {
      throw new Error('400');
    }
    return json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(request: Request) {
  try {
    if (
      request.headers.get('origin') &&
      request.headers.get('origin') !== new URL(request.url).origin
    ) {
      throw new Error('403');
    }
    const { project, owner } = await context(request);
    if (!owner) throw new Error('403');
    const database = db();
    const params = new URL(request.url).searchParams;
    const [upload] = await database
      .select()
      .from(studioUploads)
      .where(
        and(
          eq(studioUploads.id, params.get('upload') || ''),
          eq(studioUploads.project, project.id),
          eq(studioUploads.completed, 0),
        ),
      )
      .limit(1);
    const part = Number(params.get('part'));
    if (
      !upload ||
      !Number.isInteger(part) ||
      part < 1 ||
      part > Math.ceil(upload.size / PART)
    ) {
      throw new Error('400');
    }
    const expected = Math.min(PART, upload.size - (part - 1) * PART);
    if (Number(request.headers.get('content-length')) !== expected) {
      throw new Error('400');
    }
    // Each request holds one bounded part, never the complete model.
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength !== expected) throw new Error('400');
    return json(
      await env.FILES.resumeMultipartUpload(
        upload.key,
        upload.uploadId,
      ).uploadPart(part, bytes),
    );
  } catch (error) {
    return failure(error);
  }
}
