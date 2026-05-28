import * as THREE from 'three';
import { YARD_SCENE_THEME } from './yard3dScene';

export function createLaneMarkings(width: number, depth: number, x: number, z: number) {
  const group = new THREE.Group();
  const material = new THREE.LineBasicMaterial({
    color: YARD_SCENE_THEME.laneLine,
    transparent: true,
    opacity: 0.22,
  });

  const left = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(x, 0.035, z),
    new THREE.Vector3(x + width, 0.035, z),
  ]);
  const right = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(x, 0.035, z + depth),
    new THREE.Vector3(x + width, 0.035, z + depth),
  ]);

  group.add(new THREE.Line(left, material));
  group.add(new THREE.Line(right, material));
  return group;
}

export function createDirectionArrow(x: number, z: number, rotationY = 0) {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    color: YARD_SCENE_THEME.laneLine,
    transparent: true,
    opacity: 0.36,
    side: THREE.DoubleSide,
  });

  const shape = new THREE.Shape();
  shape.moveTo(0, 0.45);
  shape.lineTo(0.45, -0.25);
  shape.lineTo(0.16, -0.25);
  shape.lineTo(0.16, -0.72);
  shape.lineTo(-0.16, -0.72);
  shape.lineTo(-0.16, -0.25);
  shape.lineTo(-0.45, -0.25);
  shape.lineTo(0, 0.45);

  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = rotationY;
  mesh.position.set(x, 0.045, z);
  group.add(mesh);
  return group;
}

export function createBayRowTicks(zoneWidth: number, zoneDepth: number, baySlot: number, rowSlot: number, xOffset: number) {
  const group = new THREE.Group();
  const material = new THREE.LineBasicMaterial({
    color: YARD_SCENE_THEME.concreteGridMajor,
    transparent: true,
    opacity: 0.35,
  });

  for (let x = 0; x <= zoneWidth; x += baySlot) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(xOffset + x, 0.04, 0),
      new THREE.Vector3(xOffset + x, 0.04, zoneDepth),
    ]);
    group.add(new THREE.Line(geo, material));
  }

  for (let z = 0; z <= zoneDepth; z += rowSlot) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(xOffset, 0.04, z),
      new THREE.Vector3(xOffset + zoneWidth, 0.04, z),
    ]);
    group.add(new THREE.Line(geo, material));
  }

  return group;
}

export function createReeferPlugPosts(zoneWidth: number, zoneDepth: number, xOffset: number) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: YARD_SCENE_THEME.reeferPost,
    emissive: new THREE.Color(YARD_SCENE_THEME.reeferPost).multiplyScalar(0.12),
    roughness: 0.45,
  });

  const postCount = Math.max(2, Math.floor(zoneWidth / 8));
  for (let i = 0; i < postCount; i += 1) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8), material);
    post.position.set(xOffset + 1 + i * Math.max(4, zoneWidth / postCount), 0.4, zoneDepth + 0.55);
    group.add(post);
  }

  return group;
}

export function createSelectionOutline(width: number, height: number, depth: number) {
  const geometry = new THREE.BoxGeometry(width + 0.12, height + 0.12, depth + 0.12);
  const edges = new THREE.EdgesGeometry(geometry);
  const material = new THREE.LineBasicMaterial({
    color: YARD_SCENE_THEME.selection,
    transparent: true,
    opacity: 0.95,
  });

  return new THREE.LineSegments(edges, material);
}
