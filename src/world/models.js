// Low-poly "clay toy" models built from primitives: island, scenery, growth
// tree, mission objects and the three original companions (+ wardrobe).
import * as THREE from 'three';

const matCache = new Map();
export function mat(color, o = {}) {
  const key = `${color}|${o.emissive || ''}|${o.ei || 0}|${o.opacity ?? 1}|${o.flat ? 1 : 0}|${o.side || 0}`;
  if (!matCache.has(key)) {
    matCache.set(
      key,
      new THREE.MeshStandardMaterial({
        color,
        roughness: o.roughness ?? 0.72,
        metalness: 0,
        flatShading: !!o.flat,
        emissive: o.emissive || '#000000',
        emissiveIntensity: o.ei || 0,
        transparent: (o.opacity ?? 1) < 1,
        opacity: o.opacity ?? 1,
        side: o.side || THREE.FrontSide,
      }),
    );
    matCache.get(key).userData.cached = true; // shared: never disposed per object
  }
  return matCache.get(key);
}

export function mesh(geo, material, { x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0, shadow = true } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.rotation.set(rx, ry, rz);
  m.castShadow = shadow;
  m.receiveShadow = shadow;
  return m;
}

const sphere = (r, w = 20, h = 16) => new THREE.SphereGeometry(r, w, h);
const cyl = (rt, rb, h, s = 20) => new THREE.CylinderGeometry(rt, rb, h, s);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cone = (r, h, s = 16) => new THREE.ConeGeometry(r, h, s);

// Deterministic pseudo-random for stable scenery.
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

// ---------------------------------------------------------------- island
export function buildIsland(phase) {
  const g = new THREE.Group();
  const night = phase === 'night';
  const grassTop = night ? '#5E8F5C' : phase === 'evening' ? '#8CC663' : '#8FD16A';
  const grassSide = night ? '#46704A' : '#5DA646';
  const rockA = night ? '#4B4677' : '#8F86C0';
  const rockB = night ? '#39355E' : '#6E66A3';

  const top = mesh(cyl(4.2, 4.0, 0.5, 48), mat(grassTop), { y: -0.25 });
  top.castShadow = false;
  g.add(top);
  g.add(mesh(new THREE.TorusGeometry(4.05, 0.16, 8, 48), mat(grassSide), { y: -0.5, rx: Math.PI / 2, shadow: false }));

  // Jagged rock underside
  const rock = new THREE.ConeGeometry(4.05, 3.6, 18, 4);
  const pos = rock.attributes.position;
  const r = rng(7);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < 1.7) {
      pos.setX(i, pos.getX(i) * (0.88 + r() * 0.24));
      pos.setZ(i, pos.getZ(i) * (0.88 + r() * 0.24));
      pos.setY(i, y + (r() - 0.5) * 0.25);
    }
  }
  rock.computeVertexNormals();
  g.add(mesh(rock, mat(rockA, { flat: true, emissive: rockA, ei: 0.35 }), { y: -2.35, rx: Math.PI, shadow: false }));
  g.add(mesh(new THREE.ConeGeometry(2.4, 1.6, 12, 2), mat(rockB, { flat: true, emissive: rockB, ei: 0.35 }), { y: -4.3, rx: Math.PI, shadow: false }));

  // Path stones towards the front
  const stone = mat(night ? '#8C8AB3' : '#E8E4F4');
  [[0.2, 1.4], [-0.25, 2.1], [0.15, 2.8], [-0.1, 3.5]].forEach(([x, z], i) =>
    g.add(mesh(cyl(0.22 - i * 0.01, 0.24, 0.06, 10), stone, { x, y: 0.01, z, sx: 1.3 })),
  );

  // Pine trees and rocks around the rim (leaving the front open)
  const pine = mat(night ? '#2F5B4C' : '#3F8C63', { flat: true });
  const pine2 = mat(night ? '#3B6B55' : '#58A873', { flat: true });
  const trunk = mat('#8A5A3C');
  // A few pines at the back; the rest of the island is left for what the user grows.
  const spots = [[-3.1, -2.0, 1.05], [3.2, -1.8, 1.1], [-2.3, -3.1, 0.9], [2.1, -3.2, 0.8]];
  spots.forEach(([x, z, s], i) => {
    const t = new THREE.Group();
    t.add(mesh(cyl(0.08, 0.1, 0.35, 8), trunk, { y: 0.17 }));
    t.add(mesh(cone(0.45, 0.8, 7), i % 2 ? pine : pine2, { y: 0.7 }));
    t.add(mesh(cone(0.34, 0.6, 7), i % 2 ? pine2 : pine, { y: 1.1 }));
    t.position.set(x, 0, z);
    t.scale.setScalar(s);
    g.add(t);
  });
  const rockM = mat(night ? '#6E6A99' : '#C9C3E6', { flat: true });
  [[-2.9, 1.9, 0.3], [3.0, 1.6, 0.25], [1.9, -3.4, 0.35]].forEach(([x, z, s]) =>
    g.add(mesh(new THREE.DodecahedronGeometry(s, 0), rockM, { x, y: s * 0.5, z })),
  );

  // Flowers sprinkled on the grass
  const petals = ['#FFFFFF', '#FBCFE8', '#FDE68A', '#C4B5FD', '#BFDBFE'];
  const rr = rng(21);
  for (let i = 0; i < 26; i++) {
    const a = rr() * Math.PI * 2;
    const d = 1.2 + rr() * 2.6;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (z > 0.9 && Math.abs(x) < 0.8) continue;
    g.add(mesh(sphere(0.06, 8, 6), mat(petals[i % petals.length]), { x, y: 0.05, z, shadow: false }));
  }
  return g;
}

export function buildCloud(seed = 1, color = '#FFFFFF', opacity = 0.95) {
  const g = new THREE.Group();
  const r = rng(seed);
  const m = mat(color, { opacity, roughness: 1, emissive: color, ei: 0.55 });
  for (let i = 0; i < 6; i++) {
    const s = 0.5 + r() * 0.6;
    g.add(mesh(sphere(s, 14, 10), m, { x: (i - 2.5) * 0.55 + r() * 0.2, y: r() * 0.35, z: r() * 0.4, shadow: false }));
  }
  return g;
}

export function buildMiniIsland(seed, phase) {
  const g = new THREE.Group();
  const night = phase === 'night';
  g.add(mesh(cyl(1, 0.95, 0.25, 14), mat(night ? '#56805A' : '#9ACB7A'), { shadow: false }));
  g.add(mesh(new THREE.ConeGeometry(0.95, 1.4, 9, 1), mat(night ? '#433F6D' : '#A7A1D3', { flat: true }), { y: -0.82, rx: Math.PI, shadow: false }));
  const r = rng(seed);
  for (let i = 0; i < 3; i++) g.add(mesh(cone(0.22, 0.6, 6), mat(night ? '#35604F' : '#6FAE83', { flat: true }), { x: (r() - 0.5) * 1.2, y: 0.4, z: (r() - 0.5) * 1.0, shadow: false }));
  return g;
}

// ---------------------------------------------------------------- growth tree
export function buildGrowthTree(stage) {
  const g = new THREE.Group();
  const bark = mat('#9A6B4F');
  const leaf = mat('#4FAE7C');
  const leafL = mat('#8ED3A8');
  const leafD = mat('#3E9467');
  const mound = mat('#B98A68');
  g.add(mesh(sphere(0.55, 16, 8), mound, { y: -0.3, sy: 0.6, shadow: false }));
  const leafPair = (y, s) => {
    g.add(mesh(sphere(0.18 * s, 12, 8), leafL, { x: -0.16 * s, y, sx: 1.4, sy: 0.35, rz: 0.4 }));
    g.add(mesh(sphere(0.18 * s, 12, 8), leaf, { x: 0.16 * s, y: y + 0.05, sx: 1.4, sy: 0.35, rz: -0.4 }));
  };
  switch (stage) {
    case 'seed':
      g.add(mesh(sphere(0.12, 12, 8), bark, { y: 0.02, sy: 0.75 }));
      g.add(mesh(cyl(0.015, 0.015, 0.12, 6), leafL, { y: 0.12, rz: 0.4 }));
      break;
    case 'sprout':
      g.add(mesh(cyl(0.03, 0.035, 0.4, 8), leafD, { y: 0.2 }));
      leafPair(0.42, 1);
      break;
    case 'young':
      g.add(mesh(cyl(0.035, 0.045, 0.9, 8), leafD, { y: 0.45 }));
      leafPair(0.45, 0.9);
      leafPair(0.7, 1.05);
      leafPair(0.92, 0.85);
      break;
    case 'sapling':
      g.add(mesh(cyl(0.06, 0.09, 1.0, 8), bark, { y: 0.5 }));
      g.add(mesh(sphere(0.45, 14, 10), leaf, { y: 1.2 }));
      g.add(mesh(sphere(0.32, 12, 8), leafL, { x: 0.28, y: 1.35, z: 0.1 }));
      g.add(mesh(sphere(0.3, 12, 8), leafD, { x: -0.3, y: 1.05, z: -0.05 }));
      break;
    case 'mature':
      g.add(mesh(cyl(0.1, 0.16, 1.4, 9), bark, { y: 0.7 }));
      [[0, 1.75, 0, 0.7, leaf], [0.5, 1.5, 0.15, 0.5, leafL], [-0.5, 1.45, 0, 0.52, leafD], [0.1, 2.2, -0.1, 0.45, leafL], [-0.2, 1.6, 0.45, 0.4, leaf]].forEach(([x, y, z, s, m]) =>
        g.add(mesh(sphere(s, 16, 12), m, { x, y, z })),
      );
      break;
    default: {
      // ancient
      g.add(mesh(cyl(0.16, 0.26, 1.7, 10), mat('#7C543D'), { y: 0.85 }));
      [-1, 1].forEach((d) => g.add(mesh(cyl(0.06, 0.12, 0.7, 6), mat('#7C543D'), { x: d * 0.3, y: 0.1, rz: d * 1.1 })));
      [[0, 2.1, 0, 0.9, leaf], [0.7, 1.8, 0.2, 0.62, leafL], [-0.72, 1.75, 0, 0.64, leafD], [0.15, 2.7, -0.1, 0.55, leafL], [-0.3, 2.0, 0.6, 0.5, leaf], [0.4, 2.3, -0.55, 0.5, leafD]].forEach(([x, y, z, s, m]) =>
        g.add(mesh(sphere(s, 16, 12), m, { x, y, z })),
      );
      const bloom = mat('#F7A9C4', { emissive: '#F472B6', ei: 0.15 });
      const r = rng(3);
      for (let i = 0; i < 16; i++) {
        const a = r() * Math.PI * 2;
        const e = r() * 0.9 - 0.2;
        g.add(mesh(sphere(0.07, 8, 6), bloom, { x: Math.cos(a) * 0.95, y: 2.1 + e, z: Math.sin(a) * 0.95, shadow: false }));
      }
    }
  }
  return g;
}

// ---------------------------------------------------------------- mission objects
export function buildMissionObject(kind) {
  const g = new THREE.Group();
  const add = (...a) => g.add(mesh(...a));
  switch (kind) {
    case 'tooth':
    case 'teeth':
      add(cyl(0.16, 0.13, 0.36, 16), mat('#7DD3FC'), { y: 0.18 });
      add(cyl(0.035, 0.035, 0.62, 8), mat('#FFFFFF'), { x: 0.02, y: 0.48, rz: 0.2 });
      add(box(0.09, 0.14, 0.06), mat('#6366F1'), { x: -0.04, y: 0.8, rz: 0.2 });
      add(sphere(0.07, 10, 8), mat('#FFFFFF'), { x: 0.28, y: 0.08, z: 0.1, sy: 0.7 });
      break;
    case 'bed':
      add(box(0.9, 0.2, 0.55), mat('#8B5CF6'), { y: 0.12 });
      add(box(0.84, 0.12, 0.5), mat('#FFFFFF'), { y: 0.27 });
      add(box(0.55, 0.08, 0.52), mat('#F472B6'), { x: 0.14, y: 0.35 });
      add(box(0.22, 0.12, 0.34), mat('#F5F3FF'), { x: -0.28, y: 0.38 });
      add(box(0.08, 0.5, 0.55), mat('#7C3AED'), { x: -0.46, y: 0.28 });
      break;
    case 'book':
      add(cyl(0.3, 0.34, 0.34, 14), mat('#9A6B4F'), { y: 0.17 });
      add(cyl(0.28, 0.28, 0.02, 14), mat('#E6C7A3'), { y: 0.35, shadow: false });
      add(box(0.26, 0.03, 0.34), mat('#10B981'), { x: -0.13, y: 0.39, rz: 0.18 });
      add(box(0.26, 0.03, 0.34), mat('#34D399'), { x: 0.13, y: 0.39, rz: -0.18 });
      add(box(0.24, 0.01, 0.3), mat('#FFFFFF'), { x: -0.12, y: 0.415, rz: 0.18, shadow: false });
      add(box(0.24, 0.01, 0.3), mat('#FFFFFF'), { x: 0.12, y: 0.415, rz: -0.18, shadow: false });
      break;
    case 'lotus':
    case 'wind':
      add(cyl(0.38, 0.4, 0.14, 20), mat('#C4B5FD'), { y: 0.07 });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        add(sphere(0.13, 12, 8), mat(i % 2 ? '#F9A8D4' : '#F472B6'), { x: Math.cos(a) * 0.14, y: 0.26, z: Math.sin(a) * 0.14, sx: 0.6, sy: 1.3, sz: 0.6, rx: Math.sin(a) * 0.5, rz: -Math.cos(a) * 0.5 });
      }
      add(sphere(0.07, 10, 8), mat('#FDE68A', { emissive: '#FBBF24', ei: 0.3 }), { y: 0.3 });
      break;
    case 'sun':
      add(cyl(0.03, 0.03, 0.6, 6), mat('#3E9467'), { y: 0.3 });
      add(cyl(0.2, 0.2, 0.05, 16), mat('#92400E'), { y: 0.66, rx: Math.PI / 2 - 0.3 });
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        add(sphere(0.09, 8, 6), mat('#FBBF24'), { x: Math.cos(a) * 0.26, y: 0.66 + Math.sin(a) * 0.26 * 0.95, z: 0.04, sx: 1.4, sz: 0.5 });
      }
      break;
    case 'water':
      add(cyl(0.2, 0.24, 0.5, 18), mat('#93C5FD', { opacity: 0.85 }), { y: 0.25 });
      add(cyl(0.18, 0.2, 0.3, 18), mat('#3B82F6'), { y: 0.16 });
      add(sphere(0.1, 12, 10), mat('#60A5FA'), { x: 0.35, y: 0.1, sy: 1.3 });
      break;
    case 'breakfast':
      add(new THREE.SphereGeometry(0.3, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat('#F97316', { side: THREE.DoubleSide }), { y: 0.3 });
      add(cyl(0.28, 0.28, 0.02, 18), mat('#FFF3E0'), { y: 0.26, shadow: false });
      [['#EF4444', -0.1, 0], ['#8B5CF6', 0.08, 0.06], ['#FACC15', 0.05, -0.1]].forEach(([c, x, z]) => add(sphere(0.07, 10, 8), mat(c), { x, y: 0.3, z }));
      break;
    case 'shower':
      [[-0.2, 0], [0.05, 0.05], [0.25, 0]].forEach(([x, z]) => add(sphere(0.2, 12, 10), mat('#E9E5FF'), { x, y: 0.85, z }));
      for (let i = 0; i < 6; i++) add(sphere(0.04, 8, 6), mat('#38BDF8'), { x: -0.25 + i * 0.1, y: 0.55 - (i % 2) * 0.15, z: 0.02, sy: 1.6, shadow: false });
      break;
    case 'moon':
      add(cyl(0.035, 0.05, 0.8, 8), mat('#475569'), { y: 0.4 });
      add(sphere(0.16, 16, 12), mat('#E0E7FF', { emissive: '#A5B4FC', ei: 0.8 }), { y: 0.9 });
      break;
    case 'walk':
      add(box(0.46, 0.14, 0.2), mat('#6366F1'), { y: 0.1 });
      add(box(0.22, 0.2, 0.2), mat('#818CF8'), { x: -0.12, y: 0.25 });
      add(box(0.5, 0.05, 0.22), mat('#FFFFFF'), { y: 0.025 });
      break;
    case 'heart':
      add(sphere(0.15, 14, 10), mat('#F43F5E'), { x: -0.1, y: 0.55 });
      add(sphere(0.15, 14, 10), mat('#F43F5E'), { x: 0.1, y: 0.55 });
      add(cone(0.22, 0.3, 14), mat('#F43F5E'), { y: 0.35, rz: Math.PI });
      add(cyl(0.02, 0.02, 0.25, 6), mat('#94A3B8'), { y: 0.12 });
      break;
    case 'sprout':
      add(cyl(0.2, 0.15, 0.28, 14), mat('#C2410C'), { y: 0.14 });
      add(cyl(0.18, 0.18, 0.02, 14), mat('#78350F'), { y: 0.27, shadow: false });
      add(cyl(0.02, 0.02, 0.25, 6), mat('#3E9467'), { y: 0.4 });
      add(sphere(0.09, 10, 8), mat('#4ADE80'), { x: -0.08, y: 0.52, sx: 1.4, sy: 0.4, rz: 0.4 });
      add(sphere(0.09, 10, 8), mat('#22C55E'), { x: 0.08, y: 0.55, sx: 1.4, sy: 0.4, rz: -0.4 });
      break;
    default: {
      // lantern for custom tasks
      add(cyl(0.02, 0.02, 0.5, 6), mat('#475569'), { y: 0.25 });
      add(box(0.3, 0.04, 0.3), mat('#312E81'), { y: 0.52 });
      add(sphere(0.13, 14, 10), mat('#FEF3C7', { emissive: '#FBBF24', ei: 1.1 }), { y: 0.68 });
      add(cone(0.22, 0.16, 4), mat('#4F46E5'), { y: 0.88, ry: Math.PI / 4 });
    }
  }
  return g;
}

/** Floating quest marker (to-do) and ground glow ring. */
export function buildMarker() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.OctahedronGeometry(0.12, 0), mat('#FBBF24', { emissive: '#F59E0B', ei: 0.6, flat: true }), { sy: 1.5, shadow: false }));
  return g;
}
export function buildRing() {
  const m = new THREE.MeshBasicMaterial({ color: '#A5B4FC', transparent: true, opacity: 0.7, depthWrite: false });
  const r = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 40), m);
  r.rotation.x = -Math.PI / 2;
  r.position.y = 0.015;
  return r;
}

// ---------------------------------------------------------------- companions
const PAL = {
  moji: { body: '#FFC9A6', shade: '#F7A987', belly: '#FFF4EA', accent: '#4FAE7C' },
  luma: { body: '#D6CBFF', shade: '#AE9CF2', belly: '#FAF8FF', accent: '#FFD66B' },
  nori: { body: '#8EE3D6', shade: '#4FC2B6', belly: '#EFFFFB', accent: '#7CC7FF' },
};

function lathe(points, segs = 32) {
  return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segs);
}

export function buildCompanion(species = 'moji', wear = []) {
  const p = PAL[species] || PAL.moji;
  const root = new THREE.Group(); // positioned on the island
  const body = new THREE.Group(); // squash/stretch pivot at the feet
  root.add(body);
  const add = (...a) => {
    const m = mesh(...a);
    body.add(m);
    return m;
  };
  // A little self-glow keeps pastel bodies soft and bright, like clay toys.
  const skin = mat(p.body, { roughness: 0.5, emissive: p.body, ei: 0.22 });
  const shade = mat(p.shade, { roughness: 0.55, emissive: p.shade, ei: 0.18 });

  let headTop = 1.1;
  let neckY = 0.45;
  if (species === 'moji') {
    add(sphere(0.55, 32, 24), skin, { y: 0.56, sy: 0.96 });
    [-1, 1].forEach((d) => {
      add(sphere(0.17, 16, 12), shade, { x: d * 0.33, y: 1.0, z: -0.02 });
      add(sphere(0.09, 12, 8), mat('#F59C92'), { x: d * 0.33, y: 1.0, z: 0.1, sz: 0.5 });
    });
    const tail = add(sphere(0.16, 12, 8), mat(p.accent), { y: 0.38, z: -0.55, sx: 0.6, sy: 1.2, rx: -0.6 });
    tail.name = 'tail';
    headTop = 1.08;
  } else if (species === 'luma') {
    add(lathe([[0, 0.05], [0.42, 0.12], [0.56, 0.4], [0.5, 0.75], [0.33, 1.02], [0.12, 1.14], [0, 1.16]]), skin, {});
    const horn = add(new THREE.TorusGeometry(0.13, 0.045, 10, 20, Math.PI * 1.25), mat('#FFD66B', { emissive: '#F2B233', ei: 0.35 }), { y: 1.28, rz: -0.9 });
    horn.name = 'horn';
    [[0, 0.35, -0.55, 0.16], [0.13, 0.43, -0.5, 0.12], [-0.13, 0.42, -0.5, 0.12]].forEach(([x, y, z, s]) => add(sphere(s, 12, 8), mat('#FFFFFF'), { x, y, z }));
    headTop = 1.16;
    neckY = 0.5;
  } else {
    add(lathe([[0, 0.05], [0.44, 0.12], [0.58, 0.42], [0.46, 0.8], [0.22, 1.1], [0.05, 1.28], [0, 1.3]]), skin, {});
    add(new THREE.TorusGeometry(0.09, 0.035, 8, 16, Math.PI * 1.4), shade, { x: 0.08, y: 1.35, rz: 0.2 });
    [-1, 1].forEach((d) => add(sphere(0.2, 14, 10), shade, { x: d * 0.6, y: 0.62, sx: 0.9, sy: 0.35, sz: 0.55, rz: d * 0.5 }));
    add(sphere(0.14, 10, 8), shade, { y: 0.3, z: -0.55, sx: 1.2, sy: 0.4, rx: 0.4 });
    headTop = 1.2;
    neckY = 0.48;
  }

  // Belly + limbs
  add(sphere(0.34, 20, 14), mat(p.belly, { roughness: 0.6, emissive: p.belly, ei: 0.2 }), { y: 0.4, z: 0.32, sz: 0.5 });
  [-1, 1].forEach((d) => {
    add(sphere(0.13, 14, 10), shade, { x: d * 0.54, y: 0.45, z: 0.05, sy: 1.25, rz: d * 0.4 });
    add(sphere(0.15, 14, 10), shade, { x: d * 0.22, y: 0.07, z: 0.1, sy: 0.6, sz: 1.25 });
  });

  // Face
  const face = new THREE.Group();
  face.name = 'face';
  const eyeY = species === 'nori' ? 0.66 : 0.68;
  const eyeZ = 0.47;
  const eyes = new THREE.Group();
  eyes.name = 'eyes';
  [-1, 1].forEach((d) => {
    const e = new THREE.Group();
    e.position.set(d * 0.19, eyeY, eyeZ);
    e.add(mesh(sphere(0.085, 16, 12), mat('#231A3B', { roughness: 0.25 }), { sy: 1.28, sz: 0.6, shadow: false }));
    e.add(mesh(sphere(0.032, 8, 6), mat('#FFFFFF', { emissive: '#FFFFFF', ei: 0.6 }), { x: -0.025, y: 0.045, z: 0.045, shadow: false }));
    e.add(mesh(sphere(0.015, 6, 4), mat('#FFFFFF', { emissive: '#FFFFFF', ei: 0.6 }), { x: 0.03, y: -0.03, z: 0.05, shadow: false }));
    eyes.add(e);
  });
  face.add(eyes);
  const happy = new THREE.Group(); // ^ ^ eyes for happy moments
  happy.name = 'happy';
  happy.visible = false;
  [-1, 1].forEach((d) =>
    happy.add(mesh(new THREE.TorusGeometry(0.06, 0.018, 6, 14, Math.PI), mat('#231A3B'), { x: d * 0.19, y: eyeY - 0.02, z: eyeZ + 0.02, shadow: false })),
  );
  face.add(happy);
  const calm = new THREE.Group(); // ‿ ‿ closed, content eyes (Minimum day / resting)
  calm.name = 'calm';
  calm.visible = false;
  [-1, 1].forEach((d) =>
    calm.add(mesh(new THREE.TorusGeometry(0.06, 0.016, 6, 14, Math.PI), mat('#231A3B'), { x: d * 0.19, y: eyeY + 0.01, z: eyeZ + 0.02, rz: Math.PI, shadow: false })),
  );
  face.add(calm);
  if (species === 'luma') {
    [-1, 1].forEach((d) =>
      face.add(mesh(new THREE.OctahedronGeometry(0.04, 0), mat('#F2B233', { emissive: '#F2B233', ei: 0.4 }), { x: d * 0.34, y: eyeY - 0.12, z: 0.4, shadow: false })),
    );
  } else {
    [-1, 1].forEach((d) => face.add(mesh(sphere(0.07, 12, 8), mat('#FF8E9E', { opacity: 0.7 }), { x: d * 0.33, y: eyeY - 0.13, z: 0.42, sz: 0.3, shadow: false })));
  }
  face.add(mesh(new THREE.TorusGeometry(0.045, 0.014, 6, 14, Math.PI), mat('#231A3B'), { y: eyeY - 0.12, z: eyeZ + 0.03, rz: Math.PI, shadow: false }));
  body.add(face);

  // Wardrobe
  if (wear.includes('scarf')) {
    add(new THREE.TorusGeometry(0.47, 0.075, 10, 32), mat('#F26D7D'), { y: neckY, rx: Math.PI / 2, sy: 1.0 });
    add(box(0.12, 0.28, 0.06), mat('#C9485A'), { x: 0.22, y: neckY - 0.16, z: 0.44, rz: 0.15 });
  }
  if (wear.includes('backpack')) {
    add(box(0.46, 0.46, 0.2), mat('#F7B84B'), { y: 0.52, z: -0.52 });
    add(box(0.3, 0.18, 0.08), mat('#D98E1E'), { y: 0.42, z: -0.65 });
  }
  if (wear.includes('beanie')) {
    add(new THREE.SphereGeometry(0.4, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat('#6C7BF0'), { y: headTop - 0.2, sy: 0.85 });
    add(new THREE.TorusGeometry(0.39, 0.06, 8, 28), mat('#4E59CF'), { y: headTop - 0.2, rx: Math.PI / 2 });
    if (species === 'moji') add(sphere(0.08, 12, 8), mat('#FFFFFF'), { y: headTop + 0.17 });
  }
  if (wear.includes('cape')) {
    add(new THREE.CylinderGeometry(0.46, 0.6, 0.7, 24, 1, true, Math.PI * 0.7, Math.PI * 0.6), mat('#4F46E5', { side: THREE.DoubleSide }), { y: 0.45 });
  }
  return root;
}

// ---------------------------------------------------------------- growth from real habits
// Each habit grows its own little corner. `tier` 1..6 is cumulative; every
// piece is tagged with the tier that added it so new ones can pop in.
// Local frame: +z points outward to the island rim, x runs along it.

function tagged(tier, obj) {
  obj.userData.tier = tier;
  return obj;
}
function flower(x, z, petal, heart = '#FDE68A', h = 0.16) {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.012, 0.012, h, 5), mat('#3E9467'), { y: h / 2, shadow: false }));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.add(mesh(sphere(0.035, 8, 6), mat(petal), { x: Math.cos(a) * 0.04, y: h, z: Math.sin(a) * 0.04, shadow: false }));
  }
  g.add(mesh(sphere(0.028, 8, 6), mat(heart), { y: h + 0.01, shadow: false }));
  g.position.set(x, 0, z);
  return g;
}
function roundTree(x, z, s = 1, crown = '#4FAE7C', bloom = null) {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.05 * s, 0.07 * s, 0.5 * s, 8), mat('#9A6B4F'), { y: 0.25 * s }));
  g.add(mesh(sphere(0.3 * s, 14, 10), mat(crown), { y: 0.65 * s }));
  g.add(mesh(sphere(0.2 * s, 12, 8), mat('#8ED3A8'), { x: 0.14 * s, y: 0.78 * s, z: 0.08 * s }));
  if (bloom) for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    g.add(mesh(sphere(0.045 * s, 8, 6), mat(bloom), { x: Math.cos(a) * 0.27 * s, y: 0.66 * s + Math.sin(i * 1.7) * 0.12 * s, z: Math.sin(a) * 0.27 * s, shadow: false }));
  }
  g.position.set(x, 0, z);
  return g;
}
function bookStack(x, z, colors) {
  const g = new THREE.Group();
  colors.forEach((c, i) => g.add(mesh(box(0.26, 0.06, 0.19), mat(c), { y: 0.03 + i * 0.062, ry: (i % 2 ? 0.25 : -0.15) })));
  g.position.set(x, 0, z);
  return g;
}
function lamp(x, z, glow = '#FEF3C7') {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.02, 0.03, 0.7, 6), mat('#475569'), { y: 0.35 }));
  g.add(mesh(cyl(0.07, 0.12, 0.12, 12), mat('#FDE68A', { emissive: '#FBBF24', ei: 0.6 }), { y: 0.72 }));
  g.add(mesh(sphere(0.05, 10, 8), mat(glow, { emissive: '#FBBF24', ei: 1.2 }), { y: 0.66, shadow: false }));
  g.position.set(x, 0, z);
  return g;
}

export function buildGrowth(kind, tier) {
  const g = new THREE.Group();
  if (tier <= 0) return g;
  const add = (t, obj) => t <= tier && g.add(tagged(t, obj));
  switch (kind) {
    case 'book': {
      add(1, bookStack(0.7, 0.25, ['#6366F1', '#F472B6']));
      add(2, bookStack(0.95, 0.5, ['#10B981', '#FBBF24', '#8B5CF6']));
      const shelf = new THREE.Group();
      shelf.add(mesh(box(0.55, 0.62, 0.2), mat('#9A6B4F'), { y: 0.31 }));
      shelf.add(mesh(box(0.49, 0.03, 0.18), mat('#7C543D'), { y: 0.32, z: 0.02 }));
      ['#EF4444', '#3B82F6', '#FBBF24', '#10B981', '#8B5CF6'].forEach((c, i) => shelf.add(mesh(box(0.07, 0.2, 0.14), mat(c), { x: -0.18 + i * 0.09, y: 0.44, z: 0.03 })));
      shelf.position.set(-0.85, 0, 0.35);
      shelf.rotation.y = 0.5;
      add(3, shelf);
      add(4, lamp(1.05, 0.05));
      const plant = new THREE.Group();
      plant.add(mesh(cyl(0.06, 0.05, 0.08, 10), mat('#C2410C'), { y: 0.66 }));
      plant.add(mesh(sphere(0.08, 10, 8), mat('#4ADE80'), { y: 0.75 }));
      plant.position.set(-0.85, 0, 0.35);
      add(5, plant);
      const chair = new THREE.Group();
      chair.add(mesh(box(0.42, 0.16, 0.36), mat('#F472B6'), { y: 0.14 }));
      chair.add(mesh(box(0.42, 0.34, 0.1), mat('#EC4899'), { y: 0.3, z: -0.15 }));
      chair.add(mesh(box(0.08, 0.22, 0.36), mat('#DB2777'), { x: -0.21, y: 0.2 }));
      chair.add(mesh(box(0.08, 0.22, 0.36), mat('#DB2777'), { x: 0.21, y: 0.2 }));
      chair.position.set(0.15, 0, 0.95);
      chair.rotation.y = Math.PI;
      add(6, chair);
      break;
    }
    case 'walk': {
      const stone = mat('#E8E4F4');
      const stones = (pts) => {
        const s = new THREE.Group();
        pts.forEach(([x, z]) => s.add(mesh(cyl(0.12, 0.13, 0.04, 9), stone, { x, y: 0.02, z, sx: 1.3 })));
        return s;
      };
      add(1, stones([[0, 0.55], [0.1, 0.85], [0, 1.12]]));
      add(2, stones([[0.4, 0.3], [0.72, 0.25], [-0.4, 0.35], [-0.72, 0.3]]));
      add(3, roundTree(-0.75, 0.75, 0.9));
      add(4, roundTree(0.85, 0.7, 0.75, '#3E9467'));
      const border = new THREE.Group();
      [[-0.25, 0.7], [0.3, 0.95], [-0.2, 1.05], [0.35, 0.55], [-0.45, 0.55]].forEach(([x, z], i) => border.add(flower(x, z, ['#FBCFE8', '#FDE68A', '#C4B5FD', '#FFFFFF', '#BFDBFE'][i])));
      add(5, border);
      const sign = new THREE.Group();
      sign.add(mesh(cyl(0.025, 0.025, 0.55, 6), mat('#9A6B4F'), { y: 0.27 }));
      sign.add(mesh(box(0.3, 0.12, 0.03), mat('#FDE68A'), { x: 0.08, y: 0.48 }));
      sign.position.set(-0.3, 0, 1.1);
      add(6, sign);
      break;
    }
    case 'water': {
      add(1, mesh(cyl(0.28, 0.28, 0.02, 20), mat('#93C5FD', { opacity: 0.9 }), { x: 0.7, y: 0.012, z: 0.35, shadow: false }));
      add(2, mesh(cyl(0.5, 0.5, 0.02, 24), mat('#60A5FA', { opacity: 0.9 }), { x: 0.75, y: 0.014, z: 0.5, sz: 0.8, shadow: false }));
      const pads = new THREE.Group();
      [[0.6, 0.45], [0.9, 0.6], [0.75, 0.25]].forEach(([x, z]) => pads.add(mesh(cyl(0.08, 0.08, 0.01, 12), mat('#4ADE80'), { x, y: 0.03, z, shadow: false })));
      pads.add(flower(0.9, 0.6, '#F9A8D4', '#FDE68A', 0.05));
      add(3, pads);
      const reeds = new THREE.Group();
      for (let i = 0; i < 6; i++) reeds.add(mesh(cyl(0.012, 0.015, 0.35 + (i % 3) * 0.08, 5), mat('#3E9467'), { x: 1.2 + (i % 3) * 0.06, y: 0.18, z: 0.35 + i * 0.07, rz: (i % 2 ? 0.1 : -0.1) }));
      add(4, reeds);
      const ring = new THREE.Group();
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        ring.add(mesh(new THREE.DodecahedronGeometry(0.06, 0), mat('#CFCBE8', { flat: true }), { x: 0.75 + Math.cos(a) * 0.55, y: 0.04, z: 0.5 + Math.sin(a) * 0.44 }));
      }
      add(5, ring);
      const frog = new THREE.Group();
      frog.add(mesh(sphere(0.07, 12, 8), mat('#22C55E'), { y: 0.06, sy: 0.75 }));
      [-1, 1].forEach((d) => frog.add(mesh(sphere(0.025, 8, 6), mat('#FFFFFF'), { x: d * 0.035, y: 0.11, z: 0.03, shadow: false })));
      frog.position.set(0.6, 0.02, 0.45);
      add(6, frog);
      break;
    }
    case 'lotus':
    case 'wind': {
      const cairn = (n) => {
        const c = new THREE.Group();
        for (let i = 0; i < n; i++) c.add(mesh(sphere(0.1 - i * 0.012, 10, 8), mat(['#CFCBE8', '#B8B2DC', '#E3E0F2', '#A9A3D3', '#D9D5EE'][i]), { y: 0.06 + i * 0.1, sy: 0.55 }));
        return c;
      };
      const c1 = cairn(3);
      c1.position.set(0.7, 0, 0.3);
      add(1, c1);
      const c2 = cairn(5);
      c2.position.set(-0.7, 0, 0.45);
      add(2, c2);
      const bonsai = new THREE.Group();
      bonsai.add(mesh(box(0.28, 0.08, 0.18), mat('#475569'), { y: 0.04 }));
      bonsai.add(mesh(cyl(0.025, 0.04, 0.25, 6), mat('#7C543D'), { y: 0.2, rz: 0.3 }));
      bonsai.add(mesh(sphere(0.12, 10, 8), mat('#4FAE7C'), { x: 0.06, y: 0.34, sy: 0.6 }));
      bonsai.add(mesh(sphere(0.09, 10, 8), mat('#8ED3A8'), { x: -0.07, y: 0.3, sy: 0.6 }));
      bonsai.position.set(0.95, 0, 0.75);
      add(3, bonsai);
      const chime = new THREE.Group();
      chime.add(mesh(cyl(0.02, 0.02, 0.8, 6), mat('#9A6B4F'), { y: 0.4 }));
      chime.add(mesh(box(0.3, 0.02, 0.02), mat('#9A6B4F'), { x: 0.12, y: 0.78 }));
      for (let i = 0; i < 3; i++) chime.add(mesh(cyl(0.012, 0.012, 0.16 + i * 0.04, 6), mat('#E0E7FF', { emissive: '#A5B4FC', ei: 0.4 }), { x: 0.05 + i * 0.08, y: 0.66 - i * 0.02 }));
      chime.name = 'chime';
      chime.position.set(-1.0, 0, 0.05);
      add(4, chime);
      const sand = new THREE.Group();
      sand.add(mesh(cyl(0.42, 0.42, 0.015, 28), mat('#F5E9D6'), { y: 0.01, shadow: false }));
      [0.18, 0.3].forEach((r) => sand.add(mesh(new THREE.TorusGeometry(r, 0.008, 4, 36), mat('#E2CFB0'), { y: 0.02, rx: Math.PI / 2, shadow: false })));
      sand.position.set(-0.1, 0, 0.95);
      add(5, sand);
      const glow = new THREE.Group();
      glow.add(mesh(cyl(0.08, 0.1, 0.18, 8), mat('#CFCBE8', { flat: true }), { y: 0.09 }));
      glow.add(mesh(sphere(0.07, 10, 8), mat('#FDF4FF', { emissive: '#F0ABFC', ei: 1 }), { y: 0.24, shadow: false }));
      glow.position.set(-0.1, 0, 0.95);
      add(6, glow);
      break;
    }
    default: {
      const tint = { tooth: '#BFDBFE', bed: '#DDD6FE', sun: '#FDE68A', breakfast: '#FED7AA', shower: '#C4B5FD', moon: '#C7D2FE', heart: '#FBCFE8', sprout: '#BBF7D0', star: '#FEF08A' }[kind] || '#FBCFE8';
      const f1 = new THREE.Group();
      [[0.6, 0.3], [0.75, 0.55], [0.5, 0.6]].forEach(([x, z]) => f1.add(flower(x, z, tint)));
      add(1, f1);
      const bush = new THREE.Group();
      bush.add(mesh(sphere(0.18, 12, 8), mat('#4FAE7C'), { y: 0.12, sy: 0.75 }));
      bush.add(mesh(sphere(0.13, 10, 8), mat('#8ED3A8'), { x: 0.14, y: 0.1, z: 0.05, sy: 0.75 }));
      bush.position.set(-0.7, 0, 0.35);
      add(2, bush);
      add(3, roundTree(-0.85, 0.85, 0.8));
      add(4, lamp(0.95, 0.15));
      const f2 = new THREE.Group();
      [[-0.2, 0.9], [0.1, 1.05], [0.35, 0.85], [-0.45, 0.65]].forEach(([x, z], i) => f2.add(flower(x, z, i % 2 ? tint : '#FFFFFF')));
      add(5, f2);
      add(6, roundTree(0.95, 0.85, 1.05, '#3E9467', '#F9A8D4'));
    }
  }
  return g;
}

/** A tiny glowing bud: something will grow here tomorrow. */
export function buildBud() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.012, 0.012, 0.12, 5), mat('#4ADE80'), { y: 0.06, shadow: false }));
  g.add(mesh(sphere(0.045, 10, 8), mat('#BBF7D0', { emissive: '#4ADE80', ei: 0.9 }), { y: 0.14, sy: 1.3, shadow: false }));
  return g;
}

// ---------------------------------------------------------------- keepsake pebbles
export const PEBBLE_COLORS = {
  'first-minimum': ['#C4B5FD', '#A78BFA'],
  comeback: ['#FDBA74', '#FB923C'],
  'full-after-min': ['#7DD3FC', '#38BDF8'],
  'habit-50': ['#FDE68A', '#F59E0B'],
  'habit-month': ['#86EFAC', '#22C55E'],
};
export function buildPebble(type) {
  const [c, glow] = PEBBLE_COLORS[type] || PEBBLE_COLORS.comeback;
  const g = new THREE.Group();
  g.add(mesh(sphere(0.15, 18, 12), mat(c, { roughness: 0.35, emissive: c, ei: 0.25 }), { y: 0.06, sx: 1.25, sy: 0.55 }));
  g.add(mesh(sphere(0.035, 10, 8), mat('#FFFFFF', { emissive: glow, ei: 1.2 }), { y: 0.14, shadow: false }));
  // invisible, finger-sized hit area
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.5, 8), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 0.2;
  g.add(hit);
  return g;
}
