/* Errands — everything there is a lot of.
   Trees, grass that follows you around, fences, poles and their wires,
   streetlamps, gravestones, cars, mailboxes, and an invisible hit volume on
   every interactable so the crosshair knows what it is looking at. */
(function (ER) {
  'use strict';
  var U = ER.U;
  var T = window.THREE;
  var G = ER.Geom;
  var M = ER.Mats;
  var S = ER.Scene3D.prototype;
  var TILE = ER.TILE;

  /* ---------------- foliage textures ---------------- */

  S.leafTexture = function (kind) {
    var key = '_leaf_' + kind;
    if (this[key]) return this[key];
    var cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    var c = cv.getContext('2d');
    var rng = new ER.RNG('leaf' + kind);
    var cols = kind === 'conifer'
      ? ['#2f4433', '#3a5240', '#243528', '#415c45']
      : ['#4f6136', '#5d7040', '#3f4f2b', '#6b7d46', '#77803f'];
    /* opaque to start with: a canopy is a solid mass, and a transparent
       background on a material with no alpha test renders as black */
    c.fillStyle = cols[0];
    c.fillRect(0, 0, 128, 128);
    for (var i = 0; i < 260; i++) {
      var x = rng.float(8, 120), y = rng.float(8, 120);
      var r = rng.float(5, 15);
      c.fillStyle = rng.pick(cols);
      c.globalAlpha = rng.float(0.5, 1);
      c.beginPath();
      c.ellipse(x, y, r, r * rng.float(0.45, 0.9), rng.float(0, 3.14), 0, 6.2832);
      c.fill();
    }
    c.globalAlpha = 1;
    var t = new T.CanvasTexture(cv);
    t.colorSpace = T.SRGBColorSpace;
    this[key] = t;
    return t;
  };

  /* Colour and cutout as two separate textures.
     A single RGBA canvas cannot carry both: the browser stores canvas pixels
     premultiplied, so anything with alpha 0 comes back with its colour gone,
     and filtering then blends the visible blades toward black. An opaque
     colour map plus a greyscale alpha map has no such problem. */
  S.grassTexture = function (tall) {
    var key = tall ? '_grassTall' : '_grassTuft';
    if (this[key]) return this[key];
    var SZ = 128;
    var base = tall ? '#a3a566' : '#7d9450';
    var colour = document.createElement('canvas');
    colour.width = colour.height = SZ;
    var cc = colour.getContext('2d');
    var mask = document.createElement('canvas');
    mask.width = mask.height = SZ;
    var mc = mask.getContext('2d');

    cc.fillStyle = base;
    cc.fillRect(0, 0, SZ, SZ);
    mc.fillStyle = '#000';
    mc.fillRect(0, 0, SZ, SZ);

    var rng = new ER.RNG(key);
    var n = tall ? 34 : 46;
    for (var i = 0; i < n; i++) {
      var x = rng.float(6, SZ - 6);
      var w = rng.float(2.4, 5.4);
      var top = rng.float(tall ? 4 : 26, tall ? 32 : 76);
      var lean = rng.float(-20, 20);
      var hue = rng.pick(tall
        ? ['#b6b96e', '#c3c87c', '#a0a560', '#cdc684']
        : ['#8aa257', '#9ab066', '#7a9049', '#a6b46c']);
      var grad = cc.createLinearGradient(0, top, 0, SZ);
      grad.addColorStop(0, hue);
      grad.addColorStop(0.55, hue);
      /* only a little darker at the root: a blade of grass in sunlight is not
         a silhouette, and making it one is what reads as black */
      grad.addColorStop(1, tall ? '#7e8248' : '#5f7539');

      function blade(ctx, style) {
        ctx.fillStyle = style;
        ctx.beginPath();
        ctx.moveTo(x - w / 2, SZ);
        ctx.quadraticCurveTo(x - w / 4 + lean * 0.5, (top + SZ) / 2, x + lean, top);
        ctx.quadraticCurveTo(x + w / 4 + lean * 0.5, (top + SZ) / 2, x + w / 2, SZ);
        ctx.closePath();
        ctx.fill();
      }
      blade(cc, grad);
      blade(mc, '#fff');
    }

    var map = new T.CanvasTexture(colour);
    map.colorSpace = T.SRGBColorSpace;
    map.anisotropy = 8;
    var alpha = new T.CanvasTexture(mask);
    alpha.anisotropy = 8;
    this[key] = { map: map, alpha: alpha };
    return this[key];
  };

  /* ---------------- trees ---------------- */

  S.buildTrees = function () {
    var town = this.town, h = this.h;
    var decid = [], conif = [];
    var i;
    var all = town.trees.slice();
    for (i = 0; i < town.lots.length; i++) all = all.concat(town.lots[i].trees);
    all = all.concat(town.home.trees);
    for (i = 0; i < all.length; i++) {
      (all[i].kind === 'spruce' ? conif : decid).push(all[i]);
    }

    var trunkMat = this.material('bark', {});
    var trunkGeo = G.cyl(0.16, 0.34, 1, 7, TILE.bark);

    /* a canopy blob: an icosphere with its vertices kicked about */
    function blob(seed, detail) {
      var g = new T.IcosahedronGeometry(1, detail || 1);
      var rng = new ER.RNG(seed);
      var pos = g.attributes.position;
      for (var k = 0; k < pos.count; k++) {
        var x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k);
        var s = 1 + rng.float(-0.26, 0.26);
        pos.setXYZ(k, x * s, y * s * 0.86, z * s);
      }
      g.computeVertexNormals();
      /* project UVs so the leaf texture reads at any angle */
      var uv = new Float32Array(pos.count * 2);
      for (var u = 0; u < pos.count; u++) {
        uv[u * 2] = pos.getX(u) * 0.5 + 0.5;
        uv[u * 2 + 1] = pos.getY(u) * 0.5 + 0.5;
      }
      g.setAttribute('uv', new T.BufferAttribute(uv, 2));
      return g;
    }

    var self = this;
    function makeInstances(list, geo, mat, scaleFn, name) {
      if (!list.length) return null;
      var inst = new T.InstancedMesh(geo, mat, list.length);
      inst.castShadow = true;
      inst.receiveShadow = true;
      inst.name = name;
      var m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler();
      var rng = new ER.RNG(name);
      for (var k = 0; k < list.length; k++) {
        var tr = list[k];
        var sc = scaleFn(tr, rng);
        e.set(rng.float(-0.05, 0.05), rng.float(0, 6.2832), rng.float(-0.05, 0.05));
        q.setFromEuler(e);
        m.compose(new T.Vector3(tr.x, h(tr.x, tr.y) + sc.y0, tr.y), q,
          new T.Vector3(sc.x, sc.h, sc.z));
        inst.setMatrixAt(k, m);
        var tint = 0.78 + rng.float(0, 0.34);
        inst.setColorAt(k, new T.Color(tint, tint * rng.float(0.94, 1.06), tint * 0.92));
      }
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      self.root.add(inst);
      return inst;
    }

    var leafMat = new T.MeshStandardMaterial({
      map: this.leafTexture('broad'), roughness: 0.88, metalness: 0,
      side: T.FrontSide
    });
    var pineMat = new T.MeshStandardMaterial({
      map: this.leafTexture('conifer'), roughness: 0.9, metalness: 0,
      side: T.FrontSide
    });

    /* trunks for everything */
    makeInstances(all, trunkGeo, trunkMat, function (tr) {
      var th = tr.r * 1.35;
      return { x: tr.r * 0.10, z: tr.r * 0.10, h: th, y0: 0 };
    }, 'trunks');

    makeInstances(decid, blob('canopy', 2), leafMat, function (tr) {
      return { x: tr.r * 0.95, z: tr.r * 0.95, h: tr.r * 0.86, y0: tr.r * 1.25 };
    }, 'canopies');

    /* conifers: three stacked cones read better than a blob */
    var coneGeo = (function () {
      var geos = [];
      for (var c = 0; c < 3; c++) {
        /* capped, so the cone is closed and can render single-sided without
           showing its own inside */
        var cg = new T.ConeGeometry(1 - c * 0.26, 1.15, 9, 1, false);
        cg.translate(0, 0.35 + c * 0.62, 0);
        geos.push(cg);
      }
      return G.merge(geos);
    })();
    makeInstances(conif, coneGeo, pineMat, function (tr) {
      return { x: tr.r * 0.78, z: tr.r * 0.78, h: tr.r * 1.15, y0: tr.r * 0.5 };
    }, 'conifers');
  };

  /* ---------------- grass that keeps up with you ---------------- */

  /* Per-instance colour comes from instanceColor, and never from
     material.vertexColors -- setting that flag on geometry with no colour
     attribute is what turned every leaf, blade and lit window black. three
     defines USE_COLOR from the flag alone, without checking the attribute is
     there, so the vertex shader runs `vColor *= color` against the default
     generic attribute value, which is (0,0,0,1). Everything multiplied out to
     zero. USE_INSTANCING_COLOR is a separate define driven only by the buffer
     existing, and the fragment prefix declares vColor for it too, so dropping
     the flag keeps the tint and the emissive patches working.

     The buffer does have to exist before the program is built, though: three
     reads object.instanceColor when it picks the defines, so allocate it up
     front, all white, or the first compile misses it and every colour set
     later is silently ignored. */
  function whiteInstanceColours(inst) {
    var white = new T.Color(1, 1, 1);
    for (var i = 0; i < inst.count; i++) inst.setColorAt(i, white);
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    return inst;
  }

  S.buildGrass = function () {
    var town = this.town;
    /* Six cards at sixty-degree intervals rather than three double-sided ones.
       With DoubleSide, three flips the normal on every back face -- and since
       these normals are forced to point up, a flipped one points down and gets
       lit by the ground colour instead of the sky, which turns half of every
       tuft black. Giving each card its own outward-facing twin costs the same
       triangles and lights correctly from any angle. */
    var tuft = (function () {
      var geos = [];
      for (var q = 0; q < 6; q++) {
        var p = new T.PlaneGeometry(1, 1);
        p.translate(0, 0.5, 0);
        p.rotateY((q / 6) * Math.PI * 2);
        geos.push(p);
      }
      return G.upNormals(G.merge(geos));
    })();

    var gt = this.grassTexture(false);
    var mat = new T.MeshStandardMaterial({
      map: gt.map, alphaMap: gt.alpha, alphaTest: 0.42, side: T.FrontSide,
      roughness: 0.92, metalness: 0
    });
    var COUNT = 6000;
    var inst = new T.InstancedMesh(tuft, mat, COUNT);
    inst.castShadow = false;
    /* no shadow receive: a blade of grass is two centimetres wide and the
       lookup would run for every fragment of every card in the near field,
       which is the one thing here that can fill an entire frame */
    inst.receiveShadow = false;
    inst.name = 'grass';
    inst.frustumCulled = false;
    whiteInstanceColours(inst);
    this.root.add(inst);
    this.grass = { mesh: inst, count: COUNT, lastX: 1e9, lastZ: 1e9, radius: 18 };

    /* the taller stuff that grows where nobody mows */
    var wt = this.grassTexture(true);
    var weedMat = new T.MeshStandardMaterial({
      map: wt.map, alphaMap: wt.alpha, alphaTest: 0.42, side: T.FrontSide,
      roughness: 0.92, metalness: 0
    });
    var WCOUNT = 1800;
    var weeds = new T.InstancedMesh(tuft, weedMat, WCOUNT);
    weeds.castShadow = false;
    weeds.receiveShadow = false;
    weeds.name = 'weeds';
    weeds.frustumCulled = false;
    whiteInstanceColours(weeds);
    this.root.add(weeds);
    this.weeds = { mesh: weeds, count: WCOUNT, lastX: 1e9, lastZ: 1e9, radius: 26 };
  };

  /* Redistribute the tufts when you have walked far enough to notice, a slice
     at a time: placing nine thousand of them at once is a visible hitch. */
  var SLICE = 2200;

  S.updateGrass = function (camX, camZ) {
    var town = this.town, h = this.h;
    var sets = [this.grass, this.weeds];
    for (var s = 0; s < sets.length; s++) {
      var set = sets[s];
      if (!set) continue;
      if (set.cursor === undefined) set.cursor = set.count;   /* nothing pending */
      /* moving far enough restarts the sweep around the new position */
      if (U.dist(camX, camZ, set.lastX, set.lastZ) >= 9) {
        set.lastX = camX; set.lastZ = camZ;
        set.atX = camX; set.atZ = camZ;
        set.cursor = 0;
      }
      if (set.cursor >= set.count) continue;
      var from = set.cursor;
      var to = Math.min(set.count, from + SLICE);
      set.cursor = to;
      camX = set.atX; camZ = set.atZ;
      var rng = new ER.RNG(((camX / 9) | 0) * 7919 + ((camZ / 9) | 0) * 104729 + s * 31 + from);
      var m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler();
      var tall = s === 1;
      for (var i = from; i < to; i++) {
        var a = rng.float(0, 6.2832);
        var r = Math.sqrt(rng.next()) * set.radius;
        var x = camX + Math.cos(a) * r, z = camZ + Math.sin(a) * r;
        var terr = town.terrainAt(x, z);
        /* nobody mows the ditches, the verges or the grade; everybody mows
           their yard, so the tall stuff stays out of them */
        var ok = tall
          ? (terr === 'field' || terr === 'ballast')
          : (terr === 'grass' || terr === 'woods' || terr === 'field');
        if (!ok || town.isBlocked(x, z)) {
          m.makeScale(0, 0, 0);
          m.setPosition(0, -50, 0);
          set.mesh.setMatrixAt(i, m);
          continue;
        }
        var sc = tall ? rng.float(0.32, 0.66) : rng.float(0.11, 0.21);
        var wide = sc * rng.float(1.8, 3.0);
        e.set(0, rng.float(0, 6.2832), 0);
        q.setFromEuler(e);
        m.compose(new T.Vector3(x, h(x, z) - 0.03, z), q, new T.Vector3(wide, sc, wide));
        set.mesh.setMatrixAt(i, m);
        var v = rng.float(0.74, 1.22);
        set.mesh.setColorAt(i, new T.Color(v * (tall ? 1.05 : 1), v, v * 0.88));
      }
      set.mesh.instanceMatrix.needsUpdate = true;
      if (set.mesh.instanceColor) set.mesh.instanceColor.needsUpdate = true;
      set.mesh.count = set.count;
      break;                       /* one slice of one set per frame */
    }
  };

  /* ---------------- poles, wires, lamps ---------------- */

  S.buildPoles = function (batch) {
    var town = this.town, h = this.h;
    var poleMat = this.material('wood', { color: 0x8a7a62 });
    var wireMat = this.flat('wire', 0x2c2e2c, 0.85, 0.2);
    var i;
    for (i = 0; i < town.poles.length; i++) {
      var p = town.poles[i];
      var b = h(p.x, p.y);
      var pg = G.cyl(0.14, 0.19, 9.4, 8, TILE.wood);
      pg.translate(p.x, b, p.y);
      batch.add('poles', pg, poleMat);
      var arm = G.box(2.8, 0.13, 0.13, TILE.wood);
      arm.translate(p.x, b + 8.5, p.y);
      batch.add('poles', arm, poleMat);
      if (p.transformer) {
        var tf = G.cyl(0.35, 0.35, 0.85, 10);
        tf.translate(p.x + 0.42, b + 7.0, p.y);
        batch.add('transformer', tf, this.flat('transformer', 0x8a8d86, 0.6, 0.45));
      }
      if (p.prev) {
        var a = new T.Vector3(p.prev.x, h(p.prev.x, p.prev.y) + 8.5, p.prev.y);
        var c = new T.Vector3(p.x, b + 8.5, p.y);
        if (a.distanceTo(c) < 130) {
          for (var w = -1; w <= 1; w++) {
            var aa = a.clone(), cc = c.clone();
            aa.x += w * 0.9; cc.x += w * 0.9;
            batch.add('wires', G.wire(aa, cc, 1.5 + Math.abs(w) * 0.2, 0.028, 7), wireMat);
          }
          var la = a.clone(), lc = c.clone();
          la.y -= 1.9; lc.y -= 1.9;
          batch.add('wires', G.wire(la, lc, 2.1, 0.035, 7), wireMat);
        }
      }
    }

    /* streetlamps: cobra heads on the built-up blocks */
    var lampPole = this.flat('lampPole', 0x8e9390, 0.5, 0.6);
    var headGeos = [];
    for (i = 0; i < town.lamps.length; i++) {
      var lp = town.lamps[i];
      var lb = h(lp.x, lp.y);
      var mast = G.cyl(0.085, 0.13, 7.6, 8);
      mast.translate(lp.x, lb, lp.y);
      batch.add('lampPole', mast, lampPole);
      var armL = G.box(1.7, 0.1, 0.1);
      armL.translate(lp.x + 0.85, lb + 7.5, lp.y);
      batch.add('lampPole', armL, lampPole);
      var housing = G.box(0.62, 0.2, 0.34);
      housing.translate(lp.x + 1.7, lb + 7.32, lp.y);
      batch.add('lampPole', housing, lampPole);
      this.lamps.push({ def: lp, x: lp.x + 1.7, y: lb + 7.24, z: lp.y, dying: lp.dying, phase: lp.phase });
    }

    /* the glowing lenses, instanced so they can flicker independently */
    var lensGeo = new T.SphereGeometry(0.2, 8, 6, 0, 6.2832, 0, Math.PI * 0.5);
    lensGeo.rotateX(Math.PI);
    var lensMat = new T.MeshStandardMaterial({
      color: 0x2a2a26, roughness: 0.3, metalness: 0.1,
      emissive: new T.Color(0xffe6ac), emissiveIntensity: 1.0
    });
    lensMat.onBeforeCompile = function (shader) {
      shader.fragmentShader = shader.fragmentShader.replace(
        'vec3 totalEmissiveRadiance = emissive;',
        'vec3 totalEmissiveRadiance = emissive * vColor;'
      );
    };
    var lenses = new T.InstancedMesh(lensGeo, lensMat, this.lamps.length);
    var mm = new T.Matrix4();
    for (i = 0; i < this.lamps.length; i++) {
      mm.makeTranslation(this.lamps[i].x, this.lamps[i].y, this.lamps[i].z);
      mm.scale(new T.Vector3(1.6, 1.0, 1.6));
      lenses.setMatrixAt(i, mm);
      lenses.setColorAt(i, new T.Color(0, 0, 0));
    }
    lenses.instanceMatrix.needsUpdate = true;
    if (lenses.instanceColor) lenses.instanceColor.needsUpdate = true;
    this.lampLenses = lenses;
    this.root.add(lenses);

    /* a small pool of real lights, moved to whichever lamps are nearest */
    this.lampLights = [];
    for (i = 0; i < 5; i++) {
      var pl = new T.PointLight(0xffd79a, 0, 34, 2.0);
      pl.castShadow = false;
      this.root.add(pl);
      this.lampLights.push(pl);
    }
  };

  S.updateLamps = function (game, camPos) {
    if (!this.lampLenses) return;
    var dl = game.clock.daylight();
    var on = dl < 0.42;
    var i, changed = false;
    var lit = new T.Color(1, 0.92, 0.74);
    var off = new T.Color(0, 0, 0);
    for (i = 0; i < this.lamps.length; i++) {
      var L = this.lamps[i];
      var want = off;
      if (on) {
        if (L.dying) {
          var f = Math.sin(game.t * 11 + L.phase);
          want = f > -0.55 ? lit : off;
          if (f > -0.55 && f < -0.2) want = new T.Color(0.5, 0.42, 0.3);
        } else want = lit;
      }
      if (!L._last || !L._last.equals(want)) {
        this.lampLenses.setColorAt(i, want);
        L._last = want.clone();
        changed = true;
      }
      L.litNow = want !== off && want.r > 0.05;
    }
    if (changed && this.lampLenses.instanceColor) this.lampLenses.instanceColor.needsUpdate = true;

    /* hand the five point lights to the five nearest lit lamps */
    var near = [];
    for (i = 0; i < this.lamps.length; i++) {
      var L2 = this.lamps[i];
      if (!L2.litNow) continue;
      var d = U.dist2(camPos.x, camPos.z, L2.x, L2.z);
      if (d < 70 * 70) near.push({ d: d, L: L2 });
    }
    near.sort(function (a, b) { return a.d - b.d; });
    for (i = 0; i < this.lampLights.length; i++) {
      var light = this.lampLights[i];
      if (i < near.length) {
        light.position.set(near[i].L.x, near[i].L.y - 0.1, near[i].L.z);
        light.intensity = near[i].L.dying ? 14 : 22;
        light.distance = 30;
      } else light.intensity = 0;
    }
    if (this.beacon) {
      this.beacon.material.emissiveIntensity = on ? (0.6 + 1.8 * Math.max(0, Math.sin(game.t * 2.1))) : 0.2;
    }
  };

  /* ---------------- fences ---------------- */

  S.buildFences = function (batch) {
    var town = this.town, h = this.h;
    var postMat = this.material('wood', { color: 0x8c7d64 });
    var wireMat = this.flat('barbwire', 0x7e817c, 0.7, 0.5);
    var i;

    /* the pasture line west of Church Street, which the errands keep sending
       you along */
    var line = [[300, 668], [560, 674]];
    var n = 34;
    for (i = 0; i <= n; i++) {
      var t = i / n;
      var x = U.lerp(line[0][0], line[1][0], t), z = U.lerp(line[0][1], line[1][1], t);
      var pg = G.cyl(0.07, 0.09, 1.28, 6, TILE.wood);
      pg.translate(x, h(x, z), z);
      batch.add('fenceposts', pg, postMat);
      if (i > 0) {
        var px = U.lerp(line[0][0], line[1][0], (i - 1) / n), pz = U.lerp(line[0][1], line[1][1], (i - 1) / n);
        for (var w = 0; w < 3; w++) {
          var y = 0.42 + w * 0.34;
          batch.add('barbwire', G.wire(
            new T.Vector3(px, h(px, pz) + y, pz),
            new T.Vector3(x, h(x, z) + y, z), 0.06, 0.012, 3), wireMat);
        }
      }
    }
    /* the four posts the errands single out get a taller, squarer one */
    for (i = 0; i < 4; i++) {
      var fp = town.props['fencepost_' + i];
      if (!fp) continue;
      var sq = G.box(0.16, 1.5, 0.16, TILE.wood);
      sq.translate(fp.x, h(fp.x, fp.y), fp.y);
      batch.add('fenceposts', sq, postMat);
    }

    /* yard fences */
    for (i = 0; i < town.lots.length; i++) {
      var lot = town.lots[i];
      if (!lot.features.fence) continue;
      var f = lot.features.fence, y = lot.yard;
      var sides = { n: [[y.x, y.y], [y.x + y.w, y.y]], s: [[y.x, y.y + y.h], [y.x + y.w, y.y + y.h]],
        w: [[y.x, y.y], [y.x, y.y + y.h]], e: [[y.x + y.w, y.y], [y.x + y.w, y.y + y.h]] };
      for (var sIdx = 0; sIdx < f.sides.length; sIdx++) {
        var seg = sides[f.sides[sIdx]];
        if (!seg) continue;
        var len = U.dist(seg[0][0], seg[0][1], seg[1][0], seg[1][1]);
        var count = Math.max(2, Math.round(len / 2.4));
        for (var k = 0; k <= count; k++) {
          var tt = k / count;
          var fx = U.lerp(seg[0][0], seg[1][0], tt), fz = U.lerp(seg[0][1], seg[1][1], tt);
          var fh = f.kind === 'picket' ? 1.05 : 1.2;
          var post = f.kind === 'picket'
            ? G.box(0.07, fh, 0.07) : G.cyl(0.035, 0.04, fh, 5);
          post.translate(fx, h(fx, fz), fz);
          batch.add(f.kind === 'picket' ? 'picket' : 'fenceposts',
            post, f.kind === 'picket' ? this.flat('picket', 0xdcd8c9, 0.72, 0) : postMat);
        }
        if (f.kind === 'picket') {
          for (var pk = 0; pk < Math.round(len / 0.14); pk++) {
            var pt = pk * 0.14 / len;
            if (pt > 1) break;
            var kx = U.lerp(seg[0][0], seg[1][0], pt), kz = U.lerp(seg[0][1], seg[1][1], pt);
            var slat = G.box(0.08, 0.95, 0.02);
            slat.translate(kx, h(kx, kz), kz);
            batch.add('picket', slat, this.flat('picket', 0xdcd8c9, 0.72, 0));
          }
        } else {
          var panel = new T.Mesh(new T.PlaneGeometry(len, 1.2), this.chainlinkTexture());
          panel.position.set((seg[0][0] + seg[1][0]) / 2,
            h((seg[0][0] + seg[1][0]) / 2, (seg[0][1] + seg[1][1]) / 2) + 0.6,
            (seg[0][1] + seg[1][1]) / 2);
          panel.rotation.y = -Math.atan2(seg[1][1] - seg[0][1], seg[1][0] - seg[0][0]);
          this.root.add(panel);
        }
      }
    }
  };

  /* ---------------- cars, mailboxes, hydrants, gravestones ---------------- */

  S.buildYardStuff = function (batch) {
    var town = this.town, h = this.h;
    var i, j;

    /* cars */
    var glassMat = this.flat('carglass', 0x171c22, 0.08, 0.5, { transparent: true, opacity: 0.72 });
    var tyreMat = this.flat('tyre', 0x1e1f1e, 0.9, 0);
    for (i = 0; i < town.lots.length; i++) {
      var lot = town.lots[i];
      if (!lot.features.cars) continue;
      for (j = 0; j < lot.features.cars.length; j++) {
        var car = lot.features.cars[j];
        var cb = h(car.x, car.y);
        var yaw = car.ang + Math.PI / 2;
        var xf = G.mat4(car.x, cb, car.y, -yaw);
        var len = car.kind === 'pickup' ? 5.4 : car.kind === 'suv' ? 4.8 : car.kind === 'hatch' ? 4.05 : 4.62;
        var wid = (car.kind === 'pickup' || car.kind === 'suv') ? 1.98 : 1.82;
        var bodyH = car.kind === 'pickup' ? 0.82 : 0.72;
        var carKey = 'car_' + car.color;
        var carMat = this.flat('car' + car.color, car.color, 0.34, 0.55);

        var body = G.box(wid, bodyH, len);
        body.translate(0, 0.34, 0);
        batch.add(carKey, body, carMat, xf);
        if (car.kind === 'pickup') {
          var cab = G.box(wid - 0.1, 0.72, len * 0.40);
          cab.translate(0, 0.34 + bodyH, -len * 0.16);
          batch.add(carKey, cab, carMat, xf);
          var bedR = G.box(wid, 0.34, len * 0.44);
          bedR.translate(0, 0.34 + bodyH, len * 0.26);
          batch.add(carKey, bedR, carMat, xf);
          var wind = G.box(wid - 0.24, 0.5, 0.05);
          wind.translate(0, 0.34 + bodyH + 0.12, -len * 0.16 - len * 0.2);
          batch.add('carglass', wind, glassMat, xf);
        } else {
          var cabin = G.box(wid - 0.12, 0.66, len * 0.52);
          cabin.translate(0, 0.34 + bodyH, -len * 0.04);
          batch.add(carKey, cabin, carMat, xf);
          var ws = G.box(wid - 0.26, 0.52, 0.05);
          ws.rotateX(0.42);
          ws.translate(0, 0.34 + bodyH + 0.1, -len * 0.30);
          batch.add('carglass', ws, glassMat, xf);
          var rw = G.box(wid - 0.26, 0.46, 0.05);
          rw.rotateX(-0.4);
          rw.translate(0, 0.34 + bodyH + 0.12, len * 0.22);
          batch.add('carglass', rw, glassMat, xf);
          for (var sideG = -1; sideG <= 1; sideG += 2) {
            var sg = G.box(0.04, 0.44, len * 0.34);
            sg.translate(sideG * (wid / 2 - 0.05), 0.34 + bodyH + 0.12, -len * 0.04);
            batch.add('carglass', sg, glassMat, xf);
          }
        }
        /* wheels */
        var wheelZ = [len * 0.32, -len * 0.30];
        for (var wz = 0; wz < 2; wz++) {
          for (var wx2 = -1; wx2 <= 1; wx2 += 2) {
            var tyre = new T.TorusGeometry(0.33, 0.12, 6, 12);
            tyre.rotateY(Math.PI / 2);
            tyre.translate(wx2 * (wid / 2 - 0.08), 0.33, wheelZ[wz]);
            batch.add('tyre', tyre, tyreMat, xf);
          }
        }
        /* lights */
        var lensF = G.box(0.34, 0.16, 0.06);
        lensF.translate(-wid * 0.3, 0.7, -len / 2 - 0.02);
        batch.add('carlens', lensF, this.flat('carlensF', 0xe8e4d4, 0.2, 0.3), xf);
        var lensF2 = lensF.clone(); lensF2.translate(wid * 0.6, 0, 0);
        batch.add('carlens', lensF2, this.flat('carlensF', 0xe8e4d4, 0.2, 0.3), xf);
        var lensR = G.box(0.32, 0.15, 0.06);
        lensR.translate(-wid * 0.3, 0.7, len / 2 + 0.02);
        batch.add('carlensR', lensR, this.flat('carlensR', 0x7a1f18, 0.25, 0.3), xf);
        var lensR2 = lensR.clone(); lensR2.translate(wid * 0.6, 0, 0);
        batch.add('carlensR', lensR2, this.flat('carlensR', 0x7a1f18, 0.25, 0.3), xf);
      }
    }

    /* mailboxes */
    var mbPost = this.material('wood', { color: 0x7e7059 });
    var mbMat = this.flat('mailbox', 0x8e918c, 0.5, 0.5);
    var boxes = [];
    for (i = 0; i < town.lots.length; i++) boxes.push(town.lots[i].mailbox);
    boxes.push({ x: town.home.mailX, y: town.home.mailY, shown: String(town.home.number) });
    for (i = 0; i < boxes.length; i++) {
      var mb = boxes[i], mbB = h(mb.x, mb.y);
      var post = G.box(0.09, 1.18, 0.09, TILE.wood);
      post.translate(mb.x, mbB, mb.y);
      batch.add('mbpost', post, mbPost);
      var box = G.box(0.19, 0.19, 0.46);
      box.translate(mb.x, mbB + 1.18, mb.y);
      batch.add('mailbox', box, mbMat);
      var lid = new T.CylinderGeometry(0.095, 0.095, 0.46, 10, 1, false, 0, Math.PI);
      lid.rotateX(Math.PI / 2);
      lid.rotateY(Math.PI / 2);
      lid.translate(mb.x, mbB + 1.37, mb.y);
      batch.add('mailbox', lid, mbMat);
      var flag = G.box(0.02, 0.2, 0.06);
      flag.translate(mb.x + 0.1, mbB + 1.2, mb.y - 0.16);
      batch.add('mbflag', flag, this.flat('mbflag', 0xa03a2a, 0.6, 0.1));
      /* the number, which for one of these is wrong */
      var nTex = G.signTexture([mb.shown], { w: 128, h: 64, bg: '#8e918c', fg: '#1d1f1e', size: 44 });
      var plate = new T.Mesh(new T.PlaneGeometry(0.34, 0.17),
        new T.MeshStandardMaterial({ map: nTex, roughness: 0.6, metalness: 0.3 }));
      plate.position.set(mb.x + 0.1, mbB + 1.28, mb.y + 0.12);
      plate.rotation.y = Math.PI / 2;
      this.root.add(plate);
    }

    /* hydrants */
    for (i = 0; i < 5; i++) {
      var hy = town.props['hydrant_' + i];
      if (!hy) continue;
      var hb = h(hy.x, hy.y);
      var chip = hy.chipped || 0;
      var col = new T.Color(0xb0472f).lerp(new T.Color(0x8e8f88), chip * 0.5);
      var hMat = this.flat('hyd' + i, col.getHex(), 0.62 + chip * 0.25, 0.25);
      var barrel = G.cyl(0.14, 0.17, 0.62, 10);
      barrel.translate(hy.x, hb, hy.y);
      batch.add('hyd' + i, barrel, hMat);
      var dome = new T.SphereGeometry(0.165, 10, 6, 0, 6.2832, 0, Math.PI / 2);
      dome.translate(hy.x, hb + 0.62, hy.y);
      batch.add('hyd' + i, dome, hMat);
      var bonnet = G.cyl(0.08, 0.08, 0.1, 6);
      bonnet.translate(hy.x, hb + 0.74, hy.y);
      batch.add('hyd' + i, bonnet, hMat);
      for (var nz2 = -1; nz2 <= 1; nz2 += 2) {
        var nozzle = G.cyl(0.06, 0.06, 0.13, 8);
        nozzle.rotateZ(Math.PI / 2);
        nozzle.translate(hy.x + nz2 * 0.18, hb + 0.42, hy.y);
        batch.add('hyd' + i, nozzle, hMat);
      }
    }

    /* gravestones */
    var stoneMat = this.material('stone', { color: 0xcfcbc0 });
    for (i = 0; i < town.cemetery.graves.length; i++) {
      var g = town.cemetery.graves[i];
      var gb = h(g.x, g.y);
      var xf2 = G.mat4(g.x, gb, g.y, g.lean * 2);
      if (g.style === 'flat') {
        var slab = G.box(0.9, 0.12, 0.5, TILE.stone);
        batch.add('gravestone', slab, stoneMat, xf2);
      } else if (g.style === 'obelisk') {
        var plinth = G.box(0.62, 0.3, 0.62, TILE.stone);
        batch.add('gravestone', plinth, stoneMat, xf2);
        var shaft = G.box(0.34, 1.9, 0.34, TILE.stone);
        shaft.translate(0, 0.3, 0);
        batch.add('gravestone', shaft, stoneMat, xf2);
        var tip = new T.ConeGeometry(0.26, 0.4, 4);
        tip.rotateY(Math.PI / 4);
        tip.translate(0, 2.4, 0);
        batch.add('gravestone', tip, stoneMat, xf2);
      } else if (g.style === 'lamb') {
        var base2 = G.box(0.6, 0.34, 0.42, TILE.stone);
        batch.add('gravestone', base2, stoneMat, xf2);
        var bodyL = new T.SphereGeometry(0.2, 10, 8);
        bodyL.scale(1.4, 0.9, 0.9);
        bodyL.translate(0, 0.5, 0);
        batch.add('gravestone', bodyL, stoneMat, xf2);
        var headL = new T.SphereGeometry(0.11, 8, 6);
        headL.translate(-0.24, 0.62, 0);
        batch.add('gravestone', headL, stoneMat, xf2);
      } else {
        var bs2 = G.box(0.78, 0.18, 0.34, TILE.stone);
        batch.add('gravestone', bs2, stoneMat, xf2);
        var tab = G.box(0.6, 0.92, 0.14, TILE.stone);
        tab.translate(0, 0.18, 0);
        batch.add('gravestone', tab, stoneMat, xf2);
        if (g.style === 'tablet') {
          var arch = new T.CylinderGeometry(0.3, 0.3, 0.14, 12, 1, false, 0, Math.PI);
          arch.rotateX(Math.PI / 2);
          arch.rotateY(Math.PI / 2);
          arch.translate(0, 1.10, 0);
          batch.add('gravestone', arch, stoneMat, xf2);
        }
        /* the engraving, which is what you are here to trace */
        var eTex = G.signTexture([g.last.toUpperCase(), g.first, g.born + '–' + g.died],
          { w: 256, h: 384, bg: '#00000000', fg: 'rgba(52,54,50,0.72)', size: 44 });
        var face = new T.Mesh(new T.PlaneGeometry(0.5, 0.74),
          new T.MeshStandardMaterial({ map: eTex, transparent: true, roughness: 0.85 }));
        face.position.set(g.x, gb + 0.62, g.y + 0.08);
        face.rotation.y = g.lean * 2;
        this.root.add(face);
      }
    }
  };

  /* ---------------- road signs ---------------- */

  S.buildSigns = function (batch) {
    var town = this.town, h = this.h;
    var postMat = this.flat('signpost', 0x9ba09c, 0.5, 0.65);
    for (var i = 0; i < town.signs.length; i++) {
      var sg = town.signs[i];
      var b = h(sg.x, sg.y);
      var lines = sg.text.split('\n');
      var isStop = sg.kind === 'stop';
      var w = isStop ? 0.76 : 0.62, hh = isStop ? 0.76 : 0.24 * lines.length + 0.22;
      var postH = isStop ? 2.1 : 1.9;
      var post = G.cyl(0.032, 0.038, postH + hh, 6);
      post.translate(sg.x, b, sg.y);
      batch.add('signpost', post, postMat);

      var tex = isStop
        ? G.signTexture(['STOP'], { w: 256, h: 256, bg: '#9c2f24', fg: '#f2ece2', size: 78, border: '#f2ece2', borderW: 12, grunge: true })
        : G.signTexture(lines, {
          w: 256, h: 256, bg: sg.kind === 'warn' ? '#c8a63a' : '#3f5f42',
          fg: sg.kind === 'warn' ? '#1c1a10' : '#f0efe6',
          size: Math.floor(190 / lines.length), border: sg.kind === 'warn' ? '#1c1a10' : '#f0efe6',
          borderW: 8, grunge: true
        });
      var mesh = new T.Mesh(new T.PlaneGeometry(w * (isStop ? 1 : 1.6), hh * (isStop ? 1 : 1.6)),
        new T.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.2, side: T.DoubleSide }));
      mesh.position.set(sg.x, b + postH, sg.y);
      mesh.rotation.y = sg.ang || 0;
      mesh.castShadow = false;
      this.root.add(mesh);
    }
  };

  /* ---------------- the small props the errands care about ---------------- */

  S.buildProps = function (batch) {
    var town = this.town, h = this.h;
    var P = town.props;
    var wood = this.material('wood', {});
    var metal = this.flat('propMetal', 0x9a9e98, 0.55, 0.6);
    var plastic = this.flat('propPlastic', 0x53585a, 0.68, 0.05);
    var self = this;

    function at(id) { var p = P[id]; return p ? { x: p.x, z: p.y, y: h(p.x, p.y) } : null; }
    function put(key, geo, mat, id, dy, yaw) {
      var a = at(id); if (!a) return;
      batch.add(key, geo, mat, G.mat4(a.x, a.y + (dy || 0), a.z, yaw || 0));
    }

    /* Bend Mart fittings */
    put('propMetal', G.box(1.0, 1.9, 0.9), this.flat('iceBox', 0xd4d6d2, 0.5, 0.2), 'bendmart_ice');
    put('propMetal', G.box(0.4, 1.3, 0.3), metal, 'bendmart_air');
    put('propMetal', G.box(1.3, 1.6, 0.8), this.flat('cage', 0x8a8d86, 0.6, 0.55), 'bendmart_propane');
    /* the grease drum behind the diner */
    put('propMetal', G.cyl(0.32, 0.32, 0.88, 12, TILE.rust),
      this.material('rust', { metalness: 0.4 }), 'diner_drum');
    /* the bulletin board */
    (function () {
      var a = at('postoffice_board'); if (!a) return;
      var frame = G.box(1.5, 1.1, 0.09, TILE.wood);
      frame.translate(0, 1.0, 0);
      batch.add('boardFrame', frame, self.material('wood', { color: 0x6f5c44 }),
        G.mat4(a.x, a.y, a.z, 0));
      for (var lg = -1; lg <= 1; lg += 2) {
        var leg = G.box(0.08, 1.0, 0.08, TILE.wood);
        leg.translate(lg * 0.6, 0, 0);
        batch.add('boardFrame', leg, self.material('wood', { color: 0x6f5c44 }),
          G.mat4(a.x, a.y, a.z, 0));
      }
      var tex = G.signTexture(['NOTICES', 'Lost dog — answers to Biscuit',
        'Hay for sale — Roush', 'Fire dept. pancake breakfast',
        'Piano lessons, Tuesdays'], { w: 512, h: 384, bg: '#ded9c8', fg: '#3c3a32', size: 46, grunge: true });
      var face = new T.Mesh(new T.PlaneGeometry(1.36, 0.96),
        new T.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
      face.position.set(a.x, a.y + 1.5, a.z + 0.05);
      self.root.add(face);
    })();

    /* the recycling bins, the scrap pile, the grain spill */
    (function () {
      var p = P.recycling_bins; if (!p) return;
      for (var b = 0; b < 3; b++) {
        var bx = p.rect.x + 4 + b * 7, bz = p.rect.y + p.rect.h / 2;
        var bin = G.box(2.4, 1.3, 1.6);
        batch.add('bins', bin, self.flat('bin' + b, [0x2f5e46, 0x2c4a6a, 0x6a5a2c][b], 0.7, 0.05),
          G.mat4(bx, h(bx, bz), bz, 0));
      }
    })();
    (function () {
      var p = P.construction_scrap; if (!p) return;
      var rng = new ER.RNG('scrap');
      for (var s = 0; s < 26; s++) {
        var sx = p.rect.x + rng.float(0, p.rect.w), sz = p.rect.y + rng.float(0, p.rect.h);
        var pc = G.box(rng.float(0.1, 0.16), rng.float(0.05, 0.1), rng.float(0.5, 2.4), TILE.wood);
        pc.rotateY(rng.float(0, 3.14));
        pc.rotateX(rng.float(-0.2, 0.2));
        batch.add('lumber', pc, self.material('wood', { color: 0xd8bd8a }),
          G.mat4(sx, h(sx, sz) + rng.float(0, 0.3), sz, rng.float(0, 3.14)));
      }
    })();
    (function () {
      var a = at('silo_spill'); if (!a) return;
      var pile = new T.ConeGeometry(1.6, 0.5, 14);
      pile.translate(0, 0.25, 0);
      batch.add('grain', pile, self.flat('grain', 0xc9a961, 0.9, 0), G.mat4(a.x, a.y, a.z, 0));
    })();

    /* the clay bank: a cut face of raw clay */
    (function () {
      var a = at('clay_bank'); if (!a) return;
      var face = G.box(6, 2.2, 1.2, TILE.dirt);
      batch.add('clay', face, self.material('dirt', { color: 0xa87a58 }),
        G.mat4(a.x, a.y - 0.6, a.z, 0.3));
    })();

    /* drains, in the gutter where they belong */
    ['storm_drain_echo', 'storm_drain_other'].forEach(function (id) {
      var a = at(id); if (!a) return;
      var grate = G.box(0.74, 0.08, 0.44);
      batch.add('grate', grate, self.flat('grate', 0x4a4d48, 0.6, 0.5),
        G.mat4(a.x, a.y - 0.02, a.z, 0));
    });

    /* the swing set and the park hoop */
    (function () {
      var a = at('park_swing'); if (!a) return;
      var galv = self.flat('galv', 0x9ea3a0, 0.5, 0.7);
      for (var lg2 = -1; lg2 <= 1; lg2 += 2) {
        for (var sp = -1; sp <= 1; sp += 2) {
          var leg = G.cyl(0.05, 0.05, 2.5, 6);
          leg.rotateZ(sp * 0.2);
          leg.translate(lg2 * 1.7, 0, sp * 0.5);
          batch.add('galv', leg, galv, G.mat4(a.x, a.y, a.z, 0));
        }
      }
      var beam = G.cyl(0.055, 0.055, 3.6, 6);
      beam.rotateZ(Math.PI / 2);
      beam.translate(0, 2.42, 0);
      batch.add('galv', beam, galv, G.mat4(a.x, a.y, a.z, 0));
      for (var sw = -1; sw <= 1; sw += 2) {
        for (var ch = -1; ch <= 1; ch += 2) {
          var chain = G.cyl(0.008, 0.008, 1.9, 4);
          chain.translate(sw * 0.8 + ch * 0.22, 0.5, 0);
          batch.add('galv', chain, galv, G.mat4(a.x, a.y, a.z, 0));
        }
        var seat = G.box(0.46, 0.04, 0.16);
        seat.translate(sw * 0.8, 0.46, 0);
        batch.add('seat', seat, self.flat('seat', 0x2c3138, 0.8, 0), G.mat4(a.x, a.y, a.z, 0));
      }
    })();
    ['park_hoop', 'school_hoop'].forEach(function (id) {
      var a = at(id); if (!a) return;
      var galv = self.flat('galv', 0x9ea3a0, 0.5, 0.7);
      var pole = G.cyl(0.06, 0.08, 3.4, 8);
      batch.add('galv', pole, galv, G.mat4(a.x, a.y, a.z, 0));
      var board = G.box(1.8, 1.05, 0.05);
      board.translate(0, 3.0, 0.4);
      batch.add('board', board, self.flat('bboard', 0xd9d5c8, 0.6, 0), G.mat4(a.x, a.y, a.z, 0));
      var rim = new T.TorusGeometry(0.23, 0.02, 5, 12);
      rim.rotateX(Math.PI / 2);
      rim.translate(0, 3.05, 0.65);
      batch.add('rim', rim, self.flat('rim', 0xb8552f, 0.5, 0.5), G.mat4(a.x, a.y, a.z, 0));
    });

    /* the cattails and the plant patches, as instanced tufts */
    this.buildPatches();

    /* the well cap */
    put('stone', G.cyl(0.52, 0.56, 0.7, 12, TILE.stone), this.material('stone', {}), 'farmhouse_well');
    /* the cemetery spigot */
    (function () {
      var a = at('cemetery_spigot'); if (!a) return;
      var pipe = G.cyl(0.03, 0.03, 0.6, 6);
      batch.add('galv', pipe, self.flat('galv', 0x9ea3a0, 0.5, 0.7), G.mat4(a.x, a.y, a.z, 0));
      var tap = G.box(0.1, 0.1, 0.18);
      tap.translate(0, 0.55, 0.06);
      batch.add('brass', tap, self.flat('brass', 0xb08d4a, 0.35, 0.8), G.mat4(a.x, a.y, a.z, 0));
    })();

    /* the storage-door tops the dust lives on, and the tar bubble */
    (function () {
      var a = at('tar_bubble'); if (!a) return;
      var blob2 = new T.SphereGeometry(0.4, 10, 5, 0, 6.2832, 0, Math.PI / 2);
      blob2.scale(1, 0.18, 1);
      batch.add('tar', blob2, self.flat('tar', 0x1d1b19, 0.35, 0), G.mat4(a.x, a.y + 0.04, a.z, 0));
    })();
  };

  /* plant patches: dandelions, mint, milkweed, cattails, acorns */
  S.buildPatches = function () {
    var town = this.town, h = this.h;
    var specs = [
      { ids: ['dandelion_park', 'dandelion_ballfield', 'dandelion_cr9'], n: 220, col: 0xd9d66a, tall: 0.24, head: true },
      { ids: ['church_mint', 'diner_mint'], n: 130, col: 0x4f7a3e, tall: 0.34, head: false },
      { ids: ['milkweed_grade', 'milkweed_pasture'], n: 90, col: 0x7d8a58, tall: 0.85, head: false, pod: true },
      { ids: ['pond_cattails'], n: 190, col: 0x6e7a48, tall: 1.85, head: false, cattail: true },
      { ids: ['acorn_ground'], n: 0, col: 0, tall: 0 }
    ];
    var tuftGeo = (function () {
      var geos = [];
      for (var q = 0; q < 4; q++) {
        var p = new T.PlaneGeometry(1, 1);
        p.translate(0, 0.5, 0);
        p.rotateY((q / 4) * Math.PI * 2);
        geos.push(p);
      }
      return G.upNormals(G.merge(geos));
    })();
    for (var s = 0; s < specs.length; s++) {
      var sp = specs[s];
      if (!sp.n) continue;
      var items = [];
      for (var i = 0; i < sp.ids.length; i++) {
        var pr = town.props[sp.ids[i]];
        if (!pr) continue;
        var rng = new ER.RNG('patch' + sp.ids[i]);
        for (var k = 0; k < sp.n; k++) {
          var x, z;
          if (pr.rect) { x = pr.rect.x + rng.float(0, pr.rect.w); z = pr.rect.y + rng.float(0, pr.rect.h); }
          else { var a = rng.float(0, 6.2832), r = Math.sqrt(rng.next()) * pr.r; x = pr.x + Math.cos(a) * r; z = pr.y + Math.sin(a) * r; }
          items.push({ x: x, z: z, s: rng.float(0.7, 1.3) });
        }
      }
      if (!items.length) continue;
      var pt = this.grassTexture(true);
      var mat = new T.MeshStandardMaterial({
        map: pt.map, alphaMap: pt.alpha, alphaTest: 0.42, side: T.FrontSide,
        color: new T.Color(sp.col), roughness: 0.9
      });
      var inst = new T.InstancedMesh(tuftGeo, mat, items.length);
      inst.castShadow = false; inst.receiveShadow = false;
      var m = new T.Matrix4(), q2 = new T.Quaternion(), e = new T.Euler();
      var rng2 = new ER.RNG('patchrot' + s);
      for (var j = 0; j < items.length; j++) {
        e.set(0, rng2.float(0, 6.2832), 0);
        q2.setFromEuler(e);
        m.compose(new T.Vector3(items[j].x, h(items[j].x, items[j].z) - 0.02, items[j].z), q2,
          new T.Vector3(sp.tall * 0.5 * items[j].s, sp.tall * items[j].s, sp.tall * 0.5 * items[j].s));
        inst.setMatrixAt(j, m);
      }
      inst.instanceMatrix.needsUpdate = true;
      this.root.add(inst);
    }
  };

  /* ---------------- what the crosshair can hit ---------------- */

  S.buildHitVolumes = function () {
    var town = this.town, h = this.h;
    /* double-sided so standing inside a search zone still registers a hit */
    var mat = new T.MeshBasicMaterial({ visible: false, side: T.DoubleSide });
    var group = new T.Group();
    group.name = 'hitvolumes';
    for (var i = 0; i < town.propList.length; i++) {
      var p = town.propList[i];
      if (p.hidden) continue;
      var mesh;
      if (p.rect) {
        mesh = new T.Mesh(new T.BoxGeometry(p.rect.w, 2.6, p.rect.h), mat);
        var cx = p.rect.x + p.rect.w / 2, cz = p.rect.y + p.rect.h / 2;
        mesh.position.set(cx, h(cx, cz) + 1.0, cz);
      } else {
        var r = Math.max(0.6, Math.min(p.r, 3.2));
        mesh = new T.Mesh(new T.SphereGeometry(r, 8, 6), mat);
        mesh.position.set(p.x, h(p.x, p.y) + (p.tags.indexOf('grave') >= 0 ? 0.6 : 1.1), p.y);
      }
      mesh.userData.propId = p.id;
      mesh.name = 'hit_' + p.id;
      group.add(mesh);
      this.raycastTargets.push(mesh);
    }
    this.root.add(group);
    this.hitGroup = group;
  };

  S.buildScatter = function () {
    var batch = new G.Batch();
    this.buildPoles(batch);
    this.buildFences(batch);
    this.buildYardStuff(batch);
    this.buildSigns(batch);
    this.buildProps(batch);
    batch.build(this.root, {});
    this.buildTrees();
    this.buildGrass();
    this.buildHitVolumes();
  };
})(window.ER = window.ER || {});
