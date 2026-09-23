import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import {
  billingAccounts, billingPriceVersions, billingStudios,
  studioClients, studioProjects, studioTeamMembers,
} from '@/db/schema';
import {
  allowedWithinLimit, canWrite, effectiveBillingState, PLANS, TRIAL_DAYS,
  type PlanKey, type PlanRights,
} from './core';

type Database = ReturnType<typeof getDb>;
export type Usage = { projects: number; storageBytes: number; professionals: number; clients: number };

export class BillingLimitError extends Error {
  constructor(public readonly resource: keyof Usage | 'read_only') {
    super(resource === 'read_only' ? 'billing_read_only' : `billing_limit_${resource}`);
  }
}

export async function ensureBillingAccount(db: Database, owner: string) {
  const [existing] = await db.select().from(billingStudios).where(eq(billingStudios.owner, owner)).limit(1);
  let studio = existing;
  if (!studio) {
    const [firstProject] = await db.select({ created: studioProjects.created })
      .from(studioProjects).where(eq(studioProjects.owner, owner))
      .orderBy(asc(studioProjects.created)).limit(1);
    const created = firstProject?.created || Date.now();
    await db.insert(billingStudios).values({ id: crypto.randomUUID(), owner, created }).onConflictDoNothing();
    [studio] = await db.select().from(billingStudios).where(eq(billingStudios.owner, owner)).limit(1);
  }
  if (!studio) throw new Error('billing_studio_unavailable');
  const [account] = await db.select().from(billingAccounts).where(eq(billingAccounts.studio, studio.id)).limit(1);
  if (account) return { studio, account };
  const started = studio.created;
  await db.insert(billingAccounts).values({
    id: crypto.randomUUID(), studio: studio.id, trialStarted: started,
    trialEnds: started + TRIAL_DAYS * 86_400_000,
    created: Date.now(), updated: Date.now(),
  }).onConflictDoNothing();
  const [createdAccount] = await db.select().from(billingAccounts)
    .where(eq(billingAccounts.studio, studio.id)).limit(1);
  if (!createdAccount) throw new Error('billing_account_unavailable');
  return { studio, account: createdAccount };
}

export async function getUsage(db: Database, owner: string): Promise<Usage> {
  const [projects, clients, members, storage] = await Promise.all([
    db.select({ value: sql<number>`count(*)::integer` }).from(studioProjects)
      .where(and(eq(studioProjects.owner, owner), isNull(studioProjects.archived))),
    db.select({ value: sql<number>`count(*)::integer` }).from(studioClients)
      .where(and(eq(studioClients.owner, owner), isNull(studioClients.archived))),
    db.select({ value: sql<number>`count(distinct coalesce(${studioTeamMembers.user}, lower(${studioTeamMembers.email})))::integer` })
      .from(studioTeamMembers)
      .where(and(eq(studioTeamMembers.owner, owner), ne(studioTeamMembers.role, 'external'),
        sql`${studioTeamMembers.accepted} is not null`)),
    db.execute(sql`
      select coalesce(sum(files.size), 0)::bigint as bytes from (
        select distinct on (key) key, size from (
          select a.key, a.size from studio_assets a
            join studio_projects p on p.id = a.project where p.owner = ${owner}
          union all
          select a.key, a.size from studio_asset_uploads a
            join studio_projects p on p.id = a.project where p.owner = ${owner}
          union all
          select u.key, u.size from studio_uploads u
            join studio_projects p on p.id = u.project where p.owner = ${owner}
          union all
          select pl.key, pl.size from studio_plans pl
            join studio_projects p on p.id = pl.project where p.owner = ${owner} and pl.key is not null
        ) all_files order by key
      ) files
    `),
  ]);
  return {
    projects: projects[0]?.value || 0,
    clients: clients[0]?.value || 0,
    professionals: 1 + (members[0]?.value || 0),
    storageBytes: Number(storage.rows[0]?.bytes || 0),
  };
}

export async function getBillingStatus(db: Database, owner: string) {
  const { studio, account } = await ensureBillingAccount(db, owner);
  const state = effectiveBillingState(account);
  const [price] = account.priceVersion
    ? await db.select().from(billingPriceVersions).where(eq(billingPriceVersions.id, account.priceVersion)).limit(1)
    : [];
  const plan = account.plan as PlanKey;
  const rights: PlanRights = price ? {
    projects: price.projectLimit, storageBytes: price.storageLimitBytes,
    professionals: price.professionalLimit, clients: price.clientLimit,
    teamPermissions: Boolean(price.teamPermissions), advancedAdmin: Boolean(price.advancedAdmin),
    prioritySupport: Boolean(price.prioritySupport),
  } : PLANS[plan]?.rights || PLANS.prueba.rights;
  return { studio, account, state, rights, usage: await getUsage(db, owner) };
}

export async function assertBillingAllowance(
  db: Database, owner: string, resource: keyof Usage, addition = 1,
) {
  const status = await getBillingStatus(db, owner);
  if (!canWrite(status.state)) throw new BillingLimitError('read_only');
  const limit = resource === 'projects' ? status.rights.projects
    : resource === 'storageBytes' ? status.rights.storageBytes
      : resource === 'professionals' ? status.rights.professionals
        : status.rights.clients;
  if (!allowedWithinLimit(status.usage[resource], addition, limit))
    throw new BillingLimitError(resource);
  return status;
}

export async function assertBillingWritable(db: Database, owner: string) {
  const status = await getBillingStatus(db, owner);
  if (!canWrite(status.state)) throw new BillingLimitError('read_only');
  return status;
}
