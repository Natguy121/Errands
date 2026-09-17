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
    var wallH = lot.style === 'trailer' ? 2.35 : STOREY * storeys;
    var base = h(cx, cz);
    var found = lot.style === 'trailer' ? 0.62 : 0.34;
    var y0 = base + found;
    var key = isHome ? '__home' : lot.id;

    var xf = G.mat4(cx, 0, cz, yaw);

    /* --- foundation --- */
    var fg = G.box(w + 0.18, found + 0.12, d + 0.18, TILE.concrete);
    fg.translate(0, base - 0.12, 0);
    batch.add('foundation', fg, this.material('sandstone', {}), xf);

    /* --- walls --- */
    var wallMat = this.material('limewash', { color: lot.siding, roughness: 0.82 });
    var wallKey = 'siding_' + lot.siding;
    var wg = G.box(w, wallH, d, TILE.limewash);
    wg.translate(0, y0, 0);
    batch.add(wallKey, wg, wallMat, xf);
    if (lot.skirt) {
      var sk = G.box(w + 0.05, found, d + 0.05, TILE.wood);
      sk.translate(0, base, 0);
      batch.add('skirt', sk, this.material('wood', { color: 0x8e8a80 }), xf);
    }

    /* --- roof --- */
    var rise = Math.min(w, d) * 0.42;
    var gb = G.gable(w, d, rise, 0.5, TILE.tile);
    gb.roof.translate(0, y0 + wallH, 0);
    batch.add('shingle_' + lot.roofColor, gb.roof,
      this.material('tile', { roughness: 0.8 }), xf);
    gb.gables.translate(0, y0 + wallH, 0);
    batch.add(wallKey, gb.gables, wallMat, xf);

    /* fascia along the eaves, and a gutter under it */
    var fasciaMat = this.flat('fascia', 0xe4e0d4, 0.7, 0);
    var gutterMat = this.flat('gutter', 0xd6d2c6, 0.55, 0.15);
    var eaveLen = gb.ridgeAlongX ? w + 1.0 : d + 1.0;
    var eaveOff = (gb.ridgeAlongX ? d : w) / 2 + 0.5;
    for (var side = -1; side <= 1; side += 2) {
      var fb = G.box(gb.ridgeAlongX ? eaveLen : 0.14, 0.22, gb.ridgeAlongX ? 0.14 : eaveLen);
      fb.translate(gb.ridgeAlongX ? 0 : side * eaveOff, y0 + wallH - 0.12,
        gb.ridgeAlongX ? side * eaveOff : 0);
      batch.add('fascia', fb, fasciaMat, xf);
      var gt = G.cyl(0.055, 0.055, gb.ridgeAlongX ? eaveLen : 0.1, 6);
      if (gb.ridgeAlongX) { gt.rotateZ(Math.PI / 2); gt.translate(0, y0 + wallH - 0.05, side * (eaveOff + 0.05)); }
      else { gt.rotateX(Math.PI / 2); gt.translate(side * (eaveOff + 0.05), y0 + wallH - 0.05, 0); }
      batch.add('gutter', gt, gutterMat, xf);
    }
    /* one downspout, because there is always exactly one you notice */
    var ds = G.cyl(0.045, 0.045, wallH - 0.1, 6);
    ds.translate(w / 2 - 0.2, y0, d / 2 + 0.06);
    batch.add('gutter', ds, gutterMat, xf);

    /* --- the door, in the middle of the front wall --- */
    var doorW = 1.0, doorH = 2.08;
    var jamb = G.frame(doorW + 0.18, doorH + 0.12, 0.09, 0.16);
    jamb.translate(0, y0, d / 2 + 0.05);
    batch.add('trim', jamb, fasciaMat, xf);
    var slab = G.box(doorW, doorH, 0.06);
    slab.translate(0, y0, d / 2 + 0.02);
    batch.add('door', slab, this.flat('door' + lot.id, lot.style === 'newer' ? 0x54453a : 0x6b4f3a, 0.62, 0), xf);
    var knob = G.cyl(0.035, 0.035, 0.09, 6);
    knob.rotateX(Math.PI / 2);
    knob.translate(doorW / 2 - 0.16, y0 + 1.02, d / 2 + 0.08);
    batch.add('metal_brass', knob, this.flat('brass', 0xb08d4a, 0.35, 0.8), xf);

    /* --- windows --- */
    var self = this;
    function windows(nAcross, wallOffset, axis, sign, storeyIdx, skipMiddle) {
      var ww = 1.06, wh = 1.32;
      var sill = y0 + 0.96 + storeyIdx * STOREY;
      for (var i = 0; i < nAcross; i++) {
        var t = (i + 0.5) / nAcross - 0.5;
        if (skipMiddle && Math.abs(t) < 0.5 / nAcross) continue;
        var lx, lz, ry;
        if (axis === 'x') { lx = t * (w - 1.4); lz = sign * (d / 2); ry = sign > 0 ? 0 : Math.PI; }
        else { lx = sign * (w / 2); lz = t * (d - 1.4); ry = sign > 0 ? Math.PI / 2 : -Math.PI / 2; }
        /* the frame and sill sit in the wall; the pane goes in the instanced mesh */
        var fr = G.frame(ww + 0.16, wh + 0.16, 0.085, 0.13);
        fr.rotateY(ry);
        fr.translate(lx + (axis === 'x' ? 0 : sign * 0.03), sill, lz + (axis === 'x' ? sign * 0.03 : 0));
        batch.add('trim', fr, fasciaMat, xf);
        var sl = G.box(ww + 0.3, 0.07, 0.2);
        sl.rotateY(ry);
        sl.translate(lx, sill - 0.07, lz + (axis === 'x' ? sign * 0.06 : 0));
        if (axis !== 'x') sl.translate(sign * 0.06, 0, 0);
        batch.add('trim', sl, fasciaMat, xf);

        /* pane, in world space */
        var world = new T.Vector3(lx + (axis === 'x' ? sign * 0.02 : 0), sill + wh / 2,
          lz + (axis === 'x' ? 0 : 0));
        if (axis !== 'x') world.x = sign * (w / 2 + 0.02);
        else world.z = sign * (d / 2 + 0.02);
        world.applyMatrix4(xf);
        self.addPane(world.x, world.y, world.z, yaw + ry, ww, wh, key);
      }
    }
    var acrossFront = Math.max(2, Math.round(w / 3.4));
    var acrossSide = Math.max(1, Math.round(d / 4.0));
    for (var st = 0; st < storeys; st++) {
      windows(acrossFront, 0, 'x', 1, st, st === 0);
      windows(acrossFront, 0, 'x', -1, st, false);
      windows(acrossSide, 0, 'z', 1, st, false);
      windows(acrossSide, 0, 'z', -1, st, false);
    }

    /* --- porch or stoop --- */
    var porchMat = this.material('wood', { color: 0xb8ad97 });
    if (lot.porch === 'full' || lot.porch === 'wrap' || lot.porch === 'deck') {
      var pd = lot.porch === 'wrap' ? 2.4 : 2.0;
      var deck = G.box(w + (lot.porch === 'wrap' ? 1.6 : 0.4), 0.16, pd, TILE.wood);
      deck.translate(0, y0 - 0.16, d / 2 + pd / 2);
      batch.add('porchdeck', deck, porchMat, xf);
      /* posts and a shed roof over them */
      var pw = w + (lot.porch === 'wrap' ? 1.6 : 0.4);
      for (var pp = 0; pp <= 3; pp++) {
        var px = -pw / 2 + 0.25 + (pp / 3) * (pw - 0.5);
        var post = G.box(0.14, 2.32, 0.14);
        post.translate(px, y0, d / 2 + pd - 0.22);
        batch.add('trim', post, fasciaMat, xf);
      }
      var proof = G.box(pw + 0.3, 0.14, pd + 0.4, TILE.tile);
      proof.translate(0, y0 + 2.32, d / 2 + pd / 2 - 0.1);
      batch.add('shingle_' + lot.roofColor, proof,
        this.material('tile', {}), xf);
      /* steps down to the ground */
      for (var sN = 0; sN < 2; sN++) {
        var stp = G.box(1.5, 0.16, 0.32, TILE.concrete);
        stp.translate(0, y0 - 0.32 - sN * 0.16, d / 2 + pd + 0.16 + sN * 0.32);
        batch.add('foundation', stp, this.material('concrete', {}), xf);
      }
    } else {
      var stoop = G.box(2.0, found + 0.04, 1.2, TILE.concrete);
      stoop.translate(0, base, d / 2 + 0.6);
      batch.add('foundation', stoop, this.material('concrete', {}), xf);
      var step2 = G.box(1.6, found * 0.5, 0.34, TILE.concrete);
      step2.translate(0, base, d / 2 + 1.35);
      batch.add('foundation', step2, this.material('concrete', {}), xf);
    }

    /* --- chimney --- */
    if (lot.style !== 'trailer') {
      var ch = G.box(0.78, wallH + rise + 0.9, 0.62, TILE.brick);
      ch.translate(w * 0.26, y0, -d * 0.16);
      batch.add('brick', ch, this.material('brick', {}), xf);
      var cap = G.box(0.92, 0.1, 0.76, TILE.concrete);
      cap.translate(w * 0.26, y0 + wallH + rise + 0.9, -d * 0.16);
      batch.add('foundation', cap, this.material('concrete', {}), xf);
    }

    /* --- the condenser that runs all night in August --- */
    if (lot.features && lot.features.ac) {
      var ac = G.box(0.74, 0.72, 0.74);
      ac.translate(w / 2 + 0.5, y0 - found + 0.04, -d * 0.1);
      batch.add('metal_grey', ac, this.flat('acbody', 0x9aa0a0, 0.6, 0.35), xf);
      var fan = G.cyl(0.3, 0.3, 0.03, 12);
      fan.translate(w / 2 + 0.5, y0 - found + 0.78, -d * 0.1);
      batch.add('metal_dark', fan, this.flat('acfan', 0x3a3d3d, 0.5, 0.5), xf);
    }

    /* The dishes and the water tanks are built in the scatter pass now, off
       their own prop ids, so they sit where the errands say they sit. The
       version that used to be here read features.dish as a {x,y,r} and got a
       boolean, which made every one of its 4860 vertex positions NaN --
       invisible in the frame, and a console warning nobody reads. */

    /* --- the house number, on the trim by the door --- */
    if (!isHome) {
      var plaqueTex = G.signTexture([String(lot.number)],
        { w: 128, h: 64, bg: '#cfcabc', fg: '#2c2f2c', size: 42, border: null });
      var plaque = new T.Mesh(new T.PlaneGeometry(0.42, 0.21),
        new T.MeshStandardMaterial({ map: plaqueTex, roughness: 0.7 }));
      var pv = new T.Vector3(doorW / 2 + 0.28, y0 + 1.72, d / 2 + 0.07).applyMatrix4(xf);
      plaque.position.copy(pv);
      plaque.rotation.y = yaw;
      this.root.add(plaque);
    }

    return { base: base, wallH: wallH, yaw: yaw, w: w, d: d, front: front };
  };

  /* ================================================================== *
   *  everything that is not a house
   * ================================================================== */

  S.buildBuilding = function (batch, b) {
    var h = this.h;
    var cx = b.x + b.w / 2, cz = b.y + b.h / 2;
    var base = h(cx, cz);
    var storeys = b.storeys || 1;
    var wallH = b.open ? 2.5 : (b.civic ? 3.5 : 3.1) * storeys;
    var xf = G.mat4(cx, 0, cz, 0);
    var wallMat, wallKey;
    if (b.brick) { wallMat = this.material('brick', {}); wallKey = 'brick'; }
    else if (b.derelict) { wallMat = this.material('wood', { color: b.wall }); wallKey = 'derelictwall_' + b.wall; }
    else { wallMat = this.material('limewash', { color: b.wall }); wallKey = 'siding_' + b.wall; }

    if (b.ruin) {
      /* a foundation and two courses of block, and nothing else */
      var ring = [[-b.w / 2, -b.h / 2, b.w, 0.5], [-b.w / 2, b.h / 2 - 0.5, b.w, 0.5],
        [-b.w / 2, -b.h / 2, 0.5, b.h], [b.w / 2 - 0.5, -b.h / 2, 0.5, b.h]];
      for (var r = 0; r < ring.length; r++) {
        var seg = G.box(ring[r][2], 0.95, ring[r][3], TILE.stone);
        seg.translate(ring[r][0] + ring[r][2] / 2, base - 0.1, ring[r][1] + ring[r][3] / 2);
        batch.add('stone', seg, this.material('stone', {}), xf);
      }
      return;
    }

    if (b.framing) {
      /* the house going up on Elm Court: plates, studs, joists, one wall sheathed */
      var lum = this.material('wood', { color: 0xd8bd8a });
      var plate = G.box(b.w, 0.14, b.h, TILE.wood);
      plate.translate(0, base + 0.42, 0);
      batch.add('lumber', plate, lum, xf);
      var sN = Math.floor(b.w / 0.61);
      for (var s = 0; s <= sN; s++) {
        var sx = -b.w / 2 + s * 0.61;
        for (var edge = -1; edge <= 1; edge += 2) {
          var stud = G.box(0.09, 2.5, 0.14);
          stud.translate(sx, base + 0.56, edge * b.h / 2);
          batch.add('lumber', stud, lum, xf);
        }
      }
      var zN = Math.floor(b.h / 0.61);
      for (var z = 0; z <= zN; z++) {
        var zz = -b.h / 2 + z * 0.61;
        for (var e2 = -1; e2 <= 1; e2 += 2) {
          var stud2 = G.box(0.14, 2.5, 0.09);
          stud2.translate(e2 * b.w / 2, base + 0.56, zz);
          batch.add('lumber', stud2, lum, xf);
        }
      }
      var top = G.box(b.w, 0.14, b.h, TILE.wood);
      top.translate(0, base + 3.06, 0);
      batch.add('lumber', top, lum, xf);
      /* rafters */
      for (var rf = 0; rf <= 8; rf++) {
        var t = rf / 8 - 0.5;
        var raf = G.box(0.08, 0.2, Math.hypot(b.h / 2, 1.9) * 2);
        raf.rotateX(0.0);
        raf.translate(t * (b.w - 0.4), base + 3.2, 0);
        batch.add('lumber', raf, lum, xf);
      }
      /* one wall with OSB on it */
      var osb = G.box(b.w, 2.5, 0.012, TILE.wood);
      osb.translate(0, base + 0.56, -b.h / 2 - 0.08);
      batch.add('osb', osb, this.material('wood', { color: 0xc4a678 }), xf);
      return;
    }

    /* --- walls --- */
    var wg = G.box(b.w, wallH, b.h, b.brick ? TILE.brick : TILE.limewash);
    wg.translate(0, base, 0);
    if (!b.open) batch.add(wallKey, wg, wallMat, xf);

    /* --- roof --- */
    if (b.roof) {
      if (b.civic || b.units || b.open || b.w > 26) {
        /* a low commercial roof with a parapet */
        var flat = G.box(b.w + 0.5, 0.3, b.h + 0.5, TILE.concrete);
        flat.translate(0, base + wallH, 0);
        batch.add('flatroof', flat, this.flat('roofMembrane', 0x6e6f68, 0.94, 0), xf);
        if (!b.open) {
          var par = G.box(b.w + 0.7, 0.45, b.h + 0.7, b.brick ? TILE.brick : TILE.concrete);
          par.translate(0, base + wallH + 0.3, 0);
          batch.add('parapet', par, b.brick ? this.material('brick', {}) : this.material('concrete', {}), xf);
          var inner = G.box(b.w - 0.1, 0.5, b.h - 0.1);
          inner.translate(0, base + wallH + 0.3, 0);
          batch.add('flatroof', inner, this.flat('roofMembrane', 0x6e6f68, 0.94, 0), xf);
        }
      } else {
        var rise2 = Math.min(b.w, b.h) * 0.38;
        var gb2 = G.gable(b.w, b.h, rise2, 0.4, TILE.tile);
        gb2.roof.translate(0, base + wallH, 0);
        batch.add('shingle_' + b.roof, gb2.roof, this.material('tile', {}), xf);
        gb2.gables.translate(0, base + wallH, 0);
        batch.add(wallKey, gb2.gables, wallMat, xf);
      }
    }

    /* --- shop fronts: a band of glass and a door --- */
    if (!b.open && !b.derelict) {
      var glassH = b.kind === 'shop' ? 2.0 : 1.5;
      var trim = this.flat('shoptrim', 0x50544e, 0.6, 0.2);
      var frontZ = b.h / 2;
      var nBays = Math.max(2, Math.floor(b.w / 2.6));
      for (var bay = 0; bay < nBays; bay++) {
        var t2 = (bay + 0.5) / nBays - 0.5;
        var bx = t2 * (b.w - 1.0);
        if (Math.abs(bx) < 1.0) continue;                    /* leave the doorway */
        var fr2 = G.frame(2.0, glassH, 0.09, 0.14);
        fr2.translate(bx, base + 0.75, frontZ + 0.04);
        batch.add('shoptrim', fr2, trim, xf);
        var wp = new T.Vector3(bx, base + 0.75 + glassH / 2, frontZ + 0.03).applyMatrix4(xf);
        this.addPane(wp.x, wp.y, wp.z, 0, 1.92, glassH - 0.1,
          b.derelict ? 'derelict' : (b.alwaysLit ? 'always' : 'shop'));
      }
      var dw2 = G.frame(1.5, 2.25, 0.09, 0.16);
      dw2.translate(0, base + 0.02, frontZ + 0.05);
      batch.add('shoptrim', dw2, trim, xf);
      var dp = new T.Vector3(0, base + 1.2, frontZ + 0.04).applyMatrix4(xf);
      this.addPane(dp.x, dp.y, dp.z, 0, 1.32, 2.1, b.alwaysLit ? 'always' : 'shop');
    }

    /* --- the derelict ones have the roof coming in --- */
    if (b.derelict && b.collapsed) {
      var rng = new ER.RNG('ruin' + b.id);
      for (var raf2 = 0; raf2 < 9; raf2++) {
        var rt = raf2 / 8 - 0.5;
        var beam = G.box(0.12, 0.16, b.h * rng.float(0.5, 1.0));
        beam.rotateX(rng.float(-0.5, 0.5));
        beam.rotateZ(rng.float(-0.25, 0.25));
        beam.translate(rt * (b.w - 0.6), base + wallH * rng.float(0.2, 0.95), rng.float(-1, 1));
        batch.add('derelictwall_' + b.wall, beam, wallMat, xf);
      }
    }

    /* --- signage --- */
    if (b.sign) {
      var tex = G.signTexture([b.sign.text].concat(b.sub ? [b.sub] : []), {
        w: 1024, h: 256, bg: b.derelict ? '#8e887c' : '#f0ece0',
        fg: b.sign.color, size: b.sub ? 92 : 128, grunge: true, border: b.derelict ? null : '#33383a', borderW: 8
      });
      var signW = Math.min(b.w * 0.8, 9);
      var mesh = new T.Mesh(new T.PlaneGeometry(signW, signW * 0.25),
        new T.MeshStandardMaterial({ map: tex, roughness: 0.72, side: T.DoubleSide }));
      mesh.position.set(cx, base + wallH + 0.55, b.y + b.h / 2 + b.h / 2 + 0.06);
      mesh.position.z = b.y + b.h + 0.08;
      this.root.add(mesh);
      if (b.lit) this.signs = (this.signs || []).concat([{ mesh: mesh, alwaysLit: !!b.alwaysLit }]);
    }

    /* --- open shelters: posts and a roof --- */
    if (b.open) {
      var postMat = this.material('wood', { color: 0x8a7f6a });
      for (var px2 = -1; px2 <= 1; px2 += 2) {
        for (var pz2 = -1; pz2 <= 1; pz2 += 2) {
          var post2 = G.box(0.16, wallH, 0.16, TILE.wood);
          post2.translate(px2 * (b.w / 2 - 0.2), base, pz2 * (b.h / 2 - 0.2));
          batch.add('posts', post2, postMat, xf);
        }
      }
      if (b.id === 'busshelter') {
        /* three walls of scratched perspex and a bench */
        var bench = G.box(b.w - 0.5, 0.1, 0.4, TILE.wood);
        bench.translate(0, base + 0.42, -b.h / 2 + 0.3);
        batch.add('posts', bench, postMat, xf);
      }
    }

    /* --- the steeple --- */
    if (b.steeple) {
      var tower = G.box(3.0, wallH + 3.6, 3.0, TILE.limewash);
      tower.translate(0, base, b.h / 2 - 1.6);
      batch.add(wallKey, tower, wallMat, xf);
      var spire = new T.ConeGeometry(2.3, 5.2, 4);
      spire.rotateY(Math.PI / 4);
      spire.translate(0, base + wallH + 3.6 + 2.6, b.h / 2 - 1.6);
      batch.add('shingle_' + b.roof, spire, this.material('tile', {}), xf);
      var cross = G.box(0.1, 1.1, 0.1);
      cross.translate(0, base + wallH + 9.0, b.h / 2 - 1.6);
      batch.add('trim', cross, this.flat('fascia', 0xe4e0d4, 0.7, 0), xf);
      var cross2 = G.box(0.56, 0.1, 0.1);
      cross2.translate(0, base + wallH + 9.72, b.h / 2 - 1.6);
      batch.add('trim', cross2, this.flat('fascia', 0xe4e0d4, 0.7, 0), xf);
      /* tall windows down both sides */
      for (var cw2 = 0; cw2 < 4; cw2++) {
        var cz2 = (cw2 / 3 - 0.5) * (b.h - 6);
        for (var cs = -1; cs <= 1; cs += 2) {
          var cwp = new T.Vector3(cs * (b.w / 2 + 0.02), base + 2.4, cz2).applyMatrix4(xf);
          this.addPane(cwp.x, cwp.y, cwp.z, cs > 0 ? Math.PI / 2 : -Math.PI / 2, 0.9, 2.6, 'shop');
        }
      }
    }

    /* --- self-storage doors --- */
    if (b.units) {
      var rollMat = this.flat('rolldoor', 0xb8b4aa, 0.66, 0.35);
      for (var u = 0; u < b.units; u++) {
        var uw = b.w / b.units;
        var door = G.box(uw - 0.5, 2.3, 0.1);
        door.translate(-b.w / 2 + uw * (u + 0.5), base + 0.05, b.h / 2 + 0.06);
        batch.add('rolldoor', door, rollMat, xf);
      }
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
