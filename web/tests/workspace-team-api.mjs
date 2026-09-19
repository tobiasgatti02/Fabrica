// Run against localhost:3000. Creates and removes an isolated login and invitations.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);
const base = 'http://localhost:3000';
const email = `workspace-team-${randomUUID()}@example.com`;
const created = { members: [], task: '', tempProject: '' };
let cookie = '';

async function call(path, body, expected = 200, session = '') {
  const response = await fetch(`${base}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(session ? { cookie: session } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  assert.equal(response.status, expected, JSON.stringify(result));
  return result;
}

const owner = await call('/api/workspace?view=panel');
const project = owner.project.id;
const ownerPath = `/api/workspace?project=${encodeURIComponent(project)}`;
try {
  const registration = await fetch(`${base}/api/auth`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'register', name: 'Workspace Test Architect', email, password: 'Integration-Secure-2026' }),
  });
  assert.equal(registration.status, 201, await registration.text());
  cookie = registration.headers.get('set-cookie')?.split(';')[0] || '';
  assert(cookie);

  for (const role of ['viewer', 'architect']) {
    const invitation = await call(ownerPath, { action: 'invite-member', email, role, project }, 201);
    assert(invitation.invite);
    await call('/api/workspace', { action: 'accept-invite', token: invitation.invite }, 200, cookie);
    const members = await call(`${ownerPath}&view=equipo`);
    const member = members.members.find((item) => item.email === email && item.role === role);
    assert(member?.accepted);
    created.members.push(member.id);
    const access = await call(`${ownerPath}&view=panel`, undefined, 200, cookie);
    assert.equal(access.viewer.canEdit, role === 'architect');
    const model = await call(`/api/studio?project=${encodeURIComponent(project)}`, undefined, 200, cookie);
    assert(model.versions.length > 0);
    await call(ownerPath, { action: 'save-task', title: `${email}-task` }, role === 'viewer' ? 403 : 200, cookie);
    if (role === 'architect') {
      const panel = await call(`${ownerPath}&view=panel`);
      created.task = panel.tasks.find((item) => item.title === `${email}-task`)?.id;
      assert(created.task);
    }
  }
  const second = await call(ownerPath, { action: 'create-project', name: `Workspace role test ${email}` }, 201);
  created.tempProject = second.project;
  const secondPath = `/api/workspace?project=${encodeURIComponent(second.project)}`;
  const restricted = await call(ownerPath, { action: 'invite-member', email, role: 'viewer', project: second.project }, 201);
  await call('/api/workspace', { action: 'accept-invite', token: restricted.invite }, 200, cookie);
  const team = await call(`${ownerPath}&view=equipo`);
  created.members.push(team.members.find((item) => item.email === email && item.project === second.project)?.id);
  const restrictedPanel = await call(`${secondPath}&view=panel`, undefined, 200, cookie);
  assert.equal(restrictedPanel.viewer.canEdit, false, 'The architect role must not leak into the viewer project');
  await call(secondPath, { action: 'save-task', title: `${email}-restricted` }, 403, cookie);
  const restrictedModel = await call(`/api/studio?project=${encodeURIComponent(second.project)}`, undefined, 200, cookie);
  assert.equal(restrictedModel.owner, false, 'The 3D editor must apply project-specific permissions');
  console.log('Workspace team: invitation acceptance, viewer restrictions, architect editing and model access passed.');
} finally {
  if (created.task) await call(ownerPath, { action: 'delete-task', id: created.task });
  for (const id of created.members.filter(Boolean)) await call(ownerPath, { action: 'remove-member', id });
  if (created.tempProject) await sql`delete from studio_projects where id = ${created.tempProject} and owner = ${owner.project.owner}`;
  const [user] = await sql`select id from studio_users where email = ${email}`;
  if (user) {
    await sql`delete from studio_sessions where "user" = ${user.id}`;
    await sql`delete from studio_users where id = ${user.id} and email = ${email}`;
  }
}
