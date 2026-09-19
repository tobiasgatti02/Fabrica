import { env } from 'cloudflare:workers';
import { and, eq, gt, inArray, or } from 'drizzle-orm';
import {
  clearSessionCookie,
  cookieValue,
  hashPassword,
  SESSION_COOKIE,
  sha256,
  validRequestOrigin,
} from '@/features/auth/core';
import { getDb } from '@/db';
import {
  studioAssetUploads,
  studioAssets,
  studioClients,
  studioComments,
  studioInspiration,
  studioMeasurements,
  studioPlans,
  studioProjects,
  studioProposalFeedback,
  studioProposalOptions,
  studioProposals,
  studioSessions,
  studioTasks,
  studioTeamMembers,
  studioUploads,
  studioUsers,
  studioVersions,
} from '@/db/schema';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (value: unknown, status = 200, cookie?: string) =>
  Response.json(value, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      Vary: 'Cookie',
      ...(cookie ? { 'Set-Cookie': cookie } : {}),
    },
  });

async function localUser(request: Request) {
  const token = cookieValue(request.headers.get('cookie'), SESSION_COOKIE);
  if (!token) return null;
  const [user] = await getDb(env.DATABASE_URL)
    .select({
      id: studioUsers.id,
      email: studioUsers.email,
      name: studioUsers.name,
      passwordHash: studioUsers.passwordHash,
      googleSubject: studioUsers.googleSubject,
    })
    .from(studioSessions)
    .innerJoin(studioUsers, eq(studioUsers.id, studioSessions.user))
    .where(
      and(
        eq(studioSessions.tokenHash, await sha256(token)),
        // A stale session cannot be used to modify or erase an account.
        // Keeping this predicate here avoids relying on a client-side expiry.
        gt(studioSessions.expires, Date.now()),
      ),
    )
    .limit(1);
  return user || null;
}

function passwordIsValid(value: string) {
  return (
    value.length >= 10 &&
    value.length <= 200 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    [ /\d/.test(value), /[^A-Za-z0-9]/.test(value) ].filter(Boolean).length >= 1
  );
}

async function clearProjectFiles(projectIds: string[]) {
  for (const project of projectIds) {
    let cursor: string | undefined;
    do {
      const listed = await env.FILES.list({ prefix: `${project}/`, cursor });
      if (listed.objects.length) await env.FILES.delete(listed.objects.map((item) => item.key));
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);
  }
}

async function deleteAccount(userId: string) {
  const database = getDb(env.DATABASE_URL);
  const projects = await database
    .select({ id: studioProjects.id })
    .from(studioProjects)
    .where(eq(studioProjects.owner, `fabrica:${userId}`));
  const projectIds = projects.map((project) => project.id);

  // Remove objects first: a failure leaves the account intact instead of
  // claiming that the irreversible deletion completed with files left behind.
  await clearProjectFiles(projectIds);

  if (projectIds.length) {
    const proposals = await database
      .select({ id: studioProposals.id })
      .from(studioProposals)
      .where(inArray(studioProposals.project, projectIds));
    const proposalIds = proposals.map((proposal) => proposal.id);
    const statements = [
      database.delete(studioComments).where(inArray(studioComments.project, projectIds)),
      database.delete(studioMeasurements).where(inArray(studioMeasurements.project, projectIds)),
      database.delete(studioPlans).where(inArray(studioPlans.project, projectIds)),
      database.delete(studioUploads).where(inArray(studioUploads.project, projectIds)),
      database.delete(studioAssetUploads).where(inArray(studioAssetUploads.project, projectIds)),
      database.delete(studioTasks).where(inArray(studioTasks.project, projectIds)),
      database.delete(studioInspiration).where(inArray(studioInspiration.project, projectIds)),
      database.delete(studioTeamMembers).where(inArray(studioTeamMembers.project, projectIds)),
      ...(proposalIds.length
        ? [
            database.delete(studioProposalFeedback).where(inArray(studioProposalFeedback.proposal, proposalIds)),
            database.delete(studioProposalOptions).where(inArray(studioProposalOptions.proposal, proposalIds)),
          ]
        : []),
      database.delete(studioProposals).where(inArray(studioProposals.project, projectIds)),
      database.delete(studioVersions).where(inArray(studioVersions.project, projectIds)),
      database.delete(studioAssets).where(inArray(studioAssets.project, projectIds)),
      database.delete(studioProjects).where(inArray(studioProjects.id, projectIds)),
    ];
    await database.batch(statements);
  }

  // Remove participation in other accounts' work, then the user's own records.
  await database.batch([
    database
      .delete(studioTeamMembers)
      .where(
        or(
          eq(studioTeamMembers.user, `fabrica:${userId}`),
          eq(studioTeamMembers.owner, `fabrica:${userId}`),
        ),
      ),
    database.update(studioClients).set({ account: null }).where(eq(studioClients.account, `fabrica:${userId}`)),
    database.delete(studioClients).where(eq(studioClients.owner, `fabrica:${userId}`)),
    database.delete(studioSessions).where(eq(studioSessions.user, userId)),
    database.delete(studioUsers).where(eq(studioUsers.id, userId)),
  ]);
}

export async function POST(request: Request) {
  if (!validRequestOrigin(request)) return json({ error: 'Solicitud no válida.' }, 403);
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const user = await localUser(request);
    if (!user) return json({ error: 'Iniciá sesión para continuar.' }, 401);
    const action = body.action;
    const database = getDb(env.DATABASE_URL);

    if (action === 'update-profile') {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (name.length < 2 || name.length > 100 || email.length > 254 || !EMAIL_PATTERN.test(email))
        return json({ error: 'Revisá el nombre y el email.' }, 400);
      const [existing] = await database.select({ id: studioUsers.id }).from(studioUsers).where(eq(studioUsers.email, email)).limit(1);
      if (existing && existing.id !== user.id) return json({ error: 'Ese email ya está en uso.' }, 409);
      await database.batch([
        database
          .update(studioUsers)
          .set({ name, email })
          .where(eq(studioUsers.id, user.id)),
        // A linked client account is matched by email when opening a private
        // review link, so keep that contact record in sync as well.
        database
          .update(studioClients)
          .set({ email })
          .where(eq(studioClients.account, `fabrica:${user.id}`)),
      ]);
      return json({ ok: true, name, email });
    }

    if (action === 'update-password') {
      if (user.googleSubject || !user.passwordHash)
        return json({ error: 'La contraseña se administra desde Google.' }, 403);
      const password = typeof body.password === 'string' ? body.password : '';
      if (!passwordIsValid(password))
        return json({ error: 'Usá al menos 10 caracteres, mayúsculas, minúsculas y un número o símbolo.' }, 400);
      await database.update(studioUsers).set({ passwordHash: await hashPassword(password) }).where(eq(studioUsers.id, user.id));
      return json({ ok: true });
    }

    if (action === 'delete-account') {
      if (body.confirmation !== 'ELIMINAR') return json({ error: 'Escribí ELIMINAR para confirmar.' }, 400);
      await deleteAccount(user.id);
      return json({ ok: true }, 200, clearSessionCookie(request));
    }

    return json({ error: 'Acción no válida.' }, 400);
  } catch (error) {
    console.error('Account request failed', error);
    return json({ error: 'No pudimos actualizar la cuenta. Intentá nuevamente.' }, 503);
  }
}
