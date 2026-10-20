/* motionblur.js: motion blur drawn by the page itself, one capture per frame.

   Each tracked element is measured on screen after every seek. Its move since the previous seek, scaled to a 180°
   shutter, becomes an SVG Gaussian blur along x and y in the element's own pixels (a zoom adds an even blur). The
   blur shows in the live player and in renders alike.

     <script src="js/motionblur.js"></script>          after the page defines window.seek
     MB.track('.word, #brothers img', { sharp: [[5.53, 5.60]] });   leaves only: never track an element and its parent
     MB.install({ sharp: [[5.53, 5.60]] });            wraps window.seek; call once, after window.seek is final

   Rules it keeps:
   - The move is measured inside the shutter, like a camera: before drawing time t it seeks to t - shutter/2 (always
     forward), measures, then draws t. A jump between frames (a cut, a set) is never read as speed. When seeks arrive
     closer together than that (the live player on a fast display), the previous seek is used instead.
   - Deterministic: frame t's blur depends only on t, so a render's chunks and order don't matter.
   - The renderer sets window.__accumulating = true while it averages sub-frames for a camera move. The page then
     draws sharp frames and the averaging does the blur.
   - A page's own CSS filter on a tracked element (depth of field, a drop shadow) is kept: the blur is appended to it.
     That holds for a filter from a stylesheet too, and the page never sees our filter: it is taken off before every
     seek, so a GSAP to() tween on filter starts from the page's own value, not from url(#mb-n).
   - The filter region is the element's box plus room for the blur. Anything the element draws outside its box (a
     box-shadow, an SVG with overflow visible) needs { pad: px } in the element's own pixels, or it is clipped.
   - The blur follows the element's own axes, so the move is turned into them through the element's full on-screen
     transform (rotation and scale included). A diagonal move gets an axis-aligned blur, which is close. Spins are not
     blurred. A zoom or squash blurs each own axis by how far that axis's edges move, so a scaleY pop-up blurs only
     vertically and a spin (whose bounding box breathes) reads as no zoom at all.
   - Only the part on screen counts: a card bigger than the frame is blurred by its visible part's move, not by its
     off-screen centre's. An element wholly off screen gets no filter.
*/
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const MB = (window.MB = {
    enabled: true,      // the player's "Motion blur" switch
    fps: 30,            // the render's frame rate: one frame step is how far back a primed measurement looks
    shutter: 0.5,       // 180°: the blur covers half a frame's move
    gain: 0.35,         // Gaussian sigma per pixel of move inside the shutter (a box of length L has sigma 0.29 L)
    max: 60,            // cap on sigma in screen px
    minSigma: 0.35,     // below this, no filter at all
    sharp: [],          // [[from, to], ...] seconds with no blur anywhere (impact frames, hard cuts)
    items: [],
    lastT: null,
  });

  let defs = null;
  function filterDefs() {
    if (defs) return defs;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;overflow:hidden;pointer-events:none';
    defs = svg.appendChild(document.createElementNS(NS, 'defs'));
    document.body.appendChild(svg);
    return defs;
  }

  function elements(targets) {
    if (typeof targets === 'string') return [...document.querySelectorAll(targets)];
    if (targets instanceof Element) return [targets];
    return [...targets];
  }

  // Track elements. opts: { sharp: [[a, b]], gain, max, pad, probe, zoom }
  //   probe: an element to measure instead (e.g. a steady parent of art that flaps on twos)
  //   zoom: scale the zoom blur (0.6 suits big elements, which an edge-sized blur over-blurs)
  MB.track = (targets, opts = {}) => {
    for (const el of elements(targets)) {
      if (MB.items.some((it) => it.el === el)) continue;
      const id = `mb-${MB.items.length}`;
      const f = document.createElementNS(NS, 'filter');
      f.setAttribute('id', id);
      f.setAttribute('color-interpolation-filters', 'sRGB');   // average like the renderer does, in sRGB
      const g = f.appendChild(document.createElementNS(NS, 'feGaussianBlur'));
      g.setAttribute('edgeMode', 'none');
      filterDefs().appendChild(f);
      MB.items.push({ el, opts, f, g, url: `url(#${id})`, prev: null, written: null, base: '', on: false });
    }
    return MB;
  };

  const within = (t, wins) => !!wins && wins.some(([a, b]) => t >= a && t <= b);

  // The element's on-screen linear transform (rotation, scale, skew), its own and every ancestor's. Cached per pass.
  let mcache = new Map();
  function screenMatrix(el) {
    if (!el || el === document.body || el === document.documentElement) return new DOMMatrix();
    if (mcache.has(el)) return mcache.get(el);
    const parent = screenMatrix(el.parentElement);
    const tf = getComputedStyle(el).transform;
    const m = tf && tf !== 'none' ? parent.multiply(new DOMMatrix(tf)) : parent;
    mcache.set(el, m);
    return m;
  }

  function measure(it) {
    const el = it.el;
    const st = el.style;
    if (!el.isConnected || st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') return null;
    const r = (it.opts.probe || el).getBoundingClientRect();   // opts.probe: measure another element (one that doesn't flap)
    if (r.width < 1 || r.height < 1) return null;
    let lw = el.offsetWidth, lh = el.offsetHeight;                // the element's own (untransformed) size
    if (lw === undefined && el.getBBox) {
      try { const b = el.getBBox(); lw = b.width; lh = b.height; } catch (e) { /* not rendered */ }
    }
    const m = screenMatrix(el);
    lw = lw || r.width; lh = lh || r.height;
    // on-screen extent along the element's own x and y axes (rotation-free, unlike the bounding box)
    return { x: r.left, y: r.top, w: r.width, h: r.height, lw, lh, a: m.a, b: m.b, c: m.c, d: m.d,
      ex: lw * Math.hypot(m.a, m.b), ey: lh * Math.hypot(m.c, m.d) };
  }

  function setBlur(it, on) {
    const st = it.el.style;
    const cur = st.filter;
    if (cur !== it.written) {        // the page set its own filter since; none inline means the stylesheet's, if any
      const own = cur || getComputedStyle(it.el).filter;
      it.base = own && own !== 'none' ? own : '';
    }
    const next = on ? (it.base ? `${it.base} ${it.url}` : it.url) : it.base;
    if (next !== cur) st.filter = next;
    it.written = st.filter;          // as the browser normalises it (it quotes url("#id")), so the next read matches
    it.on = on;
  }

  // Give the page back its own filters before it draws: a tween that starts now reads the current filter as its start.
  function strip() {
    for (const it of MB.items) if (it.on) setBlur(it, false);
  }

  function blurAll(t, dt) {
    const k = MB.shutter / MB.fps / dt;    // the share of the measured move that falls inside the shutter
    const globalSharp = within(t, MB.sharp);
    mcache = new Map();
    // Every read before any write: measuring after a filter was set makes WebKit lay out again for each element.
    const now = MB.items.map(measure);
    MB.items.forEach((it, i) => {
      const s = now[i];
      const p = it.prev;
      it.prev = s;
      if (!s || !p || globalSharp || within(t, it.opts.sharp)) { setBlur(it, false); return; }
      const gain = it.opts.gain ?? MB.gain;
      const max = it.opts.max ?? MB.max;
      const det = s.a * s.d - s.b * s.c;
      if (Math.abs(det) < 1e-6) { setBlur(it, false); return; }
      // Only the part on screen counts: a card bigger than the frame has its centre far off screen, moving much faster
      // than the strip we see. Take the visible part as fractions of the box, so the same points are found last time.
      const vx0 = Math.max(s.x, 0), vx1 = Math.min(s.x + s.w, innerWidth);
      const vy0 = Math.max(s.y, 0), vy1 = Math.min(s.y + s.h, innerHeight);
      if (vx1 <= vx0 || vy1 <= vy0) { setBlur(it, false); return; }         // wholly off screen
      const u = ((vx0 + vx1) / 2 - s.x) / s.w, v = ((vy0 + vy1) / 2 - s.y) / s.h;
      const fx = (vx1 - vx0) / s.w, fy = (vy1 - vy0) / s.h;
      const dx = (s.x + u * s.w - p.x - u * p.w) * k, dy = (s.y + v * s.h - p.y - v * p.h) * k;   // screen move in the shutter
      const ux = (s.d * dx - s.c * dy) / det, uy = (-s.b * dx + s.a * dy) / det; // ... in the element's own px
      // A zoom or squash, per own axis: the visible part's edges move half its size change (a spin reads as none).
      const kx = Math.max(Math.hypot(s.a, s.b), 1e-6), ky = Math.max(Math.hypot(s.c, s.d), 1e-6);   // screen px per own px
      const zoom = it.opts.zoom ?? 1;
      const uzx = Math.abs(s.ex - p.ex) * fx * k / 2 / kx * zoom;
      const uzy = Math.abs(s.ey - p.ey) * fy * k / 2 / ky * zoom;
      let sx = Math.min(max / kx, gain * Math.hypot(ux, uzx));   // the cap is in screen px, per axis
      let sy = Math.min(max / ky, gain * Math.hypot(uy, uzy));
      if (sx < MB.minSigma && sy < MB.minSigma) { setBlur(it, false); return; }
      if (sx < MB.minSigma) sx = 0;
      if (sy < MB.minSigma) sy = 0;
      it.g.setAttribute('stdDeviation', `${sx.toFixed(2)} ${sy.toFixed(2)}`);
      const pad = it.opts.pad ?? 0;                                             // what the element draws outside its box
      const mx = (3 * sx + 2 + pad) / s.lw, my = (3 * sy + 2 + pad) / s.lh;   // room for the blur outside the box
      it.f.setAttribute('x', (-mx).toFixed(4));
      it.f.setAttribute('width', (1 + 2 * mx).toFixed(4));
      it.f.setAttribute('y', (-my).toFixed(4));
      it.f.setAttribute('height', (1 + 2 * my).toFixed(4));
      setBlur(it, true);
    });
  }

  function clearAll() {
    for (const it of MB.items) { it.prev = null; setBlur(it, false); }
    MB.lastT = null;
  }

  // Wrap window.seek. Call once, after the page has assigned its final window.seek.
  MB.install = (opts = {}) => {
    Object.assign(MB, opts);
    const inner = window.seek;
    let lastRest = [];
    const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
    window.seek = (t, ...rest) => {
      if (!MB.enabled || window.__accumulating) { clearAll(); inner(t, ...rest); return; }
      const last = MB.lastT;
      const sameArgs = same(rest, lastRest);   // a page's extra seek arguments (e.g. a drawing's frame time) unchanged
      lastRest = rest;
      if (last !== null && t === last && sameArgs) { inner(t, ...rest); return; }   // the same frame again: keep its blur
      const half = MB.shutter / MB.fps / 2;
      strip();
      let from = null;
      if (last !== null && t > last && t - last <= half && sameArgs) {
        from = last;                                                           // seeks this close: measure from the last
      } else {
        for (const it of MB.items) it.prev = null;
        if (t - half >= 0 && (last === null || t - half > last)) {             // forward only
          inner(t - half, ...rest);
          mcache = new Map();
          for (const it of MB.items) it.prev = measure(it);
          from = t - half;
        }
      }
      inner(t, ...rest);
      blurAll(t, from === null ? 0 : t - from);
      MB.lastT = t;
    };
    return MB;
  };
})();
