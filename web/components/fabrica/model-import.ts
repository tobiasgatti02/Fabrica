import * as THREE from 'three';

export const viewFormats = [
  'glb',
  'gltf',
  'dae',
  'obj',
  'fbx',
  'stl',
  'ply',
  '3ds',
];
export const extension = (name: string) =>
  name.split('.').pop()?.toLowerCase() || '';

export type ModelUpAxis = 'auto' | 'x' | 'y' | 'z';

function detectUpAxis(
  name: string,
  object: THREE.Object3D,
  source = '',
): Exclude<ModelUpAxis, 'auto'> {
  const format = extension(name);
  // glTF is always Y-up. The Collada and FBX loaders apply the axis metadata
  // while parsing, so their result is Y-up as well.
  if (['glb', 'gltf', 'dae', 'fbx'].includes(format)) return 'y';
  if (format === 'obj' && /^# Created by FreeCAD\b/im.test(source)) return 'z';

  // OBJ/STL/PLY do not carry a reliable up-axis. Architectural scenes tend to
  // be much wider/deeper than tall, so use the clearly shortest dimension as
  // vertical. Keep Y when the proportions are ambiguous.
  const size = new THREE.Box3()
    .setFromObject(object)
    .getSize(new THREE.Vector3());
  const dimensions = [
    { axis: 'x' as const, value: size.x },
    { axis: 'y' as const, value: size.y },
    { axis: 'z' as const, value: size.z },
  ].sort((a, b) => a.value - b.value);
  if (
    dimensions[0].axis !== 'y' &&
    dimensions[0].value > 0 &&
    dimensions[0].value * 1.35 < dimensions[1].value
  )
    return dimensions[0].axis;
  return 'y';
}

function alignUpAxis(
  object: THREE.Object3D,
  axis: Exclude<ModelUpAxis, 'auto'>,
) {
  if (axis === 'z') object.rotateX(-Math.PI / 2);
  if (axis === 'x') object.rotateZ(Math.PI / 2);
  object.updateMatrixWorld(true);
}

export function repairSketchUpColladaMaterials(
  root: THREE.Object3D,
  source: string,
) {
  if (!/<authoring_tool>[^<]*SketchUp[^<]*<\/authoring_tool>/i.test(source))
    return;

  const repaired = new Set<THREE.Material>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material]) {
      // Older SketchUp DAE exports use a zero transparency factor for opaque
      // materials. ColladaLoader reads that value as zero opacity, leaving only
      // the model's shadow visible in the viewer.
      if (
        material.transparent &&
        material.opacity === 0 &&
        !repaired.has(material)
      ) {
        material.opacity = 1;
        material.transparent = false;
        material.needsUpdate = true;
        repaired.add(material);
      }
    }
  });
}

export function disposeModel(root: THREE.Object3D) {
  const textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material]) {
        for (const value of Object.values(material))
          if (value instanceof THREE.Texture) textures.add(value);
        material.dispose();
      }
    }
  });
  textures.forEach((texture) => texture.dispose());
}

export async function loadModel(
  name: string,
  files: Record<string, string>,
  requestedUpAxis: ModelUpAxis = 'auto',
): Promise<THREE.Group> {
  const manager = new THREE.LoadingManager();
  // Some parsers return geometry before their texture requests have finished.
  const resourcesReady = new Promise<void>((resolve) => {
    manager.onLoad = resolve;
  });
  manager.itemStart('fabrica-model');
  const missing = new Set<string>();
  manager.setURLModifier((url) => {
    if (
      url.startsWith('data:') ||
      url.startsWith('blob:') ||
      Object.values(files).includes(url) ||
      url.startsWith('/draco/')
    )
      return url;
    const path = decodeURIComponent(url)
      .replaceAll('\\', '/')
      .replace(/^\.\//, '');
    const exact = files[path];
    const matches = Object.keys(files).filter(
      (key) => key.split('/').pop() === path.split('/').pop(),
    );
    if (exact) return exact;
    if (matches.length === 1) return files[matches[0]];
    missing.add(path);
    return 'data:application/octet-stream;base64,';
  });
  manager.onError = (url) => missing.add(url);
  let object: THREE.Object3D;
  let source = '';
  const url = files[name];
  switch (extension(name)) {
    case 'glb':
    case 'gltf': {
      const [{ GLTFLoader }, { DRACOLoader }, { MeshoptDecoder }] =
        await Promise.all([
        import('three/examples/jsm/loaders/GLTFLoader.js'),
        import('three/examples/jsm/loaders/DRACOLoader.js'),
        import('three/examples/jsm/libs/meshopt_decoder.module.js'),
      ]);
      const draco = new DRACOLoader().setDecoderPath('/draco/');
      try {
        object = (
          await new GLTFLoader(manager)
            .setDRACOLoader(draco)
            .setMeshoptDecoder(MeshoptDecoder)
            .loadAsync(url)
        ).scene;
      } finally {
        draco.dispose();
      }
      break;
    }
    case 'dae': {
      const { ColladaLoader } =
        await import('three/examples/jsm/loaders/ColladaLoader.js');
      const source = await new THREE.FileLoader(manager).loadAsync(url);
      if (typeof source !== 'string')
        throw new Error('No se pudo leer el archivo DAE.');
      const result = new ColladaLoader(manager).parse(
        source,
        THREE.LoaderUtils.extractUrlBase(url),
      );
      if (!result) throw new Error('No se pudo leer el archivo DAE.');
      object = result.scene;
      repairSketchUpColladaMaterials(object, source);
      break;
    }
    case 'fbx': {
      const { FBXLoader } =
        await import('three/examples/jsm/loaders/FBXLoader.js');
      object = await new FBXLoader(manager).loadAsync(url);
      break;
    }
    case 'obj': {
      const { OBJLoader } =
        await import('three/examples/jsm/loaders/OBJLoader.js');
      const loader = new OBJLoader(manager);
      const mtl = Object.keys(files).find((key) => extension(key) === 'mtl');
      if (mtl) {
        const { MTLLoader } =
          await import('three/examples/jsm/loaders/MTLLoader.js');
        const materials = await new MTLLoader(manager).loadAsync(files[mtl]);
        materials.preload();
        loader.setMaterials(materials);
      }
      const loaded = await new THREE.FileLoader(manager).loadAsync(url);
      if (typeof loaded !== 'string')
        throw new Error('No se pudo leer el archivo OBJ.');
      source = loaded;
      object = loader.parse(source);
      break;
    }
    case '3ds': {
      const { TDSLoader } =
        await import('three/examples/jsm/loaders/TDSLoader.js');
      object = await new TDSLoader(manager).loadAsync(url);
      break;
    }
    case 'stl':
    case 'ply': {
      const geometry =
        extension(name) === 'stl'
          ? await new (
              await import('three/examples/jsm/loaders/STLLoader.js')
            ).STLLoader(manager).loadAsync(url)
          : await new (
              await import('three/examples/jsm/loaders/PLYLoader.js')
            ).PLYLoader(manager).loadAsync(url);
      geometry.computeVertexNormals();
      object = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
          color: '#c8c3b3',
          vertexColors: !!geometry.getAttribute('color'),
          side: THREE.DoubleSide,
        }),
      );
      break;
    }
    default:
      throw new Error(
        'Este formato necesita una exportación GLB, DAE, FBX u OBJ para visualizarse.',
      );
  }
  manager.itemEnd('fabrica-model');
  await resourcesReady;
  if (missing.size) {
    disposeModel(object);
    throw new Error(
      'Faltan recursos del modelo. Incluí las texturas, archivos BIN y MTL junto al archivo principal.',
    );
  }
  const upAxis =
    requestedUpAxis === 'auto'
      ? detectUpAxis(name, object, source)
      : requestedUpAxis;
  alignUpAxis(object, upAxis);
  const root = new THREE.Group();
  root.add(object);
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  const largest = Math.max(size.x, size.y, size.z);
  if (bounds.isEmpty() || !Number.isFinite(largest) || largest <= 0) {
    disposeModel(root);
    throw new Error('El archivo no contiene geometría 3D visible.');
  }
  const center = bounds.getCenter(new THREE.Vector3());
  object.position.sub(center);
  root.scale.setScalar(11 / largest);
  root.position.y = (size.y * 11) / largest / 2;
  let meshes = 0,
    triangles = 0;
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      meshes++;
      triangles +=
        (child.geometry.index?.count ||
          child.geometry.attributes.position?.count ||
          0) / 3;
      child.userData.surface = child.name || `Superficie ${meshes}`;
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  root.updateMatrixWorld(true);
  const modelCenter = new THREE.Box3()
    .setFromObject(root)
    .getCenter(new THREE.Vector3());
  const cameras: Array<{
    id: string;
    name: string;
    position: number[];
    target: number[];
  }> = [];
  root.traverse((child) => {
    if (!(child instanceof THREE.Camera)) return;
    const position = child.getWorldPosition(new THREE.Vector3());
    const direction = child.getWorldDirection(new THREE.Vector3());
    const target = position
      .clone()
      .addScaledVector(
        direction,
        Math.max(position.distanceTo(modelCenter), 1),
      );
    cameras.push({
      id: `imported-camera-${cameras.length}`,
      name: child.name || `Cámara importada ${cameras.length + 1}`,
      position: position.toArray(),
      target: target.toArray(),
    });
  });
  root.userData.views = cameras;
  root.userData.stats = { meshes, triangles: Math.round(triangles) };
  root.userData.upAxis = upAxis;
  return root;
}
