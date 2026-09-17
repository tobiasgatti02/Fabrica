// Run against the local vinext dev server. Uses its isolated local-preview identity.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base = 'http://localhost:3000';
const marker = `workspace-test-${randomUUID()}`;
const created = {
  projectTouched: false,
  task: '',
  inspiration: '',
  imageReference: '',
  asset: '',
  upload: '',
  proposal: '',
  member: '',
};

async function request(path, body, expected = 200) {
  const response = await fetch(`${base}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  assert.equal(response.status, expected, JSON.stringify(data));
  return data;
}

const initial = await request('/api/workspace?view=panel');
const project = initial.project.id;
const query = `?project=${encodeURIComponent(project)}`;
const withView = (view) => `${query}&view=${view}`;
const post = (body, expected = 200) =>
  request(`/api/workspace${query}`, body, expected);

try {
  await post({ action: 'update-project', stage: initial.project.stage, description: initial.project.description, startDate: initial.project.startDate, dueDate: initial.project.dueDate, progress: 37 });
  created.projectTouched = true;
  assert.equal((await request(`/api/workspace${withView('panel')}`)).project.progress, 37);
  await post({
    action: 'save-task',
    title: marker,
    status: 'todo',
    dueDate: null,
  });
  let panel = await request(`/api/workspace${withView('panel')}`);
  created.task = panel.tasks.find((item) => item.title === marker)?.id;
  assert(created.task);
  await post({
    action: 'save-task',
    id: created.task,
    title: marker,
    status: 'done',
    dueDate: null,
  });
  panel = await request(`/api/workspace${withView('panel')}`);
  assert.equal(
    panel.tasks.find((item) => item.id === created.task).status,
    'done',
  );

  await post(
    {
      action: 'add-inspiration',
      title: marker,
      url: 'https://example.com/',
      category: 'materiales',
    },
    201,
  );
  let board = await request(`/api/workspace${withView('inspiracion')}`);
  created.inspiration = board.inspiration.find(
    (item) => item.title === marker,
  )?.id;
  assert(created.inspiration);
  await post({
    action: 'update-inspiration',
    id: created.inspiration,
    category: 'materiales',
    status: 'aprobada',
  });
  board = await request(`/api/workspace${withView('inspiracion')}`);
  assert.equal(
    board.inspiration.find((item) => item.id === created.inspiration).status,
    'aprobada',
  );

  await post({ action: 'create-proposal', title: marker }, 200);
  let proposals = await request(`/api/workspace${withView('propuestas')}`);
  created.proposal = proposals.proposals.find(
    (item) => item.title === marker,
  )?.id;
  assert(created.proposal);
  await post({
    action: 'add-option',
    proposal: created.proposal,
    title: 'Opción A',
    costNote: 'Sin cambio',
  });
  proposals = await request(`/api/workspace${withView('propuestas')}`);
  const option = proposals.options.find(
    (item) => item.proposal === created.proposal,
  );
  assert(option);
  await post({
    action: 'set-proposal-status',
    id: created.proposal,
    status: 'review',
  });
  const studio = await request(`/api/studio${query}`);
  assert(studio.share);
  const guestQuery = `?share=${encodeURIComponent(studio.share)}`;
  const guest = await request(`/api/workspace${guestQuery}&view=propuestas`);
  assert(guest.proposals.some((item) => item.id === created.proposal));
  await request(
    `/api/workspace${guestQuery}`,
    { action: 'create-proposal', title: 'Prohibida' },
    403,
  );
  await request(
    `/api/workspace${guestQuery}`,
    {
      action: 'proposal-feedback',
      proposal: created.proposal,
      option: option.id,
      kind: 'approve',
      text: 'Elegimos A',
    },
    201,
  );
  proposals = await request(`/api/workspace${withView('propuestas')}`);
  assert.equal(
    proposals.proposals.find((item) => item.id === created.proposal)
      .selectedOption,
    option.id,
  );

  const imageBytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=',
    'base64',
  );
  const started = await post({
    action: 'begin-asset',
    name: `${marker}.png`,
    mime: 'image/png',
    size: imageBytes.length,
  });
  created.upload = started.id;
  const uploaded = await fetch(
    `${base}/api/workspace${query}&upload=${started.id}&part=1`,
    { method: 'PUT', body: imageBytes },
  );
  const part = await uploaded.json();
  assert.equal(uploaded.status, 200, JSON.stringify(part));
  const completed = await post(
    { action: 'finish-asset', id: started.id, parts: [part] },
    201,
  );
  created.upload = '';
  created.asset = completed.asset;
  await post(
    {
      action: 'add-inspiration',
      title: `${marker}-image`,
      asset: completed.asset,
      category: 'espacios',
    },
    201,
  );
  board = await request(`/api/workspace${withView('inspiracion')}`);
  created.imageReference = board.inspiration.find(
    (item) => item.title === `${marker}-image`,
  )?.id;
  assert(created.imageReference);
  const guestImage = await fetch(
    `${base}/api/workspace${guestQuery}&asset=${completed.asset}`,
  );
  assert.equal(guestImage.status, 200);
  assert.equal(guestImage.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await guestImage.arrayBuffer()), imageBytes);

  const invite = await post(
    {
      action: 'invite-member',
      email: `${marker}@example.com`,
      role: 'viewer',
      project,
    },
    201,
  );
  assert(invite.invite);
  const team = await request(`/api/workspace${withView('equipo')}`);
  created.member = team.members.find(
    (item) => item.email === `${marker}@example.com`,
  )?.id;
  assert(created.member);

  console.log(
    'Workspace API: tasks, inspiration, file upload, proposals, guest decisions and team invitations passed.',
  );
} finally {
  if (created.task) await post({ action: 'delete-task', id: created.task });
  if (created.inspiration)
    await post({ action: 'delete-inspiration', id: created.inspiration });
  if (created.imageReference)
    await post({ action: 'delete-inspiration', id: created.imageReference });
  if (created.asset)
    await post({ action: 'delete-asset', id: created.asset }).catch(() => {});
  if (created.upload)
    await post({ action: 'abort-asset', id: created.upload }).catch(() => {});
  if (created.proposal)
    await post({ action: 'delete-proposal', id: created.proposal });
  if (created.member)
    await post({ action: 'remove-member', id: created.member });
  if (created.projectTouched)
    await post({ action: 'update-project', stage: initial.project.stage, description: initial.project.description, startDate: initial.project.startDate, dueDate: initial.project.dueDate, progress: initial.project.progress });
}
