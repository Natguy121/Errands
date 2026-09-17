/* Errands — being in it, from above.
 *
 * WASD walks in world directions and you face the way you are going. The
 * camera sits over your head and keeps you in the middle unless the edge of
 * the quarter gets in the way. The mouse is a pointer, not a head: whatever
 * it is over is what you will act on, and if it is over nothing then
 * whatever you are standing closest to.
 *
 * The interface is the one the first-person view had — pos, yaw, move, pick,
 * framed, snapshot, setActing, render — because the errands, the residents,
 * the journal and the save file all talk to it and none of them care which
 * way the camera points.
 */
(function (ER) {
  'use strict';
  var U = ER.U;

  var WALK = 1.62, RUN = 4.05;
  var RADIUS = 0.34;

  /* How far your arm goes. It lives in core/util.js because the rules in
     game.js reach for the same number. */
  var REACH = ER.REACH;

  /* metres across the short side of the screen */
  var ZOOM = { min: 9, max: 30, step: 1.25 };

  function View(canvas, town) {
    this.town = town;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    /* state, in the same shape the first-person view kept it: pos.x and pos.z
       are where you are on the map, pos.y is the ground under you. Nothing
       above uses pos.y any more, but the save file writes it and the terrain
       still has relief worth knowing about. */
    this.pos = { x: town.spawn.x, y: 0, z: town.spawn.y };
    this.pos.y = town.heightAt(this.pos.x, this.pos.z);
    this.yaw = Math.PI;                 /* facing is (-sin yaw, -cos yaw) */
    this.pitch = 0;                     /* flat world; kept so saves load */
    this.moving = false;
    this.running = false;
    this.crouch = false;
    this.speedNow = 0;
    this.locked = true;                 /* nothing to lock; never prompt */
    /* Twenty-two metres across the short side shows you about half the
       quarter, which is the distance most errands send you. The wheel goes
       from nine (a doorway) to thirty (all of it). */
    this.metres = 22;
    this.acting = 0;
    this.actingVerb = null;
    this.heldId = null;

    /* where the pointer is, in world metres */
    this.aim = { x: this.pos.x, y: this.pos.z, on: false };
    /* the step you are walking toward, for the little bob in the sprite */
    this.bob = 0;
    this.bobAmp = 0;

    this.bindPointer();
    this.resize();
  }

  /* ---------------- the pointer ---------------- */

  View.prototype.bindPointer = function () {
    var self = this;
    function track(e) {
      var r = self.canvas.getBoundingClientRect();
      var p = self.screenToWorld(e.clientX - r.left, e.clientY - r.top);
      self.aim.x = p.x; self.aim.y = p.y; self.aim.on = true;
    }
    this.canvas.addEventListener('mousemove', track);
    this.canvas.addEventListener('mousedown', track);
    this.canvas.addEventListener('mouseleave', function () { self.aim.on = false; });
    this.canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      self.metres = U.clamp(self.metres + (e.deltaY > 0 ? ZOOM.step : -ZOOM.step), ZOOM.min, ZOOM.max);
    }, { passive: false });
  };

  View.prototype.resize = function () {
    var w = window.innerWidth, h = window.innerHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.dpr = dpr;
    this.w = w; this.h = h;
  };

  /* ---------------- the camera ---------------- */

  /* pixels to the metre, and where on screen the world's origin lands */
  View.prototype.camera2d = function (w, h) {
    w = w || this.w; h = h || this.h;
    var ppm = Math.min(w, h) / this.metres;
    /* Keep you in the middle, but never show more than a metre past the edge
       of the world: a fifty-metre island with grey around it looks broken. */
    var halfW = w / (2 * ppm), halfH = h / (2 * ppm);
    var cx = this.pos.x, cy = this.pos.z;
    var m = 1.0;
    if (halfW * 2 >= this.town.w + m * 2) cx = this.town.w / 2;
    else cx = U.clamp(cx, halfW - m, this.town.w - halfW + m);
    if (halfH * 2 >= this.town.h + m * 2) cy = this.town.h / 2;
    else cy = U.clamp(cy, halfH - m, this.town.h - halfH + m);
    return { ppm: ppm, cx: cx, cy: cy, w: w, h: h,
      ox: w / 2 - cx * ppm, oy: h / 2 - cy * ppm };
  };

  View.prototype.screenToWorld = function (sx, sy) {
    var c = this.camera2d();
    return { x: (sx - c.ox) / c.ppm, y: (sy - c.oy) / c.ppm };
  };

  View.prototype.worldToScreen = function (x, y) {
    var c = this.camera2d();
    return { x: x * c.ppm + c.ox, y: y * c.ppm + c.oy };
  };

  /* ---------------- walking ---------------- */

  View.prototype.standable = function (x, z) {
    var t = this.town;
    if (t.isBlocked(x, z)) return false;
    if (t.isBlocked(x + RADIUS, z) || t.isBlocked(x - RADIUS, z)) return false;
    if (t.isBlocked(x, z + RADIUS) || t.isBlocked(x, z - RADIUS)) return false;
    return true;
  };

  View.prototype.move = function (dt, input) {
    /* From above, the keys are compass directions: W is north, which is -y.
       Turning the body to walk sideways is a first-person idea and it makes a
       top-down game feel like steering a tank. */
    var ex = 0, ey = 0;
    if (input.is('up')) ey -= 1;
    if (input.is('down')) ey += 1;
    if (input.is('left')) ex -= 1;
    if (input.is('right')) ex += 1;
    var running = input.is('run') && (ex || ey);
    this.crouch = input.is('crouch');

    var moved = 0;
    if (ex || ey) {
      var len = Math.hypot(ex, ey);
      ex /= len; ey /= len;
      var base = (running ? RUN : WALK) * (this.crouch ? 0.45 : 1);
      var speed = base * this.town.speedAt(this.pos.x, this.pos.z);
      var nx = this.pos.x + ex * speed * dt;
      var ny = this.pos.z + ey * speed * dt;
      if (this.standable(nx, this.pos.z)) { moved += Math.abs(nx - this.pos.x); this.pos.x = nx; }
      if (this.standable(this.pos.x, ny)) { moved += Math.abs(ny - this.pos.z); this.pos.z = ny; }
      this.speedNow = moved / Math.max(dt, 0.0001);
      /* you face where you are walking. yaw keeps the first-person meaning,
         where facing is (-sin yaw, -cos yaw), so the map and the resident
         code that reads it need no changes. */
      this.yaw = Math.atan2(-ex, -ey);
    } else {
      this.speedNow *= Math.pow(0.02, dt);
    }
    this.moving = moved > 0.0005;
    this.running = running && this.moving;

    this.pos.y = this.town.heightAt(this.pos.x, this.pos.z);

    var targetAmp = this.moving ? (this.running ? 1 : 0.55) : 0;
    this.bobAmp += (targetAmp - this.bobAmp) * Math.min(1, dt * 7);
    this.bob += dt * (this.running ? 11.2 : 7.1) * (this.moving ? 1 : 0);

    return { moved: moved, running: this.running };
  };

  /* ---------------- what you are about to touch ---------------- */

  /* A prop's own footprint: the rect it was given, or a circle of its radius.
     The 3D version fired a ray into invisible hit volumes; from above the
     footprint is right there on the paving, so the pointer can just be in it. */
  function inFootprint(p, x, y, pad) {
    pad = pad || 0;
    if (p.rect) {
      return x >= p.rect.x - pad && x <= p.rect.x + p.rect.w + pad &&
             y >= p.rect.y - pad && y <= p.rect.y + p.rect.h + pad;
    }
    var r = U.clamp(p.r === undefined ? 0.8 : p.r, 0.45, 3.2) + pad;
    return U.dist(x, y, p.x, p.y) <= r;
  }

  function distanceTo(p, x, y) {
    if (p.rect) {
      var dx = Math.max(p.rect.x - x, x - (p.rect.x + p.rect.w), 0);
      var dy = Math.max(p.rect.y - y, y - (p.rect.y + p.rect.h), 0);
      return Math.hypot(dx, dy);
    }
    return Math.max(0, U.dist(x, y, p.x, p.y) - U.clamp(p.r === undefined ? 0.8 : p.r, 0.45, 3.2));
  }

  /* Interactables often sit inside one another — the wall has its channel,
     its third stone and its mooring ring within a couple of metres — so when
     the errand wants one of them in particular, that one wins over whichever
     footprint the pointer happens to be over. */
  View.prototype.pick = function (props, range, preferId) {
    var reach = range || REACH;
    var px = this.pos.x, py = this.pos.z;
    var list = props || [];
    var i, p;

    /* the one the errand is asking for, if you can touch it at all */
    if (preferId) {
      p = this.town.props[preferId];
      if (p && distanceTo(p, px, py) <= reach) {
        return { propId: preferId, dist: distanceTo(p, px, py) };
      }
    }

    /* whatever the pointer is over, nearest first, so long as you can reach it */
    var best = null;
    if (this.aim.on) {
      for (i = 0; i < list.length; i++) {
        p = list[i];
        if (!inFootprint(p, this.aim.x, this.aim.y, 0.25)) continue;
        var d = distanceTo(p, px, py);
        if (d > reach) continue;
        var toAim = distanceTo(p, this.aim.x, this.aim.y);
        if (!best || toAim < best.toAim) best = { propId: p.id, dist: d, toAim: toAim };
      }
      if (best) return { propId: best.propId, dist: best.dist };
    }

    /* nothing under the pointer: whatever you are practically standing on */
    for (i = 0; i < list.length; i++) {
      p = list[i];
      var dd = distanceTo(p, px, py);
      if (dd > reach) continue;
      if (!best || dd < best.dist) best = { propId: p.id, dist: dd };
    }
    return best ? { propId: best.propId, dist: best.dist } : null;
  };

  /* ---------------- photographs ---------------- */

  /* A photograph from above is the patch of the quarter the frame is over.
     Everything worth photographing that is inside it counts. */
  View.prototype.framed = function (scene, maxRange) {
    var c = this.camera2d();
    var halfW = c.w / (2 * c.ppm) * 0.82, halfH = c.h / (2 * c.ppm) * 0.82;
    var out = [];
    var props = this.town.propList;
    for (var i = 0; i < props.length; i++) {
      var p = props[i];
      if (!p.photo && p.tags.indexOf('lamp') < 0 && p.tags.indexOf('dish') < 0 &&
          p.tags.indexOf('sign') < 0) continue;
      var x = p.rect ? p.rect.x + p.rect.w / 2 : p.x;
      var y = p.rect ? p.rect.y + p.rect.h / 2 : p.y;
      if (Math.abs(x - c.cx) > halfW || Math.abs(y - c.cy) > halfH) continue;
      if (maxRange && U.dist(x, y, this.pos.x, this.pos.z) > maxRange) continue;
      out.push({ id: p.id, d: U.dist(x, y, this.pos.x, this.pos.z) });
    }
    /* nearest first, so the photograph is named after what it is of */
    out.sort(function (a, b) { return a.d - b.d; });
    return out.map(function (o) { return o.id; });
  };

  /* a photograph: draw the same frame into an offscreen canvas at the size
     the journal wants, which costs nothing during ordinary play */
  View.prototype.snapshot = function (w, h) {
    w = w || 640; h = h || 400;
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    /* the darkroom filters read every pixel straight back out, which the
       browser warns about unless you say so up front */
    var ctx = cv.getContext('2d', { willReadFrequently: true });
    if (this.scene) this.scene.draw(ctx, this, this.camera2d(w, h), { photo: true });
    return cv;
  };

  /* ---------------- acting ---------------- */

  /* while you are holding E on something, the renderer draws the ring */
  View.prototype.setActing = function (frac, verb) {
    this.acting = U.clamp(frac || 0, 0, 1);
    this.actingVerb = this.acting > 0.002 ? (verb || this.actingVerb) : null;
  };

  View.prototype.setHeld = function (itemId) { this.heldId = itemId || null; };

  View.prototype.render = function () {
    if (!this.scene) return;
    var ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.scene.draw(ctx, this, this.camera2d(), {});
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };

  ER.View = View;
  ER.view2dInternals = { inFootprint: inFootprint, distanceTo: distanceTo, REACH: REACH, ZOOM: ZOOM };
})(typeof window !== 'undefined' ? (window.ER = window.ER || {}) : (global.ER = global.ER || {}));
