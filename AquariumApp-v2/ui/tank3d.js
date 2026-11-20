/**
 * tank3d.js — interactive 3D aquarium (React Three Fiber).
 * Drag to rotate, scroll / pinch to zoom. The scene reacts to telemetry:
 *   temperature → water tint, waterLow → water height, sun → lamp brightness,
 *   fan → fan blades spin, feedTick → food pellets drop.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { html } from './h.js';

const W = 4.2;   // tank width  (x)
const H = 2.5;   // tank height (y)
const D = 2.1;   // tank depth  (z)
const SAND = 0.22;

/* ---------- helpers ---------------------------------------------------- */

function waterColor(temp) {
  // 22 °C cool blue → 27 °C aqua → 32 °C warm amber
  const t = typeof temp === 'number' ? Math.min(Math.max((temp - 22) / 10, 0), 1) : 0.45;
  const cool = new THREE.Color('#1e6fd9');
  const mid = new THREE.Color('#14b8c4');
  const warm = new THREE.Color('#f59e0b');
  return t < 0.5 ? cool.lerp(mid, t * 2) : mid.lerp(warm, (t - 0.5) * 2);
}

function Controls() {
  const { camera, gl } = useThree();
  const ref = useRef();
  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement);
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.enablePan = false;
    c.minDistance = 4.2;
    c.maxDistance = 10;
    c.minPolarAngle = 0.35;
    c.maxPolarAngle = Math.PI / 2 + 0.05;
    c.autoRotate = true;
    c.autoRotateSpeed = 0.5;
    c.target.set(0, H / 2 - 0.9, 0); // scene group is shifted down by 0.9
    const stopAuto = () => { c.autoRotate = false; };
    c.addEventListener('start', stopAuto);
    ref.current = c;
    return () => { c.removeEventListener('start', stopAuto); c.dispose(); };
  }, [camera, gl]);
  useFrame(() => ref.current && ref.current.update());
  return null;
}

/* ---------- static parts ----------------------------------------------- */

function GlassBox() {
  const geo = useMemo(() => new THREE.BoxGeometry(W, H, D), []);
  const edges = useMemo(() => new THREE.EdgesGeometry(geo), [geo]);
  return html`
    <group position=${[0, H / 2, 0]}>
      <mesh geometry=${geo} renderOrder=${3}>
        <meshPhysicalMaterial color="#bff6ff" transparent=${true} opacity=${0.12}
          roughness=${0.05} metalness=${0.1} clearcoat=${1} side=${THREE.DoubleSide} depthWrite=${false} />
      </mesh>
      <lineSegments geometry=${edges}>
        <lineBasicMaterial color="#67e8f9" transparent=${true} opacity=${0.85} />
      </lineSegments>
    </group>`;
}

function Base() {
  return html`
    <group>
      <mesh position=${[0, -0.16, 0]}>
        <boxGeometry args=${[W + 0.35, 0.3, D + 0.35]} />
        <meshStandardMaterial color="#0b1424" metalness=${0.6} roughness=${0.35} />
      </mesh>
      <mesh position=${[0, -0.02, D / 2 + 0.176]}>
        <boxGeometry args=${[W + 0.3, 0.035, 0.01]} />
        <meshBasicMaterial color="#22d3ee" toneMapped=${false} />
      </mesh>
      <mesh position=${[0, -0.32, 0]} rotation=${[-Math.PI / 2, 0, 0]}>
        <circleGeometry args=${[3.0, 48]} />
        <meshBasicMaterial color="#22d3ee" transparent=${true} opacity=${0.08} />
      </mesh>
    </group>`;
}

function Sand() {
  return html`
    <mesh position=${[0, SAND / 2, 0]}>
      <boxGeometry args=${[W - 0.04, SAND, D - 0.04]} />
      <meshStandardMaterial color="#d6bf8f" roughness=${1} />
    </mesh>`;
}

function Rocks() {
  const rocks = useMemo(() => [
    { p: [-1.4, SAND + 0.12, -0.5], s: [0.45, 0.32, 0.38], c: '#5b6474' },
    { p: [-1.0, SAND + 0.08, -0.65], s: [0.28, 0.2, 0.25], c: '#6b7280' },
    { p: [1.3, SAND + 0.16, -0.4], s: [0.55, 0.42, 0.45], c: '#4b5563' },
    { p: [1.75, SAND + 0.08, 0.3], s: [0.25, 0.18, 0.22], c: '#78716c' },
    { p: [0.2, SAND + 0.06, 0.55], s: [0.2, 0.12, 0.18], c: '#64748b' },
  ], []);
  return html`<group>${rocks.map((r, i) => html`
    <mesh key=${i} position=${r.p} scale=${r.s}>
      <dodecahedronGeometry args=${[1, 0]} />
      <meshStandardMaterial color=${r.c} roughness=${0.9} flatShading=${true} />
    </mesh>`)}</group>`;
}

function Plant({ position, height, color, blades = 5, phase = 0 }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.children.forEach((b, i) => {
      b.rotation.z = Math.sin(t * 1.1 + phase + i) * 0.12 + (i - blades / 2) * 0.12;
      b.rotation.x = Math.cos(t * 0.8 + phase + i * 0.7) * 0.08;
    });
  });
  return html`
    <group ref=${ref} position=${position}>
      ${Array.from({ length: blades }, (_, i) => {
        const h = height * (0.7 + ((i * 37) % 10) / 30);
        return html`
          <mesh key=${i} position=${[0, 0, 0]}>
            <coneGeometry args=${[0.06, h, 5]} />
            <meshStandardMaterial color=${color} roughness=${0.7}
              emissive=${color} emissiveIntensity=${0.12} />
          </mesh>`;
      }).map((m, i) => html`<group key=${i}><group position=${[0, height * 0.42, 0]}>${m}</group></group>`)}
    </group>`;
}

function Plants({ maxY }) {
  const top = Math.min(maxY - SAND - 0.1, 1.6);
  return html`
    <group>
      <${Plant} position=${[-1.7, SAND, -0.7]} height=${top} color="#22c55e" blades=${6} />
      <${Plant} position=${[-0.6, SAND, -0.75]} height=${top * 0.7} color="#16a34a" blades=${5} phase=${1.3} />
      <${Plant} position=${[0.75, SAND, -0.7]} height=${top * 0.85} color="#4ade80" blades=${5} phase=${2.1} />
      <${Plant} position=${[1.8, SAND, -0.65]} height=${top * 0.6} color="#15803d" blades=${4} phase=${0.6} />
      <${Plant} position=${[-1.85, SAND, 0.6]} height=${top * 0.45} color="#84cc16" blades=${4} phase=${2.7} />
      <${Plant} position=${[-1.25, SAND, -0.3]} height=${top * 0.5} color="#dc2626" blades=${5} phase=${1.9} />
      <${Plant} position=${[1.45, SAND, 0.05]} height=${top * 0.4} color="#e11d48" blades=${4} phase=${0.3} />
      <${Plant} position=${[0.1, SAND, -0.8]} height=${top * 0.95} color="#10b981" blades=${7} phase=${3.4} />
    </group>`;
}

/* ---------- light caustics + gravel ----------------------------------- */

const CAUSTIC_VERT = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const CAUSTIC_FRAG = `
  uniform float uTime;
  uniform float uStrength;
  varying vec2 vUv;
  float wave(vec2 p, float t) {
    return sin(p.x * 9.0 + t * 1.3 + sin(p.y * 7.0 + t)) + sin(p.y * 11.0 - t * 1.1 + sin(p.x * 6.0 - t * 0.7));
  }
  void main() {
    vec2 p = vUv * vec2(2.0, 1.0);
    float c = abs(wave(p, uTime)) * abs(wave(p * 1.7 + 3.0, uTime * 0.8));
    c = pow(clamp(1.0 - c * 0.5, 0.0, 1.0), 6.0);
    float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x) * smoothstep(0.0, 0.1, vUv.y) * smoothstep(1.0, 0.9, vUv.y);
    gl_FragColor = vec4(vec3(0.6, 0.95, 1.0) * c * uStrength * edge, 1.0);
  }`;

/** Shimmering light pattern; used on the sand and on the water surface. */
function Caustics({ position, rotation, size, strength = 0.9, sun }) {
  const mat = useRef();
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uStrength: { value: strength } }), [strength]);
  const k = typeof sun === 'number' ? 0.35 + (sun / 100) * 0.65 : 0.8;
  useFrame(({ clock }, dt) => {
    if (!mat.current) return;
    mat.current.uniforms.uTime.value = clock.elapsedTime;
    const u = mat.current.uniforms.uStrength;
    u.value += (strength * k - u.value) * Math.min(dt * 1.5, 1); // light changes slowly
  });
  return html`
    <mesh position=${position} rotation=${rotation} renderOrder=${2}>
      <planeGeometry args=${size} />
      <shaderMaterial ref=${mat} vertexShader=${CAUSTIC_VERT} fragmentShader=${CAUSTIC_FRAG}
        uniforms=${uniforms} transparent=${true} depthWrite=${false} blending=${THREE.AdditiveBlending} />
    </mesh>`;
}

function Gravel() {
  const stones = useMemo(() => Array.from({ length: 70 }, (_, i) => {
    const r = (n) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
    const tones = ['#e7e5e4', '#a8a29e', '#d6d3d1', '#78716c', '#f5f5f4'];
    return {
      p: [(r(1) - 0.5) * (W - 0.3), SAND + 0.02, (r(2) - 0.5) * (D - 0.3)],
      s: 0.035 + r(3) * 0.04,
      c: tones[i % tones.length],
    };
  }), []);
  return html`<group>${stones.map((st, i) => html`
    <mesh key=${i} position=${st.p} scale=${[st.s, st.s * 0.6, st.s]}>
      <sphereGeometry args=${[1, 6, 4]} />
      <meshStandardMaterial color=${st.c} roughness=${0.8} />
    </mesh>`)}</group>`;
}

/* ---------- water ------------------------------------------------------ */

function Water({ level, temperature }) {
  const body = useRef();
  const surface = useRef();
  const target = useRef(level);
  const color = useMemo(() => waterColor(temperature), [temperature]);
  target.current = level;
  useFrame(({ clock }, dt) => {
    const b = body.current;
    if (!b) return;
    const current = b.scale.y;
    const next = current + (target.current - current) * Math.min(dt * 2, 1);
    b.scale.y = next;
    b.position.y = (next * H) / 2;
    b.material.color.lerp(color, Math.min(dt * 2, 1));
    if (surface.current) {
      surface.current.position.y = next * H + Math.sin(clock.elapsedTime * 1.5) * 0.008;
      surface.current.material.color.copy(b.material.color);
    }
  });
  return html`
    <group>
      <mesh ref=${body} scale=${[1, level, 1]} position=${[0, (level * H) / 2, 0]} renderOrder=${1}>
        <boxGeometry args=${[W - 0.06, H, D - 0.06]} />
        <meshPhysicalMaterial color=${color} transparent=${true} opacity=${0.42}
          roughness=${0.15} transmission=${0} depthWrite=${false} />
      </mesh>
      <mesh ref=${surface} position=${[0, level * H, 0]} rotation=${[-Math.PI / 2, 0, 0]} renderOrder=${2}>
        <planeGeometry args=${[W - 0.06, D - 0.06]} />
        <meshStandardMaterial color=${color} transparent=${true} opacity=${0.45}
          emissive="#67e8f9" emissiveIntensity=${0.25} side=${THREE.DoubleSide} depthWrite=${false} />
      </mesh>
    </group>`;
}

/* ---------- fish ------------------------------------------------------- */

const SPECIES = {
  clown: { body: '#f97316', fin: '#fb923c', stripe: '#ffffff', size: 0.2 },
  gold: { body: '#fbbf24', fin: '#f59e0b', stripe: null, size: 0.24 },
  tetra: { body: '#38bdf8', fin: '#ef4444', stripe: '#22d3ee', size: 0.11 },
};

function Fish({ kind, radius, speed, phase, yBase, yAmp, levelRef, feedRef }) {
  const ref = useRef();
  const tail = useRef();
  const finL = useRef();
  const finR = useRef();
  const sp = SPECIES[kind];
  // swim state: angle on the path, current/target direction, next time to turn around
  const st = useRef({ a: phase, dir: Math.sign(speed) || 1, target: Math.sign(speed) || 1, next: 5 + phase * 2, heading: 0, wig: 0 });
  useFrame(({ clock }, dt) => {
    const g = ref.current;
    if (!g) return;
    const s = st.current;
    const now = clock.elapsedTime;
    if (now > s.next) {
      // turn around now and then (schools turn together because they share the same seed timing)
      s.target = -s.target;
      s.next = now + 6 + ((phase * 97 + now) % 9);
    }
    s.dir += (s.target - s.dir) * Math.min(dt * 1.2, 1);
    const pace = Math.abs(speed) * (0.35 + 0.65 * Math.abs(s.dir));
    s.a += Math.sign(s.dir || 1) * pace * dt;
    const t = s.a;
    const rx = radius * (W / 2 - 0.45);
    const rz = radius * (D / 2 - 0.35);
    const x = Math.cos(t) * rx;
    const z = Math.sin(t) * rz;
    const ceiling = levelRef.current * H - 0.25;
    let y = Math.min(yBase + Math.sin(now * Math.abs(speed) * 2.3 + phase) * yAmp, ceiling);
    // swim up toward food for a few seconds after feeding
    const sinceFeed = now - feedRef.current;
    if (sinceFeed < 6) y += (ceiling - y) * Math.max(0, 1 - sinceFeed / 6) * 0.7;
    g.position.set(x, Math.max(y, SAND + 0.2), z);
    const sign = Math.sign(s.dir || 1);
    const dx = -Math.sin(t) * rx * sign;
    const dz = Math.cos(t) * rz * sign;
    const want = Math.atan2(-dz, dx);
    let diff = want - s.heading;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    s.heading += diff * Math.min(dt * 4, 1); // smooth turn instead of snapping
    g.rotation.y = s.heading;
    g.rotation.z = Math.sin(now * 1.7 + phase) * 0.08; // gentle body roll
    s.wig += dt * (8 + 10 * Math.abs(s.dir));
    if (tail.current) tail.current.rotation.y = Math.sin(s.wig) * 0.5;
    const flap = Math.sin(s.wig * 0.6) * 0.45;
    if (finL.current) finL.current.rotation.y = flap;
    if (finR.current) finR.current.rotation.y = -flap;
  });
  const s = sp.size;
  return html`
    <group ref=${ref} scale=${[s, s, s]}>
      <mesh scale=${[1.6, 0.9, 0.55]}>
        <sphereGeometry args=${[1, 20, 14]} />
        <meshStandardMaterial color=${sp.body} roughness=${0.4} emissive=${sp.body} emissiveIntensity=${0.15} />
      </mesh>
      ${sp.stripe && html`
        <mesh rotation=${[0, 0, Math.PI / 2]} position=${[0.35, 0, 0]} scale=${[0.92, 1, 0.6]}>
          <torusGeometry args=${[0.8, 0.09, 8, 24]} />
          <meshStandardMaterial color=${sp.stripe} emissive=${sp.stripe} emissiveIntensity=${0.2} />
        </mesh>`}
      <group ref=${tail} position=${[-1.5, 0, 0]}>
        <mesh rotation=${[0, 0, Math.PI / 2]} position=${[-0.4, 0, 0]} scale=${[1, 1, 0.25]}>
          <coneGeometry args=${[0.7, 0.9, 12]} />
          <meshStandardMaterial color=${sp.fin} roughness=${0.5} />
        </mesh>
      </group>
      <group ref=${finL} position=${[0.3, -0.25, 0.45]}>
        <mesh position=${[-0.25, 0, 0.15]} rotation=${[0.4, 0, 0]} scale=${[0.45, 0.06, 0.3]}>
          <sphereGeometry args=${[1, 10, 6]} />
          <meshStandardMaterial color=${sp.fin} transparent=${true} opacity=${0.85} />
        </mesh>
      </group>
      <group ref=${finR} position=${[0.3, -0.25, -0.45]}>
        <mesh position=${[-0.25, 0, -0.15]} rotation=${[-0.4, 0, 0]} scale=${[0.45, 0.06, 0.3]}>
          <sphereGeometry args=${[1, 10, 6]} />
          <meshStandardMaterial color=${sp.fin} transparent=${true} opacity=${0.85} />
        </mesh>
      </group>
      <mesh position=${[0, 0.85, 0]} rotation=${[0, 0, -0.3]} scale=${[0.7, 0.35, 0.06]}>
        <sphereGeometry args=${[1, 10, 6]} />
        <meshStandardMaterial color=${sp.fin} transparent=${true} opacity=${0.9} />
      </mesh>
      <mesh position=${[1.15, 0.25, 0.35]}>
        <sphereGeometry args=${[0.13, 10, 8]} />
        <meshBasicMaterial color="#020617" />
      </mesh>
      <mesh position=${[1.15, 0.25, -0.35]}>
        <sphereGeometry args=${[0.13, 10, 8]} />
        <meshBasicMaterial color="#020617" />
      </mesh>
    </group>`;
}

const SCHOOL = [
  { kind: 'clown', radius: 0.8, speed: 0.45, phase: 0, yBase: 1.0, yAmp: 0.2 },
  { kind: 'clown', radius: 0.55, speed: -0.5, phase: 2, yBase: 1.3, yAmp: 0.15 },
  { kind: 'gold', radius: 0.95, speed: 0.32, phase: 4, yBase: 1.5, yAmp: 0.25 },
  { kind: 'gold', radius: 0.4, speed: -0.38, phase: 1, yBase: 0.8, yAmp: 0.18 },
  ...Array.from({ length: 7 }, (_, i) => ({
    kind: 'tetra', radius: 0.62 + (i % 3) * 0.06, speed: 0.75, phase: 3 + i * 0.22,
    yBase: 1.15 + (i % 4) * 0.09, yAmp: 0.1,
  })),
];

/* ---------- bubbles, food, lamp, fan ----------------------------------- */

function Bubbles({ levelRef, count = 34 }) {
  const ref = useRef();
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => ({
    x: 1.55 + Math.sin(i * 7.1) * 0.12,
    z: 0.55 + Math.cos(i * 3.3) * 0.1,
    off: (i / count) * 3,
    sp: 0.35 + ((i * 13) % 10) / 25,
    r: 0.025 + ((i * 7) % 5) / 160,
  })), [count]);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const top = levelRef.current * H - 0.03;
    ref.current.children.forEach((m, i) => {
      const s = seeds[i];
      const y = SAND + (((clock.elapsedTime * s.sp + s.off) % 3) / 3) * (top - SAND);
      m.position.set(s.x + Math.sin(clock.elapsedTime * 3 + i) * 0.03, y, s.z);
    });
  });
  return html`
    <group ref=${ref}>${seeds.map((s, i) => html`
      <mesh key=${i}>
        <sphereGeometry args=${[s.r, 8, 6]} />
        <meshStandardMaterial color="#e0fbff" transparent=${true} opacity=${0.55}
          emissive="#a5f3fc" emissiveIntensity=${0.4} />
      </mesh>`)}
    </group>`;
}

function Food({ feedRef, levelRef }) {
  const ref = useRef();
  const pellets = useMemo(() => Array.from({ length: 16 }, (_, i) => ({
    x: -0.4 + Math.sin(i * 2.7) * 0.35, z: Math.cos(i * 1.9) * 0.3, d: 0.25 + (i % 5) * 0.06,
  })), []);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const since = clock.elapsedTime - feedRef.current;
    const visible = since >= 0 && since < 7;
    ref.current.visible = visible;
    if (!visible) return;
    const top = levelRef.current * H;
    ref.current.children.forEach((m, i) => {
      const p = pellets[i];
      const y = Math.max(SAND + 0.03, top + 0.3 - since * p.d);
      m.position.set(p.x + Math.sin(since * 2 + i) * 0.05, y, p.z);
      m.material.opacity = Math.max(0, 1 - since / 7);
    });
  });
  return html`
    <group ref=${ref} visible=${false}>${pellets.map((_, i) => html`
      <mesh key=${i}>
        <sphereGeometry args=${[0.03, 6, 5]} />
        <meshStandardMaterial color="#a16207" transparent=${true} />
      </mesh>`)}
    </group>`;
}

function Lamp({ sun }) {
  const bar = useRef();
  const light = useRef();
  const k = typeof sun === 'number' ? sun / 100 : 0.7;
  useFrame((_, dt) => {
    if (light.current) light.current.intensity += (k * 9 - light.current.intensity) * Math.min(dt * 2, 1);
    if (bar.current) bar.current.material.emissiveIntensity = 0.2 + k * 2.2;
  });
  return html`
    <group position=${[0, H + 0.06, 0]}>
      <mesh>
        <boxGeometry args=${[W + 0.1, 0.08, D + 0.1]} />
        <meshStandardMaterial color="#0f172a" metalness=${0.7} roughness=${0.3} />
      </mesh>
      <mesh ref=${bar} position=${[0, -0.045, 0]}>
        <boxGeometry args=${[W * 0.8, 0.02, 0.3]} />
        <meshStandardMaterial color="#fff7d6" emissive="#fde68a" emissiveIntensity=${1.5} toneMapped=${false} />
      </mesh>
      <pointLight ref=${light} position=${[0, -0.3, 0]} color="#fff3c4" intensity=${6} distance=${6} decay=${1.4} />
    </group>`;
}

function Fan({ on }) {
  const blades = useRef();
  const speed = useRef(0);
  useFrame((_, dt) => {
    speed.current += ((on ? 18 : 0) - speed.current) * Math.min(dt * 1.5, 1);
    if (blades.current) blades.current.rotation.z += speed.current * dt;
  });
  return html`
    <group position=${[W / 2 - 0.45, H + 0.35, D / 2 - 0.2]} rotation=${[-0.6, 0, 0]}>
      <mesh>
        <torusGeometry args=${[0.24, 0.035, 8, 28]} />
        <meshStandardMaterial color="#1e293b" emissive=${on ? '#22d3ee' : '#0f172a'} emissiveIntensity=${on ? 0.9 : 0.1} />
      </mesh>
      <group ref=${blades}>
        ${[0, 1, 2, 3].map((i) => html`
          <mesh key=${i} rotation=${[0, 0.4, (i * Math.PI) / 2]} position=${[0, 0, 0]}>
            <boxGeometry args=${[0.4, 0.07, 0.01]} />
            <meshStandardMaterial color="#cbd5e1" metalness=${0.4} />
          </mesh>`)}
      </group>
      <mesh position=${[0, -0.3, 0]}>
        <cylinderGeometry args=${[0.02, 0.02, 0.4, 6]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
    </group>`;
}

/* ---------- scene ------------------------------------------------------ */

function Scene({ temperature, waterLow, sun, fan, feedTick }) {
  const level = waterLow ? 0.55 : 0.9;
  const levelRef = useRef(level);
  levelRef.current = level;
  const feedRef = useRef(-100);
  const { clock } = useThree();
  useEffect(() => {
    if (feedTick) feedRef.current = clock.elapsedTime;
  }, [feedTick, clock]);

  return html`
    <group position=${[0, -0.9, 0]}>
      <ambientLight intensity=${0.45} color="#9bd8ff" />
      <directionalLight position=${[4, 6, 5]} intensity=${0.9} color="#e0f2fe" />
      <pointLight position=${[0, -0.5, 3]} intensity=${3} color="#22d3ee" distance=${7} />
      <${Base} />
      <${Sand} />
      <${Gravel} />
      <${Caustics} position=${[0, SAND + 0.012, 0]} rotation=${[-Math.PI / 2, 0, 0]} size=${[W - 0.06, D - 0.06]} strength=${0.9} sun=${sun} />
      <${Caustics} position=${[0, level * H - 0.01, 0]} rotation=${[-Math.PI / 2, 0, 0]} size=${[W - 0.06, D - 0.06]} strength=${0.45} sun=${sun} />
      <${Rocks} />
      <${Plants} maxY=${level * H} />
      <${Water} level=${level} temperature=${temperature} />
      ${SCHOOL.map((f, i) => html`<${Fish} key=${i} ...${f} levelRef=${levelRef} feedRef=${feedRef} />`)}
      <${Bubbles} levelRef=${levelRef} />
      <${Food} feedRef=${feedRef} levelRef=${levelRef} />
      <${GlassBox} />
      <${Lamp} sun=${sun} />
      <${Fan} on=${Boolean(fan)} />
    </group>`;
}

export function AquariumTank({ temperature, waterLow, sun, fan, feedTick = 0, className = '' }) {
  return html`
    <div className=${`tank-wrap ${className}`} title="Drag to rotate · scroll to zoom">
      <${Canvas}
        dpr=${[1, 2]}
        camera=${{ position: [5.8, 2.6, 7.0], fov: 38 }}
        gl=${{ antialias: true, alpha: true }}
        style=${{ width: '100%', height: '100%', touchAction: 'none' }}>
        <${Scene} temperature=${temperature} waterLow=${waterLow} sun=${sun} fan=${fan} feedTick=${feedTick} />
        <${Controls} />
      </${Canvas}>
    </div>`;
}

export default React.memo(AquariumTank);
