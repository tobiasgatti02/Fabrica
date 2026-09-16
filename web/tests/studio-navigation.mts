import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { advanceOrbitTarget } from '../components/fabrica/scene/navigation.js';

for (const scale of [0.01, 1, 1000]) {
  const camera = new Vector3(0, 0, scale);
  const target = new Vector3();
  const step = scale * 0.04;
  for (let i = 0; i < 200; i++) {
    const previous = camera.clone();
    camera.sub(target).multiplyScalar(0.8).add(target);
    const pose = camera.clone();
    const direction = target.clone().sub(camera).normalize();
    advanceOrbitTarget(camera, target, step);
    assert.ok(camera.equals(pose), 'Retargeting must not jump the camera');
    assert.ok(
      target.clone().sub(camera).normalize().distanceTo(direction) < 1e-9,
      'Retargeting must preserve viewing direction',
    );
    assert.ok(
      camera.distanceTo(previous) >= step * 0.199,
      'Zoom must keep advancing instead of stalling',
    );
  }
  assert.ok(
    camera.z < -scale,
    'Camera must travel past its original orbit target',
  );
}
const camera = new Vector3(0, 2, 10);
const target = new Vector3(0, 2, 0);
advanceOrbitTarget(camera, target, 0.3);
assert.deepEqual(
  target.toArray(),
  [0, 2, 0],
  'Exterior orbit target remains unchanged',
);
console.log(
  'PASS: continuous interior zoom across three model scales, stable viewing direction and exterior orbit.',
);
