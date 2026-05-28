import * as THREE from 'three';

export interface YardCameraPose {
  position: THREE.Vector3;
  target: THREE.Vector3;
  span: number;
}

export function computeYardHomePose({
  totalWidth,
  maxDepth,
}: {
  totalWidth: number;
  maxDepth: number;
}): YardCameraPose {
  const width = Math.max(totalWidth, 20);
  const depth = Math.max(maxDepth, 8);
  const span = Math.max(width, depth);
  const target = new THREE.Vector3(width / 2, 1.1, depth / 2);
  const position = new THREE.Vector3(
    target.x + span * 0.12,
    Math.max(18, span * 0.34),
    target.z + Math.max(18, span * 0.42),
  );

  return { position, target, span };
}

export function computeYardTopDownPose(home: YardCameraPose): YardCameraPose {
  const height = Math.max(24, home.span * 0.72);
  return {
    position: new THREE.Vector3(home.target.x, height, home.target.z + 0.01),
    target: home.target.clone(),
    span: home.span,
  };
}

export function computeContainerFocusPose(target: THREE.Vector3): YardCameraPose {
  return {
    position: new THREE.Vector3(target.x + 9, target.y + 8, target.z + 9),
    target: target.clone(),
    span: 18,
  };
}
