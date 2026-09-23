import { SkpFile, toInstancedGLB } from 'openskp';

self.onmessage = async (event: MessageEvent<string>) => {
  try {
    const response = await fetch(event.data);
    if (!response.ok) throw new Error('No se pudo descargar el archivo SKP.');
    const scene = SkpFile.fromBuffer(await response.arrayBuffer()).buildInstancedScene();
    const glb = toInstancedGLB(scene, { textures: true });
    const bytes = glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength);
    self.postMessage({ bytes }, { transfer: [bytes] });
  } catch (error) {
    self.postMessage({ error: (error as Error).message });
  }
};
