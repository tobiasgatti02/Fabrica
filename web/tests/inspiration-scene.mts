import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { boardReducer, emptyBoard, parseElements, safeReferenceUrl, simplifyStroke, SpatialIndex, intersects, elementIndex } from '../features/workspace/inspiration-scene';
import { boundsForCanvasElement, canvasElementAt, type CanvasElement } from '../features/workspace/inspiration-board';

const shape: CanvasElement = { id: 'a', type: 'rectangle', x: -50, y: -100, width: 200, height: 100, stroke: '#566b55', weight: 3, style: 'solid' };
assert.deepEqual(parseElements([shape]), [shape]);
for (const malicious of [{ ...shape, x: Infinity }, { ...shape, height: -10 }, { ...shape, stroke: 'url(https://tracker.invalid)' }, { ...shape, weight: NaN }, { ...shape, type: 'stroke', points: [] }, { ...shape, type: 'stroke', points: [{ x: 1, y: 2 }, { x: '2', y: 2 }] }]) assert.deepEqual(parseElements([malicious]), []);
assert.equal(parseElements([shape, shape]).length, 1);
assert.equal(safeReferenceUrl('javascript:alert(1)'), null);
assert.equal(safeReferenceUrl('data:text/html,<script>alert(1)</script>'), null);
assert.equal(safeReferenceUrl('https://user:secret@example.com'), null);
assert.equal(safeReferenceUrl('https://example.com/idea'), 'https://example.com/idea');

let doc = boardReducer(emptyBoard, { type: 'add', element: shape });
const before = { elements: doc.elements, positions: doc.positions };
for (let i = 1; i <= 40; i++) doc = boardReducer(doc, { type: 'positions', update: () => ({ photo: { x: i, y: i * 2 } }) });
doc = boardReducer(doc, { type: 'commit', before });
assert.equal(doc.past.length, 2, 'one drag should add one history entry');
doc = boardReducer(doc, { type: 'undo' });
assert.deepEqual(doc.positions, {});
assert.equal(doc.elements.length, 1);
doc = boardReducer(doc, { type: 'redo' });
assert.deepEqual(doc.positions.photo, { x: 40, y: 80 });
doc = boardReducer(doc, { type: 'undo' });
doc = boardReducer(doc, { type: 'remove', id: 'a' });
assert.equal(doc.future.length, 0);
assert.equal(doc.elements.length, 0);

const points = Array.from({ length: 4096 }, (_, i) => ({ x: i, y: i * 2 }));
assert.deepEqual(simplifyStroke(points), [points[0], points.at(-1)]);
const elbow = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }];
assert.deepEqual(simplifyStroke(elbow, .5), elbow);
assert.deepEqual(boundsForCanvasElement({ ...shape, type: 'stroke', points: elbow }), { left: 0, top: 0, right: 20, bottom: 20 });
const ellipse: CanvasElement = { ...shape, type: 'circle', x: 0, y: 0, width: 200, height: 50 };
assert.equal(canvasElementAt([ellipse], { x: 100, y: 85 }, 0), undefined, 'ellipse hit testing respects height');

const entries = Array.from({ length: 10_000 }, (_, i) => ({ value: i, bounds: { left: (i % 100) * 350 - 17000, top: Math.floor(i / 100) * 500 - 25000, right: (i % 100) * 350 - 16700, bottom: Math.floor(i / 100) * 500 - 24700 } }));
const start = performance.now();
const index = new SpatialIndex(entries);
const built = performance.now();
for (let i = 0; i < 100; i++) {
  const box = { left: -20000 + i * 380, top: -26000 + i * 480, right: -18600 + i * 380, bottom: -25000 + i * 480 };
  assert.deepEqual(index.search(box).sort((a, b) => a - b), entries.filter((entry) => intersects(entry.bounds, box)).map((entry) => entry.value));
}
assert.equal(new SpatialIndex([]).search({ left: 0, top: 0, right: 10, bottom: 10 }).length, 0);
assert.equal(elementIndex([shape]).search({ left: -20, top: -90, right: 50, bottom: -50 }).length, 1);
console.log(`PASS validation, URL safety, gesture history, stroke simplification, ellipse hit testing, 10,000-object spatial queries. Index build: ${(built - start).toFixed(1)}ms. Query comparison: ${(performance.now() - built).toFixed(1)}ms.`);
