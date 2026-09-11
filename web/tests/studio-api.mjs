// Integration test against the local preview only; uses an isolated test identity.
// Run: node tests/studio-api.mjs while npm run dev serves localhost:3000.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
const base = 'http://localhost:3000/api/studio';
const identity = { 'oai-authenticated-user-id': `test-${randomUUID()}`, 'oai-authenticated-user-email': 'studio-test@example.invalid' };
const sha = data => createHash('sha256').update(data).digest('hex');
async function request(body, query = '', expected = 200) {
  const response = await fetch(base + query, { headers: { ...identity, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}) });
  const result = await response.json(); assert.equal(response.status, expected, JSON.stringify(result)); return result;
}
const initial = await request();
const createdProject = await request({ action: 'create-project', name: `Integration ${randomUUID()}` }, '', 201);
const owner = `?project=${encodeURIComponent(createdProject.project.id)}`;
const selected = await request(undefined, owner);
const shared = `?share=${selected.share}`;
assert.equal((await request(undefined, shared)).owner, false);
await request({ action: 'begin', name: 'bad.glb', size: 0 }, owner, 400);
await request({ action: 'begin', name: 'huge.glb', size: 6 * 1024 ** 3 }, owner, 413);
await request({ action: 'begin', name: 'model.glb', size: 100 }, shared, 403);
const bytes = Buffer.alloc(8 * 1024 * 1024 + 53, 73);
const upload = await request({ action: 'begin', name: 'multipart-test.bin', size: bytes.length }, owner);
const parts = [];
for (let offset = 0, part = 1; offset < bytes.length; offset += upload.partSize, part++) {
  const response = await fetch(`${base}${owner}&upload=${upload.id}&part=${part}`, { method: 'PUT', headers: identity, body: bytes.subarray(offset, offset + upload.partSize) });
  const result = await response.json(); assert.equal(response.status, 200, JSON.stringify(result)); parts.push(result);
}
const file = await request({ action: 'finish', id: upload.id, parts }, owner);
const v1 = await request({ action: 'version', name: 'Test delivery', files: [file.key] }, owner);
assert.equal((await request(undefined, shared)).versions.length, 0);
await request(undefined, `${shared}&asset=${encodeURIComponent(file.key)}`, 404);
const ownerFile = await fetch(`${base}${owner}&asset=${encodeURIComponent(file.key)}`, { headers: identity });
assert.equal(sha(Buffer.from(await ownerFile.arrayBuffer())), sha(bytes));
await request({ action: 'comment', text: 'Draft hidden', surface: 'Wall', point: [1, 2, 3], version: v1.id }, owner);
assert.equal((await request(undefined, shared)).comments.length, 0);
await request({ action: 'publish', id: v1.id }, shared, 403);
await request({ action: 'publish', id: v1.id }, owner);
assert.equal((await request(undefined, shared)).versions.length, 1);
await request({ action: 'view', version: v1.id, name: 'Entry', position: [4, 3, 2], target: [0, 1, 0] }, shared, 403);
await request({ action: 'view', version: v1.id, name: 'Entry', position: [4, 3, 2], target: [0, 1, 0] }, owner);
const versionWithView = (await request(undefined, owner)).versions.find(item => item.id === v1.id);
assert.deepEqual(JSON.parse(versionWithView.views)[0].position, [4, 3, 2]);
await request({ action: 'comment', scope: 'project', text: 'General decision' }, shared);
assert.equal((await request(undefined, shared)).comments.find(comment => comment.text === 'General decision').version, '*');
await request({ action: 'comment', text: 'Customer review', surface: 'Wall', point: [1, 2, 3], version: v1.id }, shared);
await request({ action: 'comment', text: 'Old delivery', surface: 'Wall', point: [0, 1, 2], version: 'v02' }, owner);
const beforeResolve = await request(undefined, owner);
const draftComment = beforeResolve.comments.find(comment => comment.version === v1.id && comment.text === 'Draft hidden');
assert(draftComment?.id);
await request({ action: 'resolve', id: draftComment.id }, shared, 403);
await request({ action: 'resolve', id: draftComment.id }, owner);
const comments = (await request(undefined, owner)).comments;
assert.equal(comments.find(c => c.id === draftComment.id).state, 'resuelto');
assert.equal(comments.find(c => c.version === v1.id && c.text === 'Customer review').state, 'abierto');
assert.equal(comments.find(c => c.version === 'v02').state, 'abierto');
const publishedFile = await fetch(`${base}${shared}&asset=${encodeURIComponent(file.key)}`, { headers: identity });
assert.equal(sha(Buffer.from(await publishedFile.arrayBuffer())), sha(bytes));
const cancelled = await request({ action: 'begin', name: 'cancel.glb', size: 10 }, owner);
await request({ action: 'abort', id: cancelled.id }, owner);
await request({ action: 'finish', id: cancelled.id, parts: [] }, owner, 404);
console.log('PASS: projects, multipart integrity, publication, saved views, project/point comments, scoped resolution and authenticated assets.');
