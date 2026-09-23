import { env } from 'cloudflare:workers';
import { and, eq, gt, lt, ne } from 'drizzle-orm';
import { getDb } from '@/db';
import { studioPresence, studioVersions, studioWorktables } from '@/db/schema';
import { context as studioContext } from '../route';
import { context as workspaceContext } from '../../workspace/route';

const TTL = 12000;
type Point = [number, number, number];
type Viewpoint = { position: Point; target: Point };

function point(value: unknown): Point | null {
  return Array.isArray(value) && value.length === 3 &&
    value.every((part) => typeof part === 'number' && Number.isFinite(part) && Math.abs(part) < 1e7)
    ? value as Point : null;
}

function camera(value: unknown): Viewpoint | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const position = point(candidate.position);
  const target = point(candidate.target);
  return position && target ? { position, target } : null;
}

async function hash(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function room(request: Request) {
  const params = new URL(request.url).searchParams;
  const version = params.get('version') || '';
  if (!version) throw new Error('404');
  const database = getDb(env.DATABASE_URL);
  if (version.startsWith('board:')) {
    const access = await workspaceContext(request);
    if (access.permissions.inspiracion === 'none') throw new Error('403');
    const board = version.slice('board:'.length);
    if (!board || board.length > 100) throw new Error('404');
    if (board !== 'default') {
      const [worktable] = await database.select({ id: studioWorktables.id })
        .from(studioWorktables)
        .where(and(eq(studioWorktables.id, board), eq(studioWorktables.project, access.project.id)))
        .limit(1);
      if (!worktable) throw new Error('404');
    }
    return {
      access: {
        project: access.project,
        identity: { displayName: access.name, provider: access.guest ? 'guest' : 'member' },
        accountOwner: access.accountOwner,
      },
      version,
      database,
    };
  }
  const access = await studioContext(request);
  const [delivery] = await database.select({ published: studioVersions.published })
    .from(studioVersions)
    .where(and(eq(studioVersions.id, version), eq(studioVersions.project, access.project.id)))
    .limit(1);
  if (!delivery || (!access.owner && delivery.published !== 1)) throw new Error('404');
  return { access, version, database };
}

function failure(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  const status = code === '401' ? 401 : code === '403' ? 403 : code === '404' ? 404 : 500;
  return Response.json({ error: 'Acceso a la presencia no disponible.' }, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function listPeers(database: ReturnType<typeof getDb>, project: string, version: string, ownId: string) {
  const now = Date.now();
  const peers = await database.select({
    id: studioPresence.id,
    name: studioPresence.name,
    role: studioPresence.role,
    cursor: studioPresence.cursor,
    camera: studioPresence.camera,
  }).from(studioPresence).where(and(
    eq(studioPresence.project, project),
    eq(studioPresence.version, version),
    gt(studioPresence.expires, now),
    ne(studioPresence.id, ownId),
  )).limit(30);
  return peers.map((peer) => ({
    ...peer,
    cursor: peer.cursor ? JSON.parse(peer.cursor) : null,
    camera: peer.camera ? JSON.parse(peer.camera) : null,
  }));
}

export async function GET(request: Request) {
  try {
    const { access, version, database } = await room(request);
    const ownId = new URL(request.url).searchParams.get('id') || '';
    return Response.json({ peers: await listPeers(database, access.project.id, version, ownId) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const { access, version, database } = await room(request);
    const body = await request.json() as Record<string, unknown>;
    const now = Date.now();
    const cursor = body.cursor === null ? null : point(body.cursor);
    const viewpoint = body.camera === null ? null : camera(body.camera);
    if ((body.cursor != null && !cursor) || (body.camera != null && !viewpoint))
      return Response.json({ error: 'Posición inválida.' }, { status: 400 });

    let id = typeof body.id === 'string' ? body.id : '';
    let secret = typeof body.secret === 'string' ? body.secret : '';
    if (!id && !secret) {
      id = crypto.randomUUID();
      secret = crypto.randomUUID();
      await database.delete(studioPresence).where(lt(studioPresence.expires, now));
      await database.insert(studioPresence).values({
        id,
        secretHash: await hash(secret),
        project: access.project.id,
        version,
        name: (access.identity.provider === 'guest'
          ? `${access.identity.displayName.slice(0, 52)} · ${id.slice(0, 4)}`
          : access.identity.displayName.slice(0, 60)),
        role: access.identity.provider === 'guest' ? 'Cliente' : access.accountOwner ? 'Estudio' : 'Participante',
        cursor: cursor ? JSON.stringify(cursor) : null,
        camera: viewpoint ? JSON.stringify(viewpoint) : null,
        expires: now + TTL,
      });
    } else {
      if (!/^[0-9a-f-]{36}$/.test(id) || !/^[0-9a-f-]{36}$/.test(secret))
        return Response.json({ error: 'Sesión inválida.' }, { status: 403 });
      const updated = await database.update(studioPresence).set({
        cursor: cursor ? JSON.stringify(cursor) : null,
        camera: viewpoint ? JSON.stringify(viewpoint) : null,
        expires: now + TTL,
      }).where(and(
        eq(studioPresence.id, id),
        eq(studioPresence.secretHash, await hash(secret)),
        eq(studioPresence.project, access.project.id),
        eq(studioPresence.version, version),
        gt(studioPresence.expires, now),
      )).returning({ id: studioPresence.id });
      if (!updated.length) return Response.json({ error: 'Sesión vencida.' }, { status: 410 });
    }

    return Response.json({ id, secret, peers: await listPeers(database, access.project.id, version, id) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { access, version, database } = await room(request);
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.id !== 'string' || typeof body.secret !== 'string')
      return Response.json({ error: 'Sesión inválida.' }, { status: 400 });
    await database.delete(studioPresence).where(and(
      eq(studioPresence.id, body.id),
      eq(studioPresence.secretHash, await hash(body.secret)),
      eq(studioPresence.project, access.project.id),
      eq(studioPresence.version, version),
    ));
    return new Response(null, { status: 204 });
  } catch (error) {
    return failure(error);
  }
}
