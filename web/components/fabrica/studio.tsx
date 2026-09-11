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
  Layers3,
  Maximize2,
  MessageCircle,
  MessageSquarePlus,
  MousePointer2,
  PanelRightClose,
  PanelRightOpen,
  Rotate3D,
  Send,
  Share2,
  Sparkles,
  Sun,
  FileBox as FileBoxIcon,
  UserRound,
  Upload,
  Plus,
  Minus,
  Move,
  Play,
  BriefcaseBusiness,
  Download,
  Camera,
  FolderPlus,
  LockKeyhole,
  Mail,
  ShieldCheck,
  LogOut,
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
import {
  ImportDialog,
  studioRequest,
  type StoredVersion,
  type StoredFile,
  type StoredProject,
  type StoredView,
} from './import-dialog';
import {
  loadModel,
  disposeModel,
  extension,
  viewFormats,
} from './model-import';
import { Wordmark } from './landing';

type Stage = 0 | 1 | 2 | 3;
type Version = string;

type SurfaceSelection = {
  surface: string;
  point: [number, number, number];
};

type Viewpoint = {
  position: [number, number, number];
  target: [number, number, number];
};

type Comment = {
  id: string | number;
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

const stages = [
  { number: '01', label: 'Idea', detail: 'Volumen y orientación' },
  { number: '02', label: 'Estructura', detail: 'Muros y cubierta' },
  { number: '03', label: 'Materiales', detail: 'Piedra, madera y luz' },
  { number: '04', label: 'Interior', detail: 'El espacio habitado' },
] as const;

const views: Record<
  string,
  { position: [number, number, number]; target: [number, number, number] }
> = {
  Exterior: { position: [10.8, 7.4, 12.5], target: [0, 1.2, 0] },
  Estar: { position: [4.3, 2.7, 4.7], target: [-0.4, 1.35, -0.2] },
  Planta: { position: [0, 20, 0.01], target: [0, 0, 0] },
  Frente: { position: [0, 3, 16], target: [0, 1.5, 0] },
  Jardín: { position: [-8.5, 4.4, 9.4], target: [0.1, 1.1, 0.2] },
};

const importedViewDirections: Record<string, THREE.Vector3> = {
  Exterior: new THREE.Vector3(1, 0.55, 1),
  Estar: new THREE.Vector3(1, 0.25, 1),
  Planta: new THREE.Vector3(0, 1, 0.001),
  Frente: new THREE.Vector3(0, 0.15, 1),
  Jardín: new THREE.Vector3(-1, 0.45, 1),
};

function parseStoredViews(value?: string): StoredView[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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
  version,
  roofVisible,
  commentMode,
  view,
  selection,
  onSelect,
  cameraCommand,
  imported,
  savedViews,
  onCameraChange,
}: {
  cameraCommand: { id: number; action: string };
  imported: THREE.Group | null;
  savedViews: StoredView[];
  onCameraChange: (viewpoint: Viewpoint) => void;
  stage: Stage;
  version: Version;
  roofVisible: boolean;
  commentMode: boolean;
  view: string;
  selection: SurfaceSelection | null;
  onSelect: (selection: SurfaceSelection) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const state = useRef({
    stage,
    version,
    roofVisible,
    commentMode,
    view,
    selection,
    onSelect,
    cameraCommand,
    imported,
    savedViews,
    onCameraChange,
  });
  const [pin, setPin] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });

  useEffect(() => {
    state.current = {
      stage,
      version,
      roofVisible,
      commentMode,
      view,
      selection,
      onSelect,
      cameraCommand,
      imported,
      savedViews,
      onCameraChange,
    };
  }, [
    stage,
    version,
    roofVisible,
    commentMode,
    view,
    selection,
    onSelect,
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
    camera.position.set(...views.Exterior.position);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
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
    controls.target.set(...views.Exterior.target);

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
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let down = { x: 0, y: 0 };
    const onPointerDown = (event: PointerEvent) => {
      down = { x: event.clientX, y: event.clientY };
    };
    const onPointerUp = (event: PointerEvent) => {
      if (
        !state.current.commentMode ||
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
      state.current.onSelect({
        surface:
          hit.object.userData.surface ||
          hit.object.name ||
          'Superficie del modelo',
        point: [local.x, local.y, local.z],
      });
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    let frame = 0;
    let lastView = 'Exterior';
    let lastCommand = 0;
    let transitioning = false;
    let loaded: THREE.Group | null = null;
    const stopTransition = () => {
      transitioning = false;
    };
    controls.addEventListener('start', stopTransition);
    const desiredPosition = new THREE.Vector3(...views.Exterior.position);
    const desiredTarget = new THREE.Vector3(...views.Exterior.target);
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
        return;
      }
      if (!imported) {
        const preset = views[viewName] || views.Exterior;
        desiredPosition.set(...preset.position);
        desiredTarget.set(...preset.target);
        camera.near = 0.1;
        camera.far = 100;
        camera.updateProjectionMatrix();
        return;
      }

      imported.updateMatrixWorld(true);
      importedBounds.setFromObject(imported).getBoundingSphere(importedSphere);
      const radius = Math.max(importedSphere.radius, 0.1);
      const distance =
        (radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.15;
      desiredTarget.copy(importedSphere.center);
      desiredPosition
        .copy(
          importedViewDirections[viewName] || importedViewDirections.Exterior,
        )
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
      const current = state.current;
      if (loaded !== current.imported) {
        if (loaded) scene.remove(loaded);
        loaded = current.imported;
        if (loaded) scene.add(loaded);
        frameView(current.view, loaded);
        transitioning = true;
      }
      model.visible = !loaded;
      foundation.visible = true;
      structure.visible = current.stage >= 1;
      materials.visible = current.stage >= 2;
      interior.visible = current.stage >= 3;
      roof.visible = current.stage >= 1 && current.roofVisible;
      structure.children.forEach((object) => {
        if (object instanceof THREE.Mesh && object.material === plasterOld)
          object.material = plaster;
        if (object instanceof THREE.Mesh && object.material === plaster)
          object.material = current.version === 'v03' ? plaster : plasterOld;
      });
      materials.children.forEach((object) => {
        if (
          object instanceof THREE.Mesh &&
          (object.material === timber || object.material === timberOld)
        ) {
          object.material = current.version === 'v03' ? timber : timberOld;
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
      controls.enabled = !current.commentMode;
      renderer.domElement.style.cursor = current.commentMode
        ? 'crosshair'
        : 'grab';
      controls.update();
      current.onCameraChange({
        position: camera.position.toArray() as [number, number, number],
        target: controls.target.toArray() as [number, number, number],
      });

      if (current.selection) {
        anchorWorld.set(...current.selection.point);
        (current.imported || model).localToWorld(anchorWorld);
        projected.copy(anchorWorld).project(camera);
        const visible =
          projected.z > -1 &&
          projected.z < 1 &&
          Math.abs(projected.x) <= 1 &&
          Math.abs(projected.y) <= 1;
        setPin((previous) => {
          const next = {
            x: (projected.x * 0.5 + 0.5) * container.clientWidth,
            y: (-projected.y * 0.5 + 0.5) * container.clientHeight,
            visible,
          };
          return Math.abs(previous.x - next.x) > 0.6 ||
            Math.abs(previous.y - next.y) > 0.6 ||
            previous.visible !== visible
            ? next
            : previous;
        });
      } else {
        setPin((previous) =>
          previous.visible ? { x: 0, y: 0, visible: false } : previous,
        );
      }
      renderer.render(scene, camera);
    };
    render();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
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
    <div
      ref={host}
      className="studio-canvas"
      aria-label="Modelo 3D navegable de Casa Patio"
    >
      {pin.visible && (
        <span
          className="surface-pin"
          style={{ left: pin.x, top: pin.y }}
          aria-label="Superficie seleccionada"
        >
          <span />
        </span>
      )}
      <div className="canvas-help">
        <MousePointer2 size={14} />
        {commentMode
          ? 'Elegí una superficie'
          : 'Arrastrá: rotar · clic derecho: desplazar · rueda: zoom'}
      </div>
    </div>
  );
}

function AuthPanel({
  customerSignIn,
  professionalSignIn,
  sharedToken,
}: {
  customerSignIn: string;
  professionalSignIn: string;
  sharedToken: string;
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [accessRole, setAccessRole] = useState<'customer' | 'professional'>(
    sharedToken ? 'customer' : 'professional',
  );
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const strength = [
    password.length >= 10,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
  const returnTo = `/estudio?role=${accessRole}${sharedToken ? `&share=${encodeURIComponent(sharedToken)}` : ''}`;
  const chatgptHref = sharedToken
    ? `/signin-with-chatgpt?return_to=${encodeURIComponent(returnTo)}`
    : accessRole === 'customer'
      ? customerSignIn
      : professionalSignIn;

  const submit = async (event: { preventDefault(): void }) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: mode, name, email, password }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(data.error || 'No pudimos completar el acceso.');
      window.location.assign(returnTo);
    } catch (requestError) {
      setError((requestError as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="auth-layout">
      <section className="auth-intro">
        <span className="auth-mark">
          <ShieldCheck />
        </span>
        <p className="section-kicker">Acceso seguro</p>
        <h3>Tu estudio, tus proyectos y cada conversación.</h3>
        <p>
          Entrá para continuar donde dejaste el trabajo o creá una cuenta nueva.
        </p>
        <div className="auth-trust">
          <LockKeyhole />
          <span>
            <strong>Contraseña protegida</strong>Se guarda como hash PBKDF2 con
            salt único. Nunca en texto plano.
          </span>
        </div>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-tabs" role="tablist" aria-label="Acceso a Fabrica">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={mode === 'login' ? 'active' : ''}
            onClick={() => {
              setMode('login');
              setError('');
            }}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            className={mode === 'register' ? 'active' : ''}
            onClick={() => {
              setMode('register');
              setError('');
            }}
          >
            Crear cuenta
          </button>
        </div>
        <div className="auth-role" aria-label="Tipo de acceso">
          <button
            type="button"
            className={accessRole === 'professional' ? 'active' : ''}
            disabled={!!sharedToken}
            onClick={() => setAccessRole('professional')}
          >
            Profesional
          </button>
          <button
            type="button"
            className={accessRole === 'customer' ? 'active' : ''}
            onClick={() => setAccessRole('customer')}
          >
            Cliente
          </button>
        </div>
        <form onSubmit={submit}>
          {mode === 'register' && (
            <label>
              Nombre y apellido
              <div className="auth-field">
                <UserRound />
                <input
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Cómo querés que te vean"
                  required
                />
              </div>
            </label>
          )}
          <label>
            Email
            <div className="auth-field">
              <Mail />
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nombre@estudio.com"
                required
              />
            </div>
          </label>
          <label>
            Contraseña
            <div className="auth-field">
              <LockKeyhole />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete={
                  mode === 'register' ? 'new-password' : 'current-password'
                }
                minLength={10}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Mínimo 10 caracteres"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={
                  showPassword ? 'Ocultar contraseña' : 'Ver contraseña'
                }
                title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </label>
          {mode === 'register' && (
            <div className="password-strength" aria-live="polite">
              <span>
                {[0, 1, 2, 3].map((index) => (
                  <i key={index} className={index < strength ? 'filled' : ''} />
                ))}
              </span>
              <small>
                {password
                  ? ['Muy débil', 'Débil', 'Buena', 'Fuerte', 'Muy fuerte'][
                      strength
                    ]
                  : 'Usá mayúsculas, números y un símbolo'}
              </small>
            </div>
          )}
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={busy || (mode === 'register' && strength < 2)}
          >
            {busy
              ? 'Verificando…'
              : mode === 'register'
                ? 'Crear mi cuenta'
                : 'Entrar al estudio'}
          </Button>
        </form>
        <div className="auth-divider">
          <span>o</span>
        </div>
        <a className="chatgpt-access" target="_top" href={chatgptHref}>
          Continuar con ChatGPT <span>→</span>
        </a>
        <p className="auth-legal">
          Al continuar aceptás usar tu identidad para atribuir proyectos y
          comentarios.
        </p>
      </section>
    </div>
  );
}

export default function Studio({
  user,
  localPreview,
  customerSignIn,
  professionalSignIn,
}: {
  user: { name: string; email: string; provider: 'chatgpt' | 'fabrica' } | null;
  localPreview: boolean;
  customerSignIn: string;
  professionalSignIn: string;
}) {
  const signedIn = Boolean(user);
  const [role, setRole] = useState<'customer' | 'professional' | null>(null);
  const [roleOpen, setRoleOpen] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [versions, setVersions] = useState<StoredVersion[]>([]);
  const [projects, setProjects] = useState<StoredProject[]>([]);
  const [activeProject, setActiveProject] = useState('');
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewName, setViewName] = useState('');
  const [imported, setImported] = useState<THREE.Group | null>(null);
  const [cameraCommand, setCameraCommand] = useState({
    id: 0,
    action: 'reset',
  });
  const [loading, setLoading] = useState(false);
  const [modelError, setModelError] = useState('');
  const [storageError, setStorageError] = useState('');
  const [share, setShare] = useState('');
  const [sharedToken, setSharedToken] = useState('');
  const [canEdit, setCanEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [commentScope, setCommentScope] = useState<'point' | 'project'>(
    'project',
  );
  const loadSequence = useRef(0);
  const activeModel = useRef<THREE.Group | null>(null);
  const cameraSnapshot = useRef<Viewpoint>({
    position: views.Exterior.position,
    target: views.Exterior.target,
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
      setProjects(
        data.projects?.length
          ? data.projects
          : data.project
            ? [data.project]
            : [],
      );
      if (data.project?.id) setActiveProject(data.project.id);
      setShare(data.share || '');
      setCanEdit(data.owner);
      setStorageError('');
      setComments(
        data.comments.map(
          (comment: {
            id: string;
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
      return data;
    } catch (error) {
      setStorageError((error as Error).message);
      throw error;
    }
  };
  const changeVersion = (id: string) => {
    setVersion(id);
    setSelection(null);
    setCommentScope('project');
    setDraft('');
    setCommentMode(false);
  };

  const [stage, setStage] = useState<Stage>(3);
  const [version, setVersion] = useState<Version>('v03');
  const [roofVisible, setRoofVisible] = useState(true);
  const [commentMode, setCommentMode] = useState(false);
  const [selection, setSelection] = useState<SurfaceSelection | null>({
    surface: 'Ventanal del estar',
    point: [-1.1, 1.8, 3.22],
  });
  const [view, setView] = useState('Exterior');
  // On a phone the canvas is the primary surface. Keep the conversation one tap
  // away instead of opening a drawer over the model on arrival.
  const [panelOpen, setPanelOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('share') || '';
    setSharedToken(token);
    const requested = params.get('role');
    if (
      (signedIn || localPreview) &&
      (requested === 'customer' || requested === 'professional' || token)
    ) {
      setRole(token ? 'customer' : (requested as 'customer' | 'professional'));
      setRoleOpen(false);
    }
    if (signedIn || localPreview) void refresh('', token).catch(() => {});
  }, []);

  const activeFiles = versions.find((item) => item.id === version)?.files;
  useEffect(() => {
    if (!role) return;
    const seq = ++loadSequence.current;
    setModelError('');
    setLoading(false);
    setImported(null);
    if (activeModel.current) {
      disposeModel(activeModel.current);
      activeModel.current = null;
    }
    const selected = versions.find((item) => item.id === version);
    if (!selected) return;
    const files: StoredFile[] = JSON.parse(selected.files);
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
    loadModel(files[0].name, resources)
      .then((model) => {
        if (seq !== loadSequence.current) {
          disposeModel(model);
          return;
        }
        activeModel.current = model;
        setImported(model);
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
  }, [version, activeFiles, role, sharedToken, activeProject]);

  useEffect(() => {
    if (!role || (!signedIn && !localPreview)) return;
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
  }, [role, sharedToken, activeProject]);

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
    setCommentMode(false);
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
  const copyShare = async () => {
    try {
      if (!share)
        throw new Error(
          'El proyecto todavía no está disponible para compartir.',
        );
      await navigator.clipboard.writeText(
        `${location.origin}/estudio?role=customer&share=${encodeURIComponent(share)}`,
      );
      showToast('Enlace de revisión copiado');
    } catch (error) {
      showToast((error as Error).message);
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
    try {
      const data = await refresh(id, '');
      const available = (data.versions as StoredVersion[]).filter(
        (item) => item.published || role === 'professional',
      );
      changeVersion(available.at(-1)?.id || 'v03');
      setView('Exterior');
      showToast(`Proyecto abierto: ${data.project.name}`);
    } catch (error) {
      showToast((error as Error).message);
    }
  };
  const createProject = async () => {
    if (!newProjectName.trim() || saving) return;
    setSaving(true);
    try {
      const data = await studioRequest(
        { action: 'create-project', name: newProjectName.trim() },
        '',
        activeProject,
      );
      setNewProjectName('');
      setProjectDialogOpen(false);
      await refresh(data.project.id, '');
      changeVersion('v03');
      showToast('Proyecto creado');
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
  const logout = async () => {
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
    window.location.assign('/estudio');
  };
  const visibleComments = comments.filter((comment) =>
    commentScope === 'project'
      ? comment.scope === 'project'
      : comment.scope === 'point' &&
        comment.version === version &&
        selection &&
        comment.surface === selection.surface,
  );
  const activeVersion = versions.find((item) => item.id === version);
  const professional = role === 'professional' && canEdit;
  const shownVersions = versions.filter(
    (item) => professional || item.published,
  );
  const savedViews = parseStoredViews(activeVersion?.views);
  const activeProjectName =
    projects.find((item) => item.id === activeProject)?.name || 'Casa Patio';

  return (
    <main className={`studio-shell ${panelOpen ? 'panel-is-open' : ''}`}>
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
                professional
                  ? setProjectMenuOpen((value) => !value)
                  : setRoleOpen(true)
              }
              aria-expanded={professional ? projectMenuOpen : undefined}
            >
              <span>
                <strong>{activeProjectName}</strong>
                <small>
                  {activeVersion?.name || 'Proyecto de muestra'} ·{' '}
                  {professional
                    ? 'Espacio profesional'
                    : 'Revisión del cliente'}
                </small>
              </span>
              <ChevronDown size={16} />
            </button>
            {professional && projectMenuOpen && (
              <div className="project-menu" role="menu">
                <p>
                  Mis proyectos <span>{projects.length}</span>
                </p>
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
                <button
                  type="button"
                  className="new-project"
                  onClick={() => {
                    setProjectMenuOpen(false);
                    setProjectDialogOpen(true);
                  }}
                >
                  <FolderPlus /> Nuevo proyecto
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="studio-header-actions">
          <span className="presence">
            {role === 'professional'
              ? 'Arquitectura e interiorismo'
              : 'Cliente'}
          </span>
          {professional && (
            <Button
              className="studio-import"
              onClick={() => setImportOpen(true)}
            >
              <Upload /> Importar modelo
            </Button>
          )}
          <Button
            variant="outline"
            className="studio-share"
            onClick={copyShare}
            disabled={!share}
          >
            <Share2 /> Compartir
          </Button>
          <button
            className="profile-button"
            type="button"
            aria-label="Ver cuenta y modo de acceso"
            title={user?.name || 'Cuenta'}
            onClick={() => setRoleOpen(true)}
          >
            <UserRound size={17} />
          </button>
        </div>
      </header>

      <section className="studio-workspace">
        {role && !loading && !modelError && (
          <HouseScene
            key={version}
            stage={stage}
            version={version}
            roofVisible={roofVisible}
            commentMode={commentMode}
            view={view}
            selection={selection}
            onSelect={selectSurface}
            cameraCommand={cameraCommand}
            imported={imported}
            savedViews={savedViews}
            onCameraChange={(viewpoint) => {
              cameraSnapshot.current = viewpoint;
            }}
          />
        )}
        {(loading || modelError) && (
          <div className="model-status" role="status">
            <FileBoxIcon />
            <h2>{loading ? 'Preparando modelo…' : 'Archivo original'}</h2>
            <p>
              {loading
                ? 'Cargando geometría y materiales de esta entrega.'
                : modelError}
            </p>
            {!loading &&
              activeVersion &&
              (JSON.parse(activeVersion.files) as StoredFile[]).map((file) => (
                <a
                  key={file.key}
                  download={file.name}
                  href={`/api/studio?asset=${encodeURIComponent(file.key)}${sharedToken ? `&share=${encodeURIComponent(sharedToken)}` : `&project=${encodeURIComponent(activeProject)}`}`}
                >
                  <Download size={16} /> {file.name}
                </a>
              ))}
          </div>
        )}

        <aside
          hidden={!!activeVersion}
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

        <div className="viewer-toolbar" aria-label="Herramientas del modelo">
          <Button
            variant={!commentMode ? 'default' : 'ghost'}
            size="icon"
            aria-label="Orbitar modelo"
            title="Orbitar"
            onClick={() => {
              setCommentMode(false);
              command('orbit');
            }}
          >
            <Rotate3D />
          </Button>
          <Button
            variant={commentMode ? 'default' : 'ghost'}
            size="icon"
            aria-label="Comentar una superficie"
            title="Comentar superficie"
            onClick={() => setCommentMode((value) => !value)}
          >
            <MessageSquarePlus />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Desplazar cámara"
            title="Desplazar"
            onClick={() => {
              setCommentMode(false);
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
            aria-label="Volver a vista inicial"
            title="Vista inicial"
            onClick={() => {
              setView('Exterior');
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
                showToast('Pantalla completa no disponible en este navegador'),
              );
            }}
          >
            <Maximize2 />
          </Button>
        </div>

        <div className="view-presets" aria-label="Vistas guardadas">
          {Object.keys(views).map((name) => (
            <button
              type="button"
              key={name}
              className={view === name ? 'active' : ''}
              onClick={() => {
                setView(name);
                command('reset');
              }}
            >
              {name === 'Exterior' ? (
                <House size={15} />
              ) : name === 'Estar' ? (
                <Layers3 size={15} />
              ) : (
                <Sun size={15} />
              )}
              {name}
            </button>
          ))}
          {savedViews.map((saved) => (
            <button
              type="button"
              key={saved.id}
              className={view === saved.id ? 'active' : ''}
              onClick={() => {
                setView(saved.id);
                command('reset');
              }}
            >
              <Camera size={15} />
              {saved.name}
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

        <div className="roof-control" hidden={!!activeVersion}>
          <span>{roofVisible ? <Eye size={15} /> : <EyeOff size={15} />}</span>
          <label htmlFor="roof-switch">Cubierta</label>
          <Switch
            id="roof-switch"
            checked={roofVisible}
            onCheckedChange={setRoofVisible}
            aria-label="Mostrar cubierta"
          />
        </div>

        <button
          className="mobile-panel-toggle"
          type="button"
          onClick={() => setPanelOpen((value) => !value)}
          aria-label={panelOpen ? 'Ocultar comentarios' : 'Mostrar comentarios'}
          aria-expanded={panelOpen}
          aria-controls="project-comments"
        >
          {panelOpen ? <PanelRightClose /> : <PanelRightOpen />}
          <span>{comments.length}</span>
        </button>

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
                  ? comments.filter(
                      (item) =>
                        item.scope === 'point' &&
                        item.version === version &&
                        item.surface === selection.surface,
                    ).length
                  : '—'}
              </span>
            </button>
          </div>
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
                  setCommentMode(true);
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
            <span>Entregas</span>
            <strong>
              {activeVersion?.name ||
                (version === 'v03'
                  ? 'Materiales cálidos'
                  : 'Propuesta inicial')}
            </strong>
          </div>
          <div className="version-track" aria-label="Versiones del proyecto">
            <button
              type="button"
              className={version === 'v02' ? 'active' : ''}
              onClick={() => changeVersion('v02')}
            >
              <span>V02</span>
              <small>Propuesta inicial</small>
              <time>28 ago</time>
            </button>
            <span className="track-line" />
            <button
              type="button"
              className={version === 'v03' ? 'active' : ''}
              onClick={() => changeVersion('v03')}
            >
              <span>V03</span>
              <small>Materiales cálidos</small>
              <time>Hoy</time>
            </button>
            {shownVersions.map((item, index) => (
              <button
                type="button"
                key={item.id}
                className={version === item.id ? 'active' : ''}
                onClick={() => changeVersion(item.id)}
              >
                <span>{String(index + 4).padStart(2, '0')}</span>
                <small>{item.name}</small>
                <time>{item.published ? 'Publicada' : 'Borrador'}</time>
              </button>
            ))}
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
                  : 'Proyecto de ejemplo'}
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
        open={roleOpen}
        onOpenChange={(value) => {
          if (role) setRoleOpen(value);
        }}
      >
        <DialogContent
          className={`role-dialog ${!signedIn && !localPreview ? 'auth-dialog' : ''}`}
          showCloseButton={!!role}
        >
          <DialogTitle>
            {signedIn || localPreview ? 'Elegí tu espacio' : 'Entrá a Fabrica'}
          </DialogTitle>
          <DialogDescription>
            {signedIn || localPreview
              ? 'Podés recorrer como cliente o gestionar tus proyectos como profesional.'
              : 'Una cuenta para presentar, revisar y conversar sobre cada proyecto.'}
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
                  {user.provider === 'fabrica' ? (
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
              <div className="role-options">
                {[
                  {
                    value: 'customer' as const,
                    label: 'Soy cliente',
                    icon: <UserRound />,
                    description:
                      'Recorré las entregas, compará versiones y dejá tus comentarios.',
                  },
                  {
                    value: 'professional' as const,
                    label: 'Soy profesional',
                    icon: <BriefcaseBusiness />,
                    description:
                      'Creá proyectos, versiones y vistas; publicá para tus clientes.',
                  },
                ]
                  .filter((item) => !sharedToken || item.value === 'customer')
                  .map((item) => (
                    <button
                      key={item.value}
                      onClick={() => {
                        setRole(item.value);
                        setRoleOpen(false);
                        if (
                          item.value === 'customer' &&
                          activeVersion &&
                          !activeVersion.published
                        )
                          changeVersion('v03');
                      }}
                    >
                      {item.icon}
                      <strong>{item.label}</strong>
                      <span>{item.description}</span>
                      <b>Entrar →</b>
                    </button>
                  ))}
              </div>
              <p className="role-note">
                {localPreview
                  ? 'Modo de prueba local. Los datos se guardan en este entorno.'
                  : 'Tu identidad se usa para atribuir proyectos y comentarios.'}
              </p>
              <a className="role-back" href="/">
                Volver a Fabrica
              </a>
            </>
          ) : (
            <AuthPanel
              customerSignIn={customerSignIn}
              professionalSignIn={professionalSignIn}
              sharedToken={sharedToken}
            />
          )}
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
      {toast && (
        <div className="studio-toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
    </main>
  );
}
