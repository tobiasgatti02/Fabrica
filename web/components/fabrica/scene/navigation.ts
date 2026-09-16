import { Vector3 } from 'three';

/** Keep dollying useful inside a model by carrying the orbit target forward.
 * Moving the target along the viewing axis preserves the camera pose.
 */
export function advanceOrbitTarget(
  position: Vector3,
  target: Vector3,
  minimumDistance: number,
): void {
  const direction = target.clone().sub(position);
  const distance = direction.length();
  if (distance >= minimumDistance || distance === 0) return;
  target.copy(position).addScaledVector(direction, minimumDistance / distance);
}
