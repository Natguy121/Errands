/* Errands — the buildings.
 *
 * Thirty-one dwellings and nineteen other structures, built from lot data:
 * foundation, lap siding, gable roof with a real overhang, fascia, gutters,
 * porch, door, recessed windows, chimney, condenser, satellite dish. Every
 * window pane is one instance in a single instanced mesh, so the whole town
 * can light up at dusk without costing a draw call per house. */
(function (ER) {
  'use strict';
  var U = ER.U;
  var T = window.THREE;
  var G = ER.Geom;
  var M = ER.Mats;
  var S = ER.Scene3D.prototype;
  var TILE = ER.TILE;

  var STOREY = 2.62;

  /* snap a direction to the nearest axis; rural houses face the road square */
  function frontOf(nx, nz) {
    if (Math.abs(nx) >= Math.abs(nz)) return { x: nx > 0 ? -1 : 1, z: 0 };
    return { x: 0, z: nz > 0 ? -1 : 1 };
  }

  /* ---------- window panes, collected and instanced ---------- */

  S.paneQueue = function () {
    if (!this._panes) this._panes = [];
    return this._panes;
  };

  S.addPane = function (x, y, z, yaw, w, h, group) {
    this.paneQueue().push({ x: x, y: y, z: z, yaw: yaw, w: w, h: h, group: group });
  };

  S.buildPanes = function () {
    var list = this.paneQueue();
    if (!list.length) return;
    var geo = new T.PlaneGeometry(1, 1);
    var mat = new T.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.06, metalness: 0.22,
      emissive: new T.Color(0xffd9a0), emissiveIntensity: 1.0
    });
    /* let the per-instance colour drive the glow, so each house can be dark
       or lit without its own material */
    mat.onBeforeCompile = function (shader) {
      shader.fragmentShader = shader.fragmentShader.replace(
        'vec3 totalEmissiveRadiance = emissive;',
        'vec3 totalEmissiveRadiance = emissive * vColor;'
      );
    };
    var inst = new T.InstancedMesh(geo, mat, list.length);
    inst.castShadow = false;
    inst.receiveShadow = false;
    inst.name = 'windowpanes';
    var m = new T.Matrix4();
    var q = new T.Quaternion();
    var e = new T.Euler();
    var dark = new T.Color(0x0b1016);
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      e.set(0, p.yaw, 0);
      q.setFromEuler(e);
      m.compose(new T.Vector3(p.x, p.y, p.z), q, new T.Vector3(p.w, p.h, 1));
      inst.setMatrixAt(i, m);
      inst.setColorAt(i, dark);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    this.panes = inst;
    this.paneList = list;
    this.root.add(inst);
  };

  /* switch the panes on and off as people come and go */
  S.updateWindows = function (game) {
    if (!this.panes) return;
    var dl = game.clock.daylight();
    var hf = game.clock.hourFloat();
    var night = dl < 0.40;
    var lit = new T.Color(1.0, 0.86, 0.62);
    var dim = new T.Color(0.36, 0.33, 0.30);
    var dark = new T.Color(0.028, 0.038, 0.052);
    var changed = false;
    for (var i = 0; i < this.paneList.length; i++) {
      var p = this.paneList[i];
      var want;
      if (!night) want = dark;
      else {
        var on;
        if (p.group === 'always') on = true;
        else if (p.group === 'shop') on = hf > 5.6 && hf < 21.4;
        else if (p.group === 'derelict') on = false;
        else {
          var res = game.residentOfLot(p.group);
          on = res ? (res.dest === 'home' && !res.away && hf < 23.3 && hf > 5.4) : (hf < 22.6 && hf > 6.0);
          if (p.group === '__home') on = true;
        }
        want = on ? lit : (p.group === 'derelict' ? dark : dim);
      }
      if (p._last !== want) { this.panes.setColorAt(i, want); p._last = want; changed = true; }
    }
    if (changed && this.panes.instanceColor) this.panes.instanceColor.needsUpdate = true;
  };

  /* ================================================================== *
   *  a dwelling
   * ================================================================== */

  /* Voussoirs round a half-circle: seven little stones, which is what an arch
     over a window in this quarter actually is. */
  function archRing(radius, thick, depth, n) {
    var geos = [];
    for (var i = 0; i < n; i++) {
      var a = Math.PI * ((i + 0.5) / n);
      var b = G.box(thick, (Math.PI * radius) / n * 1.12, depth);
      b.rotateZ(a - Math.PI / 2);
      b.translate(-Math.cos(a) * radius, Math.sin(a) * radius, 0);
      geos.push(b);
    }
    return G.merge(geos);
  }

  S.buildHouse = function (batch, lot, isHome) {
    var h = this.h;
    var rect = lot.house;
    var cx = rect.x + rect.w / 2, cz = rect.y + rect.h / 2;
    var front = frontOf(lot.nx === undefined ? 0 : lot.nx, lot.ny === undefined ? 1 : lot.ny);
    var alongZ = front.z !== 0;
    var w = alongZ ? rect.w : rect.h;      /* local x */
    var d = alongZ ? rect.h : rect.w;      /* local z, front at +z */
    var yaw = Math.atan2(front.x, front.z);
    var storeys = lot.storeys || 1;
    var wallH = STOREY * storeys;
    var base = h(cx, cz);
    var found = 0.22;
    var y0 = base + found;
    var key = isHome ? '__home' : lot.id;
    var pitched = lot.roof === 'tile';

    var xf = G.mat4(cx, 0, cz, yaw);

    var stoneMat = this.material('sandstone', {});
    var wallMat = this.material('limewash', { color: lot.siding, roughness: 0.84 });
    var wallKey = 'siding_' + lot.siding;
    var shutMat = this.flat('shutter' + lot.shutter, lot.shutter, 0.72, 0);
    var ironMat = this.flat('houseiron', 0x4f4a42, 0.68, 0.12);
    var tileMat = this.material('tile', { roughness: 0.8 });

    /* --- the plinth the whole thing stands on, cut stone --- */
    var fg = G.box(w + 0.16, found + 0.1, d + 0.16, TILE.sandstone);
    fg.translate(0, base - 0.1, 0);
    batch.add('foundation', fg, stoneMat, xf);

    /* --- walls: limewash over a course of bare sandstone at the bottom,
           which is where the render has come off every house here --- */
    var PLINTH = 1.15;
    var pw2 = G.box(w + 0.03, PLINTH, d + 0.03, TILE.sandstone);
    pw2.translate(0, y0, 0);
    batch.add('stonecourse', pw2, stoneMat, xf);
    var wg = G.box(w, wallH, d, TILE.limewash);
    wg.translate(0, y0, 0);
    batch.add(wallKey, wg, wallMat, xf);

    /* --- roof: a flat terrace with a parapet, or a shallow tile pitch --- */
    var rise = pitched ? Math.min(w, d) * 0.16 : 0;
    if (pitched) {
      var gb = G.gable(w, d, rise, 0.34, TILE.tile);
      gb.roof.translate(0, y0 + wallH, 0);
      batch.add('rooftile_' + lot.roofColor, gb.roof, tileMat, xf);
      gb.gables.translate(0, y0 + wallH, 0);
      batch.add(wallKey, gb.gables, wallMat, xf);
      /* the cornice course the tiles sit on */
      var corn = G.box(w + 0.26, 0.16, d + 0.26, TILE.sandstone);
      corn.translate(0, y0 + wallH - 0.16, 0);
      batch.add('foundation', corn, stoneMat, xf);
    } else {
      var slab = G.box(w + 0.2, 0.18, d + 0.2, TILE.concrete);
      slab.translate(0, y0 + wallH, 0);
      batch.add('foundation', slab, this.material('concrete', { color: 0xb9b2a2 }), xf);
      /* the parapet, waist high, with the drain gap in it */
      for (var pside = 0; pside < 4; pside++) {
        var horiz = pside < 2;
        var pl = horiz ? w + 0.2 : d + 0.2 - 0.36;
        var par = G.box(horiz ? pl : 0.18, 0.52, horiz ? 0.18 : pl, TILE.limewash);
        par.translate(horiz ? 0 : (pside === 2 ? 1 : -1) * (w / 2 + 0.01),
          y0 + wallH + 0.18, horiz ? (pside === 0 ? 1 : -1) * (d / 2 + 0.01) : 0);
        batch.add(wallKey, par, wallMat, xf);
      }
    }

    /* one iron downpipe, in the corner, bracketed off the wall */
    var ds = G.cyl(0.05, 0.05, wallH - 0.1, 6);
    ds.translate(w / 2 - 0.16, y0, d / 2 + 0.08);
    batch.add('houseiron', ds, ironMat, xf);

    /* --- the door: tall, arched, with a stone surround --- */
    var doorW = 1.0, doorH = 2.16;
    var jamb = G.frame(doorW + 0.3, doorH + 0.16, 0.15, 0.13);
    jamb.translate(0, y0, d / 2 + 0.05);
    batch.add('doorsurround', jamb, stoneMat, xf);
    var arch = archRing(doorW / 2 + 0.15, 0.15, 0.13, 7);
    arch.translate(0, y0 + doorH + 0.16, d / 2 + 0.05);
    batch.add('doorsurround', arch, stoneMat, xf);
    var slabD = G.box(doorW, doorH, 0.06);
    slabD.translate(0, y0, d / 2 + 0.02);
    batch.add('door', slabD, this.flat('door' + lot.id, lot.shutter, 0.66, 0), xf);
    var knob = G.cyl(0.035, 0.035, 0.09, 6);
    knob.rotateX(Math.PI / 2);
    knob.translate(doorW / 2 - 0.16, y0 + 1.02, d / 2 + 0.08);
    batch.add('metal_brass', knob, this.flat('brass', 0xb08d4a, 0.35, 0.8), xf);
    /* the threshold stone, worn in the middle */
    var thr = G.box(1.7, found + 0.06, 0.62, TILE.sandstone);
    thr.translate(0, base, d / 2 + 0.31);
    batch.add('foundation', thr, stoneMat, xf);

    /* --- windows: tall, narrow, stone-surrounded, shuttered --- */
    var self = this;
    function window1(lx, lz, ry, sill, ww, wh, shuttered) {
      var fr = G.frame(ww + 0.26, wh + 0.2, 0.13, 0.1);
      fr.rotateY(ry);
      fr.translate(lx, sill, lz);
      batch.add('doorsurround', fr, stoneMat, xf);
      var sl = G.box(ww + 0.42, 0.09, 0.22, TILE.sandstone);
      sl.rotateY(ry);
      sl.translate(lx, sill - 0.09, lz);
      batch.add('foundation', sl, stoneMat, xf);
      if (shuttered) {
        for (var sgn = -1; sgn <= 1; sgn += 2) {
          var fl = G.box(ww * 0.52, wh, 0.045);
          fl.rotateY(ry);
          var ox = sgn * (ww / 2 + ww * 0.28), oz = 0;
          /* the flaps hang beside the opening, in the wall plane */
          var rx = Math.cos(ry) * ox, rz = -Math.sin(ry) * ox;
          fl.translate(lx + rx, sill, lz + rz);
          batch.add('shutter_' + lot.shutter, fl, shutMat, xf);
        }
      }
      var world = new T.Vector3(lx, sill + wh / 2, lz).applyMatrix4(xf);
      self.addPane(world.x, world.y, world.z, yaw + ry, ww, wh, key);
    }

    /* the triple-arched window over the door: the one thing every house in
       the quarter has, and the reason its front room is called the hall */
    function arcade(sill) {
      var aw = 0.62, ah = 1.28, gap = 0.17;
      for (var i = -1; i <= 1; i++) {
        var lx = i * (aw + gap);
        var lz = d / 2 + 0.03;
        var hgt = ah + (i === 0 ? 0.26 : 0);
        var fr = G.frame(aw + 0.2, hgt + 0.16, 0.1, 0.1);
        fr.translate(lx, sill, lz);
        batch.add('doorsurround', fr, stoneMat, xf);
        var ar = archRing(aw / 2 + 0.1, 0.1, 0.1, 6);
        ar.translate(lx, sill + hgt + 0.16, lz);
        batch.add('doorsurround', ar, stoneMat, xf);
        var world = new T.Vector3(lx, sill + hgt / 2, lz).applyMatrix4(xf);
        self.addPane(world.x, world.y, world.z, yaw, aw, hgt, key);
      }
      var sl2 = G.box((aw + gap) * 3 + 0.3, 0.1, 0.24, TILE.sandstone);
      sl2.translate(0, sill - 0.1, d / 2 + 0.06);
      batch.add('foundation', sl2, stoneMat, xf);
    }

    var WW = 0.74, WH = 1.42;
    for (var st = 0; st < storeys; st++) {
      var sill = y0 + 0.92 + st * STOREY;
      var top = st === storeys - 1;
      var haveArcade = lot.arcade && top && storeys > 1 && w > 3.6;
      /* front */
      var nFront = Math.max(1, Math.round((w - 1.0) / 1.9));
      if (haveArcade) {
        arcade(sill);
      } else {
        for (var i = 0; i < nFront; i++) {
          var t = nFront === 1 ? 0 : (i / (nFront - 1) - 0.5);
          var lx = t * (w - 1.3);
          if (st === 0 && Math.abs(lx) < 0.95) continue;    /* the door is there */
          window1(lx, d / 2 + 0.03, 0, sill, WW, WH, true);
        }
      }
      /* back, and the two ends */
      var nBack = Math.max(1, Math.round((w - 1.0) / 2.3));
      for (var j = 0; j < nBack; j++) {
        var tb = nBack === 1 ? 0 : (j / (nBack - 1) - 0.5);
        window1(tb * (w - 1.5), -(d / 2 + 0.03), Math.PI, sill, WW, WH, false);
      }
      var nSide = Math.max(1, Math.round((d - 1.0) / 2.4));
      for (var k = 0; k < nSide; k++) {
        var ts = nSide === 1 ? 0 : (k / (nSide - 1) - 0.5);
        for (var sg = -1; sg <= 1; sg += 2) {
          window1(sg * (w / 2 + 0.03), ts * (d - 1.5), sg > 0 ? Math.PI / 2 : -Math.PI / 2,
            sill, WW, WH, st > 0);
        }
      }
    }

    /* --- the balcony over the door, stone slab on two corbels --- */
    if (lot.balcony && storeys > 1) {
      var bY = y0 + STOREY + 0.62;
      var bw = Math.min(w - 0.5, 2.9);
      var bsl = G.box(bw, 0.14, 1.05, TILE.sandstone);
      bsl.translate(0, bY, d / 2 + 0.52);
      batch.add('foundation', bsl, stoneMat, xf);
      for (var cb = -1; cb <= 1; cb += 2) {
        var cor = G.box(0.16, 0.34, 0.5, TILE.sandstone);
        cor.translate(cb * (bw / 2 - 0.16), bY - 0.34, d / 2 + 0.26);
        batch.add('foundation', cor, stoneMat, xf);
      }
      /* the railing: uprights and a top rail, in painted iron */
      var rail = G.box(bw, 0.045, 0.045);
      rail.translate(0, bY + 1.0, d / 2 + 1.02);
      batch.add('houseiron', rail, ironMat, xf);
      var nUp = Math.max(6, Math.round(bw / 0.16));
      for (var u = 0; u <= nUp; u++) {
        var ux = -bw / 2 + (u / nUp) * bw;
        var up = G.cyl(0.016, 0.016, 1.0, 5);
        up.translate(ux, bY + 0.14, d / 2 + 1.02);
        batch.add('houseiron', up, ironMat, xf);
      }
      for (var side2 = -1; side2 <= 1; side2 += 2) {
        var sr = G.box(0.045, 0.045, 1.0);
        sr.translate(side2 * bw / 2, bY + 1.0, d / 2 + 0.55);
        batch.add('houseiron', sr, ironMat, xf);
      }
    }

    /* --- the outside stone stair to the roof, on about a third of them --- */
    if (lot.stair) {
      var steps = Math.round((wallH + 0.2) / 0.19);
      for (var sN = 0; sN < steps; sN++) {
        var sy = y0 + sN * 0.19;
        var stp = G.box(0.9, 0.19, 0.28, TILE.sandstone);
        stp.translate(-(w / 2) - 0.45, sy, -(d / 2) + 0.2 + sN * 0.28);
        batch.add('foundation', stp, stoneMat, xf);
      }
    }

    /* --- the air conditioner, bracketed on the wall like everybody's --- */
    if (lot.features && lot.features.ac) {
      var ac = G.box(0.78, 0.5, 0.36);
      ac.translate(w / 2 - 0.9, y0 + STOREY - 0.3, d / 2 + 0.2);
      batch.add('metal_grey', ac, this.flat('acbody', 0xc8c6bc, 0.6, 0.18), xf);
    }

    /* The dishes and the water tanks are built in the scatter pass now, off
       their own prop ids, so they sit where the errands say they sit. The
       version that used to be here read features.dish as a {x,y,r} and got a
       boolean, which made every one of its 4860 vertex positions NaN --
       invisible in the frame, and a console warning nobody reads. */

    /* --- the house number, painted on a plate by the door --- */
    if (!isHome) {
      var plaqueTex = G.signTexture([String(lot.number)],
        { w: 128, h: 64, bg: '#2c5c3c', fg: '#f2efe4', size: 42, border: '#f2efe4', borderW: 4 });
      var plaque = new T.Mesh(new T.PlaneGeometry(0.3, 0.15),
        new T.MeshStandardMaterial({ map: plaqueTex, roughness: 0.7 }));
      var pv = new T.Vector3(doorW / 2 + 0.36, y0 + 1.82, d / 2 + 0.07).applyMatrix4(xf);
      plaque.position.copy(pv);
      plaque.rotation.y = yaw;
      this.root.add(plaque);
    }

    return { base: base, wallH: wallH, yaw: yaw, w: w, d: d, front: front };
  };

  /* ================================================================== *
   *  everything that is not a house
   * ================================================================== */

  /* Everything in the quarter that is not somebody's house: the chapel, the
     furn, the qahwe, the dukkan, the soap shop, the barber, the fishermen's
     shed, the lemonade kiosk, the abandoned house. They were being built as
     strip-mall units — a two-metre band of plate glass and a glazed door on
     the +z wall whatever way the building actually faced, so six of the ten
     had their shopfront round the back and the chapel had a shopfront at all. */
  S.buildBuilding = function (batch, b) {
    var h = this.h;
    var cx = b.x + b.w / 2, cz = b.y + b.h / 2;
    var base = h(cx, cz);
    var storeys = b.storeys || 1;
    var front = frontOf.apply(null, ({ n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[b.face] || [0, 1]));
    var alongZ = front.z !== 0;
    var w = alongZ ? b.w : b.h;            /* local x */
    var d = alongZ ? b.h : b.w;            /* local z, the front at +z */
    var yaw = Math.atan2(front.x, front.z);
    var xf = G.mat4(cx, 0, cz, yaw);
    var wallH = b.open ? 2.6 : (b.civic ? 4.6 : 3.0) * storeys;

    var stoneMat = this.material('sandstone', {});
    var wallMat = b.derelict ? this.material('sandstone', {})
      : this.material('limewash', { color: b.wall });
    var wallKey = b.derelict ? 'ruinwall' : 'siding_' + b.wall;
    var ironMat = this.flat('shopiron', 0x565046, 0.68, 0.12);

    /* --- the abandoned house: four courses of stone and the sky --- */
    if (b.ruin) {
      var ring = [[-w / 2, -d / 2, w, 0.55], [-w / 2, d / 2 - 0.55, w, 0.55],
        [-w / 2, -d / 2, 0.55, d], [w / 2 - 0.55, -d / 2, 0.55, d]];
      for (var r = 0; r < ring.length; r++) {
        var hgt = r === 1 ? 2.35 : 1.45;   /* one wall still most of the way up */
        var seg = G.box(ring[r][2], hgt, ring[r][3], TILE.sandstone);
        seg.translate(ring[r][0] + ring[r][2] / 2, base - 0.1, ring[r][1] + ring[r][3] / 2);
        batch.add('ruinstone', seg, stoneMat, xf);
      }
      /* the beams of the roof that came down, lying where they fell */
      var rng = new ER.RNG('ruin' + b.id);
      for (var raf = 0; raf < 7; raf++) {
        var beam = G.box(0.13, 0.15, d * rng.float(0.5, 0.95));
        beam.rotateX(rng.float(-0.35, 0.35));
        beam.rotateZ(rng.float(-0.2, 0.2));
        beam.translate((raf / 6 - 0.5) * (w - 0.8), base + rng.float(0.2, 1.1), rng.float(-0.6, 0.6));
        batch.add('ruinbeam', beam, this.material('wood', { color: 0x6d6049 }), xf);
      }
      return;
    }

    /* --- the lemonade kiosk: four posts, a tin roof, a counter --- */
    if (b.open) {
      for (var px = -1; px <= 1; px += 2) {
        for (var pz = -1; pz <= 1; pz += 2) {
          var post = G.box(0.11, wallH, 0.11, TILE.wood);
          post.translate(px * (w / 2 - 0.12), base, pz * (d / 2 - 0.12));
          batch.add('kioskpost', post, ironMat, xf);
        }
      }
      var tin = G.box(w + 0.5, 0.07, d + 0.5);
      tin.translate(0, base + wallH, 0);
      batch.add('kiosktin', tin, this.flat('tinroof', 0x9ea39c, 0.5, 0.15), xf);
      var cntr = G.box(w, 0.1, 0.5, TILE.wood);
      cntr.translate(0, base + 1.0, d / 2 - 0.25);
      batch.add('kioskcounter', cntr, this.material('wood', { color: 0xa8956f }), xf);
      var apron2 = G.box(w, 0.9, 0.08, TILE.wood);
      apron2.translate(0, base + 0.1, d / 2 - 0.02);
      batch.add('kioskcounter', apron2, this.material('wood', { color: 0xa8956f }), xf);
      return;
    }

    /* --- walls: the same stone plinth and limewash as the houses --- */
    var plinth = G.box(w + 0.03, 1.1, d + 0.03, TILE.sandstone);
    plinth.translate(0, base, 0);
    batch.add('stonecourse', plinth, stoneMat, xf);
    var wg = G.box(w, wallH, d, TILE.limewash);
    wg.translate(0, base, 0);
    batch.add(wallKey, wg, wallMat, xf);

    /* --- roof: tile on the chapel, a terrace on everything else --- */
    if (b.civic) {
      var gb = G.gable(w, d, Math.min(w, d) * 0.3, 0.3, TILE.tile);
      gb.roof.translate(0, base + wallH, 0);
      batch.add('rooftile_' + b.roofColor, gb.roof, this.material('tile', { roughness: 0.8 }), xf);
      gb.gables.translate(0, base + wallH, 0);
      batch.add(wallKey, gb.gables, wallMat, xf);
    } else {
      var slab = G.box(w + 0.18, 0.16, d + 0.18, TILE.concrete);
      slab.translate(0, base + wallH, 0);
      batch.add('foundation', slab, this.material('concrete', { color: 0xb9b2a2 }), xf);
      for (var ps = 0; ps < 4; ps++) {
        var horiz = ps < 2;
        var pl = horiz ? w + 0.18 : d + 0.18 - 0.34;
        var par = G.box(horiz ? pl : 0.17, 0.46, horiz ? 0.17 : pl, TILE.limewash);
        par.translate(horiz ? 0 : (ps === 2 ? 1 : -1) * (w / 2 + 0.005),
          base + wallH + 0.16, horiz ? (ps === 0 ? 1 : -1) * (d / 2 + 0.005) : 0);
        batch.add(wallKey, par, wallMat, xf);
      }
    }

    var frontZ = d / 2;

    /* --- the chapel: one tall arched door, two slit windows a side --- */
    if (b.civic) {
      var doorW = 1.25, doorH = 2.5;
      var jamb = G.frame(doorW + 0.36, doorH + 0.18, 0.18, 0.15);
      jamb.translate(0, base, frontZ + 0.05);
      batch.add('doorsurround', jamb, stoneMat, xf);
      var arch = archRing(doorW / 2 + 0.18, 0.18, 0.15, 8);
      arch.translate(0, base + doorH + 0.18, frontZ + 0.05);
      batch.add('doorsurround', arch, stoneMat, xf);
      var leaf = G.box(doorW, doorH, 0.07);
      leaf.translate(0, base, frontZ + 0.02);
      batch.add('chapeldoor', leaf, this.flat('chapeldoor', 0x5c4630, 0.66, 0), xf);
      for (var cw = 0; cw < 2; cw++) {
        for (var cs = -1; cs <= 1; cs += 2) {
          var lz = (cw - 0.5) * (d * 0.5);
          var fr = G.frame(0.5, 1.5, 0.14, 0.1);
          fr.rotateY(cs > 0 ? Math.PI / 2 : -Math.PI / 2);
          fr.translate(cs * (w / 2 + 0.02), base + 1.6, lz);
          batch.add('doorsurround', fr, stoneMat, xf);
          var wp = new T.Vector3(cs * (w / 2 + 0.03), base + 2.35, lz).applyMatrix4(xf);
          this.addPane(wp.x, wp.y, wp.z, yaw + (cs > 0 ? Math.PI / 2 : -Math.PI / 2), 0.5, 1.5, 'always');
        }
      }
      return;
    }

    /* --- the shops: one square opening under a stone lintel, a roller
           shutter run half up, a counter across it and an awning over --- */
    var openW = Math.min(w - 0.7, 2.6), openH = 2.25;
    var lint = G.box(openW + 0.5, 0.24, 0.22, TILE.sandstone);
    lint.translate(0, base + openH, frontZ + 0.06);
    batch.add('foundation', lint, stoneMat, xf);
    for (var js = -1; js <= 1; js += 2) {
      var jm = G.box(0.2, openH, 0.2, TILE.sandstone);
      jm.translate(js * (openW / 2 + 0.1), base, frontZ + 0.05);
      batch.add('doorsurround', jm, stoneMat, xf);
    }
    /* the dark of the inside, which is what you actually see of a shop here */
    var mouth = G.box(openW, openH, 0.06);
    mouth.translate(0, base, frontZ - 0.02);
    batch.add('shopdark', mouth, this.flat('shopdark', 0x2a2823, 0.9, 0), xf);
    /* the shutter, rolled most of the way up */
    var shut = G.box(openW, 0.62, 0.05);
    shut.translate(0, base + openH - 0.62, frontZ + 0.03);
    batch.add('shopiron', shut, ironMat, xf);
    var roll = G.cyl(0.09, 0.09, openW, 8);
    roll.rotateZ(Math.PI / 2);
    roll.translate(0, base + openH - 0.1, frontZ + 0.09);
    batch.add('shopiron', roll, ironMat, xf);
    /* the counter across the opening, worn smooth */
    var cntr2 = G.box(openW + 0.2, 0.1, 0.44, TILE.sandstone);
    cntr2.translate(0, base + 0.96, frontZ + 0.12);
    batch.add('foundation', cntr2, stoneMat, xf);
    /* and the awning, in whatever stripe the shop bought */
    var awn = G.box(openW + 0.7, 0.05, 0.85);
    awn.rotateX(-0.22);
    awn.translate(0, base + openH + 0.42, frontZ + 0.44);
    batch.add('awning_' + b.id, awn, this.flat('awning' + b.id,
      b.kind === 'cafe' ? 0x7a3f38 : b.kind === 'bakery' ? 0x3f5f72 : 0x5a6b45, 0.82, 0), xf);
    for (var ab = -1; ab <= 1; ab += 2) {
      var stay = G.cyl(0.02, 0.02, 0.62, 5);
      stay.rotateX(1.1);
      stay.translate(ab * (openW / 2 + 0.28), base + openH + 0.22, frontZ + 0.2);
      batch.add('shopiron', stay, ironMat, xf);
    }

    /* a window upstairs, where the shopkeeper's family lives */
    if (storeys > 1 || wallH > 4.4) {
      var fr2 = G.frame(0.88, 1.5, 0.13, 0.1);
      fr2.translate(0, base + wallH - 1.9, frontZ + 0.03);
      batch.add('doorsurround', fr2, stoneMat, xf);
      var wp2 = new T.Vector3(0, base + wallH - 1.15, frontZ + 0.04).applyMatrix4(xf);
      this.addPane(wp2.x, wp2.y, wp2.z, yaw, 0.74, 1.42, b.alwaysLit ? 'always' : 'shop');
    }
  };

  /* ================================================================== *
   *  the landmarks with their own shapes
   * ================================================================== */

  S.buildLandmarks = function (batch) {
    var town = this.town, h = this.h;
    var iron = this.flat('iron', 0x4a453e, 0.58, 0.55);
    var brass = this.flat('brass', 0x9a7c42, 0.42, 0.72);
    var stone = this.material('stone', { color: 0xb2a48d });
    var coping = this.material('stone', { color: 0xa2947d });
    var i;

    /* ---- the Phoenician wall ----
       The crest is terrain, so what is built here is only the dressing: a
       coping course along the top and the stones of the seaward face. */
    var wall = town.sea.wall;
    var crest = [];
    for (i = -1; i <= town.h + 1; i += 1.0) crest.push([wall.x, i]);
    batch.add('wallcap', G.ribbon(crest, {
      height: function (x, z) { return h(x, z) + 0.06; },
      width: wall.halfWidth * 2 + 0.3, lift: 0, step: 1.0, uvPerMetre: 0.8
    }), coping);
    /* the face, stepped twice, so it reads as courses from the quay */
    batch.add('wallface', G.ribbon(crest, {
      height: function (x, z) { return h(x, z) - 0.55; },
      width: wall.halfWidth * 2 + 1.0, lift: 0, step: 1.0, uvPerMetre: 0.8
    }), stone);
    batch.add('wallface', G.ribbon(crest, {
      height: function (x, z) { return h(x, z) - 1.25; },
      width: wall.halfWidth * 2 + 1.7, lift: 0, step: 1.0, uvPerMetre: 0.8
    }), stone);

    /* the mooring ring, and the channel's cheeks */
    var mp = town.props.wall_mooring;
    if (mp) {
      var ring = new T.TorusGeometry(0.22, 0.045, 6, 12);
      ring.rotateY(Math.PI / 2);
      ring.translate(wall.x - 0.6, h(wall.x, mp.y) + 0.42, mp.y);
      batch.add('mooring', ring, iron);
    }

    /* ---- the fountain in Sahat en-Nafoura ---- */
    var f = town.square.fountain;
    var fB = h(f.x, f.y);
    var basin = G.cyl(f.r, f.r + 0.12, 0.52, 16);
    basin.translate(f.x, fB, f.y);
    batch.add('fountain', basin, stone);
    var lip = new T.TorusGeometry(f.r, 0.07, 6, 18);
    lip.rotateX(Math.PI / 2);
    lip.translate(f.x, fB + 0.54, f.y);
    batch.add('fountain', lip, coping);
    var stem = G.cyl(0.18, 0.24, 1.15, 10);
    stem.translate(f.x, fB + 0.3, f.y);
    batch.add('fountain', stem, stone);
    var bowl = G.cyl(0.46, 0.2, 0.16, 12);
    bowl.translate(f.x, fB + 1.4, f.y);
    batch.add('fountain', bowl, stone);
    /* the spout somebody has polished by using it for sixty years */
    var spout = G.cyl(0.045, 0.045, 0.34, 8);
    spout.rotateZ(Math.PI / 2);
    spout.translate(f.x - 0.34, fB + 1.06, f.y);
    batch.add('fountainspout', spout, brass);

    /* ---- the chapel: Saydet el Bahr ----
       buildBuilding lays the box and the roof; this adds the bell arch and
       the cross, which are the whole silhouette from the quay. */
    var ch = town.buildingById.chapel;
    if (ch) {
      var cx = ch.rect[0] + ch.rect[2] / 2, cz = ch.rect[1] + ch.rect[3] / 2;
      var cB = h(cx, cz);
      /* the gable wall above the door, carrying the bell */
      var gable = G.box(1.5, 1.5, 0.34);
      gable.translate(cx, cB + 3.5, ch.rect[1] + ch.rect[3] + 0.1);
      batch.add('chapelbell', gable, stone);
      var bell = G.cyl(0.13, 0.19, 0.3, 10);
      bell.translate(cx, cB + 3.6, ch.rect[1] + ch.rect[3] + 0.1);
      batch.add('chapelbell', bell, brass);
      /* and the cross */
      var up = G.box(0.08, 1.0, 0.08);
      up.translate(cx, cB + 4.7, cz);
      batch.add('chapelcross', up, iron);
      var across = G.box(0.52, 0.08, 0.08);
      across.translate(cx, cB + 4.92, cz);
      batch.add('chapelcross', across, iron);
    }

    /* ---- the steps of Darb el Daraj ----
       The terrain is already quantised into treads; these are the nosings,
       which is what makes them read as steps rather than as a ramp. */
    var daraj = town.roadById.daraj;
    if (daraj) {
      var pts = daraj.pts.map(function (q) { return [q[0], q[1]]; });
      var len = ER.poly.length(pts);
      var prevH = null;
      for (var s = 0; s <= len; s += 0.22) {
        var at = ER.poly.pointAt(pts, s);
        var hh = h(at.x, at.y);
        if (prevH !== null && Math.abs(hh - prevH) > 0.05) {
          var nose = G.box(daraj.width * 0.94, 0.07, 0.12);
          var nrm = ER.poly.normal(pts, at.seg);
          var yaw = Math.atan2(nrm.tx, nrm.ty);
          nose.rotateY(-yaw);
          nose.translate(at.x, Math.max(hh, prevH) + 0.02, at.y);
          batch.add('nosing', nose, coping);
        }
        prevH = hh;
      }
    }
  };

  S.chainlinkTexture = function () {
    if (this._chain) return this._chain;
    var SZ = 64;
    var colour = document.createElement('canvas');
    colour.width = colour.height = SZ;
    var cc = colour.getContext('2d');
    var mask = document.createElement('canvas');
    mask.width = mask.height = SZ;
    var mc = mask.getContext('2d');
    cc.fillStyle = '#aab0ac';
    cc.fillRect(0, 0, SZ, SZ);
    mc.fillStyle = '#000';
    mc.fillRect(0, 0, SZ, SZ);
    mc.strokeStyle = '#fff';
    mc.lineWidth = 2.2;
    for (var i = -SZ; i < SZ * 2; i += 12) {
      mc.beginPath(); mc.moveTo(i, 0); mc.lineTo(i + SZ, SZ); mc.stroke();
      mc.beginPath(); mc.moveTo(i + SZ, 0); mc.lineTo(i, SZ); mc.stroke();
    }
    var map = new T.CanvasTexture(colour);
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.repeat.set(14, 5);
    map.colorSpace = T.SRGBColorSpace;
    map.anisotropy = 8;
    var alpha = new T.CanvasTexture(mask);
    alpha.wrapS = alpha.wrapT = T.RepeatWrapping;
    alpha.repeat.set(14, 5);
    alpha.anisotropy = 8;
    this._chain = new T.MeshStandardMaterial({
      map: map, alphaMap: alpha, alphaTest: 0.45, side: T.DoubleSide,
      roughness: 0.5, metalness: 0.6
    });
    return this._chain;
  };

  /* ================================================================== *
   *  put it all together
   * ================================================================== */

  S.buildStructures = function () {
    var batch = new G.Batch();
    var i;
    /* You rent the back room of number 6, so your place is one of the
       eighteen rather than a nineteenth house of its own -- the lot whose id
       matches town.home.lot is built as home, which is what gives its windows
       their own lighting group. */
    var homeLot = this.town.home.lot;
    for (i = 0; i < this.town.lots.length; i++) {
      var l = this.town.lots[i];
      this.buildHouse(batch, l, l.id === homeLot);
    }

    for (i = 0; i < this.town.buildings.length; i++) this.buildBuilding(batch, this.town.buildings[i]);
    this.buildLandmarks(batch);
    batch.build(this.root, {});
    this.buildPanes();
  };
})(window.ER = window.ER || {});
