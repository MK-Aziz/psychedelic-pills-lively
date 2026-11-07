/*
 * Psychedelic Pills engine
 * Shared by the Lively wallpaper (index.html) and the browser Studio (studio.html).
 * Exposes window.PillsEngine = { SETTINGS, PATTERNS, create(canvas, opts) }.
 *
 * Shader based on "Psychedelic Pills" by @kishimisu (2022) - https://www.shadertoy.com/view/csfSRN
 * Licensed under CC BY-NC-SA 4.0 (https://creativecommons.org/licenses/by-nc-sa/4.0/).
 */
(function (root) {
  'use strict';

  const PATTERNS = [
    'Psychedelic pills',
    'Pill kaleidoscope',
    'Pill vortex',
  ];

  // Single source of truth for every setting.
  // tools/build.mjs turns this into LivelyProperties.json; studio.html builds its panel from it.
  const SETTINGS = [
    { group: 'Look', key: 'pattern', type: 'dropdown', value: 0, text: 'Pattern', items: PATTERNS },
    { group: 'Look', key: 'autoSwitch', type: 'checkbox', value: false, text: 'Auto-switch patterns' },
    { group: 'Look', key: 'switchEvery', type: 'slider', value: 30, min: 5, max: 120, step: 1, text: 'Switch every (seconds)', help: 'How long each pattern stays when auto-switching' },
    { group: 'Look', key: 'symmetry', type: 'slider', value: 0, min: 0, max: 16, step: 1, text: 'Kaleidoscope mirrors', help: '0 = off (original look), otherwise number of mirrored slices' },
    { group: 'Look', key: 'speed', type: 'slider', value: 1, min: 0, max: 4, step: 0.05, text: 'Flight speed', help: 'How fast you fly through the pills' },
    { group: 'Look', key: 'pillSize', type: 'slider', value: 1, min: 0.5, max: 2, step: 0.05, text: 'Pill size', help: 'Thickness of the pills' },
    { group: 'Look', key: 'colorCycle', type: 'slider', value: 0.3, min: 0, max: 3, step: 0.05, text: 'Color cycling speed', help: 'How fast the rainbow bands shift' },
    { group: 'Look', key: 'hueShift', type: 'slider', value: 0, min: 0, max: 1, step: 0.01, text: 'Color offset', help: 'Rotate the whole color palette' },
    { group: 'Look', key: 'saturation', type: 'slider', value: 1.3, min: 0, max: 2, step: 0.05, text: 'Color intensity', help: 'Higher = more psychedelic' },
    { group: 'Look', key: 'glow', type: 'slider', value: 1, min: 0, max: 3, step: 0.05, text: 'Brightness / glow', help: 'Overall neon brightness' },

    { group: 'Music', key: 'audioReactive', type: 'checkbox', value: true, text: 'React to music' },
    { group: 'Music', key: 'sensitivity', type: 'slider', value: 1, min: 0, max: 4, step: 0.05, text: 'Music sensitivity', help: 'Raise this if the music barely moves it' },
    { group: 'Music', key: 'bassZoom', type: 'slider', value: 1, min: 0, max: 2, step: 0.05, text: 'Bass → pill swell', help: 'Bass inflates the pills and widens the view' },
    { group: 'Music', key: 'bassSpeed', type: 'slider', value: 1, min: 0, max: 3, step: 0.05, text: 'Bass → speed boost', help: 'Bass makes you fly faster' },
    { group: 'Music', key: 'midWarp', type: 'slider', value: 0.6, min: 0, max: 2, step: 0.05, text: 'Mids → wobble', help: 'Vocals and synths make the image ripple' },
    { group: 'Music', key: 'trebleSparkle', type: 'slider', value: 0.8, min: 0, max: 2, step: 0.05, text: 'Treble → sparkle', help: 'Hi-hats and cymbals make the colours shimmer' },
    { group: 'Music', key: 'beatFlash', type: 'slider', value: 1, min: 0, max: 2, step: 0.05, text: 'Beat → flash', help: 'Each kick drum flashes the glow' },
    { group: 'Music', key: 'beatColor', type: 'slider', value: 0.15, min: 0, max: 1, step: 0.01, text: 'Beat → color jump', help: 'Each kick drum jumps the colors' },
    { group: 'Music', key: 'beatSpin', type: 'slider', value: 0.5, min: 0, max: 2, step: 0.05, text: 'Beat → roll', help: 'Each kick drum rolls the camera' },
    { group: 'Music', key: 'beatSwitch', type: 'checkbox', value: false, text: 'Change pattern on big drops' },
    { group: 'Music', key: 'smoothing', type: 'slider', value: 0.5, min: 0, max: 0.95, step: 0.05, text: 'Reaction smoothness', help: 'Low = snappy, high = smooth and floaty' },

    { group: 'Performance', key: 'mouseReactive', type: 'checkbox', value: true, text: 'Follow mouse / touch' },
    { group: 'Performance', key: 'antialias', type: 'dropdown', value: 1, text: 'Anti-aliasing', items: ['Off (fastest)', '2x (like the original)', '3x (smoothest)'] },
    { group: 'Performance', key: 'quality', type: 'slider', value: 0.75, min: 0.25, max: 1, step: 0.05, text: 'Render quality', help: 'Lower this if your PC gets hot or games stutter' },
    { group: 'Performance', key: 'fpsLimit', type: 'slider', value: 60, min: 15, max: 144, step: 1, text: 'FPS limit', help: 'Lower = less GPU usage' },
  ];

  const VS = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';

  const FS_LIB = `
precision highp float;

uniform vec2  R;
uniform float T;      // animated time
uniform float HUE;    // palette offset 0..1
uniform float SYM;    // kaleidoscope slices
uniform float SPIN;   // camera roll
uniform float GLOW;   // brightness incl. beat flash
uniform float SAT;
uniform float SIZE;   // pill thickness
uniform float ZOOMP;  // bass pulse
uniform float WARP;   // mid wobble
uniform float SPARK;  // treble sparkle
uniform vec2  M;      // smoothed mouse -1..1

#define PI 3.14159265

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }

// "Psychedelic Pills" by @kishimisu: raymarched capsules in a repeated grid,
// coloured by the distance travelled. variant 0 = original, 1 = 6-fold kaleidoscope,
// 2 = twisting vortex. variant is a compile-time constant per program.
vec3 pills(vec2 v, float variant) {
  float e = T * 0.4 + 0.8;
  float p = 0.0, h = 3.0, c, y;
  if (variant > 0.5 && variant < 1.5) {
    // built-in 6-fold kaleidoscope, slowly turning
    float r = length(v), a = atan(v.y, v.x) + T * 0.05;
    float seg = PI / 3.0;
    a = abs(mod(a, seg) - seg * 0.5);
    v = r * vec2(cos(a), sin(a)) * 1.2;
  }
  vec3 dir = normalize(vec3(1.0 - ZOOMP * 0.15, v));
  for (int i = 0; i < 200; i++) {
    if (abs(h) < 0.001 || p > 40.0) break;
    vec3 o = p * dir;
    c = sin(e + p * 0.5) * 0.25;
    y = c + 0.25;
    o.x += e;
    if (variant > 1.5) o.yz *= rot(p * 0.07 + e * 0.12);
    o.y = abs(o.y);
    o = fract(o) - 0.5;
    o.xy *= mat2(cos(e + vec4(0.0, 33.0, 11.0, 0.0)));
    o.y += y * 0.5;
    o.y -= clamp(o.y, 0.0, y);
    h = (length(o) - 0.1 * SIZE * (0.75 + p * 0.1 + c + ZOOMP * 0.35)) * 0.8;
    p += h;
  }
  return exp(-p * 0.15 - 0.5 * length(v)) *
    (cos(p * (8.4 + 0.16 * vec3(0.0, 1.0, 2.0)) + HUE * 6.28318) * 1.2 + 1.2);
}

`;

  // Main is generated per pattern: one small shader each. A single shader with a runtime
  // switch can get its branches flattened (ANGLE/D3D on Windows), running every pattern per pixel.
  const FS_MAIN = `
vec2 frameUV(vec2 fc) {
  vec2 uv = (fc * 2.0 - R) / min(R.x, R.y);
  uv += M * vec2(-0.12, 0.12);
  uv += WARP * 0.04 * vec2(sin(uv.y * 5.0 + T * 2.0), cos(uv.x * 5.0 + T * 1.7));
  if (SYM > 1.5) {
    float r = length(uv);
    float a = atan(uv.y, uv.x) + SPIN;
    float seg = 2.0 * PI / SYM;
    a = mod(a, seg);
    a = abs(a - seg * 0.5);
    uv = r * vec2(cos(a), sin(a));
  } else {
    uv = rot(SPIN) * uv;
  }
  return uv;
}

void main() {
  vec3 col = vec3(0.0);
  for (int j = 0; j < AA; j++)
  for (int k = 0; k < AA; k++) {
    vec2 off = (vec2(float(j), float(k)) + 0.5) / float(AA) - 0.5;
    vec2 uv = frameUV(gl_FragCoord.xy + off);
    col += PATTERN_CALL;
  }
  col /= float(AA * AA);

  col *= 0.25 + 0.75 * GLOW;
  col += col * col * SPARK * 0.25;
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(lum), col, SAT);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
  const PATTERN_CALLS = ['pills(uv, 0.0)', 'pills(uv, 1.0)', 'pills(uv, 2.0)'];
  const fragmentSource = (id, aa) => '#define AA ' + aa + '\n' + FS_LIB +
    FS_MAIN.replace('PATTERN_CALL', PATTERN_CALLS[id]);

  const UNIFORMS = ['R', 'T', 'HUE', 'SYM', 'SPIN', 'GLOW', 'SAT', 'SIZE', 'ZOOMP', 'WARP', 'SPARK', 'M'];

  function defaults() {
    const S = {};
    SETTINGS.forEach(s => { S[s.key] = s.value; });
    return S;
  }

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  function band(arr, from, to) {
    to = Math.min(to, arr.length);
    let s = 0;
    for (let i = from; i < to; i++) s += arr[i];
    return to > from ? s / (to - from) : 0;
  }

  function create(canvas, opts) {
    opts = opts || {};
    const S = defaults();

    const gl = canvas.getContext('webgl', { antialias: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL is not available on this device');

    function compile(type, src) {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      return sh;
    }
    const vs = compile(gl.VERTEX_SHADER, VS);
    // One program per (pattern, anti-aliasing level); AA is a compile-time loop bound.
    const programs = {};
    const aaLevel = () => clamp(Math.round(S.antialias), 0, 2) + 1;
    function program(id, aa) {
      aa = aa || aaLevel();
      const key = id + ':' + aa;
      if (programs[key]) return programs[key];
      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragmentSource(id, aa)));
      gl.bindAttribLocation(prog, 0, 'p');
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      const U = {};
      UNIFORMS.forEach(n => { U[n] = gl.getUniformLocation(prog, n); });
      return (programs[key] = { prog, U });
    }
    // Warm up the other patterns in the background so switching doesn't hitch
    let warmToken = 0;
    function warmAll() {
      const token = ++warmToken, aa = aaLevel();
      let i = 0;
      (function warmNext() {
        if (token !== warmToken || i >= PATTERNS.length) return;
        try { program(i++, aa); } catch (e) { console.error(e); }
        setTimeout(warmNext, 150);
      })();
    }
    program(S.pattern);
    warmAll();

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const st = {
      now: 0, frames: 0, time: 0, hue: 0, spin: 0, spinVel: 0,
      rawBass: 0, rawMid: 0, rawHigh: 0, audioAge: 1e9,
      bass: 0, mid: 0, high: 0, kick: 0, bassAvg: 0, lastKick: -1,
      pa: S.pattern, pb: S.pattern, mixT: 0, switching: false, lastSwitch: 0,
      mx: 0, my: 0, smx: 0, smy: 0,
    };
    let fixedSize = null;
    let raf = 0, last = 0, lastDraw = 0;

    // ---- Input ----
    if (opts.listenPointer !== false) {
      const onMove = (x, y) => {
        st.mx = (x / window.innerWidth) * 2 - 1;
        st.my = (y / window.innerHeight) * 2 - 1;
      };
      window.addEventListener('mousemove', e => onMove(e.clientX, e.clientY));
      window.addEventListener('touchmove', e => { const t = e.touches[0]; if (t) onMove(t.clientX, t.clientY); }, { passive: true });
    }

    // ---- Patterns ----
    function switchTo(id) {
      id = clamp(Math.round(id), 0, PATTERNS.length - 1);
      if (st.frames < 5) { st.pa = st.pb = id; st.switching = false; st.mixT = 0; return; }
      if (st.switching) { st.pa = st.pb; st.mixT = 0; }
      st.lastSwitch = st.now;
      if (id === st.pa) { st.switching = false; return; }
      st.pb = id;
      st.mixT = 0;
      st.switching = true;
    }
    function randomOther() {
      let id = st.pa;
      while (id === st.pa) id = Math.floor(Math.random() * PATTERNS.length);
      return id;
    }

    // ---- Settings ----
    function set(key, val) {
      const def = SETTINGS.find(s => s.key === key);
      if (!def) return;
      S[key] = def.type === 'checkbox' ? !!val : Number(val);
      if (key === 'pattern') switchTo(S.pattern);
      if (key === 'antialias') warmAll();
    }

    // ---- Audio: array of ~128 frequency bins in 0..1 (low → high) ----
    function setAudio(arr) {
      if (!arr || !arr.length) return;
      st.rawBass = band(arr, 0, 4);
      st.rawMid = band(arr, 4, 30) * 1.5;
      st.rawHigh = band(arr, 30, 128) * 2.5;
      st.audioAge = 0;
    }

    function onKick(strength) {
      st.lastKick = st.now;
      st.kick = 1;
      st.hue += S.beatColor * (0.6 + 0.4 * Math.random());
      st.spinVel += S.beatSpin * 0.8 * (Math.random() < 0.5 ? -1 : 1);
      if (S.beatSwitch && strength > 1.9 && !st.switching && st.now - st.lastSwitch > 4) switchTo(randomOther());
    }

    function update(dt) {
      st.audioAge += dt;
      const on = S.audioReactive && st.audioAge < 0.5;
      const sens = S.sensitivity;
      const tb = on ? Math.min(1.5, st.rawBass * sens) : 0;
      const tm = on ? Math.min(1.5, st.rawMid * sens) : 0;
      const th = on ? Math.min(1.5, st.rawHigh * sens) : 0;

      const up = lerp(30, 4, S.smoothing), down = lerp(10, 1.5, S.smoothing);
      const follow = (cur, target) => cur + (target - cur) * (1 - Math.exp(-(target > cur ? up : down) * dt));
      st.bass = follow(st.bass, tb);
      st.mid = follow(st.mid, tm);
      st.high = follow(st.high, th);

      if (on) {
        st.bassAvg += (tb - st.bassAvg) * (1 - Math.exp(-dt * 1.5));
        if (tb > st.bassAvg * 1.3 + 0.06 && st.now - st.lastKick > 0.22) onKick(tb / (st.bassAvg + 0.05));
      } else {
        st.bassAvg *= Math.exp(-dt);
      }
      st.kick *= Math.exp(-dt * 5);
      st.spinVel *= Math.exp(-dt * 2.5);

      st.spin += dt * 0.03 * S.speed + st.spinVel * dt;
      st.time += dt * S.speed * (1 + st.bass * S.bassSpeed * 1.5);
      st.hue += dt * S.colorCycle * 0.05 * (1 + st.mid);

      if (st.switching) {
        st.mixT += dt / 1.6;
        if (st.mixT >= 1) { st.pa = st.pb; st.mixT = 0; st.switching = false; }
      }
      if (S.autoSwitch && !st.switching && st.now - st.lastSwitch > S.switchEvery) {
        switchTo((st.pa + 1) % PATTERNS.length);
      }

      const mx = S.mouseReactive ? st.mx : 0, my = S.mouseReactive ? st.my : 0;
      st.smx += (mx - st.smx) * (1 - Math.exp(-dt * 2));
      st.smy += (my - st.smy) * (1 - Math.exp(-dt * 2));
    }

    function resize() {
      let w, h;
      if (fixedSize) {
        [w, h] = fixedSize;
      } else {
        const sc = clamp(S.quality, 0.25, 1) * (window.devicePixelRatio || 1);
        w = Math.max(1, Math.round(window.innerWidth * sc));
        h = Math.max(1, Math.round(window.innerHeight * sc));
      }
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
    }

    function drawPattern(id) {
      const { prog, U } = program(id);
      gl.useProgram(prog);
      gl.uniform2f(U.R, canvas.width, canvas.height);
      gl.uniform1f(U.T, st.time);
      gl.uniform1f(U.HUE, ((S.hueShift + st.hue) % 1 + 1) % 1);
      gl.uniform1f(U.SYM, S.symmetry);
      gl.uniform1f(U.SPIN, st.spin);
      gl.uniform1f(U.GLOW, S.glow * (1 + st.kick * S.beatFlash * 1.2));
      gl.uniform1f(U.SAT, S.saturation);
      gl.uniform1f(U.SIZE, S.pillSize);
      gl.uniform1f(U.ZOOMP, st.bass * S.bassZoom);
      gl.uniform1f(U.WARP, st.mid * S.midWarp);
      gl.uniform1f(U.SPARK, st.high * S.trebleSparkle);
      gl.uniform2f(U.M, st.smx, st.smy);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function draw() {
      drawPattern(st.pa);
      if (st.switching) {
        // Crossfade: draw the next pattern on top with constant alpha
        const m = st.mixT * st.mixT * (3 - 2 * st.mixT);
        gl.enable(gl.BLEND);
        gl.blendColor(0, 0, 0, m);
        gl.blendFunc(gl.CONSTANT_ALPHA, gl.ONE_MINUS_CONSTANT_ALPHA);
        drawPattern(st.pb);
        gl.disable(gl.BLEND);
      }
    }

    function step(dt, nowSec) {
      st.now = nowSec;
      update(dt);
      resize();
      draw();
      st.frames++;
    }

    function loop(now) {
      raf = requestAnimationFrame(loop);
      const minDt = 1000 / Math.max(10, S.fpsLimit);
      if (now - lastDraw < minDt - 1) return;
      lastDraw = now;
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      step(dt, now / 1000);
    }

    return {
      S,
      set,
      setAudio,
      levels: () => ({ bass: st.bass, mid: st.mid, high: st.high, kick: st.kick }),
      currentPattern: () => (st.switching ? st.pb : st.pa),
      setFixedSize(w, h) { fixedSize = w && h ? [w, h] : null; },
      start() { if (!raf) raf = requestAnimationFrame(loop); },
      stop() { cancelAnimationFrame(raf); raf = 0; last = 0; },
    };
  }

  root.PillsEngine = { SETTINGS, PATTERNS, create };
})(typeof window !== 'undefined' ? window : globalThis);
