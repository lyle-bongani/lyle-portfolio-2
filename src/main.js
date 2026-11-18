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
  if (site.also) {
    const a = Object.assign(el('a', '', site.also.link), { href: site.also.href, target: '_blank', rel: 'noopener' });
    $('status-also').replaceChildren(' · ' + site.also.text + ' ', a);
  }

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
    const cta = el('span', 'wl-cta');
    cta.append(el('span', '', 'Open case study'), el('span', 'wl-go', '→'));
    b.append(row, el('span', 'wl-name', pr.name), cta, el('span', 'wl-hint mono', 'or click the screen'));
    b.addEventListener('click', (e) => openWork(i, e.detail ? { x: e.clientX, y: e.clientY } : null));
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

// project case study: a full page over the trip, opened from wherever you clicked
const modal = $('work-modal');
const csScroll = $('cs-scroll');
let openIndex = -1;
const wrap = (i) => (i + projects.length) % projects.length;
const domain = (href) => href.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
function liveLink(pr, cls, text) {
  return Object.assign(el('a', cls, text), { href: pr.href, target: '_blank', rel: 'noopener' });
}
// dark text on light project colours, light text on dark ones
function inkFor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.22 ? '#0b0809' : '#fff';
}
function fillWork(i) {
  i = wrap(i);
  openIndex = i;
  const pr = projects[i];
  const st = pr.study ?? {};
  modal.style.setProperty('--pc', pr.color);
  modal.style.setProperty('--pc-ink', inkFor(pr.color));
  $('wm-count').textContent = `${pad(i + 1)} / ${pad(projects.length)}`;
  $('wm-tag').textContent = pr.tag;
  $('wm-num').textContent = `Case study ${pad(i + 1)}`;
  $('wm-name').textContent = pr.name;
  $('wm-desc').textContent = pr.blurb;
  $('wm-live').replaceChildren(...(pr.href ? [liveLink(pr, 'cs-visit', 'Visit the live site ↗')] : []));

  const meta = [['Type', pr.tag], ['Role', pr.role], ['Built with', pr.stack], ['Live', pr.href ? domain(pr.href) : '']];
  $('wm-meta').replaceChildren(
    ...meta.filter((m) => m[1]).map(([k, v]) => {
      const d = el('div');
      d.append(el('dt', 'mono', k), el('dd', '', v));
      return d;
    }),
  );

  // the screenshot sits in a browser window, and opens the live site
  const stage = $('wm-stage');
  stage.replaceChildren();
  const win = pr.href ? liveLink(pr, 'cs-win', '') : el('div', 'cs-win');
  const chrome = el('span', 'cs-chrome');
  chrome.append(el('i'), el('i'), el('i'), el('span', 'cs-url mono', pr.href ? domain(pr.href) : pr.name));
  win.append(chrome);
  if (pr.image) win.append(Object.assign(new Image(), { src: pr.image, alt: `${pr.name} home page`, decoding: 'async' }));
  if (pr.href) win.setAttribute('aria-label', `Open ${pr.name} in a new tab`);
  stage.append(win);

  $('wm-brief').textContent = st.brief ?? pr.blurb;
  $('wm-facts').replaceChildren(
    ...(pr.facts ?? []).map((f) => {
      const d = el('div');
      d.append(el('dt', '', f.value), el('dd', 'mono', f.label));
      return d;
    }),
  );
  $('wm-built').replaceChildren(
    ...(st.built ?? []).map((t, k) => {
      const li = el('li');
      li.append(el('span', 'mono', pad(k + 1)), el('p', '', t));
      return li;
    }),
  );
  $('wm-result').textContent = st.result ?? '';
  $('wm-result').parentElement.hidden = !st.result;

  const nx = projects[wrap(i + 1)];
  $('wm-next-name').textContent = nx.name;
  $('wm-next-tag').textContent = nx.tag;
  $('wm-next-card').style.setProperty('--nc', nx.color);
  $('wm-next-img').style.backgroundImage = nx.image ? `url("${nx.image}")` : '';
  csScroll.scrollTop = 0;
}
function openWork(i, from) {
  fillWork(i);
  const x = from?.x ?? innerWidth / 2, y = from?.y ?? innerHeight / 2;
  modal.style.setProperty('--ox', `${x}px`);
  modal.style.setProperty('--oy', `${y}px`);
  if (!modal.open) {
    modal.classList.remove('closing');
    modal.showModal();
    $('wm-close').focus({ preventScroll: true });
  }
}
// switching project inside the page: a quick fade instead of re-opening
function switchWork(i) {
  if (reduced) return fillWork(i);
  csScroll.classList.add('swap');
  setTimeout(() => {
    fillWork(i);
    csScroll.classList.remove('swap');
  }, 220);
}
function closeWork() {
  if (!modal.open || modal.classList.contains('closing')) return;
  if (reduced) return modal.close();
  modal.classList.add('closing');
  setTimeout(() => {
    modal.close();
    modal.classList.remove('closing');
  }, 480);
}
$('wm-close').addEventListener('click', closeWork);
$('wm-prev').addEventListener('click', () => switchWork(openIndex - 1));
$('wm-next').addEventListener('click', () => switchWork(openIndex + 1));
$('wm-next-card').addEventListener('click', (e) => {
  e.preventDefault();
  switchWork(openIndex + 1);
});
$('wm-next-card').href = '#';
modal.addEventListener('cancel', (e) => {
  e.preventDefault(); // Esc: play the closing animation first
  closeWork();
});
modal.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') switchWork(openIndex + 1);
  if (e.key === 'ArrowLeft') switchWork(openIndex - 1);
});

// the screens around Saturn are clickable too
const overUI = (t) => !!t?.closest?.('a, button, dialog, #loader, .footer.on');
let screenUnder = -1;
function screenAt(clientX, clientY) {
  if (shownProject < 0) return -1; // only while the projects are on show
  return world.pick((clientX / innerWidth) * 2 - 1, (clientY / innerHeight) * 2 - 1);
}
addEventListener('click', (e) => {
  if (modal.open || overUI(e.target)) return;
  const i = screenAt(e.clientX, e.clientY);
  if (i >= 0) openWork(i, { x: e.clientX, y: e.clientY });
});

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
  pointer.cx = e.clientX;
  pointer.cy = e.clientY;
  pointer.target = e.target;
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
  // hovering a project screen: it lights up, and the cursor says what a click does
  const under = !modal.open && pointer.target && !overUI(pointer.target) ? screenAt(pointer.cx, pointer.cy) : -1;
  if (under !== screenUnder) {
    screenUnder = under;
    world.highlight(under);
    cursor.classList.toggle('view', under >= 0);
    root.classList.toggle('over-screen', under >= 0);
  }
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
    $('loader-k').textContent = 'The 3D worlds did not load. Check your connection and try again.';
    const again = el('button', 'enter-btn on', 'Try again');
    again.addEventListener('click', () => location.reload());
    $('loader-enter').replaceChildren(again);
    $('loader-enter').hidden = false;
  });
