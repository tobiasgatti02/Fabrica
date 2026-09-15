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
    created: bigint('created', { mode: 'number' }).notNull().default(0),
  },
  (table) => [
    index('studio_projects_owner').on(table.owner),
    index('studio_projects_client').on(table.client),
  ],
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
