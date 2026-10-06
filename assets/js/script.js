/**
 * Hero — mobile hamburger menu
 */
document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('.hero-header');
  const toggle = header && header.querySelector('.hero-hamburger');
  if (!toggle) return;

  const setOpen = (open) => {
    header.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  };

  toggle.addEventListener('click', () => setOpen(!header.classList.contains('is-open')));

  header.querySelectorAll('.hero-nav a').forEach((link) => {
    link.addEventListener('click', () => setOpen(false));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });
});

/**
 * Especialistas — Lanyard Badge (vanilla port of the 21st.dev React component).
 * Two strands come down from above the frame and meet at a side-release buckle; a short strap and a
 * ring hold the card. The strap is a verlet rope drawn as a textured ribbon on a 2D canvas, and the
 * card is real HTML turned in 3D with CSS. Drag the card and the strap pulls taut; flick it sideways
 * and it spins on the ring; tap it (or press Enter) to flip it over.
 *
 * Every [data-lanyard] element gets its own LanyardBadge instance with its own points, canvas,
 * animation loop and listeners, so any number of badges can run side by side.
 * Options (data attributes): data-strap-text, data-strap-label, data-strap-color, data-ink-color,
 * data-card-width, data-enter ("left" | "right") and data-phase (seconds of draught offset).
 */
(() => {
  /** Verlet step. `w` is inverse mass; 0 pins a point in place. */
  function integrate(pts, dt, gravity, damping) {
    for (const p of pts) {
      if (!p.w) continue;
      const vx = (p.x - p.px) * damping;
      const vy = (p.y - p.py) * damping;
      p.px = p.x;
      p.py = p.y;
      p.x += vx;
      p.y += vy + gravity * dt * dt;
    }
  }

  /** Relax distance constraints, heavier points moving less. */
  function solve(pts, links, iterations) {
    for (let k = 0; k < iterations; k++) {
      for (const [i, j, rest] of links) {
        const a = pts[i];
        const b = pts[j];
        const ws = a.w + b.w;
        if (!ws) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1e-6;
        const f = (d - rest) / (d * ws);
        a.x += dx * f * a.w;
        a.y += dy * f * a.w;
        b.x -= dx * f * b.w;
        b.y -= dy * f * b.w;
      }
    }
  }

  /**
   * The card's turn on the ring. The strap's own twist is the spring pulling it
   * back to `target`; `drive` is whatever is twisting it right now.
   */
  function spinStep(s, target, dt, drive) {
    s.v += (-(s.a - target) * 18 - s.v * 3.2 + drive) * dt;
    s.a += s.v * dt;
  }

  /** How far the card swings from hanging straight down, in radians. Right is positive. */
  function swingAngle(top, bottom) {
    return Math.atan2(bottom.x - top.x, bottom.y - top.y);
  }

  const STEP = 1 / 120;
  const GRAVITY = 2400;
  const ITER = 18;
  const N = 14;

  const DISPLAY = '"Plus Jakarta Sans", "Helvetica Neue", Arial, sans-serif';
  const SCRIPT = '"Instrument Serif", Georgia, serif';

  const DEFAULTS = {
    strapText: 'corpo em foco',
    strapLabel: 'CLÍNICA MOOVE',
    strapColor: '#763536',
    inkColor: '#EADFCF',
    cardWidth: 260,
    enter: 1,
    phase: 0,
    labelShowBack: 'Ver verso',
    labelShowFront: 'Ver frente',
  };

  /** A mandala: rings, petals, a bead circle and a flower in the middle. */
  function drawMandala(ctx, cx, cy, r) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineWidth = Math.max(0.8, r * 0.018);
    for (const k of [1, 0.9, 0.62, 0.26]) {
      ctx.beginPath();
      ctx.arc(0, 0, r * k, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let i = 0; i < 16; i++) {
      ctx.save();
      ctx.rotate((i / 16) * Math.PI * 2);
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.76, r * 0.07, r * 0.13, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.rotate(Math.PI / 16);
      ctx.beginPath();
      ctx.arc(0, -r * 0.95, r * 0.018, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    for (let i = 0; i < 8; i++) {
      ctx.save();
      ctx.rotate((i / 8) * Math.PI * 2);
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.26);
      ctx.bezierCurveTo(r * 0.12, -r * 0.4, r * 0.1, -r * 0.52, 0, -r * 0.6);
      ctx.bezierCurveTo(-r * 0.1, -r * 0.52, -r * 0.12, -r * 0.4, 0, -r * 0.26);
      ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * The printed strap, `length` css px long, laid out along the canvas height so
   * each rope segment can crop its own slice. Returns a canvas in device px.
   */
  function makeStrap(length, width, dpr, opts) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(width * dpr));
    c.height = Math.max(1, Math.round(length * dpr));
    const ctx = c.getContext('2d');
    // strap space: x runs down the strap, y runs across it
    ctx.setTransform(0, dpr, -dpr, 0, c.width, 0);
    ctx.fillStyle = opts.color;
    ctx.fillRect(0, 0, length, width);
    ctx.strokeStyle = ctx.fillStyle = opts.ink;

    if (!opts.plain) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, length, width);
      ctx.clip();
      ctx.textBaseline = 'middle';
      const scriptFont = 'italic 400 ' + Math.round(width * 0.62) + 'px ' + SCRIPT;
      const labelFont = '800 ' + Math.round(width * 0.32) + 'px ' + DISPLAY;
      ctx.font = scriptFont;
      const scriptW = ctx.measureText(opts.text).width;
      ctx.font = labelFont;
      const labelW = ctx.measureText(opts.label).width;
      const gap = width * 0.6;
      let x = width * 0.4;
      let flip = 1;
      while (x < length) {
        // a mandala too big for the strap, so only an arc of it shows
        ctx.globalAlpha = 0.55;
        drawMandala(ctx, x + width * 1.3, width * (0.5 + flip * 0.28), width * 1.35);
        x += width * 2.8;
        ctx.globalAlpha = 0.95;
        ctx.font = scriptFont;
        ctx.fillText(opts.text, x, width * 0.52);
        x += scriptW + gap;
        if (opts.label) {
          ctx.font = labelFont;
          ctx.fillText('-  ' + opts.label + '  -', x, width * 0.53);
          x += labelW + ctx.measureText('-    -').width + gap;
        }
        flip = -flip;
      }
      ctx.restore();
    }

    // woven edges catch a little light
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 1.5);
    ctx.lineTo(length, 1.5);
    ctx.moveTo(0, width - 1.5);
    ctx.lineTo(length, width - 1.5);
    ctx.stroke();
    return c;
  }

  function roundRect(ctx, x, y, w, h, r) {
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }

  /** Ornament and arrow artwork for the card faces, shared by every badge through <use>. */
  function ensureSprite() {
    if (document.getElementById('lyd-ornament')) return;
    const ring = Array.from({ length: 16 }, (_, i) => i * 22.5);
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0;overflow:hidden">' +
      '<symbol id="lyd-ornament" viewBox="-100 -100 200 200">' +
      '<g fill="none" stroke="currentColor" stroke-width="1.4">' +
      '<circle r="96"/><circle r="86"/><circle r="60"/><circle r="25"/>' +
      ring.map((a) => '<ellipse cx="0" cy="-73" rx="6.5" ry="12" transform="rotate(' + a + ')"/>').join('') +
      ring.map((a) => '<circle cx="0" cy="-91" r="1.8" fill="currentColor" transform="rotate(' + (a + 11.25) + ')"/>').join('') +
      ring.slice(0, 8).map((_, i) => '<path d="M0 -25 C 12 -38, 10 -50, 0 -58 C -10 -50, -12 -38, 0 -25" transform="rotate(' + i * 45 + ')"/>').join('') +
      '<circle r="6" fill="currentColor"/>' +
      '</g></symbol>' +
      '<symbol id="lyd-arrow" viewBox="0 0 20 200">' +
      '<path fill="none" stroke="currentColor" stroke-width="1.4" d="M10 4 L10 196 M3 18 L10 4 L17 18 M4 182 L10 170 L16 182 M4 194 L10 182 L16 194"/>' +
      '</symbol></svg>';
    document.body.insertAdjacentHTML('afterbegin', svg);
  }

  // The strap print is baked into a canvas, so it has to be redrawn once the web fonts arrive
  const fontsReady = document.fonts && document.fonts.load
    ? Promise.all([
      document.fonts.load('italic 400 20px "Instrument Serif"'),
      document.fonts.load('800 20px "Plus Jakarta Sans"'),
    ]).catch(() => {})
    : Promise.resolve();

  class LanyardBadge {
    static fromElement(el) {
      const d = el.dataset;
      const opts = {};
      if (d.strapText) opts.strapText = d.strapText;
      if (d.strapLabel !== undefined) opts.strapLabel = d.strapLabel;
      if (d.strapColor) opts.strapColor = d.strapColor;
      if (d.inkColor) opts.inkColor = d.inkColor;
      if (d.cardWidth) opts.cardWidth = parseFloat(d.cardWidth) || DEFAULTS.cardWidth;
      if (d.enter) opts.enter = d.enter === 'left' ? -1 : 1;
      if (d.phase) opts.phase = parseFloat(d.phase) || 0;
      return new LanyardBadge(el, opts);
    }

    constructor(root, options = {}) {
      this.root = root;
      this.opts = Object.assign({}, DEFAULTS, options);
      this.canvas = root.querySelector('[data-lanyard-canvas]');
      this.card = root.querySelector('[data-lanyard-card]');
      this.inner = root.querySelector('[data-lanyard-inner]');
      this.flipBtn = root.querySelector('[data-lanyard-flip]');
      this.flipLabel = root.querySelector('[data-lanyard-flip-label]');
      this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
      if (!this.card || !this.inner || !this.ctx) return;

      this.pts = [];
      this.links = [];
      this.left = [];
      this.right = [];
      this.low = [];
      this.iB = 0;
      this.iT = 0;
      this.iC = 0;
      this.strandRest = 1;
      this.dpr = 1;
      this.W = 1;
      this.H = 1;
      this.geo = null;
      this.strapTex = null;
      this.plainTex = null;
      this.spinTarget = 0;
      this.spin = { a: 0, v: 0 };
      this.drag = null;
      this.raf = 0;
      this.acc = 0;
      this.last = 0;
      this.t = this.opts.phase;
      this.alive = true;

      this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reduced = this.motionQuery.matches;

      this.tick = this.tick.bind(this);
      this.onDown = this.onDown.bind(this);
      this.onMove = this.onMove.bind(this);
      this.onUp = this.onUp.bind(this);
      this.onKey = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.flip();
        }
      };
      this.onFlipClick = () => this.flip();
      this.onMotionChange = (e) => {
        this.reduced = e.matches;
        this.spin.a = this.spinTarget;
        this.spin.v = 0;
        this.t = this.opts.phase;
        this.build();
        this.draw();
        this.place();
      };

      this.card.addEventListener('pointerdown', this.onDown);
      this.card.addEventListener('pointermove', this.onMove);
      this.card.addEventListener('pointerup', this.onUp);
      this.card.addEventListener('pointercancel', this.onUp);
      this.card.addEventListener('keydown', this.onKey);
      if (this.flipBtn) this.flipBtn.addEventListener('click', this.onFlipClick);
      this.motionQuery.addEventListener('change', this.onMotionChange);

      this.setShowBack(false);
      this.build();
      this.draw();
      this.place();

      this.resizeObserver = new ResizeObserver(() => {
        if (Math.abs(root.clientWidth - this.W) < 1 && Math.abs(root.clientHeight - this.H) < 1) return;
        this.build();
        this.draw();
        this.place();
      });
      this.resizeObserver.observe(root);

      // Only simulate while on screen, so the entrance swing plays when the visitor reaches it
      if ('IntersectionObserver' in window) {
        this.visibilityObserver = new IntersectionObserver((entries) => {
          if (entries[entries.length - 1].isIntersecting) this.start();
          else this.stop();
        });
        this.visibilityObserver.observe(root);
      } else {
        this.start();
      }

      fontsReady.then(() => {
        if (!this.alive || !this.geo) return;
        this.makeTextures();
        this.draw();
      });
    }

    // ---- geometry ---------------------------------------------------------
    measure() {
      const cw = Math.round(Math.max(160, Math.min(this.opts.cardWidth, this.W * 0.74)));
      const ch = Math.round(cw * 1.5);
      const ringR = Math.max(7, Math.round(cw * 0.036));
      const clipH = Math.round(cw * 0.1);
      const sw = Math.max(14, Math.round(cw * 0.1)); // strap width
      const lowLen = sw * 2.2; // buckle to ring
      const arm = ringR * 2 + clipH + ch * 0.55; // ring to the card's centre of mass
      this.geo = { cw, ch, ringR, clipH, sw, lowLen, arm };

      const style = this.root.style;
      style.setProperty('--lyd-cw', cw + 'px');
      style.setProperty('--lyd-ch', ch + 'px');
      style.setProperty('--lyd-ring', ringR + 'px');
      style.setProperty('--lyd-clip', clipH + 'px');
      style.setProperty('--lyd-s', (cw / 240).toFixed(4));
    }

    add(x, y, w) {
      this.pts.push({ x, y, px: x, py: y, w });
      return this.pts.length - 1;
    }

    strand(from, to, n, slack) {
      const a = this.pts[from];
      const b = this.pts[to];
      const rest = (Math.hypot(b.x - a.x, b.y - a.y) * slack) / n;
      const ids = [from];
      for (let i = 1; i < n; i++) ids.push(this.add(a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n, 1));
      ids.push(to);
      for (let i = 0; i < n; i++) this.links.push([ids[i], ids[i + 1], rest]);
      return { ids, rest };
    }

    build() {
      const { root, canvas } = this;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.W = Math.max(1, root.clientWidth);
      this.H = Math.max(1, root.clientHeight);
      canvas.width = Math.round(this.W * this.dpr);
      canvas.height = Math.round(this.H * this.dpr);
      this.measure();

      const { cw, ch, ringR, clipH, sw, lowLen, arm } = this.geo;
      const W = this.W;
      const H = this.H;
      this.pts = [];
      this.links = [];
      const cx = W / 2;
      const spread = Math.min(W * 0.16, cw * 0.55);
      const top = -sw * 2;
      // hang the buckle so the whole card fits, but never above a sixth of the frame
      const bY = Math.max(H * 0.16, Math.min(H * 0.42, H - (lowLen + ringR * 2 + clipH + ch) - 28));

      const aL = this.add(cx - spread, top, 0);
      this.iB = this.add(cx, bY, 1.4);
      const l = this.strand(aL, this.iB, N, 1.03);
      const aR = this.add(cx + spread, top, 0);
      const r = this.strand(aR, this.iB, N, 1.03);
      this.iT = this.add(cx, bY + lowLen, 0.8);
      const lo = this.strand(this.iB, this.iT, 3, 1);
      this.iC = this.add(cx, bY + lowLen + arm, 0.25);
      this.links.push([this.iT, this.iC, arm]);
      this.left = l.ids;
      this.right = r.ids;
      this.low = lo.ids;
      this.strandRest = l.rest;

      this.makeTextures();

      if (this.reduced) {
        for (let i = 0; i < 900; i++) {
          integrate(this.pts, STEP, GRAVITY, 0.98);
          solve(this.pts, this.links, ITER);
        }
      } else {
        // enter mid-swing, as if someone just let go of it
        const dir = this.opts.enter;
        const C = this.pts[this.iC];
        C.x += cw * 0.55 * dir;
        C.px = C.x - 2 * dir;
        this.spin.v = 5 * dir;
      }
    }

    makeTextures() {
      const { sw, lowLen } = this.geo;
      const o = this.opts;
      const opts = { color: o.strapColor, ink: o.inkColor, text: o.strapText, label: o.strapLabel };
      this.strapTex = makeStrap(this.strandRest * N + 4, sw, this.dpr, opts);
      this.plainTex = makeStrap(lowLen + 4, sw * 0.8, this.dpr, Object.assign({}, opts, { plain: true }));
    }

    // ---- drawing ----------------------------------------------------------
    ribbon(ids, tex, rest, light) {
      const { ctx, pts, dpr } = this;
      const Wt = tex.width;
      for (let i = 0; i < ids.length - 1; i++) {
        const a = pts[ids[i]];
        const b = pts[ids[i + 1]];
        const dx = (b.x - a.x) * dpr;
        const dy = (b.y - a.y) * dpr;
        const len = Math.hypot(dx, dy) || 1e-6;
        const tx = dx / len;
        const ty = dy / len;
        // glyph tops face +n; this pairing keeps the print readable, not mirrored
        const nx = ty;
        const ny = -tx;
        const v0 = i * rest * dpr;
        const dv = rest * dpr;
        const k = len / dv;
        ctx.setTransform(nx, ny, tx * k, ty * k, a.x * dpr - (nx * Wt) / 2 - tx * k * v0, a.y * dpr - (ny * Wt) / 2 - ty * k * v0);
        // +1.5 overlaps the next slice, so bends never show a hairline seam
        const src = Math.min(dv + 1.5, tex.height - v0);
        if (src > 0) ctx.drawImage(tex, 0, v0, Wt, src, 0, v0, Wt, src);
        // a strand turned away from the light reads darker, which sells the 3D
        const shade = 0.22 * (1 - Math.max(0, nx * light));
        ctx.fillStyle = 'rgba(0,0,0,' + shade.toFixed(3) + ')';
        ctx.fillRect(0, v0, Wt, dv + 1);
      }
    }

    metal(x0, y0, x1, y1) {
      const g = this.ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, '#f4efe4');
      g.addColorStop(0.45, '#b9b0a0');
      g.addColorStop(0.55, '#8f8778');
      g.addColorStop(1, '#ece6da');
      return g;
    }

    draw() {
      const { ctx, canvas, pts, dpr } = this;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!this.strapTex || !this.plainTex) return;
      const { sw, lowLen, ringR } = this.geo;
      ctx.imageSmoothingEnabled = true;
      this.ribbon(this.left, this.strapTex, this.strandRest, -1);
      this.ribbon(this.right, this.strapTex, this.strandRest, 1);
      this.ribbon(this.low, this.plainTex, (lowLen * 1) / 3, 0);

      // side-release buckle, turned to follow the short strap
      const B = pts[this.iB];
      const T = pts[this.iT];
      const ang = Math.atan2(T.x - B.x, T.y - B.y);
      const u = sw / 20;
      ctx.setTransform(dpr, 0, 0, dpr, B.x * dpr, B.y * dpr);
      ctx.rotate(-ang);
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 6 * dpr;
      ctx.shadowOffsetY = 2 * dpr;
      ctx.fillStyle = this.metal(-16 * u, 0, 16 * u, 0);
      ctx.beginPath();
      roundRect(ctx, -15 * u, -14 * u, 30 * u, 17 * u, 3 * u);
      ctx.fill();
      ctx.beginPath();
      roundRect(ctx, -11 * u, 1 * u, 22 * u, 15 * u, [2 * u, 2 * u, 6 * u, 6 * u]);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = 'rgba(40,36,30,0.55)';
      ctx.fillRect(-10 * u, -9 * u, 20 * u, 2.2 * u);
      ctx.fillRect(-5 * u, 6 * u, 10 * u, 3 * u);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 0.8 * u;
      ctx.beginPath();
      ctx.moveTo(-13 * u, -12.5 * u);
      ctx.lineTo(13 * u, -12.5 * u);
      ctx.stroke();

      // split ring
      ctx.setTransform(dpr, 0, 0, dpr, T.x * dpr, (T.y + ringR * 0.8) * dpr);
      ctx.lineWidth = Math.max(2.5, ringR * 0.38);
      ctx.strokeStyle = this.metal(-ringR, -ringR, ringR, ringR);
      ctx.beginPath();
      ctx.arc(0, 0, ringR, 0, Math.PI * 2);
      ctx.stroke();
    }

    place() {
      const { cw, ringR } = this.geo;
      const T = this.pts[this.iT];
      const C = this.pts[this.iC];
      const swing = swingAngle(T, C);
      this.card.style.transform =
        'translate3d(' + (T.x - cw / 2).toFixed(2) + 'px,' + (T.y + ringR).toFixed(2) + 'px,0) rotate(' + (-swing).toFixed(4) + 'rad)';
      this.inner.style.transform = 'perspective(1100px) rotateY(' + this.spin.a.toFixed(4) + 'rad)';
      const edge = 1 - Math.abs(Math.cos(this.spin.a));
      this.inner.style.setProperty('--lyd-dim', (edge * 0.5).toFixed(3));
      this.inner.style.setProperty('--lyd-shine', (50 + Math.sin(this.spin.a) * 70 + swing * 90).toFixed(1) + '%');
    }

    // ---- interaction ------------------------------------------------------
    local(e) {
      const r = this.root.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    }

    flip() {
      this.spinTarget = this.spinTarget === 0 ? Math.PI : 0;
      this.setShowBack(this.spinTarget !== 0);
    }

    setShowBack(back) {
      const pressed = String(back);
      this.root.classList.toggle('is-back', back);
      this.card.setAttribute('aria-pressed', pressed);
      if (this.flipBtn) this.flipBtn.setAttribute('aria-pressed', pressed);
      if (this.flipLabel) this.flipLabel.textContent = back ? this.opts.labelShowFront : this.opts.labelShowBack;
    }

    onDown(e) {
      if (e.button > 0) return;
      const [x, y] = this.local(e);
      const T = this.pts[this.iT];
      this.drag = { id: e.pointerId, ox: T.x - x, oy: T.y - y, tx: T.x, ty: T.y, sx: x, sy: y, moved: false };
      T.w = 0;
      this.card.setPointerCapture(e.pointerId);
      this.card.style.cursor = 'grabbing';
    }

    onMove(e) {
      const drag = this.drag;
      if (!drag || e.pointerId !== drag.id) return;
      const [x, y] = this.local(e);
      drag.tx = x + drag.ox;
      drag.ty = y + drag.oy;
      if (Math.hypot(x - drag.sx, y - drag.sy) > 5) drag.moved = true;
    }

    onUp(e) {
      const drag = this.drag;
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.moved) this.flip();
      this.drag = null;
      this.pts[this.iT].w = 0.8;
      this.card.style.cursor = 'grab';
    }

    // ---- loop -------------------------------------------------------------
    tick(now) {
      this.acc += Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      const pts = this.pts;
      const drag = this.drag;
      let steps = 0;
      while (this.acc >= STEP && steps < 8) {
        this.acc -= STEP;
        steps++;
        this.t += STEP;
        const t = this.t;
        if (drag) {
          const T = pts[this.iT];
          T.px = T.x;
          T.py = T.y;
          T.x += (drag.tx - T.x) * 0.35;
          T.y += (drag.ty - T.y) * 0.35;
        }
        const C = pts[this.iC];
        if (!this.reduced && !drag) {
          // a draught in the room, so the badge is never perfectly still
          C.x += (22 * Math.sin(t * 0.7) + 12 * Math.sin(t * 1.9)) * STEP * STEP;
        }
        integrate(pts, STEP, GRAVITY, 0.992);
        solve(pts, this.links, ITER);
        const vx = (C.x - C.px) / STEP;
        spinStep(this.spin, this.spinTarget, STEP, vx * 0.03 + (this.reduced ? 0 : 0.6 * Math.sin(t * 0.5)));
      }
      this.draw();
      this.place();
      this.raf = requestAnimationFrame(this.tick);
    }

    start() {
      if (this.raf || !this.alive) return;
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    }

    stop() {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }

    destroy() {
      this.alive = false;
      this.stop();
      this.resizeObserver.disconnect();
      if (this.visibilityObserver) this.visibilityObserver.disconnect();
      this.card.removeEventListener('pointerdown', this.onDown);
      this.card.removeEventListener('pointermove', this.onMove);
      this.card.removeEventListener('pointerup', this.onUp);
      this.card.removeEventListener('pointercancel', this.onUp);
      this.card.removeEventListener('keydown', this.onKey);
      if (this.flipBtn) this.flipBtn.removeEventListener('click', this.onFlipClick);
      this.motionQuery.removeEventListener('change', this.onMotionChange);
    }
  }

  window.LanyardBadge = LanyardBadge;

  document.addEventListener('DOMContentLoaded', () => {
    const stages = document.querySelectorAll('[data-lanyard]');
    if (!stages.length) return;
    ensureSprite();
    stages.forEach((el) => LanyardBadge.fromElement(el));
  });
})();

/**
 * Ecossistema de Especialidades — pinned card stack (GSAP 3.12.5 + ScrollTrigger 3.12.5)
 * Cards share one grid cell and travel along one diagonal: the active card slides out to the top-left
 * while the next slides in from the bottom-right by the same vector, like a diagonal scroll.
 * The oversized counter and the active description are scrubbed on the same timeline.
 */
function setupPinnedStack(stackSection) {
  const cards = gsap.utils.toArray(stackSection.querySelectorAll('.team-card'));
  const texts = gsap.utils.toArray(stackSection.querySelectorAll('.team-description'));
  const counterTrack = stackSection.querySelector('.team-counter-track');
  const stack = stackSection.querySelector('.team-stack');
  const steps = cards.length;
  if (steps < 2 || !stack) return;

  const HOLD = 0.5;
  const TRANSITION = 1;
  // Slightly under one card so the incoming card's corner overlaps the outgoing one
  const DIAGONAL_STEP = 0.92;
  const stepX = () => stack.offsetWidth * DIAGONAL_STEP;
  const stepY = () => stack.offsetHeight * DIAGONAL_STEP;
  const stepStart = (k) => HOLD + k * (TRANSITION + HOLD);
  const stepMidpoints = Array.from({ length: steps - 1 }, (_, k) => stepStart(k) + TRANSITION / 2);

  cards.forEach((card, i) => gsap.set(card, { zIndex: i + 1 }));
  gsap.set(cards[0], { opacity: 1 });
  gsap.set(texts[0], { autoAlpha: 1 });

  let activeIndex = -1;
  const setActive = (index) => {
    if (index === activeIndex) return;
    activeIndex = index;
    cards.forEach((card, i) => {
      card.classList.toggle('is-active', i === index);
      card.setAttribute('aria-hidden', i === index ? 'false' : 'true');
    });
    texts.forEach((text, i) => {
      text.classList.toggle('is-active', i === index);
      text.setAttribute('aria-hidden', i === index ? 'false' : 'true');
    });
  };
  setActive(0);

  const tl = gsap.timeline({
    defaults: { ease: 'power1.inOut', duration: TRANSITION },
    scrollTrigger: {
      trigger: stackSection,
      pin: true,
      scrub: 0.65,
      start: 'top top',
      end: () => '+=' + Math.round(window.innerHeight * (steps - 1) * 1.1),
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
    onUpdate: () => {
      const time = tl.time();
      setActive(stepMidpoints.filter((mid) => time >= mid).length);
    },
  });

  for (let k = 0; k < steps - 1; k++) {
    const at = stepStart(k);

    // Same ease, duration and vector for both cards keeps the gap between them constant
    tl.to(cards[k], { x: () => -stepX(), y: () => -stepY() }, at);
    tl.fromTo(cards[k + 1],
      { x: () => stepX(), y: () => stepY() },
      { x: 0, y: 0 },
      at);

    tl.to(cards[k], { opacity: 0, duration: TRANSITION * 0.6, ease: 'power1.in' }, at + TRANSITION * 0.4);
    tl.fromTo(cards[k + 1],
      { opacity: 0 },
      { opacity: 1, duration: TRANSITION * 0.6, ease: 'power1.out' },
      at);

    if (counterTrack) {
      tl.to(counterTrack, { yPercent: -(100 / steps) * (k + 1) }, at);
    }

    if (texts[k] && texts[k + 1]) {
      tl.to(texts[k], { autoAlpha: 0, y: -24, duration: TRANSITION * 0.45 }, at);
      tl.fromTo(texts[k + 1],
        { autoAlpha: 0, y: 24 },
        { autoAlpha: 1, y: 0, duration: TRANSITION * 0.45 },
        at + TRANSITION * 0.55);
    }
  }

  // Trailing hold so the last card rests before the pin releases
  tl.to({}, { duration: HOLD });
}

document.addEventListener('DOMContentLoaded', () => {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);

  const reelTitle = document.querySelector('.curiosity-reel-title');
  if (reelTitle) {
    gsap.fromTo(reelTitle,
      { autoAlpha: 0, y: 35 },
      {
        autoAlpha: 1,
        y: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: '.curiosity-reel',
          start: 'top 85%',
          end: 'top 15%',
          scrub: 0.6,
        },
      });
  }

  const stackSection = document.querySelector('[data-effect="method-steps-stack"]');
  if (stackSection) setupPinnedStack(stackSection);

  window.addEventListener('load', () => ScrollTrigger.refresh());
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => ScrollTrigger.refresh());
  }
});

/**
 * Aula Experimental — plays the CSS entrance animations once the section scrolls into view.
 * Content stays visible without JS because the hidden state is only applied here.
 */
document.addEventListener('DOMContentLoaded', () => {
  const section = document.querySelector('.experimental-class');
  if (!section || !('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  section.classList.add('is-pending');

  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    section.classList.remove('is-pending');
    section.classList.add('is-visible');
    observer.disconnect();
  }, { threshold: 0.2, rootMargin: '0px 0px -10% 0px' });

  observer.observe(section);
});

/**
 * Planos de Pilates — period toggle swaps each card's price by its data-tier
 */
const pricingData = {
  mensal: { '1x': '190', '2x': '270', '3x': '375' },
  trimestral: { '1x': '170', '2x': '255', '3x': '355' },
  semestral: { '1x': '155', '2x': '240', '3x': '340' },
  anual: { '1x': '140', '2x': '225', '3x': '325' }
};

document.addEventListener('DOMContentLoaded', () => {
  const toggleButtons = document.querySelectorAll('.pricing-toggle-btn');
  const priceValues = document.querySelectorAll('.price-value');
  if (!toggleButtons.length || !priceValues.length) return;

  // Matches the .price-value opacity/transform transition in style.css
  const FADE_MS = 180;
  let swapTimer = null;

  const updatePrices = (period) => {
    const prices = pricingData[period];
    if (!prices) return;

    clearTimeout(swapTimer);
    priceValues.forEach((el) => el.classList.add('is-changing'));

    swapTimer = setTimeout(() => {
      priceValues.forEach((el) => {
        const price = prices[el.dataset.tier];
        if (price) el.innerText = `R$ ${price}`;
        el.classList.remove('is-changing');
      });
    }, FADE_MS);
  };

  toggleButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (button.classList.contains('active')) return;

      toggleButtons.forEach((btn) => {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
      });
      button.classList.add('active');
      button.setAttribute('aria-pressed', 'true');

      updatePrices(button.dataset.period);
    });
  });
});

/**
 * Avaliações do Google — renders the review cards into #reviews-track and wires the prev/next buttons.
 * Reviews use either `avatar` (photo) or `initial` + `color` (Tailwind bg class); photos that fail
 * to load fall back to an initial avatar.
 */
const reviewsData = [
  { name: 'Larissa Zobole', date: '4 meses atrás', avatar: 'assets/images/pilates/larissa.jpg', text: 'Frequentar essa escola de pilates foi uma das melhores coisas que fiz por mim 🤍 Além de toda a qualidade das aulas, o ambiente é acolhedor, leve e faz a gente realmente se sentir bem.' },
  { name: 'Lucas Matheus Mello', date: 'um ano atrás', initial: 'L', color: 'bg-teal-600', text: 'Sem sombras de dúvidas a melhor clínica de pilates/fisioterapia da cidade. Ambiente perfeito, com profissionais capacitados com muita dedicação. Recomendo muito!' },
  { name: 'Sandra Fedrigo', date: '4 meses atrás', initial: 'S', color: 'bg-teal-700', text: 'Quero deixar aqui meu carinho e agradecimento à Clínica Moove Pilates e Fisioterapia em Sarandi! Mais do que um lugar para fazer pilates, vocês fazem a diferença na vida das pessoas com profissionalismo, atenção e muito cuidado.' },
  { name: 'Willian Carniato', date: 'um ano atrás', avatar: 'assets/images/pilates/willian.jpg', text: 'Os profissionais são bem atenciosos. Gosto muito de ser aluno da clínica. 10/10' },
  { name: 'Lucilena Ferreira de Souza', date: '4 meses atrás', initial: 'L', color: 'bg-indigo-600', text: 'Faço aula na clínica muito bom' },
  { name: 'JSz Comercial', date: 'um ano atrás', avatar: 'assets/images/pilates/jsz.jpg', text: 'Pessoal atencioso, os equipamentos são excelentes. Recomendo!' },
  { name: 'Tamires Vitoria', date: 'um ano atrás', avatar: 'assets/images/pilates/tamires.jpg', text: 'Clínica linda, climatizada e muito confortável. Atendimento ótimo e super prestativo. Sem dúvidas a melhor clínica de Sarandi! Estão de parabéns 👏🏼👏🏼...' },
  { name: 'valeria cristina', date: '4 meses atrás', initial: 'v', color: 'bg-orange-600', text: 'Clinica bem equipada e atendimento de qualidade eu amei..' },
  { name: 'Amanda Cristina', date: '4 meses atrás', avatar: 'assets/images/pilates/amanda.jpg', text: 'Tive uma experiência muito boa, profissionais super atenciosos.' },
  { name: 'Sueli Moreira', date: '4 meses atrás', initial: 'S', color: 'bg-slate-700', text: 'Ótimo resultado, atendimento especializado muito bom mesmo 🙏🏼 ...' },
  { name: 'Silvana J. R. Walchek', date: '9 meses atrás', avatar: 'assets/images/pilates/silvana.jpg', text: 'Clínica excelente. O fisio e a fisio são super atenciosos. Eles têm vários aparelhos e equipamentos. Faço Pilates por recomendação médica e vejo que minhas dores já diminuíram muito. Recomendo a clínica.' },
  { name: 'Maria Luiza Menk', date: '10 meses atrás', avatar: 'assets/images/pilates/marialuiza.jpg', text: 'Melhor clinica da região sem duvida, profissionais atenciosos, o ambiente muito bom, sempre limpinho e organizado, melhor lugar para atendimento de pilates e de fisioterapia em geral, la viramos mais que clientes, pq são MARAVILHOSOS! Parabéns' },
  { name: 'nicaellen fernanda', date: '4 meses atrás', initial: 'n', color: 'bg-blue-700', text: 'A melhor clínica da região, com aparelhos novos de ponta!! Recomendo de olhos fechados!' },
  { name: 'Soniabarbi Barbi', date: '3 meses atrás', initial: 'S', color: 'bg-purple-700', text: 'Super recomendo muito bom mesmo eu são muito atencioso com seus alunos e pacientes a estrutura Lorena Super recomendo muito obrigado mesmo' },
  { name: 'Maria', date: '4 meses atrás', initial: 'M', color: 'bg-teal-800', text: 'Comecei em janeiro deste ano, está sendo maravilhoso.Estou tendo bons resultados com os exercícios o atendimento é excelente.' },
  { name: 'Leticia Santos', date: '4 meses atrás', initial: 'L', color: 'bg-emerald-800', text: 'Atendimento excelente e profissionais super capacitados. Já fiz aula de pilates e ajudou muito na recuperação de uma lesão que tive na perna. Sempre faço liberação miofascial e é ótima. Recomendo de olhos fechados.' },
];

const REVIEW_FALLBACK_COLOR = 'bg-[#763536]';

const reviewStarIcon = '<svg class="h-4 w-4 text-[#FBBC04]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"></path></svg>';

const reviewVerifiedIcon = '<svg class="ml-1 h-4 w-4 text-[#1A73E8]" viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="Avaliação verificada"><path d="m23 12-2.44-2.79.34-3.69-3.61-.82-1.89-3.2L12 2.96 8.6 1.5 6.71 4.69 3.1 5.5l.34 3.7L1 12l2.44 2.79-.34 3.7 3.61.82L8.6 22.5l3.4-1.47 3.4 1.46 1.89-3.19 3.61-.82-.34-3.69L23 12zm-12.91 4.72-3.8-3.81 1.48-1.48 2.32 2.33 5.85-5.87 1.48 1.48-7.33 7.35z"></path></svg>';

const reviewGoogleIcon = '<svg class="h-5 w-5 shrink-0" viewBox="0 0 48 48" role="img" aria-label="Avaliação do Google"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path></svg>';

const reviewInitialAvatar = (letter, color) =>
  `<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${color} font-moove text-base font-bold text-white" aria-hidden="true">${letter}</div>`;

const isReviewImagePath = (value) =>
  typeof value === 'string' && (/\.(jpe?g|png|webp|avif|gif)$/i.test(value) || value.includes('assets/'));

const reviewAvatar = (review) => {
  if (isReviewImagePath(review.avatar)) {
    return `<img src="${review.avatar}" alt="${review.name}" width="40" height="40" loading="lazy" data-review-avatar data-initial="${review.name.charAt(0)}" class="block h-10 w-10 shrink-0 rounded-full object-cover">`;
  }
  return reviewInitialAvatar(review.initial || review.name.charAt(0), review.color || REVIEW_FALLBACK_COLOR);
};

const renderReviewCard = (review) => `
  <article class="flex w-full max-w-[320px] shrink-0 snap-center flex-col md:w-[320px] md:max-w-none md:snap-start gap-4 rounded-xl bg-white p-6 shadow-[0_6px_24px_rgba(0,0,0,0.07)]">
    <div class="flex items-start gap-3">
      ${reviewAvatar(review)}
      <div class="min-w-0 flex-1">
        <p class="truncate text-[0.95rem] font-bold text-[#111]">${review.name}</p>
        <p class="mt-0.5 text-xs text-gray-500">${review.date}</p>
      </div>
      ${reviewGoogleIcon}
    </div>
    <div class="flex items-center">
      <span class="flex gap-0.5" role="img" aria-label="5 de 5 estrelas">${reviewStarIcon.repeat(5)}</span>
      ${reviewVerifiedIcon}
    </div>
    <p class="line-clamp-4 min-h-[91px] text-sm leading-relaxed text-[#2d2d34]" data-review-text>${review.text}</p>
    <button type="button" data-review-more aria-expanded="false"
      class="cursor-pointer self-start border-0 bg-transparent p-0 text-sm font-medium text-gray-500 underline-offset-2 transition-colors hover:text-[#111] hover:underline">Consulte Mais informação</button>
  </article>`;

document.addEventListener('DOMContentLoaded', () => {
  const track = document.querySelector('[data-reviews-track]');
  if (!track) return;

  const prevBtn = document.querySelector('[data-reviews-prev]');
  const nextBtn = document.querySelector('[data-reviews-next]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  track.innerHTML = reviewsData.map(renderReviewCard).join('');

  track.querySelectorAll('[data-review-avatar]').forEach((img) => {
    img.addEventListener('error', () => {
      img.outerHTML = reviewInitialAvatar(img.dataset.initial, REVIEW_FALLBACK_COLOR);
    }, { once: true });
  });

  track.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-review-more]');
    if (!toggle) return;

    const text = toggle.parentElement.querySelector('[data-review-text]');
    const expanded = text.classList.toggle('line-clamp-4') === false;
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.textContent = expanded ? 'Mostrar menos' : 'Consulte Mais informação';
  });

  // One card width plus the flex gap, so each click lands exactly on the next snap point
  const getStep = () => {
    const card = track.firstElementChild;
    if (!card) return track.clientWidth;
    return card.offsetWidth + (parseFloat(getComputedStyle(track).columnGap) || 0);
  };

  const scrollByCards = (direction) => {
    track.scrollBy({ left: direction * getStep(), behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  };

  // 2px tolerance absorbs sub-pixel scrollLeft values at either end
  const updateNav = () => {
    const maxScroll = track.scrollWidth - track.clientWidth;
    if (prevBtn) prevBtn.disabled = track.scrollLeft <= 2;
    if (nextBtn) nextBtn.disabled = track.scrollLeft >= maxScroll - 2;
  };

  prevBtn?.addEventListener('click', () => scrollByCards(-1));
  nextBtn?.addEventListener('click', () => scrollByCards(1));
  track.addEventListener('scroll', updateNav, { passive: true });

  // The Tailwind CDN styles the injected cards asynchronously and expanding a review changes the track
  // height, so re-measure on resize; height changes also shift the footer-reveal ScrollTriggers below.
  if ('ResizeObserver' in window) {
    let lastHeight = track.offsetHeight;
    let refreshTimer = null;

    new ResizeObserver(() => {
      updateNav();
      if (track.offsetHeight === lastHeight || typeof ScrollTrigger === 'undefined') return;
      lastHeight = track.offsetHeight;
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 150);
    }).observe(track);
  } else {
    window.addEventListener('resize', updateNav);
  }
  updateNav();
});

/**
 * Cinematic Footer — magnetic hover for [data-magnetic] elements.
 * The attribute value sets the pull strength (default 0.4); wide buttons use a lower value
 * so they don't drift far from the cursor. Returns a cleanup function.
 */
function setupMagnetic(el) {
  const strength = parseFloat(el.dataset.magnetic) || 0.4;
  const tilt = strength * 0.375;
  gsap.set(el, { transformPerspective: 600 });

  const onMove = (e) => {
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    gsap.to(el, {
      x: x * strength,
      y: y * strength,
      rotationX: -y * tilt,
      rotationY: x * tilt,
      scale: 1.05,
      ease: 'power2.out',
      duration: 0.4,
    });
  };

  const onLeave = () => {
    gsap.to(el, {
      x: 0,
      y: 0,
      rotationX: 0,
      rotationY: 0,
      scale: 1,
      ease: 'elastic.out(1, 0.3)',
      duration: 1.2,
    });
  };

  el.addEventListener('mousemove', onMove);
  el.addEventListener('mouseleave', onLeave);

  return () => {
    el.removeEventListener('mousemove', onMove);
    el.removeEventListener('mouseleave', onLeave);
    gsap.killTweensOf(el);
    gsap.set(el, { clearProps: 'transform' });
  };
}

/**
 * Unidades + Cinematic Footer (GSAP 3.12.5 + ScrollTrigger 3.12.5)
 * The footer is fixed inside a clip-path wrapper (.cinematic-curtain), so it is uncovered as the
 * intro scrolls away. Scrubbed tweens add the giant "MOOVE" parallax and the content reveal.
 */
document.addEventListener('DOMContentLoaded', () => {
  const wrapper = document.querySelector('.cinematic-curtain');
  if (!wrapper) return;
  const topButton = wrapper.querySelector('.footer-top-btn');
  if (topButton) {
    topButton.addEventListener('click', () => {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);

  const introTitle = document.querySelector('.scroll-reveal-text');
  const giantText = wrapper.querySelector('.footer-giant-bg-text');
  const revealItems = wrapper.querySelectorAll('.footer-intro, .footer-locations');

  const mm = gsap.matchMedia();

  // "curtain" must mirror the inverse of the static-footer media query in style.css
  mm.add({
    curtain: '(min-width: 769px) and (min-height: 841px)',
    reduceMotion: '(prefers-reduced-motion: reduce)',
  }, (context) => {
    const { curtain, reduceMotion } = context.conditions;
    if (reduceMotion) return;

    if (introTitle) {
      gsap.fromTo(introTitle,
        { autoAlpha: 0, y: 35 },
        {
          autoAlpha: 1,
          y: 0,
          ease: 'none',
          scrollTrigger: {
            trigger: '.footer-reveal-intro',
            start: 'top 85%',
            end: 'top 15%',
            scrub: 0.6,
          },
        });
    }

    // xPercent keeps the CSS horizontal centering while GSAP owns the transform
    if (giantText) {
      gsap.fromTo(giantText,
        { xPercent: -50, x: 0, y: '10vh', scale: 0.8, opacity: 0 },
        {
          xPercent: -50,
          x: 0,
          y: 0,
          scale: 1,
          opacity: 1,
          ease: 'power1.out',
          scrollTrigger: {
            trigger: wrapper,
            start: 'top 80%',
            end: 'bottom bottom',
            scrub: 1,
          },
        });
    }

    // In static mode the footer is taller than the viewport, so the reveal finishes earlier
    if (revealItems.length) {
      gsap.fromTo(revealItems,
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.15,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: wrapper,
            start: curtain ? 'top 40%' : 'top 85%',
            end: curtain ? 'bottom bottom' : 'top 30%',
            scrub: 1,
          },
        });
    }
  });

  mm.add('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)', () => {
    const cleanups = Array.from(wrapper.querySelectorAll('[data-magnetic]')).map(setupMagnetic);
    return () => cleanups.forEach((cleanup) => cleanup());
  });
});
