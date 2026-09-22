// Run against a local dev server. All workspace requests are mocked: no user data is changed.
// PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node tests/inspiration-browser.mjs
import assert from 'node:assert/strict';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || 'playwright'
);
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  permissions: ['clipboard-read', 'clipboard-write'],
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
let counter = 0,
  failNextAdd = false,
  uploadCount = 0;
const uploads = new Map(),
  mediaRequests = [];
const data = {
  viewer: {
    name: 'Ana',
    role: 'owner',
    guest: false,
    canEdit: true,
    accountOwner: false,
    permissions: { panel: 'edit', inspiracion: 'edit', modelo: 'edit' },
  },
  project: { id: 'board-test', name: 'Prueba del lienzo' },
  projects: [{ id: 'board-test', name: 'Prueba del lienzo' }],
  projectStats: {},
  inspiration: [],
  assets: [],
  tasks: [],
  proposals: [],
  options: [],
  feedback: [],
  members: [],
  clients: [],
};
const transparentPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aipcAAAAASUVORK5CYII=',
  'base64',
);
await page.route('**/api/workspace?**', async (route) => {
  const request = route.request(),
    url = new URL(request.url());
  if (url.searchParams.has('asset')) {
    const id = url.searchParams.get('asset');
    mediaRequests.push(id);
    return route.fulfill({
      contentType: 'image/png',
      body: uploads.get(id)?.bytes || transparentPng,
    });
  }
  if (request.method() === 'GET') return route.fulfill({ json: data });
  if (request.method() === 'PUT') {
    const upload = uploads.get(url.searchParams.get('upload'));
    upload.bytes = request.postDataBuffer();
    return route.fulfill({ json: { etag: 'test-etag' } });
  }
  const body = request.postDataJSON();
  if (body.action === 'begin-asset') {
    uploadCount++;
    const id = 'asset-' + ++counter;
    uploads.set(id, {
      id,
      project: data.project.id,
      name: body.name,
      mime: body.mime,
      size: body.size,
      created: Date.now(),
    });
    return route.fulfill({ json: { id, partSize: 8 * 1024 * 1024 } });
  }
  if (body.action === 'finish-asset') {
    const { bytes: _bytes, ...asset } = uploads.get(body.id);
    data.assets.push(asset);
    return route.fulfill({ json: { asset: body.id } });
  }
  if (body.action === 'edit-inspiration') {
    const item = data.inspiration.find((item) => item.id === body.id);
    Object.assign(item, {
      title: body.title,
      note: body.note,
      url: body.url,
      category: body.category,
    });
    return route.fulfill({ json: { ok: true } });
  }
  if (body.action === 'add-inspiration') {
    if (failNextAdd) {
      failNextAdd = false;
      return route.fulfill({
        status: 503,
        json: { error: 'Guardado de prueba fallido' },
      });
    }
    const id = 'ref-' + ++counter;
    data.inspiration.push({
      id,
      project: data.project.id,
      title: body.title,
      note: body.note || '',
      url: body.url || '',
      asset: body.asset || null,
      category: body.category,
      status: 'idea',
      author: 'Ana',
      created: Date.now(),
    });
    // Keep the saving placeholder observable.
    await new Promise((resolve) => setTimeout(resolve, 120));
    return route.fulfill({ json: { ok: true, id } });
  }
  throw new Error('Unexpected workspace operation: ' + body.action);
});
const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
const board = page.locator('.free-canvas');
const savedCards = page.locator(
  '.inspiration-world > article:not(.inspiration-pending)',
);
async function ready(count) {
  await page.waitForFunction(
    (count) =>
      Number(document.querySelector('.free-canvas')?.dataset.referenceCount) ===
        count && !document.querySelector('.inspiration-pending'),
    count,
  );
}
async function nativeImage(color) {
  await page.evaluate(async (color) => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 600, 400);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/png'),
    );
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  }, color);
  await page.keyboard.press(modifier + '+V');
}
async function pasteText(text) {
  await page.evaluate((text) => navigator.clipboard.writeText(text), text);
  await page.keyboard.press(modifier + '+V');
}
try {
  await page.goto(
    (process.env.BOARD_TEST_URL || 'http://localhost:3000') +
      '/estudio/inspiracion?project=board-test',
  );
  await board.waitFor();
  const skipTour = page.getByRole('button', {
    name: 'Omitir recorrido',
    exact: true,
  });
  if (await skipTour.isVisible()) await skipTour.click();
  await board.click({ position: { x: 330, y: 210 } });
  await nativeImage('#c7a584');
  await ready(1);
  assert.equal(uploadCount, 1);
  assert.equal(
    await page.locator('.inspiration-form').count(),
    0,
    'Native image paste must not open a form',
  );
  assert.match(await savedCards.first().innerText(), /Por Ana/);
  const first = await savedCards.first().evaluate((node) => ({
    x: parseFloat(node.style.left),
    y: parseFloat(node.style.top),
  }));
  assert.ok(
    Math.abs(first.x - 270) < 3 && Math.abs(first.y - 120) < 3,
    'Image must land at the click position',
  );
  const imageRect = await savedCards
    .first()
    .locator('.inspiration-media')
    .boundingBox();
  await page.mouse.move(imageRect.x + 80, imageRect.y + 60);
  await page.mouse.down();
  await page.mouse.move(imageRect.x + 120, imageRect.y + 90, { steps: 3 });
  await page.mouse.up();
  assert.equal(
    await savedCards.first().evaluate((node) => parseFloat(node.style.left)),
    first.x + 40,
    'Image itself is draggable',
  );
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  console.log(
    'PASS native clipboard image -> direct upload + positioned card + author',
  );

  await savedCards.first().locator('.inspiration-drag-handle').click();
  await page.keyboard.press(modifier + '+C');
  await board.click({ position: { x: 850, y: 150 } });
  await page.keyboard.press(modifier + '+V');
  await ready(2);
  assert.equal(uploadCount, 1, 'Internal copy must reuse the stored file');
  assert.equal(data.inspiration[0].asset, data.inspiration[1].asset);
  await board.click({ position: { x: 800, y: 500 } });
  await nativeImage('#a9bc91');
  await ready(3);
  assert.equal(
    uploadCount,
    2,
    'An external image must override the previous internal copy',
  );
  console.log(
    'PASS native copy/paste duplicates without storing media twice; external clipboard overrides it',
  );

  await board.click({ position: { x: 150, y: 430 } });
  await pasteText('Madera clara\nLuz natural y texturas cálidas.');
  await ready(4);
  assert.equal(await page.locator('.post-it').count(), 1);
  await board.click({ position: { x: 550, y: 490 } });
  await pasteText('https://example.com/referencia');
  await ready(5);
  assert.equal(data.inspiration[4].url, 'https://example.com/referencia');

  await board.click({ button: 'right', position: { x: 550, y: 490 } });
  await page
    .getByRole('menuitem', { name: 'Crear post-it', exact: true })
    .click();
  await page.getByRole('textbox', { name: 'Nota', exact: true }).click();
  await pasteText('Texto dentro del formulario');
  assert.equal(
    await page.getByRole('textbox', { name: 'Nota', exact: true }).inputValue(),
    'Texto dentro del formulario',
  );
  assert.equal(
    data.inspiration.length,
    5,
    'Editing a field must not paste a board card',
  );
  await page.keyboard.press('Escape');
  await page.locator('.inspiration-form').waitFor({ state: 'detached' });
  console.log(
    'PASS links and text paste directly; normal paste inside a text field is untouched',
  );

  // Drag the first card and verify zoom-aware motion plus keyboard support.
  await page.getByRole('button', { name: 'Restablecer zoom' }).click();
  const handle = savedCards.first().locator('.inspiration-drag-handle');
  const rect = await handle.boundingBox();
  await page.mouse.move(rect.x + 20, rect.y + 12);
  await page.mouse.down();
  await page.mouse.move(rect.x + 110, rect.y + 72, { steps: 5 });
  await page.mouse.up();
  const moved = await savedCards.first().evaluate((node) => ({
    x: parseFloat(node.style.left),
    y: parseFloat(node.style.top),
  }));
  assert.ok(
    Math.abs(moved.x - first.x - 90) < 3 &&
      Math.abs(moved.y - first.y - 60) < 3,
  );
  await page.keyboard.press('ArrowRight');
  assert.equal(
    await savedCards.first().evaluate((node) => parseFloat(node.style.left)),
    moved.x + 10,
  );

  const transformBefore = await page
    .locator('.inspiration-world')
    .getAttribute('style');
  await board.click({ position: { x: 80, y: 620 } });
  await page.keyboard.down('Space');
  const bounds = await board.boundingBox();
  await page.mouse.move(bounds.x + 60, bounds.y + 600);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 160, bounds.y + 550, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.up('Space');
  assert.notEqual(
    await page.locator('.inspiration-world').getAttribute('style'),
    transformBefore,
  );
  await page.getByRole('button', { name: 'Alejar' }).click();
  assert.notEqual(
    await page.getByRole('button', { name: 'Restablecer zoom' }).innerText(),
    '100%',
  );
  await page.getByRole('button', { name: 'Ver todas las referencias' }).click();
  console.log('PASS drag, keyboard movement, pan, zoom and fit');

  // A failed reference save can retry the completed upload without sending its bytes again.
  failNextAdd = true;
  await board.click({ position: { x: 30, y: 500 } });
  await nativeImage('#cfa4a4');
  await page.getByRole('button', { name: 'Reintentar', exact: true }).waitFor();
  const beforeRetry = uploadCount;
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await ready(6);
  assert.equal(uploadCount, beforeRetry);
  console.log(
    'PASS failed save keeps preview and reuses uploaded asset on retry',
  );

  // Multiple dropped files become separate references.
  await board.evaluate((node) => {
    const transfer = new DataTransfer();
    transfer.items.add(
      new File(['first file'], 'plano.pdf', { type: 'application/pdf' }),
    );
    transfer.items.add(
      new File(['second file'], 'medidas.txt', { type: 'text/plain' }),
    );
    const bounds = node.getBoundingClientRect();
    node.dispatchEvent(
      new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer,
        clientX: bounds.left + 650,
        clientY: bounds.top + 350,
      }),
    );
  });
  await ready(8);
  assert.ok(data.inspiration.some((item) => item.title === 'plano'));
  assert.ok(data.inspiration.some((item) => item.title === 'medidas'));
  console.log('PASS multiple dropped files');

  await page.getByRole('button', { name: 'Ver todas las referencias' }).click();
  await page.screenshot({
    path: '/tmp/fabrica-inspiration-board.png',
    fullPage: true,
  });
  const storedPosition = await savedCards
    .first()
    .evaluate((node) => node.style.left);
  await page.waitForFunction(
    () =>
      Object.keys(
        JSON.parse(
          localStorage.getItem('fabrica:inspiration:board-test') || '{}',
        ),
      ).length === 8,
  );
  await page.reload();
  await ready(8);
  await page.waitForFunction(
    (left) =>
      document.querySelector('.inspiration-world > article')?.style.left ===
      left,
    storedPosition,
  );
  console.log('PASS positions survive reload in this browser');

  data.viewer.permissions.inspiracion = 'view';
  data.viewer.canEdit = false;
  await page.reload();
  await ready(8);
  await board.click({ position: { x: 40, y: 600 } });
  await nativeImage('#222222');
  await pasteText('Must not be saved');
  await page.waitForTimeout(250);
  assert.equal(data.inspiration.length, 8);
  assert.equal(
    await page.getByRole('button', { name: 'Nueva idea', exact: true }).count(),
    0,
  );
  assert.deepEqual(errors, []);
  console.log('PASS read-only permission, no browser errors');

  const distantAsset = {
    id: 'distant-image',
    name: 'Distant image',
    project: data.project.id,
    mime: 'image/png',
    size: 100,
    created: Date.now(),
  };
  data.assets.push(distantAsset);
  data.inspiration.push({
    id: 'distant-ref',
    project: data.project.id,
    asset: distantAsset.id,
    title: 'Far away',
    note: '',
    url: '',
    category: 'general',
    status: 'idea',
    author: 'Ana',
    created: Date.now(),
  });
  await page.evaluate(() => {
    const positions = JSON.parse(
      localStorage.getItem('fabrica:inspiration:board-test'),
    );
    positions['distant-ref'] = { x: 8000, y: -6000 };
    localStorage.setItem(
      'fabrica:inspiration:board-test',
      JSON.stringify(positions),
    );
  });
  mediaRequests.length = 0;
  await page.reload();
  await ready(9);
  assert.equal(
    await page.locator('img[src*="distant-image"]').count(),
    0,
    'Offscreen media must not even have a mounted image URL',
  );
  assert.ok(
    !mediaRequests.includes('distant-image'),
    'Offscreen image bytes must not be requested',
  );
  await page.getByRole('button', { name: 'Ver todas las referencias' }).click();
  await page.locator('img[src*="distant-image"]').waitFor();
  await page.waitForFunction(
    () => document.querySelector('img[src*="distant-image"]')?.complete,
  );
  assert.ok(mediaRequests.includes('distant-image'));
  console.log(
    'PASS offscreen image is fetched only when brought into view; fit handles distant negative coordinates',
  );
} catch (error) {
  await page.screenshot({
    path: '/tmp/fabrica-inspiration-failure.png',
    fullPage: true,
  });
  console.error('Browser errors:', errors);
  throw error;
} finally {
  await browser.close();
}
