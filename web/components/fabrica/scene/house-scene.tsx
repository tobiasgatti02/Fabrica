'use client';

import { Component, Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { addAfterEffect, Canvas, useFrame, useThree, type GLProps } from '@react-three/fiber';
import { Environment, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
RectAreaLightUniformsLib.init();
import { range, INTERIOR_START } from '../timeline';
import { advanceProgress, assemblyPose, cameraPose, constructionProgress } from './camera-path';
import BlueprintGrid from './blueprint-grid';

const Interior = lazy(() => import('./interior'));
const EXTERIOR = '/models/casa-patio-exterior.glb';
const COMPACT_SCENE_WIDTH = 900;
export const INTERIOR = '/models/casa-patio-interior.glb';
export const DRACO = '/draco/';
export type SceneController = { progress: number; invalidate: () => void; reduced: boolean };
type Props = { controller: RefObject<SceneController>; onReady: () => void; onProgress: (progress: number) => void; onError: () => void };
type Assembly = { node: THREE.Object3D; origin: THREE.Vector3; start: number; end: number; lift: number; materials: { material: THREE.Material; opacity: number; transparent: boolean; depthWrite: boolean }[] };

export function prepareModel(source: THREE.Group, mobile: boolean) {
  const scene = source.clone(true);
  const materials = new Map<THREE.Material, THREE.Material>();
  scene.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    const glass = (Array.isArray(node.material) ? node.material[0] : node.material).name === 'Architectural glass';
    node.castShadow = !glass && !/Ground|gravel|Water|leaf|foliage|grasses/i.test(node.name);
    node.receiveShadow = !glass;
    // Material clones are owned by this instance; useGLTF's shared cache stays intact.
    const prepare = (source: THREE.Material) => {
      if (materials.has(source)) return materials.get(source)!;
      const m = source.clone() as THREE.MeshPhysicalMaterial;
      if ('envMapIntensity' in m) m.envMapIntensity = .65;
      if (m.map) m.map.anisotropy = mobile ? 2 : 4;
      if (m.name === 'Architectural glass') {
        // Thin architectural panes need reflections, without a second refraction render.
        m.transmission = 0; m.transparent = true; m.opacity = .17;
        m.depthWrite = false; m.roughness = .12; m.metalness = .22;
        node.renderOrder = 2;
      }
      materials.set(source, m); return m;
    };
    node.material = Array.isArray(node.material) ? node.material.map(prepare) : prepare(node.material);
  });
  return { scene, dispose: () => materials.forEach(material => material.dispose()) };
}

function Model({ controller }: Pick<Props, 'controller'>) {
  const gltf = useGLTF(EXTERIOR, DRACO);
  const mobile = useThree(s => s.size.width < COMPACT_SCENE_WIDTH);
  const prepared = useMemo(() => prepareModel(gltf.scene, mobile), [gltf.scene, mobile]);
  const assembly = useMemo(() => {
    const result: Assembly[] = [];
    prepared.scene.traverse(node => {
      if (typeof node.userData.start !== 'number') return;
      // Each assembly owns its reveal materials; shared model materials remain intact.
      const clones = new Map<THREE.Material, THREE.Material>();
      node.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return;
        const own = (source: THREE.Material) => {
          if (!clones.has(source)) clones.set(source, source.clone());
          return clones.get(source)!;
        };
        child.material = Array.isArray(child.material) ? child.material.map(own) : own(child.material);
      });
      const materials = [...clones.values()].map(material => ({ material, opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite }));
      result.push({ node, origin: node.position.clone(), start: node.userData.start, end: node.userData.end, lift: node.userData.lift, materials });
      node.visible = false;
    });
    return result;
  }, [prepared]);
  useEffect(() => {
    return () => { assembly.forEach(part => part.materials.forEach(({ material }) => material.dispose())); prepared.dispose(); };
  }, [prepared, assembly]);
  useFrame(() => {
    for (const part of assembly) {
      const pose = assemblyPose(constructionProgress(controller.current.progress), part.start, part.end, part.lift, controller.current.reduced);
      part.node.visible = pose.opacity > 0;
      // Whole, full-size materials descend, then decelerate into their final seats.
      part.node.position.y = part.origin.y + pose.offset;
      for (const original of part.materials) {
        original.material.opacity = original.opacity * pose.opacity;
        const transparent = original.transparent || pose.opacity < 1;
        if (original.material.transparent !== transparent) {
          original.material.transparent = transparent;
          original.material.needsUpdate = true;
        }
        original.material.depthWrite = original.depthWrite && pose.opacity === 1;
      }
    }
  }, -1);
  return <primitive object={prepared.scene} dispose={null} />;
}

// Signal readiness after R3F has rendered the loaded scene, not when the model mounts.
function FirstFrameReady({ onReady }: Pick<Props, 'onReady'>) {
  const rendered = useRef(false);
  useFrame(() => { rendered.current = true; });
  useEffect(() => {
    const unsubscribe = addAfterEffect(() => {
      if (!rendered.current) return;
      unsubscribe();
      onReady();
    });
    return unsubscribe;
  }, [onReady]);
  return null;
}

function Scene({ controller, onReady, onProgress }: Omit<Props, 'onError'>) {
  const { camera, invalidate, size, setDpr } = useThree();
  useEffect(() => { setDpr(Math.min(window.devicePixelRatio || 1, size.width < COMPACT_SCENE_WIDTH ? 1.25 : 1.5)); }, [setDpr, size.width]);
  const smooth = useRef(0);
  const reported = useRef(-1);
  const interiorLoaded = useRef(false);
  const markInteriorLoaded = useCallback(() => { interiorLoaded.current = true; invalidate(); }, [invalidate]);
  const pointer = useRef(new THREE.Vector2());
  const currentPointer = useRef(new THREE.Vector2());
  const [interiorReady, setInteriorReady] = useState(controller.current.progress > .5);
  const actual = useRef<SceneController>({ progress: controller.current.progress, invalidate, reduced: false });
  const destination = useMemo(() => new THREE.Vector3(), []);
  const focus = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    controller.current.invalidate = invalidate;
    invalidate();
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || controller.current.progress < INTERIOR_START || controller.current.reduced) return;
      pointer.current.set((e.clientX / window.innerWidth - .5) * 2, (e.clientY / window.innerHeight - .5) * 2);
      invalidate();
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => { controller.current.invalidate = () => {}; window.removeEventListener('pointermove', move); };
  }, [controller, invalidate]);
  useFrame((_, delta) => {
    const dt = Math.min(delta, .05);
    const raw = controller.current.progress;
    const target = interiorLoaded.current ? raw : Math.min(raw, .78);
    smooth.current = advanceProgress(smooth.current, target, dt, controller.current.reduced);
    if (Math.abs(reported.current - smooth.current) > .0002 || (smooth.current === target && reported.current !== target)) {
      reported.current = smooth.current;
      onProgress(smooth.current);
    }
    actual.current.progress = smooth.current;
    actual.current.reduced = controller.current.reduced;
    if (raw > .48 && !interiorReady) { useGLTF.preload(INTERIOR, DRACO); setInteriorReady(true); }
    const pose = cameraPose(smooth.current, size.width < COMPACT_SCENE_WIDTH, controller.current.reduced);
    destination.set(...pose.position); focus.set(...pose.target);
    if (controller.current.reduced || raw < INTERIOR_START) pointer.current.set(0, 0);
    currentPointer.current.lerp(pointer.current, 1 - Math.exp(-5 * dt));
    const inside = range(smooth.current, INTERIOR_START, 1);
    focus.x += currentPointer.current.x * .13 * inside;
    focus.y -= currentPointer.current.y * .07 * inside;
    camera.position.copy(destination); camera.lookAt(focus);
    const perspective = camera as THREE.PerspectiveCamera;
    if (Math.abs(perspective.fov - pose.fov) > .001) { perspective.fov = pose.fov; perspective.updateProjectionMatrix(); }
    if (target !== smooth.current || currentPointer.current.distanceTo(pointer.current) > .001) invalidate();
  }, -2);
  return <>
    <color attach="background" args={['#e6e3db']} />
    <fog attach="fog" args={['#e6e3db', 32, 95]} />
    <Environment files="/environment/rosendal-plains-1k.hdr" environmentIntensity={.65} environmentRotation={[0, 1.8, 0]} />
    <hemisphereLight args={['#e8eef4', '#a49175', .28]} />
    <directionalLight position={[-7, 11, 8]} intensity={3.2} color="#fff0d9" castShadow shadow-mapSize={size.width < COMPACT_SCENE_WIDTH ? [1024, 1024] : [2048, 2048]} shadow-camera-left={-11} shadow-camera-right={11} shadow-camera-top={10} shadow-camera-bottom={-9} shadow-camera-near={.5} shadow-camera-far={40} shadow-normalBias={.022} shadow-bias={-.00008} shadow-radius={3} />
    <Model controller={actual} />
    <BlueprintGrid controller={actual} />
    <FirstFrameReady onReady={onReady} />
    {interiorReady && <Suspense fallback={null}><Interior controller={actual} onReady={markInteriorLoaded} /></Suspense>}
    {interiorReady && <>
      <pointLight position={[.2, 2.43, -1.12]} color="#ffd7a3" intensity={5} distance={5} decay={2} />
      <rectAreaLight position={[0, 2.7, 2.1]} rotation={[0, Math.PI, 0]} width={4} height={1.8} intensity={2.4} color="#fff1d9" />
    </>}
  </>;
}

// Prevent Canvas from briefly painting with its default -Z rotation before the
// frame loop points the camera at the house.
function InitialCamera() {
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    const mobile = size.width < COMPACT_SCENE_WIDTH;
    camera.position.set(mobile ? 19.24 : 13, mobile ? 12 : 10, mobile ? 26.64 : 18);
    camera.lookAt(mobile ? .3 : -2.5, mobile ? 4.2 : .7, 0);
    const perspective = camera as THREE.PerspectiveCamera;
    perspective.fov = mobile ? 45 : 39;
    perspective.updateProjectionMatrix();
  }, [camera, size.width]);
  return null;
}

class SceneBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { console.error('[Fabrica] Scene unavailable', error); this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}
export default function HouseScene(props: Props) {
  const createRenderer = useCallback<Extract<GLProps, (...args: never[]) => unknown>>((defaults) => {
    try {
      const renderer = new THREE.WebGLRenderer({ ...defaults, canvas: defaults.canvas as HTMLCanvasElement, antialias: true, powerPreference: 'high-performance' });
      renderer.toneMapping = THREE.AgXToneMapping;
      renderer.toneMappingExposure = 1.15;
      return renderer;
    } catch (error) {
      // Canvas fallback children mount even when WebGL works. Detect renderer
      // creation failure here instead of firing onError from a fallback effect.
      queueMicrotask(props.onError);
      throw error;
    }
  }, [props.onError]);
  return <SceneBoundary onError={props.onError}>
    <Canvas shadows="percentage" frameloop="demand" dpr={[1, 1.5]} camera={{ position: [13, 10, 18], fov: 39, near: .05, far: 180 }} gl={createRenderer} onCreated={({ gl }) => { gl.domElement.addEventListener('webglcontextlost', props.onError, { once: true }); }} fallback={<span>Tu navegador no admite la vista 3D.</span>}>
      <InitialCamera />
      <Suspense fallback={null}><Scene {...props} /></Suspense>
    </Canvas>
  </SceneBoundary>;
}
