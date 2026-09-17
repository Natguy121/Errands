/* Errands — weather you can stand in.
   Rain that falls around you, wind that moves the grass, puddles that
   outlast the shower, and wet asphalt that catches the streetlamps. */
(function (ER) {
  'use strict';
  var U = ER.U;
  var T = window.THREE;
  var G = ER.Geom;

  /* ---------------- wind ---------------- */

  /* bend anything tall, in the vertex shader, by how far up the blade it is */
  ER.addWind = function (material, strength, scale) {
    /* The base strength is kept separately from the live uniform, because
       uniforms.uWind.value and userData.wind.value are the same Vector4 --
       reading the strength back out of the uniform to scale it compounds the
       gust every frame, and after a few hundred frames every blade of grass
       is displaced by metres. That is what the long green streaks were. */
    material.userData.windBase = strength || 0.12;
    material.userData.wind = { value: new T.Vector4(0, 0, strength || 0.12, scale || 0.15) };
    material.onBeforeCompile = (function (prev) {
      return function (shader) {
        if (prev) prev(shader);
        shader.uniforms.uWind = material.userData.wind.value
          ? { value: material.userData.wind.value } : { value: new T.Vector4() };
        material.userData.windUniform = shader.uniforms.uWind;
        shader.vertexShader = 'uniform vec4 uWind;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          [
            '#include <begin_vertex>',
            '{',
            '  #ifdef USE_INSTANCING',
            '  vec3 wp = (modelMatrix * instanceMatrix * vec4(0.0,0.0,0.0,1.0)).xyz;',
            '  #else',
            '  vec3 wp = (modelMatrix * vec4(0.0,0.0,0.0,1.0)).xyz;',
            '  #endif',
            '  float sway = sin(uWind.x + wp.x * uWind.w + wp.z * uWind.w * 0.7)',
            '             + 0.4 * sin(uWind.x * 2.3 + wp.z * uWind.w * 1.8);',
            '  float up = clamp(position.y, 0.0, 4.0);',
            '  transformed.x += sway * uWind.z * up * up;',
            '  transformed.z += sway * uWind.z * 0.55 * up * up;',
            '}'
          ].join('\n')
        );
      };
    })(material.onBeforeCompile);
    material.needsUpdate = true;
    return material;
  };

  /* ---------------- rain ---------------- */

  function Rain(scene) {
    this.count = 4200;
    var geo = new T.PlaneGeometry(0.012, 0.42);
    geo.translate(0, -0.21, 0);
    var mat = new T.MeshBasicMaterial({
      color: 0xbcc8cf, transparent: true, opacity: 0.34,
      side: T.DoubleSide, depthWrite: false
    });
    this.mesh = new T.InstancedMesh(geo, mat, this.count);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 5;
    scene.add(this.mesh);
    this.mat = mat;
    this.p = new Float32Array(this.count * 3);
    this.v = new Float32Array(this.count);
    var rng = new ER.RNG('rain');
    for (var i = 0; i < this.count; i++) {
      this.p[i * 3] = rng.float(-18, 18);
      this.p[i * 3 + 1] = rng.float(0, 22);
      this.p[i * 3 + 2] = rng.float(-18, 18);
      this.v[i] = rng.float(15, 26);
    }
    this._m = new T.Matrix4();
    this._q = new T.Quaternion();
    this._e = new T.Euler();
    this._s = new T.Vector3(1, 1, 1);
    this._pos = new T.Vector3();

    /* splashes: little rings that pop where drops land */
    var ring = new T.RingGeometry(0.03, 0.07, 10);
    ring.rotateX(-Math.PI / 2);
    this.splashCount = 260;
    this.splash = new T.InstancedMesh(ring, new T.MeshBasicMaterial({
      color: 0xc8d4d8, transparent: true, opacity: 0.30, depthWrite: false, side: T.DoubleSide
    }), this.splashCount);
    this.splash.frustumCulled = false;
    this.splash.visible = false;
    scene.add(this.splash);
    this.sp = [];
    for (var s = 0; s < this.splashCount; s++) this.sp.push({ t: rng.float(0, 1), x: 0, y: 0, z: 0 });
  }

  Rain.prototype.update = function (clock, camPos, dt, heightAt) {
    var wx = clock.weather;
    var amount = wx === 'storm' ? 1 : wx === 'rain' ? 0.72 : wx === 'drizzle' ? 0.3 : 0;
    this.mesh.visible = amount > 0.01;
    this.splash.visible = amount > 0.2;
    if (!this.mesh.visible) return;

    var shown = Math.floor(this.count * amount);
    this.mesh.count = shown;
    this.mat.opacity = 0.2 + amount * 0.22;
    var lean = wx === 'storm' ? 0.34 : 0.14;
    this._e.set(0, 0, lean);
    this._q.setFromEuler(this._e);
    var stretch = wx === 'storm' ? 1.7 : 1.15;
    this._s.set(1, stretch, 1);

    for (var i = 0; i < shown; i++) {
      this.p[i * 3 + 1] -= this.v[i] * dt * (wx === 'storm' ? 1.25 : 1);
      this.p[i * 3] += lean * this.v[i] * dt;
      if (this.p[i * 3 + 1] < -2) {
        this.p[i * 3 + 1] += 24;
        this.p[i * 3] = (Math.random() - 0.5) * 36;
        this.p[i * 3 + 2] = (Math.random() - 0.5) * 36;
      }
      if (this.p[i * 3] > 18) this.p[i * 3] -= 36;
      this._pos.set(camPos.x + this.p[i * 3], camPos.y + this.p[i * 3 + 1] - 9, camPos.z + this.p[i * 3 + 2]);
      this._m.compose(this._pos, this._q, this._s);
      this.mesh.setMatrixAt(i, this._m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;

    if (this.splash.visible) {
      var nShown = Math.floor(this.splashCount * amount);
      this.splash.count = nShown;
      for (var s = 0; s < nShown; s++) {
        var sp = this.sp[s];
        sp.t -= dt * 3.4;
        if (sp.t <= 0) {
          sp.t = 1;
          var a = Math.random() * 6.2832, r = Math.sqrt(Math.random()) * 12;
          sp.x = camPos.x + Math.cos(a) * r;
          sp.z = camPos.z + Math.sin(a) * r;
          sp.y = heightAt(sp.x, sp.z) + 0.02;
        }
        var grow = (1 - sp.t) * 5 + 0.2;
        this._m.makeScale(grow, 1, grow);
        this._m.setPosition(sp.x, sp.y, sp.z);
        this.splash.setMatrixAt(s, this._m);
      }
      this.splash.instanceMatrix.needsUpdate = true;
      this.splash.material.opacity = 0.3 * amount;
    }
  };

  /* ---------------- wetness ---------------- */

  /* wet asphalt gets darker and much glossier, which is most of how rain looks */
  function Wet(scene3d) {
    this.s = scene3d;
    this.tracked = [];
    var keys = ['asphalt', 'concrete', 'gravel', 'dirt', 'grass', 'field'];
    for (var k in scene3d.mats) {
      if (!Object.prototype.hasOwnProperty.call(scene3d.mats, k)) continue;
      var name = k.split(':')[0];
      if (keys.indexOf(name) < 0) continue;
      var m = scene3d.mats[k];
      if (!m.isMeshStandardMaterial) continue;
      this.tracked.push({
        mat: m,
        dryRough: m.roughness,
        dryColor: m.color.clone(),
        gloss: name === 'asphalt' || name === 'concrete' ? 1 : name === 'gravel' ? 0.55 : 0.28
      });
    }
  }

  Wet.prototype.update = function (wet) {
    for (var i = 0; i < this.tracked.length; i++) {
      var t = this.tracked[i];
      var w = wet * t.gloss;
      t.mat.roughness = U.lerp(t.dryRough, 0.13, w);
      t.mat.metalness = U.lerp(0, 0.24, w);
      t.mat.color.copy(t.dryColor).multiplyScalar(U.lerp(1, 0.58, w));
    }
  };

  /* ---------------- puddles ---------------- */

  function Puddles(scene, town) {
    this.town = town;
    var rng = new ER.RNG('puddles3d:' + town.seed);
    var spots = [];
    for (var i = 0; i < 2600 && spots.length < 420; i++) {
      var x = rng.float(0, town.w), z = rng.float(0, town.h);
      var terr = town.terrainAt(x, z);
      if (terr !== 'asphalt' && terr !== 'gravel' && terr !== 'concrete') continue;
      spots.push({ x: x, z: z, r: rng.float(0.5, 2.4), a: rng.float(0, 3.14), sq: rng.float(0.45, 1) });
    }
    var geo = new T.CircleGeometry(1, 14);
    geo.rotateX(-Math.PI / 2);
    var mat = new T.MeshStandardMaterial({
      color: 0x2a3338, roughness: 0.035, metalness: 0.5,
      transparent: true, opacity: 0
    });
    this.mat = mat;
    this.mesh = new T.InstancedMesh(geo, mat, Math.max(1, spots.length));
    this.mesh.receiveShadow = false;
    var m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler();
    for (var s = 0; s < spots.length; s++) {
      var p = spots[s];
      e.set(0, p.a, 0); q.setFromEuler(e);
      m.compose(new T.Vector3(p.x, town.heightAt(p.x, p.z) + 0.062, p.z), q,
        new T.Vector3(p.r, 1, p.r * p.sq));
      this.mesh.setMatrixAt(s, m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  Puddles.prototype.update = function (wet) {
    var a = U.clamp((wet - 0.18) * 1.25, 0, 0.88);
    this.mesh.visible = a > 0.02;
    this.mat.opacity = a;
  };

  ER.Rain = Rain;
  ER.Wet = Wet;
  ER.Puddles = Puddles;
})(window.ER = window.ER || {});
