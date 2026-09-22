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
  },
  (table) => [
    index('studio_projects_owner').on(table.owner),
    index('studio_projects_client').on(table.client),
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
      .notNull()
      .references(() => studioInspiration.id),
    author: text('author').notNull(),
    text: text('text').notNull(),
    created: bigint('created', { mode: 'number' }).notNull(),
  },
  (table) => [
    index('studio_inspiration_comments_project').on(table.project),
    index('studio_inspiration_comments_inspiration').on(table.inspiration),
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
