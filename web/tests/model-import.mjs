import assert from 'node:assert/strict';
import * as THREE from 'three';
import { repairSketchUpColladaMaterials } from '../components/fabrica/model-import.ts';

function meshWithInvisibleMaterial() {
  const material = new THREE.MeshStandardMaterial({
    transparent: true,
    opacity: 0,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 3), material);
  const root = new THREE.Group();
  root.add(mesh);
  return { root, material };
}

const sketchUp = meshWithInvisibleMaterial();
repairSketchUpColladaMaterials(
  sketchUp.root,
  '<authoring_tool>Google SketchUp 7.0.8657</authoring_tool>',
);
assert.equal(sketchUp.material.opacity, 1);
assert.equal(sketchUp.material.transparent, false);

const otherExporter = meshWithInvisibleMaterial();
repairSketchUpColladaMaterials(
  otherExporter.root,
  '<authoring_tool>Another DAE exporter</authoring_tool>',
);
assert.equal(otherExporter.material.opacity, 0);
assert.equal(otherExporter.material.transparent, true);

console.log(
  'PASS: SketchUp zero-opacity materials are repaired without changing other DAE files.',
);

// Exercise the actual glTF pipeline: camera transforms must follow model normalization.
const { loadModel, disposeModel } =
  await import('../components/fabrica/model-import.ts');
globalThis.ProgressEvent ??= class ProgressEvent extends Event {
  constructor(type, values = {}) {
    super(type);
    Object.assign(this, values);
  }
};
const triangle = new Float32Array([0, 0, 0, 2, 0, 0, 0, 2, 0]);
function cameraFixture(withCamera) {
  const fixture = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: withCamera ? [0, 1] : [0] }],
    nodes: [
      { mesh: 0 },
      ...(withCamera
        ? [{ camera: 0, name: 'Vista del profesional', translation: [1, 1, 4] }]
        : []),
    ],
    cameras: withCamera
      ? [{ type: 'perspective', perspective: { yfov: 0.6, znear: 0.1 } }]
      : [],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: 'VEC3',
        min: [0, 0, 0],
        max: [2, 2, 0],
      },
    ],
    bufferViews: [{ buffer: 0, byteLength: triangle.byteLength }],
    buffers: [
      {
        byteLength: triangle.byteLength,
        uri: `data:application/octet-stream;base64,${Buffer.from(triangle.buffer).toString('base64')}`,
      },
    ],
  };
  return `data:model/gltf+json;base64,${Buffer.from(JSON.stringify(fixture)).toString('base64')}`;
}
const plainModel = await loadModel('plain.gltf', {
  'plain.gltf': cameraFixture(false),
});
assert.deepEqual(
  plainModel.userData.views,
  [],
  'No synthetic views for a model without cameras',
);
disposeModel(plainModel);
const cameraModel = await loadModel('camera.gltf', {
  'camera.gltf': cameraFixture(true),
});
assert.equal(cameraModel.userData.views.length, 1);
const [importedView] = cameraModel.userData.views;
assert.equal(importedView.name, 'Vista_del_profesional');
assert.deepEqual(importedView.position, [0, 5.5, 22]);
assert.deepEqual(importedView.target, [0, 5.5, 0]);
assert.equal(cameraModel.userData.stats.meshes, 1);
disposeModel(cameraModel);
console.log(
  'PASS: file cameras follow normalized geometry; camera-free models have no default views.',
);

const freeCadHouse = `# Created by FreeCAD <https://www.freecad.org>
o house
v 0 0 0
v 10 0 0
v 0 8 0
v 0 0 2
f 1 2 3
f 1 4 2
f 1 3 4
f 2 4 3`;
const freeCadModel = await loadModel('house.obj', {
  'house.obj': `data:text/plain;base64,${Buffer.from(freeCadHouse).toString('base64')}`,
});
const freeCadBounds = new THREE.Box3().setFromObject(freeCadModel);
const freeCadSize = freeCadBounds.getSize(new THREE.Vector3());
assert.equal(freeCadModel.userData.upAxis, 'z');
assert.ok(Math.abs(freeCadBounds.min.y) < 1e-6);
assert.ok(freeCadSize.y < freeCadSize.z);
disposeModel(freeCadModel);
console.log(
  'PASS: FreeCAD OBJ models are aligned from Z-up to the viewer Y-up axis.',
);
