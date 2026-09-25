import {
  bigint,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const studioUsers = pgTable(
  'studio_users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    passwordHash: text('password_hash'),
    googleSubject: text('google_subject'),
    created: bigint('created', { mode: 'number' }).notNull(),
  },
  (table) => [
    uniqueIndex('studio_users_google_subject_unique').on(table.googleSubject),
  ],
);

export const studioSessions = pgTable(
  'studio_sessions',
  {
    id: text('id').primaryKey(),
    user: text('user')
      .notNull()
      .references(() => studioUsers.id),
    tokenHash: text('token_hash').notNull().unique(),
    expires: bigint('expires', { mode: 'number' }).notNull(),
    created: bigint('created', { mode: 'number' }).notNull(),
  },
  (table) => [
    index('studio_sessions_user').on(table.user),
    index('studio_sessions_expires').on(table.expires),
  ],
);

export const studioClients = pgTable(
  'studio_clients',
  {
    id: text('id').primaryKey(),
    owner: text('owner').notNull(),
    account: text('account'),
    name: text('name').notNull(),
    email: text('email').notNull().default(''),
    created: bigint('created', { mode: 'number' }).notNull(),
    archived: bigint('archived', { mode: 'number' }),
  },
  (table) => [
    index('studio_clients_owner').on(table.owner),
    index('studio_clients_account').on(table.account),
  ],
);

export const studioProjects = pgTable(
  'studio_projects',
  {
    id: text('id').primaryKey(),
    owner: text('owner').notNull(),
    client: text('client').references(() => studioClients.id),
    share: text('share').notNull().unique(),
    shareEnabled: integer('share_enabled').notNull().default(1),
    shareExpires: bigint('share_expires', { mode: 'number' })
      .notNull()
      .default(0),
    name: text('name').notNull().default('Proyecto sin nombre'),
    stage: text('stage').notNull().default('idea'),
    progress: integer('progress'),
    description: text('description').notNull().default(''),
    startDate: text('start_date'),
    dueDate: text('due_date'),
    created: bigint('created', { mode: 'number' }).notNull().default(0),
    archived: bigint('archived', { mode: 'number' }),
  },
  (table) => [
    index('studio_projects_owner').on(table.owner),
    index('studio_projects_client').on(table.client),
  ],
);

// Only the latest state of each open viewer is retained; expired rows are removed.
export const studioPresence = pgTable(
  'studio_presence',
  {
    id: text('id').primaryKey(),
    secretHash: text('secret_hash').notNull(),
    project: text('project').notNull().references(() => studioProjects.id, { onDelete: 'cascade' }),
    version: text('version').notNull(),
    name: text('name').notNull(),
    role: text('role').notNull(),
    cursor: text('cursor'),
    camera: text('camera'),
    expires: bigint('expires', { mode: 'number' }).notNull(),
  },
  (table) => [
    index('studio_presence_room').on(table.project, table.version, table.expires),
    index('studio_presence_expires').on(table.expires),
  ],
);

export const studioTeamMembers = pgTable(
  'studio_team_members',
  {
    id: text('id').primaryKey(),
    owner: text('owner').notNull(),
    project: text('project').references(() => studioProjects.id),
    email: text('email').notNull(),
    user: text('user'),
    name: text('name').notNull().default(''),
    role: text('role').notNull().default('architect'),
    permissions: text('permissions')
      .notNull()
      .default('{"panel":"edit","inspiracion":"edit","modelo":"edit"}'),
    inviteHash: text('invite_hash').notNull().unique(),
    inviteExpires: bigint('invite_expires', { mode: 'number' }).notNull(),
    created: bigint('created', { mode: 'number' }).notNull(),
    accepted: bigint('accepted', { mode: 'number' }),
  },
  (table) => [
    index('studio_team_members_owner').on(table.owner),
    index('studio_team_members_user').on(table.user),
    index('studio_team_members_project').on(table.project),
  ],
);

export const studioTasks = pgTable(
  'studio_tasks',
  {
    id: text('id').primaryKey(),
    project: text('project')
      .notNull()
      .references(() => studioProjects.id),
    title: text('title').notNull(),
    status: text('status').notNull().default('todo'),
    startDate: text('start_date'),
    dueDate: text('due_date'),
    clientVisible: integer('client_visible').notNull().default(0),
    assignee: text('assignee'),
    created: bigint('created', { mode: 'number' }).notNull(),
  },
  (table) => [index('studio_tasks_project').on(table.project)],
);

/**
 * Deliberately small cost plan: Fabrica tracks design decisions and their
 * project impact, rather than attempting to be the accounting system.
 */
export const studioBudgetItems = pgTable(
  'studio_budget_items',
  {
    id: text('id').primaryKey(),
    project: text('project')
      .notNull()
      .references(() => studioProjects.id),
    title: text('title').notNull(),
    category: text('category').notNull().default('General'),
    planned: bigint('planned', { mode: 'number' }).notNull().default(0),
    committed: bigint('committed', { mode: 'number' }).notNull().default(0),
    status: text('status').notNull().default('estimated'),
    clientVisible: integer('client_visible').notNull().default(1),
    created: bigint('created', { mode: 'number' }).notNull(),
  },
  (table) => [index('studio_budget_items_project').on(table.project)],
);

export const studioAssets = pgTable(
  'studio_assets',
  {
    id: text('id').primaryKey(),
    project: text('project')
      .notNull()
      .references(() => studioProjects.id),
    key: text('key').notNull().unique(),
    name: text('name').notNull(),
    mime: text('mime').notNull(),
    size: bigint('size', { mode: 'number' }).notNull(),
    created: bigint('created', { mode: 'number' }).notNull(),
  },
  (table) => [index('studio_assets_project').on(table.project)],
);

export const studioAssetUploads = pgTable('studio_asset_uploads', {
  id: text('id').primaryKey(),
  project: text('project')
    .notNull()
    .references(() => studioProjects.id),
  key: text('key').notNull(),
  uploadId: text('upload_id').notNull(),
  name: text('name').notNull(),
  mime: text('mime').notNull(),
  size: bigint('size', { mode: 'number' }).notNull(),
  created: bigint('created', { mode: 'number' }).notNull(),
});

export const studioWorktables = pgTable(
  'studio_worktables',
  {
    id: text('id').primaryKey(),
    project: text('project').notNull().references(() => studioProjects.id),
    title: text('title').notNull(),
    template: text('template').notNull().default('blank'),
    created: bigint('created', { mode: 'number' }).notNull(),
  },
  (table) => [index('studio_worktables_project').on(table.project)],
);

export const studioInspiration = pgTable(
  'studio_inspiration',
  {
    id: text('id').primaryKey(),
    project: text('project')
      .notNull()
      .references(() => studioProjects.id),
    title: text('title').notNull(),
    note: text('note').notNull().default(''),
    url: text('url').notNull().default(''),
    asset: text('asset').references(() => studioAssets.id),
    worktable: text('worktable').references(() => studioWorktables.id),
    category: text('category').notNull().default('general'),
    status: text('status').notNull().default('idea'),
    author: text('author').notNull(),
    created: bigint('created', { mode: 'number' }).notNull(),
  },
  (table) => [index('studio_inspiration_project').on(table.project)],
);

export const studioInspirationComments = pgTable(
  'studio_inspiration_comments',
  {
    id: text('id').primaryKey(),
    project: text('project')
      .notNull()
      .references(() => studioProjects.id),
    inspiration: text('inspiration')
      .references(() => studioInspiration.id),
    element: text('element'),
    worktable: text('worktable'),
    author: text('author').notNull(),
    actor: text('actor'),
    text: text('text').notNull(),
    created: bigint('created', { mode: 'number' }).notNull(),
  },
  (table) => [
    index('studio_inspiration_comments_project').on(table.project),
    index('studio_inspiration_comments_inspiration').on(table.inspiration),
  ],
);

export const studioInspirationReactions = pgTable(
  'studio_inspiration_reactions',
  {
    id: text('id').primaryKey(),
    project: text('project').notNull().references(() => studioProjects.id),
    inspiration: text('inspiration').notNull().references(() => studioInspiration.id),
    actor: text('actor').notNull(),
    emoji: text('emoji').notNull(),
    created: bigint('created', { mode: 'number' }).notNull(),
  },
  (table) => [
    uniqueIndex('studio_inspiration_reactions_actor_unique').on(table.inspiration, table.actor),
    index('studio_inspiration_reactions_project').on(table.project),
  ],
);

export const studioProposals = pgTable(
  'studio_proposals',
  {
    id: text('id').primaryKey(),
    project: text('project')
      .notNull()
      .references(() => studioProjects.id),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    status: text('status').notNull().default('draft'),
    selectedOption: text('selected_option'),
    created: bigint('created', { mode: 'number' }).notNull(),
  },
  (table) => [index('studio_proposals_project').on(table.project)],
);

export const studioProposalOptions = pgTable(
  'studio_proposal_options',
  {
    id: text('id').primaryKey(),
    proposal: text('proposal')
      .notNull()
      .references(() => studioProposals.id),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    asset: text('asset').references(() => studioAssets.id),
    previewAsset: text('preview_asset').references(() => studioAssets.id),
    url: text('url').notNull().default(''),
    costNote: text('cost_note').notNull().default(''),
    timeNote: text('time_note').notNull().default(''),
    created: bigint('created', { mode: 'number' }).notNull(),
  },
  (table) => [index('studio_proposal_options_proposal').on(table.proposal)],
);

export const studioProposalFeedback = pgTable(
  'studio_proposal_feedback',
  {
    id: text('id').primaryKey(),
    proposal: text('proposal')
      .notNull()
      .references(() => studioProposals.id),
    option: text('option').references(() => studioProposalOptions.id),
    author: text('author').notNull(),
    kind: text('kind').notNull().default('comment'),
    text: text('text').notNull().default(''),
    created: bigint('created', { mode: 'number' }).notNull(),
  },
  (table) => [index('studio_proposal_feedback_proposal').on(table.proposal)],
);

export const studioVersions = pgTable(
  'studio_versions',
  {
    id: text('id').primaryKey(),
    project: text('project')
      .notNull()
      .references(() => studioProjects.id),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    sequence: integer('sequence').notNull().default(1),
    sourceVersion: text('source_version'),
    modelKind: text('model_kind').notNull().default('files'),
    files: text('files').notNull(),
    views: text('views').notNull().default('[]'),
    settings: text('settings')
      .notNull()
      .default('{"hiddenObjects":[],"palette":"warm"}'),
    unit: text('unit').notNull().default('m'),
    published: integer('published').notNull().default(0),
    created: bigint('created', { mode: 'number' }).notNull(),
  },
  (table) => [
    index('studio_versions_project').on(table.project),
    index('studio_versions_project_sequence').on(table.project, table.sequence),
  ],
);

export const studioComments = pgTable(
  'studio_comments',
  {
    id: text('id').primaryKey(),
    project: text('project')
      .notNull()
      .references(() => studioProjects.id),
    version: text('version').notNull(),
    author: text('author').notNull(),
    actor: text('actor'),
    text: text('text').notNull(),
    anchor: text('anchor').notNull().default(''),
    parent: text('parent'),
    scope: text('scope').notNull().default('point'),
    surface: text('surface').notNull(),
    point: text('point'),
    camera: text('camera'),
    state: text('state').notNull().default('abierto'),
    created: bigint('created', { mode: 'number' }).notNull(),
  },
  (table) => [
    index('studio_comments_project_version').on(table.project, table.version),
  ],
);

export const studioMeasurements = pgTable(
  'studio_measurements',
  {
    id: text('id').primaryKey(),
    project: text('project')
      .notNull()
      .references(() => studioProjects.id),
    version: text('version')
      .notNull()
      .references(() => studioVersions.id),
    name: text('name').notNull(),
    startPoint: text('start_point').notNull(),
    endPoint: text('end_point').notNull(),
    value: doublePrecision('value').notNull(),
    unit: text('unit').notNull().default('m'),
    createdBy: text('created_by').notNull(),
    created: bigint('created', { mode: 'number' }).notNull(),
  },
  (table) => [
    index('studio_measurements_project_version').on(
      table.project,
      table.version,
    ),
  ],
);

export const studioPlans = pgTable(
  'studio_plans',
  {
    id: text('id').primaryKey(),
    project: text('project')
      .notNull()
      .references(() => studioProjects.id),
    version: text('version')
      .notNull()
      .references(() => studioVersions.id),
    name: text('name').notNull(),
    sheet: text('sheet').notNull().default(''),
    mime: text('mime').notNull().default('application/pdf'),
    key: text('key'),
    size: bigint('size', { mode: 'number' }).notNull().default(0),
    createdBy: text('created_by').notNull(),
    created: bigint('created', { mode: 'number' }).notNull(),
  },
  (table) => [
    index('studio_plans_project_version').on(table.project, table.version),
  ],
);

export const studioUploads = pgTable('studio_uploads', {
  id: text('id').primaryKey(),
  project: text('project')
    .notNull()
    .references(() => studioProjects.id),
  key: text('key').notNull(),
  uploadId: text('upload_id').notNull(),
  name: text('name').notNull(),
  size: bigint('size', { mode: 'number' }).notNull(),
  completed: integer('completed').notNull().default(0),
});

// Billing belongs to a studio identity, not to an email or a session. Existing
// project ownership remains keyed by owner while the studio model is adopted.
export const billingStudios = pgTable('billing_studios', {
  id: text('id').primaryKey(),
  owner: text('owner').notNull().unique(),
  created: bigint('created', { mode: 'number' }).notNull(),
});

export const billingPriceVersions = pgTable(
  'billing_price_versions',
  {
    id: text('id').primaryKey(),
    plan: text('plan').notNull(),
    version: integer('version').notNull(),
    active: integer('active').notNull().default(0),
    currency: text('currency').notNull().default('ARS'),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    projectLimit: integer('project_limit').notNull(),
    storageLimitBytes: bigint('storage_limit_bytes', { mode: 'number' }).notNull(),
    professionalLimit: integer('professional_limit').notNull(),
    clientLimit: integer('client_limit'),
    teamPermissions: integer('team_permissions').notNull().default(0),
    advancedAdmin: integer('advanced_admin').notNull().default(0),
    prioritySupport: integer('priority_support').notNull().default(0),
    effectiveFrom: bigint('effective_from', { mode: 'number' }).notNull(),
    created: bigint('created', { mode: 'number' }).notNull(),
  },
  (table) => [
    uniqueIndex('billing_price_plan_version_unique').on(table.plan, table.version),
    index('billing_price_active').on(table.plan, table.active),
  ],
);

export const billingAccounts = pgTable('billing_accounts', {
  id: text('id').primaryKey(),
  studio: text('studio').notNull().unique().references(() => billingStudios.id),
  provider: text('provider').notNull().default('mercadopago'),
  state: text('state').notNull().default('trialing'),
  plan: text('plan').notNull().default('prueba'),
  priceVersion: text('price_version').references(() => billingPriceVersions.id),
  trialStarted: bigint('trial_started', { mode: 'number' }).notNull(),
  trialEnds: bigint('trial_ends', { mode: 'number' }).notNull(),
  graceEnds: bigint('grace_ends', { mode: 'number' }),
  paidThrough: bigint('paid_through', { mode: 'number' }),
  cancelAt: bigint('cancel_at', { mode: 'number' }),
  created: bigint('created', { mode: 'number' }).notNull(),
  updated: bigint('updated', { mode: 'number' }).notNull(),
});

export const billingSubscriptions = pgTable(
  'billing_subscriptions',
  {
    id: text('id').primaryKey(),
    account: text('account').notNull().references(() => billingAccounts.id),
    provider: text('provider').notNull().default('mercadopago'),
    externalId: text('external_id').unique(),
    externalReference: text('external_reference').notNull().unique(),
    priceVersion: text('price_version').notNull().references(() => billingPriceVersions.id),
    providerStatus: text('provider_status'),
    state: text('state').notNull().default('pending'),
    currency: text('currency').notNull().default('ARS'),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    checkoutUrl: text('checkout_url'),
    currentPeriodStart: bigint('current_period_start', { mode: 'number' }),
    currentPeriodEnd: bigint('current_period_end', { mode: 'number' }),
    nextChargeAt: bigint('next_charge_at', { mode: 'number' }),
    cancelAt: bigint('cancel_at', { mode: 'number' }),
    created: bigint('created', { mode: 'number' }).notNull(),
    updated: bigint('updated', { mode: 'number' }).notNull(),
  },
  (table) => [index('billing_subscription_account').on(table.account)],
);

export const billingCharges = pgTable('billing_charges', {
  id: text('id').primaryKey(),
  subscription: text('subscription').notNull().references(() => billingSubscriptions.id),
  provider: text('provider').notNull().default('mercadopago'),
  externalId: text('external_id').notNull().unique(),
  providerStatus: text('provider_status').notNull(),
  amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
  currency: text('currency').notNull(),
  periodStart: bigint('period_start', { mode: 'number' }),
  periodEnd: bigint('period_end', { mode: 'number' }),
  occurredAt: bigint('occurred_at', { mode: 'number' }).notNull(),
  created: bigint('created', { mode: 'number' }).notNull(),
});

export const billingWebhookEvents = pgTable('billing_webhook_events', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull().default('mercadopago'),
  externalKey: text('external_key').notNull().unique(),
  topic: text('topic').notNull(),
  resourceId: text('resource_id').notNull(),
  payload: text('payload').notNull(),
  receivedAt: bigint('received_at', { mode: 'number' }).notNull(),
  processedAt: bigint('processed_at', { mode: 'number' }),
  outcome: text('outcome'),
});

export const billingChanges = pgTable('billing_changes', {
  id: text('id').primaryKey(),
  account: text('account').notNull().references(() => billingAccounts.id),
  subscription: text('subscription').references(() => billingSubscriptions.id),
  action: text('action').notNull(),
  fromState: text('from_state'),
  toState: text('to_state'),
  fromPlan: text('from_plan'),
  toPlan: text('to_plan'),
  reason: text('reason'),
  created: bigint('created', { mode: 'number' }).notNull(),
});
