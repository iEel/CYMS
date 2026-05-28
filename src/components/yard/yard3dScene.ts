import * as THREE from 'three';

export const YARD_SCENE_THEME = {
  background: 0x101827,
  fog: 0x101827,
  concrete: 0x202A38,
  concreteGridMajor: 0x40516A,
  concreteGridMinor: 0x263244,
  laneLine: 0xCBD5E1,
  zoneLabel: '#F8FAFC',
  mutedLabel: '#94A3B8',
  selection: 0xFACC15,
  reeferPost: 0x22D3EE,
} as const;

export function applyRendererQuality(renderer: THREE.WebGLRenderer) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
}

export function createYardLights() {
  const group = new THREE.Group();

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  group.add(ambientLight);

  const sun = new THREE.DirectionalLight(0xffffff, 1.35);
  sun.position.set(24, 34, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 90;
  sun.shadow.camera.left = -60;
  sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 60;
  sun.shadow.camera.bottom = -60;
  group.add(sun);

  const fill = new THREE.DirectionalLight(0x93c5fd, 0.18);
  fill.position.set(-18, 12, -14);
  group.add(fill);

  return group;
}

export function createConcreteMaterial() {
  return new THREE.MeshStandardMaterial({
    color: YARD_SCENE_THEME.concrete,
    roughness: 0.96,
    metalness: 0.02,
  });
}

export function createContainerBodyMaterial(color: number, selected = false) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: selected ? 0.45 : 0.64,
    metalness: 0.26,
  });
}
