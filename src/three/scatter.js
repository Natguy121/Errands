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
    /* Near enough to the ground they grow out of. A tuft card seen almost
       edge-on is a one-pixel sliver, and if the card is much brighter than
       the terrain every one of those slivers reads as a bright scratch --
       six thousand of them and the lawn looks combed. Measured: the terrain
       grass albedo sits around rgb(101,117,55), so the blades want to be a
       little above that and no more. They were forty per cent over, from
       when they were being brightened to chase what turned out to be the
       vertexColors bug instead. */
    var base = tall ? '#8d9058' : '#6b7f46';
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
        ? ['#9ba05e', '#a6ab68', '#8a8f52', '#b0ae70']
        : ['#6d8146', '#788b50', '#64783e', '#82925a']);
      var grad = cc.createLinearGradient(0, top, 0, SZ);
      grad.addColorStop(0, hue);
      grad.addColorStop(0.55, hue);
      /* only a little darker at the root: a blade of grass in sunlight is not
         a silhouette, and making it one is what reads as black */
      grad.addColorStop(1, tall ? '#6b6e3c' : '#4d5f30');

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

    /* A canopy blob: an icosphere pushed about by a smooth field.

       The displacement has to be a function of where a vertex *is*, never of
       its index. IcosahedronGeometry is non-indexed -- every face carries its
       own copy of each corner -- so displacing by index moves the same corner
       a different way for each face that shares it, and the canopy comes apart
       into a cloud of loose triangles. Lit from the front that passes for
       foliage. In silhouette against a dusk sky it is unmistakable: black
       shards with gaps between them. Sampling one noise field along the three
       axis pairs gives every copy of a corner the same answer, so the mass
       stays closed and lumpy instead. */
    function blob(seed, detail) {
      var g = new T.IcosahedronGeometry(1, detail || 1);
      var nz = new ER.Noise(seed);
      var pos = g.attributes.position;
      var F = 1.05;
      for (var k = 0; k < pos.count; k++) {
        var x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k);
        var n = (nz.fbm(x * F + 11.3, y * F + 3.1, 2) +
                 nz.fbm(y * F + 5.7, z * F + 17.2, 2) +
                 nz.fbm(z * F + 23.4, x * F + 7.9, 2)) / 3;
        var s = 1 + (n - 0.5) * 0.58;
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
    /* Almost nothing here is lawn. The quarter is stone, and what grows in
       it grows out of the gaps between the stones, so the tuft count is a
       tenth of what a township of mown yards needed. */
    var COUNT = 900;
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
    this.grass = { mesh: inst, count: COUNT, lastX: 1e9, lastZ: 1e9, radius: 11 };

    /* the taller stuff that grows where nobody mows */
    var wt = this.grassTexture(true);
    var weedMat = new T.MeshStandardMaterial({
      map: wt.map, alphaMap: wt.alpha, alphaTest: 0.42, side: T.FrontSide,
      roughness: 0.92, metalness: 0
    });
    var WCOUNT = 500;
    var weeds = new T.InstancedMesh(tuft, weedMat, WCOUNT);
    weeds.castShadow = false;
    weeds.receiveShadow = false;
    weeds.name = 'weeds';
    weeds.frustumCulled = false;
    whiteInstanceColours(weeds);
    this.root.add(weeds);
    this.weeds = { mesh: weeds, count: WCOUNT, lastX: 1e9, lastZ: 1e9, radius: 14 };
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
        /* Area-uniform placement is right for grass -- constant density per
           square metre -- but it puts most of the tufts in the outer ring,
           which is exactly the distance at which a card is a one-pixel sliver
           rather than a clump. Thousands of slivers is the streaking. Shrink
           them away over the last half of the radius instead of stopping at a
           hard edge: the near field keeps its clumps, the far ring stops
           drawing, and there is no line where the grass ends. The terrain is
           grass-coloured underneath, so nothing looks bald. */
        var fade = 1 - U.smooth(U.clamp((r / set.radius - 0.5) / 0.5, 0, 1));
        var terr = town.terrainAt(x, z);
        /* nobody mows the ditches, the verges or the grade; everybody mows
           their yard, so the tall stuff stays out of them */
        /* weeds out of the bare shelf and the unswept edges; nothing at all
           on the swept stone of an alley or the flags of the square */
        var ok = tall ? (terr === 'rock')
          : (terr === 'rock' || terr === 'wall');
        if (!ok || town.isBlocked(x, z)) {
          m.makeScale(0, 0, 0);
          m.setPosition(0, -50, 0);
          set.mesh.setMatrixAt(i, m);
          continue;
        }
        /* A tuft card is square in texture space, with the blades running up
           it, so it has to stay roughly square in world space too. Scaling it
           two or three times wider than tall -- which is what it was doing --
           squashes every blade into a fat diagonal smear, and a lawn made of
           those reads as brushed fabric rather than grass. Weeds are the other
           way about: taller than they are wide. */
        var sc = (tall ? rng.float(0.42, 0.80) : rng.float(0.16, 0.27)) * fade;
        var wide = sc * (tall ? rng.float(0.45, 0.70) : rng.float(0.85, 1.20));
        if (sc < 0.02) {
          m.makeScale(0, 0, 0);
          m.setPosition(0, -50, 0);
          set.mesh.setMatrixAt(i, m);
          continue;
        }
        e.set(0, rng.float(0, 6.2832), 0);
        q.setFromEuler(e);
        m.compose(new T.Vector3(x, h(x, z) - 0.03, z), q, new T.Vector3(wide, sc, wide));
        set.mesh.setMatrixAt(i, m);
        var v = rng.float(0.76, 1.08);
        set.mesh.setColorAt(i, new T.Color(v * (tall ? 1.05 : 1), v, v * 0.88));
      }
      set.mesh.instanceMatrix.needsUpdate = true;
      if (set.mesh.instanceColor) set.mesh.instanceColor.needsUpdate = true;
      set.mesh.count = set.count;
      break;                       /* one slice of one set per frame */
    }
  };

  /* ---------------- wires, lamps ---------------- */

  /* No poles. In a quarter this old the supply is bolted to the walls and
     thrown across the alleys, which is both how it looks and why the errand
     about counting the wires exists. */
  S.buildPoles = function (batch) {
    var town = this.town, h = this.h;
    var wireMat = this.flat('wire', 0x2c2e2c, 0.85, 0.2);
    var boxMat = this.flat('meterbox', 0x8e8a7e, 0.7, 0.25);
    var braMat = this.flat('bracket', 0x4a453e, 0.6, 0.5);
    var rng = new ER.RNG('wires');
    var i, j;

    /* a run of wire across each alley, wall to wall, sagging */
    for (i = 0; i < town.roads.length; i++) {
      var rd = town.roads[i];
      var pts = rd.pts.map(function (q) { return [q[0], q[1]]; });
      var len = ER.poly.length(pts);
      for (var s = 3.0; s < len - 2.0; s += rng.float(5.5, 9.0)) {
        var at = ER.poly.pointAt(pts, s);
        var nrm = ER.poly.normal(pts, at.seg);
        var reach = rd.width / 2 + 0.55;
        var a = new T.Vector3(at.x + nrm.x * reach, h(at.x, at.y) + rng.float(3.6, 5.2), at.y + nrm.y * reach);
        var b = new T.Vector3(at.x - nrm.x * reach, a.y + rng.float(-0.3, 0.3), at.y - nrm.y * reach);
        var n = rng.int(2, 5);
        for (j = 0; j < n; j++) {
          var aa = a.clone(), bb = b.clone();
          aa.y -= j * 0.13; bb.y -= j * 0.13;
          batch.add('wires', G.wire(aa, bb, 0.22 + j * 0.04, 0.022, 6), wireMat);
        }
      }
    }

    /* and the meter boxes that feed them, on the wall by each door */
    for (i = 0; i < town.lots.length; i++) {
      var l = town.lots[i];
      var mp = town.props['meter_' + l.id];
      if (!mp) continue;
      var bx = G.box(0.3, 0.42, 0.16);
      bx.translate(mp.x, h(mp.x, mp.y) + 1.55, mp.y);
      batch.add('meterbox', bx, boxMat);
    }

    /* the brackets the alley lamps hang off */
    for (i = 0; i < town.lamps.length; i++) {
      var lp = town.lamps[i];
      var arm = G.box(0.5, 0.05, 0.05);
      arm.translate(lp.x, h(lp.x, lp.y) + 3.15, lp.y);
      batch.add('bracket', arm, braMat);
    }
  };

  /* Alley lanterns on wall brackets, about three metres up. A cobra head on
     a seven-metre mast would be absurd in an alley two metres wide. */
  S.buildLamps = function (batch) {
    var town = this.town, h = this.h;
    var lampMat = this.flat('lampIron', 0x3e3a34, 0.55, 0.5);
    var i;
    for (i = 0; i < town.lamps.length; i++) {
      var lp = town.lamps[i];
      var lb = h(lp.x, lp.y);
      /* a little four-sided lantern, hung under the bracket */
      var hood = G.cyl(0.13, 0.20, 0.10, 4);
      hood.translate(lp.x, lb + 3.12, lp.y);
      batch.add('lampIron', hood, lampMat);
      var cage = G.cyl(0.17, 0.13, 0.26, 4);
      cage.translate(lp.x, lb + 2.86, lp.y);
      batch.add('lampIron', cage, lampMat);
      this.lamps.push({ def: lp, x: lp.x, y: lb + 2.92, z: lp.y, dying: lp.dying, phase: lp.phase });
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

    /* No gravestones. The quarter buries its dead up the hill and out of
       the world; what it has instead is a niche with a Virgin in it, which
       buildProps puts in the square. */
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

    /* the tar on the slipway */
    (function () {
      var a = at('quay_tar'); if (!a) return;
      var blob2 = new T.SphereGeometry(0.4, 10, 5, 0, 6.2832, 0, Math.PI / 2);
      blob2.scale(1, 0.18, 1);
      batch.add('tar', blob2, self.flat('tar', 0x1d1b19, 0.35, 0), G.mat4(a.x, a.y + 0.04, a.z, 0));
    })();

    /* ================================================================== *
     *  the quarter's own furniture. Everything below hangs off a prop id,
     *  so if a prop moves its geometry moves with it, and if a prop is
     *  removed its geometry quietly stops existing.
     * ================================================================== */

    var terra = this.flat('terracotta', 0xa8603f, 0.72, 0.05);
    var tankMat = this.flat('tankblack', 0x2a2b2c, 0.78, 0.05);
    var dishMat = this.flat('dishwhite', 0xd9d6cc, 0.6, 0.12);
    var brass2 = this.flat('brass2', 0x9a7c42, 0.42, 0.72);
    var iron2 = this.flat('iron2', 0x42403a, 0.6, 0.5);
    var blue = this.flat('boatblue', 0x2f6f8f, 0.52, 0.1);
    var netMat = this.flat('net', 0x6d7a5e, 0.8, 0.05);

    /* --- pots of geraniums by every door --- */
    town.lots.forEach(function (l) {
      var a = at('pots_' + l.id); if (!a) return;
      var n = Math.min(6, l.features.pots || 3);
      var rp = new ER.RNG('pots' + l.id);
      for (var i = 0; i < n; i++) {
        var ox = (i - (n - 1) / 2) * 0.3, oz = rp.float(-0.12, 0.12);
        var pot = G.cyl(0.11, 0.085, 0.2, 8);
        pot.translate(ox, 0.1, oz);
        batch.add('terracotta', pot, terra, G.mat4(a.x, a.y, a.z, 0));
        var bush = new T.SphereGeometry(0.13, 6, 4);
        bush.scale(1, rp.float(0.7, 1.3), 1);
        bush.translate(ox, 0.26, oz);
        batch.add('geranium', bush, self.flat('geranium', 0x4f6f3a, 0.9, 0), G.mat4(a.x, a.y, a.z, 0));
      }
    });

    /* --- the black water tanks, which is what the skyline actually is --- */
    town.lots.forEach(function (l) {
      if (!P['tank_' + l.id]) return;
      var cx = l.rect[0] + l.rect[2] * 0.5, cz = l.rect[1] + l.rect[3] * 0.65;
      var base = h(cx, cz) + 0.34 + 3.1 * (l.storeys || 1) + 0.1;
      var t2 = G.cyl(0.45, 0.45, 0.8, 10);
      t2.translate(cx, base, cz);
      batch.add('tankblack', t2, tankMat);
      var cap = G.cyl(0.16, 0.16, 0.08, 8);
      cap.translate(cx, base + 0.82, cz);
      batch.add('tankblack', cap, tankMat);
    });

    /* --- satellite dishes, all pointing the same way, as the errand says --- */
    town.lots.forEach(function (l) {
      if (!P['dish_' + l.id]) return;
      var cx = l.rect[0] + l.rect[2] * 0.74, cz = l.rect[1] + l.rect[3] * 0.24;
      var base = h(cx, cz) + 0.34 + 3.1 * (l.storeys || 1) - 0.45;
      var d2 = new T.SphereGeometry(0.34, 10, 6, 0, 6.2832, 0, 0.62);
      d2.rotateX(-1.05);
      d2.translate(cx, base, cz);
      batch.add('dishwhite', d2, dishMat);
      var arm2 = G.cyl(0.02, 0.02, 0.3, 5);
      arm2.rotateX(-0.9);
      arm2.translate(cx, base + 0.12, cz + 0.16);
      batch.add('dishwhite', arm2, dishMat);
    });

    /* --- the nets, the boat, the anchor --- */
    (function () {
      var a = at('quay_nets'); if (!a) return;
      for (var i = 0; i < 3; i++) {
        var heap = new T.SphereGeometry(0.44, 8, 5);
        heap.scale(1.5, 0.42, 1.1);
        heap.translate(i * 0.7 - 0.7, 0.16, 0);
        batch.add('net', heap, netMat, G.mat4(a.x, a.y, a.z, 0.3));
      }
    }());
    (function () {
      var a = at('quay_boat'); if (!a) return;
      var hull = new T.SphereGeometry(1.5, 12, 7, 0, 6.2832, 0, Math.PI / 2);
      hull.scale(0.42, 0.5, 1.0);
      hull.rotateX(Math.PI);
      hull.translate(0, 0.62, 0);
      batch.add('boatblue', hull, blue, G.mat4(a.x, a.y, a.z, 0.5));
      var bench = G.box(0.9, 0.06, 0.2);
      bench.translate(0, 0.58, 0);
      batch.add('propWood', bench, wood, G.mat4(a.x, a.y, a.z, 0.5));
    }());
    (function () {
      var a = at('quay_anchor'); if (!a) return;
      var shank = G.cyl(0.05, 0.05, 1.0, 6);
      shank.rotateZ(0.35);
      shank.translate(0, 0.4, 0);
      batch.add('iron2', shank, iron2, G.mat4(a.x, a.y, a.z, 0));
      var arms = new T.TorusGeometry(0.34, 0.05, 5, 12, Math.PI);
      arms.rotateZ(0.35);
      arms.translate(0.16, 0.12, 0);
      batch.add('iron2', arms, iron2, G.mat4(a.x, a.y, a.z, 0));
    }());

    /* --- the soap pyramid, the crates, the chairs, the arghile --- */
    (function () {
      var a = at('sabon_stack'); if (!a) return;
      for (var r = 0; r < 4; r++) {
        var n2 = 4 - r;
        for (var c2 = 0; c2 < n2; c2++) {
          var bar = G.box(0.13, 0.07, 0.09);
          bar.translate((c2 - (n2 - 1) / 2) * 0.15, 0.9 + r * 0.075, 0);
          batch.add('soap', bar, self.flat('soap', 0xbcb582, 0.82, 0), G.mat4(a.x, a.y, a.z, 0));
        }
      }
    }());
    ['lemonade_crates', 'dukkan_crates'].forEach(function (id) {
      var a = at(id); if (!a) return;
      for (var i = 0; i < 3; i++) {
        var crate = G.box(0.46, 0.24, 0.32);
        crate.translate((i % 2) * 0.1, 0.12 + i * 0.25, 0);
        batch.add('crate', crate, self.flat('crate', 0x8c6f45, 0.85, 0), G.mat4(a.x, a.y, a.z, i * 0.2));
        if (id === 'lemonade_crates') {
          for (var k = 0; k < 5; k++) {
            var lem = new T.SphereGeometry(0.045, 6, 4);
            lem.scale(1, 0.85, 1);
            lem.translate((k - 2) * 0.09, 0.26 + i * 0.25, 0.05);
            batch.add('lemonfruit', lem, self.flat('lemonfruit', 0xd8c84a, 0.6, 0), G.mat4(a.x, a.y, a.z, i * 0.2));
          }
        }
      }
    });
    (function () {
      var a = at('qahwe_chairs'); if (!a) return;
      var rc = new ER.RNG('chairs');
      for (var i = 0; i < 4; i++) {
        var xf2 = G.mat4(a.x + rc.float(-0.7, 0.7), a.y, a.z + rc.float(-0.5, 0.5), rc.float(0, 6.2832));
        var seat = G.box(0.38, 0.05, 0.38);
        seat.translate(0, 0.42, 0);
        batch.add('chair', seat, plastic, xf2);
        var back = G.box(0.38, 0.4, 0.05);
        back.translate(0, 0.62, -0.17);
        batch.add('chair', back, plastic, xf2);
        for (var lg = 0; lg < 4; lg++) {
          var leg = G.cyl(0.018, 0.018, 0.42, 5);
          leg.translate(((lg % 2) - 0.5) * 0.3, 0.21, (((lg >> 1) % 2) - 0.5) * 0.3);
          batch.add('chair', leg, plastic, xf2);
        }
      }
    }());
    (function () {
      var a = at('qahwe_arghile'); if (!a) return;
      var stool = G.cyl(0.14, 0.16, 0.4, 8);
      stool.translate(0, 0.2, 0);
      batch.add('propWood', stool, wood, G.mat4(a.x, a.y, a.z, 0));
      var jar = new T.SphereGeometry(0.11, 8, 6);
      jar.scale(1, 1.2, 1);
      jar.translate(0, 0.52, 0);
      batch.add('arghileglass', jar, self.flat('arghileglass', 0x6a4a6a, 0.25, 0.3), G.mat4(a.x, a.y, a.z, 0));
      var stem = G.cyl(0.022, 0.03, 0.5, 6);
      stem.translate(0, 0.86, 0);
      batch.add('brass2', stem, brass2, G.mat4(a.x, a.y, a.z, 0));
      var bowl2 = G.cyl(0.055, 0.04, 0.09, 8);
      bowl2.translate(0, 1.14, 0);
      batch.add('terracotta', bowl2, terra, G.mat4(a.x, a.y, a.z, 0));
    }());

    /* --- gas canisters, the generator, the bank of meters --- */
    (function () {
      var a = at('zaroub_gas'); if (!a) return;
      for (var i = 0; i < 5; i++) {
        var can = G.cyl(0.15, 0.15, 0.55, 10);
        can.translate((i - 2) * 0.34, 0.28, 0);
        batch.add('gascan', can, self.flat('gascan', 0xa8563f, 0.6, 0.35), G.mat4(a.x, a.y, a.z, 0));
      }
    }());
    (function () {
      var a = at('souk_generator'); if (!a) return;
      var box2 = G.box(1.1, 0.8, 0.7);
      box2.translate(0, 0.4, 0);
      batch.add('genbox', box2, self.flat('genbox', 0x7a6f52, 0.7, 0.3), G.mat4(a.x, a.y, a.z, 0));
      var pipe2 = G.cyl(0.05, 0.05, 0.7, 6);
      pipe2.translate(0.42, 1.05, -0.2);
      batch.add('iron2', pipe2, iron2, G.mat4(a.x, a.y, a.z, 0));
    }());
    (function () {
      var a = at('souk_meters'); if (!a) return;
      for (var i = 0; i < 6; i++) {
        var m2 = G.box(0.22, 0.3, 0.13);
        m2.translate(((i % 3) - 1) * 0.26, 1.35 + Math.floor(i / 3) * 0.36, 0);
        batch.add('meterbox', m2, self.flat('meterbox', 0x8e8a7e, 0.7, 0.25), G.mat4(a.x, a.y, a.z, 0));
      }
    }());

    /* --- three cats. Each one is a small warm lump that does not move,
           because a cat that moved would be a different kind of project. --- */
    ['souk_cat_blue', 'square_cat', 'quay_cat'].forEach(function (id, ci) {
      var a = at(id); if (!a) return;
      var coat = self.flat('cat' + ci, [0x9a8f78, 0xb8ab94, 0x6a6258][ci], 0.9, 0);
      var xf2 = G.mat4(a.x, a.y, a.z, ci * 1.7);
      var body = new T.SphereGeometry(0.17, 8, 6);
      body.scale(1.7, 0.85, 0.9);
      body.translate(0, 0.16, 0);
      batch.add('cat' + ci, body, coat, xf2);
      var head = new T.SphereGeometry(0.1, 7, 5);
      head.translate(0.26, 0.24, 0);
      batch.add('cat' + ci, head, coat, xf2);
      var tail = G.cyl(0.02, 0.03, 0.34, 5);
      tail.rotateZ(1.2);
      tail.translate(-0.32, 0.18, 0);
      batch.add('cat' + ci, tail, coat, xf2);
    });

    /* --- the moped, the Mercedes, the posters, the well lid --- */
    (function () {
      var a = at('souk_moped'); if (!a) return;
      var xf2 = G.mat4(a.x, a.y, a.z, 1.2);
      var frame = G.box(1.1, 0.16, 0.22);
      frame.translate(0, 0.5, 0);
      batch.add('moped', frame, self.flat('moped', 0x6a2f2f, 0.5, 0.4), xf2);
      for (var w2 = 0; w2 < 2; w2++) {
        var wheel = new T.TorusGeometry(0.21, 0.05, 5, 12);
        wheel.translate((w2 - 0.5) * 0.9, 0.22, 0);
        batch.add('tyre2', wheel, self.flat('tyre2', 0x1e1f1e, 0.9, 0), xf2);
      }
      var seat2 = G.box(0.4, 0.09, 0.22);
      seat2.translate(-0.2, 0.63, 0);
      batch.add('moped', seat2, self.flat('mopedseat', 0x2a2724, 0.7, 0.1), xf2);
    }());
    (function () {
      var a = at('souk_taxi'); if (!a) return;
      var xf2 = G.mat4(a.x, a.y, a.z, 1.55);
      var body = G.box(4.4, 0.78, 1.72);
      body.translate(0, 0.72, 0);
      batch.add('merc', body, self.flat('merc', 0xcfc8b4, 0.38, 0.55), xf2);
      var cabin = G.box(2.3, 0.62, 1.6);
      cabin.translate(-0.1, 1.38, 0);
      batch.add('merc', cabin, self.flat('merc', 0xcfc8b4, 0.38, 0.55), xf2);
      var glass2 = G.box(2.26, 0.56, 1.62);
      glass2.translate(-0.1, 1.4, 0);
      batch.add('mercglass', glass2, self.flat('mercglass', 0x1b2228, 0.1, 0.5), xf2);
      for (var w3 = 0; w3 < 4; w3++) {
        var wh = new T.TorusGeometry(0.31, 0.11, 6, 12);
        wh.rotateY(Math.PI / 2);
        wh.translate(((w3 % 2) - 0.5) * 2.8, 0.33, (((w3 >> 1) % 2) - 0.5) * 1.6);
        batch.add('tyre2', wh, self.flat('tyre2', 0x1e1f1e, 0.9, 0), xf2);
      }
    }());
    (function () {
      var a = at('souk_posters'); if (!a) return;
      var rp2 = new ER.RNG('posters');
      for (var i = 0; i < 5; i++) {
        var sheet = G.box(0.34, 0.48, 0.008);
        sheet.translate(rp2.float(-0.5, 0.5), 1.5 + rp2.float(-0.3, 0.3), 0);
        batch.add('poster' + (i % 3), sheet,
          self.flat('poster' + (i % 3), [0xb8b0a0, 0xa89a86, 0xc6bca8][i % 3], 0.9, 0),
          G.mat4(a.x, a.y, a.z, 0));
      }
    }());
    (function () {
      var a = at('well_lid'); if (!a) return;
      var lid = G.cyl(0.42, 0.42, 0.06, 12);
      lid.translate(0, 0.04, 0);
      batch.add('iron2', lid, iron2, G.mat4(a.x, a.y, a.z, 0));
    }());
    ['square_bench', 'bench_landing'].forEach(function (id) {
      var a = at(id); if (!a) return;
      var slab = G.box(1.6, 0.16, 0.42);
      slab.translate(0, 0.42, 0);
      batch.add('benchstone', slab, self.material('sandstone', {}), G.mat4(a.x, a.y, a.z, 0));
      for (var e = 0; e < 2; e++) {
        var leg2 = G.box(0.22, 0.42, 0.38);
        leg2.translate((e - 0.5) * 1.2, 0.21, 0);
        batch.add('benchstone', leg2, self.material('sandstone', {}), G.mat4(a.x, a.y, a.z, 0));
      }
    });
    (function () {
      var a = at('mahjour_tiles'); if (!a) return;
      var rt = new ER.RNG('tileheap');
      for (var i = 0; i < 14; i++) {
        var tl = G.box(0.3, 0.035, 0.18);
        tl.translate(rt.float(-0.5, 0.5), 0.02 + i * 0.03, rt.float(-0.4, 0.4));
        var xf3 = G.mat4(a.x, a.y, a.z, rt.float(0, 3.14));
        batch.add('terracotta', tl, terra, xf3);
      }
    }());
    (function () {
      var a = at('square_shrine'); if (!a) return;
      var niche = G.box(0.5, 0.7, 0.28);
      niche.translate(0, 1.3, 0);
      batch.add('benchstone', niche, self.material('sandstone', {}), G.mat4(a.x, a.y, a.z, 0));
      var figure = G.cyl(0.05, 0.07, 0.22, 7);
      figure.translate(0, 1.2, 0.02);
      batch.add('virgin', figure, self.flat('virgin', 0xd8dce4, 0.7, 0.05), G.mat4(a.x, a.y, a.z, 0));
    }());
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
    this.buildLamps(batch);
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
