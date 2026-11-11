// The 3D world: a journey through our solar system along one thread of light.
// Each chapter is a real world: Earth, the Moon, Mars, Saturn, Pluto, then beyond. The hero lands, runs over the curve of the planet,
// takes off and flies to the next. Scroll position decides how far along the thread he is,
// and the camera chases him.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { projects } from './content.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const hot = (r, g, b) => new THREE.Color(r, g, b); // brighter than white, so it blooms
const rad = (d) => (d * Math.PI) / 180;
const UP = V(0, 1, 0);

let seed = 7;
const rnd = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/* ---------- our solar system ---------- */
// The worlds the hero lands on: centre, radius, the direction he crosses it (dir),
// the colour of its sky, and how strong that sky is. The models are built in Blender
// (tools/solar_system.py) and loaded from models/solar.glb.
const PLANETS = {
  earth: { c: V(0, -16.4, -150), r: 16, dir: V(0.12, 0, -1), sky: '#5aa8ff', air: 0.42 },
  moon: { c: V(10, -14.4, -320), r: 14, dir: V(-0.22, 0, -1), sky: '#9aa0b0', air: 0.06 },
  mars: { c: V(-9, -17.5, -490), r: 17, dir: V(0.2, 0, -1), sky: '#ff8a50', air: 0.3 },
  pluto: { c: V(8, -15.5, -870), r: 15, dir: V(-0.1, 0, -1), sky: '#9ab8ff', air: 0.12 },
};
for (const p of Object.values(PLANETS)) {
  p.dir.normalize();
  p.side = new THREE.Vector3().crossVectors(p.dir, UP).normalize();
}
const GIANT = { c: V(0, -3, -680), r: 15, loop: 25, tilt: rad(11) }; // Saturn
const GALAXY = { c: V(0, -120, -1560), r: 250 }; // the Milky Way, seen from outside at the very end
const SUN = { c: V(-95, 40, -70), r: 30 };
// passed on the way, never landed on: [model, centre, radius, sky colour]
const FLYBY = [
  ['Mercury', V(-20, 8, -40), 2.6, null],
  ['Venus', V(26, -9, -88), 4.5, '#ffd9a0'],
  ['Jupiter', V(-85, 8, -585), 26, '#ffc890'],
  ['Uranus', V(60, 18, -770), 11, '#9ff0ff'],
  ['Neptune', V(-60, -10, -815), 11, '#5a8cff'],
];

// a direction from a planet's centre: `along` degrees along the hero's path, `across` degrees to the side
function dirOn(planet, along, across = 0) {
  const a = rad(along), b = rad(across);
  return planet.dir.clone().multiplyScalar(Math.sin(a)).addScaledVector(UP, Math.cos(a)).multiplyScalar(Math.cos(b))
    .addScaledVector(planet.side, Math.sin(b)).normalize();
}
const onPlanet = (planet, along, across = 0, height = 0) => dirOn(planet, along, across).multiplyScalar(planet.r + height).add(planet.c);
const drift = (along) => Math.sin(along * 0.09) * 3; // the path wanders a little side to side

// the giant's ring plane, and a point on a circle around it
const gE1 = V(0, 0, 1), gE2 = V(Math.cos(GIANT.tilt), Math.sin(GIANT.tilt), 0);
const aroundGiant = (deg, radius, lift = 0) =>
  gE1.clone().multiplyScalar(Math.cos(rad(deg)) * radius).addScaledVector(gE2, Math.sin(rad(deg)) * radius).add(GIANT.c).add(V(0, lift, 0));

/* ---------- the thread: one line through every world ---------- */
const threadPts = [];
const marks = {}; // named places on the thread
const add = (v, name) => {
  threadPts.push(v);
  if (name) marks[name] = v;
};
add(V(0, -2.4, 13));
add(V(0, -0.7, 6));
add(V(0, 0, 0), 'gate');
add(V(0, 0.8, -14));
add(V(3, 3, -70)); // a long open stretch before Earth
function overPlanet(key, extra) {
  const pl = PLANETS[key];
  add(onPlanet(pl, -58, 0, 3.2).addScaledVector(pl.dir, -7).add(V(0, 4, 0)));
  for (let i = 0; i <= 12; i++) {
    const a = -58 + (i * 116) / 12;
    const h = 0.3 + smooth(clamp((Math.abs(a) - 38) / 20)) * 3; // hugs the ground in the middle, lifts off at each end
    const name = i === 2 ? `${key}In` : i === 10 ? `${key}Out` : extra && i === 6 ? extra : null;
    add(onPlanet(pl, a, drift(a), h), name);
  }
  add(onPlanet(pl, 58, 0, 3.2).addScaledVector(pl.dir, 7).add(V(0, 4.5, 0)));
}
overPlanet('earth');
overPlanet('moon');
overPlanet('mars');
add(V(-4, 6, -600));
for (let i = 0; i <= 15; i++) {
  const d = -35 + i * 19;
  add(aroundGiant(d, GIANT.loop, Math.sin(d * 0.05) * 1.2), i === 0 ? 'giantIn' : i === 15 ? 'giantOut' : null);
}
add(V(-10, 5, -780));
overPlanet('pluto', 'door');
add(V(7, 4.5, -910));
add(V(2, 4, -980));
add(V(0, 4, -1180), 'warpEnd'); // the jump covers a lot of ground, fast
add(V(0, 4, -1230), 'end');
add(V(0, 4, -1280));
add(V(0, 4, -1330));

// where the hero is on the thread at each scroll position
const STOPS = [
  [0.1, 'gate'], [0.135, 'earthIn'], [0.215, 'earthOut'], [0.27, 'moonIn'], [0.36, 'moonOut'], [0.42, 'marsIn'], [0.52, 'marsOut'],
  [0.585, 'giantIn'], [0.77, 'giantOut'], [0.81, 'plutoIn'], [0.868, 'door'], [0.89, 'plutoOut'], [0.965, 'warpEnd'], [1.0, 'end'],
];
const WORK = [0.6, 0.765]; // the stretch of scroll where the four projects are shown

// camera for the opening only; after that it chases the hero
const CAM = [
  [0.0, V(0, 0.8, 14), V(0, 0, 0)],
  [0.06, V(0, 0.4, 7), V(0, 0, -4)],
  [0.11, V(0.5, 0.9, 2.4), V(0, 0.2, -10)],
];

// mood: [scroll, background, fog colour, fog density]
const MOOD = [
  [0.0, '#020207', '#04040c', 0.004],
  [0.13, '#03060f', '#0a1830', 0.011], // Earth: blue air
  [0.215, '#020207', '#04040c', 0.004],
  [0.28, '#020203', '#050508', 0.005], // the Moon: no air at all
  [0.36, '#020207', '#04040c', 0.004],
  [0.43, '#0d0403', '#2a0c06', 0.013], // Mars: dust
  [0.52, '#020207', '#04040c', 0.004],
  [0.6, '#05040a', '#100c0a', 0.003], // Saturn
  [0.77, '#020207', '#04040c', 0.004],
  [0.82, '#03040a', '#080c18', 0.007], // Pluto: thin and cold
  [0.89, '#020207', '#04040c', 0.004],
  [1.0, '#02030a', '#04060e', 0.003],
].map(([p, bg, fog, d]) => [p, new THREE.Color(bg), new THREE.Color(fog), d]);

/* ---------- builders ---------- */

function dot(size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.3, 'rgba(255,255,255,0.5)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

// a glow that hugs a planet's edge from outside and becomes its sky once you are standing on it
function atmosphere(radius, color, strength) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.16, 48, 32),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color(color) }, uStrength: { value: strength } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 uColor; uniform float uStrength; varying vec3 vN; varying vec3 vV; void main(){ float i = pow(abs(dot(normalize(vN), normalize(vV))), 1.6) * uStrength; gl_FragColor = vec4(uColor * i, i); }',
    }),
  );
}

// Grass is real scanned tufts (Poly Haven "Grass Medium 01"), instanced thousands of times.
// Each world asks for grass up front; it is planted once the nature models have loaded.
const grassJobs = [];
const grassTime = { value: 0 };
function grass({ count, at, height = 1, tip }) {
  const group = new THREE.Group();
  grassJobs.push({ group, count, at, height, tint: new THREE.Color(tip) });
  return group;
}
function growGrass(nature) {
  const tufts = ['Grass_A', 'Grass_B', 'Grass_C'].map((n) => nature.getObjectByName(n));
  const share = [0.42, 0.42, 0.16];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), yaw = new THREE.Quaternion(), sc = new THREE.Vector3();
  for (const job of grassJobs) {
    const mat = new THREE.MeshStandardMaterial({
      map: tufts[0].material.map,
      alphaTest: 0.4,
      side: THREE.DoubleSide,
      roughness: 0.85,
      color: job.tint,
      emissive: job.tint,
      emissiveIntensity: 0.1,
    });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = grassTime;
      // wind: the top of each tuft sways, the root stays put
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float gh = clamp(position.y / 0.3, 0.0, 1.0);
        float gs = sin(uTime * 1.4 + instanceMatrix[3].x * 0.8 + instanceMatrix[3].z * 0.6) * 0.035 + sin(uTime * 2.6 + instanceMatrix[3].x * 2.3) * 0.012;
        transformed.x += gs * gh * gh;
        transformed.z += gs * 0.6 * gh * gh;`);
      // keep the scan's light and shade and its cut-out shape, but take the hue from the world it grows on
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `
        vec4 tc = texture2D(map, vMapUv);
        diffuseColor.rgb *= 0.3 + dot(tc.rgb, vec3(0.3, 0.6, 0.1)) * 2.4;
        diffuseColor.a *= tc.a;`);
    };
    tufts.forEach((t, k) => {
      const n = Math.round(job.count * share[k]);
      const mesh = new THREE.InstancedMesh(t.geometry, mat, n);
      for (let i = 0; i < n; i++) {
        const spot = job.at(); // { pos, normal }
        q.setFromUnitVectors(UP, spot.normal).multiply(yaw.setFromAxisAngle(UP, rnd() * Math.PI * 2));
        const h = job.height * (2.3 + rnd() * 1.8);
        m.compose(spot.pos, q, sc.set(h * 0.9, h, h * 0.9));
        mesh.setMatrixAt(i, m);
      }
      mesh.computeBoundingSphere();
      job.group.add(mesh);
    });
  }
}

// a generated stand-in for a project screenshot, drawn in the project colour
function screenTexture(project, index) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 594;
  const g = c.getContext('2d');
  const col = new THREE.Color(project.color);
  const css = (k) => `rgb(${[col.r, col.g, col.b].map((v) => Math.round(clamp(v * k) * 255)).join(',')})`;
  const grd = g.createLinearGradient(0, 0, 1024, 594);
  grd.addColorStop(0, css(0.95));
  grd.addColorStop(1, css(0.35));
  g.fillStyle = grd;
  g.fillRect(0, 0, 1024, 594);
  g.fillStyle = 'rgba(255,255,255,0.94)';
  g.beginPath();
  g.roundRect(150, 90, 724, 414, 14);
  g.fill();
  g.fillStyle = css(0.25);
  g.font = '500 20px sans-serif';
  g.fillText(`${String(index + 1).padStart(2, '0')}  ${project.tag}`, 190, 150);
  g.font = '600 76px sans-serif';
  g.fillText(project.name, 186, 250);
  g.fillStyle = css(0.8);
  g.beginPath();
  g.roundRect(190, 300, 200, 150, 10);
  g.roundRect(410, 300, 200, 150, 10);
  g.roundRect(630, 300, 200, 150, 10);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/* ---------- the world ---------- */

export function createWorld(renderer, onProgress) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#020207');
  scene.fog = new THREE.FogExp2('#04040c', 0.004);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.18;

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 2000);
  scene.add(new THREE.HemisphereLight(0xbfd0ff, 0x120608, 0.35));
  const sunDir = SUN.c.clone().sub(V(0, 0, -200)).normalize(); // sunlight comes from where the Sun is
  const sun = new THREE.DirectionalLight(0xfff0e0, 1.15);
  sun.position.copy(sunDir).multiplyScalar(50);
  scene.add(sun);
  const lamp = (color, intensity, distance, pos) => {
    const l = new THREE.PointLight(color, intensity, distance, 1.6);
    l.position.copy(pos);
    scene.add(l);
    return l;
  };

  /* -- sky: stars that stay with the camera, a sun, and dust along the route -- */
  const stars = (() => {
    const n = 3200, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const d = V(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().multiplyScalar(320 + rnd() * 120);
      pos.set([d.x, d.y, d.z], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: dot(), size: 2.2, color: hot(1.5, 1.5, 1.7), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    pts.frustumCulled = false;
    scene.add(pts);
    return pts;
  })();
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot(128), color: hot(1.6, 1.0, 0.6), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  sunGlow.scale.setScalar(SUN.r * 4);
  sunGlow.position.copy(SUN.c);
  scene.add(sunGlow);
  {
    const count = 11000, pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) pos.set([(rnd() - 0.5) * 60, (rnd() - 0.5) * 34, 20 - rnd() * 1300], i * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const dust = new THREE.Points(geo, new THREE.PointsMaterial({ map: dot(), size: 0.14, color: hot(1.5, 0.9, 0.8), transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
    dust.frustumCulled = false;
    scene.add(dust);
  }

  /* -- the thread -- */
  const threadCurve = new THREE.CatmullRomCurve3(threadPts, false, 'centripetal');
  const threadMat = new THREE.MeshBasicMaterial({ color: hot(2.6, 0.3, 0.18), fog: false, transparent: true });
  const thread = new THREE.Group();
  scene.add(thread);
  thread.add(new THREE.Mesh(new THREE.TubeGeometry(threadCurve, 6000, 0.035, 6), threadMat));
  thread.add(new THREE.Mesh(
    new THREE.TubeGeometry(threadCurve, 3000, 0.09, 6),
    new THREE.MeshBasicMaterial({ color: hot(0.9, 0.05, 0.03), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }),
  ));

  for (const m of thread.children) m.userData.opacity = m.material.opacity;

  /* -- the skies of the worlds you land on (the globes themselves load from Blender) -- */
  for (const pl of Object.values(PLANETS)) {
    const air = atmosphere(pl.r, pl.sky, pl.air);
    air.position.copy(pl.c);
    scene.add(air);
  }
  const cap = (pl, spread = 38) => () => {
    const n = dirOn(pl, (rnd() - 0.5) * 124, (rnd() - 0.5) * spread * 2);
    return { pos: n.clone().multiplyScalar(pl.r - 0.03).add(pl.c), normal: n };
  };
  scene.add(grass({ count: 5600, height: 0.75, tip: '#2fbf5a', at: cap(PLANETS.earth) })); // Earth is the only green one
  scene.add(grass({ count: 2600, height: 0.9, tip: '#ff5a1a', at: cap(PLANETS.mars, 26) })); // a stylised rust meadow on Mars
  lamp(0xfff0d0, 8, 22, onPlanet(PLANETS.earth, 0, 0, 3));
  lamp(0x6bff9a, 26, 14, onPlanet(PLANETS.moon, -8, -15, 1.6));
  lamp(0x1fff70, 30, 24, onPlanet(PLANETS.moon, 14, 10, 4));
  lamp(0xff6a20, 22, 20, onPlanet(PLANETS.mars, 6, 0, 1.6));
  lamp(0xff2a10, 18, 30, onPlanet(PLANETS.mars, -20, -8, 5));
  lamp(0xff5a2a, 16, 30, onPlanet(PLANETS.pluto, 4, 0, 1.6));

  /* -- the gas giant, its ring, and the four screens that orbit it -- */
  const tilted = new THREE.Group(); // everything that shares the giant's tilt
  tilted.position.copy(GIANT.c);
  tilted.rotation.z = GIANT.tilt;
  scene.add(tilted);
  const giantAir = atmosphere(GIANT.r, '#ffd890', 0.5);
  giantAir.position.copy(GIANT.c);
  scene.add(giantAir);
  const belt = new THREE.Group();
  tilted.add(belt);
  const giantLight = lamp(0xffd890, 120, 60, GIANT.c.clone().add(V(0, 22, 12)));

  /* -- the Milky Way, built in Blender (tools/milky_way.py). Hidden until the jump, so the last page is the reveal -- */
  const galaxy = new THREE.Group();
  galaxy.position.copy(GALAXY.c);
  galaxy.rotation.set(rad(58), 0, rad(-14)); // tipped toward him so the spiral shows
  galaxy.visible = false;
  scene.add(galaxy);
  const galaxyMat = new THREE.MeshBasicMaterial({ color: hot(1.7, 1.7, 1.8), transparent: true, opacity: 0, depthWrite: false, fog: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const galaxyGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot(128), color: hot(1.2, 0.9, 0.65), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  galaxyGlow.scale.setScalar(GALAXY.r * 0.6);
  galaxyGlow.position.copy(GALAXY.c);
  galaxyGlow.visible = false;
  scene.add(galaxyGlow);
  new GLTFLoader().load(`${import.meta.env.BASE_URL}models/milkyway.glb`, (g) => {
    const disc = g.scene.getObjectByName('MilkyWay');
    galaxyMat.map = disc.material.map;
    galaxyMat.needsUpdate = true;
    disc.material = galaxyMat;
    disc.scale.setScalar(GALAXY.r);
    galaxy.add(disc);
  });

  /* -- the gate at the start, and the jump to warp near the end -- */
  const gate = new THREE.Group();
  scene.add(gate);
  lamp(0xff5040, 60, 18, V(0, 0, 1));
  const STREAKS = 520;
  const streaks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.03, 1), new THREE.MeshBasicMaterial({ color: hot(3.2, 0.5, 0.3) }), STREAKS);
  const streak = Array.from({ length: STREAKS }, () => {
    const a = rnd() * 6.283, r = 2.6 + rnd() * rnd() * 8;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r, z: rnd() * 280, len: 8 + rnd() * 34, speed: 90 + rnd() * 160 };
  });
  streaks.frustumCulled = false;
  scene.add(streaks);

  /* -- the hero: one rigged character who follows the thread as you scroll -- */
  const hero = (() => {
    const root = new THREE.Group();
    root.visible = false;
    scene.add(root);
    const SCALE = 1.15;
    const N = 9000; // points along the thread, evenly spaced, so index = distance travelled
    const pts = threadCurve.getSpacedPoints(N);
    const stepLen = threadCurve.getLength() / N;
    // turn each named stop into a position along the thread
    let from = 0;
    const stops = STOPS.map(([p, name]) => {
      let best = from, bd = Infinity;
      for (let j = from; j <= N; j++) {
        const d = pts[j].distanceToSquared(marks[name]);
        if (d < bd) { bd = d; best = j; }
      }
      from = best;
      return [p, best];
    });
    const indexAt = (p) => {
      if (p <= stops[0][0]) return stops[0][1];
      let i = 0;
      while (i < stops.length - 2 && p > stops[i + 1][0]) i++;
      return lerp(stops[i][1], stops[i + 1][1], clamp((p - stops[i][0]) / (stops[i + 1][0] - stops[i][0])));
    };
    let mixer = null, run = null, fly = null, idle = null;
    const a = V(0, 0, 0), tan = V(0, 0, 0), up = V(0, 1, 0), n = V(0, 0, 0), fwd = V(0, 0, 1), x = V(1, 0, 0), y = V(0, 1, 0), g = V(0, 0, 0);
    const basis = new THREE.Matrix4();

    function setup(gltf) {
      const model = gltf.scene;
      model.scale.setScalar(SCALE);
      // Anime look: flat bands of light instead of smooth shading, plus an ink outline.
      const bands = new THREE.DataTexture(new Uint8Array([95, 175, 255]), 3, 1, THREE.RedFormat);
      bands.minFilter = bands.magFilter = THREE.NearestFilter;
      bands.needsUpdate = true;
      const ink = new THREE.MeshBasicMaterial({ color: 0x060405, side: THREE.BackSide });
      ink.onBeforeCompile = (sh) => {
        // the outline is the same mesh, pushed out along its normals and drawn inside-out
        sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = vec3(position) + normalize(normal) * 0.0085;');
      };
      const meshes = [];
      model.traverse((o) => o.isMesh && meshes.push(o));
      for (const o of meshes) {
        o.frustumCulled = false;
        const base = o.material.color.clone().multiplyScalar(0.2); // full cartoon colours blow out under these lights
        const dark = o.material.name === 'Hero_Black';
        o.material = new THREE.MeshToonMaterial({ color: base, gradientMap: bands, emissive: base.clone().multiplyScalar(dark ? 0 : 0.55) });
        if (dark || !o.isSkinnedMesh) continue;
        const line = new THREE.SkinnedMesh(o.geometry, ink);
        line.bind(o.skeleton, o.bindMatrix);
        line.frustumCulled = false;
        o.parent.add(line);
      }
      root.add(model);
      mixer = new THREE.AnimationMixer(model);
      const clip = (name) => {
        const found = THREE.AnimationClip.findByName(gltf.animations, name);
        return found ? mixer.clipAction(found) : null;
      };
      run = clip('Run');
      fly = clip('Fly');
      idle = clip('Idle');
      run?.play();
      fly?.play();
      idle?.play();
    }

    function update(p, time) {
      if (!mixer) return;
      // he joins once you are through the gate, and stays to the end
      const appear = smooth(clamp((p - 0.095) / 0.02));
      root.visible = appear > 0.001;

      const k = indexAt(clamp(p));
      const k0 = Math.min(N - 1, Math.floor(k));
      a.copy(pts[k0]).lerp(pts[k0 + 1], k - k0);
      tan.copy(pts[Math.min(N, k0 + 6)]).sub(pts[Math.max(0, k0 - 6)]).normalize();

      // near a planet's surface he lands and runs; anywhere else he flies
      let ground = 0;
      up.copy(UP);
      for (const pl of Object.values(PLANETS)) {
        n.copy(a).sub(pl.c);
        const height = n.length() - pl.r;
        const w = 1 - smooth(clamp((height - 0.55) / 1.7));
        if (w > ground) {
          ground = w;
          n.normalize();
          g.copy(n).multiplyScalar(pl.r + 0.02).add(pl.c); // his feet on the surface
          up.copy(UP).lerp(n, w).normalize(); // "up" is away from the planet's centre
        }
      }
      // face along the thread, but stand square to whatever is underfoot
      fwd.copy(tan).addScaledVector(up, -tan.dot(up) * ground).normalize();
      x.crossVectors(up, fwd).normalize();
      y.crossVectors(fwd, x).normalize();
      root.quaternion.setFromRotationMatrix(basis.makeBasis(x, y, fwd));
      root.position.copy(a).addScaledVector(y, -0.86 * SCALE);
      if (ground > 0) root.position.lerp(g, ground);
      root.scale.setScalar(Math.max(appear, 0.0001));
      out.ground = ground;
      out.ready = true;
      if (!root.visible) return;

      // his stride is tied to distance travelled, so scrolling back runs him backwards
      const dist = k * stepLen;
      run?.setEffectiveWeight(ground);
      const rest = smooth(clamp((p - 0.962) / 0.03)); // the jump is over: he stops and looks
      fly?.setEffectiveWeight((1 - ground) * (1 - rest));
      idle?.setEffectiveWeight(rest);
      if (idle) idle.time = time % idle.getClip().duration;
      if (run) run.time = (((dist * 0.42) % run.getClip().duration) + run.getClip().duration) % run.getClip().duration;
      if (fly) fly.time = (time * 0.7 + dist * 0.05) % fly.getClip().duration;
      mixer.update(0);
    }
    // what the camera and the sound need to know about him
    const out = { setup, update, pos: root.position, fwd, up: y, ground: 0, ready: false };
    return out;
  })();

  // things that need the models
  const anchors = [V(0, 0, 0), V(0, 0, 0), V(0, 0, 0), V(0, 0, 0), V(0, 0, 0)];
  // stand something on a planet: `yaw` 0 faces the way the hero travels, PI faces him as he arrives
  const placeOn = (obj, pl, along, across, yaw, scale = 1, sink = 0.05) => {
    const nrm = dirOn(pl, along, across);
    obj.position.copy(nrm).multiplyScalar(pl.r - sink).add(pl.c);
    obj.quaternion.setFromUnitVectors(UP, nrm).multiply(new THREE.Quaternion().setFromAxisAngle(UP, yaw + Math.atan2(pl.dir.x, pl.dir.z)));
    obj.scale.setScalar(scale);
    scene.add(obj);
    return obj;
  };

  const propsReady = new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(`${import.meta.env.BASE_URL}models/nature.glb`, (nat) => {
      growGrass(nat.scene);
      // two scanned boulders (Poly Haven), darkened to sit in these worlds
      const scans = ['ScanRock_A', 'ScanRock_B'].map((nm) => {
        const o = nat.scene.getObjectByName(nm);
        o.geometry.center();
        o.material.color.setScalar(0.42);
        return o;
      });
      const scanRock = (i) => new THREE.Mesh(scans[i % 2].geometry, scans[i % 2].material);
      loader.load(
        `${import.meta.env.BASE_URL}models/props.glb`,
        (gltf) => {
          // index every part by name first: parts get moved out of this file as they are placed
          const byName = {};
          gltf.scene.traverse((o) => { byName[o.name] = o; });
          const get = (name) => byName[name];
          // metal parts need something to reflect out here
          gltf.scene.traverse((o) => { if (o.isMesh && o.material.metalness > 0.5) o.material.envMapIntensity = 4; });

          // the gate: a ring of boulders the thread passes through
          for (let i = 0; i < 9; i++) {
            const ang = (i / 9) * Math.PI * 2 + 0.4;
            const m = scanRock(i);
            m.position.set(Math.cos(ang) * 3.6, Math.sin(ang) * 3.6, (rnd() - 0.5) * 1.2);
            m.scale.setScalar(0.8 + rnd() * 0.35);
            m.rotation.set(rnd() * 6, rnd() * 6, rnd() * 6);
            m.userData.spin = (rnd() - 0.5) * 0.3;
            gate.add(m);
          }

          // Earth: a few boulders in the grass
          [[-22, -20, 1.4], [6, 22, 1.9], [28, -18, 1.1], [-36, 19, 1.6], [42, 16, 1.3]].forEach(([al, ac, s], i) => placeOn(scanRock(i), PLANETS.earth, al, ac, rnd() * 6, s, 0.25));

          // the Moon: a dead tube monitor still glowing, and headstones
          placeOn(get('CRT'), PLANETS.moon, -8, -15, Math.PI - 0.6, 1.25);
          get('CRT_Screen').material = new THREE.MeshBasicMaterial({ color: hot(0.55, 1.5, 0.8), fog: false });
          const stone = get('Headstone');
          [[0, 15, 0.2, 1.2], [11, 23, -0.3, 1.5], [21, -17, 0.1, 1.3], [-20, 20, 0.4, 1.4], [31, 15, -0.5, 1.1], [-29, -21, 0.3, 1.2]].forEach(([al, ac, yw, s]) =>
            placeOn(new THREE.Mesh(stone.geometry, stone.material), PLANETS.moon, al, ac, Math.PI + yw, s, 0.1));
          [[-38, -24, 1.3], [38, -22, 1.7]].forEach(([al, ac, s], i) => placeOn(scanRock(i), PLANETS.moon, al, ac, rnd() * 6, s, 0.3));

          // Mars: the frame, standing across the path so he runs straight through it
          const frame = placeOn(get('Frame'), PLANETS.mars, 4, drift(4), 0.08, 1, 0.1);
          frame.material.envMapIntensity = 5;
          frame.updateMatrixWorld(true);
          [[-1.15, 2.9, 0], [1.1, 2.7, 0], [1.05, 1.3, 0], [-1.25, 1.4, 0], [0.7, 0.35, 0]].forEach((loc, i) => anchors[i].set(...loc).applyMatrix4(frame.matrixWorld));
          placeOn(scanRock(0), PLANETS.mars, -14, -17, 1, 0.9, 0.2);
          placeOn(scanRock(1), PLANETS.mars, 22, 19, 2, 1.3, 0.3);

          // Saturn: ice and rock in its ring, and four screens in orbit
          const field = new THREE.InstancedMesh(get('Rock_Small').geometry, new THREE.MeshStandardMaterial({ color: '#3a3040', roughness: 0.9 }), 150);
          const mm = new THREE.Matrix4(), qq = new THREE.Quaternion(), ee = new THREE.Euler();
          for (let i = 0; i < 150; i++) {
            const ang = rnd() * 6.283, r = GIANT.r * (1.3 + rnd() * 0.85);
            ee.set(rnd() * 6, rnd() * 6, rnd() * 6);
            const s = 0.06 + rnd() * rnd() * 0.4;
            mm.compose(V(Math.cos(ang) * r, (rnd() - 0.5) * 0.9, Math.sin(ang) * r), qq.setFromEuler(ee), V(s, s, s));
            field.setMatrixAt(i, mm);
          }
          belt.add(field);
          const monitor = get('Monitor');
          const tex = new THREE.TextureLoader();
          projects.forEach((project, i) => {
            const m = monitor.clone(true);
            // where around Saturn the hero is when this project comes up, so any number of projects space themselves out
            const pMid = WORK[0] + ((i + 0.5) / projects.length) * (WORK[1] - WORK[0]);
            const pIn = STOPS.find((k) => k[1] === 'giantIn')[0];
            const pOut = STOPS.find((k) => k[1] === 'giantOut')[0];
            const deg = -35 + 285 * ((pMid - pIn) / (pOut - pIn)) + 2;
            m.position.copy(aroundGiant(deg, 19.5, -4.2));
            m.lookAt(aroundGiant(deg - 14, 40, 0.5)); // face outward, turned a little toward the camera that follows him
            m.scale.setScalar(4.4); // big enough to read from where the camera flies
            m.traverse((o) => {
              if (!o.isMesh || !o.name.includes('Screen')) return;
              const map = project.image ? tex.load(project.image) : screenTexture(project, i);
              map.colorSpace = THREE.SRGBColorSpace;
              map.flipY = false; // models exported from Blender use flipped V
              o.material = new THREE.MeshBasicMaterial({ map, color: hot(0.8, 0.8, 0.8), fog: false });
            });
            scene.add(m);
          });

          // Pluto: the door of light, standing across the path so he runs through it
          placeOn(get('Door'), PLANETS.pluto, 0, drift(0), Math.PI, 1.4, 0.05);
          get('Door_Light').material = new THREE.MeshBasicMaterial({ color: hot(1.5, 0.6, 0.34), side: THREE.DoubleSide, fog: false });
          [[-30, 21, 1.5], [22, -22, 1.2], [38, 19, 1.8]].forEach(([al, ac, s], i) => placeOn(scanRock(i + 1), PLANETS.pluto, al, ac, rnd() * 6, s, 0.3));

          new GLTFLoader().load(`${import.meta.env.BASE_URL}models/hero_v2.glb`, (h) => {
            hero.setup(h);
            resolve();
          }, undefined, reject);
        },
        (e) => e.total && onProgress?.(e.loaded / e.total),
        reject,
      );
    }, undefined, reject);
  });

  // the solar system, built in Blender
  const solarReady = new Promise((resolve, reject) => {
    new GLTFLoader().load(`${import.meta.env.BASE_URL}models/solar.glb`, (sol) => {
      const parts = {};
      sol.scene.traverse((o) => { parts[o.name] = o; });
      const body = (name, centre, radius, parent = scene, spin = 0.004) => {
        const o = parts[name];
        o.material.roughness = 1;
        o.material.metalness = 0;
        o.material.color.setScalar(0.72); // keeps bright clouds and ice from blowing out
        o.material.fog = false; // planets stay visible however far away they are
        o.position.copy(centre);
        o.scale.setScalar(radius);
        o.userData.spin = spin;
        parent.add(o);
        return o;
      };
      // the four you land on do not spin: things stand on them
      for (const [key, name] of [['earth', 'Earth'], ['moon', 'Moon'], ['mars', 'Mars'], ['pluto', 'Pluto']]) {
        const o = body(name, PLANETS[key].c, PLANETS[key].r);
        o.rotation.set(rnd(), rnd() * 6, rnd());
      }
      // Saturn and its ring share one tilt
      spinning.push(body('Saturn', V(0, 0, 0), GIANT.r, tilted, 0.01));
      const ring = parts.SaturnRing;
      ring.scale.setScalar(GIANT.r);
      ring.material.side = THREE.DoubleSide;
      ring.material.depthWrite = false;
      ring.material.fog = false;
      tilted.add(ring);
      for (const [name, centre, radius, sky] of FLYBY) {
        spinning.push(body(name, centre, radius, scene, 0.012));
        if (sky) {
          const air = atmosphere(radius, sky, 0.5);
          air.position.copy(centre);
          scene.add(air);
        }
      }
      // the Sun shines by itself
      const star = parts.Sun;
      star.material = new THREE.MeshBasicMaterial({ map: star.material.map, color: hot(1.5, 1.0, 0.62), fog: false });
      star.position.copy(SUN.c);
      star.scale.setScalar(SUN.r);
      star.userData.spin = 0.006;
      scene.add(star);
      spinning.push(star);
      resolve();
    }, undefined, reject);
  });
  const ready = Promise.all([propsReady, solarReady]);

  /* ---------- per-frame ---------- */

  const posCurve = new THREE.CatmullRomCurve3(CAM.map((k) => k[1]));
  const lookCurve = new THREE.CatmullRomCurve3(CAM.map((k) => k[2]));
  const pos = V(0, 0, 0), look = V(0, 0, 0);
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), s4 = V(1, 1, 1), p4 = V(0, 0, 0);
  const tmpColor = new THREE.Color(), violet = new THREE.Color('#ffd890');
  const state = { project: -1, fly: 0 };
  const spinning = []; // planets that turn slowly

  // Chase camera. Where it sits relative to the hero at each point of the scroll:
  // [scroll, metres behind, metres above, metres to the side, how far ahead it looks, pull toward the giant]
  const CHASE = [
    [0.1, 6, 1.8, 0.9, 3, 0],
    [0.17, 4.6, 1.7, -1.4, 3, 0],
    [0.24, 8, 2.6, 2.2, 5, 0],
    [0.31, 4.4, 1.6, 1.4, 3, 0],
    [0.39, 8, 2.6, -2.2, 5, 0],
    [0.47, 4.8, 1.7, -1.4, 3, 0],
    [0.55, 9, 3, 0, 6, 0],
    [0.6, 7, 1.6, 5.4, 2, 0.42],
    [0.76, 7, 1.6, 5.4, 2, 0.42],
    [0.8, 7, 2.4, -1.5, 5, 0],
    [0.85, 4.6, 1.6, 1.2, 4, 0],
    [0.9, 5, 1.4, 0, 6, 0],
    [0.955, 5, 1, 0, 8, 0],
    [1.0, 5.2, 0.5, -2.6, 60, 0], // behind his shoulder, looking out at the galaxy with him
  ];
  const chase = [0, 0, 0, 0, 0];
  function chaseAt(p) {
    let i = 0;
    while (i < CHASE.length - 2 && p > CHASE[i + 1][0]) i++;
    const t = smooth(clamp((p - CHASE[i][0]) / (CHASE[i + 1][0] - CHASE[i][0])));
    for (let k = 0; k < 5; k++) chase[k] = lerp(CHASE[i][k + 1], CHASE[i + 1][k + 1], t);
    return chase;
  }
  const sideV = V(0, 0, 0), want = V(0, 0, 0), aim = V(0, 0, 0), tmp = V(0, 0, 0), lastFwd = V(0, 0, 1);
  const camPos = V(0, 0, 0), camLook = V(0, 0, 0), camUp = V(0, 1, 0);
  let camInit = false, lastTime = 0, bank = 0;

  function update(p, time, pointer, still) {
    const dt = clamp(time - lastTime, 0, 1);
    lastTime = time;
    const tt = still ? 0 : time;
    hero.update(p, tt);
    state.fly = 1 - hero.ground;
    state.project = p > WORK[0] && p < WORK[1] ? Math.min(projects.length - 1, Math.floor(((p - WORK[0]) / (WORK[1] - WORK[0])) * projects.length)) : -1;

    // camera: opens on its own approach to the gate, then drops in behind the hero and chases him along the thread
    const u = clamp(p / CAM[CAM.length - 1][0]);
    posCurve.getPoint(u, pos);
    lookCurve.getPoint(u, look);
    const join = hero.ready ? smooth(clamp((p - 0.085) / 0.05)) : 0;
    if (join > 0) {
      const c = chaseAt(p);
      sideV.crossVectors(hero.fwd, hero.up).normalize();
      let sign = 1;
      if (c[4] > 0) sign = Math.sign(sideV.dot(tmp.copy(hero.pos).sub(GIANT.c))) || 1; // stay outside the ring
      want.copy(hero.pos).addScaledVector(hero.fwd, -c[0]).addScaledVector(sideV, c[2] * sign).addScaledVector(hero.up, c[1] + (1 - hero.ground) * 0.6);
      aim.copy(hero.pos).addScaledVector(hero.fwd, c[3]).addScaledVector(hero.up, 1.0);
      aim.lerp(GIANT.c, c[4]);
      // it trails a little behind its target, so it swings through the turns instead of being bolted on
      const far = !camInit || camPos.distanceToSquared(want) > 40000 || still;
      camPos.lerp(want, far ? 1 : 1 - Math.exp(-dt * 3.4));
      camLook.lerp(aim, far ? 1 : 1 - Math.exp(-dt * 5.5));
      camUp.lerp(hero.up, far ? 1 : 1 - Math.exp(-dt * 2.5)).normalize(); // the horizon tips as he rounds a planet
      camInit = true;
      pos.lerp(camPos, join);
      look.lerp(camLook, join);
    }
    camera.up.copy(UP).lerp(camUp, join).normalize();
    camera.position.copy(pos);
    camera.lookAt(look);
    camera.translateX(pointer.x * 0.28);
    camera.translateY(-pointer.y * 0.18);
    // bank into the turns while travelling
    const turn = tmp.crossVectors(lastFwd, hero.fwd).dot(hero.up);
    lastFwd.copy(hero.fwd);
    bank += (clamp(-turn * 7, -0.32, 0.32) - bank) * (1 - Math.exp(-dt * 4));
    if (!still) camera.rotateZ(bank * join + Math.sin(time * 0.3) * 0.012);

    // mood
    let i = 0;
    while (i < MOOD.length - 2 && p > MOOD[i + 1][0]) i++;
    const t = smooth(clamp((p - MOOD[i][0]) / (MOOD[i + 1][0] - MOOD[i][0])));
    scene.background.lerpColors(MOOD[i][1], MOOD[i + 1][1], t);
    scene.fog.color.lerpColors(MOOD[i][2], MOOD[i + 1][2], t);
    scene.fog.density = lerp(MOOD[i][3], MOOD[i + 1][3], t);

    grassTime.value = tt;
    threadMat.color.setRGB(2.6 + Math.sin(tt * 2.2) * 0.4, 0.3, 0.18);
    stars.position.copy(camera.position);

    gate.rotation.z = tt * 0.03;
    for (const r of gate.children) r.rotation.x += r.userData.spin * 0.01 * (still ? 0 : 1);
    belt.rotation.y = tt * 0.006;
    for (const b of spinning) b.rotation.y = tt * b.userData.spin;
    if (galaxy.children[0]) galaxy.children[0].rotation.y = tt * 0.004;
    // the galaxy stays hidden until the jump, so the last page is the reveal
    const reveal = smooth(clamp((p - 0.9) / 0.07));
    galaxy.visible = galaxyGlow.visible = reveal > 0;
    galaxyMat.opacity = reveal;
    galaxyGlow.material.opacity = reveal * 0.7;
    // and on that last page the thread lets go: it fades out and leaves him with the view
    const gone = smooth(clamp((p - 0.955) / 0.035));
    thread.visible = gone < 1;
    for (const m of thread.children) m.material.opacity = m.userData.opacity * (1 - gone);

    // the jump: streaks rush past between the last planet and the end
    if (p > 0.885 && p < 0.972) {
      for (let k = 0; k < STREAKS; k++) {
        const s = streak[k];
        const f = ((s.z + tt * s.speed) % 280) / 280;
        m4.compose(p4.set(lerp(7, 0, f) + s.x, 4 + s.y, -905 - f * 280), q4, s4.set(1, 1, s.len));
        streaks.setMatrixAt(k, m4);
      }
      streaks.instanceMatrix.needsUpdate = true;
      streaks.visible = true;
    } else streaks.visible = false;
  }

  // world point -> screen pixels, for the HTML tags pinned to the frame
  const proj = V(0, 0, 0);
  function toScreen(v, w, h) {
    proj.copy(v).project(camera);
    return { x: (proj.x * 0.5 + 0.5) * w, y: (-proj.y * 0.5 + 0.5) * h, visible: proj.z < 1 };
  }

  return { scene, camera, update, ready, state, anchors, toScreen };
}
