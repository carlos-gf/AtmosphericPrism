/* Kaleidoscope booth demo — VRSJ 2026, Histogram Perfect.

   A triangular mirror prism stands on the iPad. Under it the screen shows one
   RPCA image; the mirrors turn that triangle into an endless space. Outside the
   prism the visitor is asked what atmosphere it is, picks one of four, and the
   source photograph is then revealed inside the prism itself.

   Three things are load-bearing and easy to break:

   - The triangle is sized in MILLIMETRES, not pixels, because it has to sit
     exactly under a real 160 mm prism. See layout().
   - Every image is decoded before the demo starts. Decoding a 900 x 900 JPEG
     mid-interaction drops frames badly enough that people think it is broken.
   - Nothing outside the triangle may be bright. Stray light enters the prism
     and shows up as a glowing edge in the reflections. */

import { SCENES } from './scenes.js';

/* ---------------- constants ---------------- */

const SIDE_MM_DEFAULT = 160;      // the prism Carlos actually has
const PPI_DEFAULT     = 264;      // iPad Pro 11", all generations
const ROOT3_2         = Math.sqrt(3) / 2;

const IDLE_AFTER_ANSWER = 40000;  // move on so the next person sees a question
const IDLE_RESET        = 120000; // nobody is here: start a fresh sequence

const CAL_KEY = 'hp.kaleido.cal.v1';
const LOG_KEY = 'hp.kaleido.log.v1';
const LOG_MAX = 5000;

const $ = id => document.getElementById(id);

/* ---------------- state ---------------- */

let cal = {
  sideMm: SIDE_MM_DEFAULT,
  ppi: PPI_DEFAULT,
  top: 20,        // css px from the top of the screen
  left: 0,        // css px, nudge from centred
  flip: false,    // false = apex up
  outline: false,
};

let order = [];        // indices into SCENES, shuffled per visitor
let pos = 0;           // where we are in `order`
let answered = false;
let shownAt = 0;       // performance.now() when the current image appeared
let front = 'A';       // which of the two <img> is currently visible
let sessionId = newId();
let idleTimer = null;
let resetTimer = null;
let attractTimer = null;

/* ---------------- geometry ---------------- */

/* The prism is a physical object, so the triangle on screen has to be a
   physical size. CSS pixels are device pixels divided by devicePixelRatio, so
   one millimetre is (ppi / 25.4) / dpr CSS pixels — 5.197 on an iPad Pro 11".
   160 mm then lands at 831.5 CSS px, which is all but 2 px of the 834 px
   screen. That is why the triangle is clamped: on any other screen it would
   simply run off the edge. */
function layout() {
  const dpr = window.devicePixelRatio || 1;
  const pxPerMm = (cal.ppi / 25.4) / dpr;

  const want = cal.sideMm * pxPerMm;
  const side = Math.min(want, window.innerWidth);
  const triH = side * ROOT3_2;

  const left = Math.round((window.innerWidth - side) / 2 + cal.left);

  const s = document.documentElement.style;
  s.setProperty('--side', side + 'px');
  s.setProperty('--tri-h', triH + 'px');
  s.setProperty('--tri-top', cal.top + 'px');
  s.setProperty('--tri-left', left + 'px');

  document.body.classList.toggle('flip', cal.flip);
  drawOutline(left, cal.top, side, triH);

  return { side, triH, clamped: want > side };
}

/* A guide to physically align the prism: turn it on, stand the prism on the
   glass, nudge until the mirrors sit on the gold line, turn it off. */
function drawOutline(left, top, side, h) {
  const svg = $('outline');
  svg.hidden = !cal.outline;
  if (!cal.outline) return;

  const r = left + side, b = top + h;
  const pts = cal.flip
    ? `${left},${top} ${r},${top} ${left + side / 2},${b}`
    : `${left + side / 2},${top} ${r},${b} ${left},${b}`;
  svg.querySelector('polygon').setAttribute('points', pts);
}

/* ---------------- image addresses ---------------- */

/* Normally these are files under img/. The standalone build (one HTML file you
   can AirDrop to the iPad and open with no server at all) injects the same
   pictures as data URIs into window.HP_INLINE instead, and everything below
   carries on unchanged. */
function srcOf(id, kind) {
  const inline = self.HP_INLINE;
  const key = `${id}_${kind}`;
  return (inline && inline[key]) || `img/${key}.jpg`;
}

const urls = [];
for (const s of SCENES) urls.push(srcOf(s.id, 'rpca'), srcOf(s.id, 'src'), srcOf(s.id, 'thumb'));

/* Nothing here may be able to hang. An iPad that sits on "loading" forever is
   worse than one that starts with a missing picture: the images are only ever
   pre-warmed here, and every one of them is requested again by the demo itself,
   so a slow or failed decode costs a moment of blur, not the demo. */
function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise(res => setTimeout(res, ms))]);
}

async function preload() {
  const bar = $('loadbar').firstElementChild;
  const text = $('loadtext');
  let done = 0;

  // whatever happens below, the demo becomes startable
  const watchdog = setTimeout(ready, 25000);

  await Promise.all(urls.map(async url => {
    const img = new Image();
    img.src = url;
    const settled = img.decode
      ? img.decode()
      : new Promise(res => { img.onload = img.onerror = res; });
    try { await withTimeout(settled, 8000); } catch { /* keep going */ }
    done++;
    bar.style.width = Math.round((done / urls.length) * 100) + '%';
    text.textContent = `${done} of ${urls.length}`;
  }));

  clearTimeout(watchdog);
  ready();

  function ready() {
    text.textContent = 'ready';
    $('begin').hidden = false;
  }
}

/* ---------------- the demo ---------------- */

function shuffle(a) {
  const out = a.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function newSequence() {
  order = shuffle(SCENES.map((_, i) => i));
  pos = 0;
  sessionId = newId();
  buildDots();
}

function buildDots() {
  $('dots').innerHTML = SCENES.map(() => '<i></i>').join('');
}

function markDots() {
  const dots = $('dots').children;
  for (let i = 0; i < dots.length; i++) {
    dots[i].className = i === pos ? 'here' : (i < pos ? 'seen' : '');
  }
}

/** Cross-fades the triangle to a new image without ever showing black. */
function showImage(url) {
  const a = $('imgA'), b = $('imgB');
  const incoming = front === 'A' ? b : a;
  const outgoing = front === 'A' ? a : b;

  incoming.src = url;
  incoming.classList.add('on');
  outgoing.classList.remove('on');
  front = front === 'A' ? 'B' : 'A';
}

/* While the splash is up the prism must not be empty, so it drifts slowly
   through the reduced images. From across the room that is the thing that makes
   someone walk over and look inside. */
function attract() {
  let i = 0;
  showImage(srcOf(SCENES[0].id, 'rpca'));
  attractTimer = setInterval(() => {
    i = (i + 1) % SCENES.length;
    showImage(srcOf(SCENES[i].id, 'rpca'));
  }, 5000);
}

function show() {
  const scene = SCENES[order[pos]];
  answered = false;
  document.body.classList.remove('answered');

  showImage(srcOf(scene.id, 'rpca'));

  $('question').textContent = 'What atmosphere is this?';
  $('question').classList.remove('revealed');
  $('place').textContent = '';

  const opts = shuffle([scene.answer, ...scene.others]);
  $('options').innerHTML = opts
    .map(o => `<button class="opt">${escapeHtml(o)}</button>`)
    .join('');

  [...$('options').children].forEach((btn, i) => {
    btn.addEventListener('click', () => answer(scene, opts[i], btn));
  });

  markDots();
  paintNav();
  shownAt = performance.now();
  armIdle();
}

/* Each arrow wears a blurred sample of the atmosphere it leads to, so the
   choice reads as "that one next" rather than "forward". */
function paintNav() {
  const at = i => SCENES[order[(i + order.length) % order.length]].id;
  $('prev').style.backgroundImage = `url("${srcOf(at(pos - 1), 'thumb')}")`;
  $('next').style.backgroundImage = `url("${srcOf(at(pos + 1), 'thumb')}")`;
}

function answer(scene, chosen, btn) {
  if (answered) return;
  answered = true;
  document.body.classList.add('answered');

  const seconds = (performance.now() - shownAt) / 1000;
  const match = chosen === scene.answer;

  for (const el of $('options').children) {
    const isTruth = el.textContent === scene.answer;
    if (isTruth) el.classList.add('truth');
    if (el === btn) el.classList.add('chosen');
    if (!isTruth && el !== btn) el.classList.add('muted');
  }

  // the reveal happens inside the prism, which is the whole point
  showImage(srcOf(scene.id, 'src'));

  $('question').textContent = scene.reveal;
  $('question').classList.add('revealed');
  $('place').textContent = scene.place;

  record({
    session: sessionId,
    at: new Date().toISOString(),
    step: pos + 1,
    scene: scene.id,
    correct: scene.answer,
    chosen,
    match,
    seconds: +seconds.toFixed(1),
  });

  armIdle();
}

/* Wraps rather than reshuffling at the end of a round, so the picture on the
   arrow is always the picture you actually get. Reshuffling happens when the
   booth falls quiet and a new visitor is assumed. */
function go(delta) {
  pos = (pos + delta + order.length) % order.length;
  show();
}

/* ---------------- idling ---------------- */

/* Two different silences. A short one after an answer means the visitor has
   walked off mid-flow, so we move to the next question and leave something
   askable on screen. A long one means nobody is there at all, so we start a
   clean sequence for whoever arrives next. */
function armIdle() {
  clearTimeout(idleTimer);
  clearTimeout(resetTimer);
  if (answered) idleTimer = setTimeout(() => go(1), IDLE_AFTER_ANSWER);
  resetTimer = setTimeout(() => { newSequence(); show(); }, IDLE_RESET);
}

/* ---------------- answer log ---------------- */

function readLog() {
  try { return JSON.parse(localStorage.getItem(LOG_KEY)) || []; }
  catch { return []; }
}

function record(row) {
  try {
    const log = readLog();
    log.push(row);
    while (log.length > LOG_MAX) log.shift();
    localStorage.setItem(LOG_KEY, JSON.stringify(log));
  } catch { /* private browsing, full disk — never block the demo for this */ }
}

function toCsv(log) {
  const head = 'session,timestamp,step,scene,correct_answer,chosen_answer,match,seconds';
  const esc = v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
  const rows = log.map(r =>
    [r.session, r.at, r.step, r.scene, r.correct, r.chosen, r.match ? 1 : 0, r.seconds]
      .map(esc).join(','));
  return [head, ...rows].join('\n');
}

/* ---------------- settings ---------------- */

function loadCal() {
  try { Object.assign(cal, JSON.parse(localStorage.getItem(CAL_KEY)) || {}); } catch {}
}
function saveCal() {
  try { localStorage.setItem(CAL_KEY, JSON.stringify(cal)); } catch {}
}

function paintAdmin() {
  const { clamped } = layout();
  $('v-side').textContent = cal.sideMm.toFixed(1) + ' mm' + (clamped ? ' (clipped)' : '');
  $('v-ppi').textContent = cal.ppi + ' ppi';
  $('v-top').textContent = cal.top + ' px';
  $('v-left').textContent = (cal.left > 0 ? '+' : '') + cal.left + ' px';
  $('v-flip').textContent = cal.flip ? 'down' : 'up';
  $('v-line').textContent = cal.outline ? 'on' : 'off';

  const log = readLog();
  const matched = log.filter(r => r.match).length;
  $('stats').textContent = log.length
    ? `${log.length} answers, ${matched} matched (${Math.round(matched / log.length * 100)}%), ` +
      `${new Set(log.map(r => r.session)).size} sessions`
    : 'No answers recorded yet.';
  $('csv').value = toCsv(log);
}

function wireAdmin() {
  $('admin').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;

    if (b.dataset.adj) {
      const d = parseFloat(b.dataset.d);
      if (b.dataset.adj === 'side') cal.sideMm = Math.max(40, Math.min(400, cal.sideMm + d));
      if (b.dataset.adj === 'ppi') cal.ppi = Math.max(100, Math.min(600, cal.ppi + d));
      if (b.dataset.adj === 'top') cal.top = Math.max(0, cal.top + d);
      if (b.dataset.adj === 'left') cal.left += d;
      saveCal(); paintAdmin();
    }

    if (b.dataset.toggle) {
      cal[b.dataset.toggle] = !cal[b.dataset.toggle];
      saveCal(); paintAdmin();
    }
  });

  $('dl').addEventListener('click', () => {
    const blob = new Blob([toCsv(readLog())], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `kaleidoscope_answers_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  });

  $('cp').addEventListener('click', async () => {
    const text = toCsv(readLog());
    try { await navigator.clipboard.writeText(text); $('cp').textContent = 'Copied'; }
    catch { $('csv').select(); $('cp').textContent = 'Select + copy'; }
    setTimeout(() => { $('cp').textContent = 'Copy CSV'; }, 1800);
  });

  /* Deliberately two taps: this is the one irreversible button in the app. */
  let armed = false;
  $('wipe').addEventListener('click', () => {
    if (!armed) {
      armed = true;
      $('wipe').textContent = 'Tap again';
      setTimeout(() => { armed = false; $('wipe').textContent = 'Erase all'; }, 4000);
      return;
    }
    try { localStorage.removeItem(LOG_KEY); } catch {}
    armed = false;
    $('wipe').textContent = 'Erase all';
    paintAdmin();
  });

  $('close').addEventListener('click', () => {
    $('admin').hidden = true;
    cal.outline = false;
    saveCal();
    layout();
    armIdle();
  });

  /* Five taps in the bottom-left corner. Out of reach of the prism, far from
     anything a visitor has a reason to touch, and invisible. */
  let taps = 0, firstTap = 0;
  $('hot').addEventListener('click', () => {
    const now = Date.now();
    if (now - firstTap > 3000) { taps = 0; firstTap = now; }
    if (++taps < 5) return;
    taps = 0;
    $('admin').hidden = false;
    paintAdmin();
    clearTimeout(idleTimer);
    clearTimeout(resetTimer);
  });
}

/* ---------------- kiosk plumbing ---------------- */

/* Guided Access is what actually locks the iPad down; this only removes the
   browser's own affordances so it does not look like a web page. */
function lockDown() {
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('dblclick', e => e.preventDefault());
  document.addEventListener('touchmove', e => {
    if (!e.target.closest('#admin')) e.preventDefault();
  }, { passive: false });
}

/* Keeps the screen awake for a whole conference day. Safari drops the lock
   whenever the app is backgrounded, so it is re-taken on every return. */
async function keepAwake() {
  if (!('wakeLock' in navigator)) return;
  const take = async () => {
    try { await navigator.wakeLock.request('screen'); } catch {}
  };
  await take();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') take();
  });
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* ---------------- start ---------------- */

/* There is no console at a conference. If something throws, say so on the
   splash rather than sitting on "loading" with no explanation. */
function reportFailures() {
  const say = msg => {
    const t = $('loadtext');
    if (t) t.textContent = String(msg).slice(0, 120);
    const b = $('begin');
    if (b) b.hidden = false;
  };
  window.addEventListener('error', e => say(e.message || 'script error'));
  window.addEventListener('unhandledrejection', e => say(e.reason && e.reason.message));
}

async function main() {
  reportFailures();
  loadCal();
  layout();
  lockDown();
  wireAdmin();
  buildDots();

  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', () => setTimeout(layout, 250));

  $('prev').addEventListener('click', () => go(-1));
  $('next').addEventListener('click', () => go(1));
  document.addEventListener('pointerdown', armIdle);

  attract();
  await preload();

  $('begin').addEventListener('click', async () => {
    // a user gesture is required for both of these
    if (document.documentElement.requestFullscreen) {
      try { await document.documentElement.requestFullscreen(); } catch {}
    }
    keepAwake();

    clearInterval(attractTimer);
    $('splash').classList.add('gone');
    setTimeout(() => { $('splash').hidden = true; }, 600);
    document.body.classList.add('ready');

    newSequence();
    show();
  });
}

main();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
