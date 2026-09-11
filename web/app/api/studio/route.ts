import { env } from 'cloudflare:workers';
import { and, asc, eq, inArray, or } from 'drizzle-orm';
import { getFabricaUser } from '@/app/fabrica-auth';
import { getDb } from '@/db';
import {
  studioComments,
  studioProjects,
  studioUploads,
  studioVersions,
} from '@/db/schema';

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
};
const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });

function db() {
  return getDb(env.DATABASE_URL);
}

async function context(request: Request) {
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

  const database = db();
  const share = new URL(request.url).searchParams.get('share');
  if (share) {
    const [project] = await database
      .select()
      .from(studioProjects)
      .where(eq(studioProjects.share, share))
      .limit(1);
    if (!project) throw new Error('404');
    return { project, projects: [], identity, owner: false };
  }

  let projects = await database
    .select()
    .from(studioProjects)
    .where(eq(studioProjects.owner, identity.userId))
    .orderBy(asc(studioProjects.created));
  if (!projects.length) {
    await database.insert(studioProjects).values({
      id: crypto.randomUUID(),
      owner: identity.userId,
      share: crypto.randomUUID(),
      name: 'Casa Patio',
      created: Date.now(),
    });
    projects = await database
      .select()
      .from(studioProjects)
      .where(eq(studioProjects.owner, identity.userId))
      .orderBy(asc(studioProjects.created));
  }
  const requestedProject = new URL(request.url).searchParams.get('project');
  const project = requestedProject
    ? projects.find((item) => item.id === requestedProject)
    : projects[0];
  if (!project) throw new Error(requestedProject ? '404' : '503');
  return { project, projects, identity, owner: true };
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
    const { project, projects, owner } = await context(request);
    const database = db();
    const params = new URL(request.url).searchParams;
    const asset = params.get('asset');
    if (asset) {
      const versions = await database
        .select({ files: studioVersions.files })
        .from(studioVersions)
        .where(
          owner
            ? eq(studioVersions.project, project.id)
            : and(
                eq(studioVersions.project, project.id),
                eq(studioVersions.published, 1),
              ),
        );
      if (
        !versions.some((version) =>
          (JSON.parse(version.files) as { key: string }[]).some(
            (file) => file.key === asset,
          ),
        )
      ) {
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
      .orderBy(asc(studioVersions.created));
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
                inArray(studioComments.version, ['v02', 'v03']),
                inArray(studioComments.version, publishedVersionIds),
              ),
            ),
      )
      .orderBy(asc(studioComments.created));

    return json({
      versions,
      comments,
      share: owner ? project.share : null,
      owner,
      project: { id: project.id, name: project.name },
      projects: owner ? projects : [],
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
    const { project, owner, identity } = await context(request);
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
      if (scope === 'point' && !['v02', 'v03'].includes(commentVersion)) {
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
      await database.insert(studioComments).values({
        id: crypto.randomUUID(),
        project: project.id,
        version: commentVersion,
        author: identity.displayName,
        text: body.text.trim(),
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
    if (body.action === 'create-project') {
      if (
        typeof body.name !== 'string' ||
        !body.name.trim() ||
        body.name.trim().length > 120
      ) {
        throw new Error('400');
      }
      const created = {
        id: crypto.randomUUID(),
        owner: identity.userId,
        share: crypto.randomUUID(),
        name: body.name.trim(),
        created: Date.now(),
      };
      await database.insert(studioProjects).values(created);
      return json({ project: { id: created.id, name: created.name } }, 201);
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
        body.name.length > 150
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
      const id = crypto.randomUUID();
      await database.insert(studioVersions).values({
        id,
        project: project.id,
        name: body.name.trim(),
        files: JSON.stringify(files),
        views: '[]',
        published: 0,
        created: Date.now(),
      });
      return json({ id });
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
