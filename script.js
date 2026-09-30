/* ════════════════════════════════════════════════════════════════════
   TEJAS KUMAR S — PORTFOLIO RUNTIME
   One shared requestAnimationFrame loop drives the 2D systems; the
   Three.js hero runs its own loop and pauses when off-screen.
   ════════════════════════════════════════════════════════════════════ */
(() => {
  'use strict';
  const root = document.documentElement;
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const css = n => getComputedStyle(root).getPropertyValue(n).trim();

  const pointer = { x: innerWidth / 2, y: innerHeight / 2, vx: 0, vy: 0, px: 0, py: 0, active: false, down: false };
  addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true; }, { passive: true });
  document.addEventListener('mouseleave', () => { pointer.active = false; });
  addEventListener('pointerdown', () => { pointer.down = true; });
  addEventListener('pointerup', () => { pointer.down = false; });

  const systems = [];
  let last = performance.now(), running = true;
  function tick(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    pointer.vx = lerp(pointer.vx, pointer.x - pointer.px, .3); pointer.vy = lerp(pointer.vy, pointer.y - pointer.py, .3);
    pointer.px = pointer.x; pointer.py = pointer.y;
    for (const s of systems) s(dt, now);
    if (running) requestAnimationFrame(tick);
  }
  document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) { last = performance.now(); requestAnimationFrame(tick); } });

  /* ══════════════════════════════════════════════════════════════════
     NEURAL FIELD — lattice of spring-tethered nodes. Cursor warps it,
     synapse pulses random-walk across it, clicks send shockwaves.
     ══════════════════════════════════════════════════════════════════ */
  const canvas = $('#field'), ctx = canvas.getContext('2d');
  let W = 0, H = 0, DPR = 1, nodes = [], spacing = 34, COLS = 1, ROWS = 1, focus = 0, focusT = 0;
  let nodeRGB = '190,200,255', accRGB = '36,198,220', vioRGB = '139,108,255';
  const pulses = [], shocks = []; let pulseT = 0;
  function readColors() { nodeRGB = css('--node-rgb') || nodeRGB; accRGB = css('--accent-rgb') || accRGB; vioRGB = css('--violet-rgb') || vioRGB; }
  function build() {
    W = innerWidth; H = innerHeight; DPR = Math.min(devicePixelRatio || 1, W > 1800 ? 1.5 : 2);
    canvas.width = W * DPR; canvas.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    spacing = clamp(Math.sqrt(W * H / 1400), 26, 48);
    COLS = Math.ceil(W / spacing) + 1; ROWS = Math.ceil(H / spacing) + 1; nodes = []; pulses.length = 0;
    const ox = (W - (COLS - 1) * spacing) / 2, oy = (H - (ROWS - 1) * spacing) / 2;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const hx = ox + c * spacing, hy = oy + r * spacing; nodes.push({ hx, hy, x: hx, y: hy, vx: 0, vy: 0 }); }
  }
  let rsT; addEventListener('resize', () => { clearTimeout(rsT); rsT = setTimeout(build, 120); });
  readColors(); build();
  addEventListener('pointerdown', e => {
    if (REDUCED || e.target.closest('a,button,input,canvas#netCanvas,canvas#askCanvas,.sphere-stage,summary')) return;
    shocks.push({ x: e.clientX, y: e.clientY, t: 0 }); if (shocks.length > 4) shocks.shift();
  });
  systems.push((dt, now) => {
    const t = now * .001; focus = lerp(focus, focusT, .06);
    ctx.clearRect(0, 0, W, H);
    const px = pointer.x, py = pointer.y, speed = Math.min(Math.hypot(pointer.vx, pointer.vy) / 12, 3);
    const R = 190 * (1 + focus * .6), R2 = R * R, push = (REDUCED ? 0 : 2600) * (1 + speed * 1.6) * (1 + focus);
    ctx.fillStyle = `rgba(${nodeRGB},.26)`; ctx.beginPath();
    const near = [];
    for (const n of nodes) {
      const wave = REDUCED ? 0 : Math.sin(t * 1.2 + n.hx * .012 + n.hy * .008) * 2.2;
      let ax = (n.hx - n.x) * 38 - n.vx * 7.5, ay = (n.hy + wave - n.y) * 38 - n.vy * 7.5;
      for (const sh of shocks) {
        const r = sh.t * 900, dx = n.hx - sh.x, dy = n.hy - sh.y, d = Math.hypot(dx, dy) || 1, band = 1 - Math.abs(d - r) / 70;
        if (band > 0) { const f = band * 5200 * (1 - sh.t / 1.4); ax += dx / d * f; ay += dy / d * f; }
      }
      if (pointer.active) {
        const dx = n.x - px, dy = n.y - py, d2 = dx * dx + dy * dy;
        if (d2 < R2 && d2 > .01) { const d = Math.sqrt(d2), f = 1 - d / R, fa = f * f * push / d; ax += dx * fa + pointer.vx * f * 40; ay += dy * fa + pointer.vy * f * 40; near.push(n); }
      }
      n.vx += ax * dt; n.vy += ay * dt; n.x += n.vx * dt; n.y += n.vy * dt;
      ctx.rect(n.x - .75, n.y - .75, 1.5, 1.5);
    }
    ctx.fill();
    if (near.length) {
      const ml = spacing * 1.6, ml2 = ml * ml; ctx.lineWidth = 1; ctx.beginPath();
      for (let i = 0; i < near.length; i++) for (let j = i + 1; j < near.length; j++) {
        const a = near[i], b = near[j], dx = a.x - b.x, dy = a.y - b.y;
        if (dx * dx + dy * dy < ml2) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
      }
      ctx.strokeStyle = `rgba(${accRGB},${.22 + focus * .2})`; ctx.stroke();
      ctx.fillStyle = `rgba(${accRGB},.95)`; ctx.beginPath();
      for (const n of near) { const s = 1.2 + Math.min(Math.hypot(n.x - n.hx, n.y - n.hy) / 20, 1) * 2.2; ctx.rect(n.x - s / 2, n.y - s / 2, s, s); }
      ctx.fill();
    }
    for (let s = shocks.length - 1; s >= 0; s--) {
      const sh = shocks[s]; sh.t += dt; if (sh.t > 1.4) { shocks.splice(s, 1); continue; }
      ctx.strokeStyle = `rgba(${accRGB},${.5 * (1 - sh.t / 1.4)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(sh.x, sh.y, sh.t * 900, 0, 6.283); ctx.stroke();
    }
    if (REDUCED) return;
    pulseT -= dt;
    if (pulseT <= 0 && pulses.length < (W < 700 ? 6 : 14)) {
      pulseT = .12 + Math.random() * .25;
      let i = (Math.random() * nodes.length) | 0; const path = [i];
      for (let k = 0, len = 5 + (Math.random() * 7 | 0); k < len; k++) {
        const c = i % COLS, r = (i / COLS) | 0, o = [];
        if (c < COLS - 1) o.push(i + 1); if (c > 0) o.push(i - 1); if (r < ROWS - 1) o.push(i + COLS); if (r > 0) o.push(i - COLS);
        i = o[(Math.random() * o.length) | 0]; path.push(i);
      }
      pulses.push({ path, k: 0, v: 5 + Math.random() * 5, col: Math.random() < .35 ? vioRGB : accRGB });
    }
    ctx.lineCap = 'round';
    for (let q = pulses.length - 1; q >= 0; q--) {
      const P = pulses[q]; P.k += dt * P.v; const end = P.path.length - 1;
      if (P.k >= end + 2) { pulses.splice(q, 1); continue; }
      const at = k => { const kk = clamp(k, 0, end), a = nodes[P.path[kk | 0]], b = nodes[P.path[Math.min(end, (kk | 0) + 1)]], f = kk % 1; return [a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f]; };
      const fade = P.k > end ? 1 - (P.k - end) / 2 : 1, t0 = Math.max(0, P.k - 2.2);
      ctx.beginPath(); let [sx, sy] = at(t0); ctx.moveTo(sx, sy);
      for (let k = Math.ceil(t0); k < Math.min(P.k, end); k++) { const [x, y] = at(k); ctx.lineTo(x, y); }
      const [hx, hy] = at(P.k); ctx.lineTo(hx, hy);
      ctx.strokeStyle = `rgba(${P.col},${.45 * fade})`; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = `rgba(${P.col},${.18 * fade})`; ctx.fillRect(hx - 5, hy - 5, 10, 10);
      ctx.fillStyle = `rgba(${P.col},${fade})`; ctx.fillRect(hx - 1.6, hy - 1.6, 3.2, 3.2);
    }
  });

  /* ══════════════ KINETIC CURSOR ══════════════ */
  if (FINE && !REDUCED) {
    root.classList.add('has-cursor');
    const dot = $('.cursor-dot'), ring = $('.cursor-ring'), R = { x: 0, y: 0, w: 36, h: 36 }; let target = null;
    document.addEventListener('pointerover', e => {
      const el = e.target.closest('[data-snap]'); target = el;
      const frame = !!el && el.dataset.snap === 'frame';
      ring.classList.toggle('is-snapped', !!el && !frame); ring.classList.toggle('is-frame', frame);
    });
    systems.push(() => {
      dot.style.transform = `translate3d(${pointer.x}px,${pointer.y}px,0)`;
      let tx, ty, tw, th, k;
      if (target && document.contains(target)) {
        const b = target.getBoundingClientRect(), p = 6; tw = b.width + p * 2; th = b.height + p * 2;
        tx = b.left - p + (pointer.x - (b.left + b.width / 2)) * .06; ty = b.top - p + (pointer.y - (b.top + b.height / 2)) * .06; k = .22;
      } else { const s = pointer.down ? 26 : 36; tw = th = s; tx = pointer.x - s / 2; ty = pointer.y - s / 2; k = .18; }
      R.x = lerp(R.x, tx, k); R.y = lerp(R.y, ty, k); R.w = lerp(R.w, tw, k); R.h = lerp(R.h, th, k);
      ring.style.width = R.w + 'px'; ring.style.height = R.h + 'px'; ring.style.transform = `translate3d(${R.x}px,${R.y}px,0)`;
    });
  }

  /* ══════════════ 3D TILT + MAGNETIC ══════════════ */
  if (FINE && !REDUCED) {
    const cards = $$('[data-tilt]').map(el => ({ el, rx: 0, ry: 0, z: 0, trx: 0, try_: 0, tz: 0, hover: false }));
    cards.forEach(c => {
      c.el.addEventListener('pointerenter', () => { c.hover = true; focusT = 1; });
      c.el.addEventListener('pointerleave', () => { c.hover = false; focusT = 0; c.trx = c.try_ = c.tz = 0; });
      c.el.addEventListener('pointermove', e => {
        const b = c.el.getBoundingClientRect(), nx = (e.clientX - b.left) / b.width - .5, ny = (e.clientY - b.top) / b.height - .5;
        c.try_ = nx * 14; c.trx = -ny * 10; c.tz = 30;
        c.el.style.setProperty('--gx', (nx + .5) * 100 + '%'); c.el.style.setProperty('--gy', (ny + .5) * 100 + '%');
      });
    });
    const mags = $$('[data-magnetic]').map(el => ({ el, label: el.querySelector('.btn__label'), x: 0, y: 0, tx: 0, ty: 0 }));
    mags.forEach(m => {
      m.el.addEventListener('pointermove', e => { const b = m.el.getBoundingClientRect(); m.tx = (e.clientX - (b.left + b.width / 2)) * .28; m.ty = (e.clientY - (b.top + b.height / 2)) * .38; });
      m.el.addEventListener('pointerleave', () => { m.tx = m.ty = 0; });
    });
    systems.push(() => {
      for (const c of cards) {
        c.rx = lerp(c.rx, c.trx, .1); c.ry = lerp(c.ry, c.try_, .1); c.z = lerp(c.z, c.tz, .1);
        c.el.style.transform = (Math.abs(c.rx) + Math.abs(c.ry) + c.z < .01 && !c.hover) ? '' : `rotateX(${c.rx.toFixed(2)}deg) rotateY(${c.ry.toFixed(2)}deg) translateZ(${c.z.toFixed(1)}px)`;
      }
      for (const m of mags) {
        m.x = lerp(m.x, m.tx, .16); m.y = lerp(m.y, m.ty, .16);
        m.el.style.transform = `translate3d(${m.x.toFixed(2)}px,${m.y.toFixed(2)}px,0)`;
        if (m.label) m.label.style.transform = `translate3d(${(m.x * .35).toFixed(2)}px,${(m.y * .35).toFixed(2)}px,0)`;
      }
    });
  }

  /* ══════════════ SCRAMBLE + REVEAL + COUNTERS ══════════════ */
  const GLYPHS = '01<>/\\[]{}#$%&*+=!?_|∑∂∇λσ';
  function scrambleNode(node, dur) {
    const fin = node.textContent, len = fin.length, t0 = performance.now();
    const lock = Array.from({ length: len }, (_, i) => i / len * dur * .75 + Math.random() * dur * .25);
    (function f(now) {
      const el = now - t0; let o = '';
      for (let i = 0; i < len; i++) o += (fin[i] === ' ' || el >= lock[i]) ? fin[i] : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      node.textContent = o; if (el < dur) requestAnimationFrame(f); else node.textContent = fin;
    })(t0);
  }
  function scramble(el) {
    if (el.dataset.scr || REDUCED) return; el.dataset.scr = 1;
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), list = []; let n;
    while ((n = w.nextNode())) if (n.textContent.trim()) list.push(n);
    list.forEach(tn => scrambleNode(tn, clamp(el.textContent.length * 28, 500, 1300)));
  }
  function countUp(el) {
    const to = +el.dataset.count, dec = +(el.dataset.dec || 0), sup = el.querySelector('sup'), supH = sup ? sup.outerHTML : '';
    const t0 = performance.now(), dur = REDUCED ? 0 : 1400;
    (function s(now) { const p = dur ? clamp((now - t0) / dur, 0, 1) : 1, e = 1 - Math.pow(1 - p, 4); el.innerHTML = (to * e).toFixed(dec) + supH; if (p < 1) requestAnimationFrame(s); })(t0);
  }
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return; const el = e.target;
    if (el.matches('[data-scramble],[data-scramble-block]')) scramble(el);
    if (el.hasAttribute('data-reveal')) { el.classList.add('is-in'); el.querySelectorAll('[data-count]').forEach(countUp); }
    io.unobserve(el);
  }), { threshold: .18, rootMargin: '0px 0px -6% 0px' });
  $$('[data-scramble],[data-scramble-block],[data-reveal]').forEach(el => io.observe(el));

  /* ══════════════ THEME · CLOCK · MENU · SCROLL ══════════════ */
  const label = $('#themeLabel');
  function applyTheme(t) {
    if (t === 'light') root.setAttribute('data-theme', 'light'); else root.removeAttribute('data-theme');
    label.textContent = t === 'light' ? 'Light' : 'Dark';
    $('meta[name="theme-color"]').content = t === 'light' ? '#f4f5fb' : '#07061a';
    requestAnimationFrame(() => { readColors(); if (window.__net) window.__net.setTheme(t); if (window.__ask) window.__ask.redraw(); });
  }
  let theme = 'dark'; try { theme = localStorage.getItem('tk-theme') || 'dark'; } catch (_) {}
  applyTheme(theme);
  $('#themeToggle').addEventListener('click', () => { theme = theme === 'light' ? 'dark' : 'light'; applyTheme(theme); try { localStorage.setItem('tk-theme', theme); } catch (_) {} });
  const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
  const clockEl = $('#clock'); const upd = () => { clockEl.textContent = fmt.format(new Date()) + ' IST'; }; upd(); setInterval(upd, 1000);
  $('#yr').textContent = new Date().getFullYear();
  const menuBtn = $('#menuBtn'), links = $('#hudLinks');
  menuBtn.addEventListener('click', () => { const o = links.classList.toggle('open'); menuBtn.setAttribute('aria-expanded', o); });
  links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { links.classList.remove('open'); menuBtn.setAttribute('aria-expanded', false); }));

  const prog = $('#hudProgress'), log = $('#log'), rows = $$('.log__row'), navA = $$('#hudLinks a');
  const secs = navA.map(a => $(a.getAttribute('href')));
  function onScroll() {
    const max = root.scrollHeight - innerHeight; prog.style.setProperty('--sp', max > 0 ? (scrollY / max).toFixed(4) : 0);
    const line = innerHeight * .62, r = log.getBoundingClientRect();
    log.style.setProperty('--lp', clamp((line - r.top) / r.height, 0, 1).toFixed(4));
    rows.forEach(row => row.classList.toggle('is-lit', row.getBoundingClientRect().top + 32 < line));
    let cur = -1; secs.forEach((s, i) => { if (s && s.getBoundingClientRect().top < innerHeight * .4) cur = i; });
    navA.forEach((a, i) => a.classList.toggle('is-on', i === cur));
  }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* ══════════════ LOADER — a tiny network lights up while "weights load" ══════════════ */
  const loader = $('#loader');
  (function () {
    const net = $('#ldNet'), L = [3, 5, 5, 2], pts = [], w = net.clientWidth || 300, h = 120;
    L.forEach((n, l) => { for (let i = 0; i < n; i++) pts.push({ l, x: 10 + l * (w - 20) / (L.length - 1), y: h / 2 + (i - (n - 1) / 2) * 24 }); });
    pts.forEach(a => pts.filter(b => b.l === a.l + 1).forEach(b => {
      const e = document.createElement('b'), len = Math.hypot(b.x - a.x, b.y - a.y);
      e.style.cssText = `left:${a.x}px;top:${a.y}px;width:${len}px;transform:rotate(${Math.atan2(b.y - a.y, b.x - a.x)}rad)`; net.appendChild(e);
    }));
    const dots = pts.map(p => { const d = document.createElement('i'); d.style.left = p.x + 'px'; d.style.top = p.y + 'px'; net.appendChild(d); return { d, l: p.l }; });
    const n = $('#ldN'), bar = $('#ldBar'), msg = $('#ldMsg'), t0 = performance.now(), MIN = REDUCED ? 0 : 1400;
    const MSG = ['loading weights…', 'warming up embeddings…', 'building index…', 'ready'];
    let loaded = document.readyState === 'complete'; addEventListener('load', () => { loaded = true; });
    (function run(now) {
      const p = clamp((now - t0) / MIN, 0, loaded ? 1 : .92), e = 1 - Math.pow(1 - p, 3);
      n.textContent = String(Math.round(e * 100)).padStart(2, '0'); bar.style.setProperty('--p', e);
      msg.textContent = MSG[Math.min(3, Math.floor(e * 3.999))];
      const layer = Math.floor((now / 180) % (L.length + 1)); dots.forEach(d => d.d.classList.toggle('on', d.l === layer || e >= 1));
      if (p < 1 && now - t0 < 4500) requestAnimationFrame(run); else setTimeout(() => loader.classList.add('is-done'), 180);
    })(t0);
  })();

  /* ══════════════ HERO NAME SPLIT + TYPED ROLES ══════════════ */
  $$('[data-split]').forEach((el, w) => {
    const txt = el.textContent; el.textContent = '';
    [...txt].forEach((c, i) => { const s = document.createElement('span'); s.className = 'ch'; s.textContent = c; s.style.animationDelay = (1.45 + w * .16 + i * .045) + 's'; el.appendChild(s); });
  });
  const ROLES = ['Building production-grade RAG pipelines', 'Agentic AI with LangChain + LangGraph + MCP', 'Computer vision with YOLO & transfer learning', 'Shipping models: notebook → FastAPI → Docker'];
  const typed = $('#typed');
  if (REDUCED) typed.textContent = ROLES[0];
  else (async function loop() {
    await new Promise(r => setTimeout(r, 2000));
    for (let k = 0; ; k = (k + 1) % ROLES.length) {
      const s = ROLES[k];
      for (let i = 1; i <= s.length; i++) { typed.textContent = s.slice(0, i); await new Promise(r => setTimeout(r, 34)); }
      await new Promise(r => setTimeout(r, 1900));
      for (let i = s.length; i >= 0; i--) { typed.textContent = s.slice(0, i); await new Promise(r => setTimeout(r, 14)); }
      await new Promise(r => setTimeout(r, 250));
    }
  })();

  /* ══════════════ ABOUT CUBE — spins with time, pointer and scroll ══════════════ */
  const cube = $('#cube'); let cRX = -22, cRY = -32, cVX = 0, cVY = 0;
  const cubeStage = cube.parentElement; let cubeDrag = null;
  cubeStage.addEventListener('pointerdown', e => { cubeDrag = { x: e.clientX, y: e.clientY }; });
  addEventListener('pointerup', () => { cubeDrag = null; });
  addEventListener('pointermove', e => { if (!cubeDrag) return; cVY = (e.clientX - cubeDrag.x) * .4; cVX = -(e.clientY - cubeDrag.y) * .4; cubeDrag = { x: e.clientX, y: e.clientY }; });
  systems.push(dt => {
    if (REDUCED) return;
    const r = cubeStage.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
    cRY += cVY + dt * 18; cRX += cVX; cVX *= .92; cVY *= .92;
    const sc = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
    cube.style.transform = `rotateX(${(cRX + sc * 30).toFixed(2)}deg) rotateY(${cRY.toFixed(2)}deg)`;
  });

  /* ══════════════════════════════════════════════════════════════════
     SKILL SPHERE — tags distributed on a Fibonacci sphere, rotated by a
     3×3 matrix each frame; depth drives scale, opacity and z-order.
     ══════════════════════════════════════════════════════════════════ */
  const SKILLS = {
    genai: ['LangChain', 'LangGraph', 'MCP', 'Agentic AI', 'Prompt Eng.', 'Embeddings', 'OpenAI', 'Groq', 'Hugging Face'],
    rag: ['RAG', 'Pinecone', 'FAISS', 'Semantic Search', 'Vector DBs', 'OCR', 'Chunking'],
    cv: ['YOLO11', 'OpenCV', 'ResNet50', 'EfficientNet', 'MobileNetV2', 'VGG16', 'PyTorch', 'TensorFlow', 'Keras', 'CNN', 'Transfer Learning'],
    ml: ['scikit-learn', 'XGBoost', 'Random Forest', 'SVM', 'Pandas', 'NumPy', 'SQL', 'ROC-AUC', 'F1 · Recall'],
    ops: ['FastAPI', 'Docker', 'Streamlit', 'Flask', 'REST APIs', 'Prometheus', 'Linux / WSL2', 'Git', 'Python']
  };
  const sphere = $('#sphere'), stage = $('#sphereStage'), tags = [];
  const all = []; { const lists = Object.entries(SKILLS).map(([cat, arr]) => arr.map(n => ({ n, cat }))); for (let i = 0; all.length < lists.flat().length; i++) lists.forEach(l => { if (l[i]) all.push(l[i]); }); }
  all.forEach((s, i) => {
    const y = 1 - (i / (all.length - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * Math.PI * (3 - Math.sqrt(5));
    const el = document.createElement('span'); el.textContent = s.n; sphere.appendChild(el);
    tags.push({ el, cat: s.cat, x: Math.cos(th) * r, y, z: Math.sin(th) * r, w: 0, h: 0 });
  });
  let rotX = .002, rotY = .004, sDrag = null, activeCat = 'genai';
  function setCat(c) { activeCat = c; tags.forEach(t => t.el.classList.toggle('hot', t.cat === c)); $$('.skill-cat').forEach(b => b.classList.toggle('is-on', b.dataset.cat === c)); }
  $$('.skill-cat').forEach(b => { b.addEventListener('click', () => setCat(b.dataset.cat)); b.addEventListener('pointerenter', () => setCat(b.dataset.cat)); });
  setCat('genai');
  stage.addEventListener('pointermove', e => {
    const r = stage.getBoundingClientRect(), nx = (e.clientX - r.left) / r.width - .5, ny = (e.clientY - r.top) / r.height - .5;
    if (sDrag) { rotY = (e.clientX - sDrag.x) * .0009; rotX = -(e.clientY - sDrag.y) * .0009; sDrag = { x: e.clientX, y: e.clientY }; }
    else if (e.pointerType === 'mouse') { rotY = nx * .03; rotX = -ny * .03; }
  });
  stage.addEventListener('pointerdown', e => { sDrag = { x: e.clientX, y: e.clientY }; });
  addEventListener('pointerup', () => { sDrag = null; });
  stage.addEventListener('pointerleave', () => { rotX = .002; rotY = .004; });
  let sphereVis = false; new IntersectionObserver(es => { sphereVis = es[0].isIntersecting; }).observe(stage);
  systems.push(() => {
    if (!sphereVis) return;
    const Rad = Math.min(stage.clientWidth * .47, stage.clientHeight * .44);
    const sy = REDUCED ? 0 : rotY, sx = REDUCED ? 0 : rotX, cy = Math.cos(sy), syn = Math.sin(sy), cx = Math.cos(sx), sxn = Math.sin(sx);
    for (const t of tags) {
      let x = t.x * cy + t.z * syn, z = -t.x * syn + t.z * cy;
      let y = t.y * cx - z * sxn; z = t.y * sxn + z * cx;
      t.x = x; t.y = y; t.z = z;
      if (!t.w) { t.w = t.el.offsetWidth; t.h = t.el.offsetHeight; }
      const s = .7 + (z + 1) * .2;
      t.el.style.transform = `translate3d(${(x * Rad - t.w / 2).toFixed(1)}px,${(y * Rad - t.h / 2).toFixed(1)}px,${(z * Rad).toFixed(1)}px) scale(${s.toFixed(3)})`;
      t.el.style.opacity = (t.el.classList.contains('hot') ? .55 + (z + 1) * .225 : .12 + (z + 1) * .33).toFixed(3);
      t.el.style.zIndex = Math.round((z + 1) * 100);
    }
  });

  /* ══════════════════════════════════════════════════════════════════
     ASK MY PORTFOLIO — real retrieval:
       tokenize → light stemming → TF-IDF → cosine similarity (top-3)
       Cosine-distance MDS lays chunks out in 2D; the query sits among its matches.
     ══════════════════════════════════════════════════════════════════ */
  const KB = [
    'Tejas Kumar S is an AI/ML engineer based in Bengaluru, India.',
    'He is an AI Engineer Intern at Datamites since November 2025.',
    'At Datamites he designed and deployed a RAG-based document search and Q&A system using LangChain, Pinecone and FAISS.',
    'His Intelligent RAG Chatbot ingests PDFs, CSVs and live web pages, indexes embeddings in Pinecone and answers with a Groq-hosted LLM through LangChain.',
    'In medical computer vision, his Chest X-Ray Pneumonia Classifier compares MobileNetV2, EfficientNet-B0 and ResNet50 with transfer learning, optimising recall, F1 and false-negative rate.',
    'For computer vision object detection, he built YOLO with Ultralytics YOLO11n and OpenCV, and is extending it with IoU, NMS and mAP evaluation.',
    'His Healthcare Chatbot answers health questions grounded in medical documents using FAISS vector search and Hugging Face embeddings.',
    'His education: he studied for a B.E. in Computer Science at Sri Krishna Institute of Technology, Bangalore, with a CGPA of 8.3.',
    'He deploys models with FastAPI, Streamlit and Docker; his Cat vs Dog transfer-learning classifier ships as a Docker Hub image.',
    'He is learning LangGraph multi-agent systems and MCP for agentic AI.',
    'He is open to AI/ML, Generative AI / agentic and CV engineer roles — hiring enquiries welcome.',
    'He evaluates models with metrics like precision, recall, F1, ROC-AUC, false-negative rate and RMSE — not just accuracy.',
    'You can contact him by email at tejasprof84@gmail.com or on LinkedIn at tejas-kumar-tech.'
  ];
  const TAG = ['profile', 'role', 'work', 'rag', 'cv · health', 'cv', 'rag · health', 'education', 'deploy', 'learning', 'roles', 'metrics', 'contact'];
  const STOP = new Set('a an and are as at be by for from has have he his i in is it its of on or that the to was were with what which who how does do did can you your me my about tell him not just any some there this built build builds project projects use uses used using he\'s now'.split(' '));
  const SYN = { email: 'contact', mail: 'contact', reach: 'contact', phone: 'contact', hire: 'roles', job: 'roles', jobs: 'roles', opportunity: 'roles', college: 'education', degree: 'education', study: 'education', studied: 'education', university: 'education', gpa: 'cgpa', detection: 'yolo', detect: 'yolo', worked: 'datamites', medical: 'health', healthcare: 'health', deploy: 'deploy', docker: 'docker', agent: 'agentic', agents: 'agentic', internship: 'intern', work: 'datamites', company: 'datamites', graduate: 'education', skills: 'skill' };
  const stem = w => w.length > 4 ? w.replace(/(ing|ed|es|s)$/, '') : w;
  const tok = s => s.toLowerCase().replace(/[^a-z0-9.+\s]/g, ' ').split(/\s+/).map(w => w.replace(/^[.\-]+|[.\-]+$/g, '')).filter(w => w && !STOP.has(w)).flatMap(w => SYN[w] ? [stem(w), stem(SYN[w])] : [stem(w)]);
  const docs = KB.map(tok), vocab = [...new Set(docs.flat())], V = new Map(vocab.map((w, i) => [w, i]));
  const df = new Float64Array(vocab.length); docs.forEach(d => new Set(d).forEach(w => df[V.get(w)]++));
  const idf = Array.from(df, d => Math.log((KB.length + 1) / (d + 1)) + 1);
  function vec(tokens) {
    const v = new Float64Array(vocab.length); tokens.forEach(w => { if (V.has(w)) v[V.get(w)] += 1; });
    let n = 0; for (let i = 0; i < v.length; i++) { v[i] *= idf[i]; n += v[i] * v[i]; } n = Math.sqrt(n) || 1;
    for (let i = 0; i < v.length; i++) v[i] /= n; return v;
  }
  const M = docs.map(vec), dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
  // Layout: metric MDS on cosine distance (1 − cos), solved by stress-minimising gradient descent.
  const N = M.length, D = M.map(a => M.map(b => 1 - dot(a, b)));
  const P2 = M.map((_, i) => [Math.cos(i / N * 6.283), Math.sin(i / N * 6.283)]);
  for (let it = 0; it < 400; it++) {
    const lr = .05 * (1 - it / 400) + .005;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      if (i === j) continue;
      const dx = P2[i][0] - P2[j][0], dy = P2[i][1] - P2[j][1], d = Math.hypot(dx, dy) || 1e-3, g = (d - D[i][j] * 1.6) / d;
      P2[i][0] -= lr * g * dx; P2[i][1] -= lr * g * dy;
    }
  }
  // the query lands at the similarity-weighted centre of its nearest chunks
  const proj = v => { let wx = 0, wy = 0, ws = 0; M.forEach((m, i) => { const w = Math.pow(Math.max(0, dot(m, v)), 2); wx += w * P2[i][0]; wy += w * P2[i][1]; ws += w; });
    return ws ? [wx / ws, wy / ws] : [(bx[0] + bx[1]) / 2, (by[0] + by[1]) / 2]; };
  let bx = [Infinity, -Infinity], by = [Infinity, -Infinity];
  P2.forEach(([x, y]) => { bx = [Math.min(bx[0], x), Math.max(bx[1], x)]; by = [Math.min(by[0], y), Math.max(by[1], y)]; });

  const acv = $('#askCanvas'), actx = acv.getContext('2d');
  let state = { q: null, qp: null, hits: [], t0: 0 };
  function drawMap(now) {
    const w = acv.clientWidth, h = acv.clientHeight, d = Math.min(devicePixelRatio || 1, 2);
    if (acv.width !== w * d) { acv.width = w * d; acv.height = h * d; }
    actx.setTransform(d, 0, 0, d, 0, 0); actx.clearRect(0, 0, w, h);
    const pad = 56, X = x => pad + (x - bx[0]) / (bx[1] - bx[0] || 1) * (w - pad * 2), Y = y => pad + (y - by[0]) / (by[1] - by[0] || 1) * (h - pad * 2);
    const acc = css('--accent-rgb'), vio = css('--violet-rgb'), fg = css('--node-rgb');
    // grid
    actx.strokeStyle = `rgba(${fg},.07)`; actx.lineWidth = 1; actx.beginPath();
    for (let x = 0; x < w; x += 32) { actx.moveTo(x, 0); actx.lineTo(x, h); } for (let y = 0; y < h; y += 32) { actx.moveTo(0, y); actx.lineTo(w, y); } actx.stroke();
    const t = (now - state.t0) / 1000, k = Math.min(1, t / .9);
    // links query → hits
    if (state.qp) {
      const qx = X(state.qp[0]), qy = Y(state.qp[1]);
      state.hits.forEach((h2, r) => {
        const [x, y] = P2[h2.i], tx = X(x), ty = Y(y), kk = clamp(k * 1.4 - r * .2, 0, 1);
        actx.strokeStyle = `rgba(${acc},${.9 - r * .22})`; actx.lineWidth = 2 - r * .4; actx.setLineDash([5, 5]); actx.lineDashOffset = -now / 40;
        actx.beginPath(); actx.moveTo(qx, qy); actx.lineTo(qx + (tx - qx) * kk, qy + (ty - qy) * kk); actx.stroke(); actx.setLineDash([]);
      });
    }
    // chunks
    P2.forEach(([x, y], i) => {
      const hit = state.hits.findIndex(h2 => h2.i === i), px = X(x), py = Y(y);
      const pulse = hit >= 0 ? 1 + Math.sin(now / 250) * .15 : 1;
      actx.fillStyle = hit >= 0 ? `rgba(${acc},.18)` : `rgba(${vio},.12)`;
      actx.beginPath(); actx.arc(px, py, (hit >= 0 ? 16 : 10) * pulse, 0, 6.283); actx.fill();
      actx.fillStyle = hit >= 0 ? `rgb(${acc})` : `rgba(${vio},.9)`;
      actx.beginPath(); actx.arc(px, py, hit >= 0 ? 5 : 3.5, 0, 6.283); actx.fill();
      actx.fillStyle = `rgba(${fg},${hit >= 0 ? .95 : .5})`; actx.font = '10px "JetBrains Mono", monospace';
      actx.fillText((hit >= 0 ? `#${hit + 1} ` : '') + TAG[i], px + 9, py - 8);
    });
    if (state.qp) {
      const qx = X(state.qp[0]), qy = Y(state.qp[1]), s = 8 + Math.sin(now / 200) * 1.5;
      actx.fillStyle = css('--pink') || '#ff5ea8'; actx.beginPath(); actx.moveTo(qx, qy - s); actx.lineTo(qx + s, qy); actx.lineTo(qx, qy + s); actx.lineTo(qx - s, qy); actx.closePath(); actx.fill();
      actx.fillStyle = `rgba(${fg},.95)`; actx.font = '600 11px "JetBrains Mono", monospace'; actx.fillText('query', qx + 12, qy + 4);
    }
  }
  let askVis = false; new IntersectionObserver(es => { askVis = es[0].isIntersecting; }).observe(acv);
  systems.push((dt, now) => { if (askVis) drawMap(now); });
  window.__ask = { redraw: () => drawMap(performance.now()) };

  const answerEl = $('#askAnswer'), metaEl = $('#askMeta'), hitsEl = $('#askHits');
  let typing = 0;
  function ask(q) {
    const qt = tok(q), qv = vec(qt), scores = M.map((v, i) => ({ i, s: dot(v, qv) })).sort((a, b) => b.s - a.s);
    const hits = scores.slice(0, 3).filter(h => h.s > 0);
    const qp = proj(qv);
    state = { q, qp, hits, t0: performance.now() };
    hitsEl.innerHTML = hits.map((h, r) => `<li><b>#${r + 1}</b><span>${KB[h.i]}</span><em>${h.s.toFixed(2)}</em><div class="bar"><i style="transform:scaleX(${Math.max(.04, h.s).toFixed(3)});animation-delay:${r * .12}s"></i></div></li>`).join('');
    let text;
    if (!hits.length || hits[0].s < .08) { text = "I couldn't find that in my knowledge base. Try asking about projects, skills, education or how to contact me."; metaEl.textContent = 'no match'; }
    else { text = hits.filter(h => h.s >= hits[0].s * .5).map(h => KB[h.i]).join(' '); metaEl.textContent = `top score ${hits[0].s.toFixed(2)}`; }
    const id = ++typing; answerEl.textContent = '';
    (async () => { for (let i = 1; i <= text.length; i++) { if (id !== typing) return; answerEl.textContent = text.slice(0, i); if (!REDUCED) await new Promise(r => setTimeout(r, 8)); } })();
  }
  const QS = ['What RAG projects has he built?', 'Where does he work?', 'Computer vision projects?', 'How do I contact him?', 'What is he learning now?', 'Which metrics does he use?'];
  const chips = $('#askChips'); QS.forEach(q => { const b = document.createElement('button'); b.type = 'button'; b.textContent = q; b.setAttribute('data-snap', ''); b.addEventListener('click', () => { $('#askInput').value = q; ask(q); }); chips.appendChild(b); });
  $('#askForm').addEventListener('submit', e => { e.preventDefault(); const q = $('#askInput').value.trim(); if (q) ask(q); });
  new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { ask(QS[0]); $('#askInput').value = QS[0]; o.disconnect(); } }, { threshold: .3 }).observe(acv);

  /* ══════════════ CONTACT TERMINAL ══════════════ */
  const termLog = $('#termLog');
  const LINES = [['p', '$ ', 'whoami'], ['g', '', 'tejas_kumar_s  ·  AI/ML engineer'], ['p', '$ ', 'cat focus.txt'], ['d', '', 'RAG · agentic AI · computer vision'],
    ['p', '$ ', 'status --hiring'], ['g', '', '● open to AI/ML, GenAI & CV roles'], ['p', '$ ', 'location'], ['d', '', 'Bengaluru, India (IST)']];
  new IntersectionObserver((es, o) => {
    if (!es[0].isIntersecting) return; o.disconnect();
    (async () => {
      for (const [c, pre, txt] of LINES) {
        const line = document.createElement('div'), p = document.createElement('span'), s = document.createElement('span');
        p.className = 'p'; p.textContent = pre; s.className = c; line.append(p, s); termLog.append(line);
        for (let i = 1; i <= txt.length; i++) { s.textContent = txt.slice(0, i); if (!REDUCED) await new Promise(r => setTimeout(r, 16)); }
        if (!REDUCED) await new Promise(r => setTimeout(r, 140));
      }
      const c = document.createElement('div'); c.innerHTML = '<span class="p">$ </span><span class="caret"></span>'; termLog.append(c);
    })();
  }, { threshold: .3 }).observe(termLog);

  // ticker: duplicate the track so the loop is seamless
  const tt = $('#tickerTrack'); tt.innerHTML += tt.innerHTML;

  requestAnimationFrame(tick);
  setTimeout(() => $$('.hero [data-scramble]').forEach(scramble), 600);
})();

/* ════════════════════════════════════════════════════════════════════
   3D NEURAL NETWORK HERO (Three.js r128)
   A 6-10-10-8-4 MLP laid out in depth. Every ~2s a forward pass fires:
   signals travel edge by edge, layer by layer; neurons flare as they
   activate. Drag to orbit, click to fire a pass immediately. The side
   panel shows a (simulated) training readout: epoch + falling loss.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const section = document.getElementById('hero'), canvas = document.getElementById('netCanvas');
  if (!canvas || typeof THREE === 'undefined') return;
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches, COARSE = matchMedia('(pointer: coarse)').matches;
  let renderer; try { renderer = new THREE.WebGLRenderer({ canvas, antialias: !COARSE, alpha: true, powerPreference: 'high-performance' }); } catch (e) { return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, COARSE ? 1.5 : 2));
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 1, .1, 200);
  const PAL = { dark: { node: 0x8fe9ff, edge: 0x5b6bd6, a: 0x24c6dc, b: 0x8b6cff, c: 0xff5ea8, edgeOp: .16 }, light: { node: 0x0b6f80, edge: 0x5b3fe0, a: 0x0b8fa3, b: 0x5b3fe0, c: 0xd6246f, edgeOp: .22 } };
  let pal = document.documentElement.getAttribute('data-theme') === 'light' ? PAL.light : PAL.dark;

  // soft glow sprite texture
  const gc = document.createElement('canvas'); gc.width = gc.height = 64; const g = gc.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const glowTex = new THREE.CanvasTexture(gc);

  const LAYERS = [6, 10, 10, 8, 4], GAP = 4.2, group = new THREE.Group(); scene.add(group);
  const layerCol = i => [pal.a, pal.b, pal.b, pal.c, pal.a][i];
  const neurons = [];   // { mesh, halo, l, act }
  LAYERS.forEach((n, l) => {
    const x = (l - (LAYERS.length - 1) / 2) * GAP, rad = n <= 4 ? 1.6 : n <= 6 ? 2.2 : 3;
    for (let i = 0; i < n; i++) {
      // neurons sit on a ring in the y–z plane → the network has real depth
      const a = (i / n) * Math.PI * 2 + l * .35, y = Math.cos(a) * rad, z = Math.sin(a) * rad;
      const mat = new THREE.MeshBasicMaterial({ color: layerCol(l) });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(.16, 16, 12), mat); mesh.position.set(x, y, z); group.add(mesh);
      const sm = new THREE.SpriteMaterial({ map: glowTex, color: layerCol(l), transparent: true, opacity: .35, depthWrite: false, blending: THREE.AdditiveBlending });
      const halo = new THREE.Sprite(sm); halo.scale.setScalar(1.1); mesh.add(halo);
      neurons.push({ mesh, halo, l, act: 0 });
    }
    // layer ring guide
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rad, .008, 6, 90), new THREE.MeshBasicMaterial({ color: pal.edge, transparent: true, opacity: .25 }));
    ring.rotation.y = Math.PI / 2; ring.position.x = x; group.add(ring); ring.userData.guide = true;
  });
  // edges between consecutive layers
  const edges = [], ePos = [];
  neurons.forEach(a => neurons.forEach(b => { if (b.l === a.l + 1) { edges.push({ a, b }); ePos.push(a.mesh.position.x, a.mesh.position.y, a.mesh.position.z, b.mesh.position.x, b.mesh.position.y, b.mesh.position.z); } }));
  const eGeo = new THREE.BufferGeometry(); eGeo.setAttribute('position', new THREE.Float32BufferAttribute(ePos, 3));
  const eMat = new THREE.LineBasicMaterial({ color: pal.edge, transparent: true, opacity: pal.edgeOp, depthWrite: false });
  group.add(new THREE.LineSegments(eGeo, eMat));

  // signal pool
  const SIG = COARSE ? 90 : 180, sigs = [];
  const sMat = () => new THREE.SpriteMaterial({ map: glowTex, color: pal.a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  for (let i = 0; i < SIG; i++) { const s = new THREE.Sprite(sMat()); s.scale.setScalar(.45); s.visible = false; group.add(s); sigs.push({ s, e: null, t0: 0, dur: 0 }); }
  let clock = 0, nextPass = .8;
  function firePass() {
    // pick an active subset per layer, then schedule signals edge by edge
    let active = new Set(neurons.filter(n => n.l === 0).map(n => n));
    neurons.filter(n => n.l === 0).forEach(n => { n.act = 1; });
    for (let l = 0; l < LAYERS.length - 1; l++) {
      const next = new Set();
      edges.filter(e => e.a.l === l && active.has(e.a) && Math.random() < .32).forEach((e, k) => {
        const sg = sigs.find(q => !q.e); if (!sg) return;
        sg.e = e; sg.t0 = clock + l * .55 + Math.random() * .12; sg.dur = .5; sg.s.material.color.setHex(layerCol(l + 1)); next.add(e.b);
      });
      active = next.size ? next : new Set(neurons.filter(n => n.l === l + 1).slice(0, 2));
    }
    epoch++; loss = Math.max(.041, loss * (.93 + Math.random() * .04)); hist.push(loss); if (hist.length > 40) hist.shift(); readout();
  }
  // training readout (simulated — this is an animation, not a real model)
  let epoch = 0, loss = .693; const hist = [loss];
  const elE = document.getElementById('netEpoch'), elL = document.getElementById('netLoss'), spark = document.getElementById('netSpark');
  function readout() {
    if (!elE) return; elE.textContent = String(epoch).padStart(3, '0'); elL.textContent = loss.toFixed(3);
    const mx = Math.max(...hist), mn = Math.min(...hist);
    spark.setAttribute('points', hist.map((v, i) => `${(i / 39 * 200).toFixed(1)},${(4 + (1 - (v - mn) / ((mx - mn) || 1)) * 36).toFixed(1)}`).join(' '));
    if (epoch > 400) { epoch = 0; loss = .693; hist.length = 0; hist.push(loss); }
  }

  // floating dust
  const DN = COARSE ? 150 : 320, dp = new Float32Array(DN * 3);
  for (let i = 0; i < DN; i++) { dp[i * 3] = (Math.random() - .5) * 50; dp[i * 3 + 1] = (Math.random() - .5) * 26; dp[i * 3 + 2] = (Math.random() - .5) * 30; }
  const dGeo = new THREE.BufferGeometry(); dGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dMat = new THREE.PointsMaterial({ color: pal.b, size: .06, transparent: true, opacity: .6, depthWrite: false });
  scene.add(new THREE.Points(dGeo, dMat));

  // layer labels (HTML)
  const labelsEl = document.getElementById('netLabels');
  const NAMES = ['input', 'hidden 1', 'hidden 2', 'hidden 3', 'output'];
  const lbls = LAYERS.map((n, l) => { const el = document.createElement('div'); el.className = 'nlabel'; el.textContent = `${NAMES[l]} · ${n}`; labelsEl.appendChild(el); return el; });

  // camera / interaction
  let theta = .55, thetaV = 0, phi = .18, drag = null, moved = 0, lastUser = -10, mx = 0, my = 0, smx = 0, smy = 0;
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; moved = 0; });
  addEventListener('pointerup', () => { if (drag && moved < 6) { firePass(); nextPass = clock + 2.2; } drag = null; });
  addEventListener('pointermove', e => {
    mx = e.clientX / innerWidth * 2 - 1; my = e.clientY / innerHeight * 2 - 1;
    if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; moved += Math.abs(dx) + Math.abs(dy);
    thetaV = -dx * .005; theta += thetaV; phi = Math.max(-.6, Math.min(.8, phi + dy * .003)); drag = { x: e.clientX, y: e.clientY }; lastUser = clock;
  });
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas); resize();

  function setTheme(t) {
    pal = t === 'light' ? PAL.light : PAL.dark;
    neurons.forEach(n => { n.mesh.material.color.setHex(layerCol(n.l)); n.halo.material.color.setHex(layerCol(n.l)); });
    eMat.color.setHex(pal.edge); eMat.opacity = pal.edgeOp; dMat.color.setHex(pal.b);
    group.children.forEach(c => { if (c.userData.guide) c.material.color.setHex(pal.edge); });
  }
  window.__net = { setTheme };

  let vis = true, last = performance.now(); const v3 = new THREE.Vector3(), tmp = new THREE.Vector3();
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now; clock += dt;
    if (!REDUCED && clock > nextPass) { firePass(); nextPass = clock + 2.1; }
    // signals
    for (const q of sigs) {
      if (!q.e) continue;
      const k = (clock - q.t0) / q.dur;
      if (k < 0) { q.s.visible = false; continue; }
      if (k >= 1) { q.e.b.act = 1; q.e = null; q.s.visible = false; continue; }
      q.s.visible = true; q.s.position.lerpVectors(q.e.a.mesh.position, q.e.b.mesh.position, k);
    }
    // neuron flare decay
    for (const n of neurons) {
      n.act = Math.max(0, n.act - dt * 1.4);
      const s = 1 + n.act * .9; n.mesh.scale.setScalar(s); n.halo.material.opacity = .3 + n.act * .5; n.halo.scale.setScalar(1.1 + n.act * 1.0);
    }
    // gentle spin of the whole net about its axis + orbit
    group.rotation.x += dt * .05 * (REDUCED ? 0 : 1);
    if (!drag) { thetaV *= .94; theta += thetaV; if (!REDUCED && clock - lastUser > 3) theta += dt * .06; }
    smx += (mx - smx) * .04; smy += (my - smy) * .04;
    const sr = section.getBoundingClientRect(), sp = Math.min(Math.max(-sr.top / Math.max(sr.height, 1), 0), 1);
    const wide = camera.aspect > 1.1, dist = wide ? 27 : 30;
    const th = theta + smx * .15, ph = phi - smy * .08 + sp * .5;
    camera.position.set(Math.sin(th) * Math.cos(ph) * dist, Math.sin(ph) * dist, Math.cos(th) * Math.cos(ph) * dist);
    // on wide screens shift the network right so the name has room
    camera.lookAt(0, 0, 0);
    if (wide) { camera.setViewOffset(canvas.clientWidth, canvas.clientHeight, -canvas.clientWidth * .33, -canvas.clientHeight * .02 - sp * 80, canvas.clientWidth, canvas.clientHeight); }
    else { camera.setViewOffset(canvas.clientWidth, canvas.clientHeight, 0, canvas.clientHeight * .18, canvas.clientWidth, canvas.clientHeight); }
    renderer.render(scene, camera);
    // project labels under each layer
    const w = canvas.clientWidth, h = canvas.clientHeight;
    LAYERS.forEach((n, l) => {
      const rad = n <= 4 ? 1.6 : n <= 6 ? 2.2 : 3;
      tmp.set((l - (LAYERS.length - 1) / 2) * GAP, -rad - .8, 0); v3.copy(tmp).applyMatrix4(group.matrixWorld).project(camera);
      lbls[l].style.transform = `translate(${((v3.x * .5 + .5) * w).toFixed(0)}px,${((-v3.y * .5 + .5) * h).toFixed(0)}px) translate(-50%,0)`;
      lbls[l].style.opacity = wide ? .75 : 0;
    });
    if (vis) requestAnimationFrame(frame);
  }
  function setVis(v) { if (v === vis) return; vis = v; if (v) { last = performance.now(); requestAnimationFrame(frame); } }
  let inView = true;
  new IntersectionObserver(es => { inView = es[0].isIntersecting; setVis(inView && !document.hidden); }).observe(section);
  document.addEventListener('visibilitychange', () => setVis(inView && !document.hidden));
  readout(); requestAnimationFrame(frame);
})();
