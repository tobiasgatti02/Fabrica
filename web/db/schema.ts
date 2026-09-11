import { bigint, index, integer, pgTable, text } from 'drizzle-orm/pg-core';

export const studioUsers = pgTable('studio_users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  created: bigint('created', { mode: 'number' }).notNull(),
});

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

export const studioProjects = pgTable(
  'studio_projects',
  {
    id: text('id').primaryKey(),
    owner: text('owner').notNull(),
    share: text('share').notNull().unique(),
    name: text('name').notNull().default('Proyecto sin nombre'),
    created: bigint('created', { mode: 'number' }).notNull().default(0),
  },
  (table) => [index('studio_projects_owner').on(table.owner)],
);

export const studioVersions = pgTable(
  'studio_versions',
  {
    id: text('id').primaryKey(),
    project: text('project')
      .notNull()
      .references(() => studioProjects.id),
    name: text('name').notNull(),
    files: text('files').notNull(),
    views: text('views').notNull().default('[]'),
    published: integer('published').notNull().default(0),
    created: bigint('created', { mode: 'number' }).notNull(),
  },
  (table) => [index('studio_versions_project').on(table.project)],
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
