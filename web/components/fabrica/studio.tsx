'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  CircleDot,
  Eye,
  EyeOff,
  Focus,
  House,
  Maximize2,
  MessageCircle,
  MessageSquarePlus,
  MousePointer2,
  PanelRightClose,
  PanelRightOpen,
  Rotate3D,
  Send,
  Share2,
  Link2,
  CalendarClock,
  RotateCcw,
  Sparkles,
  FileBox as FileBoxIcon,
  UserRound,
  UserPlus,
  Upload,
  Plus,
  Minus,
  Move,
  Play,
  UsersRound,
  Mail,
  Download,
  Camera,
  LoaderCircle,
  FolderPlus,
  LogOut,
  Box,
  CopyPlus,
  FileText,
  Files,
  Ruler,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ImportDialog } from './import-dialog';
import { studioRequest } from '@/features/studio/api';
import {
  formatBytes,
  parseJson,
  parseVersionSettings,
  versionLabel,
  type StoredVersion,
  type StoredFile,
  type StoredClient,
  type StoredProject,
  type StoredView,
  type StoredMeasurement,
  type StoredPlan,
} from '@/features/studio/domain';
import {
  loadModel,
  disposeModel,
  extension,
  viewFormats,
} from './model-import';
import { Wordmark } from './landing';
import { StudioAuthPanel } from './studio-auth-panel';

type Stage = 0 | 1 | 2 | 3;
type Version = string;

type SurfaceSelection = {
  surface: string;
  point: [number, number, number];
  anchor?: string;
};

type Viewpoint = {
  position: [number, number, number];
  target: [number, number, number];
};

type Comment = {
  id: string | number;
  anchor: string;
  parent?: string | null;
  author: string;
  initials: string;
  text: string;
  time: string;
  surface: string;
  version: Version;
  scope: 'point' | 'project';
  point?: [number, number, number];
  camera?: Viewpoint;
  state: 'abierto' | 'resuelto';
};

type SceneObject = { key: string; label: string };
type ReferencePoint = {
  id: string;
  label: string;
  point: [number, number, number];
  count: number;
  resolved: boolean;
};

type Measurement = Omit<StoredMeasurement, 'startPoint' | 'endPoint'> & {
  startPoint: [number, number, number];
  endPoint: [number, number, number];
};

const stages = [
  { number: '01', label: 'Idea', detail: 'Volumen y orientación' },
  { number: '02', label: 'Estructura', detail: 'Muros y cubierta' },
  { number: '03', label: 'Materiales', detail: 'Piedra, madera y luz' },
  { number: '04', label: 'Interior', detail: 'El espacio habitado' },
] as const;

// Neutral starting camera; saved views are authored or supplied by the model.
const initialCamera: Viewpoint = {
  position: [10.8, 7.4, 12.5],
  target: [0, 1.2, 0],
};

function parseStoredViews(value?: string): StoredView[] {
  const parsed = parseJson<StoredView[]>(value, []);
  return Array.isArray(parsed) ? parsed : [];
}

function samePoint(
  first?: [number, number, number],
  second?: [number, number, number],
) {
  if (!first || !second) return false;
  return (
    Math.hypot(
      first[0] - second[0],
      first[1] - second[1],
      first[2] - second[2],
    ) < 0.02
  );
}

function addBox(
  group: THREE.Group,
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material,
  surface?: string,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (surface) mesh.userData.surface = surface;
  group.add(mesh);
  return mesh;
}

function HouseScene({
  stage,
  palette,
  interactionMode,
  view,
  selection,
  onSelect,
  onMeasure,
  hiddenObjects,
  referencePoints,
  measurements,
  measurementStart,
  onReferenceSelect,
  onObjectCatalog,
  cameraCommand,
  imported,
  savedViews,
  onCameraChange,
  onReady,
  onError,
}: {
  cameraCommand: { id: number; action: string };
  imported: THREE.Group | null;
  savedViews: StoredView[];
  onReady: () => void;
  onError: (message: string) => void;
  onCameraChange: (viewpoint: Viewpoint) => void;
  stage: Stage;
  palette: 'original' | 'warm';
  interactionMode: 'navigate' | 'comment' | 'measure';
  view: string;
  selection: SurfaceSelection | null;
  onSelect: (selection: SurfaceSelection) => void;
  onMeasure: (selection: SurfaceSelection) => void;
  hiddenObjects: string[];
  referencePoints: ReferencePoint[];
  measurements: Measurement[];
  measurementStart: SurfaceSelection | null;
  onReferenceSelect: (reference: ReferencePoint) => void;
  onObjectCatalog: (objects: SceneObject[]) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const state = useRef({
    stage,
    palette,
    interactionMode,
    view,
    selection,
    onSelect,
    onMeasure,
    hiddenObjects,
    referencePoints,
    measurements,
    measurementStart,
    onReferenceSelect,
    onObjectCatalog,
    cameraCommand,
    imported,
    savedViews,
    onCameraChange,
  });
  const [pins, setPins] = useState<
    Array<ReferencePoint & { x: number; y: number; visible: boolean }>
  >([]);

  useEffect(() => {
    state.current = {
      stage,
      palette,
      interactionMode,
      view,
      selection,
      onSelect,
      onMeasure,
      hiddenObjects,
      referencePoints,
      measurements,
      measurementStart,
      onReferenceSelect,
      onObjectCatalog,
      cameraCommand,
      imported,
      savedViews,
      onCameraChange,
    };
  }, [
    stage,
    palette,
    interactionMode,
    view,
    selection,
    onSelect,
    onMeasure,
    hiddenObjects,
    referencePoints,
    measurements,
    measurementStart,
    onReferenceSelect,
    onObjectCatalog,
    cameraCommand,
    imported,
    savedViews,
    onCameraChange,
  ]);

  useEffect(() => {
    const container = host.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#d8d7ce');
    scene.fog = new THREE.Fog('#d8d7ce', 22, 42);

    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.set(...initialCamera.position);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      onError(
        'No se pudo iniciar el visor 3D. Comprobá que WebGL esté disponible y volvé a intentar.',
      );
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 0.1;
    controls.maxDistance = 100;
    controls.maxPolarAngle = Math.PI;
    controls.screenSpacePanning = true;
    controls.target.set(...initialCamera.target);

    scene.add(new THREE.HemisphereLight('#fff9e8', '#7a806f', 2.8));
    const sun = new THREE.DirectionalLight('#fff2d2', 4.2);
    sun.position.set(6, 12, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -14;
    sun.shadow.camera.right = 14;
    sun.shadow.camera.top = 14;
    sun.shadow.camera.bottom = -14;
    scene.add(sun);

    const groundMaterial = new THREE.MeshStandardMaterial({
      color: '#c4c5b8',
      roughness: 1,
    });
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(45, 45),
      groundMaterial,
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.16;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(44, 44, '#aeb0a4', '#cbccc3');
    grid.position.y = -0.145;
    grid.material.opacity = 0.28;
    grid.material.transparent = true;
    scene.add(grid);

    const model = new THREE.Group();
    model.rotation.y = -0.11;
    scene.add(model);
    const markup = new THREE.Group();
    scene.add(markup);

    const clearMarkup = () => {
      while (markup.children.length) {
        const child = markup.children[0];
        markup.remove(child);
        if (child instanceof THREE.Line || child instanceof THREE.Mesh) {
          child.geometry.dispose();
          const material = Array.isArray(child.material)
            ? child.material
            : [child.material];
          material.forEach((item) => item.dispose());
        }
      }
    };

    const concrete = new THREE.MeshStandardMaterial({
      color: '#bbb9ae',
      roughness: 0.95,
    });
    const plaster = new THREE.MeshStandardMaterial({
      color: '#e9e4d7',
      roughness: 0.86,
    });
    const plasterOld = new THREE.MeshStandardMaterial({
      color: '#d8d0bf',
      roughness: 0.9,
    });
    const stone = new THREE.MeshStandardMaterial({
      color: '#928575',
      roughness: 0.98,
    });
    const timber = new THREE.MeshStandardMaterial({
      color: '#8c6041',
      roughness: 0.74,
    });
    const timberOld = new THREE.MeshStandardMaterial({
      color: '#665849',
      roughness: 0.82,
    });
    const dark = new THREE.MeshStandardMaterial({
      color: '#323832',
      roughness: 0.7,
    });
    const glass = new THREE.MeshPhysicalMaterial({
      color: '#aec0bc',
      roughness: 0.12,
      metalness: 0.05,
      transmission: 0.35,
      transparent: true,
      opacity: 0.68,
    });
    const warm = new THREE.MeshStandardMaterial({
      color: '#c98759',
      roughness: 0.88,
    });
    const linen = new THREE.MeshStandardMaterial({
      color: '#d6c6a9',
      roughness: 1,
    });
    const green = new THREE.MeshStandardMaterial({
      color: '#59664b',
      roughness: 1,
    });
    const water = new THREE.MeshPhysicalMaterial({
      color: '#718f8e',
      roughness: 0.18,
      transparent: true,
      opacity: 0.82,
    });

    const foundation = new THREE.Group();
    addBox(
      foundation,
      [11.6, 0.28, 7.7],
      [0, 0, 0],
      concrete,
      'Plataforma de hormigón',
    );
    addBox(
      foundation,
      [5.4, 0.18, 2.7],
      [-1.8, 0.12, 0.45],
      new THREE.MeshStandardMaterial({ color: '#a99e8d', roughness: 1 }),
      'Piso del patio',
    );
    model.add(foundation);

    const structure = new THREE.Group();
    addBox(structure, [0.26, 3.4, 7.1], [-5.05, 1.8, 0], plaster, 'Muro oeste');
    addBox(
      structure,
      [10.2, 3.4, 0.25],
      [0, 1.8, -3.35],
      plaster,
      'Muro posterior',
    );
    addBox(
      structure,
      [0.28, 3.4, 2.5],
      [5.05, 1.8, -2.15],
      plaster,
      'Muro este',
    );
    addBox(
      structure,
      [0.28, 3.4, 1.65],
      [5.05, 1.8, 2.75],
      plaster,
      'Muro este',
    );
    addBox(
      structure,
      [3.8, 3.4, 0.25],
      [3.15, 1.8, 3.35],
      plaster,
      'Muro del dormitorio',
    );
    [-3.1, 1.0, 4.85].forEach((x) =>
      addBox(
        structure,
        [0.18, 3.45, 0.18],
        [x, 1.82, 3.17],
        dark,
        'Estructura del ventanal',
      ),
    );
    model.add(structure);

    const materials = new THREE.Group();
    addBox(
      materials,
      [3.35, 3.05, 0.18],
      [-3.15, 1.65, 3.18],
      glass,
      'Ventanal del estar',
    );
    addBox(
      materials,
      [3.72, 3.0, 0.18],
      [-0.95, 1.65, 3.18],
      glass,
      'Ventanal del estar',
    );
    addBox(
      materials,
      [0.18, 3.0, 3.0],
      [4.91, 1.65, 0.15],
      glass,
      'Ventanal lateral',
    );
    addBox(
      materials,
      [2.1, 3.12, 0.16],
      [2.15, 1.68, 3.17],
      stone,
      'Paño de piedra',
    );
    addBox(
      materials,
      [5.35, 0.16, 2.7],
      [-1.8, 0.24, 0.45],
      timber,
      'Deck de madera',
    );
    const pool = addBox(
      materials,
      [3.15, 0.08, 1.5],
      [-1.3, 0.3, 0.38],
      water,
      'Espejo de agua',
    );
    pool.castShadow = false;
    model.add(materials);

    const interior = new THREE.Group();
    addBox(
      interior,
      [2.8, 0.55, 0.95],
      [-2.6, 0.62, -0.75],
      linen,
      'Sofá del estar',
    );
    addBox(
      interior,
      [0.95, 0.35, 0.7],
      [-1.65, 0.45, -1.55],
      warm,
      'Mesa baja',
    );
    addBox(
      interior,
      [2.25, 0.18, 0.95],
      [2.35, 0.62, -1.65],
      timber,
      'Isla de cocina',
    );
    [-3.8, -2.8, 3.05].forEach((x, i) => {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.15, 1.7, 10),
        timber,
      );
      trunk.position.set(x, 1.02, i === 2 ? 1.6 : -1.9);
      interior.add(trunk);
      const crown = new THREE.Mesh(
        new THREE.IcosahedronGeometry(i === 2 ? 0.75 : 0.5, 1),
        green,
      );
      crown.position.set(x, 2.0, i === 2 ? 1.6 : -1.9);
      crown.castShadow = true;
      crown.userData.surface = 'Vegetación interior';
      interior.add(crown);
    });
    model.add(interior);

    const roof = new THREE.Group();
    addBox(roof, [10.7, 0.26, 7.2], [0, 3.64, 0], dark, 'Cubierta');
    addBox(
      roof,
      [5.55, 0.14, 3.0],
      [-1.75, 3.54, 0.45],
      timber,
      'Pérgola del patio',
    );
    model.add(roof);

    const selectable = [
      ...structure.children,
      ...materials.children,
      ...interior.children,
      ...foundation.children,
      ...roof.children,
    ].filter(
      (object): object is THREE.Mesh =>
        object instanceof THREE.Mesh && Boolean(object.userData.surface),
    );
    const describeObjects = (root: THREE.Object3D) => {
      const seen = new Map<string, string>();
      let unnamed = 0;
      root.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const label =
          object.userData.surface ||
          object.name.trim() ||
          `Objeto ${++unnamed}`;
        const key = String(label);
        if (!seen.has(key)) seen.set(key, String(label));
        object.userData.fabricaObjectKey = key;
      });
      return Array.from(seen, ([key, label]) => ({ key, label })).sort((a, b) =>
        a.label.localeCompare(b.label, 'es'),
      );
    };
    state.current.onObjectCatalog(describeObjects(model));
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let down = { x: 0, y: 0 };
    const onPointerDown = (event: PointerEvent) => {
      down = { x: event.clientX, y: event.clientY };
    };
    const onPointerUp = (event: PointerEvent) => {
      if (
        state.current.interactionMode === 'navigate' ||
        Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5
      )
        return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const root = state.current.imported || model;
      const hit = raycaster
        .intersectObjects(state.current.imported ? [root] : selectable, true)
        .find((item) => {
          let node: THREE.Object3D | null = item.object;
          while (node) {
            if (!node.visible) return false;
            node = node.parent;
          }
          return true;
        });
      if (!hit) return;
      const local = root.worldToLocal(hit.point.clone());
      const next = {
        surface:
          hit.object.userData.surface ||
          hit.object.name ||
          'Superficie del modelo',
        point: [local.x, local.y, local.z],
      } as SurfaceSelection;
      if (state.current.interactionMode === 'measure') {
        state.current.onMeasure(next);
      } else {
        state.current.onSelect(next);
      }
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    let frame = 0;
    let tick = 0;
    let lastView = '__uninitialized__';
    let lastCommand = state.current.cameraCommand.id;
    let transitioning = false;
    let loaded: THREE.Group | null = null;
    let catalogRoot: THREE.Object3D | null = model;
    let measurementSignature = '';
    const stopTransition = () => {
      transitioning = false;
    };
    controls.addEventListener('start', stopTransition);
    const desiredPosition = new THREE.Vector3(...initialCamera.position);
    const desiredTarget = new THREE.Vector3(...initialCamera.target);
    const anchorWorld = new THREE.Vector3();
    const projected = new THREE.Vector3();
    const importedBounds = new THREE.Box3();
    const importedSphere = new THREE.Sphere();
    const frameView = (viewName: string, imported: THREE.Group | null) => {
      const saved = state.current.savedViews.find(
        (item) => item.id === viewName,
      );
      if (saved) {
        desiredPosition.set(...saved.position);
        desiredTarget.set(...saved.target);
        camera.near = 0.01;
        camera.far = Math.max(
          100,
          desiredPosition.distanceTo(desiredTarget) * 10,
        );
        camera.updateProjectionMatrix();
        return;
      }
      if (!imported) {
        desiredPosition.set(...initialCamera.position);
        desiredTarget.set(...initialCamera.target);
        return;
      }

      imported.updateMatrixWorld(true);
      importedBounds.setFromObject(imported).getBoundingSphere(importedSphere);
      const radius = Math.max(importedSphere.radius, 0.1);
      const distance =
        (radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.15;
      desiredTarget.copy(importedSphere.center);
      desiredPosition
        .set(1, 0.55, 1)
        .normalize()
        .multiplyScalar(distance)
        .add(importedSphere.center);
      camera.near = Math.max(radius / 100, 0.01);
      camera.far = Math.max(radius * 100, 100);
      camera.updateProjectionMatrix();
      controls.minDistance = radius * 0.05;
      controls.maxDistance = radius * 20;
    };

    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    const render = () => {
      frame = requestAnimationFrame(render);
      tick++;
      const current = state.current;
      if (loaded !== current.imported) {
        if (loaded) scene.remove(loaded);
        loaded = current.imported;
        if (loaded) scene.add(loaded);
        const nextCatalogRoot = loaded || model;
        if (catalogRoot !== nextCatalogRoot) {
          catalogRoot = nextCatalogRoot;
          current.onObjectCatalog(describeObjects(nextCatalogRoot));
        }
        frameView(current.view, loaded);
        transitioning = true;
      }
      model.visible = !loaded;
      foundation.visible = true;
      structure.visible = current.stage >= 1;
      materials.visible = current.stage >= 2;
      interior.visible = current.stage >= 3;
      roof.visible = current.stage >= 1;
      const hidden = new Set(current.hiddenObjects);
      (loaded || model).traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.visible = !hidden.has(
            String(
              object.userData.fabricaObjectKey ||
                object.userData.surface ||
                object.name,
            ),
          );
        }
      });
      const nextMeasurementSignature = JSON.stringify([
        current.measurements.map((item) => [
          item.id,
          item.startPoint,
          item.endPoint,
        ]),
        current.measurementStart?.point,
        Boolean(loaded),
      ]);
      if (nextMeasurementSignature !== measurementSignature) {
        measurementSignature = nextMeasurementSignature;
        clearMarkup();
        const root = loaded || model;
        const addMarker = (point: [number, number, number]) => {
          const world = new THREE.Vector3(...point);
          root.localToWorld(world);
          const marker = new THREE.Mesh(
            new THREE.SphereGeometry(0.075, 14, 10),
            new THREE.MeshBasicMaterial({ color: '#d7ea87', depthTest: false }),
          );
          marker.position.copy(world);
          marker.renderOrder = 20;
          markup.add(marker);
        };
        for (const item of current.measurements) {
          const start = new THREE.Vector3(...item.startPoint);
          const end = new THREE.Vector3(...item.endPoint);
          root.localToWorld(start);
          root.localToWorld(end);
          const line = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([start, end]),
            new THREE.LineBasicMaterial({ color: '#e7ff91', depthTest: false }),
          );
          line.renderOrder = 19;
          markup.add(line);
          addMarker(item.startPoint);
          addMarker(item.endPoint);
        }
        if (current.measurementStart) addMarker(current.measurementStart.point);
      }
      structure.children.forEach((object) => {
        if (object instanceof THREE.Mesh && object.material === plasterOld)
          object.material = plaster;
        if (object instanceof THREE.Mesh && object.material === plaster)
          object.material = current.palette === 'warm' ? plaster : plasterOld;
      });
      materials.children.forEach((object) => {
        if (
          object instanceof THREE.Mesh &&
          (object.material === timber || object.material === timberOld)
        ) {
          object.material = current.palette === 'warm' ? timber : timberOld;
        }
      });
      if (lastView !== current.view) {
        lastView = current.view;
        transitioning = true;
        frameView(current.view, current.imported);
      }
      if (lastCommand !== current.cameraCommand.id) {
        lastCommand = current.cameraCommand.id;
        const action = current.cameraCommand.action;
        if (action === 'reset') {
          frameView(current.view, current.imported);
          transitioning = true;
        } else if (action === 'focus-point' && current.selection) {
          const target = new THREE.Vector3(...current.selection.point);
          (current.imported || model).localToWorld(target);
          desiredTarget.copy(target);
          desiredPosition
            .copy(camera.position)
            .sub(controls.target)
            .normalize()
            .multiplyScalar(5)
            .add(target);
          transitioning = true;
        } else if (action === 'zoom-in' || action === 'zoom-out') {
          transitioning = false;
          camera.position
            .sub(controls.target)
            .multiplyScalar(action === 'zoom-in' ? 0.8 : 1.25)
            .add(controls.target);
        } else if (action === 'rotate')
          controls.autoRotate = !controls.autoRotate;
        else if (action === 'pan' || action === 'orbit')
          controls.mouseButtons.LEFT =
            action === 'pan' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
      }
      if (transitioning) {
        camera.position.lerp(desiredPosition, 0.12);
        controls.target.lerp(desiredTarget, 0.12);
        if (
          camera.position.distanceTo(desiredPosition) < 0.015 &&
          controls.target.distanceTo(desiredTarget) < 0.015
        )
          transitioning = false;
      }
      controls.enabled = current.interactionMode === 'navigate';
      renderer.domElement.style.cursor =
        current.interactionMode !== 'navigate' ? 'crosshair' : 'grab';
      controls.update();
      if (tick % 6 === 0) {
        current.onCameraChange({
          position: camera.position.toArray() as [number, number, number],
          target: controls.target.toArray() as [number, number, number],
        });
      }

      if (tick % 2 === 0) {
        const projectedPoints = [...current.referencePoints];
        if (
          current.selection &&
          !projectedPoints.some((item) => item.id === current.selection?.anchor)
        ) {
          projectedPoints.push({
            id: current.selection.anchor || 'current-selection',
            label: current.selection.surface,
            point: current.selection.point,
            count: 0,
            resolved: false,
          });
        }
        const nextPins = projectedPoints.map((item) => {
          anchorWorld.set(...item.point);
          (current.imported || model).localToWorld(anchorWorld);
          projected.copy(anchorWorld).project(camera);
          return {
            ...item,
            x: (projected.x * 0.5 + 0.5) * container.clientWidth,
            y: (-projected.y * 0.5 + 0.5) * container.clientHeight,
            visible:
              projected.z > -1 &&
              projected.z < 1 &&
              Math.abs(projected.x) <= 1 &&
              Math.abs(projected.y) <= 1,
          };
        });
        setPins((previous) => {
          if (
            previous.length === nextPins.length &&
            previous.every(
              (item, index) =>
                item.id === nextPins[index].id &&
                item.visible === nextPins[index].visible &&
                Math.abs(item.x - nextPins[index].x) < 0.6 &&
                Math.abs(item.y - nextPins[index].y) < 0.6 &&
                item.count === nextPins[index].count,
            )
          ) {
            return previous;
          }
          return nextPins;
        });
      }
      try {
        renderer.render(scene, camera);
        if (tick === 1) onReady();
      } catch {
        cancelAnimationFrame(frame);
        onError('No se pudo dibujar el modelo. Intentá abrirlo nuevamente.');
      }
    };
    render();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      clearMarkup();
      if (loaded) scene.remove(loaded);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const mats = Array.isArray(object.material)
            ? object.material
            : [object.material];
          mats.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div ref={host} className="studio-canvas" aria-label="Modelo 3D navegable">
      {pins.map(
        (pin) =>
          pin.visible && (
            <button
              type="button"
              key={pin.id}
              className={`surface-pin ${pin.resolved ? 'resolved' : ''} ${
                selection?.anchor === pin.id ||
                (!selection?.anchor && pin.id === 'current-selection')
                  ? 'selected'
                  : ''
              }`}
              style={{ left: pin.x, top: pin.y }}
              aria-label={`${pin.label}, ${pin.count || 'sin'} comentarios`}
              onClick={() => onReferenceSelect(pin)}
            >
              <span>{pin.count || ''}</span>
            </button>
          ),
      )}
      <div className="canvas-help">
        <MousePointer2 size={14} />
        {interactionMode === 'comment'
          ? 'Elegí el punto de referencia en una superficie'
          : interactionMode === 'measure'
            ? measurementStart
              ? 'Elegí el segundo punto de la medida'
              : 'Elegí el primer punto de la medida'
            : 'Arrastrá: rotar · clic derecho: desplazar · rueda: zoom'}
      </div>
    </div>
  );
}

export default function Studio({
  user,
  localPreview,
  initialSharedToken,
  initialAuthError,
}: {
  user: {
    name: string;
    email: string;
    provider: 'chatgpt' | 'google' | 'fabrica';
  } | null;
  localPreview: boolean;
  initialSharedToken: string;
  initialAuthError?: string;
}) {
  const signedIn = Boolean(user);
  const accessMode = initialSharedToken
    ? 'customer'
    : signedIn || localPreview
      ? 'professional'
      : null;
  const [accountOpen, setAccountOpen] = useState(!accessMode);
  const [importOpen, setImportOpen] = useState(false);
  const [versions, setVersions] = useState<StoredVersion[]>([]);
  const [clients, setClients] = useState<StoredClient[]>([]);
  const [projects, setProjects] = useState<StoredProject[]>([]);
  const [activeProject, setActiveProject] = useState('');
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectClient, setNewProjectClient] = useState('');
  const [clientsDialogOpen, setClientsDialogOpen] = useState(false);
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);
  const [versionName, setVersionName] = useState('');
  const [versionDescription, setVersionDescription] = useState('');
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewName, setViewName] = useState('');
  const [imported, setImported] = useState<THREE.Group | null>(null);
  const [cameraCommand, setCameraCommand] = useState({
    id: 0,
    action: 'reset',
  });
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(Boolean(accessMode));
  const [preparedModel, setPreparedModel] = useState('');
  const [readyModel, setReadyModel] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [modelError, setModelError] = useState('');
  const [storageError, setStorageError] = useState('');
  const [share, setShare] = useState('');
  const [shareEnabled, setShareEnabled] = useState(false);
  const [shareExpires, setShareExpires] = useState(0);
  const [shareDays, setShareDays] = useState(30);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [sharedToken, setSharedToken] = useState(initialSharedToken);
  const [viewerName, setViewerName] = useState('Cliente invitado');
  const [canEdit, setCanEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inspector, setInspector] = useState<
    'objects' | 'measurements' | 'plans' | null
  >(null);
  const [objectCatalog, setObjectCatalog] = useState<SceneObject[]>([]);
  const [hiddenObjects, setHiddenObjects] = useState<string[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [plans, setPlans] = useState<StoredPlan[]>([]);
  const [measurementStart, setMeasurementStart] =
    useState<SurfaceSelection | null>(null);
  const [measurementEnd, setMeasurementEnd] = useState<SurfaceSelection | null>(
    null,
  );
  const [measurementName, setMeasurementName] = useState('');
  const [measurementDialogOpen, setMeasurementDialogOpen] = useState(false);
  const [commentScope, setCommentScope] = useState<'point' | 'project'>(
    'project',
  );
  const loadSequence = useRef(0);
  const selectedVersion = useRef<Version>('');
  const activeModel = useRef<THREE.Group | null>(null);
  const cameraSnapshot = useRef<Viewpoint>({
    position: initialCamera.position,
    target: initialCamera.target,
  });
  const command = (action: string) =>
    setCameraCommand((previous) => ({ id: previous.id + 1, action }));
  const refresh = async (project = activeProject, token = sharedToken) => {
    try {
      const data = await studioRequest(undefined, token, project);
      setVersions((previous) =>
        JSON.stringify(previous) === JSON.stringify(data.versions)
          ? previous
          : data.versions,
      );
      const refreshedVersion =
        data.versions.find((item) => item.id === selectedVersion.current) ||
        data.versions.at(-1);
      selectedVersion.current = refreshedVersion?.id || '';
      setVersion(selectedVersion.current);
      setHiddenObjects(
        parseVersionSettings(refreshedVersion?.settings).hiddenObjects,
      );
      setProjects(
        data.projects?.length
          ? data.projects
          : data.project
            ? [data.project]
            : [],
      );
      setClients(data.clients || []);
      if (data.project?.id) setActiveProject(data.project.id);
      setShare(data.share || '');
      setShareEnabled(Boolean(data.shareEnabled));
      setShareExpires(data.shareExpires || 0);
      setViewerName(data.viewer?.name || 'Cliente invitado');
      setCanEdit(data.owner);
      setStorageError('');
      setComments(
        data.comments.map(
          (comment: {
            id: string;
            anchor: string;
            parent?: string | null;
            author: string;
            text: string;
            created: number;
            scope?: 'point' | 'project';
            surface: string;
            point: string | null;
            camera?: string | null;
            version: string;
            state: 'abierto' | 'resuelto';
          }) => ({
            ...comment,
            anchor: comment.anchor || comment.id,
            scope: comment.scope || 'point',
            point: comment.point ? JSON.parse(comment.point) : undefined,
            camera: comment.camera ? JSON.parse(comment.camera) : undefined,
            initials: comment.author.slice(0, 2).toUpperCase(),
            time: new Date(comment.created).toLocaleString('es-AR', {
              dateStyle: 'short',
              timeStyle: 'short',
            }),
          }),
        ),
      );
      setMeasurements(
        (data.measurements || []).map((measurement) => ({
          ...measurement,
          startPoint: parseJson(measurement.startPoint, [0, 0, 0]),
          endPoint: parseJson(measurement.endPoint, [0, 0, 0]),
        })),
      );
      setPlans(data.plans || []);
      return data;
    } catch (error) {
      setStorageError((error as Error).message);
      throw error;
    } finally {
      setDataLoading(false);
    }
  };
  const changeVersion = (id: string) => {
    setView('');
    selectedVersion.current = id;
    setVersion(id);
    setHiddenObjects(
      parseVersionSettings(versions.find((item) => item.id === id)?.settings)
        .hiddenObjects,
    );
    setSelection(null);
    setCommentScope('project');
    setDraft('');
    setInteractionMode('navigate');
    setMeasurementStart(null);
    setMeasurementEnd(null);
  };

  const [stage, setStage] = useState<Stage>(3);
  const [version, setVersion] = useState<Version>('');
  const [interactionMode, setInteractionMode] = useState<
    'navigate' | 'comment' | 'measure'
  >('navigate');
  const [selection, setSelection] = useState<SurfaceSelection | null>(null);
  const [view, setView] = useState('');
  // On a phone the canvas is the primary surface. Keep the conversation one tap
  // away instead of opening a drawer over the model on arrival.
  const [panelOpen, setPanelOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (signedIn || localPreview || initialSharedToken)
      void refresh('', initialSharedToken).catch(() => {});
  }, []);

  const activeFiles = versions.find((item) => item.id === version)?.files;
  const modelKey = `${version}:${activeFiles || ''}:${loadAttempt}`;
  useEffect(() => {
    if (!accessMode) return;
    const seq = ++loadSequence.current;
    setModelError('');
    setLoading(false);
    setPreparedModel('');
    setReadyModel('');
    setObjectCatalog([]);
    setImported(null);
    if (activeModel.current) {
      disposeModel(activeModel.current);
      activeModel.current = null;
    }
    const selected = versions.find((item) => item.id === version);
    if (!selected) return;
    const files: StoredFile[] = JSON.parse(selected.files);
    if (selected.modelKind === 'demo') {
      setPreparedModel(modelKey);
      return;
    }
    if (!files.length) {
      setModelError(
        'Esta versión todavía no tiene un modelo. Importá un archivo para comenzar.',
      );
      return;
    }
    if (
      !viewFormats.includes(extension(files[0].name)) ||
      files.reduce((sum, f) => sum + f.size, 0) > 200 * 1024 ** 2
    ) {
      setModelError(
        'Original guardado. Esta entrega necesita una exportación compatible de hasta 200 MB para mostrar la vista 3D.',
      );
      return;
    }
    setLoading(true);
    const access = sharedToken
      ? `&share=${encodeURIComponent(sharedToken)}`
      : activeProject
        ? `&project=${encodeURIComponent(activeProject)}`
        : '';
    const resources = Object.fromEntries(
      files.map((file) => [
        file.name,
        `/api/studio?asset=${encodeURIComponent(file.key)}${access}`,
      ]),
    );
    loadModel(
      files[0].name,
      resources,
      parseVersionSettings(selected.settings).upAxis,
    )
      .then((model) => {
        if (seq !== loadSequence.current) {
          disposeModel(model);
          return;
        }
        activeModel.current = model;
        setImported(model);
        setPreparedModel(modelKey);
        command('reset');
      })
      .catch((error) => {
        if (seq === loadSequence.current) setModelError(error.message);
      })
      .finally(() => {
        if (seq === loadSequence.current) setLoading(false);
      });
    return () => {
      loadSequence.current++;
    };
  }, [
    version,
    activeFiles,
    accessMode,
    sharedToken,
    activeProject,
    loadAttempt,
  ]);

  useEffect(() => {
    if (!accessMode || (!signedIn && !localPreview && !sharedToken)) return;
    const update = () => {
      if (document.visibilityState === 'visible')
        void refresh(activeProject).catch(() => {});
    };
    const timer = window.setInterval(update, 15000);
    window.addEventListener('focus', update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', update);
    };
  }, [accessMode, sharedToken, activeProject]);

  useEffect(
    () => () => {
      loadSequence.current++;
      if (activeModel.current) disposeModel(activeModel.current);
    },
    [],
  );

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2400);
  };

  const selectSurface = (next: SurfaceSelection) => {
    setSelection(next);
    setCommentScope('point');
    setInteractionMode('navigate');
    setInspector(null);
    setPanelOpen(true);
  };

  const addComment = async () => {
    if (!draft.trim() || (commentScope === 'point' && !selection) || saving)
      return;
    setSaving(true);
    try {
      await studioRequest(
        {
          action: 'comment',
          scope: commentScope,
          text: draft.trim(),
          surface: selection?.surface,
          point: selection?.point,
          camera: cameraSnapshot.current,
          version,
          anchor: selection?.anchor,
        },
        sharedToken,
        activeProject,
      );
      setDraft('');
      await refresh(activeProject);
      showToast(
        commentScope === 'project'
          ? 'Comentario agregado al proyecto'
          : 'Comentario guardado en este punto',
      );
    } catch (error) {
      showToast((error as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const resolveComment = async (id: string | number) => {
    if (saving) return;
    setSaving(true);
    try {
      await studioRequest(
        { action: 'resolve', id: String(id) },
        sharedToken,
        activeProject,
      );
      await refresh(activeProject);
      showToast('Comentario resuelto');
    } catch (error) {
      showToast((error as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const shareUrl = (token: string) =>
    `${location.origin}/estudio?share=${encodeURIComponent(token)}`;
  const createShare = async (copy = false) => {
    if (saving) return;
    setSaving(true);
    try {
      const data = await studioRequest(
        { action: 'share', days: shareDays },
        '',
        activeProject,
      );
      setShare(data.share);
      setShareEnabled(true);
      setShareExpires(data.shareExpires);
      if (copy) {
        await navigator.clipboard.writeText(shareUrl(data.share));
        showToast('Nuevo enlace de revisión copiado');
      } else {
        showToast('Enlace privado actualizado');
      }
    } catch (error) {
      showToast((error as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const copyShare = async () => {
    try {
      if (
        !shareEnabled ||
        !share ||
        (shareExpires > 0 && shareExpires <= Date.now())
      ) {
        await createShare(true);
        return;
      }
      await navigator.clipboard.writeText(shareUrl(share));
      showToast('Enlace de revisión copiado');
    } catch (error) {
      showToast((error as Error).message);
    }
  };
  const revokeShare = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await studioRequest({ action: 'revoke-share' }, '', activeProject);
      setShare('');
      setShareEnabled(false);
      setShareExpires(0);
      showToast('El acceso anterior fue revocado');
    } catch (error) {
      showToast((error as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const example = async () => {
    setLoading(true);
    setModelError('');
    try {
      const names = ['Chair.dae', 'texture0.jpg', 'texture1.jpg'];
      const saved: StoredFile[] = [];
      for (const name of names) {
        const response = await fetch(`/models/sketchup-chair/${name}`);
        if (!response.ok) throw new Error('No se pudo cargar el ejemplo.');
        const file = await response.blob();
        const upload = await studioRequest(
          { action: 'begin', name, size: file.size },
          '',
          activeProject,
        );
        const part = await fetch(
          `/api/studio?project=${encodeURIComponent(activeProject)}&upload=${upload.id}&part=1`,
          { method: 'PUT', body: file },
        );
        if (!part.ok) throw new Error('No se pudo guardar el ejemplo.');
        saved.push(
          await studioRequest(
            { action: 'finish', id: upload.id, parts: [await part.json()] },
            '',
            activeProject,
          ),
        );
      }
      const created = await studioRequest(
        {
          action: 'version',
          name: 'Silla · SketchUp / DAE',
          files: saved.map((file) => file.key),
        },
        '',
        activeProject,
      );
      await refresh(activeProject);
      changeVersion(created.id);
    } catch (error) {
      showToast((error as Error).message);
    } finally {
      setLoading(false);
    }
  };
  const switchProject = async (id: string) => {
    setProjectMenuOpen(false);
    if (id === activeProject) return;
    setDataLoading(true);
    try {
      const data = await refresh(id, '');
      const available = (data.versions as StoredVersion[]).filter(
        (item) => item.published || accessMode === 'professional',
      );
      changeVersion(available.at(-1)?.id || '');
      setView('');
      showToast(
        data.project
          ? `Proyecto abierto: ${data.project.name}`
          : 'Proyecto abierto',
      );
    } catch (error) {
      showToast((error as Error).message);
    }
  };
  const createProject = async () => {
    if (!newProjectName.trim() || saving) return;
    setSaving(true);
    try {
      const data = await studioRequest(
        {
          action: 'create-project',
          name: newProjectName.trim(),
          client: newProjectClient || null,
        },
        '',
        activeProject,
      );
      setNewProjectName('');
      setNewProjectClient('');
      setProjectDialogOpen(false);
      if (!data.project)
        throw new Error('No se pudo abrir el proyecto creado.');
      await refresh(data.project.id, '');
      changeVersion('');
      showToast('Proyecto creado');
    } catch (error) {
      showToast((error as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const createClient = async () => {
    if (!newClientName.trim() || saving) return;
    setSaving(true);
    try {
      const data = await studioRequest(
        {
          action: 'create-client',
          name: newClientName.trim(),
          email: newClientEmail.trim(),
        },
        '',
        activeProject,
      );
      await refresh(activeProject, '');
      setNewClientName('');
      setNewClientEmail('');
      setClientDialogOpen(false);
      setClientsDialogOpen(true);
      if (data.client?.id) setNewProjectClient(data.client.id);
      showToast('Cliente agregado a tu cartera');
    } catch (error) {
      showToast((error as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const saveView = async () => {
    if (!viewName.trim() || !activeVersion || saving) return;
    setSaving(true);
    try {
      await studioRequest(
        {
          action: 'view',
          version: activeVersion.id,
          name: viewName.trim(),
          ...cameraSnapshot.current,
        },
        '',
        activeProject,
      );
      await refresh(activeProject, '');
      setViewName('');
      setViewDialogOpen(false);
      showToast('Vista guardada en esta versión');
    } catch (error) {
      showToast((error as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const createVersion = async () => {
    if (!versionName.trim() || !activeVersion || saving) return;
    setSaving(true);
    try {
      const created = await studioRequest(
        {
          action: 'create-version',
          name: versionName.trim(),
          description: versionDescription.trim(),
          sourceVersion: activeVersion.id,
        },
        '',
        activeProject,
      );
      await refresh(activeProject, '');
      changeVersion(created.id);
      setVersionName('');
      setVersionDescription('');
      setVersionDialogOpen(false);
      showToast('Nueva versión creada como borrador');
    } catch (error) {
      showToast((error as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const saveVisibility = async (next: string[], previous: string[]) => {
    setHiddenObjects(next);
    try {
      await studioRequest(
        { action: 'visibility', version, hiddenObjects: next },
        '',
        activeProject,
      );
      setVersions((items) =>
        items.map((item) =>
          item.id === version
            ? {
                ...item,
                settings: JSON.stringify({
                  ...parseVersionSettings(item.settings),
                  hiddenObjects: next,
                }),
              }
            : item,
        ),
      );
    } catch (error) {
      setHiddenObjects(previous);
      showToast((error as Error).message);
    }
  };
  const toggleObject = (key: string) => {
    if (!professional || !activeVersion) return;
    const previous = hiddenObjects;
    const next = previous.includes(key)
      ? previous.filter((item) => item !== key)
      : [...previous, key];
    void saveVisibility(next, previous);
  };
  const selectMeasurePoint = (point: SurfaceSelection) => {
    if (!measurementStart) {
      setMeasurementStart(point);
      setInspector('measurements');
      showToast('Primer punto fijado. Elegí el segundo.');
      return;
    }
    if (samePoint(measurementStart.point, point.point)) {
      showToast('Elegí un segundo punto diferente.');
      return;
    }
    setMeasurementEnd(point);
    setMeasurementName(`Medida ${versionMeasurements.length + 1}`);
    setMeasurementDialogOpen(true);
    setInteractionMode('navigate');
  };
  const saveMeasurement = async () => {
    if (
      !measurementStart ||
      !measurementEnd ||
      !measurementName.trim() ||
      !activeVersion
    )
      return;
    const value = Math.hypot(
      measurementEnd.point[0] - measurementStart.point[0],
      measurementEnd.point[1] - measurementStart.point[1],
      measurementEnd.point[2] - measurementStart.point[2],
    );
    setSaving(true);
    try {
      await studioRequest(
        {
          action: 'measurement',
          version: activeVersion.id,
          name: measurementName.trim(),
          startPoint: measurementStart.point,
          endPoint: measurementEnd.point,
          value,
          unit: activeVersion.unit,
        },
        '',
        activeProject,
      );
      await refresh(activeProject, '');
      setMeasurementStart(null);
      setMeasurementEnd(null);
      setMeasurementName('');
      setMeasurementDialogOpen(false);
      showToast('Medida guardada en la versión');
    } catch (error) {
      showToast((error as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const uploadPlan = async (file: File | undefined) => {
    if (!file || !activeVersion || saving) return;
    if (
      !['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(
        file.type,
      ) ||
      file.size > 100 * 1024 ** 2
    ) {
      showToast('Usá un PDF, PNG, JPG o WebP de hasta 100 MB.');
      return;
    }
    setSaving(true);
    let uploadId = '';
    try {
      const upload = await studioRequest(
        { action: 'begin', name: file.name, size: file.size },
        '',
        activeProject,
      );
      uploadId = upload.id;
      const parts: Array<{ partNumber: number; etag: string }> = [];
      for (
        let offset = 0, partNumber = 1;
        offset < file.size;
        offset += upload.partSize, partNumber++
      ) {
        const response = await fetch(
          `/api/studio?project=${encodeURIComponent(activeProject)}&upload=${upload.id}&part=${partNumber}`,
          { method: 'PUT', body: file.slice(offset, offset + upload.partSize) },
        );
        const part = (await response.json()) as {
          partNumber: number;
          etag: string;
          error?: string;
        };
        if (!response.ok)
          throw new Error(part.error || 'No se pudo subir el plano.');
        parts.push(part);
      }
      const completed = await studioRequest(
        { action: 'finish', id: upload.id, parts },
        '',
        activeProject,
      );
      uploadId = '';
      await studioRequest(
        {
          action: 'plan',
          version: activeVersion.id,
          name: file.name.replace(/\.[^.]+$/, ''),
          sheet: '',
          mime: file.type,
          key: completed.key,
          size: completed.size,
        },
        '',
        activeProject,
      );
      await refresh(activeProject, '');
      showToast('Plano añadido a la versión');
    } catch (error) {
      if (uploadId) {
        await studioRequest(
          { action: 'abort', id: uploadId },
          '',
          activeProject,
        ).catch(() => {});
      }
      showToast((error as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const logout = async () => {
    try {
      await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'logout' }),
      });
    } finally {
      window.location.assign('/estudio');
    }
  };
  const activeVersion = versions.find((item) => item.id === version);
  const professional = accessMode === 'professional' && canEdit;
  const shownVersions = versions.filter(
    (item) => professional || item.published,
  );
  const versionMeasurements = measurements.filter(
    (item) => item.version === version,
  );
  const versionPlans = plans.filter((item) => item.version === version);
  const referencePoints = Array.from(
    comments
      .filter(
        (comment) =>
          comment.scope === 'point' &&
          comment.version === version &&
          comment.point,
      )
      .reduce((groups, comment) => {
        const key = comment.anchor || String(comment.id);
        const group = groups.get(key) || [];
        group.push(comment);
        groups.set(key, group);
        return groups;
      }, new Map<string, Comment[]>()),
    ([id, items]) => ({
      id,
      label: items[0].surface,
      point: items[0].point as [number, number, number],
      count: items.length,
      resolved: items.every((item) => item.state === 'resuelto'),
    }),
  );
  const visibleComments = comments.filter((comment) =>
    commentScope === 'project'
      ? comment.scope === 'project'
      : comment.scope === 'point' &&
        comment.version === version &&
        selection &&
        (selection.anchor
          ? comment.anchor === selection.anchor
          : comment.surface === selection.surface &&
            samePoint(comment.point, selection.point)),
  );
  const savedViews = [
    ...parseStoredViews(activeVersion?.views),
    ...(((preparedModel === modelKey ? imported?.userData.views : []) ||
      []) as StoredView[]),
  ];
  const modelBusy =
    dataLoading ||
    loading ||
    Boolean(
      activeVersion &&
      !modelError &&
      (preparedModel !== modelKey || readyModel !== modelKey),
    );
  const modelReady = Boolean(activeVersion && !modelBusy && !modelError);
  const roofKeys = objectCatalog
    .filter((item) => /cubierta|techo|roof|pérgola/i.test(item.label))
    .map((item) => item.key);
  const roofVisible = roofKeys.length
    ? roofKeys.some((key) => !hiddenObjects.includes(key))
    : true;
  const activeProjectRecord = projects.find(
    (item) => item.id === activeProject,
  );
  const activeProjectName = activeProjectRecord?.name || 'Casa Patio';
  const activeClient = clients.find(
    (client) => client.id === activeProjectRecord?.client,
  );
  const shareActive =
    shareEnabled &&
    Boolean(share) &&
    (shareExpires === 0 || shareExpires > Date.now());
  const shareExpiryLabel = shareExpires
    ? new Date(shareExpires).toLocaleDateString('es-AR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'sin vencimiento';
  const clientGroups = clients.map((client) => ({
    ...client,
    projects: projects.filter((project) => project.client === client.id),
  }));
  const unassignedProjects = projects.filter((project) => !project.client);
  const canSwitchProject =
    professional || (!sharedToken && projects.length > 1);

  return (
    <main
      className={`studio-shell ${panelOpen ? 'panel-is-open' : ''} ${
        inspector ? 'inspector-is-open' : ''
      }`}
    >
      <header className="studio-header">
        <div className="studio-brand">
          <a href="/" className="studio-back" aria-label="Volver a la landing">
            <ArrowLeft size={17} />
            <Wordmark />
          </a>
          <span className="header-divider" />
          <div className="project-switcher-wrap">
            <button
              className="project-switcher"
              type="button"
              onClick={() =>
                canSwitchProject
                  ? setProjectMenuOpen((value) => !value)
                  : setAccountOpen(true)
              }
              aria-expanded={canSwitchProject ? projectMenuOpen : undefined}
            >
              <span>
                <strong>{activeProjectName}</strong>
                <small>
                  {professional
                    ? `${activeClient?.name || 'Sin cliente asignado'} · ${
                        activeVersion?.name || 'Sin entregas'
                      }`
                    : `${activeVersion?.name || 'Proyecto de muestra'} · Revisión del cliente`}
                </small>
              </span>
              <ChevronDown size={16} />
            </button>
            {canSwitchProject && projectMenuOpen && (
              <div className="project-menu" role="menu">
                <p className="project-menu-title">
                  {professional ? 'Clientes y proyectos' : 'Mis revisiones'}{' '}
                  <span>{professional ? clients.length : projects.length}</span>
                </p>
                <div className="project-menu-scroll">
                  {professional ? (
                    <>
                      {clientGroups.map((client) => (
                        <div className="client-project-group" key={client.id}>
                          <div className="client-project-heading">
                            <span>{client.name.slice(0, 2).toUpperCase()}</span>
                            <strong>{client.name}</strong>
                            <small>{client.projects.length}</small>
                          </div>
                          {client.projects.length ? (
                            client.projects.map((item) => (
                              <button
                                type="button"
                                role="menuitem"
                                key={item.id}
                                className={
                                  item.id === activeProject ? 'active' : ''
                                }
                                onClick={() => void switchProject(item.id)}
                              >
                                <span>{item.name}</span>
                                {item.id === activeProject && <Check />}
                              </button>
                            ))
                          ) : (
                            <span className="client-without-projects">
                              Sin proyectos todavía
                            </span>
                          )}
                        </div>
                      ))}
                      {!!unassignedProjects.length && (
                        <div className="client-project-group unassigned">
                          <div className="client-project-heading">
                            <span>—</span>
                            <strong>Sin cliente asignado</strong>
                            <small>{unassignedProjects.length}</small>
                          </div>
                          {unassignedProjects.map((item) => (
                            <button
                              type="button"
                              role="menuitem"
                              key={item.id}
                              className={
                                item.id === activeProject ? 'active' : ''
                              }
                              onClick={() => void switchProject(item.id)}
                            >
                              <span>{item.name}</span>
                              {item.id === activeProject && <Check />}
                            </button>
                          ))}
                        </div>
                      )}
                      {!clients.length && !unassignedProjects.length && (
                        <p className="project-menu-empty">
                          Agregá un cliente para empezar a organizar tu cartera.
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="client-project-group customer-projects">
                      {projects.map((item) => (
                        <button
                          type="button"
                          role="menuitem"
                          key={item.id}
                          className={item.id === activeProject ? 'active' : ''}
                          onClick={() => void switchProject(item.id)}
                        >
                          <span>{item.name}</span>
                          {item.id === activeProject && <Check />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {professional && (
                  <div className="project-menu-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setProjectMenuOpen(false);
                        setClientsDialogOpen(true);
                      }}
                    >
                      <UsersRound /> Ver clientes
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProjectMenuOpen(false);
                        setNewProjectClient(activeClient?.id || '');
                        setProjectDialogOpen(true);
                      }}
                    >
                      <FolderPlus /> Nuevo proyecto
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="studio-header-actions">
          <span className="presence">
            {professional ? 'Arquitectura e interiorismo' : 'Cliente'}
          </span>
          {professional && (
            <>
              <Button
                variant="outline"
                className="studio-new-version"
                disabled={!activeVersion}
                onClick={() => {
                  setVersionName(
                    activeVersion
                      ? `Iteración ${String(activeVersion.sequence + 1).padStart(2, '0')}`
                      : '',
                  );
                  setVersionDialogOpen(true);
                }}
              >
                <CopyPlus /> Nueva versión
              </Button>
              <Button
                className="studio-import"
                onClick={() => setImportOpen(true)}
              >
                <Upload /> Importar modelo
              </Button>
            </>
          )}
          {professional ? (
            <Button
              variant="outline"
              className="studio-share"
              onClick={() => setShareDialogOpen(true)}
              disabled={!activeProject}
            >
              <Share2 /> Compartir
            </Button>
          ) : (
            !signedIn &&
            sharedToken && (
              <Button
                variant="outline"
                className="studio-share guest-account"
                onClick={() => setAccountOpen(true)}
              >
                <UserPlus /> Crear cuenta
              </Button>
            )
          )}
          <button
            className="profile-button"
            type="button"
            aria-label="Ver cuenta"
            title={user?.name || viewerName}
            onClick={() => setAccountOpen(true)}
          >
            <UserRound size={17} />
          </button>
        </div>
      </header>

      <section className="studio-workspace">
        <div className="workspace-topbar">
          <div
            className="roof-control"
            hidden={!modelReady || !roofKeys.length}
          >
            <span>
              {roofVisible ? <Eye size={15} /> : <EyeOff size={15} />}
            </span>
            <label htmlFor="roof-switch">
              Cubierta <small>{roofVisible ? 'visible' : 'oculta'}</small>
            </label>
            <Switch
              id="roof-switch"
              checked={roofVisible}
              disabled={!professional}
              onCheckedChange={(visible) => {
                const previous = hiddenObjects;
                const next = visible
                  ? previous.filter((item) => !roofKeys.includes(item))
                  : Array.from(new Set([...previous, ...roofKeys]));
                void saveVisibility(next, previous);
              }}
              aria-label="Mostrar cubierta"
            />
          </div>

          <nav className="project-tool-tabs" aria-label="Datos de la versión">
            {[
              {
                id: 'objects' as const,
                label: 'Objetos',
                icon: <Box />,
                count: hiddenObjects.length,
              },
              {
                id: 'measurements' as const,
                label: 'Medidas',
                icon: <Ruler />,
                count: versionMeasurements.length,
              },
              {
                id: 'plans' as const,
                label: 'Planos',
                icon: <Files />,
                count: versionPlans.length,
              },
            ].map((item) => (
              <button
                type="button"
                key={item.id}
                className={inspector === item.id ? 'active' : ''}
                disabled={
                  !activeVersion || (item.id === 'objects' && !modelReady)
                }
                onClick={() => {
                  setInspector((value) => (value === item.id ? null : item.id));
                  setPanelOpen(false);
                }}
                aria-expanded={inspector === item.id}
                aria-controls="version-inspector"
              >
                {item.icon}
                <span>{item.label}</span>
                {!!item.count && <b>{item.count}</b>}
              </button>
            ))}
          </nav>

          <button
            className="mobile-panel-toggle"
            type="button"
            onClick={() => {
              setInspector(null);
              setPanelOpen((value) => !value);
            }}
            aria-label={
              panelOpen ? 'Ocultar comentarios' : 'Mostrar comentarios'
            }
            aria-expanded={panelOpen}
            aria-controls="project-comments"
          >
            {panelOpen ? <PanelRightClose /> : <PanelRightOpen />}
            <span className="panel-toggle-label">Comentarios</span>
            <b>{comments.length}</b>
          </button>
        </div>
        <div className="viewer-surface" aria-busy={modelBusy}>
          {accessMode &&
            activeVersion &&
            preparedModel === modelKey &&
            !loading &&
            !modelError && (
              <HouseScene
                key={modelKey}
                stage={stage}
                palette={
                  parseVersionSettings(activeVersion.settings).palette || 'warm'
                }
                interactionMode={interactionMode}
                view={view}
                selection={selection}
                onSelect={selectSurface}
                onMeasure={selectMeasurePoint}
                hiddenObjects={hiddenObjects}
                referencePoints={referencePoints}
                measurements={versionMeasurements}
                measurementStart={measurementStart}
                onReferenceSelect={(reference) => {
                  setSelection({
                    surface: reference.label,
                    point: reference.point,
                    anchor: reference.id,
                  });
                  setCommentScope('point');
                  setPanelOpen(true);
                  setInspector(null);
                  command('focus-point');
                }}
                onObjectCatalog={setObjectCatalog}
                cameraCommand={cameraCommand}
                imported={imported}
                savedViews={savedViews}
                onReady={() => setReadyModel(modelKey)}
                onError={setModelError}
                onCameraChange={(viewpoint) => {
                  cameraSnapshot.current = viewpoint;
                }}
              />
            )}
          {accessMode && !activeVersion && !modelBusy && (
            <div className="empty-project" role="status">
              <FileBoxIcon />
              <span>Proyecto nuevo</span>
              <h2>Importá el primer modelo</h2>
              <p>
                La primera versión se crea al guardar el modelo y sus recursos.
              </p>
              {professional && (
                <Button onClick={() => setImportOpen(true)}>
                  <Upload /> Importar modelo
                </Button>
              )}
            </div>
          )}
          {(modelBusy || modelError) && (
            <div className="model-status" role="status">
              {modelBusy ? (
                <LoaderCircle className="model-spinner" aria-hidden="true" />
              ) : (
                <FileBoxIcon />
              )}
              <h2>
                {modelBusy
                  ? 'Preparando modelo…'
                  : 'No se pudo mostrar el modelo'}
              </h2>
              {activeVersion && <strong>{activeVersion.name}</strong>}
              <p>
                {modelBusy
                  ? dataLoading
                    ? 'Cargando las entregas del proyecto.'
                    : preparedModel !== modelKey
                      ? 'Cargando geometría y materiales de esta entrega.'
                      : 'Preparando el visor 3D.'
                  : modelError}
              </p>
              {!modelBusy && (
                <Button
                  variant="outline"
                  onClick={() => setLoadAttempt((value) => value + 1)}
                >
                  Reintentar
                </Button>
              )}
              {!modelBusy &&
                activeVersion &&
                (JSON.parse(activeVersion.files) as StoredFile[]).map(
                  (file) => (
                    <a
                      key={file.key}
                      download={file.name}
                      href={`/api/studio?asset=${encodeURIComponent(file.key)}${sharedToken ? `&share=${encodeURIComponent(sharedToken)}` : `&project=${encodeURIComponent(activeProject)}`}`}
                    >
                      <Download size={16} /> {file.name}
                    </a>
                  ),
                )}
            </div>
          )}

          <aside
            hidden={!!accessMode || !!activeVersion}
            className="stage-rail"
            aria-label="Recorrido del proyecto"
          >
            <div className="stage-heading">
              <span>Recorrido</span>
              <strong>{String(stage + 1).padStart(2, '0')} / 04</strong>
            </div>
            <div className="stage-list">
              {stages.map((item, index) => (
                <button
                  type="button"
                  key={item.number}
                  className={
                    index === stage ? 'active' : index < stage ? 'done' : ''
                  }
                  onClick={() => setStage(index as Stage)}
                  aria-current={index === stage ? 'step' : undefined}
                >
                  <span className="stage-marker">
                    {index < stage ? <Check size={13} /> : item.number}
                  </span>
                  <span className="stage-copy">
                    <strong>{item.label}</strong>
                    <small>{item.detail}</small>
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <div className="viewer-bottom-controls">
            <div
              className="viewer-toolbar"
              aria-label="Herramientas del modelo"
              hidden={!modelReady}
            >
              <Button
                variant={interactionMode === 'navigate' ? 'default' : 'ghost'}
                size="icon"
                aria-label="Orbitar modelo"
                title="Orbitar"
                onClick={() => {
                  setInteractionMode('navigate');
                  command('orbit');
                }}
              >
                <Rotate3D />
              </Button>
              <Button
                variant={interactionMode === 'comment' ? 'default' : 'ghost'}
                size="icon"
                aria-label="Comentar una superficie"
                title="Comentar superficie"
                onClick={() =>
                  setInteractionMode((value) =>
                    value === 'comment' ? 'navigate' : 'comment',
                  )
                }
              >
                <MessageSquarePlus />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Medir entre dos puntos"
                title="Medir"
                onClick={() => {
                  const next =
                    interactionMode === 'measure' ? 'navigate' : 'measure';
                  setInteractionMode(next);
                  setMeasurementStart(null);
                  setMeasurementEnd(null);
                  if (next === 'measure') {
                    setInspector('measurements');
                    setPanelOpen(false);
                  }
                }}
              >
                <Ruler />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Desplazar cámara"
                title="Desplazar"
                onClick={() => {
                  setInteractionMode('navigate');
                  command('pan');
                }}
              >
                <Move />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Acercar cámara"
                title="Acercar"
                onClick={() => command('zoom-in')}
              >
                <Plus />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Alejar cámara"
                title="Alejar"
                onClick={() => command('zoom-out')}
              >
                <Minus />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Alternar rotación automática"
                title="Rotación automática"
                onClick={() => command('rotate')}
              >
                <Play />
              </Button>
              <span className="tool-divider" />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Encuadrar modelo completo"
                title="Encuadrar modelo"
                onClick={() => {
                  setView('');
                  command('reset');
                }}
              >
                <Focus />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Pantalla completa"
                title="Pantalla completa"
                onClick={() => {
                  const operation = document.fullscreenElement
                    ? document.exitFullscreen()
                    : document.documentElement.requestFullscreen?.();
                  operation?.catch(() =>
                    showToast(
                      'Pantalla completa no disponible en este navegador',
                    ),
                  );
                }}
              >
                <Maximize2 />
              </Button>
            </div>

            <div
              className="view-presets"
              aria-label="Vistas guardadas"
              hidden={!modelReady || (!savedViews.length && !professional)}
            >
              {!savedViews.length && (
                <span className="views-empty">Sin vistas guardadas</span>
              )}
              {savedViews.map((saved) => (
                <button
                  type="button"
                  key={saved.id}
                  className={view === saved.id ? 'active' : ''}
                  aria-pressed={view === saved.id}
                  title={saved.name}
                  onClick={() => {
                    setView(saved.id);
                    command('reset');
                  }}
                >
                  <Camera size={15} />
                  <span className="view-label">{saved.name}</span>
                </button>
              ))}
              {professional && activeVersion && (
                <button
                  type="button"
                  className="save-view"
                  onClick={() => setViewDialogOpen(true)}
                  title="Guardar la cámara actual como vista"
                >
                  <Plus size={15} /> Guardar vista
                </button>
              )}
            </div>
          </div>
        </div>
        <aside
          id="version-inspector"
          className={`version-inspector ${inspector ? 'open' : ''}`}
          inert={!inspector}
          aria-label="Información de la versión"
        >
          <header>
            <div>
              <span className="section-kicker">
                {activeVersion ? versionLabel(activeVersion) : ''}
              </span>
              <h2>
                {inspector === 'objects'
                  ? 'Objetos y capas'
                  : inspector === 'measurements'
                    ? 'Medidas'
                    : 'Planos'}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setInspector(null)}
              aria-label="Cerrar panel"
            >
              <X />
            </button>
          </header>
          {inspector === 'objects' && (
            <div className="object-list">
              <div className="object-summary">
                <span>{objectCatalog.length} objetos</span>
                <button
                  type="button"
                  disabled={!professional || !hiddenObjects.length}
                  onClick={() => void saveVisibility([], hiddenObjects)}
                >
                  Mostrar todos
                </button>
              </div>
              {objectCatalog.map((object) => {
                const visible = !hiddenObjects.includes(object.key);
                return (
                  <div className="object-row" key={object.key}>
                    <span>
                      <Box /> {object.label}
                    </span>
                    <button
                      type="button"
                      disabled={!professional}
                      onClick={() => toggleObject(object.key)}
                      aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${object.label}`}
                      title={`${visible ? 'Ocultar' : 'Mostrar'} ${object.label}`}
                    >
                      {visible ? <Eye /> : <EyeOff />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {inspector === 'measurements' && (
            <div className="measurement-list">
              {professional && (
                <button
                  className={`measure-cta ${interactionMode === 'measure' ? 'active' : ''}`}
                  type="button"
                  onClick={() => {
                    setMeasurementStart(null);
                    setMeasurementEnd(null);
                    setInteractionMode(
                      interactionMode === 'measure' ? 'navigate' : 'measure',
                    );
                  }}
                >
                  <Ruler />
                  <span>
                    <strong>
                      {interactionMode === 'measure'
                        ? 'Cancelar medición'
                        : 'Añadir medida'}
                    </strong>
                    <small>Marcá dos puntos sobre el modelo</small>
                  </span>
                </button>
              )}
              {versionMeasurements.map((measurement) => (
                <article key={measurement.id}>
                  <span>
                    <Ruler />
                  </span>
                  <div>
                    <strong>{measurement.name}</strong>
                    <small>
                      {new Date(measurement.created).toLocaleDateString(
                        'es-AR',
                      )}
                    </small>
                  </div>
                  <b>
                    {measurement.value.toLocaleString('es-AR', {
                      maximumFractionDigits: 2,
                    })}{' '}
                    {measurement.unit}
                  </b>
                </article>
              ))}
              {!versionMeasurements.length && interactionMode !== 'measure' && (
                <div className="inspector-empty">
                  <Ruler />
                  <p>Todavía no hay medidas guardadas en esta versión.</p>
                </div>
              )}
              {measurementStart && interactionMode === 'measure' && (
                <p className="measure-progress">
                  <span /> Primer punto listo. Elegí el segundo.
                </p>
              )}
            </div>
          )}
          {inspector === 'plans' && (
            <div className="plan-list">
              {professional && (
                <label className={`plan-upload ${saving ? 'disabled' : ''}`}>
                  <FileText />
                  <span>
                    <strong>{saving ? 'Subiendo…' : 'Añadir plano'}</strong>
                    <small>PDF o imagen · hasta 100 MB</small>
                  </span>
                  <input
                    type="file"
                    accept="application/pdf,image/png,image/jpeg,image/webp"
                    disabled={saving}
                    onChange={(event) => {
                      void uploadPlan(event.target.files?.[0]);
                      event.target.value = '';
                    }}
                  />
                </label>
              )}
              {versionPlans.map((plan) => (
                <article key={plan.id}>
                  <span>
                    <FileText />
                  </span>
                  <div>
                    <strong>{plan.name}</strong>
                    <small>
                      {[
                        plan.sheet,
                        plan.size ? formatBytes(plan.size) : 'Referencia',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </small>
                  </div>
                  {plan.key ? (
                    <a
                      download={plan.name}
                      href={`/api/studio?asset=${encodeURIComponent(plan.key)}${sharedToken ? `&share=${encodeURIComponent(sharedToken)}` : `&project=${encodeURIComponent(activeProject)}`}`}
                      aria-label={`Descargar ${plan.name}`}
                    >
                      <Download />
                    </a>
                  ) : (
                    <span className="plan-reference">Referencia</span>
                  )}
                </article>
              ))}
              {!versionPlans.length && (
                <div className="inspector-empty">
                  <Files />
                  <p>Todavía no hay planos vinculados a esta versión.</p>
                </div>
              )}
            </div>
          )}
        </aside>

        <aside
          id="project-comments"
          inert={!panelOpen}
          className={`comments-panel ${panelOpen ? 'open' : ''}`}
          aria-label="Comentarios del proyecto"
        >
          <div className="comments-head">
            <div>
              <span className="section-kicker">Conversación</span>
              <h2>
                Comentarios <span>{visibleComments.length}</span>
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              aria-label="Cerrar comentarios"
            >
              <PanelRightClose size={18} />
            </button>
          </div>

          {storageError && (
            <div className="storage-error" role="alert">
              {storageError}
              <button
                onClick={() => void refresh(activeProject).catch(() => {})}
              >
                Reintentar
              </button>
            </div>
          )}
          <div
            className="comment-filters"
            role="tablist"
            aria-label="Alcance de los comentarios"
          >
            <button
              role="tab"
              aria-selected={commentScope === 'project'}
              className={commentScope === 'project' ? 'active' : ''}
              onClick={() => setCommentScope('project')}
            >
              Todo el proyecto{' '}
              <span>
                {comments.filter((item) => item.scope === 'project').length}
              </span>
            </button>
            <button
              role="tab"
              aria-selected={commentScope === 'point'}
              className={commentScope === 'point' ? 'active' : ''}
              onClick={() => setCommentScope('point')}
            >
              Punto elegido{' '}
              <span>
                {selection
                  ? comments.filter((item) =>
                      selection.anchor
                        ? item.anchor === selection.anchor
                        : item.scope === 'point' &&
                          item.version === version &&
                          item.surface === selection.surface &&
                          samePoint(item.point, selection.point),
                    ).length
                  : '—'}
              </span>
            </button>
          </div>
          {commentScope === 'point' && referencePoints.length > 0 && (
            <div className="reference-list" aria-label="Puntos de referencia">
              {referencePoints.map((reference, index) => (
                <button
                  type="button"
                  key={reference.id}
                  className={selection?.anchor === reference.id ? 'active' : ''}
                  onClick={() => {
                    setSelection({
                      surface: reference.label,
                      point: reference.point,
                      anchor: reference.id,
                    });
                    command('focus-point');
                  }}
                >
                  <span>{index + 1}</span>
                  <span>
                    <strong>{reference.label}</strong>
                    <small>
                      {reference.count}{' '}
                      {reference.count === 1 ? 'comentario' : 'comentarios'}
                    </small>
                  </span>
                  <i className={reference.resolved ? 'resolved' : ''} />
                </button>
              ))}
            </div>
          )}
          {commentScope === 'project' || selection ? (
            <>
              <div className="selected-surface">
                <span className="surface-thumb">
                  {commentScope === 'project' ? (
                    <House size={17} />
                  ) : (
                    <Sparkles size={17} />
                  )}
                </span>
                <span>
                  <small>
                    {commentScope === 'project'
                      ? 'Conversación general'
                      : 'Punto seleccionado'}
                  </small>
                  <strong>
                    {commentScope === 'project'
                      ? activeProjectName
                      : selection?.surface}
                  </strong>
                </span>
                {commentScope === 'project' ? (
                  <MessageCircle size={17} />
                ) : (
                  <CircleDot size={17} />
                )}
              </div>
              <div className="comment-thread">
                {visibleComments.length ? (
                  visibleComments.map((comment) => (
                    <article className="comment-card" key={comment.id}>
                      <div
                        className={`avatar ${comment.initials === 'EN' ? 'studio' : ''}`}
                      >
                        {comment.initials}
                      </div>
                      <div>
                        <div className="comment-meta">
                          <strong>{comment.author}</strong>
                          <span>{comment.time}</span>
                        </div>
                        {comment.scope === 'point' && (
                          <button
                            className="comment-anchor"
                            onClick={() => {
                              if (comment.point) {
                                setSelection({
                                  surface: comment.surface,
                                  point: comment.point,
                                  anchor: comment.anchor,
                                });
                                setCommentScope('point');
                                command('focus-point');
                              }
                            }}
                          >
                            <CircleDot /> {comment.surface}
                          </button>
                        )}
                        <p>{comment.text}</p>
                        <div className="comment-footer">
                          <span className={`comment-state ${comment.state}`}>
                            {comment.state === 'abierto'
                              ? 'Abierto'
                              : 'Resuelto'}{' '}
                            ·{' '}
                            {comment.scope === 'project'
                              ? 'Proyecto completo'
                              : activeVersion?.name ||
                                comment.version.toUpperCase()}
                          </span>
                          {professional && comment.state === 'abierto' && (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void resolveComment(comment.id)}
                            >
                              <Check /> Resolver
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="empty-thread">
                    <MessageCircle size={24} />
                    <p>
                      {commentScope === 'project'
                        ? 'Todavía no hay comentarios generales. Abrí la conversación con una decisión o una pregunta.'
                        : 'Todavía no hay comentarios en este punto.'}
                    </p>
                  </div>
                )}
              </div>
              <div className="comment-composer">
                <Textarea
                  value={draft}
                  maxLength={5000}
                  disabled={(commentScope === 'point' && !selection) || saving}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={
                    commentScope === 'project'
                      ? 'Escribí un comentario para todo el proyecto…'
                      : `Comentá este punto${selection ? ` de ${selection.surface}` : ''}…`
                  }
                  aria-label="Nuevo comentario"
                />
                <div>
                  <span className="composer-context">
                    {commentScope === 'project'
                      ? 'Visible en todas las entregas'
                      : 'Vinculado a esta versión y cámara'}
                  </span>
                  <Button
                    onClick={addComment}
                    disabled={
                      !draft.trim() ||
                      (commentScope === 'point' && !selection) ||
                      saving
                    }
                  >
                    <Send /> {saving ? 'Guardando…' : 'Enviar'}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-thread panel-empty">
              <MessageSquarePlus size={28} />
              <h3>Elegí un punto</h3>
              <p>
                Activá la herramienta de comentario y tocá una superficie del
                modelo.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setInteractionMode('comment');
                  setPanelOpen(false);
                }}
              >
                <CircleDot /> Elegir en el modelo
              </Button>
            </div>
          )}
        </aside>

        <footer className="version-dock">
          <div className="version-title">
            <span>Versiones</span>
            <strong>{activeVersion?.name || 'Sin versiones'}</strong>
          </div>
          <div className="version-track" aria-label="Versiones del proyecto">
            {shownVersions.map((item) => (
              <button
                type="button"
                key={item.id}
                className={version === item.id ? 'active' : ''}
                aria-current={version === item.id ? 'step' : undefined}
                aria-busy={version === item.id && modelBusy}
                title={item.name}
                onClick={() => changeVersion(item.id)}
              >
                {version === item.id && modelBusy ? (
                  <LoaderCircle
                    className="version-indicator model-spinner"
                    aria-hidden="true"
                  />
                ) : (
                  <i className="version-indicator" aria-hidden="true" />
                )}
                <span>{versionLabel(item)}</span>
                <small>{item.name}</small>
                <time>
                  {item.published
                    ? new Date(item.created).toLocaleDateString('es-AR', {
                        day: '2-digit',
                        month: 'short',
                      })
                    : 'Borrador'}
                </time>
              </button>
            ))}
            {!shownVersions.length && (
              <span className="empty-version-track">
                Importá el primer modelo
              </span>
            )}
          </div>
          <div className="version-status">
            {activeVersion && !activeVersion.published && professional ? (
              <Button
                onClick={async () => {
                  try {
                    await studioRequest(
                      { action: 'publish', id: version },
                      '',
                      activeProject,
                    );
                    await refresh(activeProject);
                    showToast('Entrega publicada para el cliente');
                  } catch (error) {
                    showToast((error as Error).message);
                  }
                }}
              >
                Publicar entrega
              </Button>
            ) : (
              <>
                <span />
                {activeVersion
                  ? 'Publicada para el cliente'
                  : 'Proyecto sin entregas'}
              </>
            )}
          </div>
        </footer>
      </section>
      {professional && (
        <button
          className="sketchup-example"
          disabled={loading}
          onClick={example}
        >
          Probar ejemplo de SketchUp <span>DAE · Silla</span>
        </button>
      )}
      <ImportDialog
        key={activeProject}
        open={importOpen}
        onOpenChange={setImportOpen}
        projects={projects}
        activeProject={activeProject}
        onImported={async (id, project) => {
          await refresh(project, '');
          changeVersion(id);
        }}
      />
      <Dialog
        open={accountOpen}
        onOpenChange={(value) => {
          if (accessMode) setAccountOpen(value);
        }}
      >
        <DialogContent
          className={`role-dialog ${!signedIn && !localPreview ? 'auth-dialog' : ''}`}
          showCloseButton={!!accessMode}
        >
          <DialogTitle>
            {signedIn || localPreview
              ? 'Tu cuenta'
              : sharedToken
                ? 'Guardá esta revisión'
                : 'Bienvenido a Fabrica'}
          </DialogTitle>
          <DialogDescription>
            {signedIn || localPreview
              ? sharedToken
                ? 'Acceso desde el enlace privado del proyecto.'
                : 'Administrá tu cuenta.'
              : sharedToken
                ? 'Ingresá para volver cuando quieras.'
                : 'Ingresá o creá tu cuenta.'}
          </DialogDescription>
          {signedIn || localPreview ? (
            <>
              {user && (
                <div className="account-summary">
                  <span>{user.name.slice(0, 2).toUpperCase()}</span>
                  <div>
                    <strong>{user.name}</strong>
                    <small>{user.email}</small>
                  </div>
                  {user.provider !== 'chatgpt' ? (
                    <button type="button" onClick={() => void logout()}>
                      <LogOut /> Salir
                    </button>
                  ) : (
                    <a
                      target="_top"
                      href="/signout-with-chatgpt?return_to=%2Festudio"
                    >
                      <LogOut /> Salir
                    </a>
                  )}
                </div>
              )}
              <p className="role-note">
                {localPreview
                  ? 'Modo de prueba local. Los datos se guardan en este entorno.'
                  : sharedToken
                    ? 'El modo cliente sólo se habilita desde un enlace privado de revisión.'
                    : 'El acceso sin enlace privado corresponde siempre al espacio profesional.'}
              </p>
              <a className="role-back" href="/">
                Volver a Fabrica
              </a>
            </>
          ) : (
            <StudioAuthPanel
              sharedToken={sharedToken}
              initialError={initialAuthError}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="small-studio-dialog share-access-dialog">
          <DialogTitle>Compartir revisión</DialogTitle>
          <DialogDescription>
            El cliente entra desde un enlace privado, sin crear una cuenta. Sólo
            verá las entregas que publiques y podrá dejar comentarios.
          </DialogDescription>
          <div className="share-recipient">
            <span>
              <UserRound />
            </span>
            <div>
              <strong>{activeClient?.name || 'Cliente del proyecto'}</strong>
              <small>
                {activeClient?.email ||
                  'Sin email cargado · compartilo por el canal que prefieras'}
              </small>
            </div>
          </div>
          <div className={`share-status ${shareActive ? 'active' : ''}`}>
            <span className="share-status-icon">
              {shareActive ? <Link2 /> : <CalendarClock />}
            </span>
            <div>
              <strong>
                {shareActive ? 'Enlace activo' : 'No hay un enlace activo'}
              </strong>
              <small>
                {shareActive
                  ? `Disponible hasta ${shareExpiryLabel}`
                  : 'Creá uno nuevo para habilitar la revisión.'}
              </small>
            </div>
          </div>
          <label>
            Duración del nuevo enlace
            <select
              value={shareDays}
              onChange={(event) => setShareDays(Number(event.target.value))}
            >
              <option value={7}>7 días</option>
              <option value={30}>30 días</option>
              <option value={90}>90 días</option>
            </select>
          </label>
          <p className="share-help">
            Crear o renovar el enlace invalida el anterior. También podés
            revocarlo inmediatamente desde acá.
          </p>
          <div className="share-actions">
            {shareActive && (
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => void revokeShare()}
              >
                Revocar
              </Button>
            )}
            {shareActive && (
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => void createShare(false)}
              >
                <RotateCcw /> Renovar
              </Button>
            )}
            <Button disabled={saving} onClick={() => void copyShare()}>
              <Link2 />
              {saving
                ? 'Preparando…'
                : shareActive
                  ? 'Copiar enlace'
                  : 'Crear y copiar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={clientsDialogOpen} onOpenChange={setClientsDialogOpen}>
        <DialogContent className="client-directory-dialog">
          <DialogTitle>Tu cartera de clientes</DialogTitle>
          <DialogDescription>
            Cada cliente reúne sus proyectos para que encuentres rápidamente el
            trabajo y la conversación que necesitás.
          </DialogDescription>
          <div className="client-directory-list">
            {clientGroups.length ? (
              clientGroups.map((client) => (
                <article className="client-directory-card" key={client.id}>
                  <header>
                    <span className="client-avatar">
                      {client.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <strong>{client.name}</strong>
                      <small>
                        {client.email ? (
                          <>
                            <Mail /> {client.email}
                          </>
                        ) : (
                          'Sin email de contacto'
                        )}
                      </small>
                    </div>
                    <b>
                      {client.projects.length}{' '}
                      {client.projects.length === 1 ? 'proyecto' : 'proyectos'}
                    </b>
                  </header>
                  <div className="client-project-links">
                    {client.projects.map((project) => (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => {
                          setClientsDialogOpen(false);
                          void switchProject(project.id);
                        }}
                      >
                        <span>{project.name}</span>
                        <small>Abrir →</small>
                      </button>
                    ))}
                    {!client.projects.length && (
                      <span>Todavía no tiene proyectos asociados.</span>
                    )}
                    <button
                      type="button"
                      className="client-new-project"
                      onClick={() => {
                        setNewProjectClient(client.id);
                        setClientsDialogOpen(false);
                        setProjectDialogOpen(true);
                      }}
                    >
                      <Plus /> Crear proyecto para {client.name}
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="client-directory-empty">
                <UsersRound />
                <strong>Tu cartera está lista para el primer cliente</strong>
                <span>
                  Guardá su nombre y después asociá todos sus proyectos.
                </span>
              </div>
            )}
          </div>
          <div className="client-directory-actions">
            <Button
              variant="outline"
              onClick={() => setClientsDialogOpen(false)}
            >
              Cerrar
            </Button>
            <Button
              onClick={() => {
                setClientsDialogOpen(false);
                setClientDialogOpen(true);
              }}
            >
              <Plus /> Nuevo cliente
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={clientDialogOpen}
        onOpenChange={(open) => {
          setClientDialogOpen(open);
          if (!open && clientsDialogOpen) setClientsDialogOpen(true);
        }}
      >
        <DialogContent className="small-studio-dialog">
          <DialogTitle>Nuevo cliente</DialogTitle>
          <DialogDescription>
            Sumalo a tu cartera. Después podrás asociarle uno o más proyectos.
          </DialogDescription>
          <label>
            Nombre del cliente
            <input
              autoFocus
              maxLength={120}
              value={newClientName}
              onChange={(event) => setNewClientName(event.target.value)}
            />
          </label>
          <label>
            Email <span className="optional-label">Opcional</span>
            <input
              type="email"
              maxLength={200}
              value={newClientEmail}
              onChange={(event) => setNewClientEmail(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void createClient();
              }}
            />
          </label>
          <div>
            <Button
              variant="outline"
              onClick={() => setClientDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              disabled={!newClientName.trim() || saving}
              onClick={() => void createClient()}
            >
              <Plus /> {saving ? 'Guardando…' : 'Agregar cliente'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <DialogContent className="small-studio-dialog">
          <DialogTitle>Nuevo proyecto</DialogTitle>
          <DialogDescription>
            Creá el espacio que reunirá sus versiones, vistas y comentarios.
          </DialogDescription>
          <label>
            Nombre del proyecto
            <input
              maxLength={120}
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void createProject();
              }}
              placeholder="Ej. Casa del Lago"
            />
          </label>
          <label>
            Cliente
            <select
              value={newProjectClient}
              onChange={(event) => setNewProjectClient(event.target.value)}
            >
              <option value="">Sin cliente asignado</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
          <div>
            <Button
              variant="outline"
              onClick={() => setProjectDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              disabled={!newProjectName.trim() || saving}
              onClick={() => void createProject()}
            >
              <FolderPlus /> {saving ? 'Creando…' : 'Crear proyecto'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="small-studio-dialog">
          <DialogTitle>Guardar vista</DialogTitle>
          <DialogDescription>
            La posición actual de la cámara quedará disponible en “
            {activeVersion?.name}”.
          </DialogDescription>
          <label>
            Nombre de la vista
            <input
              maxLength={80}
              value={viewName}
              onChange={(event) => setViewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void saveView();
              }}
              placeholder="Ej. Acceso principal"
            />
          </label>
          <div>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!viewName.trim() || saving}
              onClick={() => void saveView()}
            >
              <Camera /> {saving ? 'Guardando…' : 'Guardar vista'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={versionDialogOpen} onOpenChange={setVersionDialogOpen}>
        <DialogContent className="small-studio-dialog version-dialog">
          <DialogTitle>Nueva versión</DialogTitle>
          <DialogDescription>
            Partirá de{' '}
            {activeVersion
              ? `${versionLabel(activeVersion)} · ${activeVersion.name}`
              : 'la versión actual'}{' '}
            y quedará como borrador.
          </DialogDescription>
          <label>
            Nombre de la versión
            <input
              maxLength={150}
              value={versionName}
              onChange={(event) => setVersionName(event.target.value)}
              placeholder="Ej. Ajuste de carpinterías"
            />
          </label>
          <label htmlFor="studio-version-description">
            Qué cambia
            <Textarea
              id="studio-version-description"
              maxLength={1000}
              value={versionDescription}
              onChange={(event) => setVersionDescription(event.target.value)}
              placeholder="Resumen breve para el equipo y el cliente"
            />
          </label>
          <div>
            <Button
              variant="outline"
              onClick={() => setVersionDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              disabled={!versionName.trim() || saving}
              onClick={() => void createVersion()}
            >
              <CopyPlus /> {saving ? 'Creando…' : 'Crear borrador'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={measurementDialogOpen}
        onOpenChange={(open) => {
          setMeasurementDialogOpen(open);
          if (!open) {
            setMeasurementStart(null);
            setMeasurementEnd(null);
          }
        }}
      >
        <DialogContent className="small-studio-dialog">
          <DialogTitle>Guardar medida</DialogTitle>
          <DialogDescription>
            {measurementStart && measurementEnd
              ? `${Math.hypot(
                  measurementEnd.point[0] - measurementStart.point[0],
                  measurementEnd.point[1] - measurementStart.point[1],
                  measurementEnd.point[2] - measurementStart.point[2],
                ).toLocaleString('es-AR', {
                  maximumFractionDigits: 2,
                })} ${activeVersion?.unit || 'm'} entre los dos puntos.`
              : 'Nombrá esta medida para encontrarla luego.'}
          </DialogDescription>
          <label>
            Nombre de la medida
            <input
              maxLength={100}
              value={measurementName}
              onChange={(event) => setMeasurementName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void saveMeasurement();
              }}
              placeholder="Ej. Ancho libre"
            />
          </label>
          <div>
            <Button
              variant="outline"
              onClick={() => setMeasurementDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              disabled={!measurementName.trim() || saving}
              onClick={() => void saveMeasurement()}
            >
              <Ruler /> {saving ? 'Guardando…' : 'Guardar medida'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {toast && (
        <div className="studio-toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
    </main>
  );
}
