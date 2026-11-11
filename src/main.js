import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createWorld } from './world.js';
import { createAudio } from './audio.js';
import { site, intro, chapters, footer, projects } from './content.js';
import './style.css';

const $ = (id) => document.getElementById(id);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const pad = (n) => String(n).padStart(2, '0');
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;

/* ---------- renderer and lens effects ---------- */

const renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: false, powerPreference: 'high-performance' });
let quality = Math.min(devicePixelRatio, 1.5);
renderer.setPixelRatio(quality);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const world = createWorld(renderer, (f) => setLoad(f * 0.9));

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(world.scene, world.camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.6, 0.6, 0.9);
composer.addPass(bloom);
// colour fringing toward the edges, a vignette and film grain
const lens = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAmount: { value: 0.05 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uAmount; varying vec2 vUv;
    void main() {
      vec2 d = vUv - 0.5;
      float r2 = dot(d, d);
      vec2 o = d * r2 * uAmount;
      vec3 c = vec3(texture2D(tDiffuse, vUv + o).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - o).b);
      c *= 1.0 - r2 * 1.15;
      float n = fract(sin(dot(vUv * vec2(1920.0, 1080.0) + uTime * 61.0, vec2(12.9898, 78.233))) * 43758.5453);
      c += (n - 0.5) * 0.05;
      gl_FragColor = vec4(c, 1.0);
    }`,
});
composer.addPass(lens);
composer.addPass(new OutputPass());

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  world.camera.aspect = w / h;
  world.camera.fov = w < h ? 62 : 42; // wider lens on phones so the scenes still fit
  world.camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

/* ---------- interface ---------- */

const ui = {
  intro: $('intro'),
  chapter: $('chapter'),
  work: $('work-labels'),
  tags: $('frame-tags'),
  footer: $('footer'),
  cue: $('cue'),
};
let indexItems = [];
let workItems = [];
let tagItems = [];

function build() {
  $('mark-name').textContent = site.name;
  if (site.photo) {
    const img = new Image();
    img.src = site.photo;
    img.alt = '';
    $('mark-initials').replaceWith(img);
  } else $('mark-initials').textContent = site.initials;
  $('count-all').textContent = pad(chapters.length);
  $('intro-kicker').textContent = intro.kicker;
  $('intro-title').textContent = intro.title;
  $('status-text').textContent = site.status.text;
  $('status-link').textContent = site.status.link;
  $('status-link').href = site.status.href;

  indexItems = chapters.map((c, i) => {
    const li = el('li');
    const b = el('button');
    b.dataset.jump = c.from + 0.012;
    b.append(el('small', 'mono', pad(i + 1)), el('span', '', c.label));
    li.append(b);
    $('index-list').append(li);
    return b;
  });

  workItems = projects.map((pr, i) => {
    const b = el('button', 'wl');
    b.style.setProperty('--pc', pr.color);
    const row = el('span', 'wl-row mono');
    row.append(el('span', 'wl-num', pad(i + 1)), el('span', 'wl-rule'), el('span', 'wl-tag', pr.tag));
    b.append(row, el('span', 'wl-name', pr.name), el('span', 'wl-cta mono', 'View work ↗'));
    b.addEventListener('click', () => openWork(i));
    ui.work.append(b);
    return b;
  });

  tagItems = site.skills.map((s, i) => {
    const t = el('div', `ft-tag ${i % 2 ? 'r' : 'l'}`);
    t.append(el('i', 'ft-dot'), el('i', 'ft-lead'), el('span', 'mono', s));
    ui.tags.append(t);
    return t;
  });

  $('ft-kick').textContent = footer.kicker;
  $('ft-title').textContent = footer.title;
  $('ft-soft').textContent = footer.titleSoft;
  $('ft-mail').textContent = `${site.email} →`;
  $('ft-mail').href = `mailto:${site.email}`;
  $('ft-links').replaceChildren(
    ...site.links.map((l) => Object.assign(el('a', '', `${l.label} ↗`), { href: l.href })),
  );
  $('ft-copy').textContent = `© ${site.year} ${site.name}`;
  $('pill').href = `mailto:${site.email}`;

  document.addEventListener('click', (e) => {
    const j = e.target.closest('[data-jump]');
    if (!j) return;
    scrollTo({ top: Number(j.dataset.jump) * (root.scrollHeight - innerHeight), behavior: reduced ? 'auto' : 'smooth' });
  });
}

// project pop-up
const modal = $('work-modal');
function openWork(i) {
  const pr = projects[i];
  modal.style.setProperty('--pc', pr.color);
  $('wm-tag').textContent = `${pad(i + 1)} · ${pr.tag}`;
  $('wm-title').textContent = pr.name;
  $('wm-desc').textContent = pr.blurb;
  const stage = $('wm-stage');
  stage.replaceChildren();
  if (pr.image) stage.append(Object.assign(new Image(), { src: pr.image, alt: pr.name }));
  else stage.append(el('p', 'mono', 'Project media goes here'));
  const meta = $('wm-meta');
  meta.replaceChildren(el('dt', '', 'Role'), el('dd', '', pr.role), el('dt', '', 'Stack'), el('dd', '', pr.stack ?? ''));
  if (pr.href) {
    const link = Object.assign(el('a', '', 'Visit the live site ↗'), { href: pr.href, target: '_blank', rel: 'noopener' });
    const dd = el('dd');
    dd.append(link);
    meta.append(el('dt', '', 'Link'), dd);
  }
  modal.showModal();
}
$('wm-close').addEventListener('click', () => modal.close());
modal.addEventListener('click', (e) => e.target === modal && modal.close());

// chapter words: fade out, change, fade in
let shownChapter = -1;
let swapTimer = 0;
function showChapter(idx) {
  if (idx === shownChapter) return;
  shownChapter = idx;
  ui.chapter.classList.remove('on');
  clearTimeout(swapTimer);
  if (idx < 0) return;
  swapTimer = setTimeout(
    () => {
      const c = chapters[idx];
      $('ch-num').textContent = pad(idx + 1);
      $('ch-title').textContent = c.title;
      $('ch-line').textContent = c.line ?? '';
      $('ch-stats').replaceChildren(
        ...(c.stats ?? []).map((s) => {
          const d = el('div');
          d.append(el('dt', '', s.value), el('dd', 'mono', s.label));
          return d;
        }),
      );
      ui.chapter.classList.add('on');
    },
    reduced ? 0 : 320,
  );
}

let shownProject = -2;
function showProject(i) {
  if (i === shownProject) return;
  shownProject = i;
  workItems.forEach((w, k) => {
    w.classList.toggle('on', k === i);
    w.inert = k !== i;
  });
}

let counted = -2;
function showCount(i) {
  if (i === counted) return;
  counted = i;
  $('count-now').textContent = pad(i + 1);
  indexItems.forEach((b, k) => b.classList.toggle('on', k === i));
  $('rail-now').textContent = i >= 0 ? `${pad(i + 1)} ${chapters[i].label}` : '';
}

/* ---------- sound: the song, filtered and shaped by the journey (see audio.js) ---------- */

const audio = createAudio({ src: site.music, button: $('sound-btn') });

/* ---------- loader ---------- */

function setLoad(f) {
  $('loader-fill').style.transform = `scaleX(${f})`;
  $('loader-p').textContent = String(Math.round(f * 100)).padStart(3, '0');
}
$('loader-enter').addEventListener('click', (e) => {
  const b = e.target.closest('[data-enter]');
  if (!b) return;
  audio.enter(b.dataset.enter === 'sound');
  root.classList.remove('gate');
  $('loader').classList.add('done');
});

/* ---------- cursor ---------- */

const cursor = $('cursor');
const pointer = { x: 0, y: 0, sx: 0, sy: 0, px: -100, py: -100 };
let cursorHot = false, cursorOn = false;
addEventListener('pointermove', (e) => {
  pointer.x = (e.clientX / innerWidth) * 2 - 1;
  pointer.y = (e.clientY / innerHeight) * 2 - 1;
  cursor.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
  const hot = !!e.target.closest?.('a, button');
  if (hot !== cursorHot) cursor.classList.toggle('hot', (cursorHot = hot));
  const mouse = e.pointerType === 'mouse';
  if (mouse !== cursorOn) cursor.classList.toggle('show', (cursorOn = mouse));
});

/* ---------- frame loop ---------- */

let frames = 0, fpsSince = performance.now();
let p = 0;
let last = 0;
const clock = new THREE.Clock();
const inRange = (r) => r && p >= r[0] && p <= r[1];

function frame() {
  const time = clock.getElapsedTime();
  const dt = Math.min(time - last, 1);
  last = time;
  const max = root.scrollHeight - innerHeight;
  const target = max > 0 ? clamp(scrollY / max) : 0;
  const before = p;
  p = reduced ? target : p + (target - p) * (1 - Math.exp(-dt * 3.0));
  const speed = dt > 0 ? Math.abs(p - before) / dt : 0;
  const k = 1 - Math.exp(-dt * 5);
  pointer.sx += (pointer.x - pointer.sx) * k;
  pointer.sy += (pointer.y - pointer.sy) * k;

  world.update(p, time, { x: pointer.sx, y: pointer.sy }, reduced);

  // which words are on screen
  let count = -1;
  let words = -1;
  chapters.forEach((c, i) => {
    if (p >= c.starts) count = i;
    if (p >= c.from && p <= c.to) words = i;
  });
  const atEnd = p >= footer.from;
  showCount(count);
  showChapter(atEnd ? -1 : words);
  ui.intro.classList.toggle('on', p < 0.02);
  ui.cue.classList.toggle('on', p < 0.02);
  ui.footer.classList.toggle('on', atEnd);
  ui.footer.inert = !atEnd;
  const workChapter = chapters.find((c) => c.work);
  showProject(inRange(workChapter?.work) ? world.state.project : -1);
  $('rail-fill').style.transform = `scaleY(${p})`;
  $('rail-now').style.top = `${p * 100}%`;

  // skill tags pinned to the frame in the red field
  const tagsOn = inRange(chapters.find((c) => c.tags)?.tags);
  ui.tags.classList.toggle('on', !!tagsOn);
  if (tagsOn) {
    tagItems.forEach((t, i) => {
      const s = world.toScreen(world.anchors[i % world.anchors.length], innerWidth, innerHeight);
      t.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`;
    });
  }


  // the faster you travel, the more the lens smears
  lens.uniforms.uTime.value = reduced ? 0 : time;
  lens.uniforms.uAmount.value = 0.05 + Math.min(speed * 4.4, 0.35);
  // stage for the sound: 0 = intro, 1..6 = chapters, plus how far through the current one
  const from = count < 0 ? 0 : chapters[count].starts;
  const to = count + 1 < chapters.length ? chapters[count + 1].starts : 1;
  audio.update({
    stage: count + 1 + clamp((p - from) / (to - from)),
    speed: Math.min(1, speed * 28),
    fly: world.state.fly,
    modal: modal.open,
    footer: clamp((p - footer.from) / (1 - footer.from)),
    tags: !!tagsOn,
    project: shownProject,
    door: p > 0.855 && p < 0.9,
  });

  composer.render();

  // every 90 frames, check the frame rate and lower the resolution a step if it is struggling
  frames++;
  if (frames === 90) {
    const fps = 90000 / (performance.now() - fpsSince);
    if (fps < 42 && quality > 0.75 && !document.hidden) {
      quality = Math.max(0.75, quality - 0.25);
      renderer.setPixelRatio(quality);
      resize();
    }
    frames = 0;
    fpsSince = performance.now();
  }
  requestAnimationFrame(frame);
}

/* ---------- start ---------- */

build();
resize();
world.ready
  .then(() => {
    setLoad(1);
    $('loader-k').textContent = 'Best with headphones';
    $('loader-enter').hidden = false;
    frame();
  })
  .catch((err) => {
    console.error(err);
    $('loader-k').textContent = 'The 3D models failed to load';
  });
