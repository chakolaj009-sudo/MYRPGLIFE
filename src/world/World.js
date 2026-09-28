// The 3D island world. Plain three.js (no framework) so it stays small and
// fast: one renderer, soft shadows from a single sun, pooled particles.
// React talks to it through a tiny imperative API (see bottom of class).
import * as THREE from 'three';
import { buildBud, buildPebble, buildCloud, buildCompanion, buildGrowth, buildGrowthTree, buildIsland, buildMarker, buildMiniIsland, buildMissionObject, buildRing, mat } from './models.js';

const TAU = Math.PI * 2;
const easeOut = (k) => 1 - Math.pow(1 - k, 3);
const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const HOME = new THREE.Vector3(0, 0, 0.35);
const REST = new THREE.Vector3(0.95, 0, 0.75); // where the companion curls up on a Minimum day
const COMPANION_SCALE = 1.9;
const OBJ_SCALE = 1.5;
// Mission slots (degrees around the island, 0 = facing the viewer). The front
// path stays clear for the companion; the growth tree owns the back.
const SLOTS = [58, -58, 100, -100, 138, -138, 165, -165];

const LIGHTS = {
  dawn: { hemi: ['#FFE4E6', '#8E86C0', 1.05], sun: ['#FFD9B8', 1.9], pos: [-6, 6, 5] },
  day: { hemi: ['#EAF0FF', '#8B86B8', 1.1], sun: ['#FFF5E6', 2.1], pos: [5, 9, 6] },
  evening: { hemi: ['#FFD6E0', '#7A6FB0', 1.0], sun: ['#FFC08A', 1.9], pos: [7, 5, 4] },
  night: { hemi: ['#A9B6FF', '#3A3D7A', 1.25], sun: ['#D4DCFF', 1.35], pos: [4, 9, 3] },
};

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

export class World {
  constructor(container, { onTapMission, onTapCompanion, onTapKeepsake, reducedMotion = false } = {}) {
    this.container = container;
    this.onTapMission = onTapMission;
    this.onTapCompanion = onTapCompanion;
    this.onTapKeepsake = onTapKeepsake;
    this.pebbles = new Map(); // keepsake id -> mesh
    this.reduced = reducedMotion;
    this.objects = new Map(); // id -> { group, obj, marker, ring, deco, angle, radius, done }
    this.particles = [];
    this.tweens = [];
    this.queue = Promise.resolve();

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    this.scene = scene;
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
    this.target = new THREE.Vector3(0, 0.7, 0);

    this.hemi = new THREE.HemisphereLight('#EAF0FF', '#8B86B8', 1.1);
    scene.add(this.hemi);
    const sun = new THREE.DirectionalLight('#FFF5E6', 2.1);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -6;
    sun.shadow.camera.right = 6;
    sun.shadow.camera.top = 6;
    sun.shadow.camera.bottom = -6;
    sun.shadow.bias = -0.0008;
    sun.shadow.radius = 4;
    scene.add(sun);
    scene.add(sun.target);
    this.sun = sun;

    // The spinning world: island + everything on it.
    this.spin = new THREE.Group();
    this.float = new THREE.Group(); // gentle hover of the whole island
    this.float.add(this.spin);
    scene.add(this.float);

    // Background: distant islands and clouds.
    this.backdrop = new THREE.Group();
    scene.add(this.backdrop);

    this.companion = null;
    this.tree = null;
    this.phase = null;
    this.stage = null;
    this.species = null;
    this.wearKey = '';
    this.comp = { pos: HOME.clone(), rot: 0, busy: false, mood: 'idle', blinkAt: 2, homeAt: 0, spinY: 0 };

    this.spinVel = 0;
    this.spinTarget = null;
    this.drag = null;
    this.raycaster = new THREE.Raycaster();
    this._bindPointer();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    this.clock = new THREE.Clock();
    this.running = true;
    this._onVis = () => {
      this.running = document.visibilityState === 'visible';
      if (this.running) {
        this.clock.getDelta();
        this._loop();
      }
    };
    document.addEventListener('visibilitychange', this._onVis);
    this._loop = this._loop.bind(this);
    this._loop();
  }

  // ---------------------------------------------------------------- layout
  resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = `${w}px`;
    this.renderer.domElement.style.height = `${h}px`;
    const cam = this.camera;
    cam.aspect = w / h;
    // Fit the island (~8.8 units) across, whatever the phone width.
    const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.aspect);
    const d = Math.max(13, 4.4 / Math.tan(hfov / 2));
    const el = THREE.MathUtils.degToRad(17);
    cam.position.set(0, this.target.y + Math.sin(el) * d, Math.cos(el) * d);
    cam.lookAt(this.target);
    // Shift the picture up so the island sits above the card hand.
    cam.setViewOffset(w, h, 0, h * (this.offsetY ?? 0.13), w, h);
    cam.updateProjectionMatrix();
  }

  setOffset(frac) {
    this.offsetY = frac;
    this.resize();
  }

  // ---------------------------------------------------------------- content
  setPhase(phase) {
    if (phase === this.phase) return;
    this.phase = phase;
    this._applyLight();

    if (this.island) this._drop(this.island);
    this.island = buildIsland(phase);
    this.spin.add(this.island);

    for (const b of [...this.backdrop.children]) this._drop(b);
    const night = phase === 'night';
    const cloudColor = night ? '#6C73AE' : phase === 'evening' ? '#FFE4EC' : '#FFFFFF';
    [
      [-6.5, -3.2, -3, 1.1, 1],
      [6.4, -2.8, -4, 1.2, 2],
      [1.5, -5.2, -1, 1.1, 3],
      [-5, 4.5, -12, 1.2, 4],
      [6, 6, -14, 1.3, 5],
    ].forEach(([x, y, z, s, seed]) => {
      const c = buildCloud(seed, cloudColor, night ? 0.3 : 0.92);
      c.position.set(x, y, z);
      c.scale.setScalar(s);
      c.userData.drift = { x, speed: 0.15 + seed * 0.03, phase: seed };
      this.backdrop.add(c);
    });
    [
      [-8.5, 3.2, -15, 1.3, 11],
      [9.5, 5.5, -18, 1.6, 12],
      [-12, 7, -25, 1.1, 13],
    ].forEach(([x, y, z, s, seed]) => {
      const m = buildMiniIsland(seed, phase);
      m.position.set(x, y, z);
      m.scale.setScalar(s);
      m.userData.bob = seed;
      this.backdrop.add(m);
    });
    // Lanterns glow a bit more at night.
    for (const o of this.objects.values()) this._applyDone(o);
  }

  _applyLight() {
    const L = LIGHTS[this.phase] || LIGHTS.day;
    const soft = !!this.soft;
    this.hemi.color.set(L.hemi[0]);
    if (soft) this.hemi.color.lerp(new THREE.Color('#FFE6D2'), 0.45);
    this.hemi.groundColor.set(L.hemi[1]);
    this.hemi.intensity = L.hemi[2] * (soft ? 0.95 : 1);
    this.sun.color.set(L.sun[0]);
    if (soft) this.sun.color.lerp(new THREE.Color('#FFD2B0'), 0.4);
    this.sun.intensity = L.sun[1] * (soft ? 0.55 : 1);
    this.sun.position.set(...L.pos);
  }

  /** Minimum day: softer, warmer light; the companion curls up nearby. */
  setMinimum(on) {
    on = !!on;
    if (on === this.soft) return;
    this.soft = on;
    if (this.phase) this._applyLight();
    const c = this.comp;
    if (!this.companion || c.busy) return;
    const target = on ? REST : HOME;
    if (this.reduced) {
      c.pos.copy(target);
      return;
    }
    c.busy = true;
    this._walkTo(target.clone())
      .then(() => this._turnTo(on ? -0.5 : 0, 400))
      .then(() => (c.busy = false));
  }

  get home() {
    return this.soft ? REST : HOME;
  }

  setStage(stage) {
    if (stage === this.stage) return;
    const grow = this.stage !== null;
    this.stage = stage;
    if (this.tree) this._drop(this.tree);
    this.tree = buildGrowthTree(stage);
    this.tree.position.set(-0.4, 0, -2.2);
    this.tree.scale.setScalar(1.25);
    this.spin.add(this.tree);
    if (grow && !this.reduced) {
      this.tree.scale.setScalar(0.3);
      this._tween(900, (k) => this.tree.scale.setScalar(0.3 + 0.95 * this._elastic(k)));
      this._burst(new THREE.Vector3(-0.4, 1.4, -2.2), ['#4ADE80', '#FDE68A', '#F9A8D4'], 26);
    }
  }

  setCompanion(species, wear = []) {
    const key = wear.join(',');
    if (species === this.species && key === this.wearKey) return;
    const changed = this.species !== null && species !== this.species;
    this.species = species;
    this.wearKey = key;
    if (this.companion) this._drop(this.companion);
    this.companion = buildCompanion(species, wear);
    this.companion.scale.setScalar(COMPANION_SCALE);
    this.companion.position.copy(this.comp.pos);
    this.companion.rotation.y = this.comp.rot;
    this.companion.userData.pick = 'companion';
    this.spin.add(this.companion);
    this.parts = {
      body: this.companion.children[0],
      eyes: this.companion.getObjectByName('eyes'),
      happy: this.companion.getObjectByName('happy'),
      calm: this.companion.getObjectByName('calm'),
    };
    if (changed && !this.reduced) this._burst(this.comp.pos.clone().add(new THREE.Vector3(0, 1, 0)), ['#A5B4FC', '#FDE68A', '#FFFFFF'], 30);
  }

  /** items: [{ id, kind, done, tier, pending }] in display order. */
  setMissions(items) {
    const ids = new Set(items.map((i) => i.id));
    for (const [id, o] of this.objects) {
      if (!ids.has(id)) {
        this._drop(o.group);
        this.objects.delete(id);
      }
    }
    items.forEach((it, i) => {
      let o = this.objects.get(it.id);
      if (!o || o.kind !== it.kind) {
        if (o) this._drop(o.group);
        o = this._makeObject(it);
        this.objects.set(it.id, o);
        this.spin.add(o.group);
        if (this._ready && !this.reduced) {
          o.group.scale.setScalar(0.01);
          this._tween(600, (k) => o.group.scale.setScalar(Math.max(0.01, this._elastic(k))));
        }
      }
      const a = THREE.MathUtils.degToRad(SLOTS[i % SLOTS.length] + (i >= SLOTS.length ? 12 : 0));
      const radius = i >= SLOTS.length ? 1.75 : 2.75;
      o.angle = a;
      o.radius = radius;
      o.group.position.set(Math.sin(a) * radius, 0, Math.cos(a) * radius);
      o.obj.rotation.y = a * 0.35; // turned slightly towards the viewer
      o.growth.rotation.y = a; // growth corner faces the rim
      o.bud.visible = !!it.pending;
      if (o.done !== !!it.done) {
        o.done = !!it.done;
        this._applyDone(o);
      }
      this._applyGrowth(o, it.tier || 0);
    });
    this._ready = true;
  }

  /** Keepsake pebbles along the front rim, in the order they were earned. */
  setKeepsakes(list) {
    const ids = new Set(list.map((k) => k.id));
    for (const [id, m] of this.pebbles) {
      if (!ids.has(id)) {
        this._drop(m);
        this.pebbles.delete(id);
      }
    }
    list.forEach((k, i) => {
      if (this.pebbles.has(k.id)) return;
      const m = buildPebble(k.type);
      m.userData.pick = `keep:${k.id}`;
      const side = i % 2 ? -1 : 1;
      const step = Math.floor(i / 2);
      const row = Math.floor(step / 6);
      const a = THREE.MathUtils.degToRad(side * (16 + (step % 6) * 7 + row * 3));
      const r = 3.62 - row * 0.4;
      m.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
      m.rotation.y = i * 1.3;
      this.spin.add(m);
      this.pebbles.set(k.id, m);
      if (this._keepReady && !this.reduced) {
        m.scale.setScalar(0.01);
        setTimeout(() => m.parent && this._tween(900, (kk) => m.scale.setScalar(Math.max(0.01, this._elastic(kk)))), 900);
      }
    });
    this._keepReady = true;
  }

  /** A small, unique animation for each rare moment. */
  reaction(type, habitId) {
    const c = this.comp;
    const head = () => this.spin.localToWorld(c.pos.clone().add(new THREE.Vector3(0, 1.6, 0)));
    const at = (id) => {
      const o = this.objects.get(id);
      if (!o) return head();
      const v = o.group.position.clone();
      v.y += 0.9;
      return this.spin.localToWorld(v);
    };
    this.spin.updateMatrixWorld();
    this._face(true, 2200);
    if (this.reduced) return;
    this._faceViewer();
    switch (type) {
      case 'first-minimum': // a slow drift of moonlight motes while resting
        for (let i = 0; i < 4; i++) setTimeout(() => this._burst(head(), ['#C4B5FD', '#E9D5FF', '#FFFFFF'], 10, { up: 0.5, gravity: -0.6, spread: 0.5, life: 2.2 }), i * 380);
        break;
      case 'comeback': // a happy little wave
        this._tween(1100, (k) => (this.parts.body.rotation.z = Math.sin(k * Math.PI * 6) * 0.18 * (1 - k))).then(() => (this.parts.body.rotation.z = 0));
        this._burst(head(), ['#FDBA74', '#FDE68A', '#FFFFFF'], 30, { up: 0.8 });
        break;
      case 'full-after-min': {
        const y0 = c.spinY;
        this._tween(900, (k) => {
          c.spinY = y0 + Math.PI * 4 * (1 - Math.pow(1 - k, 3));
          this.parts.body.position.y = Math.sin(k * Math.PI) * 0.7;
        }).then(() => {
          c.spinY = 0;
          this.parts.body.position.y = 0;
        });
        this._burst(head(), ['#F87171', '#FBBF24', '#4ADE80', '#38BDF8', '#A78BFA'], 70);
        break;
      }
      case 'habit-50':
        if (habitId) this.focus(habitId);
        setTimeout(() => this._burst(at(habitId), ['#FDE68A', '#FBBF24', '#FFFFFF'], 50, { up: 1.3 }), 600);
        setTimeout(() => this._burst(at(habitId), ['#FDE68A', '#F59E0B'], 30, { up: 1 }), 1100);
        this._hop(0.5, 600);
        break;
      default: // habit-month: a ring of leaves around the habit
        if (habitId) this.focus(habitId);
        setTimeout(() => this._burst(at(habitId), ['#86EFAC', '#4ADE80', '#BBF7D0'], 44, { up: 0.6, spread: 1.6, gravity: 2 }), 600);
        this._hop(0.35, 500).then(() => this._hop(0.35, 500));
    }
  }

  // ---------------------------------------------------------------- actions
  /** Spin the island so this mission faces the camera, and highlight it. */
  focus(id) {
    const o = this.objects.get(id);
    this.selected = id || null;
    if (!o) return;
    let target = -o.angle;
    const cur = this.spin.rotation.y;
    target += Math.round((cur - target) / TAU) * TAU;
    this.spinVel = 0;
    const from = cur;
    if (this.reduced) this.spin.rotation.y = target;
    else this._tween(650, (k) => (this.spin.rotation.y = from + (target - from) * easeInOut(k)));
  }

  /** Companion walks over, acts it out, the object celebrates. Resolves when done. */
  play(id) {
    const run = async () => {
      const o = this.objects.get(id);
      if (!o) return;
      this.focus(id);
      const c = this.comp;
      c.busy = true;
      const dest = o.group.position.clone().multiplyScalar((o.radius - 0.95) / o.radius);
      if (!this.reduced) {
        await this._walkTo(dest);
        await this._act();
      }
      o.done = true;
      this._applyDone(o, true);
      const p = o.group.position.clone();
      p.y += 0.8;
      this._burst(this.spin.localToWorld(p), ['#FBBF24', '#A5B4FC', '#4ADE80', '#F9A8D4', '#FFFFFF'], 34);
      c.busy = false;
      c.homeAt = (this.time || 0) + 2.4;
    };
    this.queue = this.queue.then(run, run);
    return this.queue;
  }

  undo(id) {
    const o = this.objects.get(id);
    if (!o) return;
    o.done = false;
    this._applyDone(o);
  }

  react() {
    if (this.comp.busy) return;
    const r = ['hop', 'spin', 'wiggle'][Math.floor(Math.random() * 3)];
    this._face(true, 900);
    if (this.reduced) return;
    const body = this.parts.body;
    if (r === 'spin') {
      const y0 = this.comp.spinY;
      this._tween(750, (k) => {
        this.comp.spinY = y0 + TAU * easeInOut(k);
        body.position.y = Math.sin(k * Math.PI) * 0.35;
      }).then(() => (this.comp.spinY = 0));
    } else if (r === 'wiggle') {
      this._tween(650, (k) => (body.rotation.z = Math.sin(k * TAU * 2) * 0.25 * (1 - k))).then(() => (body.rotation.z = 0));
    } else this._hop(0.45, 520);
  }

  /** Turn the companion to look at the viewer, whatever way the island is spun. */
  _faceViewer() {
    if (!this.comp.busy) this._turnTo(-this.spin.rotation.y, 320);
  }

  celebrate() {
    this._face(true, 1800);
    if (this.reduced) return;
    this._faceViewer();
    const base = this.spin.localToWorld(this.comp.pos.clone().add(new THREE.Vector3(0, 1.4, 0)));
    this._burst(base, ['#FBBF24', '#A5B4FC', '#4ADE80', '#F9A8D4', '#38BDF8'], 60);
    this._hop(0.6, 600).then(() => this._hop(0.4, 500));
  }

  /** Viewport point of a mission (or the companion) for DOM effects. */
  screenPoint(id) {
    let v;
    if (id === 'companion') v = this.comp.pos.clone().add(new THREE.Vector3(0, 1.2, 0));
    else {
      const o = this.objects.get(id);
      if (!o) return null;
      v = o.group.position.clone().add(new THREE.Vector3(0, 0.7, 0));
    }
    this.spin.updateMatrixWorld();
    this.float.updateMatrixWorld();
    v = this.spin.localToWorld(v).project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  }

  dispose() {
    this.running = false;
    for (const p of this.particles) this.scene.remove(p);
    this.particles = [];
    this.tweens = [];
    this._drop(this.float);
    this._drop(this.backdrop);
    this._pgeo?.dispose();
    this.resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', this._onVis);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ---------------------------------------------------------------- internals
  /** Free GPU resources of a subtree we no longer show (shared cached materials are kept). */
  _drop(obj) {
    if (!obj) return;
    obj.parent?.remove(obj);
    obj.traverse((m) => {
      if (m.geometry && m.geometry !== this._pgeo) m.geometry.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const x of mats) if (!x.userData.cached) x.dispose();
    });
  }

  _makeObject(it) {
    const group = new THREE.Group();
    group.userData.pick = it.id;
    const obj = buildMissionObject(it.kind);
    obj.scale.setScalar(OBJ_SCALE);
    group.add(obj);
    const ring = buildRing();
    ring.scale.setScalar(OBJ_SCALE);
    group.add(ring);
    const marker = buildMarker();
    marker.position.y = 1.55;
    group.add(marker);
    const deco = new THREE.Group();
    ['#FDE68A', '#F9A8D4', '#FFFFFF', '#C4B5FD'].forEach((c, i) => {
      const a = (i / 4) * TAU + 0.4;
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mat(c));
      f.position.set(Math.cos(a) * 0.62, 0.06, Math.sin(a) * 0.62);
      deco.add(f);
    });
    const badge = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), mat('#4ADE80', { emissive: '#22C55E', ei: 0.5, flat: true }));
    badge.position.y = 1.4;
    badge.name = 'badge';
    deco.add(badge);
    group.add(deco);
    // Invisible, generous hit area so small objects are easy to tap.
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.8, 10), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.8;
    group.add(hit);
    const growth = new THREE.Group();
    growth.name = 'growth';
    growth.scale.setScalar(0.88);
    group.add(growth);
    const bud = buildBud();
    bud.position.set(0.5, 0, 0.35);
    bud.visible = false;
    group.add(bud);
    return { id: it.id, kind: it.kind, group, obj, ring, marker, deco, growth, bud, tier: -1, done: !!it.done, angle: 0, radius: 2.75, t0: Math.random() * 10 };
  }

  /** Rebuild a habit's growth corner; new pieces spring up (growth never shrinks visually mid-session). */
  _applyGrowth(o, tier) {
    if (tier === o.tier) return;
    const from = o.tier;
    o.tier = tier;
    for (const c of [...o.growth.children]) this._drop(c);
    const g = buildGrowth(o.kind, tier);
    const fresh = [];
    for (const piece of [...g.children]) {
      o.growth.add(piece);
      if (piece.userData.tier > from) fresh.push(piece);
    }
    if (!this._ready || this.reduced || from < 0 || !fresh.length) return;
    fresh.forEach((p, i) => {
      p.scale.setScalar(0.01);
      setTimeout(() => p.parent && this._tween(800, (k) => p.scale.setScalar(Math.max(0.01, this._elastic(k)))), i * 180);
    });
    const at = o.group.position.clone();
    at.y += 0.6;
    this.spin.updateMatrixWorld();
    this._burst(this.spin.localToWorld(at), ['#4ADE80', '#BBF7D0', '#FDE68A', '#FFFFFF'], 30);
  }

  _applyDone(o, animate = false) {
    o.marker.visible = !o.done;
    o.ring.visible = !o.done;
    o.deco.visible = o.done;
    if (o.done && animate && !this.reduced) {
      o.deco.scale.setScalar(0.01);
      this._tween(700, (k) => o.deco.scale.setScalar(Math.max(0.01, this._elastic(k))));
    } else o.deco.scale.setScalar(1);
  }

  _walkTo(dest) {
    const c = this.comp;
    const from = c.pos.clone();
    const dist = from.distanceTo(dest);
    if (dist < 0.05) return Promise.resolve();
    const face = Math.atan2(dest.x - from.x, dest.z - from.z);
    this._turnTo(face, 180);
    const ms = Math.max(350, dist * 420);
    const hops = Math.max(2, Math.round(dist * 2.2));
    return this._tween(ms, (k) => {
      c.pos.lerpVectors(from, dest, easeInOut(k));
      this.parts.body.position.y = Math.abs(Math.sin(k * Math.PI * hops)) * 0.14;
    }).then(() => (this.parts.body.position.y = 0));
  }

  _turnTo(angle, ms) {
    const c = this.comp;
    let from = c.rot;
    let to = angle;
    to += Math.round((from - to) / TAU) * TAU;
    return this._tween(ms, (k) => (c.rot = from + (to - from) * easeOut(k)));
  }

  _act() {
    const c = this.comp;
    this._face(true, 1100);
    const body = this.parts.body;
    const y0 = c.spinY;
    return this._tween(700, (k) => {
      body.position.y = Math.sin(k * Math.PI) * 0.45;
      c.spinY = y0 + TAU * easeInOut(k);
      const sq = 1 + Math.sin(k * Math.PI * 2) * 0.08;
      body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    }).then(() => {
      c.spinY = 0;
      body.position.y = 0;
      body.scale.set(1, 1, 1);
    });
  }

  _hop(h, ms) {
    const body = this.parts.body;
    return this._tween(ms, (k) => {
      body.position.y = Math.sin(k * Math.PI) * h;
      const sq = k < 0.15 ? 1 - (k / 0.15) * 0.12 : k > 0.85 ? 1 - ((1 - k) / 0.15) * 0.1 : 1.05;
      body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    }).then(() => {
      body.position.y = 0;
      body.scale.set(1, 1, 1);
    });
  }

  _face(happy, ms) {
    this.comp.mood = happy ? 'happy' : 'idle';
    clearTimeout(this._faceT);
    this._faceT = setTimeout(() => (this.comp.mood = 'idle'), ms);
  }

  _elastic(k) {
    if (k === 0 || k === 1) return k;
    return Math.pow(2, -10 * k) * Math.sin((k * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  }

  _tween(ms, fn) {
    return new Promise((resolve) => {
      if (this.reduced) {
        fn(1);
        resolve();
        return;
      }
      this.tweens.push({ t: 0, ms, fn, resolve });
    });
  }

  _burst(at, colors, count, { up = 1, spread = 1, gravity = 7, life = 1 } = {}) {
    if (this.reduced) return;
    const geo = (this._pgeo ||= new THREE.IcosahedronGeometry(0.06, 0));
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, mat(colors[i % colors.length], { emissive: colors[i % colors.length], ei: 0.35, flat: true }));
      m.position.copy(at);
      const a = Math.random() * TAU;
      const s = 1.5 + Math.random() * 2.5;
      m.userData.v = new THREE.Vector3(Math.cos(a) * s * 0.6 * spread, (2.5 + Math.random() * 3) * up, Math.sin(a) * s * 0.6 * spread);
      m.userData.life = (0.9 + Math.random() * 0.6) * life;
      m.userData.g = gravity;
      m.userData.age = 0;
      m.userData.spin = new THREE.Vector3(Math.random() * 8, Math.random() * 8, 0);
      this.scene.add(m);
      this.particles.push(m);
    }
  }

  _bindPointer() {
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', (e) => {
      this.drag = { x: e.clientX, y: e.clientY, lx: e.clientX, lt: performance.now(), moved: false, v: 0 };
      this.spinVel = 0;
      el.setPointerCapture?.(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      const d = this.drag;
      if (!d) return;
      if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) d.moved = true;
      if (!d.moved) return;
      const now = performance.now();
      const dx = e.clientX - d.lx;
      this.spin.rotation.y += dx * 0.011;
      d.v = (dx * 0.011) / Math.max(1, now - d.lt);
      d.lx = e.clientX;
      d.lt = now;
    });
    const end = (e) => {
      const d = this.drag;
      this.drag = null;
      if (!d) return;
      if (d.moved) {
        this.spinVel = this.reduced ? 0 : d.v * 16;
        return;
      }
      this._pick(e.clientX, e.clientY);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', () => (this.drag = null));
  }

  _pick(cx, cy) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.spin.children, true);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.pick) o = o.parent;
      if (!o) continue;
      const pick = o.userData.pick;
      if (pick === 'companion') {
        this.react();
        this.onTapCompanion?.();
      } else if (pick.startsWith('keep:')) {
        const peb = this.pebbles.get(pick.slice(5));
        if (peb && !this.reduced) this._tween(500, (k) => (peb.position.y = Math.sin(k * Math.PI) * 0.25));
        this.onTapKeepsake?.(pick.slice(5));
      } else this.onTapMission?.(pick);
      return;
    }
  }

  _loop() {
    if (!this.running) return;
    requestAnimationFrame(this._loop);
    // Monotonic engine time: never trust a clock that could jump or run backwards.
    // Tweens follow real elapsed time (so a slow frame never means slow motion);
    // physics steps are clamped for stability.
    const raw = Math.max(0, Math.min(this.clock.getDelta(), 0.25));
    const dt = Math.min(raw, 0.05);
    this.time = (this.time || 0) + raw;
    const t = this.time;

    // tweens
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t += raw * 1000;
      const k = Math.min(1, tw.t / tw.ms);
      tw.fn(k);
      if (k >= 1) {
        this.tweens.splice(i, 1);
        tw.resolve();
      }
    }

    // island spin inertia + gentle hover
    if (!this.drag && Math.abs(this.spinVel) > 0.0001) {
      this.spin.rotation.y += this.spinVel * dt * 60;
      this.spinVel *= Math.pow(0.9, dt * 60);
    }
    if (!this.reduced) {
      this.float.position.y = Math.sin(t * 0.8) * 0.08;
      for (const b of this.backdrop.children) {
        if (b.userData.drift) b.position.x = b.userData.drift.x + Math.sin(t * b.userData.drift.speed + b.userData.drift.phase) * 0.6;
        if (b.userData.bob) b.position.y += Math.sin(t * 0.6 + b.userData.bob) * 0.002;
      }
    }

    // companion
    if (this.companion) {
      const c = this.comp;
      if (!c.busy && c.homeAt && t > c.homeAt) {
        c.homeAt = 0;
        c.busy = true;
        const soft = !!this.soft;
        this._walkTo(this.home.clone()).then(() => this._turnTo(soft ? -0.5 : 0, 300)).then(() => (c.busy = false));
      }
      this.companion.position.copy(c.pos);
      // The companion spins with the island, so dragging lets you see it from every side.
      this.companion.rotation.y = c.rot + c.spinY;
      const body = this.parts.body;
      const resting = this.soft && !c.busy && c.pos.distanceTo(REST) < 0.05 && c.mood !== 'happy';
      if (!c.busy && body.position.y === 0) {
        // Curled up on a Minimum day: lower, rounder, slow breathing.
        const breathe = this.reduced ? 0 : Math.sin(t * (resting ? 1.2 : 2.4)) * (resting ? 0.03 : 0.02);
        const b = (resting ? 0.84 : 1) + breathe;
        const w = resting ? 1.12 : 1 / Math.sqrt(1 + breathe);
        body.scale.set(w, b, w);
      }
      // blink & mood
      if (t > c.blinkAt) {
        c.blinkAt = t + 2.5 + Math.random() * 3;
        c.blinkEnd = t + 0.12;
      }
      const blinking = c.blinkEnd && t < c.blinkEnd;
      const happy = c.mood === 'happy';
      if (this.parts.eyes) {
        this.parts.eyes.visible = !happy && !resting;
        this.parts.eyes.scale.y = blinking ? 0.12 : 1;
      }
      if (this.parts.happy) this.parts.happy.visible = happy;
      if (this.parts.calm) this.parts.calm.visible = resting;
    }

    // mission markers
    for (const o of this.objects.values()) {
      if (o.bud.visible && !this.reduced) o.bud.scale.setScalar(1 + Math.sin(t * 2.2 + o.t0) * 0.12);
      if (o.done) {
        const badge = o.deco.getObjectByName('badge');
        if (badge) badge.rotation.y = t * 1.5;
        continue;
      }
      const sel = this.selected === o.id;
      o.marker.rotation.y = t * 2 + o.t0;
      o.marker.position.y = 1.55 + Math.sin(t * 2.5 + o.t0) * 0.08;
      o.marker.scale.setScalar(sel ? 1.5 : 1);
      o.ring.material.opacity = (sel ? 0.9 : 0.45) + Math.sin(t * 3 + o.t0) * 0.2;
      o.obj.position.y = this.reduced ? 0 : Math.max(0, Math.sin(t * 1.6 + o.t0)) * 0.04;
    }

    // particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      const u = p.userData;
      u.age += dt;
      u.v.y -= (u.g ?? 7) * dt;
      p.position.addScaledVector(u.v, dt);
      p.rotation.x += u.spin.x * dt;
      p.rotation.y += u.spin.y * dt;
      p.scale.setScalar(Math.max(0.01, 1 - u.age / u.life));
      if (u.age >= u.life) {
        this.scene.remove(p);
        this.particles.splice(i, 1);
      }
    }

    this.renderer.render(this.scene, this.camera);
  }
}
