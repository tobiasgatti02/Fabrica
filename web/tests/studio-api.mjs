// Integration test against the local preview only; uses an isolated test identity.
// Run: node tests/studio-api.mjs while npm run dev serves localhost:3000.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
const base = 'http://localhost:3000/api/studio';
const ownerAuth = await fetch('http://localhost:3000/api/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'register', name: 'Studio integration',
    email: `studio-${randomUUID()}@example.com`, password: 'Integration-Secure-2026' }),
});
assert.equal(ownerAuth.status, 201, await ownerAuth.text());
const identity = { cookie: ownerAuth.headers.get('set-cookie').split(';')[0] };
const clientName = `Familia Test ${randomUUID().slice(0, 8)}`;
const clientEmail = `familia-${randomUUID().slice(0, 8)}@example.com`;
const sha = (data) => createHash('sha256').update(data).digest('hex');
async function request(body, query = '', expected = 200) {
  const response = await fetch(base + query, {
    headers: {
      ...identity,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  assert.equal(response.status, expected, JSON.stringify(result));
  return result;
}
async function guestRequest(body, query = '', expected = 200) {
  const response = await fetch(base + query, {
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  assert.equal(response.status, expected, JSON.stringify(result));
  return result;
}
const initial = await request();
assert(initial.clients.length >= 1);
const createdClient = await request(
  {
    action: 'create-client',
    name: clientName,
    email: clientEmail,
  },
  '',
  201,
);
const createdProject = await request(
  {
    action: 'create-project',
    name: `Integration ${randomUUID()}`,
    client: createdClient.client.id,
  },
  '',
  201,
);
const owner = `?project=${encodeURIComponent(createdProject.project.id)}`;
const selected = await request(undefined, owner);
assert.equal(selected.project.client, createdClient.client.id);
assert.equal(selected.shareEnabled, true);
assert(selected.shareExpires > Date.now());
assert.equal(
  selected.clients.find((client) => client.id === createdClient.client.id)
    .email,
  clientEmail,
);
const shared = `?share=${selected.share}`;
const sharedProject = await guestRequest(undefined, shared);
assert.equal(sharedProject.owner, false);
assert.equal(sharedProject.viewer.guest, true);
assert.equal(sharedProject.viewer.name, clientName);
assert.deepEqual(sharedProject.clients, []);
const clientAuth = await fetch('http://localhost:3000/api/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'register',
    name: clientName,
    email: clientEmail,
    password: 'Cuenta-Segura-2026',
  }),
});
assert.equal(clientAuth.status, 201, await clientAuth.text());
const clientCookie = clientAuth.headers.get('set-cookie')?.split(';')[0];
assert(clientCookie);
const linkedAccess = await fetch(base + shared, {
  headers: { cookie: clientCookie },
});
assert.equal(linkedAccess.status, 200, await linkedAccess.text());
const recoveredAccessResponse = await fetch(base, {
  headers: { cookie: clientCookie },
});
const recoveredAccess = await recoveredAccessResponse.json();
assert.equal(
  recoveredAccessResponse.status,
  200,
  JSON.stringify(recoveredAccess),
);
assert.equal(recoveredAccess.owner, false);
assert.equal(recoveredAccess.project.id, createdProject.project.id);
await request({ action: 'begin', name: 'bad.glb', size: 0 }, owner, 400);
await request(
  { action: 'begin', name: 'huge.glb', size: 6 * 1024 ** 3 },
  owner,
  413,
);
await request({ action: 'begin', name: 'model.glb', size: 100 }, shared, 403);
const bytes = Buffer.alloc(8 * 1024 * 1024 + 53, 73);
const upload = await request(
  { action: 'begin', name: 'multipart-test.bin', size: bytes.length },
  owner,
);
const parts = [];
for (
  let offset = 0, part = 1;
  offset < bytes.length;
  offset += upload.partSize, part++
) {
  const response = await fetch(
    `${base}${owner}&upload=${upload.id}&part=${part}`,
    {
      method: 'PUT',
      headers: identity,
      body: bytes.subarray(offset, offset + upload.partSize),
    },
  );
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  parts.push(result);
}
const file = await request({ action: 'finish', id: upload.id, parts }, owner);
const v1 = await request(
  { action: 'version', name: 'Test delivery', files: [file.key] },
  owner,
);
assert.equal((await request(undefined, shared)).versions.length, 0);
await request(
  undefined,
  `${shared}&asset=${encodeURIComponent(file.key)}`,
  404,
);
const ownerFile = await fetch(
  `${base}${owner}&asset=${encodeURIComponent(file.key)}`,
  { headers: identity },
);
assert.equal(sha(Buffer.from(await ownerFile.arrayBuffer())), sha(bytes));
await request(
  {
    action: 'comment',
    text: 'Draft hidden',
    surface: 'Wall',
    point: [1, 2, 3],
    version: v1.id,
  },
  owner,
);
assert.equal((await request(undefined, shared)).comments.length, 0);
await request({ action: 'publish', id: v1.id }, shared, 403);
await request({ action: 'publish', id: v1.id }, owner);
assert.equal((await request(undefined, shared)).versions.length, 1);
await request(
  {
    action: 'view',
    version: v1.id,
    name: 'Entry',
    position: [4, 3, 2],
    target: [0, 1, 0],
  },
  shared,
  403,
);
await guestRequest(
  {
    action: 'comment',
    scope: 'project',
    text: 'Comentario sin crear una cuenta',
  },
  shared,
);
assert.equal(
  (await request(undefined, owner)).comments.find(
    (comment) => comment.text === 'Comentario sin crear una cuenta',
  ).author,
  clientName,
);
const guestComment = (await request(undefined, owner)).comments.find(
  (comment) => comment.text === 'Comentario sin crear una cuenta',
);
assert.equal(guestComment.mine, false);
assert.equal((await guestRequest(undefined, shared)).comments.find(
  (comment) => comment.id === guestComment.id,
).mine, true);
await request({ action: 'delete-comment', id: guestComment.id }, owner, 403);
const linkedDelete = await fetch(base + shared, {
  method: 'POST',
  headers: { cookie: clientCookie, 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'delete-comment', id: guestComment.id }),
});
assert.equal(linkedDelete.status, 200, await linkedDelete.text());
assert(!(await request(undefined, owner)).comments.some(
  (comment) => comment.id === guestComment.id,
));
await request(
  {
    action: 'view',
    version: v1.id,
    name: 'Entry',
    position: [4, 3, 2],
    target: [0, 1, 0],
  },
  owner,
);
const versionWithView = (await request(undefined, owner)).versions.find(
  (item) => item.id === v1.id,
);
assert.deepEqual(JSON.parse(versionWithView.views)[0].position, [4, 3, 2]);
await request(
  { action: 'visibility', version: v1.id, hiddenObjects: ['Roof', 'Tree'] },
  shared,
  403,
);
await request(
  { action: 'visibility', version: v1.id, hiddenObjects: ['Roof', 'Tree'] },
  owner,
);
assert.deepEqual(
  JSON.parse(
    (await request(undefined, owner)).versions.find((item) => item.id === v1.id)
      .settings,
  ).hiddenObjects,
  ['Roof', 'Tree'],
);
await request(
  {
    action: 'measurement',
    version: v1.id,
    name: 'Window width',
    startPoint: [0, 0, 0],
    endPoint: [3, 4, 0],
    unit: 'm',
  },
  shared,
  403,
);
await request(
  {
    action: 'measurement',
    version: v1.id,
    name: 'Window width',
    startPoint: [0, 0, 0],
    endPoint: [3, 4, 0],
    unit: 'm',
  },
  owner,
  201,
);
assert.equal(
  (await request(undefined, owner)).measurements.find(
    (item) => item.name === 'Window width',
  ).value,
  5,
);
await request(
  {
    action: 'plan',
    version: v1.id,
    name: 'Ground floor',
    sheet: 'A-01',
    mime: 'application/pdf',
    key: file.key,
    size: file.size,
  },
  owner,
  201,
);
assert.equal(
  (await request(undefined, owner)).plans.find(
    (item) => item.name === 'Ground floor',
  ).sheet,
  'A-01',
);
const copy = await request(
  {
    action: 'create-version',
    sourceVersion: v1.id,
    name: 'Second delivery',
    description: 'Copied model with independent review state.',
  },
  owner,
  201,
);
const copiedVersion = (await request(undefined, owner)).versions.find(
  (item) => item.id === copy.id,
);
assert.equal(copiedVersion.published, 0);
assert.equal(copiedVersion.sourceVersion, v1.id);
assert(copiedVersion.sequence > versionWithView.sequence);
await request(
  { action: 'comment', scope: 'project', text: 'General decision' },
  shared,
);
assert.equal(
  (await request(undefined, shared)).comments.find(
    (comment) => comment.text === 'General decision',
  ).version,
  '*',
);
await request(
  {
    action: 'comment',
    text: 'Customer review',
    surface: 'Wall',
    point: [1, 2, 3],
    version: v1.id,
  },
  shared,
);
const beforeResolve = await request(undefined, owner);
const draftComment = beforeResolve.comments.find(
  (comment) => comment.version === v1.id && comment.text === 'Draft hidden',
);
assert(draftComment?.id);
await request({ action: 'resolve', id: draftComment.id }, shared, 403);
await request({ action: 'resolve', id: draftComment.id }, owner);
const comments = (await request(undefined, owner)).comments;
assert.equal(comments.find((c) => c.id === draftComment.id).state, 'resuelto');
assert.equal(comments.find((c) => c.id === draftComment.id).mine, true);
await guestRequest({ action: 'delete-comment', id: draftComment.id }, shared, 403);
await request({ action: 'delete-comment', id: draftComment.id }, owner);
assert(!(await request(undefined, owner)).comments.some((c) => c.id === draftComment.id));
assert.equal(
  comments.find((c) => c.version === v1.id && c.text === 'Customer review')
    .state,
  'abierto',
);
const publishedFile = await fetch(
  `${base}${shared}&asset=${encodeURIComponent(file.key)}`,
);
assert.equal(sha(Buffer.from(await publishedFile.arrayBuffer())), sha(bytes));
await request({ action: 'revoke-share' }, owner);
await guestRequest(undefined, shared, 404);
const renewed = await request({ action: 'share', days: 7 }, owner);
assert.equal(renewed.shareEnabled, true);
assert(renewed.shareExpires > Date.now());
await guestRequest(undefined, `?share=${encodeURIComponent(renewed.share)}`);
const cancelled = await request(
  { action: 'begin', name: 'cancel.glb', size: 10 },
  owner,
);
await request({ action: 'abort', id: cancelled.id }, owner);
await request({ action: 'finish', id: cancelled.id, parts: [] }, owner, 404);
// Deleting a source must preserve derived models and project-wide comments.
await request({ action: 'delete-version', id: v1.id }, `?share=${encodeURIComponent(renewed.share)}`, 403);
await request({ action: 'delete-version', id: initial.versions[0].id }, owner, 404);
await request({ action: 'delete-version', id: v1.id }, owner);
let remaining = await request(undefined, owner);
assert(!remaining.versions.some((v) => v.id === v1.id));
assert(!remaining.comments.some((v) => v.version === v1.id));
assert(!remaining.measurements.some((v) => v.version === v1.id));
assert(!remaining.plans.some((v) => v.version === v1.id));
assert(remaining.comments.some((v) => v.scope === 'project'));
assert.equal(remaining.versions.find((v) => v.id === copy.id).sourceVersion, null);
const keptFile = await fetch(`${base}${owner}&asset=${encodeURIComponent(file.key)}`, { headers: identity });
assert.equal(keptFile.status, 200);
assert.equal(sha(Buffer.from(await keptFile.arrayBuffer())), sha(bytes));
await request({ action: 'delete-version', id: v1.id }, owner, 404);
await request({ action: 'delete-version', id: copy.id }, owner);
remaining = await request(undefined, owner);
assert.equal(remaining.versions.length, 0, 'Last version can be removed');
console.log(
  'PASS: clients, guest links, optional account recovery, revocation, project portfolio, multipart integrity, version copies, visibility, measures, plans, saved views, scoped comments and protected assets.',
);
