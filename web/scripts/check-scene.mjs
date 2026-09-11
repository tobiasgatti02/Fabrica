import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const timeline = 'data:text/javascript;base64,' + Buffer.from(compile('components/fabrica/timeline.ts')).toString('base64');
const camera = compile('components/fabrica/scene/camera-path.ts').replace("'../timeline'", JSON.stringify(timeline));
const { cameraPose, assemblyPose, advanceProgress, constructionProgress } = await import('data:text/javascript;base64,' + Buffer.from(camera).toString('base64'));
for (const mobile of [false,true]) {
 let previous;
 for (let i=0;i<=10000;i++) {
  const pose=cameraPose(i/10000,mobile);
  assert([...pose.position,...pose.target,pose.fov].every(Number.isFinite));
  if(previous) assert(Math.hypot(...pose.position.map((v,j)=>v-previous.position[j])) < .12, 'Camera discontinuity');
  const [x,y,z]=pose.position;
  if (z<3.55) { assert(y>1.6 && y<3.15,'Camera clips floor or canopy');assert(x>-.9 && x<.70,'Camera clips portal'); }
  previous=pose;
 }
 assert(cameraPose(1,mobile).position.every((v,i)=>Math.abs(v-[.03,1.76,1.30][i])<1e-10));
 assert.deepEqual(cameraPose(1,mobile,true).position,[.03,1.76,1.30]);
}
// Fast forward and reverse must visit intermediate stages at every frame rate.
for (const fps of [30, 60, 120]) {
 for (const [from, to] of [[0, 1], [1, 0]]) {
  let current = from;
  for (let frame = 0; frame < fps * 12; frame++) {
   const next = advanceProgress(current, to, 1 / fps);
   assert(Math.abs(next - current) <= .22 / fps + 1e-10, 'Scroll skips the cinematic sequence');
   assert(to > from ? next >= current && next <= to : next <= current && next >= to, 'Progress overshoots');
   current = next;
  }
  assert.equal(current, to, 'Progress never settles');
 }
}
assert.equal(advanceProgress(0, 1, 1 / 60, true), 1);
for (const part of ['exterior','interior']) {
 const bytes=fs.readFileSync(`public/models/casa-patio-${part}.glb`);
 assert.equal(bytes.toString('utf8',0,4),'glTF');assert.equal(bytes.readUInt32LE(8),bytes.length);
 const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
 assert(gltf.extensionsUsed.includes('KHR_draco_mesh_compression'));
 const stages=gltf.nodes.filter(n=>n.extras?.start!==undefined);
 for(const {extras:e} of stages) {
  assert(e.start<e.end && e.start>=0 && e.end<=1);
  const initial = assemblyPose(e.start, e.start, e.end, e.lift);
  assert.equal(initial.opacity, 0, 'Assembly pops into view');
  assert(initial.offset >= 5, 'Materials must fall from above');
  let previous = initial;
  for (let i = 1; i <= 100; i++) {
   const pose = assemblyPose(e.start + (e.end-e.start)*i/100, e.start, e.end, e.lift);
   assert(pose.offset <= previous.offset + 1e-10 && pose.offset >= -1e-10, 'Material rises or clips through its seat');
   assert(pose.opacity >= previous.opacity, 'Material flickers during descent');
   previous = pose;
  }
  assert.deepEqual(assemblyPose(constructionProgress(.76), e.start, e.end, e.lift), {offset: 0, opacity: 1}, 'Construction must finish before entering');
 }
 if(part==='exterior') assert(stages.length>=30);
 console.log(part, {bytes:bytes.length, meshes:gltf.meshes.length, primitives:gltf.meshes.reduce((n,m)=>n+m.primitives.length,0), triangles:gltf.meshes.flatMap(m=>m.primitives).reduce((n,p)=>n+gltf.accessors[p.indices].count/3,0), assemblies:stages.length});
}
console.log('PASS: 20,002 camera samples, portal clearance, endpoints, staged descents, scroll reversal, settling, and GLB structure.');
