const KILOBYTE = 1024;
export const megabytes = (value: number) => value * KILOBYTE * KILOBYTE;

export const modelFormats = [
  'glb',
  'gltf',
  'dae',
  'obj',
  'fbx',
  'stl',
  'ply',
  '3ds',
  'skp',
] as const;

const modelResources = [
  'bin',
  'mtl',
  'jpg',
  'jpeg',
  'png',
  'webp',
  'avif',
  'ktx2',
  'hdr',
] as const;

export const modelFileAccept = [...modelFormats, ...modelResources]
  .map((format) => `.${format}`)
  .join(',');

export const acceptedModelFormats = modelFormats
  .map((format) => format.toUpperCase())
  .join(', ')
  .replace('GLTF', 'glTF');

export const INSPIRATION_FILE_LIMIT_MB = 20;
export const INSPIRATION_FILE_LIMIT = megabytes(INSPIRATION_FILE_LIMIT_MB);

export type FileLike = { name: string; size: number };

export function fileExtension(name: string) {
  return name.split('.').pop()?.toLowerCase() || '';
}

export function isModelFormat(name: string) {
  return modelFormats.includes(
    fileExtension(name) as (typeof modelFormats)[number],
  );
}

export function modelFilesError(files: readonly FileLike[]) {
  const rejected = files.find(
    (file) =>
      ![...modelFormats, ...modelResources].includes(
        fileExtension(file.name) as (typeof modelFormats)[number],
      ),
  );
  if (rejected)
    return `“${rejected.name}” no es un archivo aceptado. En Modelo 3D se aceptan: ${acceptedModelFormats}.`;
  if (!files.some((file) => isModelFormat(file.name)))
    return `Elegí un modelo principal. En Modelo 3D se aceptan: ${acceptedModelFormats}.`;
  return '';
}

export function inspirationFileError(file: FileLike) {
  if (!file.size) return 'El archivo está vacío.';
  if (file.size > INSPIRATION_FILE_LIMIT)
    return `Cada archivo de la mesa de trabajo puede pesar hasta ${INSPIRATION_FILE_LIMIT_MB} MB.`;
  return '';
}
