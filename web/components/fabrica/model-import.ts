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
): Promise<THREE.Group> {
  const manager = new THREE.LoadingManager();
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
  const url = files[name];
  switch (extension(name)) {
    case 'glb':
    case 'gltf': {
      const [{ GLTFLoader }, { DRACOLoader }] = await Promise.all([
        import('three/examples/jsm/loaders/GLTFLoader.js'),
        import('three/examples/jsm/loaders/DRACOLoader.js'),
      ]);
      const draco = new DRACOLoader().setDecoderPath('/draco/');
      try {
        object = (
          await new GLTFLoader(manager).setDRACOLoader(draco).loadAsync(url)
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
      object = await loader.loadAsync(url);
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
  if (missing.size) {
    disposeModel(object);
    throw new Error(
      'Faltan recursos del modelo. Incluí las texturas, archivos BIN y MTL junto al archivo principal.',
    );
  }
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
  root.userData.stats = { meshes, triangles: Math.round(triangles) };
  return root;
}
