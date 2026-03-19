'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

interface ContainerBlock {
  container_id: number;
  container_number: string;
  size: string;
  type: string;
  status: string;
  shipping_line: string;
  is_laden: boolean;
  bay: number;
  row: number;
  tier: number;
  zone_name: string;
  zone_type: string;
}

interface ZoneInfo {
  zone_id: number;
  zone_name: string;
  zone_type: string;
  max_bay: number;
  max_row: number;
  max_tier: number;
  container_count: number;
  capacity: number;
}

interface Props {
  yardId: number;
  selectedZone?: string;
  onSelectContainer?: (c: ContainerBlock | null) => void;
  highlightContainerNumber?: string;
}

const STATUS_COLORS: Record<string, number> = {
  in_yard: 0x10B981,  // emerald
  hold:    0xF59E0B,  // amber
  repair:  0xEF4444,  // red
  released:0x94A3B8,  // slate
};

const ZONE_FLOOR_COLORS: Record<string, number> = {
  dry:    0x3B82F6,
  reefer: 0x06B6D4,
  hazmat: 0xEF4444,
  empty:  0x64748B,
  repair: 0xF59E0B,
  wash:   0x10B981,
};

// Real proportions: 20ft≈6.1m×2.44m×2.59m → scaled 1:2.5
const CW_20 = 2.4;    // 20ft container width (length direction along bays)
const CW_40 = 4.8;    // 40ft
const CD = 1.0;        // container depth (row direction)
const CH = 1.06;       // container height
const GAP_X = 0.15;    // gap between bays
const GAP_Z = 0.12;    // gap between rows
const GAP_Y = 0.04;    // gap between tiers
const ZONE_GAP = 4;

// Shipping line colors — ให้ตู้มีสีตามสายเรือ
const SHIPPING_COLORS: Record<string, number> = {
  'Evergreen':  0x006847,
  'MSC':        0x1E3A5F,
  'Maersk':     0x0074BC,
  'COSCO':      0xCC2229,
  'CMA CGM':    0x003DA5,
  'ONE':        0xE6007E,
  'Yang Ming':  0xFFC72C,
  'HMM':        0x003D6B,
  'ZIM':        0xFDB813,
  'PIL':        0xE31937,
};

// สร้าง container mesh พร้อมรายละเอียด
function createContainerMesh(ctr: ContainerBlock, scene: THREE.Scene): THREE.Group {
  const is40 = ctr.size === '40' || ctr.size === '45';
  const w = is40 ? CW_40 : CW_20;
  const h = ctr.size === '45' ? CH * 1.12 : CH; // 45ft = High Cube
  const d = CD;

  const group = new THREE.Group();

  // สี — ถ้ามี shipping line ใช้สีสายเรือ ถ้าไม่มีใช้สีตามสถานะ
  let baseColor = SHIPPING_COLORS[ctr.shipping_line] || STATUS_COLORS[ctr.status] || 0x10B981;
  if (ctr.status === 'hold') baseColor = 0xF59E0B;
  if (ctr.status === 'repair') baseColor = 0xEF4444;

  // === ตัวตู้หลัก ===
  const bodyGeo = new THREE.BoxGeometry(w, h, d);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness: 0.55,
    metalness: 0.35,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // === เส้นขอบ (wireframe edges) ===
  const edgesGeo = new THREE.EdgesGeometry(bodyGeo);
  const edgesMat = new THREE.LineBasicMaterial({
    color: new THREE.Color(baseColor).multiplyScalar(0.5),
    transparent: true,
    opacity: 0.8,
  });
  const edges = new THREE.LineSegments(edgesGeo, edgesMat);
  group.add(edges);

  // === ร่องลอนคลื่น (corrugation) — เส้นแนวตั้งด้านข้าง ===
  const corrugationMat = new THREE.LineBasicMaterial({
    color: new THREE.Color(baseColor).multiplyScalar(0.7),
    transparent: true,
    opacity: 0.4,
  });
  const corrCount = is40 ? 16 : 8;
  for (let i = 1; i < corrCount; i++) {
    const xPos = -w / 2 + (w * i / corrCount);
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(xPos, -h / 2 + 0.04, d / 2 + 0.005),
      new THREE.Vector3(xPos, h / 2 - 0.04, d / 2 + 0.005),
    ]);
    const line = new THREE.Line(lineGeo, corrugationMat);
    group.add(line);
    // back side
    const lineBack = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(xPos, -h / 2 + 0.04, -d / 2 - 0.005),
      new THREE.Vector3(xPos, h / 2 - 0.04, -d / 2 - 0.005),
    ]);
    group.add(new THREE.Line(lineBack, corrugationMat));
  }

  // === ประตูท้ายตู้ (door end) — แถบแนวตั้ง 2 บาน + handle ===
  const doorMat = new THREE.LineBasicMaterial({
    color: new THREE.Color(baseColor).multiplyScalar(0.6),
    transparent: true,
    opacity: 0.7,
  });
  // เส้นแบ่งประตู 2 บาน (แนวตั้งกลาง)
  const doorCenter = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(w / 2 + 0.005, -h / 2 + 0.06, -d * 0.35),
    new THREE.Vector3(w / 2 + 0.005, h / 2 - 0.06, -d * 0.35),
  ]);
  group.add(new THREE.Line(doorCenter, doorMat));
  const doorCenter2 = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(w / 2 + 0.005, -h / 2 + 0.06, d * 0.35),
    new THREE.Vector3(w / 2 + 0.005, h / 2 - 0.06, d * 0.35),
  ]);
  group.add(new THREE.Line(doorCenter2, doorMat));

  // Handle bars (แถบล็อค)
  const handleMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(baseColor).multiplyScalar(0.4),
    roughness: 0.3,
    metalness: 0.6,
  });
  for (const zOff of [-d * 0.18, d * 0.18]) {
    const handleGeo = new THREE.CylinderGeometry(0.015, 0.015, h * 0.7, 4);
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.set(w / 2 + 0.02, 0, zOff);
    group.add(handle);
  }

  // === Corner posts (4 มุม) ===
  const cornerMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(baseColor).multiplyScalar(0.45),
    roughness: 0.3,
    metalness: 0.5,
  });
  const cornerSize = 0.06;
  for (const xSign of [-1, 1]) {
    for (const zSign of [-1, 1]) {
      const cornerGeo = new THREE.BoxGeometry(cornerSize, h + 0.01, cornerSize);
      const corner = new THREE.Mesh(cornerGeo, cornerMat);
      corner.position.set(
        xSign * (w / 2 - cornerSize / 2),
        0,
        zSign * (d / 2 - cornerSize / 2),
      );
      group.add(corner);
    }
  }

  // === หลังคา (top rail) — เส้นเข้มกว่าบนหลังคา ===
  const topRailGeo = new THREE.BoxGeometry(w + 0.01, 0.02, d + 0.01);
  const topRailMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(baseColor).multiplyScalar(0.75),
    roughness: 0.6,
    metalness: 0.3,
  });
  const topRail = new THREE.Mesh(topRailGeo, topRailMat);
  topRail.position.y = h / 2;
  group.add(topRail);

  // === laden/empty indicator — ตู้เต็มจะมี top stripe สีขาว ===
  if (ctr.is_laden) {
    const stripGeo = new THREE.BoxGeometry(w * 0.3, 0.025, d * 0.5);
    const stripMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 });
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.y = h / 2 + 0.013;
    group.add(strip);
  }

  return group;
}

export default function YardViewer3D({ yardId, selectedZone, onSelectContainer, highlightContainerNumber }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const containerMeshesRef = useRef<Map<number, { mesh: THREE.Object3D; data: ContainerBlock }>>(new Map());
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const hoveredRef = useRef<THREE.Object3D | null>(null);
  const animFrameRef = useRef<number>(0);
  const highlightAnimRef = useRef<number>(0);
  const prevHighlightRef = useRef<THREE.Object3D | null>(null);

  const [zones, setZones] = useState<ZoneInfo[]>([]);
  const [containers, setContainers] = useState<ContainerBlock[]>([]);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const [statsRes, ctrRes] = await Promise.all([
        fetch(`/api/yard/stats?yard_id=${yardId}`),
        fetch(`/api/containers?yard_id=${yardId}`),
      ]);
      const stats = await statsRes.json();
      const ctrs = await ctrRes.json();
      setZones(stats.zones || []);
      setContainers(ctrs || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [yardId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Build 3D scene
  useEffect(() => {
    if (loading || !canvasRef.current) return;

    const el = canvasRef.current;
    const width = el.clientWidth;
    const height = el.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0F172A);
    scene.fog = new THREE.Fog(0x0F172A, 80, 180);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 300);
    camera.position.set(30, 22, 35);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, logarithmicDepthBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    el.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.minDistance = 5;
    controls.maxDistance = 120;
    controlsRef.current = controls;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight.position.set(20, 30, 15);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 80;
    dirLight.shadow.camera.left = -50;
    dirLight.shadow.camera.right = 50;
    dirLight.shadow.camera.top = 50;
    dirLight.shadow.camera.bottom = -50;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x6366F1, 0.25);
    fillLight.position.set(-15, 12, -10);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xF59E0B, 0.15);
    rimLight.position.set(0, 5, -20);
    scene.add(rimLight);

    // Ground — concrete yard floor
    const groundGeo = new THREE.PlaneGeometry(200, 200);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x1A2332, roughness: 0.95 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid
    const grid = new THREE.GridHelper(120, 60, 0x2D3B4E, 0x1A2332);
    scene.add(grid);

    // Build zones & containers
    const containerMeshes = new Map<number, { mesh: THREE.Object3D; data: ContainerBlock }>();
    let zoneOffsetX = 0;

    const sortedZones = [...zones].sort((a, b) => a.zone_name.localeCompare(b.zone_name));
    const filteredZones = selectedZone
      ? sortedZones.filter(z => z.zone_name === selectedZone)
      : sortedZones;

    for (const zone of filteredZones) {
      const zoneWidth = zone.max_bay * (CW_20 + GAP_X);
      const zoneDepth = zone.max_row * (CD + GAP_Z);

      // Zone floor
      const floorGeo = new THREE.PlaneGeometry(zoneWidth + 2, zoneDepth + 2);
      const floorColor = ZONE_FLOOR_COLORS[zone.zone_type] || 0x3B82F6;
      const floorMat = new THREE.MeshStandardMaterial({
        color: floorColor, transparent: true, opacity: 0.12, roughness: 0.9,
      });
      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(zoneOffsetX + zoneWidth / 2, 0.01, zoneDepth / 2);
      scene.add(floor);

      // Zone border lines (dashed)
      const borderGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(zoneWidth + 2, 0.05, zoneDepth + 2));
      const borderMat = new THREE.LineBasicMaterial({ color: floorColor, transparent: true, opacity: 0.6 });
      const border = new THREE.LineSegments(borderGeo, borderMat);
      border.position.set(zoneOffsetX + zoneWidth / 2, 0.025, zoneDepth / 2);
      scene.add(border);

      // Zone label (canvas texture)
      const canvas = document.createElement('canvas');
      canvas.width = 512; canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 64px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Zone ${zone.zone_name}`, 256, 80);
      const labelTexture = new THREE.CanvasTexture(canvas);
      const labelGeo = new THREE.PlaneGeometry(6, 1.5);
      const labelMat = new THREE.MeshBasicMaterial({ map: labelTexture, transparent: true, side: THREE.DoubleSide });
      const label = new THREE.Mesh(labelGeo, labelMat);
      label.rotation.x = -Math.PI / 2;
      label.position.set(zoneOffsetX + zoneWidth / 2, 0.05, -1.5);
      scene.add(label);

      // Containers in this zone
      const zoneContainers = containers.filter(c => c.zone_name === zone.zone_name);
      for (const ctr of zoneContainers) {
        if (!ctr.bay || !ctr.row || !ctr.tier) continue;

        const is40 = ctr.size === '40' || ctr.size === '45';
        const cw = is40 ? CW_40 : CW_20;
        const ch = ctr.size === '45' ? CH * 1.12 : CH;

        const containerGroup = createContainerMesh(ctr, scene);

        const x = zoneOffsetX + (ctr.bay - 1) * (CW_20 + GAP_X) + cw / 2;
        const y = (ctr.tier - 1) * (ch + GAP_Y) + ch / 2;
        const z = (ctr.row - 1) * (CD + GAP_Z) + CD / 2;

        containerGroup.position.set(x, y, z);
        scene.add(containerGroup);

        containerMeshes.set(ctr.container_id, { mesh: containerGroup, data: ctr });
      }

      zoneOffsetX += zoneWidth + ZONE_GAP;
    }

    containerMeshesRef.current = containerMeshes;

    // Center camera
    const totalWidth = zoneOffsetX - ZONE_GAP;
    camera.position.set(totalWidth / 2, Math.max(12, totalWidth * 0.4), totalWidth * 0.6);
    controls.target.set(totalWidth / 2, 1, 3);
    controls.update();

    // Animate
    function animate() {
      animFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    // Resize
    const handleResize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animFrameRef.current);
      controls.dispose();
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, [loading, zones, containers, selectedZone]);

  // === Highlight + Camera Focus + X-Ray effect ===
  useEffect(() => {
    if (!cameraRef.current || !controlsRef.current || !sceneRef.current) return;

    // --- Cleanup: restore all containers to normal ---
    const restoreAll = () => {
      for (const [, entry] of containerMeshesRef.current) {
        (entry.mesh as THREE.Group).children.forEach(child => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            child.material.opacity = 1;
            child.material.transparent = false;
            child.material.emissive.setHex(0x000000);
            child.material.emissiveIntensity = 1;
          }
        });
      }
    };

    // Remove any existing beacon
    const oldBeacon = sceneRef.current.getObjectByName('__highlight_beacon__');
    if (oldBeacon) sceneRef.current.remove(oldBeacon);
    const oldRing = sceneRef.current.getObjectByName('__highlight_ring__');
    if (oldRing) sceneRef.current.remove(oldRing);

    cancelAnimationFrame(highlightAnimRef.current);
    restoreAll();

    if (!highlightContainerNumber) return;

    // Find matching container
    let foundEntry: { mesh: THREE.Object3D; data: ContainerBlock } | null = null;
    for (const [, entry] of containerMeshesRef.current) {
      if (entry.data.container_number === highlightContainerNumber) {
        foundEntry = entry;
        break;
      }
    }
    if (!foundEntry) return;

    const targetMesh = foundEntry.mesh;
    prevHighlightRef.current = targetMesh;

    // === X-Ray Mode: ทำตู้อื่นโปร่งใส ===
    for (const [, entry] of containerMeshesRef.current) {
      if (entry.mesh === targetMesh) continue;
      (entry.mesh as THREE.Group).children.forEach(child => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          child.material.transparent = true;
          child.material.opacity = 0.08;
          child.material.depthWrite = false;
        }
      });
    }

    // Get world position of the container
    const targetPos = new THREE.Vector3();
    targetMesh.getWorldPosition(targetPos);

    // === Beacon: เสาแสงสีเหลืองชี้ตำแหน่ง ===
    const beaconHeight = 12;
    const beaconGeo = new THREE.CylinderGeometry(0.06, 0.06, beaconHeight, 8);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0xFFDD00,
      transparent: true,
      opacity: 0.8,
    });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.name = '__highlight_beacon__';
    beacon.position.set(targetPos.x, targetPos.y + beaconHeight / 2 + 0.5, targetPos.z);
    sceneRef.current.add(beacon);

    // === Ring: วงแหวนบนพื้นรอบตู้ ===
    const ringGeo = new THREE.RingGeometry(1.2, 1.5, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xFFDD00,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.name = '__highlight_ring__';
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(targetPos.x, 0.05, targetPos.z);
    sceneRef.current.add(ring);

    // === Animate camera to focus ===
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const startTarget = controls.target.clone();
    const startPos = camera.position.clone();

    const endTarget = targetPos.clone();
    const endPos = new THREE.Vector3(
      targetPos.x + 6,
      targetPos.y + 5,
      targetPos.z + 6,
    );

    let progress = 0;
    const animateCam = () => {
      progress += 0.04;
      if (progress >= 1) progress = 1;
      const t = 1 - Math.pow(1 - progress, 3);
      camera.position.lerpVectors(startPos, endPos, t);
      controls.target.lerpVectors(startTarget, endTarget, t);
      controls.update();
      if (progress < 1) requestAnimationFrame(animateCam);
    };
    animateCam();

    // === Pulsing glow + beacon animation ===
    let glowTime = 0;
    const animateGlow = () => {
      glowTime += 0.06;
      const intensity = 0.4 + Math.sin(glowTime * 3) * 0.4;
      const beaconPulse = 0.5 + Math.sin(glowTime * 4) * 0.3;

      // Glow the highlighted container (smooth, non-flickering)
      (targetMesh as THREE.Group).children.forEach(child => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          child.material.emissive.setHex(0xFFFF00);
          child.material.emissiveIntensity = 0.3 + Math.sin(glowTime * 1.5) * 0.15;
          child.material.transparent = false;
          child.material.opacity = 1;
        }
      });

      // Pulse beacon opacity
      if (beacon.material instanceof THREE.MeshBasicMaterial) {
        beacon.material.opacity = beaconPulse;
      }
      if (ring.material instanceof THREE.MeshBasicMaterial) {
        ring.material.opacity = 0.3 + Math.sin(glowTime * 2) * 0.3;
        ring.rotation.z = glowTime * 0.5;
      }

      highlightAnimRef.current = requestAnimationFrame(animateGlow);
    };
    animateGlow();

    return () => {
      cancelAnimationFrame(highlightAnimRef.current);
      restoreAll();
      if (sceneRef.current) {
        const b = sceneRef.current.getObjectByName('__highlight_beacon__');
        if (b) sceneRef.current.remove(b);
        const r = sceneRef.current.getObjectByName('__highlight_ring__');
        if (r) sceneRef.current.remove(r);
      }
    };
  }, [highlightContainerNumber]);

  // Helper: find which container group contains this child object
  const findContainerEntry = useCallback((obj: THREE.Object3D) => {
    for (const [, entry] of containerMeshesRef.current) {
      if (entry.mesh === obj || (entry.mesh as THREE.Group).children?.includes(obj)) {
        return entry;
      }
      // check nested
      let parent = obj.parent;
      while (parent) {
        if (parent === entry.mesh) return entry;
        parent = parent.parent;
      }
    }
    return null;
  }, []);

  // Mouse hover for tooltip
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current || !sceneRef.current || !cameraRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const allGroups = Array.from(containerMeshesRef.current.values()).map(v => v.mesh);
    const intersects = raycasterRef.current.intersectObjects(allGroups, true);

    // Reset hovered
    if (hoveredRef.current) {
      const prevEntry = findContainerEntry(hoveredRef.current);
      if (prevEntry) {
        (prevEntry.mesh as THREE.Group).children.forEach(child => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            child.material.emissive.setHex(0x000000);
          }
        });
      }
      hoveredRef.current = null;
    }

    if (intersects.length > 0) {
      const hitObj = intersects[0].object;
      const entry = findContainerEntry(hitObj);
      if (entry) {
        // Highlight all child meshes
        (entry.mesh as THREE.Group).children.forEach(child => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            child.material.emissive.setHex(0x222222);
          }
        });
        hoveredRef.current = entry.mesh;

        const c = entry.data;
        const statusLabel = c.status === 'in_yard' ? 'ในลาน' : c.status === 'hold' ? 'ค้างจ่าย' : c.status === 'repair' ? 'ซ่อม' : c.status;
        setTooltip({
          x: e.clientX - canvasRef.current!.getBoundingClientRect().left,
          y: e.clientY - canvasRef.current!.getBoundingClientRect().top - 60,
          text: `${c.container_number} | ${c.size}'${c.type} | ${c.shipping_line || '—'} | ${statusLabel} | B${c.bay}-R${c.row}-T${c.tier}`,
        });
      }
    } else {
      setTooltip(null);
    }
  }, [findContainerEntry]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current || !sceneRef.current || !cameraRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );

    raycasterRef.current.setFromCamera(mouse, cameraRef.current);
    const allGroups = Array.from(containerMeshesRef.current.values()).map(v => v.mesh);
    const intersects = raycasterRef.current.intersectObjects(allGroups, true);

    if (intersects.length > 0) {
      const entry = findContainerEntry(intersects[0].object);
      if (entry && onSelectContainer) {
        onSelectContainer(entry.data);
      }
    } else if (onSelectContainer) {
      onSelectContainer(null);
    }
  }, [onSelectContainer, findContainerEntry]);

  if (loading) {
    return (
      <div className="w-full h-[500px] rounded-xl bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">กำลังโหลดแผนผัง 3D...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[500px] rounded-xl overflow-hidden border border-slate-700">
      <div
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseMove={handleMouseMove}
        onClick={handleClick}
      />

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-20 px-3 py-2 rounded-lg bg-slate-800/95 backdrop-blur border border-slate-600
            text-xs text-white font-mono shadow-xl whitespace-nowrap"
          style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%)' }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-3 bg-slate-900/80 backdrop-blur rounded-lg px-3 py-2 border border-slate-700">
        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mr-1">สถานะ:</span>
        {[
          { color: '#10B981', label: 'ในลาน' },
          { color: '#F59E0B', label: 'ค้างจ่าย' },
          { color: '#EF4444', label: 'ซ่อม' },
        ].map((s, i) => (
          <span key={i} className="flex items-center gap-1 text-[10px] text-slate-300">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      {/* Controls hint */}
      <div className="absolute top-3 right-3 z-10 text-[10px] text-slate-500 bg-slate-900/60 backdrop-blur rounded-lg px-2.5 py-1.5 border border-slate-700/50">
        🖱️ หมุน • ⇧+🖱️ เลื่อน • 📜 ซูม
      </div>
    </div>
  );
}
