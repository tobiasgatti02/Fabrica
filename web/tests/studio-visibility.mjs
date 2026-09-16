import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the actual persistence boundary with an isolated API and React setters.
const source = ts.createSourceFile('studio.tsx', fs.readFileSync('components/fabrica/studio.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let saveVisibility;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'saveVisibility') {
    saveVisibility = ts.transpileModule(`(${node.initializer.getText(source)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  }
  ts.forEachChild(node, visit);
}
visit(source);
assert.ok(saveVisibility);
for (const professional of [false, true]) {
  const writes = [];
  let local;
  let stored = ['roof'];
  let versions = [{ id: 'v1', settings: '{}' }];
  let failure = false;
  let toast;
  const save = vm.runInNewContext(saveVisibility, {
    professional, version: 'v1', activeProject: 'project',
    setClientVisibility: value => { local = value; },
    setHiddenObjects: value => { stored = value; },
    studioRequest: async (...args) => { writes.push(args); if (failure) throw new Error('offline'); },
    setVersions: update => { versions = update(versions); },
    parseVersionSettings: JSON.parse,
    showToast: value => { toast = value; },
  });
  await save(['roof', 'wall'], ['roof']);
  if (!professional) {
    assert.equal(writes.length, 0, 'Client visibility must never write to the API');
    assert.equal(local.version, 'v1');
    assert.deepEqual(local.hidden, ['roof', 'wall']);
    assert.deepEqual(stored, ['roof'], 'Published visibility stays intact');
    await save([], ['roof', 'wall']);
    assert.equal(local.hidden.length, 0, 'Client can restore all objects');
    assert.equal(writes.length, 0);
  } else {
    assert.equal(writes.length, 1);
    assert.deepEqual(JSON.parse(versions[0].settings).hiddenObjects, ['roof', 'wall']);
    failure = true;
    await save([], ['roof', 'wall']);
    assert.deepEqual(stored, ['roof', 'wall'], 'Failed writes restore previous visibility');
    assert.equal(toast, 'offline');
  }
}
console.log('PASS: client hide/restore stays local; professional visibility persists and rolls back on failure.');
