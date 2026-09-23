import { env } from 'cloudflare:workers';
import { and, asc, eq, gt, inArray, isNull, or } from 'drizzle-orm';
import { randomToken, sha256, validRequestOrigin } from '@/features/auth/core';
import { getFabricaUser } from '@/features/auth/server';
import { getDb } from '@/db';
import { createStarterProject } from '@/features/studio/server/seed';
import { safeReferenceUrl } from '@/features/workspace/inspiration-scene';
import { INSPIRATION_FILE_LIMIT } from '@/features/files/validation';
import { assertBillingAllowance, assertBillingWritable, getBillingStatus } from '@/features/billing/server';
import {
  studioAssets,
  studioAssetUploads,
  studioBudgetItems,
  studioClients,
  studioInspiration,
  studioInspirationComments,
  studioWorktables,
  studioProjects,
  studioProposalFeedback,
  studioProposalOptions,
  studioProposals,
  studioSessions,
  studioTasks,
  studioTeamMembers,
} from '@/db/schema';

const PART_SIZE = 8 * 1024 * 1024;
const MAX_ASSET = 500 * 1024 * 1024;
const stages = [
  'idea',
  'relevamiento',
  'anteproyecto',
  'propuesta',
  'documentacion',
  'obra',
  'finalizado',
];
const categories = [
  'general',
  'espacios',
  'materiales',
  'mobiliario',
  'iluminacion',
  'colores',
];
const taskStates = ['todo', 'doing', 'done'];
const budgetStates = ['estimated', 'quoted', 'approved', 'contracted', 'paid'];
const inspirationStates = ['idea', 'revisar', 'aprobada', 'descartada'];
const proposalStates = ['draft', 'review', 'approved', 'changes'];
const roles = ['architect', 'collaborator', 'viewer', 'external'];
const areaKeys = ['panel', 'inspiracion', 'modelo'] as const;
type AreaKey = (typeof areaKeys)[number];
type AreaPermission = 'none' | 'view' | 'edit';
type AreaPermissions = Record<AreaKey, AreaPermission>;
const allAreaPermissions: AreaPermissions = {
  panel: 'edit',
  inspiracion: 'edit',
  modelo: 'edit',
};
const defaultPermissionsForRole = (role: string): AreaPermissions => ({
  panel: role === 'viewer' || role === 'external' ? 'view' : 'edit',
  inspiracion: role === 'viewer' || role === 'external' ? 'view' : 'edit',
  modelo: role === 'architect' ? 'edit' : 'view',
});
const parsePermissions = (value: unknown, role = 'viewer'): AreaPermissions => {
  const fallback = defaultPermissionsForRole(role);
  if (typeof value !== 'string') return fallback;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return Object.fromEntries(
      areaKeys.map((key) => [
        key,
        parsed[key] === 'edit' ||
        parsed[key] === 'view' ||
        parsed[key] === 'none'
          ? parsed[key]
          : fallback[key],
      ]),
    ) as AreaPermissions;
  } catch {
    return fallback;
  }
};
const permissionRank = (value: AreaPermission) =>
  value === 'edit' ? 2 : value === 'view' ? 1 : 0;
const combinePermissions = (
  memberships: { permissions: unknown; role: string }[],
) =>
  Object.fromEntries(
    areaKeys.map((key) => [
      key,
      memberships.reduce<AreaPermission>((best, membership) => {
        const current = parsePermissions(
          membership.permissions,
          membership.role,
        )[key];
        return permissionRank(current) > permissionRank(best) ? current : best;
      }, 'none'),
    ]),
  ) as AreaPermissions;

const database = () => getDb(env.DATABASE_URL);
const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
const string = (value: unknown, max = 300) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';
const required = (value: unknown, max = 200) => {
  const result = string(value, max);
  if (!result) throw new Error('400');
  return result;
};
const choice = (value: unknown, options: string[]) => {
  if (typeof value !== 'string' || !options.includes(value))
    throw new Error('400');
  return value;
};
const date = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(value))
  )
    throw new Error('400');
  return value;
};
const money = (value: unknown) => {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0 || result > 9_000_000_000_000)
    throw new Error('400');
  return result;
};
const url = (value: unknown) => {
  const raw = string(value, 2000);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error();
    return parsed.toString();
  } catch {
    throw new Error('400');
  }
};
function fail(error: unknown) {
  const billingError = (error as Error).message;
  if (billingError === 'billing_read_only')
    return json({ error: 'Tu plan está en modo lectura. Cambiá de plan para continuar.' }, 403);
  if (billingError.startsWith('billing_limit_'))
    return json({ error: 'Alcanzaste el límite de tu plan. Cambiá de plan para continuar.' }, 409);
  if (billingError === 'billing_feature_team_permissions')
    return json({ error: 'Los permisos personalizados están disponibles en Estudio y Equipo.' }, 403);
  if ((error as Error).message === 'INSPIRATION_FILE_LIMIT')
    return json(
      { error: 'Cada archivo de la mesa de trabajo puede pesar hasta 20 MB.' },
      413,
    );
  const code = Number((error as Error).message);
  if ([400, 401, 403, 404, 409, 413].includes(code)) {
    return json(
      {
        error: (
          {
            400: 'Revisá los datos ingresados.',
            401: 'Iniciá sesión para continuar.',
            403: 'No tenés permiso para esta acción.',
            404: 'No se encontró el contenido.',
            409: 'Este enlace ya se usó o venció.',
            413: 'El archivo supera el límite de 500 MB.',
          } as Record<number, string>
        )[code],
      },
      code,
    );
  }
  console.error('Workspace request failed', error);
  return json(
    { error: 'No pudimos completar la operación. Intentá nuevamente.' },
    503,
  );
}

export async function context(request: Request) {
  const db = database();
  const params = new URL(request.url).searchParams;
  const share = params.get('share');
  if (share) {
    const [project] = await db
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
    const [client] = project.client
      ? await db
          .select({ name: studioClients.name })
          .from(studioClients)
          .where(eq(studioClients.id, project.client))
          .limit(1)
      : [];
    return {
      project,
      projects: [project],
      accountOwner: false,
      canEdit: false,
      permissions: { panel: 'view', inspiracion: 'view', modelo: 'view' },
      guest: true,
      userId: '',
      name: client?.name || 'Cliente invitado',
      role: 'client',
      external: false,
    };
  }
  const inviteToken = params.get('invite');
  if (inviteToken) {
    const [member] = await db
      .select()
      .from(studioTeamMembers)
      .where(eq(studioTeamMembers.inviteHash, await sha256(inviteToken)))
      .limit(1);
    if (
      !member ||
      member.role !== 'external' ||
      member.inviteExpires < Date.now()
    )
      throw new Error('401');
    const allProjects = await db
      .select()
      .from(studioProjects)
      .where(eq(studioProjects.owner, member.owner))
      .orderBy(asc(studioProjects.created));
    const projects = member.project
      ? allProjects.filter((item) => item.id === member.project)
      : allProjects;
    const requestedProject = params.get('project');
    const project =
      projects.find((item) => item.id === requestedProject) ||
      (requestedProject ? null : projects[0]);
    if (!project) throw new Error('404');
    if (!member.accepted) {
      await db
        .update(studioTeamMembers)
        .set({ accepted: Date.now() })
        .where(
          and(
            eq(studioTeamMembers.id, member.id),
            isNull(studioTeamMembers.accepted),
          ),
        );
    }
    return {
      project,
      projects,
      accountOwner: false,
      canEdit: Object.values(
        parsePermissions(member.permissions, member.role),
      ).some((permission) => permission === 'edit'),
      permissions: parsePermissions(member.permissions, member.role),
      guest: false,
      external: true,
      userId: '',
      name: member.email,
      role: 'external',
    };
  }
  const authenticated = await getFabricaUser(request);
  const user =
    authenticated ||
    (import.meta.env.DEV
      ? {
          userId: 'local-preview',
          displayName: 'Estudio local',
          email: 'local-preview@example.invalid',
        }
      : null);
  if (!user) throw new Error('401');
  const requestedProject = params.get('project');
  let projects = await db
    .select()
    .from(studioProjects)
    .where(eq(studioProjects.owner, user.userId))
    .orderBy(asc(studioProjects.created));
  let role = 'owner';
  let teamMemberships: {
    project: string | null;
    role: string;
    permissions: string;
  }[] = [];
  let permissions: AreaPermissions = allAreaPermissions;
  if (
    !projects.length ||
    (requestedProject && !projects.some((item) => item.id === requestedProject))
  ) {
    const memberships = await db
      .select()
      .from(studioTeamMembers)
      .where(eq(studioTeamMembers.user, user.userId));
    if (memberships.length) {
      const [requested] = requestedProject
        ? await db
            .select({ owner: studioProjects.owner })
            .from(studioProjects)
            .where(eq(studioProjects.id, requestedProject))
            .limit(1)
        : [];
      const owner = requested?.owner || memberships[0].owner;
      const accepted = memberships.filter(
        (item) => item.owner === owner && item.accepted,
      );
      if (accepted.length) {
        teamMemberships = accepted;
        permissions = combinePermissions(accepted);
        const all = accepted.some((item) => !item.project);
        projects = await db
          .select()
          .from(studioProjects)
          .where(eq(studioProjects.owner, owner))
          .orderBy(asc(studioProjects.created));
        if (!all)
          projects = projects.filter((item) =>
            accepted.some((membership) => membership.project === item.id),
          );
        role = 'viewer';
      }
    }
  }
  if (!projects.length && role === 'owner') {
    const linked = await db
      .select({ id: studioClients.id })
      .from(studioClients)
      .where(eq(studioClients.account, user.userId))
      .limit(1);
    if (!linked.length) {
      await createStarterProject(db, user.userId);
      projects = await db
        .select()
        .from(studioProjects)
        .where(eq(studioProjects.owner, user.userId))
        .orderBy(asc(studioProjects.created));
    }
  }
  if (!projects.length) throw new Error('404');
  const project =
    projects.find((item) => item.id === requestedProject) ||
    (requestedProject ? null : projects[0]);
  if (!project) throw new Error('404');
  if (project.owner !== user.userId) {
    const applicable = teamMemberships.filter(
      (item) => !item.project || item.project === project.id,
    );
    role = applicable.some((item) => item.role === 'architect')
      ? 'architect'
      : applicable.some((item) => item.role === 'collaborator')
        ? 'collaborator'
        : 'viewer';
    permissions = combinePermissions(applicable);
  }
  return {
    project,
    projects,
    accountOwner: project.owner === user.userId,
    canEdit: Object.values(permissions).some((value) => value === 'edit'),
    permissions,
    guest: false,
    external: false,
    userId: user.userId,
    name: user.displayName,
    role,
  };
}

export async function GET(request: Request) {
  try {
    const ctx = await context(request);
    const db = database();
    const params = new URL(request.url).searchParams;
    if (params.has('asset')) {
      if (ctx.permissions.inspiracion === 'none') throw new Error('403');
      const [asset] = await db
        .select()
        .from(studioAssets)
        .where(
          and(
            eq(studioAssets.id, params.get('asset') || ''),
            eq(studioAssets.project, ctx.project.id),
          ),
        )
        .limit(1);
      if (!asset) throw new Error('404');
      if (ctx.guest) {
        const [reference] = await db
          .select({ id: studioInspiration.id })
          .from(studioInspiration)
          .where(eq(studioInspiration.asset, asset.id))
          .limit(1);
        const [option] = await db
          .select({ id: studioProposalOptions.id })
          .from(studioProposalOptions)
          .innerJoin(
            studioProposals,
            eq(studioProposalOptions.proposal, studioProposals.id),
          )
          .where(
            and(
              or(
                eq(studioProposalOptions.asset, asset.id),
                eq(studioProposalOptions.previewAsset, asset.id),
              ),
              inArray(studioProposals.status, [
                'review',
                'approved',
                'changes',
              ]),
            ),
          )
          .limit(1);
        if (!reference && !option) throw new Error('403');
      }
      const file = await env.FILES.get(asset.key);
      if (!file) throw new Error('404');
      const image = /^image\/(jpeg|png|webp|avif)$/.test(asset.mime);
      return new Response(file.body, {
        headers: {
          'Content-Type': image ? asset.mime : 'application/octet-stream',
          'Content-Disposition': `${image ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(asset.name)}`,
          'Content-Length': String(file.size),
          // Membership can be revoked at any moment. Keeping protected bytes in
          // the browser cache would let a removed member reopen them until the
          // cache entry expires, even though every new request is denied.
          'Cache-Control': 'private, no-store, max-age=0',
          Pragma: 'no-cache',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }
    const projectIds = ctx.projects.map((item) => item.id);
    const clientIds = ctx.projects
      .map((item) => item.client)
      .filter((id): id is string => Boolean(id));
    const view = params.get('view') || 'panel';
    if (!['panel', 'inspiracion', 'equipo'].includes(view))
      throw new Error('400');
    if (
      !ctx.guest &&
      view !== 'equipo' &&
      ctx.permissions[view as AreaKey] === 'none'
    )
      throw new Error('403');
    if (ctx.external && view === 'equipo') throw new Error('403');
    const panel = view === 'panel';
    const inspirationView = view === 'inspiracion';
    const proposalsView = view === 'propuestas';
    const teamView = view === 'equipo';
    const [
      tasks,
      inspiration,
      inspirationComments,
      worktables,
      allProposals,
      allOptions,
      allFeedback,
      assets,
      members,
      clients,
      budgetItems,
    ] = await Promise.all([
      panel
        ? db
            .select()
            .from(studioTasks)
            .where(inArray(studioTasks.project, projectIds))
            .orderBy(asc(studioTasks.created))
        : Promise.resolve([]),
      inspirationView
        ? db
            .select()
            .from(studioInspiration)
            .where(eq(studioInspiration.project, ctx.project.id))
            .orderBy(asc(studioInspiration.created))
        : Promise.resolve([]),
      inspirationView
        ? db
            .select()
            .from(studioInspirationComments)
            .where(eq(studioInspirationComments.project, ctx.project.id))
            .orderBy(asc(studioInspirationComments.created))
        : Promise.resolve([]),
      inspirationView
        ? db
            .select()
            .from(studioWorktables)
            .where(eq(studioWorktables.project, ctx.project.id))
            .orderBy(asc(studioWorktables.created))
        : Promise.resolve([]),
      proposalsView
        ? db
            .select()
            .from(studioProposals)
            .where(eq(studioProposals.project, ctx.project.id))
            .orderBy(asc(studioProposals.created))
        : Promise.resolve([]),
      proposalsView
        ? db
            .select()
            .from(studioProposalOptions)
            .innerJoin(
              studioProposals,
              eq(studioProposalOptions.proposal, studioProposals.id),
            )
            .where(eq(studioProposals.project, ctx.project.id))
        : Promise.resolve([]),
      proposalsView
        ? db
            .select()
            .from(studioProposalFeedback)
            .innerJoin(
              studioProposals,
              eq(studioProposalFeedback.proposal, studioProposals.id),
            )
            .where(eq(studioProposals.project, ctx.project.id))
        : Promise.resolve([]),
      inspirationView || proposalsView
        ? db
            .select()
            .from(studioAssets)
            .where(eq(studioAssets.project, ctx.project.id))
        : Promise.resolve([]),
      !ctx.guest && !ctx.external && (panel || teamView)
        ? db
            .select()
            .from(studioTeamMembers)
            .where(eq(studioTeamMembers.owner, ctx.project.owner))
            .orderBy(asc(studioTeamMembers.created))
        : Promise.resolve([]),
      // El selector global del encabezado agrupa proyectos por cliente. Debe
      // recibir la misma cartera sin importar en qué área del estudio estemos.
      !ctx.guest && !ctx.external && (ctx.accountOwner || clientIds.length > 0)
        ? db
            .select()
            .from(studioClients)
            .where(
              ctx.accountOwner
                ? eq(studioClients.owner, ctx.project.owner)
                : and(
                    eq(studioClients.owner, ctx.project.owner),
                    inArray(studioClients.id, clientIds),
                  ),
            )
        : Promise.resolve([]),
      panel
        ? db
            .select()
            .from(studioBudgetItems)
            .where(
              ctx.guest
                ? and(
                    eq(studioBudgetItems.project, ctx.project.id),
                    eq(studioBudgetItems.clientVisible, 1),
                  )
                : eq(studioBudgetItems.project, ctx.project.id),
            )
            .orderBy(asc(studioBudgetItems.created))
        : Promise.resolve([]),
    ]);
    const visibleProposals = ctx.guest
      ? allProposals.filter((item) => item.status !== 'draft')
      : allProposals;
    const visibleIds = new Set(visibleProposals.map((item) => item.id));
    const options = allOptions
      .map((row) => row.studio_proposal_options)
      .filter((item) => visibleIds.has(item.proposal));
    const visibleAssetIds = new Set([
      ...inspiration.map((item) => item.asset),
      ...options.map((item) => item.asset),
      ...options.map((item) => item.previewAsset),
    ]);
    const projectStats: Record<string, { total: number; done: number }> =
      Object.fromEntries(projectIds.map((id) => [id, { total: 0, done: 0 }]));
    for (const task of tasks) {
      if (ctx.guest && task.clientVisible !== 1) continue;
      projectStats[task.project].total++;
      if (task.status === 'done') projectStats[task.project].done++;
    }
    return json({
      viewer: {
        name: ctx.name,
        role: ctx.role,
        guest: ctx.guest,
        canEdit: ctx.canEdit,
        accountOwner: ctx.accountOwner,
        permissions: ctx.permissions,
        external: ctx.external,
      },
      project: ctx.accountOwner
        ? ctx.project
        : { ...ctx.project, share: undefined },
      projects: ctx.projects.map((item) => ({ ...item, share: undefined })),
      tasks: ctx.guest
        ? tasks
            .filter(
              (item) =>
                item.project === ctx.project.id && item.clientVisible === 1,
            )
            .map(({ assignee: _assignee, ...item }) => ({
              ...item,
              assignee: null,
            }))
        : tasks,
      budgetItems,
      projectStats,
      inspiration,
      worktables,
      inspirationComments,
      proposals: visibleProposals,
      options,
      feedback: allFeedback
        .map((row) => row.studio_proposal_feedback)
        .filter((item) => visibleIds.has(item.proposal)),
      assets: assets
        .filter((item) => !ctx.guest || visibleAssetIds.has(item.id))
        .map(({ key: _key, ...item }) => item),
      members: members
        .filter(
          (item) =>
            ctx.accountOwner ||
            !item.project ||
            projectIds.includes(item.project),
        )
        .map(({ inviteHash: _hash, permissions: rawPermissions, ...item }) => ({
          ...item,
          permissions: parsePermissions(rawPermissions, item.role),
        })),
      clients: clients.map((item) => ({
        id: item.id,
        name: item.name,
        email: item.email,
      })),
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!validRequestOrigin(request)) throw new Error('403');
    if (Number(request.headers.get('content-length') || 0) > 1024 * 1024)
      throw new Error('413');
    const body = (await request.json()) as Record<string, unknown>;
    const db = database();
    if (body.action === 'accept-invite') {
      const token = required(body.token, 200);
      const [invite] = await db
        .select()
        .from(studioTeamMembers)
        .where(eq(studioTeamMembers.inviteHash, await sha256(token)))
        .limit(1);
      if (!invite || invite.inviteExpires < Date.now()) throw new Error('409');
      if (invite.role === 'external') {
        const [firstProject] = await db
          .select({ id: studioProjects.id })
          .from(studioProjects)
          .where(eq(studioProjects.owner, invite.owner))
          .orderBy(asc(studioProjects.created))
          .limit(1);
        return json({
          ok: true,
          external: true,
          project: invite.project || firstProject?.id,
        });
      }
      const user = await getFabricaUser(request);
      if (!user) throw new Error('401');
      if (invite.accepted) throw new Error('409');
      if (invite.email.toLowerCase() !== user.email.toLowerCase())
        throw new Error('403');
      await assertBillingAllowance(db, invite.owner, 'professionals');
      await db
        .update(studioTeamMembers)
        .set({
          user: user.userId,
          name: user.displayName,
          accepted: Date.now(),
        })
        .where(
          and(
            eq(studioTeamMembers.id, invite.id),
            isNull(studioTeamMembers.accepted),
          ),
        );
      const [firstProject] = await db
        .select({ id: studioProjects.id })
        .from(studioProjects)
        .where(eq(studioProjects.owner, invite.owner))
        .orderBy(asc(studioProjects.created))
        .limit(1);
      return json({ ok: true, project: invite.project || firstProject?.id });
    }
    const ctx = await context(request);
    const project = ctx.project;
    const action = string(body.action);
    await assertBillingWritable(db, project.owner);
    const actionArea: Record<string, AreaKey> = {
      'update-project': 'panel',
      'save-task': 'panel',
      'delete-task': 'panel',
      'save-budget-item': 'panel',
      'delete-budget-item': 'panel',
      'add-inspiration': 'inspiracion',
      'create-worktable': 'inspiracion',
      'add-inspiration-comment': 'inspiracion',
      'update-inspiration': 'inspiracion',
      'replace-inspiration-image': 'inspiracion',
      'edit-inspiration': 'inspiracion',
      'delete-inspiration': 'inspiracion',
      'delete-asset': 'inspiracion',
      'begin-asset': 'inspiracion',
      'finish-asset': 'inspiracion',
      'abort-asset': 'inspiracion',
    };
    const requestedArea = actionArea[action];
    if (requestedArea && ctx.permissions[requestedArea] !== 'edit')
      throw new Error('403');
    if (
      ctx.external &&
      [
        'proposal-feedback',
        'create-proposal',
        'add-option',
        'set-proposal-status',
        'delete-proposal',
      ].includes(action)
    )
      throw new Error('403');
    if (action === 'create-worktable') {
      const id = crypto.randomUUID();
      await db.insert(studioWorktables).values({
        id,
        project: project.id,
        title: required(body.title, 100),
        template: choice(body.template, [
          'blank',
          'facade',
          'interior',
          'inspiration',
          'renders',
          'plans',
        ]),
        created: Date.now(),
      });
      return json({ ok: true, id }, 201);
    }
    if (action === 'add-inspiration') {
      const worktable = string(body.worktable);
      if (worktable) {
        const [board] = await db
          .select({ id: studioWorktables.id })
          .from(studioWorktables)
          .where(
            and(
              eq(studioWorktables.id, worktable),
              eq(studioWorktables.project, project.id),
            ),
          )
          .limit(1);
        if (!board) throw new Error('404');
      }
      const asset = string(body.asset);
      if (asset) {
        const uploadedAsset = await assetInProject(db, asset, project.id);
        if (uploadedAsset.size > INSPIRATION_FILE_LIMIT)
          throw new Error('INSPIRATION_FILE_LIMIT');
      }
      const title = required(body.title, 160);
      const rawUrl = string(body.url, 2000);
      const link = rawUrl ? safeReferenceUrl(rawUrl) : '';
      if (link === null) throw new Error('400');
      // Empty post-its are valid: the editor is opened directly on the card.
      if (!asset && !link && !string(body.note) && body.sticky !== true)
        throw new Error('400');
      const id = crypto.randomUUID();
      await db.insert(studioInspiration).values({
        id,
        project: project.id,
        title,
        note: string(body.note, 2000),
        url: link,
        asset: asset || null,
        worktable: worktable || null,
        category: choice(body.category || 'general', categories),
        status: 'idea',
        author: ctx.name,
        created: Date.now(),
      });
      return json({ ok: true, id }, 201);
    }
    if (action === 'edit-inspiration') {
      const id = required(body.id);
      const [item] = await db
        .select({ asset: studioInspiration.asset })
        .from(studioInspiration)
        .where(
          and(
            eq(studioInspiration.id, id),
            eq(studioInspiration.project, project.id),
          ),
        )
        .limit(1);
      if (!item) throw new Error('404');
      const title = required(body.title, 160);
      const note = string(body.note, 2000);
      const rawUrl = string(body.url, 2000);
      const link = rawUrl ? safeReferenceUrl(rawUrl) : '';
      if (
        link === null ||
        (!item.asset && !link && !note && body.sticky !== true)
      )
        throw new Error('400');
      await db
        .update(studioInspiration)
        .set({
          title,
          note,
          url: link,
          category: choice(body.category, categories),
        })
        .where(
          and(
            eq(studioInspiration.id, id),
            eq(studioInspiration.project, project.id),
          ),
        );
      return json({ ok: true });
    }
    if (action === 'add-inspiration-comment') {
      const inspiration = required(body.inspiration);
      const text = required(body.text, 2000);
      const [item] = await db
        .select({ id: studioInspiration.id })
        .from(studioInspiration)
        .where(
          and(
            eq(studioInspiration.id, inspiration),
            eq(studioInspiration.project, project.id),
          ),
        )
        .limit(1);
      if (!item) throw new Error('404');
      const id = crypto.randomUUID();
      await db.insert(studioInspirationComments).values({
        id,
        project: project.id,
        inspiration,
        author: ctx.name,
        text,
        created: Date.now(),
      });
      return json({ ok: true, id }, 201);
    }
    if (action === 'proposal-feedback') {
      const proposal = await proposalInProject(
        db,
        required(body.proposal),
        project.id,
      );
      if (proposal.status === 'draft') throw new Error('403');
      const option = string(body.option);
      if (option) await optionInProposal(db, option, proposal.id);
      const kind = choice(body.kind || 'comment', [
        'comment',
        'approve',
        'changes',
      ]);
      if (kind === 'approve' && !option) throw new Error('400');
      if (kind === 'approve' && proposal.status !== 'review')
        throw new Error('409');
      const comment = string(body.text, 2000);
      if (kind === 'comment' && !comment) throw new Error('400');
      await db.insert(studioProposalFeedback).values({
        id: crypto.randomUUID(),
        proposal: proposal.id,
        option: option || null,
        author: ctx.name,
        kind,
        text: comment,
        created: Date.now(),
      });
      if (kind === 'approve')
        await db
          .update(studioProposals)
          .set({ selectedOption: option, status: 'approved' })
          .where(eq(studioProposals.id, proposal.id));
      if (kind === 'changes')
        await db
          .update(studioProposals)
          .set({ status: 'changes', selectedOption: null })
          .where(eq(studioProposals.id, proposal.id));
      return json({ ok: true }, 201);
    }
    const guestAsset =
      ctx.guest &&
      (action === 'begin-asset' ||
        action === 'finish-asset' ||
        action === 'abort-asset');
    if ((ctx.guest && !guestAsset) || (!ctx.canEdit && !guestAsset))
      throw new Error('403');
    if (action === 'create-client') {
      if (!ctx.accountOwner) throw new Error('403');
      await assertBillingAllowance(db, ctx.userId, 'clients');
      const email = string(body.email, 254).toLowerCase();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw new Error('400');
      const id = crypto.randomUUID();
      await db.insert(studioClients).values({
        id,
        owner: ctx.userId,
        name: required(body.name, 120),
        email,
        created: Date.now(),
      });
      return json({ client: id }, 201);
    } else if (action === 'create-project') {
      if (!ctx.accountOwner) throw new Error('403');
      await assertBillingAllowance(db, ctx.userId, 'projects');
      const clientId = string(body.client) || null;
      if (clientId) {
        const [client] = await db
          .select({ id: studioClients.id })
          .from(studioClients)
          .where(
            and(
              eq(studioClients.id, clientId),
              eq(studioClients.owner, ctx.userId),
            ),
          )
          .limit(1);
        if (!client) throw new Error('400');
      }
      const id = crypto.randomUUID();
      await db.insert(studioProjects).values({
        id,
        owner: ctx.userId,
        client: clientId,
        share: randomToken(),
        shareEnabled: 1,
        shareExpires: Date.now() + 30 * 86400_000,
        name: required(body.name, 120),
        created: Date.now(),
      });
      return json({ project: id }, 201);
    } else if (action === 'update-project') {
      const progress =
        body.progress === null || body.progress === ''
          ? null
          : Number(body.progress);
      if (
        progress !== null &&
        (!Number.isInteger(progress) || progress < 0 || progress > 100)
      )
        throw new Error('400');
      const startDate = date(body.startDate);
      const dueDate = date(body.dueDate);
      if (startDate && dueDate && startDate > dueDate)
        throw new Error('La fecha de inicio debe ser anterior a la entrega.');
      await db
        .update(studioProjects)
        .set({
          stage: choice(body.stage, stages),
          progress,
          description: string(body.description, 2000),
          startDate,
          dueDate,
        })
        .where(eq(studioProjects.id, project.id));
    } else if (action === 'save-task') {
      const id = string(body.id);
      const values = {
        title: required(body.title, 180),
        status: choice(body.status || 'todo', taskStates),
        startDate: date(body.startDate),
        dueDate: date(body.dueDate),
        clientVisible: body.clientVisible ? 1 : 0,
        assignee: string(body.assignee) || null,
      };
      if (
        values.startDate &&
        values.dueDate &&
        values.startDate > values.dueDate
      )
        throw new Error('La fecha de inicio debe ser anterior a la entrega.');
      if (id) {
        const [existing] = await db
          .select({ id: studioTasks.id })
          .from(studioTasks)
          .where(
            and(eq(studioTasks.id, id), eq(studioTasks.project, project.id)),
          )
          .limit(1);
        if (!existing) throw new Error('404');
        await db.update(studioTasks).set(values).where(eq(studioTasks.id, id));
      } else
        await db.insert(studioTasks).values({
          id: crypto.randomUUID(),
          project: project.id,
          ...values,
          created: Date.now(),
        });
    } else if (action === 'delete-task') {
      await db
        .delete(studioTasks)
        .where(
          and(
            eq(studioTasks.id, required(body.id)),
            eq(studioTasks.project, project.id),
          ),
        );
    } else if (action === 'save-budget-item') {
      const id = string(body.id);
      const values = {
        title: required(body.title, 160),
        category: string(body.category, 80) || 'General',
        planned: money(body.planned),
        committed: money(body.committed),
        status: choice(body.status || 'estimated', budgetStates),
        clientVisible: body.clientVisible === false ? 0 : 1,
      };
      if (id) {
        const [existing] = await db
          .select({ id: studioBudgetItems.id })
          .from(studioBudgetItems)
          .where(
            and(
              eq(studioBudgetItems.id, id),
              eq(studioBudgetItems.project, project.id),
            ),
          )
          .limit(1);
        if (!existing) throw new Error('404');
        await db
          .update(studioBudgetItems)
          .set(values)
          .where(eq(studioBudgetItems.id, id));
      } else {
        await db.insert(studioBudgetItems).values({
          id: crypto.randomUUID(),
          project: project.id,
          ...values,
          created: Date.now(),
        });
      }
    } else if (action === 'delete-budget-item') {
      await db
        .delete(studioBudgetItems)
        .where(
          and(
            eq(studioBudgetItems.id, required(body.id)),
            eq(studioBudgetItems.project, project.id),
          ),
        );
    } else if (action === 'update-inspiration') {
      await db
        .update(studioInspiration)
        .set({
          status: choice(body.status, inspirationStates),
          category: choice(body.category, categories),
        })
        .where(
          and(
            eq(studioInspiration.id, required(body.id)),
            eq(studioInspiration.project, project.id),
          ),
        );
    } else if (action === 'replace-inspiration-image') {
      const id = required(body.id);
      const asset = await assetInProject(db, required(body.asset), project.id);
      if (
        asset.size > INSPIRATION_FILE_LIMIT ||
        !/^image\/(jpeg|png|webp|avif)$/.test(asset.mime)
      )
        throw new Error('400');
      const [item] = await db
        .select({ asset: studioInspiration.asset })
        .from(studioInspiration)
        .where(
          and(
            eq(studioInspiration.id, id),
            eq(studioInspiration.project, project.id),
          ),
        )
        .limit(1);
      if (!item?.asset) throw new Error('404');
      await db
        .update(studioInspiration)
        .set({ asset: asset.id })
        .where(
          and(
            eq(studioInspiration.id, id),
            eq(studioInspiration.project, project.id),
          ),
        );
      if (item.asset !== asset.id)
        await removeUnusedAsset(db, item.asset, project.id);
    } else if (action === 'delete-inspiration') {
      const [item] = await db
        .select({ asset: studioInspiration.asset })
        .from(studioInspiration)
        .where(
          and(
            eq(studioInspiration.id, required(body.id)),
            eq(studioInspiration.project, project.id),
          ),
        )
        .limit(1);
      await db
        .delete(studioInspirationComments)
        .where(
          and(
            eq(studioInspirationComments.inspiration, required(body.id)),
            eq(studioInspirationComments.project, project.id),
          ),
        );
      await db
        .delete(studioInspiration)
        .where(
          and(
            eq(studioInspiration.id, required(body.id)),
            eq(studioInspiration.project, project.id),
          ),
        );
      if (item?.asset) await removeUnusedAsset(db, item.asset, project.id);
    } else if (action === 'create-proposal') {
      await db.insert(studioProposals).values({
        id: crypto.randomUUID(),
        project: project.id,
        title: required(body.title, 180),
        description: string(body.description, 2000),
        status: 'draft',
        created: Date.now(),
      });
    } else if (action === 'add-option') {
      const proposal = await proposalInProject(
        db,
        required(body.proposal),
        project.id,
      );
      if (proposal.status === 'approved') throw new Error('403');
      const asset = string(body.asset);
      if (asset) await assetInProject(db, asset, project.id);
      const previewAsset = string(body.previewAsset);
      if (previewAsset) await assetInProject(db, previewAsset, project.id);
      await db.insert(studioProposalOptions).values({
        id: crypto.randomUUID(),
        proposal: proposal.id,
        title: required(body.title, 180),
        description: string(body.description, 2000),
        asset: asset || null,
        previewAsset: previewAsset || null,
        url: url(body.url),
        costNote: string(body.costNote, 180),
        timeNote: string(body.timeNote, 180),
        created: Date.now(),
      });
    } else if (action === 'set-proposal-status') {
      const proposal = await proposalInProject(
        db,
        required(body.id),
        project.id,
      );
      const status = choice(body.status, proposalStates);
      if (status === 'approved') throw new Error('400');
      if (status === 'review') {
        const [option] = await db
          .select({ id: studioProposalOptions.id })
          .from(studioProposalOptions)
          .where(eq(studioProposalOptions.proposal, proposal.id))
          .limit(1);
        if (!option) throw new Error('400');
      }
      await db
        .update(studioProposals)
        .set({
          status,
          selectedOption: status === 'draft' ? null : proposal.selectedOption,
        })
        .where(eq(studioProposals.id, proposal.id));
    } else if (action === 'delete-proposal') {
      const proposal = await proposalInProject(
        db,
        required(body.id),
        project.id,
      );
      const linkedAssets = await db
        .select({
          asset: studioProposalOptions.asset,
          previewAsset: studioProposalOptions.previewAsset,
        })
        .from(studioProposalOptions)
        .where(eq(studioProposalOptions.proposal, proposal.id));
      await db
        .delete(studioProposalFeedback)
        .where(eq(studioProposalFeedback.proposal, proposal.id));
      await db
        .delete(studioProposalOptions)
        .where(eq(studioProposalOptions.proposal, proposal.id));
      await db
        .delete(studioProposals)
        .where(eq(studioProposals.id, proposal.id));
      for (const item of linkedAssets) {
        if (item.asset) await removeUnusedAsset(db, item.asset, project.id);
        if (item.previewAsset && item.previewAsset !== item.asset)
          await removeUnusedAsset(db, item.previewAsset, project.id);
      }
    } else if (action === 'delete-asset') {
      await removeUnusedAsset(db, required(body.id), project.id);
    } else if (action === 'begin-asset') {
      const size = Number(body.size);
      const name = required(body.name, 240);
      if (!Number.isSafeInteger(size) || size < 1) throw new Error('400');
      if (ctx.accountOwner) await assertBillingAllowance(db, ctx.userId, 'storageBytes', size);
      if (body.scope === 'inspiration' && size > INSPIRATION_FILE_LIMIT)
        throw new Error('INSPIRATION_FILE_LIMIT');
      if (size > MAX_ASSET) throw new Error('413');
      const mime = string(body.mime, 120) || 'application/octet-stream';
      if (
        ctx.guest &&
        (size > 20 * 1024 * 1024 || !/^image\/(jpeg|png|webp|avif)$/.test(mime))
      )
        throw new Error('403');
      const id = crypto.randomUUID();
      const key = `${project.id}/workspace/${id}`;
      const upload = await env.FILES.createMultipartUpload(key);
      await db.insert(studioAssetUploads).values({
        id,
        project: project.id,
        key,
        uploadId: upload.uploadId,
        name,
        mime,
        size,
        created: Date.now(),
      });
      return json({ id, partSize: PART_SIZE });
    } else if (action === 'finish-asset' || action === 'abort-asset') {
      const [upload] = await db
        .select()
        .from(studioAssetUploads)
        .where(
          and(
            eq(studioAssetUploads.id, required(body.id)),
            eq(studioAssetUploads.project, project.id),
          ),
        )
        .limit(1);
      if (!upload) throw new Error('404');
      const multipart = env.FILES.resumeMultipartUpload(
        upload.key,
        upload.uploadId,
      );
      if (action === 'abort-asset') {
        await multipart.abort();
        await db
          .delete(studioAssetUploads)
          .where(eq(studioAssetUploads.id, upload.id));
        return json({ ok: true });
      }
      if (
        !Array.isArray(body.parts) ||
        body.parts.length !== Math.ceil(upload.size / PART_SIZE)
      )
        throw new Error('400');
      const parts = body.parts.map((part, index) => {
        if (
          !part ||
          typeof part !== 'object' ||
          (part as { partNumber?: number }).partNumber !== index + 1 ||
          typeof (part as { etag?: unknown }).etag !== 'string'
        )
          throw new Error('400');
        return { partNumber: index + 1, etag: (part as { etag: string }).etag };
      });
      await multipart.complete(parts);
      await db.insert(studioAssets).values({
        id: upload.id,
        project: project.id,
        key: upload.key,
        name: upload.name,
        mime: upload.mime,
        size: upload.size,
        created: Date.now(),
      });
      await db
        .delete(studioAssetUploads)
        .where(eq(studioAssetUploads.id, upload.id));
      return json({ asset: upload.id }, 201);
    } else if (action === 'invite-member') {
      if (!ctx.accountOwner) throw new Error('403');
      const email = required(body.email, 254).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('400');
      const scopedProject = string(body.project);
      if (
        scopedProject &&
        !ctx.projects.some((item) => item.id === scopedProject)
      )
        throw new Error('400');
      const role = choice(body.role, roles);
      const token = randomToken();
      await db.insert(studioTeamMembers).values({
        id: crypto.randomUUID(),
        owner: ctx.userId,
        project: scopedProject || null,
        email,
        role,
        permissions: JSON.stringify(defaultPermissionsForRole(role)),
        inviteHash: await sha256(token),
        inviteExpires: Date.now() + 30 * 86400_000,
        created: Date.now(),
      });
      return json({ invite: token }, 201);
    } else if (action === 'remove-member') {
      if (!ctx.accountOwner) throw new Error('403');
      const id = required(body.id);
      const [member] = await db
        .select({
          user: studioTeamMembers.user,
          email: studioTeamMembers.email,
        })
        .from(studioTeamMembers)
        .where(
          and(
            eq(studioTeamMembers.id, id),
            eq(studioTeamMembers.owner, ctx.userId),
          ),
        )
        .limit(1);
      if (!member) throw new Error('404');
      const samePerson = member.user
        ? eq(studioTeamMembers.user, member.user)
        : and(
            isNull(studioTeamMembers.user),
            eq(studioTeamMembers.email, member.email),
          );
      const memberships = await db
        .select({ project: studioTeamMembers.project })
        .from(studioTeamMembers)
        .where(and(eq(studioTeamMembers.owner, ctx.userId), samePerson));
      await db
        .delete(studioTeamMembers)
        .where(and(eq(studioTeamMembers.owner, ctx.userId), samePerson));
      // Local login cookies are server-side sessions. Removing them makes an
      // already-issued cookie unusable immediately; federated identities are
      // still denied because project membership is checked on every request.
      if (member?.user?.startsWith('fabrica:')) {
        await db
          .delete(studioSessions)
          .where(eq(studioSessions.user, member.user.slice('fabrica:'.length)));
      }
      // Team members may have seen a client-facing share URL before this
      // restriction existed. Rotate every affected token so a saved URL cannot
      // become a back door after membership and sessions are revoked.
      const hasStudioWideAccess = memberships.some((item) => !item.project);
      const affectedProjects = hasStudioWideAccess
        ? ctx.projects
        : ctx.projects.filter((item) =>
            memberships.some((membership) => membership.project === item.id),
          );
      for (const affectedProject of affectedProjects) {
        await db
          .update(studioProjects)
          .set({ share: randomToken() })
          .where(eq(studioProjects.id, affectedProject.id));
      }
    } else if (action === 'renew-invite') {
      if (!ctx.accountOwner) throw new Error('403');
      const [member] = await db
        .select()
        .from(studioTeamMembers)
        .where(
          and(
            eq(studioTeamMembers.id, required(body.id)),
            eq(studioTeamMembers.owner, ctx.userId),
            or(
              isNull(studioTeamMembers.accepted),
              eq(studioTeamMembers.role, 'external'),
            ),
          ),
        )
        .limit(1);
      if (!member) throw new Error('404');
      const token = randomToken();
      await db
        .update(studioTeamMembers)
        .set({
          inviteHash: await sha256(token),
          inviteExpires: Date.now() + 30 * 86400_000,
        })
        .where(eq(studioTeamMembers.id, member.id));
      return json({ invite: token });
    } else if (action === 'update-member-permissions') {
      if (!ctx.accountOwner) throw new Error('403');
      const billing = await getBillingStatus(db, ctx.userId);
      if (!billing.rights.teamPermissions) throw new Error('billing_feature_team_permissions');
      const id = required(body.id);
      const raw = body.permissions;
      if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        throw new Error('400');
      const permissions = Object.fromEntries(
        areaKeys.map((key) => [
          key,
          choice((raw as Record<string, unknown>)[key], [
            'none',
            'view',
            'edit',
          ]),
        ]),
      );
      const [member] = await db
        .select({ id: studioTeamMembers.id })
        .from(studioTeamMembers)
        .where(
          and(
            eq(studioTeamMembers.id, id),
            eq(studioTeamMembers.owner, ctx.userId),
          ),
        )
        .limit(1);
      if (!member) throw new Error('404');
      await db
        .update(studioTeamMembers)
        .set({ permissions: JSON.stringify(permissions) })
        .where(eq(studioTeamMembers.id, id));
    } else if (action === 'update-member') {
      if (!ctx.accountOwner) throw new Error('403');
      const id = required(body.id);
      const [member] = await db
        .select()
        .from(studioTeamMembers)
        .where(
          and(
            eq(studioTeamMembers.id, id),
            eq(studioTeamMembers.owner, ctx.userId),
          ),
        )
        .limit(1);
      if (!member) throw new Error('404');
      const email = required(body.email, 254).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('400');
      const role = choice(body.role, roles);
      const scopedProject = string(body.project);
      if (
        scopedProject &&
        !ctx.projects.some((item) => item.id === scopedProject)
      )
        throw new Error('400');
      const raw = body.permissions;
      if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        throw new Error('400');
      const permissions = Object.fromEntries(
        areaKeys.map((key) => [
          key,
          choice((raw as Record<string, unknown>)[key], [
            'none',
            'view',
            'edit',
          ]),
        ]),
      );
      const billing = await getBillingStatus(db, ctx.userId);
      if (!billing.rights.teamPermissions &&
        JSON.stringify(permissions) !== JSON.stringify(defaultPermissionsForRole(role)))
        throw new Error('billing_feature_team_permissions');
      const identityChanged =
        email !== member.email ||
        (role === 'external') !== (member.role === 'external');
      let token = '';
      let inviteHash = member.inviteHash;
      let inviteExpires = member.inviteExpires;
      if (identityChanged) {
        token = randomToken();
        inviteHash = await sha256(token);
        inviteExpires = Date.now() + 30 * 86400_000;
        if (member.user?.startsWith('fabrica:')) {
          await db
            .delete(studioSessions)
            .where(
              eq(studioSessions.user, member.user.slice('fabrica:'.length)),
            );
        }
      }
      await db
        .update(studioTeamMembers)
        .set({
          name: string(body.name, 120),
          email,
          role,
          project: scopedProject || null,
          permissions: JSON.stringify(permissions),
          inviteHash,
          inviteExpires,
          ...(identityChanged ? { user: null, accepted: null } : {}),
        })
        .where(eq(studioTeamMembers.id, id));
      return json({ ok: true, ...(token ? { invite: token } : {}) });
    } else throw new Error('400');
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}

export async function PUT(request: Request) {
  try {
    if (!validRequestOrigin(request)) throw new Error('403');
    const ctx = await context(request);
    if (ctx.permissions.inspiracion !== 'edit' && !ctx.guest)
      throw new Error('403');
    const db = database();
    await assertBillingWritable(db, ctx.project.owner);
    const params = new URL(request.url).searchParams;
    const [upload] = await db
      .select()
      .from(studioAssetUploads)
      .where(
        and(
          eq(studioAssetUploads.id, params.get('upload') || ''),
          eq(studioAssetUploads.project, ctx.project.id),
        ),
      )
      .limit(1);
    const part = Number(params.get('part'));
    if (
      !upload ||
      !Number.isInteger(part) ||
      part < 1 ||
      part > Math.ceil(upload.size / PART_SIZE)
    )
      throw new Error('400');
    const expected = Math.min(PART_SIZE, upload.size - (part - 1) * PART_SIZE);
    if (Number(request.headers.get('content-length')) !== expected)
      throw new Error('400');
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength !== expected) throw new Error('400');
    return json(
      await env.FILES.resumeMultipartUpload(
        upload.key,
        upload.uploadId,
      ).uploadPart(part, bytes),
    );
  } catch (error) {
    return fail(error);
  }
}

async function assetInProject(
  db: ReturnType<typeof database>,
  id: string,
  project: string,
) {
  const [asset] = await db
    .select({
      id: studioAssets.id,
      size: studioAssets.size,
      mime: studioAssets.mime,
    })
    .from(studioAssets)
    .where(and(eq(studioAssets.id, id), eq(studioAssets.project, project)))
    .limit(1);
  if (!asset) throw new Error('400');
  return asset;
}
async function proposalInProject(
  db: ReturnType<typeof database>,
  id: string,
  project: string,
) {
  const [proposal] = await db
    .select()
    .from(studioProposals)
    .where(
      and(eq(studioProposals.id, id), eq(studioProposals.project, project)),
    )
    .limit(1);
  if (!proposal) throw new Error('404');
  return proposal;
}
async function optionInProposal(
  db: ReturnType<typeof database>,
  id: string,
  proposal: string,
) {
  const [option] = await db
    .select()
    .from(studioProposalOptions)
    .where(
      and(
        eq(studioProposalOptions.id, id),
        eq(studioProposalOptions.proposal, proposal),
      ),
    )
    .limit(1);
  if (!option) throw new Error('404');
  return option;
}

async function removeUnusedAsset(
  db: ReturnType<typeof database>,
  id: string,
  project: string,
) {
  const [asset] = await db
    .select()
    .from(studioAssets)
    .where(and(eq(studioAssets.id, id), eq(studioAssets.project, project)))
    .limit(1);
  if (!asset) throw new Error('404');
  const [reference] = await db
    .select({ id: studioInspiration.id })
    .from(studioInspiration)
    .where(eq(studioInspiration.asset, id))
    .limit(1);
  const [option] = await db
    .select({ id: studioProposalOptions.id })
    .from(studioProposalOptions)
    .where(
      or(
        eq(studioProposalOptions.asset, id),
        eq(studioProposalOptions.previewAsset, id),
      ),
    )
    .limit(1);
  if (reference || option) return;
  await env.FILES.delete(asset.key);
  await db.delete(studioAssets).where(eq(studioAssets.id, id));
}
