/* 첫 화면 배경 오로라 (SoftAurora 부품을 일반 JS로 옮긴 것, 밝은 바탕용)
   색, 밝기, 빠르기는 SETTINGS만 바꾸면 됩니다.
   WebGL2를 못 쓰는 환경에서는 그려지지 않고 사진만 보입니다. */
(function () {
  const SETTINGS = {
    speed: 0.6,
    scale: 1.5,
    brightness: 1.0,
    color1: [0.969, 0.969, 0.969],  /* #f7f7f7 */
    color2: [0.882, 0, 1],           /* #e100ff */
    noiseFrequency: 2.5,
    noiseAmplitude: 1.0,
    bandHeight: 0.14,
    bandSpread: 1.0,
    octaveDecay: 0.1,
    layerOffset: 0,
    colorSpeed: 1.0,
    spectrum: 1,
    influence: 0.25,
    opacity: 0.8
  };
  const MAX_PULSES = 4;

  const VERTEX = `#version 300 es
  const vec2 corners[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
  void main() {
    gl_Position = vec4(corners[gl_VertexID], 0.0, 1.0);
  }`;

  const FRAGMENT = `#version 300 es
  precision highp float;
  uniform vec2 uResolution;
  uniform float uFlow;
  uniform float uHue;
  uniform float uSpectrum;
  uniform float uScale;
  uniform float uBrightness;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform float uNoiseFreq;
  uniform float uNoiseAmp;
  uniform float uBandHeight;
  uniform float uBandSpread;
  uniform float uOctaveDecay;
  uniform float uLayerOffset;
  uniform vec2 uShift;
  uniform vec4 uCursor;
  uniform vec4 uPulses[${MAX_PULSES}];
  uniform vec3 uIntro;
  uniform float uOpacity;
  out vec4 fragColor;
  #define TAU 6.28318

  vec3 gradientHash(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 234.6)), dot(p, vec3(269.5, 183.3, 198.3)), dot(p, vec3(169.5, 283.3, 156.9)));
    vec3 h = fract(sin(p) * 43758.5453123);
    float phi = acos(2.0 * h.x - 1.0);
    float theta = TAU * h.y;
    return vec3(cos(theta) * sin(phi), sin(theta) * cos(phi), cos(phi));
  }

  float quinticSmooth(float t) {
    float t2 = t * t;
    float t3 = t * t2;
    return 6.0 * t3 * t2 - 15.0 * t2 * t2 + 10.0 * t3;
  }

  vec3 cosineGradient(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(TAU * (c * t + d));
  }

  float perlin3D(float amplitude, float frequency, float px, float py, float pz) {
    float x = px * frequency;
    float y = py * frequency;
    float fx = floor(x);
    float fy = floor(y);
    float fz = floor(pz);
    float cx = ceil(x);
    float cy = ceil(y);
    float cz = ceil(pz);
    float d000 = dot(gradientHash(vec3(fx, fy, fz)), vec3(x - fx, y - fy, pz - fz));
    float d100 = dot(gradientHash(vec3(cx, fy, fz)), vec3(x - cx, y - fy, pz - fz));
    float d010 = dot(gradientHash(vec3(fx, cy, fz)), vec3(x - fx, y - cy, pz - fz));
    float d110 = dot(gradientHash(vec3(cx, cy, fz)), vec3(x - cx, y - cy, pz - fz));
    float d001 = dot(gradientHash(vec3(fx, fy, cz)), vec3(x - fx, y - fy, pz - cz));
    float d101 = dot(gradientHash(vec3(cx, fy, cz)), vec3(x - cx, y - fy, pz - cz));
    float d011 = dot(gradientHash(vec3(fx, cy, cz)), vec3(x - fx, y - cy, pz - cz));
    float d111 = dot(gradientHash(vec3(cx, cy, cz)), vec3(x - cx, y - cy, pz - cz));
    float sx = quinticSmooth(x - fx);
    float sy = quinticSmooth(y - fy);
    float sz = quinticSmooth(pz - fz);
    float ly0 = mix(mix(d000, d100, sx), mix(d010, d110, sx), sy);
    float ly1 = mix(mix(d001, d101, sx), mix(d011, d111, sx), sy);
    return amplitude * mix(ly0, ly1, sz);
  }

  float auroraGlow(float t, vec2 uv, float bend) {
    float noiseVal = 0.0;
    float freq = uNoiseFreq;
    float amp = uNoiseAmp;
    vec2 samplePos = uv * uScale;
    for (float i = 0.0; i < 3.0; i += 1.0) {
      noiseVal += perlin3D(amp, freq, samplePos.x, samplePos.y, t);
      amp *= uOctaveDecay;
      freq *= 2.0;
    }
    float yBand = uv.y * 10.0 - (uBandHeight + bend) * 10.0;
    return 0.3 * max(exp(uBandSpread * (1.0 - 1.1 * uIntro.y * abs(noiseVal * uIntro.z + yBand))), 0.0);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    vec2 screen = gl_FragCoord.xy / uResolution.y;
    vec2 cursor = uCursor.xy;
    vec2 field = screen + uShift;
    float t = 0.4 * uFlow;

    float reach = exp(-pow((screen.x - cursor.x) / 0.32, 2.0)) * uCursor.z;
    float gap = cursor.y + uShift.y - uBandHeight;
    float near = exp(-gap * gap / 0.16);
    float bend = reach * gap * near * 0.55;

    float pulse = 0.0;
    for (int i = 0; i < ${MAX_PULSES}; i++) {
      vec4 wave = uPulses[i];
      if (wave.z <= 0.0) continue;
      float x = (abs(screen.x - wave.x) - wave.w * 0.55) / (0.1 + wave.w * 0.06);
      pulse += wave.z * exp(-x * x);
    }
    float boost = (1.0 + reach * near * 0.25 + pulse * 0.65) * uIntro.x;

    float glow1 = auroraGlow(t, field, bend) * boost;
    float glow2 = auroraGlow(t + uLayerOffset, field, bend) * boost;
    vec3 gradient1 = mix(vec3(1.0), cosineGradient(uv.x + uHue * 0.2, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.3, 0.20, 0.20)), uSpectrum);
    vec3 gradient2 = mix(vec3(1.0), cosineGradient(uv.x + uHue * 0.1, vec3(0.5), vec3(0.5), vec3(2.0, 1.0, 0.0), vec3(0.5, 0.20, 0.25)), uSpectrum);
    vec3 col = (0.99 * glow1 * gradient1 * uColor1 + 0.99 * glow2 * gradient2 * uColor2) * uBrightness;

    float grain = (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5) / 255.0;
    float energy = max(col.r, max(col.g, col.b));
    vec3 hue = clamp(col / max(energy, 1e-4), 0.0, 1.0);
    vec3 average = (glow1 * uColor1 + glow2 * uColor2) / max(glow1 + glow2, 1e-4);
    float top = max(average.r, max(average.g, average.b));
    float spread = top - min(average.r, min(average.g, average.b));
    float core = smoothstep(0.55, 1.6, energy);
    float depth = 1.25 + 0.45 * core;
    vec3 tint = mix(average * 0.82, pow(average / max(top, 1e-4), vec3(depth + 0.6)), smoothstep(0.04, 0.2, spread));
    float vivid = smoothstep(0.12, 0.55, 1.0 - min(hue.r, min(hue.g, hue.b))) * smoothstep(0.04, 0.2, spread);
    vec3 ink = mix(tint, pow(hue, vec3(depth)), vivid) * mix(0.93, 0.8, core);
    float density = 0.88 * (1.0 - exp(-1.9 * pow(energy, 1.7)));
    density = clamp(density * uOpacity + grain, 0.0, 1.0);
    fragColor = vec4(ink * density, density);
  }`;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const smoother = t => {
    const x = clamp(t, 0, 1);
    return x * x * x * (x * (x * 6 - 15) + 10);
  };

  const compile = (gl, type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    console.error(gl.getShaderInfoLog(shader));
    return null;
  };

  const link = gl => {
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    if (!vertex || !fragment) return null;
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
    const uniforms = {};
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let index = 0; index < count; index++) {
      const info = gl.getActiveUniform(program, index);
      uniforms[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(program, info.name);
    }
    return { program, uniforms };
  };

  function start(section) {
    const canvas = document.createElement('canvas');
    canvas.className = 'soft-aurora';
    canvas.setAttribute('aria-hidden', 'true');
    const area = section.parentElement;
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
    const shader = gl && link(gl);
    if (!shader) return;
    section.prepend(canvas);

    const s = SETTINGS;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const vao = gl.createVertexArray();
    const size = { width: 1, height: 1 };
    const pointer = { x: 0.5, y: 0.5, inside: false };
    const mouse = { x: 0.5, y: 0.5, presence: 0 };
    const pulses = [];
    const pulseData = new Float32Array(MAX_PULSES * 4);
    let flow = 0;
    let hue = 0;
    let opening = reduced ? 1 : 0;
    let raf = 0;
    let last = 0;
    let visible = true;
    let lost = false;

    const resize = () => {
      const rect = section.getBoundingClientRect();
      size.width = Math.max(1, rect.width);
      size.height = Math.max(1, rect.height);
      const ratio = 0.5;
      canvas.width = Math.max(1, Math.round(size.width * ratio));
      canvas.height = Math.max(1, Math.round(size.height * ratio));
    };

    const frame = now => {
      raf = 0;
      if (lost) return;
      const dt = clamp((now - last) / 1000 || 0, 0, 0.05);
      last = Math.max(last, now);
      flow += dt * s.speed * (reduced ? 0.35 : 1);
      hue += dt * s.speed * s.colorSpeed * (reduced ? 0.35 : 1);
      if (opening < 1) opening = Math.min(1, opening + dt / 2);

      const tracking = pointer.inside;
      const follow = 1 - Math.exp(-dt / 0.325);
      mouse.x += ((tracking ? pointer.x : 0.5) - mouse.x) * follow;
      mouse.y += ((tracking ? pointer.y : 0.5) - mouse.y) * follow;
      mouse.presence += ((tracking ? 1 : 0) - mouse.presence) * (1 - Math.exp(-dt / (tracking ? 0.45 : 0.8)));

      for (let index = pulses.length - 1; index >= 0; index--) {
        pulses[index].age += dt;
        if (pulses[index].age >= 2.6) pulses.splice(index, 1);
      }
      pulseData.fill(0);
      pulses.forEach((pulse, index) => {
        pulseData[index * 4] = pulse.x;
        pulseData[index * 4 + 1] = pulse.y;
        pulseData[index * 4 + 2] = smoother(pulse.age / 0.18) * (1 - smoother((pulse.age - 0.18) / 2.42));
        pulseData[index * 4 + 3] = pulse.age;
      });

      const eased = 1 - Math.pow(1 - opening, 3);
      const aspect = size.width / size.height;
      const u = shader.uniforms;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(shader.program);
      gl.bindVertexArray(vao);
      gl.uniform2f(u.uResolution, canvas.width, canvas.height);
      gl.uniform1f(u.uFlow, flow);
      gl.uniform1f(u.uHue, hue);
      gl.uniform1f(u.uSpectrum, s.spectrum);
      gl.uniform1f(u.uScale, s.scale);
      gl.uniform1f(u.uBrightness, s.brightness);
      gl.uniform3fv(u.uColor1, s.color1);
      gl.uniform3fv(u.uColor2, s.color2);
      gl.uniform1f(u.uNoiseFreq, s.noiseFrequency);
      gl.uniform1f(u.uNoiseAmp, s.noiseAmplitude);
      gl.uniform1f(u.uBandHeight, s.bandHeight);
      gl.uniform1f(u.uBandSpread, s.bandSpread);
      gl.uniform1f(u.uOctaveDecay, s.octaveDecay);
      gl.uniform1f(u.uLayerOffset, s.layerOffset);
      gl.uniform2f(u.uShift, (mouse.x - 0.5) * s.influence, (mouse.y - 0.5) * s.influence);
      gl.uniform4f(u.uCursor, mouse.x * aspect, mouse.y, Math.min(1, s.influence * 4) * mouse.presence, 0);
      gl.uniform4fv(u.uPulses, pulseData);
      gl.uniform3f(u.uIntro, smoother(opening / 0.7), 1 + 3 * (1 - eased) * (1 - eased), 0.25 + 0.75 * eased);
      gl.uniform1f(u.uOpacity, s.opacity);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      if (visible && document.visibilityState !== 'hidden') raf = requestAnimationFrame(frame);
    };

    const wake = () => {
      if (raf || lost || !visible || document.visibilityState === 'hidden') return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };

    const locate = event => {
      const rect = area.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) / Math.max(1, rect.width),
        y: 1 - (event.clientY - rect.top) / Math.max(1, rect.height),
        inside: event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom
      };
    };

    addEventListener('pointermove', event => {
      Object.assign(pointer, locate(event));
    }, { passive: true });
    addEventListener('pointerdown', event => {
      const spot = locate(event);
      if (!spot.inside || reduced) return;
      pulses.push({ x: spot.x * (size.width / size.height), y: spot.y, age: 0 });
      if (pulses.length > MAX_PULSES) pulses.shift();
    }, { passive: true });
    addEventListener('pointerup', event => {
      if (event.pointerType !== 'mouse') pointer.inside = false;
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => { pointer.inside = false; });

    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      lost = true;
      canvas.remove();
    });

    new ResizeObserver(() => { resize(); wake(); }).observe(section);
    new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      wake();
    }).observe(section);
    document.addEventListener('visibilitychange', wake);

    resize();
    wake();
  }

  document.querySelectorAll('#hero-aurora').forEach(start);
})();
