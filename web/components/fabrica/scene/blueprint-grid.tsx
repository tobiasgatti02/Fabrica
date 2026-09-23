import { useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { range } from '../timeline';
import type { SceneController } from './house-scene';

type Props = { controller: RefObject<SceneController> };
const FLOOR_Y = -.16; // Above the terrain, just below the gravel and raised floor.

function lineGeometry(segments: number[][]) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(segments.flat(), 3));
  return geometry;
}

function buildGrid() {
  const minor: number[][] = [];
  const major: number[][] = [];
  const extent = 20;
  const push = (list: number[][], x1: number, z1: number, x2: number, z2: number) =>
    list.push([x1, FLOOR_Y, z1, x2, FLOOR_Y, z2]);

  for (let coordinate = -extent; coordinate <= extent; coordinate++) {
    const lines = coordinate % 4 === 0 ? major : minor;
    push(lines, coordinate, -extent, coordinate, extent);
    push(lines, -extent, coordinate, extent, coordinate);
  }

  // Short survey ticks mark the future footprint without drawing another slab.
  for (const x of [-4, 0, 5]) {
    push(major, x, 4.25, x, 4.7);
    push(major, x, -4.15, x, -4.6);
  }
  for (const z of [-3.5, 0, 3.5]) {
    push(major, -4.8, z, -5.25, z);
    push(major, 5.8, z, 6.25, z);
  }

  return { minor: lineGeometry(minor), major: lineGeometry(major) };
}

export default function BlueprintGrid({ controller }: Props) {
  const geometry = useMemo(() => buildGrid(), []);
  const minorMaterial = useRef<THREE.LineBasicMaterial>(null);
  const majorMaterial = useRef<THREE.LineBasicMaterial>(null);
  const group = useRef<THREE.Group>(null);

  useFrame(() => {
    const progress = controller.current.progress;
    const minorOpacity = .19 * (1 - range(progress, .07, .32));
    const majorOpacity = .32 * (1 - range(progress, .12, .48));
    if (minorMaterial.current) minorMaterial.current.opacity = minorOpacity;
    if (majorMaterial.current) majorMaterial.current.opacity = majorOpacity;
    if (group.current) group.current.visible = majorOpacity > .001;
  });

  return <group ref={group}>
    <lineSegments geometry={geometry.minor} renderOrder={1}>
      <lineBasicMaterial ref={minorMaterial} color="#817b6e" transparent opacity={.19} depthWrite={false} toneMapped={false} />
    </lineSegments>
    <lineSegments geometry={geometry.major} renderOrder={1}>
      <lineBasicMaterial ref={majorMaterial} color="#6d675b" transparent opacity={.32} depthWrite={false} toneMapped={false} />
    </lineSegments>
  </group>;
}
