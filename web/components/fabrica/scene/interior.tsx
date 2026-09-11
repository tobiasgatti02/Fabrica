'use client';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import type { Group } from 'three';
import { DRACO, INTERIOR, prepareModel, type SceneController } from './house-scene';
import { range } from '../timeline';
import { constructionProgress } from './camera-path';
export default function Interior({ controller, onReady }: { controller: RefObject<SceneController>; onReady: () => void }) {
  const gltf = useGLTF(INTERIOR, DRACO);
  const mobile = useThree(s => s.size.width < 760);
  const prepared = useMemo(() => prepareModel(gltf.scene, mobile), [gltf.scene, mobile]);
  const group = useRef<Group>(null);
  useEffect(() => { onReady(); controller.current.invalidate(); return prepared.dispose; }, [controller, prepared, onReady]);
  useFrame(() => {
    if (!group.current) return;
    const t = controller.current.reduced ? Number(constructionProgress(controller.current.progress) >= .72) : range(constructionProgress(controller.current.progress), .71, .79);
    group.current.visible = t > .001;
    group.current.position.y = (1 - t) * .22;
  }, -1);
  return <group ref={group}><primitive object={prepared.scene} dispose={null} /></group>;
}
