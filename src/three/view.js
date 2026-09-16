/* Errands — being in it.
 *
 * Eye height one metre sixty-eight. Mouse looks, WASD walks, the ground
 * pushes back, and whatever you are carrying is in your hands at the
 * bottom of the frame. */
(function (ER) {
  'use strict';
  var U = ER.U;
  var T = window.THREE;
  var G = ER.Geom;

  var EYE = 1.68, EYE_CROUCH = 1.16;
  var WALK = 1.62, RUN = 4.05;
  var RADIUS = 0.34;

  function View(canvas, town) {
    this.town = town;
    this.canvas = canvas;

    this.renderer = new T.WebGLRenderer({
      canvas: canvas, antialias: true, powerPreference: 'high-performance', stencil: false
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.autoClear = true;

    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(68, 16 / 9, 0.08, 2200);

    /* the hands live in their own scene so they never clip into a wall */
    this.handScene = new T.Scene();
    this.handCamera = new T.PerspectiveCamera(55, 16 / 9, 0.02, 4);
    var handLight = new T.DirectionalLight(0xffffff, 2.1);
    handLight.position.set(-0.4, 1, 1);
    this.handScene.add(handLight);
    this.handAmbient = new T.HemisphereLight(0xbfd0e0, 0x5a5448, 0.7);
    this.handScene.add(this.handAmbient);
    this.hands = new T.Group();
    this.handScene.add(this.hands);
    this.buildHands();

    /* state */
    this.yaw = Math.PI;
    this.pitch = -0.05;
    this.pos = new T.Vector3(town.spawn.x, 0, town.spawn.y);
    this.pos.y = town.heightAt(this.pos.x, this.pos.z);
    this.eye = EYE;
    this.bob = 0;
    this.bobAmp = 0;
    this.speedNow = 0;
    this.crouch = false;
    this.locked = false;
    this.sensitivity = 0.0021;
    this.fov = 68;
    this.targetFov = 68;

    this.raycaster = new T.Raycaster();
    this.raycaster.far = 5.2;
    this.centre = new T.Vector2(0, 0);

    this.bindPointer();
    this.resize();
  }

  /* ---------------- pointer lock and looking ---------------- */

  View.prototype.bindPointer = function () {
    var self = this;
    this.canvas.addEventListener('click', function () {
      if (!self.locked && !self.suppressLock) self.canvas.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', function () {
      self.locked = document.pointerLockElement === self.canvas;
      if (self.onLockChange) self.onLockChange(self.locked);
    });
    document.addEventListener('mousemove', function (e) {
      if (!self.locked) return;
      self.yaw -= e.movementX * self.sensitivity;
      self.pitch -= e.movementY * self.sensitivity;
      self.pitch = U.clamp(self.pitch, -1.45, 1.45);
    });
  };

  View.prototype.resize = function () {
    var w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.handCamera.aspect = w / h;
    this.handCamera.updateProjectionMatrix();
    this.w = w; this.h = h;
  };

  /* ---------------- hands ---------------- */

  View.prototype.buildHands = function () {
    var skin = new T.MeshStandardMaterial({ color: 0xc89c78, roughness: 0.68 });
    var sleeve = new T.MeshStandardMaterial({ color: 0x4d5560, roughness: 0.85 });

    this.armR = new T.Group();
    var foreR = new T.Mesh(new T.BoxGeometry(0.085, 0.085, 0.28), sleeve);
    foreR.position.set(0, 0, -0.14);
    this.armR.add(foreR);
    var handR = new T.Mesh(new T.BoxGeometry(0.082, 0.052, 0.13), skin);
    handR.position.set(0, 0, 0.02);
    this.armR.add(handR);
    for (var f = 0; f < 3; f++) {
      var fing = new T.Mesh(new T.BoxGeometry(0.021, 0.024, 0.062), skin);
      fing.position.set(-0.026 + f * 0.026, -0.012, 0.11);
      fing.rotation.x = -0.5;
      this.armR.add(fing);
    }
    var thumb = new T.Mesh(new T.BoxGeometry(0.026, 0.026, 0.056), skin);
    thumb.position.set(0.046, 0.006, 0.075);
    thumb.rotation.y = -0.5;
    this.armR.add(thumb);
    this.armR.scale.setScalar(0.62);
    this.armR.position.set(0.152, -0.176, -0.30);
    this.armR.rotation.set(-0.30, -0.18, 0.06);
    this.hands.add(this.armR);

    /* the left hand only comes up when both are needed */
    this.armL = this.armR.clone();
    this.armL.position.set(-0.168, -0.196, -0.32);
    this.armL.rotation.set(-0.36, 0.22, -0.06);
    this.armL.visible = false;
    this.hands.add(this.armL);

    this.heldMount = new T.Group();
    this.heldMount.position.set(0, 0.05, 0.13);
    this.heldMount.scale.setScalar(1.5);
    this.armR.add(this.heldMount);
    this.heldMesh = null;
  };

  /* a small stand-in object for whatever the errand has you carrying */
  View.prototype.setHeld = function (itemId) {
    if (this.heldId === itemId) return;
    this.heldId = itemId;
    if (this.heldMesh) { this.heldMount.remove(this.heldMesh); this.heldMesh = null; }
    if (!itemId) { this.armL.visible = false; this.armR.visible = false; return; }
    this.armR.visible = true;
    var kind = ER.itemKind(itemId);
    var def = ER.Items[itemId] || {};
    var g = new T.Group();
    var mk = function (geo, mat) { var m = new T.Mesh(geo, mat); g.add(m); return m; };

    if (kind === 'jar') {
      var glass = new T.MeshPhysicalMaterial({
        color: 0xdfe8e4, roughness: 0.06, metalness: 0, transparent: true,
        opacity: 0.36, transmission: 0.5, thickness: 0.4
      });
      mk(new T.CylinderGeometry(0.043, 0.041, 0.115, 16, 1, true), glass).position.y = 0.055;
      mk(new T.CircleGeometry(0.042, 16), glass).rotateX(-Math.PI / 2);
      if (def.fill) {
        var liq = new T.MeshStandardMaterial({ color: new T.Color(def.fill),
          roughness: 0.12, metalness: 0.02, transparent: true, opacity: 0.86 });
        var l = mk(new T.CylinderGeometry(0.039, 0.038, 0.082, 16), liq);
        l.position.y = 0.043;
      }
      if (def.lid) {
        var lid = mk(new T.CylinderGeometry(0.046, 0.046, 0.014, 16),
          new T.MeshStandardMaterial({ color: 0xb8a882, roughness: 0.42, metalness: 0.6 }));
        lid.position.y = 0.118;
      }
      if (def.twine) {
        var tw = mk(new T.TorusGeometry(0.045, 0.006, 6, 16),
          new T.MeshStandardMaterial({ color: 0xa8936a, roughness: 0.9 }));
        tw.rotateX(Math.PI / 2);
        tw.position.y = 0.104;
      }
    } else if (kind === 'paper') {
      var pm = new T.MeshStandardMaterial({ color: 0xe4e0d0, roughness: 0.84, side: T.DoubleSide });
      var sheet = mk(new T.PlaneGeometry(0.105, 0.14), pm);
      sheet.rotation.set(-1.3, 0.1, 0.12);
      sheet.position.y = 0.012;
    } else if (kind === 'leaf') {
      var lm = new T.MeshStandardMaterial({ color: 0x6d8146, roughness: 0.8, side: T.DoubleSide });
      var leaf = mk(new T.CircleGeometry(0.05, 7), lm);
      leaf.scale.set(0.7, 1, 1);
      leaf.rotation.set(-1.25, 0, 0.3);
    } else if (kind === 'nail' || kind === 'metal') {
      var nm = new T.MeshStandardMaterial({ color: kind === 'nail' ? 0x8a6a4a : 0x9a9a92,
        roughness: 0.72, metalness: 0.6 });
      var shaft = mk(new T.CylinderGeometry(0.004, 0.003, 0.075, 6), nm);
      shaft.rotation.x = Math.PI / 2;
      shaft.position.z = 0.02;
      var head = mk(new T.CylinderGeometry(0.009, 0.009, 0.004, 8), nm);
      head.rotation.x = Math.PI / 2;
      head.position.z = -0.018;
    } else if (kind === 'clay') {
      mk(new T.BoxGeometry(0.05, 0.05, 0.05),
        new T.MeshStandardMaterial({ color: def.fill ? new T.Color(def.fill) : 0x8a6a4f, roughness: 0.92 }))
        .position.y = 0.026;
    } else if (kind === 'wire') {
      var wm = new T.MeshStandardMaterial({ color: 0xb8a97f, roughness: 0.82 });
      var ball = mk(new T.SphereGeometry(0.042, 12, 8), wm);
      ball.position.y = 0.04;
    } else if (kind === 'tool') {
      var tm = new T.MeshStandardMaterial({ color: 0xdde0dc, roughness: 0.4, metalness: 0.25 });
      var handle = mk(new T.BoxGeometry(0.012, 0.007, 0.11), tm);
      handle.position.z = -0.02;
      var bowl = mk(new T.SphereGeometry(0.019, 10, 7), tm);
      bowl.scale.set(1, 0.4, 1.5);
      bowl.position.z = 0.05;
      if (def.fill) {
        var moss = mk(new T.SphereGeometry(0.014, 8, 6),
          new T.MeshStandardMaterial({ color: new T.Color(def.fill), roughness: 0.95 }));
        moss.scale.set(1, 0.5, 1.4);
        moss.position.set(0, 0.008, 0.05);
      }
    } else if (kind === 'photo') {
      var phm = new T.MeshStandardMaterial({ color: 0xd8d5cb, roughness: 0.5, side: T.DoubleSide });
      var pr = mk(new T.PlaneGeometry(0.1, 0.075), phm);
      pr.rotation.set(-1.25, 0, 0);
      pr.position.y = 0.01;
    } else {
      mk(new T.SphereGeometry(0.03, 10, 8),
        new T.MeshStandardMaterial({ color: 0x8f8c84, roughness: 0.8 })).position.y = 0.03;
    }

    g.traverse(function (o) { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    this.heldMesh = g;
    this.heldMount.add(g);
    this.armL.visible = kind === 'jar' || kind === 'paper' || kind === 'wire';
  };

  /* ---------------- moving ---------------- */

  View.prototype.standable = function (x, z) {
    var t = this.town;
    if (t.isBlocked(x, z)) return false;
    if (t.isBlocked(x + RADIUS, z) || t.isBlocked(x - RADIUS, z)) return false;
    if (t.isBlocked(x, z + RADIUS) || t.isBlocked(x, z - RADIUS)) return false;
    return true;
  };

  View.prototype.move = function (dt, input, game) {
    var fwd = 0, side = 0;
    if (input.is('up')) fwd += 1;
    if (input.is('down')) fwd -= 1;
    if (input.is('left')) side -= 1;
    if (input.is('right')) side += 1;
    var running = input.is('run') && (fwd || side);
    this.crouch = input.is('crouch');

    var moved = 0;
    if (fwd || side) {
      var len = Math.hypot(fwd, side);
      fwd /= len; side /= len;
      var sinY = Math.sin(this.yaw), cosY = Math.cos(this.yaw);
      /* -z is forward in three.js; our yaw of 0 looks down -z */
      var dx = (-sinY * fwd + cosY * side);
      var dz = (-cosY * fwd - sinY * side);
      var base = (running ? RUN : WALK) * (this.crouch ? 0.45 : 1);
      var speed = base * this.town.speedAt(this.pos.x, this.pos.z);
      var nx = this.pos.x + dx * speed * dt;
      var nz = this.pos.z + dz * speed * dt;
      if (this.standable(nx, this.pos.z)) { moved += Math.abs(nx - this.pos.x); this.pos.x = nx; }
      if (this.standable(this.pos.x, nz)) { moved += Math.abs(nz - this.pos.z); this.pos.z = nz; }
      this.speedNow = moved / Math.max(dt, 0.0001);
    } else {
      this.speedNow *= Math.pow(0.02, dt);
    }
    this.moving = moved > 0.0005;
    this.running = running && this.moving;

    /* the ground, smoothed so a rough verge does not make you seasick */
    var ground = this.town.heightAt(this.pos.x, this.pos.z);
    this.pos.y += (ground - this.pos.y) * Math.min(1, dt * 12);

    /* head bob, scaled by how fast you are actually going */
    var targetAmp = this.moving ? (this.running ? 1 : 0.55) : 0;
    this.bobAmp += (targetAmp - this.bobAmp) * Math.min(1, dt * 7);
    this.bob += dt * (this.running ? 11.2 : 7.1) * (this.moving ? 1 : 0);
    var bobY = Math.sin(this.bob * 2) * 0.031 * this.bobAmp;
    var bobX = Math.sin(this.bob) * 0.040 * this.bobAmp;
    var roll = Math.sin(this.bob) * 0.013 * this.bobAmp;

    var wantEye = this.crouch ? EYE_CROUCH : EYE;
    this.eye += (wantEye - this.eye) * Math.min(1, dt * 9);

    /* running pulls the field of view out a touch */
    this.targetFov = 68 + (this.running ? 4.5 : 0);
    if (Math.abs(this.fov - this.targetFov) > 0.01) {
      this.fov += (this.targetFov - this.fov) * Math.min(1, dt * 6);
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }

    var sinY2 = Math.sin(this.yaw), cosY2 = Math.cos(this.yaw);
    this.camera.position.set(
      this.pos.x + cosY2 * bobX,
      this.pos.y + this.eye + bobY,
      this.pos.z - sinY2 * bobX
    );
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(this.yaw);
    this.camera.rotateX(this.pitch);
    this.camera.rotateZ(roll);

    /* the hands follow with a lag, which is what sells them */
    var sway = -bobX * 0.35, lift = -bobY * 0.5;
    this.hands.position.set(sway, lift, 0);
    this.hands.rotation.z = roll * 1.6;
    this.hands.rotation.x = U.clamp(-this.pitch * 0.12, -0.2, 0.2);
    if (this.armR) {
      this.armR.rotation.x = -0.30 + Math.sin(this.bob) * 0.05 * this.bobAmp;
      this.armR.position.y = -0.176 + Math.sin(this.bob * 2) * 0.012 * this.bobAmp;
    }

    /* Bring the camera's world matrix up to date now rather than leaving it to
       the next render, so that anything asking what the crosshair is on this
       frame -- picking, the viewfinder -- sees where the camera actually is
       and not where it was last frame. */
    this.camera.updateMatrixWorld(true);

    return { moved: moved, running: this.running };
  };

  /* while you are holding E on something, the hands lean in */
  View.prototype.setActing = function (frac, verb) {
    var f = U.clamp(frac || 0, 0, 1);
    if (f > 0.002 && !this.heldId) this.armR.visible = true;
    else if (!this.heldId) this.armR.visible = false;
    var push = Math.sin(f * Math.PI) * 0.5 + f * 0.5;
    if (!this.armR) return;
    this.armR.position.z = -0.30 + push * 0.115;
    this.armR.rotation.x = -0.30 - push * 0.34;
    if (this.armL.visible) {
      this.armL.position.z = -0.32 + push * 0.09;
      this.armL.rotation.x = -0.36 - push * 0.26;
    }
  };

  /* ---------------- what the crosshair is on ---------------- */

  /* Interactables often sit inside one another -- the stone bridge has its
     moss, its arch stone and its middle all within a few metres -- so when the
     errand wants one of them in particular, that one wins over whichever
     volume happens to be nearest. */
  View.prototype.pick = function (targets, range, preferId) {
    this.raycaster.far = range || 5.2;
    this.raycaster.setFromCamera(this.centre, this.camera);
    var hits = this.raycaster.intersectObjects(targets, false);
    if (!hits.length) return null;
    if (preferId) {
      for (var i = 0; i < hits.length; i++) {
        if (hits[i].object.userData.propId === preferId) {
          return { propId: preferId, dist: hits[i].distance, point: hits[i].point };
        }
      }
    }
    return { propId: hits[0].object.userData.propId, dist: hits[0].distance, point: hits[0].point };
  };

  /* what is inside the viewfinder, for the photographs */
  View.prototype.framed = function (scene3d, maxRange) {
    var out = [];
    var v = new T.Vector3();
    var cam = this.camera;
    cam.updateMatrixWorld();
    for (var i = 0; i < scene3d.raycastTargets.length; i++) {
      var m = scene3d.raycastTargets[i];
      var p = scene3d.town.props[m.userData.propId];
      if (!p) continue;
      if (!p.photo && p.tags.indexOf('lamp') < 0 && p.tags.indexOf('dish') < 0 && p.tags.indexOf('sign') < 0) continue;
      v.copy(m.position);
      var d = v.distanceTo(cam.position);
      if (d > (maxRange || 70)) continue;
      v.project(cam);
      if (v.z < -1 || v.z > 1) continue;
      if (Math.abs(v.x) > 0.72 || Math.abs(v.y) > 0.72) continue;
      out.push(m.userData.propId);
    }
    return out;
  };

  /* a photograph: render the frame into an offscreen target and read it back,
     so the shutter costs nothing during ordinary play */
  View.prototype.snapshot = function (w, h) {
    w = w || 640; h = h || 400;
    if (!this._rt || this._rt.width !== w) {
      if (this._rt) this._rt.dispose();
      this._rt = new T.WebGLRenderTarget(w, h, { colorSpace: T.SRGBColorSpace });
      this._buf = new Uint8Array(w * h * 4);
    }
    var oldAspect = this.camera.aspect;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setRenderTarget(this._rt);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.readRenderTargetPixels(this._rt, 0, 0, w, h, this._buf);
    this.renderer.setRenderTarget(null);
    this.camera.aspect = oldAspect;
    this.camera.updateProjectionMatrix();

    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var ctx = cv.getContext('2d');
    var img = ctx.createImageData(w, h);
    /* the render target is bottom-up and the canvas is not, so flip it a row
       at a time rather than a byte at a time */
    var row = w * 4;
    for (var y = 0; y < h; y++) {
      img.data.set(this._buf.subarray((h - 1 - y) * row, (h - y) * row), y * row);
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  };

  View.prototype.render = function () {
    this.renderer.autoClear = true;
    this.renderer.render(this.scene, this.camera);
    /* what the town itself cost, before the hands are drawn over the top */
    this.mainCalls = this.renderer.info.render.calls;
    this.mainTris = this.renderer.info.render.triangles;
    this.renderer.autoClear = false;
    this.renderer.clearDepth();
    this.renderer.render(this.handScene, this.handCamera);
    this.renderer.autoClear = true;
  };

  ER.View = View;
  ER.EYE = EYE;
})(window.ER = window.ER || {});
