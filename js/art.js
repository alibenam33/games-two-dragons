// Procedural art for Two Dragons: brush strokes, seals, the board grid and the
// animated ink-wash landscape. Everything is generated with SVG and Canvas 2D.
(function (root) {
  'use strict';

  const IVORY = '#f8f1e2';
  const INK = '#1c2023';
  const SIDE_COLOR = { X: '#2b7a68', O: '#c23a2a' };

  // Small deterministic PRNG so generated shapes are stable for a given seed.
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randomSeed() {
    return Math.floor(Math.random() * 1e9);
  }

  function catmullRom(points, steps) {
    const out = [];
    const n = points.length;
    for (let i = 0; i < n - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(n - 1, i + 2)];
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const t2 = t * t;
        const t3 = t2 * t;
        const at = (k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t
          + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2
          + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
        out.push([at(0), at(1)]);
      }
    }
    out.push(points[n - 1]);
    return out;
  }

  // Outline of a tapered brush stroke following `points`, as an SVG path.
  // The stroke presses in at the start, wavers slightly, and lifts to a point.
  function brushPath(points, width, opts = {}) {
    const rand = mulberry32(opts.seed ?? 1);
    const pts = opts.sampled ? points : catmullRom(points, opts.steps ?? 18);
    const n = pts.length;
    const head = opts.head ?? 0.12;
    const tail = opts.tail ?? 0.3;
    const wobble = opts.wobble ?? 0.12;
    const ph1 = rand() * 6.283;
    const ph2 = rand() * 6.283;
    const left = [];
    const right = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(n - 1, i + 1)];
      let tx = b[0] - a[0];
      let ty = b[1] - a[1];
      const len = Math.hypot(tx, ty) || 1;
      tx /= len;
      ty /= len;
      const t = i / (n - 1);
      const press = 0.4 + 0.6 * Math.min(1, t / head) ** 0.5;
      const lift = Math.min(1, (1 - t) / tail) ** 0.75;
      const wob = 1 + wobble * (Math.sin(t * 9 + ph1) * 0.6 + Math.sin(t * 23 + ph2) * 0.4);
      const w = Math.max(0.12, width * 0.5 * press * lift * wob);
      left.push([pts[i][0] - ty * w, pts[i][1] + tx * w]);
      right.push([pts[i][0] + ty * w, pts[i][1] - tx * w]);
    }
    const f = (p) => p[0].toFixed(2) + ' ' + p[1].toFixed(2);
    let d = 'M' + f(left[0]);
    for (let i = 1; i < n; i++) d += 'L' + f(left[i]);
    for (let i = n - 1; i >= 0; i--) d += 'L' + f(right[i]);
    return d + 'Z';
  }

  // A brushed circle that slightly overshoots its starting point.
  function ringPoints(cx, cy, r, seed) {
    const rand = mulberry32(seed);
    const start = -Math.PI * 0.62 + (rand() - 0.5) * 0.4;
    const sweep = Math.PI * 2 * (1.03 + rand() * 0.04);
    const ph = rand() * 6.283;
    const pts = [];
    const n = 80;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const a = start + sweep * t;
      const rr = r * (1 + 0.035 * Math.sin(a * 2 + ph)) - t * 1.6;
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    return pts;
  }

  // Shared gradients and filters, referenced by url(#id) from every inline SVG.
  const DEFS = `
    <linearGradient id="td-jade" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#55b39a"/><stop offset=".5" stop-color="#2b7a68"/><stop offset="1" stop-color="#16443a"/>
    </linearGradient>
    <linearGradient id="td-verm" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f08065"/><stop offset=".5" stop-color="#c23a2a"/><stop offset="1" stop-color="#7f1e10"/>
    </linearGradient>
    <linearGradient id="td-gloss" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <filter id="td-seal" filterUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
      <feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="2" seed="3" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" xChannelSelector="R" yChannelSelector="G" result="d"/>
      <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="1" seed="9" result="g"/>
      <feColorMatrix in="g" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  -3.2 0 0 0 1.45" result="speck"/>
      <feComposite in="speck" in2="d" operator="in" result="speckIn"/>
      <feComponentTransfer in="speckIn" result="speckSoft"><feFuncA type="linear" slope=".22"/></feComponentTransfer>
      <feMerge><feMergeNode in="d"/><feMergeNode in="speckSoft"/></feMerge>
    </filter>
    <filter id="td-brush" filterUnits="userSpaceOnUse" x="-10" y="-10" width="320" height="320">
      <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <filter id="td-wash" filterUnits="userSpaceOnUse" x="-10" y="-10" width="320" height="320">
      <feTurbulence type="fractalNoise" baseFrequency=".08" numOctaves="3" seed="12" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G" result="d"/>
      <feGaussianBlur in="d" stdDeviation="1.6"/>
    </filter>
    <filter id="td-glow" filterUnits="userSpaceOnUse" x="-20" y="-20" width="340" height="340">
      <feGaussianBlur stdDeviation="5"/>
    </filter>
    <filter id="td-title" x="-5%" y="-20%" width="110%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency=".55" numOctaves="2" seed="21" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G"/>
    </filter>`;

  function injectDefs() {
    if (document.getElementById('td-defs')) return;
    const holder = document.createElement('div');
    holder.innerHTML = `<svg id="td-defs" aria-hidden="true" focusable="false"
      style="position:absolute;width:0;height:0;overflow:hidden"><defs>${DEFS}</defs></svg>`;
    document.body.prepend(holder.firstElementChild);
  }

  // Faint engraved emblems behind the X / O marks.
  const MOTIFS = {
    X: `<path d="M22 68C30 46 44 80 54 58S70 32 77 37"/><path d="M76 31l1.5-7M80 32l6-5"/>
        <circle cx="78.5" cy="34.5" r="2.6" fill="${IVORY}" stroke="none"/><path d="M24 30q6-6 12 0q6-6 12 0"/>`,
    O: `<path d="M26 74C34 62 46 46 64 38"/><path d="M30 80C44 74 58 60 74 54"/><path d="M38 84C54 84 66 74 80 70"/>
        <circle cx="68" cy="32" r="3" fill="${IVORY}" stroke="none"/><path d="M68 28q2-9 10-10"/>`,
  };

  // A carved seal: square jade seal with X for the Dragon, round vermilion seal
  // with O for the Phoenix. Shape and letter both differ, not just the colour.
  function seal(side, opts = {}) {
    const seed = opts.seed ?? randomSeed();
    const motifOpacity = opts.motifOpacity ?? 0.2;
    const rand = mulberry32(seed);
    const j = () => (rand() - 0.5) * 4;
    let body;
    let letter;
    let gloss;
    if (side === 'X') {
      body = `<rect x="8" y="8" width="84" height="84" rx="16" fill="url(#td-jade)"/>
        <rect x="15.5" y="15.5" width="69" height="69" rx="10" fill="none" stroke="${IVORY}" stroke-opacity=".5" stroke-width="1.6"/>`;
      letter = `<path d="${brushPath([[31 + j(), 29 + j()], [50 + j(), 50 + j()], [70 + j(), 72 + j()]], 11, { seed: seed + 1, head: 0.1, tail: 0.35 })}"/>
        <path d="${brushPath([[69 + j(), 29 + j()], [50 + j(), 50 + j()], [30 + j(), 72 + j()]], 11, { seed: seed + 2, head: 0.1, tail: 0.35 })}"/>`;
      gloss = `<rect x="9" y="9" width="82" height="40" rx="15" fill="url(#td-gloss)"/>`;
    } else {
      body = `<circle cx="50" cy="50" r="42" fill="url(#td-verm)"/>
        <circle cx="50" cy="50" r="35" fill="none" stroke="${IVORY}" stroke-opacity=".5" stroke-width="1.6"/>`;
      letter = `<path d="${brushPath(ringPoints(50, 50, 20, seed), 10, { sampled: true, seed, head: 0.06, tail: 0.22, wobble: 0.15 })}"/>`;
      gloss = `<ellipse cx="50" cy="30" rx="32" ry="20" fill="url(#td-gloss)"/>`;
    }
    return `<svg class="seal seal-${side.toLowerCase()}" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <g filter="url(#td-seal)">${body}
        <g fill="none" stroke="${IVORY}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="${motifOpacity}">${MOTIFS[side]}</g>
        <g fill="${IVORY}">${letter}</g>
      </g>${gloss}</svg>`;
  }

  // Ink droplets thrown out when a seal is stamped.
  function splash(side, seed = randomSeed()) {
    const rand = mulberry32(seed);
    let dots = '';
    const count = 7 + Math.floor(rand() * 4);
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const r = 40 + rand() * 9;
      dots += `<circle cx="${(50 + Math.cos(a) * r).toFixed(1)}" cy="${(50 + Math.sin(a) * r).toFixed(1)}" r="${(1.2 + rand() * 2.8).toFixed(1)}"/>`;
    }
    return `<svg class="splash" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <circle cx="50" cy="50" r="44" fill="none" stroke="${SIDE_COLOR[side]}" stroke-width="2" opacity=".5"/>
      <g fill="${SIDE_COLOR[side]}">${dots}</g></svg>`;
  }

  // Board grid in a 300 x 300 space: four brush strokes over a soft ink wash.
  function gridSVG(seed = 7) {
    const rand = mulberry32(seed);
    const j = (amp) => (rand() - 0.5) * amp;
    const lines = [];
    for (const p of [100, 200]) {
      lines.push([[p + j(4), 8 + j(4)], [p + j(3), 150], [p + j(4), 292 + j(4)]]);
      lines.push([[8 + j(4), p + j(4)], [150, p + j(3)], [292 + j(4), p + j(4)]]);
    }
    let strokes = '';
    let wash = '';
    lines.forEach((pts, i) => {
      strokes += `<path d="${brushPath(pts, 6.5, { seed: seed + i * 13, head: 0.05, tail: 0.16, wobble: 0.18 })}"/>`;
      wash += `<path d="${brushPath(pts, 15, { seed: seed + i * 7, head: 0.1, tail: 0.2, wobble: 0.25 })}"/>`;
    });
    return `<svg class="grid-svg" viewBox="0 0 300 300" aria-hidden="true" focusable="false">
      <g fill="#2a2f31" opacity=".12" filter="url(#td-wash)">${wash}</g>
      <g fill="${INK}" opacity=".9" filter="url(#td-brush)">${strokes}</g></svg>`;
  }

  let winMaskCount = 0;

  // Brush stroke through the three winning cells, revealed by an animated mask.
  function winLineSVG(line, side, seed = randomSeed()) {
    const rand = mulberry32(seed);
    const center = (i) => [50 + (i % 3) * 100, 50 + Math.floor(i / 3) * 100];
    const a = center(line[0]);
    const b = center(line[2]);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ux = (b[0] - a[0]) / len;
    const uy = (b[1] - a[1]) / len;
    const ext = 30;
    const p0 = [a[0] - ux * ext, a[1] - uy * ext];
    const p2 = [b[0] + ux * ext, b[1] + uy * ext];
    const bow = (rand() - 0.5) * 8;
    const mid = [(p0[0] + p2[0]) / 2 - uy * bow, (p0[1] + p2[1]) / 2 + ux * bow];
    const d = brushPath([p0, mid, p2], 17, { seed, head: 0.06, tail: 0.3, wobble: 0.2 });
    const m0 = [p0[0] - ux * 20, p0[1] - uy * 20];
    const m2 = [p2[0] + ux * 20, p2[1] + uy * 20];
    const id = 'td-win-mask-' + (++winMaskCount);
    const color = SIDE_COLOR[side];
    return `<svg class="win-svg" viewBox="0 0 300 300" aria-hidden="true" focusable="false">
      <defs><mask id="${id}" maskUnits="userSpaceOnUse" x="-20" y="-20" width="340" height="340">
        <path class="win-reveal" d="M${m0[0].toFixed(1)} ${m0[1].toFixed(1)}L${m2[0].toFixed(1)} ${m2[1].toFixed(1)}"
          pathLength="1" stroke="#fff" stroke-width="44" fill="none"/>
      </mask></defs>
      <g mask="url(#${id})">
        <path d="${d}" fill="${color}" opacity=".4" filter="url(#td-glow)"/>
        <path d="${d}" fill="${color}" opacity=".82" filter="url(#td-brush)"/>
      </g></svg>`;
  }

  // Rice-paper grain tile, used both by the landscape and (as a data URL) by CSS.
  function paperTexture(size = 320, seed = 11) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const rand = mulberry32(seed);
    const img = g.createImageData(size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = rand() < 0.5 ? 90 : 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = Math.floor(rand() * rand() * 26);
    }
    g.putImageData(img, 0, 0);
    g.lineCap = 'round';
    for (let k = 0; k < 70; k++) {
      const x = rand() * size;
      const y = rand() * size;
      const a = rand() * Math.PI * 2;
      const l = 6 + rand() * 22;
      g.strokeStyle = `rgba(120,96,60,${(0.04 + rand() * 0.06).toFixed(3)})`;
      g.lineWidth = 0.4 + rand() * 0.6;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a + 0.5) * l * 0.5, y + Math.sin(a + 0.5) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
    return c;
  }

  // ---------------------------------------------------------------------------
  // Animated ink-wash landscape drawn on the full-window background canvas.

  function midpoint(n, rand, rough) {
    const h = new Float32Array(n);
    h[0] = rand();
    h[n - 1] = rand();
    let step = n - 1;
    let amp = 1;
    while (step > 1) {
      const half = step >> 1;
      for (let i = half; i < n - 1; i += step) {
        h[i] = (h[i - half] + h[i + half]) / 2 + (rand() - 0.5) * amp;
      }
      step = half;
      amp *= rough;
    }
    let min = Infinity;
    let max = -Infinity;
    for (const v of h) { min = Math.min(min, v); max = Math.max(max, v); }
    for (let i = 0; i < n; i++) h[i] = (h[i] - min) / (max - min || 1);
    return h;
  }

  const RANGES = {
    far: {
      base: 0.66, amp: 0.36, fade: 0.12, rgb: [96, 118, 126], alpha: 0.3, blur: 2.5, rough: 0.55, seed: 101,
      peaks: [[0.06, 0.8, 0.05], [0.17, 1, 0.045], [0.29, 0.55, 0.06], [0.64, 0.6, 0.05], [0.76, 0.95, 0.045], [0.88, 0.7, 0.05], [0.97, 0.9, 0.05]],
    },
    mid: {
      base: 0.79, amp: 0.3, fade: 0.1, rgb: [58, 86, 80], alpha: 0.42, blur: 1, rough: 0.55, seed: 202,
      peaks: [[0.02, 0.9, 0.05], [0.12, 0.6, 0.04], [0.305, 0.62, 0.035], [0.7, 0.55, 0.05], [0.84, 0.85, 0.045], [0.95, 0.7, 0.05]],
    },
    near: {
      base: 0.94, amp: 0.22, fade: 0.08, rgb: [30, 42, 40], alpha: 0.68, blur: 0, rough: 0.6, seed: 303,
      peaks: [[0, 1, 0.07], [0.15, 0.55, 0.06], [0.85, 0.6, 0.06], [1, 1, 0.07]],
    },
  };

  class BackgroundScene {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.reduced = false;
      this.raf = 0;
      this.last = 0;
      this.par = { x: 0, y: 0 };
      this.target = { x: 0, y: 0 };
      this.paper = paperTexture(256, 5);
      this.resize();
      let timer = 0;
      window.addEventListener('resize', () => {
        clearTimeout(timer);
        timer = setTimeout(() => this.resize(), 120);
      });
      window.addEventListener('pointermove', (e) => {
        this.target.x = (e.clientX / this.W - 0.5) * 2;
        this.target.y = (e.clientY / this.H - 0.5) * 2;
      }, { passive: true });
    }

    setReducedMotion(reduced) {
      this.reduced = reduced;
      cancelAnimationFrame(this.raf);
      this.par.x = this.par.y = 0;
      if (reduced) this.draw(0);
      else this.start();
    }

    start() {
      cancelAnimationFrame(this.raf);
      this.last = performance.now();
      const frame = (now) => {
        const dt = Math.min(0.05, (now - this.last) / 1000);
        this.last = now;
        this.par.x += (this.target.x - this.par.x) * Math.min(1, dt * 2);
        this.par.y += (this.target.y - this.par.y) * Math.min(1, dt * 2);
        this.draw(dt);
        this.raf = requestAnimationFrame(frame);
      };
      this.raf = requestAnimationFrame(frame);
    }

    resize() {
      this.dpr = Math.min(1.5, window.devicePixelRatio || 1);
      this.W = window.innerWidth;
      this.H = window.innerHeight;
      this.M = Math.round(Math.min(this.W, this.H) * 0.03) + 8; // parallax margin
      this.canvas.width = Math.round(this.W * this.dpr);
      this.canvas.height = Math.round(this.H * this.dpr);
      this.build();
      this.draw(0);
    }

    layer(withMargin) {
      const m = withMargin ? this.M : 0;
      const c = document.createElement('canvas');
      c.width = Math.round((this.W + 2 * m) * this.dpr);
      c.height = Math.round((this.H + 2 * m) * this.dpr);
      const g = c.getContext('2d');
      g.setTransform(this.dpr, 0, 0, this.dpr, m * this.dpr, m * this.dpr);
      return { c, g };
    }

    build() {
      const { W, H } = this;
      const rand = mulberry32(42);

      const sky = this.layer(false);
      const bg = sky.g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#f5ecd9');
      bg.addColorStop(0.6, '#f1e6cf');
      bg.addColorStop(1, '#e9dcc0');
      sky.g.fillStyle = bg;
      sky.g.fillRect(0, 0, W, H);
      const glow = sky.g.createRadialGradient(W * 0.5, H * 0.1, 0, W * 0.5, H * 0.1, Math.max(W, H) * 0.6);
      glow.addColorStop(0, 'rgba(255,252,242,.7)');
      glow.addColorStop(1, 'rgba(255,252,242,0)');
      sky.g.fillStyle = glow;
      sky.g.fillRect(0, 0, W, H);
      const sx = W * 0.79;
      const sy = H * 0.15;
      const sr = Math.min(W, H) * 0.065;
      const sun = sky.g.createRadialGradient(sx, sy, 0, sx, sy, sr * 1.25);
      sun.addColorStop(0, 'rgba(214,78,54,.5)');
      sun.addColorStop(0.75, 'rgba(206,70,48,.42)');
      sun.addColorStop(1, 'rgba(206,70,48,0)');
      sky.g.fillStyle = sun;
      sky.g.beginPath();
      sky.g.arc(sx, sy, sr * 1.25, 0, Math.PI * 2);
      sky.g.fill();
      sky.g.globalAlpha = 0.55;
      sky.g.fillStyle = sky.g.createPattern(this.paper, 'repeat');
      sky.g.fillRect(0, 0, W, H);
      sky.g.globalAlpha = 1;
      this.sky = sky.c;

      const far = this.layer(true);
      this.range(far.g, RANGES.far);
      this.far = far.c;

      const mid = this.layer(true);
      const ridge = this.range(mid.g, RANGES.mid);
      this.pavilion(mid.g, W * 0.305, ridge(W * 0.305), H / 900, RANGES.mid.rgb);
      this.mid = mid.c;

      const near = this.layer(true);
      this.range(near.g, RANGES.near);
      const bamboo = [
        [-0.012, 1.0, 0.75], [0.018, 0.85, 0.5], [0.042, 0.95, 0.9], [0.065, 0.7, 0.4],
        [0.95, 0.8, 0.45], [0.975, 1.0, 0.85], [1.005, 0.9, 0.6],
      ];
      for (const [u, s, a] of bamboo) this.bamboo(near.g, W * u, s, a, rand);
      this.near = near.c;

      const vig = this.layer(false);
      const v = vig.g.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.35, W / 2, H * 0.45, Math.hypot(W, H) * 0.62);
      v.addColorStop(0, 'rgba(70,50,25,0)');
      v.addColorStop(1, 'rgba(70,50,25,.24)');
      vig.g.fillStyle = v;
      vig.g.fillRect(0, 0, W, H);
      this.vignette = vig.c;

      this.mist = Array.from({ length: 7 }, (_, i) => ({
        x: rand() * W,
        y: H * (0.55 + rand() * 0.35),
        rx: W * (0.22 + rand() * 0.22),
        ry: H * (0.035 + rand() * 0.04),
        speed: 4 + rand() * 9,
        alpha: 0.35 + rand() * 0.3,
        front: i % 2 === 1,
      }));
      this.motes = Array.from({ length: 24 }, () => ({
        x: rand() * W,
        y: rand() * H,
        r: 0.8 + rand() * 1.6,
        vy: 4 + rand() * 8,
        phase: rand() * 6.283,
        alpha: 0.2 + rand() * 0.35,
      }));
    }

    // Draws one mountain range and returns a function giving its ridge height at x.
    range(g, cfg) {
      const { W, H, M } = this;
      const rand = mulberry32(cfg.seed);
      const n = 257;
      const noise = midpoint(n, rand, cfg.rough);
      const ys = new Float32Array(n);
      g.beginPath();
      for (let i = 0; i < n; i++) {
        const x = -M + (i / (n - 1)) * (W + 2 * M);
        const ux = x / W;
        let peak = 0;
        for (const [pu, ph, pw] of cfg.peaks) {
          peak = Math.max(peak, ph * Math.exp(-((ux - pu) ** 2) / (2 * pw * pw)));
        }
        ys[i] = H * cfg.base - H * cfg.amp * (peak * 0.85 + noise[i] * 0.22);
        if (i === 0) g.moveTo(x, ys[i]);
        else g.lineTo(x, ys[i]);
      }
      g.lineTo(W + M, H + M);
      g.lineTo(-M, H + M);
      g.closePath();
      const [r, gr, b] = cfg.rgb;
      const top = H * (cfg.base - cfg.amp);
      const grad = g.createLinearGradient(0, top, 0, H * (cfg.base + cfg.fade));
      grad.addColorStop(0, `rgba(${r},${gr},${b},${cfg.alpha})`);
      grad.addColorStop(0.55, `rgba(${r},${gr},${b},${cfg.alpha * 0.7})`);
      grad.addColorStop(1, `rgba(${r},${gr},${b},0)`);
      g.fillStyle = grad;
      if (cfg.blur) g.filter = `blur(${cfg.blur}px)`;
      g.fill();
      g.filter = 'none';
      return (x) => {
        const i = Math.round(((x + M) / (W + 2 * M)) * (n - 1));
        return ys[Math.max(0, Math.min(n - 1, i))];
      };
    }

    pavilion(g, cx, y, s, rgb) {
      g.fillStyle = `rgba(${rgb[0] - 20},${rgb[1] - 30},${rgb[2] - 28},.62)`;
      const roof = (by, hw, h) => {
        g.beginPath();
        g.moveTo(cx - hw, by - h * 0.35);
        g.quadraticCurveTo(cx, by + h * 0.25, cx + hw, by - h * 0.35);
        g.quadraticCurveTo(cx + hw * 0.6, by - h * 0.35, cx + hw * 0.45, by - h);
        g.lineTo(cx - hw * 0.45, by - h);
        g.quadraticCurveTo(cx - hw * 0.6, by - h * 0.35, cx - hw, by - h * 0.35);
        g.fill();
      };
      y += 2 * s;
      g.fillRect(cx - 22 * s, y - 5 * s, 44 * s, 5 * s);
      g.fillRect(cx - 15 * s, y - 19 * s, 2.5 * s, 14 * s);
      g.fillRect(cx + 12.5 * s, y - 19 * s, 2.5 * s, 14 * s);
      roof(y - 17 * s, 31 * s, 12 * s);
      g.fillRect(cx - 9 * s, y - 33 * s, 18 * s, 5 * s);
      roof(y - 31 * s, 21 * s, 10 * s);
      g.fillRect(cx - 0.8 * s, y - 47 * s, 1.6 * s, 7 * s);
    }

    bamboo(g, x0, scale, alpha, rand) {
      const { H } = this;
      const s = (H / 900) * scale;
      const lean = (rand() - 0.5) * 0.14 * H;
      const thick = (9 + rand() * 6) * s;
      const at = (t) => [x0 + lean * t ** 1.6, H + 30 - t * (H + 80)];
      const color = `rgba(26,40,34,${alpha})`;
      const segs = 6 + Math.floor(rand() * 3);
      g.lineCap = 'butt';
      for (let k = 0; k < segs; k++) {
        const t0 = k / segs + 0.006;
        const t1 = (k + 1) / segs - 0.006;
        const a = at(t0);
        const b = at(t1);
        const grad = g.createLinearGradient(a[0] - thick / 2, 0, a[0] + thick / 2, 0);
        grad.addColorStop(0, color);
        grad.addColorStop(0.5, `rgba(26,40,34,${alpha * 0.72})`);
        grad.addColorStop(1, color);
        g.strokeStyle = grad;
        g.lineWidth = thick * (1 - k * 0.05);
        g.beginPath();
        g.moveTo(a[0], a[1]);
        g.lineTo(b[0], b[1]);
        g.stroke();
        g.strokeStyle = `rgba(20,30,26,${Math.min(1, alpha + 0.15)})`;
        g.lineWidth = 2.2 * s;
        g.beginPath();
        g.moveTo(b[0] - thick * 0.62, b[1]);
        g.lineTo(b[0] + thick * 0.62, b[1]);
        g.stroke();
        if (k >= 2 && rand() < 0.75) this.leaves(g, b[0], b[1], s, alpha, rand);
      }
    }

    leaves(g, x, y, s, alpha, rand) {
      const count = 3 + Math.floor(rand() * 3);
      const dir = rand() < 0.5 ? -1 : 1;
      for (let i = 0; i < count; i++) {
        const ang = Math.PI / 2 + dir * (0.5 + rand() * 1.1) - dir * 0.1 * i;
        const len = (55 + rand() * 60) * s;
        const w = (7 + rand() * 5) * s;
        const tx = x + Math.cos(ang) * len;
        const ty = y + Math.sin(ang) * len * 0.55 + len * 0.25;
        const nx = -Math.sin(ang);
        const ny = Math.cos(ang);
        const mx = (x + tx) / 2;
        const my = (y + ty) / 2;
        g.fillStyle = `rgba(26,44,36,${(alpha * (0.6 + rand() * 0.4)).toFixed(3)})`;
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(mx + nx * w, my + ny * w, tx, ty);
        g.quadraticCurveTo(mx - nx * w * 0.6, my - ny * w * 0.6, x, y);
        g.fill();
      }
    }

    blit(img, depth) {
      const { W, H, M } = this;
      this.ctx.drawImage(img, -M - this.par.x * depth * M * 0.8, -M - this.par.y * depth * M * 0.5, W + 2 * M, H + 2 * M);
    }

    drawMist(front, dt) {
      const g = this.ctx;
      for (const m of this.mist) {
        if (m.front !== front) continue;
        m.x += m.speed * dt;
        if (m.x - m.rx > this.W) m.x = -m.rx;
        g.save();
        g.translate(m.x, m.y);
        g.scale(1, m.ry / m.rx);
        const grad = g.createRadialGradient(0, 0, 0, 0, 0, m.rx);
        grad.addColorStop(0, `rgba(250,246,236,${m.alpha})`);
        grad.addColorStop(1, 'rgba(250,246,236,0)');
        g.fillStyle = grad;
        g.beginPath();
        g.arc(0, 0, m.rx, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    }

    draw(dt) {
      const g = this.ctx;
      const { W, H } = this;
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      g.drawImage(this.sky, 0, 0, W, H);
      this.blit(this.far, 0.25);
      this.drawMist(false, dt);
      this.blit(this.mid, 0.55);
      this.drawMist(true, dt);
      this.blit(this.near, 1);
      for (const p of this.motes) {
        p.y -= p.vy * dt;
        p.phase += dt * 0.8;
        if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
        g.fillStyle = `rgba(190,150,80,${(p.alpha * (0.7 + 0.3 * Math.sin(p.phase * 2))).toFixed(3)})`;
        g.beginPath();
        g.arc(p.x + Math.sin(p.phase) * 12, p.y, p.r, 0, Math.PI * 2);
        g.fill();
      }
      g.drawImage(this.vignette, 0, 0, W, H);
    }
  }

  root.TwoDragonsArt = {
    injectDefs, seal, splash, gridSVG, winLineSVG, paperTexture, brushPath, BackgroundScene,
  };
})(window);
