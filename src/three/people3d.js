/* Errands — the thirty, with bodies.
   A pool of rigs is handed to whichever residents are close enough to see,
   so thirty people cost about as much as twelve. */
(function (ER) {
  'use strict';
  var U = ER.U;
  var T = window.THREE;
  var G = ER.Geom;

  var POOL = 14;
  var SKIN = [0xd8b08a, 0xc49a76, 0x8d6247, 0x6b4630, 0xe0bd9a, 0xa87c58];
  var HAIR = [0x2b2118, 0x4a3524, 0x6d5136, 0x8a7a62, 0xb8b4ac, 0x7a2f1c];

  function rig(mats) {
    var g = new T.Group();
    var parts = {};

    parts.hips = new T.Group();
    parts.hips.position.y = 0.92;
    g.add(parts.hips);

    var torso = new T.Mesh(new T.BoxGeometry(0.40, 0.58, 0.23), mats.shirt);
    torso.position.y = 0.29;
    torso.castShadow = true;
    parts.hips.add(torso);
    parts.torso = torso;

    var neck = new T.Mesh(new T.CylinderGeometry(0.055, 0.065, 0.08, 8), mats.skin);
    neck.position.y = 0.62;
    parts.hips.add(neck);

    parts.head = new T.Group();
    parts.head.position.y = 0.66;
    parts.hips.add(parts.head);
    var skull = new T.Mesh(new T.BoxGeometry(0.19, 0.24, 0.21), mats.skin);
    skull.position.y = 0.12;
    skull.castShadow = true;
    parts.head.add(skull);
    var hair = new T.Mesh(new T.BoxGeometry(0.205, 0.11, 0.225), mats.hair);
    hair.position.y = 0.205;
    parts.head.add(hair);
    var nose = new T.Mesh(new T.BoxGeometry(0.045, 0.05, 0.05), mats.skin);
    nose.position.set(0, 0.1, 0.115);
    parts.head.add(nose);
    parts.cap = new T.Mesh(new T.BoxGeometry(0.215, 0.085, 0.235), mats.shirt);
    parts.cap.position.y = 0.235;
    parts.cap.visible = false;
    parts.head.add(parts.cap);
    parts.brim = new T.Mesh(new T.BoxGeometry(0.2, 0.025, 0.12), mats.shirt);
    parts.brim.position.set(0, 0.2, 0.165);
    parts.brim.visible = false;
    parts.head.add(parts.brim);

    /* arms and legs, each a group that pivots at the joint */
    function limb(len, thick, mat, y, x) {
      var pivot = new T.Group();
      pivot.position.set(x, y, 0);
      var upper = new T.Mesh(new T.BoxGeometry(thick, len / 2, thick), mat);
      upper.position.y = -len / 4;
      upper.castShadow = true;
      pivot.add(upper);
      var knee = new T.Group();
      knee.position.y = -len / 2;
      var lower = new T.Mesh(new T.BoxGeometry(thick * 0.9, len / 2, thick * 0.9), mat);
      lower.position.y = -len / 4;
      lower.castShadow = true;
      knee.add(lower);
      pivot.add(knee);
      return { pivot: pivot, knee: knee };
    }

    parts.armL = limb(0.56, 0.105, mats.shirt, 0.54, -0.245);
    parts.armR = limb(0.56, 0.105, mats.shirt, 0.54, 0.245);
    parts.hips.add(parts.armL.pivot);
    parts.hips.add(parts.armR.pivot);
    parts.legL = limb(0.86, 0.135, mats.trousers, 0.02, -0.105);
    parts.legR = limb(0.86, 0.135, mats.trousers, 0.02, 0.105);
    parts.hips.add(parts.legL.pivot);
    parts.hips.add(parts.legR.pivot);

    var shoeL = new T.Mesh(new T.BoxGeometry(0.13, 0.08, 0.25), mats.shoe);
    shoeL.position.set(0, -0.47, 0.05);
    parts.legL.knee.add(shoeL);
    var shoeR = shoeL.clone();
    parts.legR.knee.add(shoeR);

    g.userData.parts = parts;
    return g;
  }

  function People3D(scene, town) {
    this.town = town;
    this.group = new T.Group();
    this.group.name = 'residents';
    scene.add(this.group);
    this.rigs = [];
    this.mats = {};
    for (var i = 0; i < POOL; i++) {
      var mats = {
        shirt: new T.MeshStandardMaterial({ color: 0x6d7a63, roughness: 0.86 }),
        trousers: new T.MeshStandardMaterial({ color: 0x3f4653, roughness: 0.88 }),
        skin: new T.MeshStandardMaterial({ color: 0xc49a76, roughness: 0.72 }),
        hair: new T.MeshStandardMaterial({ color: 0x3a2b1e, roughness: 0.9 }),
        shoe: new T.MeshStandardMaterial({ color: 0x2a2724, roughness: 0.85 })
      };
      var r = rig(mats);
      r.visible = false;
      this.group.add(r);
      this.rigs.push({ obj: r, mats: mats, res: null, phase: Math.random() * 6.28 });
    }
  }

  People3D.prototype.update = function (people, camPos, dt, t) {
    var town = this.town;
    /* rank by distance, skip anybody who has driven out of town */
    var near = [];
    for (var i = 0; i < people.length; i++) {
      var p = people[i];
      if (p.away) continue;
      var d = U.dist2(p.x, p.y, camPos.x, camPos.z);
      if (d > 150 * 150) continue;
      near.push({ d: d, p: p });
    }
    near.sort(function (a, b) { return a.d - b.d; });

    for (var k = 0; k < this.rigs.length; k++) {
      var slot = this.rigs[k];
      if (k >= near.length) { slot.obj.visible = false; slot.res = null; continue; }
      var res = near[k].p;
      if (slot.res !== res) {
        slot.res = res;
        slot.mats.shirt.color.set(res.colour);
        slot.mats.trousers.color.set(res.kind === 'kid' || res.kind === 'teen' ? 0x2f3f55 : 0x40454e);
        slot.mats.skin.color.set(SKIN[ER.hashStr(res.id) % SKIN.length]);
        slot.mats.hair.color.set(HAIR[ER.hashStr(res.name) % HAIR.length]);
        slot.obj.userData.parts.cap.visible = res.hat;
        slot.obj.userData.parts.brim.visible = res.hat;
        if (res.hat) {
          slot.obj.userData.parts.cap.material = slot.mats.shirt;
          slot.obj.userData.parts.brim.material = slot.mats.shirt;
        }
      }
      slot.obj.visible = true;
      var ground = town.heightAt(res.x, res.y);
      var scale = res.kind === 'kid' ? 0.72 : res.kind === 'teen' ? 0.92 : res.build;
      slot.obj.scale.setScalar(scale);
      slot.obj.position.set(res.x, ground, res.y);
      /* residents face where they are going; standing ones drift to face you */
      var wantYaw;
      if (res.moving) wantYaw = Math.atan2(res.facing ? Math.cos(res.facing) : 0, 0) * 0;
      wantYaw = res.moving ? (-res.facing + Math.PI / 2)
        : Math.atan2(camPos.x - res.x, camPos.z - res.y);
      var cur = slot.obj.rotation.y;
      var diff = ((wantYaw - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      slot.obj.rotation.y = cur + diff * Math.min(1, dt * 6);

      /* the walk */
      var parts = slot.obj.userData.parts;
      if (res.moving) {
        slot.phase += dt * (res.speed * 3.5);
        var sw = Math.sin(slot.phase);
        var sw2 = Math.sin(slot.phase + Math.PI);
        parts.legL.pivot.rotation.x = sw * 0.55;
        parts.legR.pivot.rotation.x = sw2 * 0.55;
        parts.legL.knee.rotation.x = Math.max(0, -sw * 0.7);
        parts.legR.knee.rotation.x = Math.max(0, -sw2 * 0.7);
        parts.armL.pivot.rotation.x = sw2 * 0.42;
        parts.armR.pivot.rotation.x = sw * 0.42;
        parts.armL.knee.rotation.x = 0.28;
        parts.armR.knee.rotation.x = 0.28;
        parts.hips.position.y = 0.92 + Math.abs(Math.sin(slot.phase)) * 0.035;
        parts.torso.rotation.y = sw * 0.06;
      } else {
        var idle = Math.sin(t * 1.4 + slot.phase) * 0.03;
        parts.legL.pivot.rotation.x = 0;
        parts.legR.pivot.rotation.x = 0;
        parts.legL.knee.rotation.x = 0;
        parts.legR.knee.rotation.x = 0;
        parts.armL.pivot.rotation.x = idle;
        parts.armR.pivot.rotation.x = -idle;
        parts.armL.knee.rotation.x = 0.2;
        parts.armR.knee.rotation.x = 0.2;
        parts.hips.position.y = 0.92 + idle * 0.3;
        parts.torso.rotation.y = 0;
      }
      parts.head.rotation.y = 0;
      /* when you are close, they look at you */
      if (near[k].d < 20 * 20 && !res.moving) {
        parts.head.rotation.x = U.clamp((camPos.y - ground - 1.6) * 0.3, -0.3, 0.3);
      } else parts.head.rotation.x = 0;
    }
  };

  /* who the crosshair is on, for the speech bubbles */
  People3D.prototype.screenPositions = function (people, camera, camPos, w, h) {
    var out = [];
    var v = new T.Vector3();
    for (var i = 0; i < this.rigs.length; i++) {
      var slot = this.rigs[i];
      if (!slot.res || !slot.obj.visible) continue;
      var res = slot.res;
      if (!res.say) continue;
      v.set(res.x, this.town.heightAt(res.x, res.y) + 1.86 * slot.obj.scale.x, res.y);
      var d = v.distanceTo(camPos);
      v.project(camera);
      if (v.z > 1 || v.z < -1) continue;
      out.push({ res: res, x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, dist: d,
        onScreen: v.x > -1.05 && v.x < 1.05 && v.y > -1.05 && v.y < 1.05 });
    }
    return out;
  };

  ER.People3D = People3D;
})(window.ER = window.ER || {});
