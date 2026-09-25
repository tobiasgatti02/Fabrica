// Run against vinext dev with PLAYWRIGHT_MODULE pointing to playwright/index.mjs.
// Workspace requests are mocked; the test never changes user data.
import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

const data = {
  viewer: { name: 'Ana', role: 'owner', guest: false, canEdit: true, accountOwner: true,
    external: false, permissions: { panel: 'edit', inspiracion: 'edit', modelo: 'edit' } },
  project: { id: 'board-optimistic-test', name: 'Mesa de prueba' },
  projects: [{ id: 'board-optimistic-test', name: 'Mesa de prueba' }],
  projectStats: {}, tasks: [], budgetItems: [], worktables: [],
  inspiration: [], inspirationComments: [], inspirationReactions: [],
  proposals: [], options: [], feedback: [], assets: [], members: [], clients: [],
};
const gates = new Map();
let deleteRequests = 0;
function pause(action) {
  let release;
  const promise = new Promise((resolve) => { release = resolve; });
  gates.set(action, { promise, release });
}
function resume(action) {
  const gate = gates.get(action);
  assert.ok(gate, `Expected a pending ${action} request`);
  gates.delete(action);
  gate.release();
}
async function eventually(predicate, message) {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail(message);
}

await page.route('**/api/workspace?**', async (route) => {
  const request = route.request();
  if (request.method() === 'GET') return route.fulfill({ json: structuredClone(data) });
  const body = request.postDataJSON();
  if (gates.has(body.action)) await gates.get(body.action).promise;
  if (body.action === 'add-inspiration') {
    data.inspiration.push({ id: body.id, project: data.project.id, title: body.title,
      note: body.note, url: body.url, asset: body.asset || null,
      worktable: body.worktable === 'default' ? null : body.worktable,
      category: body.category, status: 'idea', author: 'Ana', created: Date.now() });
    return route.fulfill({ json: { ok: true, id: body.id } });
  }
  if (body.action === 'edit-inspiration') {
    const item = data.inspiration.find((entry) => entry.id === body.id);
    assert.ok(item, 'The edit must wait for the new post-it to be saved');
    Object.assign(item, { note: body.note, url: body.url });
    return route.fulfill({ json: { ok: true } });
  }
  if (body.action === 'add-inspiration-comment') {
    data.inspirationComments.push({ id: body.id, project: data.project.id,
      inspiration: body.inspiration || null, element: body.element || null,
      worktable: body.worktable || null, author: 'Ana', mine: true,
      text: body.text, created: Date.now() });
    return route.fulfill({ json: { ok: true, id: body.id } });
  }
  if (body.action === 'delete-inspiration-comment') {
    data.inspirationComments = data.inspirationComments.filter((entry) => entry.id !== body.id);
    return route.fulfill({ json: { ok: true } });
  }
  if (body.action === 'set-inspiration-reaction') {
    data.inspirationReactions = data.inspirationReactions.filter((entry) => !(entry.inspiration === body.inspiration && entry.mine));
    if (body.emoji) data.inspirationReactions.push({ id: crypto.randomUUID(), project: data.project.id,
      inspiration: body.inspiration, emoji: body.emoji, mine: true, created: Date.now() });
    return route.fulfill({ json: { ok: true } });
  }
  if (body.action === 'delete-inspiration') {
    deleteRequests++;
    data.inspiration = data.inspiration.filter((entry) => entry.id !== body.id);
    data.inspirationComments = data.inspirationComments.filter((entry) => entry.inspiration !== body.id);
    data.inspirationReactions = data.inspirationReactions.filter((entry) => entry.inspiration !== body.id);
    return route.fulfill({ json: { ok: true } });
  }
  throw new Error(`Unexpected workspace action: ${body.action}`);
});

try {
  // The share URL omits ?project, which previously made optimistic updates
  // target an empty cache key even after the response selected a project.
  await page.goto((process.env.BOARD_TEST_URL || 'http://localhost:3000') +
    '/estudio/inspiracion?share=optimistic-test');
  const board = page.locator('.free-canvas');
  await board.waitFor();
  const skipTour = page.getByRole('button', { name: 'Omitir recorrido' });
  if (await skipTour.isVisible()) await skipTour.click();

  pause('add-inspiration');
  await page.getByRole('button', { name: 'Crear post-it' }).click();
  await board.click({ position: { x: 530, y: 320 } });
  const card = page.locator('.inspiration-world > article[data-card]');
  await card.waitFor({ timeout: 600 });
  assert.equal(data.inspiration.length, 0, 'The card should render before the server replies');
  assert.equal(await page.locator('.inspiration-pending-sticky').count(), 0,
    'A new post-it should use the real editable card immediately');
  const note = card.locator('[contenteditable="true"]');
  await note.waitFor();
  await page.waitForTimeout(100);
  assert.equal(await note.evaluate((node) => document.activeElement === node), true,
    'The new post-it should receive keyboard focus');
  await note.fill('Idea inmediata');
  await note.evaluate((node) => node.blur());
  resume('add-inspiration');
  await eventually(() => data.inspiration[0]?.note === 'Idea inmediata',
    'The edit was not saved after the creation request');

  await card.locator('.inspiration-drag-handle').click();
  await page.getByRole('button', { name: 'Comentar post-it' }).click();
  pause('add-inspiration-comment');
  await page.getByRole('textbox', { name: 'Responder al comentario' }).fill('Comentario inmediato');
  await page.getByRole('button', { name: 'Enviar respuesta' }).click();
  assert.equal(data.inspirationComments.length, 0);
  await page.getByLabel('Comentarios de Post-it', { exact: true })
    .getByText('Comentario inmediato').waitFor({ timeout: 600 });
  resume('add-inspiration-comment');
  await eventually(() => data.inspirationComments.length === 1, 'The comment was not saved');
  await page.waitForTimeout(250);
  assert.equal(await page.getByLabel('Comentarios de Post-it', { exact: true })
    .getByText('Comentario inmediato').count(), 1,
    'The comment should remain visible after workspace reconciliation');

  pause('set-inspiration-reaction');
  await page.getByRole('button', { name: 'Agregar reacción' }).click();
  await page.getByRole('button', { name: 'Reaccionar 👍' }).click();
  assert.equal(data.inspirationReactions.length, 0);
  await card.getByRole('button', { name: '👍 1' }).waitFor({ timeout: 600 });
  resume('set-inspiration-reaction');
  await eventually(() => data.inspirationReactions.length === 1, 'The reaction was not saved');

  pause('delete-inspiration');
  await page.getByRole('button', { name: 'Eliminar selección' }).click();
  await card.waitFor({ state: 'detached', timeout: 600 });
  assert.equal(data.inspiration.length, 1, 'Deletion should render before the server replies');
  resume('delete-inspiration');
  await eventually(() => data.inspiration.length === 0, 'The deletion was not saved');

  pause('add-inspiration');
  await page.getByRole('button', { name: 'Crear post-it' }).click();
  await board.click({ position: { x: 700, y: 420 } });
  await card.waitFor();
  const beforeDrag = await card.evaluate((node) => ({ x: parseFloat(node.style.left), y: parseFloat(node.style.top) }));
  const dragHandle = card.locator('.inspiration-drag-handle');
  const handleBounds = await dragHandle.boundingBox();
  assert.ok(handleBounds);
  await page.mouse.move(handleBounds.x + handleBounds.width / 2, handleBounds.y + handleBounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBounds.x + handleBounds.width / 2 + 80, handleBounds.y + handleBounds.height / 2 + 50, { steps: 8 });
  await page.mouse.up();
  const afterDrag = await card.evaluate((node) => ({ x: parseFloat(node.style.left), y: parseFloat(node.style.top) }));
  assert.ok(afterDrag.x > beforeDrag.x + 50 && afterDrag.y > beforeDrag.y + 30,
    'The post-it should move when dragged by its handle');
  const noteBounds = await card.locator('.inspiration-note-text').boundingBox();
  assert.ok(noteBounds);
  await page.mouse.move(noteBounds.x + 70, noteBounds.y + 70);
  await page.mouse.down();
  await page.mouse.move(noteBounds.x + 140, noteBounds.y + 115, { steps: 8 });
  await page.mouse.up();
  const afterBodyDrag = await card.evaluate((node) => ({ x: parseFloat(node.style.left), y: parseFloat(node.style.top) }));
  assert.ok(afterBodyDrag.x > afterDrag.x + 40 && afterBodyDrag.y > afterDrag.y + 20,
    'The post-it should move when dragged by its body');
  await page.getByRole('button', { name: 'Lápiz y dibujo' }).click();
  await page.getByRole('button', { name: 'Borrador de objetos' }).click();
  await card.locator('.inspiration-note-text').click({ position: { x: 70, y: 70 } });
  await card.waitFor({ state: 'detached', timeout: 1000 });
  resume('add-inspiration');
  await eventually(() => deleteRequests === 2 && data.inspiration.length === 0,
    'Erasing the post-it body was not saved');

  assert.deepEqual(errors, []);
  console.log('PASS post-it creation, movement, edit, comment, reaction and deletion');
} finally {
  for (const gate of gates.values()) gate.release();
  await browser.close();
}
