/* Errands — the sky over the section.
 *
 * An analytic sky: a scattering-shaped gradient driven by the sun's
 * elevation, a real sun disk with Mie glow, drifting cloud, stars and a
 * moon after dark. It also hands out the sun colour, the ambient colour
 * and the fog colour, so the whole scene is lit by the same sky. */
(function (ER) {
  'use strict';
  var U = ER.U;
  var T = window.THREE;

  /* elevation in degrees -> what the sky looks like.
     keep these sorted ascending; everything between is interpolated. */
  var STOPS = [
    { e: -90, zen: 0x06080f, hor: 0x0d121e, sun: 0x0d121e, sunI: 0.00, amb: 0x24304f, ambI: 0.26,  fog: 0x11182a, haze: 0.10 },
    { e: -14, zen: 0x0a0e1a, hor: 0x171e2c, sun: 0x161a24, sunI: 0.00, amb: 0x2b3862, ambI: 0.34,  fog: 0x1a2336, haze: 0.18 },
    { e:  -8, zen: 0x141d33, hor: 0x40384a, sun: 0x3a2c38, sunI: 0.06, amb: 0x2f3b58, ambI: 0.34,  fog: 0x2d3040, haze: 0.42 },
    { e:  -4, zen: 0x27395c, hor: 0x8a5250, sun: 0x8c4a34, sunI: 0.30, amb: 0x4d5f84, ambI: 0.56,  fog: 0x5c5560, haze: 0.70 },
    { e:  -1, zen: 0x3a5480, hor: 0xc9764c, sun: 0xd2643a, sunI: 0.85, amb: 0x66789c, ambI: 0.72,  fog: 0x94765f, haze: 0.92 },
    { e:   3, zen: 0x42679b, hor: 0xe3a06a, sun: 0xffa057, sunI: 1.75, amb: 0x7c8fb2, ambI: 0.82,  fog: 0xb99678, haze: 1.00 },
    { e:   9, zen: 0x466fa8, hor: 0xe8c39a, sun: 0xffd39a, sunI: 2.45, amb: 0x8b9cba, ambI: 0.88,  fog: 0xc8b49a, haze: 0.82 },
    { e:  18, zen: 0x3f6fae, hor: 0xc3d2dd, sun: 0xfff0d6, sunI: 3.05, amb: 0x8fa4bf, ambI: 0.92,  fog: 0xbfcbd4, haze: 0.62 },
    { e:  34, zen: 0x38699f, hor: 0xb3c7d6, sun: 0xfff7e9, sunI: 3.45, amb: 0x93a9c4, ambI: 0.98,  fog: 0xb4c4d0, haze: 0.50 },
    { e:  60, zen: 0x2f6096, hor: 0xa8c0d2, sun: 0xfffbf4, sunI: 3.60, amb: 0x96adc8, ambI: 1.02, fog: 0xadbecb, haze: 0.44 }
  ];

  function lerpHex(a, b, t) {
    var ca = new T.Color(a), cb = new T.Color(b);
    return ca.lerp(cb, t);
  }

  function sample(elevDeg) {
    var i;
    if (elevDeg <= STOPS[0].e) return blend(STOPS[0], STOPS[0], 0);
    for (i = 0; i < STOPS.length - 1; i++) {
      if (elevDeg <= STOPS[i + 1].e) {
        var t = (elevDeg - STOPS[i].e) / (STOPS[i + 1].e - STOPS[i].e);
        return blend(STOPS[i], STOPS[i + 1], U.smooth(U.clamp(t, 0, 1)));
      }
    }
    return blend(STOPS[STOPS.length - 1], STOPS[STOPS.length - 1], 0);
  }

  function blend(a, b, t) {
    return {
      zen: lerpHex(a.zen, b.zen, t),
      hor: lerpHex(a.hor, b.hor, t),
      sun: lerpHex(a.sun, b.sun, t),
      sunI: U.lerp(a.sunI, b.sunI, t),
      amb: lerpHex(a.amb, b.amb, t),
      ambI: U.lerp(a.ambI, b.ambI, t),
      fog: lerpHex(a.fog, b.fog, t),
      haze: U.lerp(a.haze, b.haze, t)
    };
  }

  var VERT = [
    'varying vec3 vDir;',
    'void main() {',
    '  vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);',
    '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    '  gl_Position = projectionMatrix * mv;',
    '  gl_Position.z = gl_Position.w * 0.999999;',   /* pin to the far plane */
    '}'
  ].join('\n');

  var FRAG = [
    'precision highp float;',
    'varying vec3 vDir;',
    'uniform vec3 uZenith;',
    'uniform vec3 uHorizon;',
    'uniform vec3 uGround;',
    'uniform vec3 uSunDir;',
    'uniform vec3 uSunCol;',
    'uniform vec3 uMoonDir;',
    'uniform float uSunI;',
    'uniform float uHaze;',
    'uniform float uCloud;',      /* 0 clear .. 1 solid overcast */
    'uniform float uCloudDark;',
    'uniform float uStars;',
    'uniform float uTime;',
    'uniform float uMoon;',

    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float vnoise(vec2 p){',
    '  vec2 i = floor(p), f = fract(p);',
    '  f = f * f * (3.0 - 2.0 * f);',
    '  float a = hash(i), b = hash(i + vec2(1.0, 0.0));',
    '  float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));',
    '  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);',
    '}',
    'float fbm(vec2 p){',
    '  float v = 0.0, a = 0.5;',
    '  for (int i = 0; i < 5; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; }',
    '  return v;',
    '}',

    'void main() {',
    '  vec3 d = normalize(vDir);',
    '  float up = clamp(d.y, -1.0, 1.0);',

    /* the gradient: horizon haze falls off with a power curve */
    '  float t = pow(clamp(1.0 - max(up, 0.0), 0.0, 1.0), mix(3.4, 1.5, uHaze));',
    '  vec3 sky = mix(uZenith, uHorizon, t);',

    /* below the horizon it is ground haze, not sky */
    '  sky = mix(sky, uGround, clamp(-up * 7.0, 0.0, 1.0));',

    /* stars, before the sun and the clouds get a say */
    '  if (uStars > 0.01 && up > -0.03) {',
    '    vec2 sp = d.xz / max(abs(d.y) + 0.22, 0.05);',
    '    float grid = 260.0;',
    '    vec2 cell = floor(sp * grid);',
    '    float r = hash(cell);',
    '    float bright = smoothstep(0.9965, 1.0, r);',
    '    vec2 sub = fract(sp * grid) - 0.5 - (vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5) * 0.6;',
    '    float star = bright * smoothstep(0.34, 0.0, length(sub));',
    '    float twink = 0.65 + 0.35 * sin(uTime * 2.4 + r * 90.0);',
    '    float band = smoothstep(0.55, 0.0, abs(d.y * 1.7 + d.x * 0.5)) * 0.10;',
    '    sky += (vec3(0.92, 0.95, 1.0) * star * twink * 2.2 + vec3(0.5, 0.55, 0.72) * band) * uStars;',
    '  }',

    /* the moon */
    '  if (uMoon > 0.01) {',
    '    float md = dot(d, normalize(uMoonDir));',
    '    float disc = smoothstep(0.99935, 0.99975, md);',
    '    float glow = pow(max(md, 0.0), 220.0) * 0.5 + pow(max(md, 0.0), 12.0) * 0.05;',
    '    sky += (vec3(0.94, 0.94, 0.88) * disc * 1.6 + vec3(0.58, 0.64, 0.78) * glow) * uMoon;',
    '  }',

    /* the sun: a hard disc, a tight Mie lobe, and a wide aureole */
    '  float sd = dot(d, normalize(uSunDir));',
    '  float disc = smoothstep(0.99955, 0.99985, sd);',
    '  float mie = pow(max(sd, 0.0), 900.0) * 0.9 + pow(max(sd, 0.0), 42.0) * 0.16;',
    '  float aureole = pow(max(sd, 0.0), 4.0) * 0.10;',
    '  vec3 sunGlow = uSunCol * (disc * 22.0 + mie * 5.0 + aureole) * clamp(uSunI, 0.0, 4.0) * 0.5;',
    '  sky += sunGlow * (1.0 - uCloud * 0.82);',

    /* cloud: two layers of fbm on a flattened dome */
    '  if (uCloud > 0.01 && up > -0.02) {',
    '    vec2 cp = d.xz / max(up + 0.10, 0.02);',
    '    float drift = uTime * 0.0045;',
    '    float lo = fbm(cp * 0.55 + vec2(drift, drift * 0.4));',
    '    float hi = fbm(cp * 1.7 - vec2(drift * 1.7, drift * 0.8));',
    '    float cov = mix(0.72, 0.16, uCloud);',
    '    float m = smoothstep(cov, cov + 0.30, lo * 0.72 + hi * 0.28);',
    '    m *= smoothstep(-0.02, 0.10, up);',
    /* lit tops, shaded bases, and the sun behind them */
    '    float lit = clamp(dot(normalize(uSunDir), vec3(0.0, 1.0, 0.0)) * 0.5 + 0.55, 0.0, 1.0);',
    '    vec3 cloudCol = mix(vec3(0.30, 0.32, 0.36), vec3(1.02, 1.00, 0.97), lit);',
    '    cloudCol = mix(cloudCol, cloudCol * uSunCol * 1.2, pow(max(sd, 0.0), 6.0) * 0.6);',
    '    cloudCol *= mix(1.0, 0.42, uCloudDark);',
    '    sky = mix(sky, cloudCol, m * clamp(uCloud * 1.25, 0.0, 1.0));',
    '  }',

    '  gl_FragColor = vec4(sky, 1.0);',
    '}'
  ].join('\n');

  function Sky(scene) {
    this.uniforms = {
      uZenith:   { value: new T.Color(0x3f6fae) },
      uHorizon:  { value: new T.Color(0xc3d2dd) },
      uGround:   { value: new T.Color(0x5e5f52) },
      uSunDir:   { value: new T.Vector3(0, 1, 0) },
      uSunCol:   { value: new T.Color(0xfff0d6) },
      uMoonDir:  { value: new T.Vector3(0, -1, 0) },
      uSunI:     { value: 3.0 },
      uHaze:     { value: 0.6 },
      uCloud:    { value: 0.2 },
      uCloudDark:{ value: 0.0 },
      uStars:    { value: 0.0 },
      uMoon:     { value: 0.0 },
      uTime:     { value: 0 }
    };
    var geo = new T.SphereGeometry(6000, 32, 20);
    var mat = new T.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: T.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false
    });
    this.mesh = new T.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    scene.add(this.mesh);

    /* the lights the sky implies */
    this.sun = new T.DirectionalLight(0xfff0d6, 3.0);
    this.sun.castShadow = true;
    /* 1024 across a 92 m shadow camera is about eleven texels per metre,
       which is plenty for a town, at a quarter of the rasterisation */
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far = 210;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.035;
    var sc = this.sun.shadow.camera;
    /* tight around the player: crisper shadows and far less to rasterise */
    sc.left = -46; sc.right = 46; sc.top = 46; sc.bottom = -46;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.hemi = new T.HemisphereLight(0x8fa4bf, 0x4a4a38, 0.75);
    scene.add(this.hemi);

    /* a cool fill from the opposite side, so shadowed faces are not black */
    this.fill = new T.DirectionalLight(0x9fb4cc, 0.18);
    scene.add(this.fill);

    this.state = sample(40);
  }

  /* where the sun is, given the clock. a plausible arc, not an almanac. */
  Sky.prototype.sunVector = function (clock) {
    var sr = clock.sunrise(), ss = clock.sunset();
    var h = clock.hourFloat();
    var dayLen = ss - sr;
    /* the clock owns the solar model, so the sky and the errand gates that
       key off dusk cannot drift apart */
    var elev = clock.sunElevation(h);
    /* azimuth: rises in the east (+x), sets in the west (-x), south at noon (+z here) */
    var az = U.lerp(-100, 100, U.clamp((h - sr) / dayLen, -0.6, 1.6)) * Math.PI / 180;
    var e = elev * Math.PI / 180;
    return {
      elev: elev,
      dir: new T.Vector3(Math.sin(az) * Math.cos(e), Math.sin(e), Math.cos(az) * Math.cos(e)).normalize()
    };
  };

  Sky.prototype.update = function (clock, t, cameraPos) {
    var sv = this.sunVector(clock);
    var wx = clock.weatherInfo();
    var s = sample(sv.elev);
    this.state = s;
    this.sunElev = sv.elev;
    this.sunDir = sv.dir;

    var cloud = { clear: 0.10, fair: 0.26, overcast: 0.88, drizzle: 0.92,
      rain: 0.96, storm: 1.0, fog: 0.72, frost: 0.14 }[clock.weather];
    var dark = { overcast: 0.30, drizzle: 0.52, rain: 0.68, storm: 0.86 }[clock.weather] || 0;

    var u = this.uniforms;
    u.uZenith.value.copy(s.zen);
    u.uHorizon.value.copy(s.hor);
    u.uSunCol.value.copy(s.sun);
    u.uSunI.value = s.sunI;
    u.uHaze.value = U.clamp(s.haze + (clock.fogAmt * 0.5), 0, 1.4);
    u.uCloud.value = cloud;
    u.uCloudDark.value = dark;
    u.uSunDir.value.copy(sv.dir);
    u.uStars.value = U.clamp((-sv.elev - 4) / 10, 0, 1) * (1 - cloud * 0.9);
    u.uMoon.value = U.clamp((-sv.elev - 2) / 8, 0, 1) * (1 - cloud * 0.95);
    u.uTime.value = t;
    /* the moon rides opposite the sun, offset so it is not a mirror */
    u.uMoonDir.value.set(-sv.dir.x * 0.8 + 0.3, Math.abs(sv.dir.y) * 0.8 + 0.12, -sv.dir.z * 0.9).normalize();
    u.uGround.value.copy(s.fog).lerp(new T.Color(0x4e4f42), 0.55);

    /* --- the lights --- */
    var occl = 1 - cloud * 0.72;
    this.sun.color.copy(s.sun);
    this.sun.intensity = s.sunI * occl;
    this.sun.visible = this.sun.intensity > 0.012;

    var ambBoost = 1 + cloud * 0.55;      /* overcast days are flat but bright */
    this.hemi.color.copy(s.amb).lerp(s.hor, 0.35);
    this.hemi.groundColor.set(0x4a4636).lerp(s.fog, 0.25);
    this.hemi.intensity = s.ambI * ambBoost;

    this.fill.color.copy(s.amb);
    this.fill.intensity = 0.14 + cloud * 0.10 + (sv.elev < -6 ? 0.30 : 0);
    this.fill.position.set(-sv.dir.x, Math.max(0.35, sv.dir.y * 0.4 + 0.4), -sv.dir.z).multiplyScalar(100);

    /* keep the shadow volume tight around wherever you are standing */
    if (cameraPos) {
      var d = sv.dir.clone().multiplyScalar(120);
      this.sun.position.set(cameraPos.x + d.x, Math.max(6, cameraPos.y + d.y), cameraPos.z + d.z);
      this.sun.target.position.copy(cameraPos);
      this.sun.target.updateMatrixWorld();
      this.sun.shadow.camera.updateProjectionMatrix();
      this.mesh.position.copy(cameraPos);
    }

    /* the fog is the horizon, which is why distance disappears into it */
    this.fogColor = s.fog.clone().lerp(new T.Color(0xc9ccc8), clock.fogAmt * 0.75);
    var base = 0.0016;
    var wxFog = { fog: 0.030, rain: 0.0075, storm: 0.011, drizzle: 0.0052, overcast: 0.0030 }[clock.weather] || 0;
    this.fogDensity = base + wxFog + clock.fogAmt * 0.020;
  };

  ER.Sky = Sky;
  ER.skySample = sample;
})(window.ER = window.ER || {});
