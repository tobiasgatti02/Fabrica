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
