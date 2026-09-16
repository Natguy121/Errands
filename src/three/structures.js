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
      emissive: new T.Color(0xffd9a0), emissiveIntensity: 1.0,
      vertexColors: true
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
    batch.add('foundation', fg, this.material('concrete', { color: 0xb6b2a6 }), xf);

    /* --- walls --- */
    var wallMat = this.material('siding', { color: lot.siding, roughness: 0.85 });
    var wallKey = 'siding_' + lot.siding;
    var wg = G.box(w, wallH, d, TILE.siding);
    wg.translate(0, y0, 0);
    batch.add(wallKey, wg, wallMat, xf);
    if (lot.skirt) {
      var sk = G.box(w + 0.05, found, d + 0.05, TILE.wood);
      sk.translate(0, base, 0);
      batch.add('skirt', sk, this.material('wood', { color: 0x8e8a80 }), xf);
    }

    /* --- roof --- */
    var rise = Math.min(w, d) * 0.42;
    var gb = G.gable(w, d, rise, 0.5, TILE.shingle);
    gb.roof.translate(0, y0 + wallH, 0);
    batch.add('shingle_' + lot.roofColor, gb.roof,
      this.material('shingle', { color: lot.roofColor, roughness: 0.95 }), xf);
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
      var proof = G.box(pw + 0.3, 0.14, pd + 0.4, TILE.shingle);
      proof.translate(0, y0 + 2.32, d / 2 + pd / 2 - 0.1);
      batch.add('shingle_' + lot.roofColor, proof,
        this.material('shingle', { color: lot.roofColor }), xf);
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

    /* --- the satellite dish, still pointed where the installer left it --- */
    if (lot.features && lot.features.dish) {
      var dr = lot.features.dish.r + 0.12;
      var arm = G.cyl(0.035, 0.035, 0.7, 6);
      arm.rotateZ(0.5);
      arm.translate(w / 2 - 0.5, y0 + wallH + 0.25, d / 2 - 0.35);
      batch.add('metal_grey', arm, this.flat('dishArm', 0x8d8d86, 0.55, 0.4), xf);
      var dish = new T.SphereGeometry(dr, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.32);
      dish.rotateX(Math.PI * 0.62);
      dish.translate(w / 2 - 0.16, y0 + wallH + 0.62, d / 2 - 0.2);
      batch.add('dish', dish, this.flat('dishFace', 0xd8d6cc, 0.5, 0.1,
        { side: T.DoubleSide }), xf);
    }

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
    else { wallMat = this.material('siding', { color: b.wall }); wallKey = 'siding_' + b.wall; }

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
    var wg = G.box(b.w, wallH, b.h, b.brick ? TILE.brick : TILE.siding);
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
        var gb2 = G.gable(b.w, b.h, rise2, 0.4, TILE.shingle);
        gb2.roof.translate(0, base + wallH, 0);
        batch.add('shingle_' + b.roof, gb2.roof, this.material('shingle', { color: b.roof }), xf);
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
      var tower = G.box(3.0, wallH + 3.6, 3.0, TILE.siding);
      tower.translate(0, base, b.h / 2 - 1.6);
      batch.add(wallKey, tower, wallMat, xf);
      var spire = new T.ConeGeometry(2.3, 5.2, 4);
      spire.rotateY(Math.PI / 4);
      spire.translate(0, base + wallH + 3.6 + 2.6, b.h / 2 - 1.6);
      batch.add('shingle_' + b.roof, spire, this.material('shingle', { color: 0x4f4b44 }), xf);
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
    var steel = this.flat('steel', 0xa8ada8, 0.48, 0.72);
    var steelDark = this.flat('steelDark', 0x6e7370, 0.55, 0.65);
    var concrete = this.material('concrete', {});
    var stone = this.material('stone', {});
    var i;

    /* ---- the water tower ---- */
    var wt = town.watertower;
    var wtB = h(wt.x, wt.y);
    var legs = [[-8, 9], [8, 9], [-8, -7], [8, -7]];
    for (i = 0; i < legs.length; i++) {
      var lg = G.cyl(0.22, 0.28, 17, 8);
      lg.translate(wt.x + legs[i][0], wtB, wt.y + legs[i][1]);
      batch.add('steel', lg, steel);
      /* a strut back to the middle */
      var st = G.cyl(0.08, 0.08, 11.5, 5);
      st.rotateZ(Math.atan2(legs[i][0], 9) * 0.9);
      st.rotateY(Math.atan2(legs[i][1], legs[i][0]));
      st.translate(wt.x + legs[i][0] * 0.5, wtB + 4, wt.y + legs[i][1] * 0.5);
      batch.add('steel', st, steelDark);
    }
    var bowlG = new T.CylinderGeometry(wt.r, wt.r * 0.92, 8.5, 24, 1, false);
    bowlG.translate(wt.x, wtB + 17 + 4.25, wt.y);
    batch.add('towerTank', bowlG, this.flat('tank', 0xc2c6c2, 0.52, 0.5));
    var domeT = new T.SphereGeometry(wt.r * 0.96, 24, 8, 0, 6.2832, 0, Math.PI * 0.42);
    domeT.translate(wt.x, wtB + 17 + 8.5, wt.y);
    batch.add('towerTank', domeT, this.flat('tank', 0xc2c6c2, 0.52, 0.5));
    var domeB = new T.SphereGeometry(wt.r * 0.9, 24, 8, 0, 6.2832, Math.PI * 0.58, Math.PI * 0.42);
    domeB.translate(wt.x, wtB + 17, wt.y);
    batch.add('towerTank', domeB, this.flat('tank', 0xb4b8b4, 0.55, 0.5));
    /* the ladder you are told not to climb, and its cage */
    for (var rung = 0; rung < 42; rung++) {
      var rg = G.box(0.52, 0.035, 0.035);
      rg.translate(wt.x - 8.4, wtB + 0.4 + rung * 0.4, wt.y + 9.3);
      batch.add('steel', rg, steelDark);
    }
    for (var rail = -1; rail <= 1; rail += 2) {
      var rl = G.cyl(0.03, 0.03, 17, 4);
      rl.translate(wt.x - 8.4 + rail * 0.26, wtB + 0.4, wt.y + 9.3);
      batch.add('steel', rl, steelDark);
    }
    var catwalk = new T.TorusGeometry(wt.r + 0.35, 0.05, 5, 28);
    catwalk.rotateX(Math.PI / 2);
    catwalk.translate(wt.x, wtB + 17.6, wt.y);
    batch.add('steel', catwalk, steelDark);
    /* HOLLIS BEND, painted on */
    var wtTex = G.signTexture(['HOLLIS BEND'], { w: 1024, h: 256, bg: '#00000000',
      fg: '#5d6a72', size: 150, grunge: false });
    var wtMat = new T.MeshStandardMaterial({ map: wtTex, transparent: true, roughness: 0.62 });
    var wtCan = document.createElement('canvas'); wtCan.width = 1024; wtCan.height = 256;
    var wtc = wtCan.getContext('2d');
    wtc.clearRect(0, 0, 1024, 256);
    wtc.fillStyle = '#5a6770'; wtc.textAlign = 'center'; wtc.textBaseline = 'middle';
    wtc.font = '700 150px "Helvetica Neue", Arial, sans-serif';
    wtc.fillText('HOLLIS BEND', 512, 136);
    var wtT2 = new T.CanvasTexture(wtCan); wtT2.colorSpace = T.SRGBColorSpace;
    wtMat.map = wtT2;
    for (var face = 0; face < 2; face++) {
      var band = new T.Mesh(new T.PlaneGeometry(wt.r * 1.75, wt.r * 0.44), wtMat);
      band.position.set(wt.x + (face ? 0 : 0), wtB + 21.4, wt.y + (face ? wt.r * 0.99 : -wt.r * 0.99));
      band.rotation.y = face ? 0 : Math.PI;
      this.root.add(band);
    }

    /* ---- the cell tower on the ridge ---- */
    var ct = town.celltower, ctB = h(ct.x, ct.y);
    var H = 34;
    for (var leg = 0; leg < 3; leg++) {
      var a = (leg / 3) * 6.2832;
      var lx = Math.cos(a) * 1.9, lz = Math.sin(a) * 1.9;
      var mast = G.cyl(0.10, 0.18, H, 5);
      mast.rotateZ(-Math.atan2(lx, H) * 0.5);
      mast.rotateY(-a);
      mast.translate(ct.x + lx, ctB, ct.y + lz);
      batch.add('steel', mast, steel);
    }
    for (var brace = 0; brace < 22; brace++) {
      var by = ctB + 1 + brace * 1.5;
      var ring = new T.TorusGeometry(1.75 * (1 - brace / 40), 0.035, 4, 3);
      ring.rotateX(Math.PI / 2);
      ring.translate(ct.x, by, ct.y);
      batch.add('steel', ring, steelDark);
    }
    for (var ant = 0; ant < 6; ant++) {
      var aa = (ant / 6) * 6.2832;
      var pan = G.box(0.26, 1.5, 0.12);
      pan.translate(ct.x + Math.cos(aa) * 2.3, ctB + H - 3.6, ct.y + Math.sin(aa) * 2.3);
      batch.add('antenna', pan, this.flat('antenna', 0xd0d2cc, 0.6, 0.2));
    }
    var beaconGeo = new T.SphereGeometry(0.3, 8, 6);
    beaconGeo.translate(ct.x, ctB + H + 0.4, ct.y);
    this.beacon = new T.Mesh(beaconGeo, new T.MeshStandardMaterial({
      color: 0x501010, emissive: new T.Color(0xff2a18), emissiveIntensity: 2, roughness: 0.4 }));
    this.root.add(this.beacon);

    /* ---- the co-op silos ---- */
    for (i = 0; i < town.silos.length; i++) {
      var si = town.silos[i], sB = h(si.x, si.y);
      var body = G.cyl(si.r, si.r, 19, 20, 0.22);
      body.translate(si.x, sB, si.y);
      batch.add('siloBody', body, this.flat('silo', 0xb9bcb6, 0.6, 0.45));
      var cone = new T.ConeGeometry(si.r + 0.2, 3.2, 20);
      cone.translate(si.x, sB + 19 + 1.6, si.y);
      batch.add('siloBody', cone, this.flat('silo', 0xa8aca6, 0.6, 0.45));
      /* the corrugation, as rings */
      for (var ring2 = 0; ring2 < 12; ring2++) {
        var rr = new T.TorusGeometry(si.r + 0.04, 0.045, 4, 20);
        rr.rotateX(Math.PI / 2);
        rr.translate(si.x, sB + 0.8 + ring2 * 1.55, si.y);
        batch.add('siloBody', rr, this.flat('siloRing', 0x9ea29c, 0.62, 0.5));
      }
    }
    /* the elevator leg between them */
    var legBox = G.box(1.6, 24, 1.6, TILE.rust);
    legBox.translate(1588, h(1588, 1250), 1250);
    batch.add('steelRust', legBox, this.material('rust', { metalness: 0.4, roughness: 0.7 }));

    /* ---- the bridges ---- */
    var bc = town.bridges.concrete;
    var bcB = h(bc.x, bc.y);
    for (var side2 = -1; side2 <= 1; side2 += 2) {
      var parapet = G.box(bc.w + 2, 0.95, 0.34, TILE.concrete);
      parapet.translate(bc.x, bcB + 0.06, bc.y + side2 * (bc.h / 2));
      batch.add('concrete', parapet, concrete);
      for (var post3 = 0; post3 <= 4; post3++) {
        var pst = G.box(0.4, 1.05, 0.46, TILE.concrete);
        pst.translate(bc.x - bc.w / 2 + (post3 / 4) * bc.w, bcB + 0.06, bc.y + side2 * (bc.h / 2));
        batch.add('concrete', pst, concrete);
      }
      /* the abutment wall going down to the water */
      var wall2 = G.box(bc.w + 1, 3.4, 0.5, TILE.concrete);
      wall2.translate(bc.x, bcB - 3.4, bc.y + side2 * (bc.h / 2 + 0.1));
      batch.add('concrete', wall2, concrete);
    }
    var deckSlab = G.box(bc.w + 1.4, 0.55, bc.h + 0.4, TILE.concrete);
    deckSlab.translate(bc.x, bcB - 0.55, bc.y);
    batch.add('concrete', deckSlab, concrete);

    /* the old stone bridge on County Road 9: one arch, mossy */
    var bs = town.bridges.stone, bsB = h(bs.x, bs.y);
    for (var s2 = -1; s2 <= 1; s2 += 2) {
      var par2 = G.box(bs.w + 2.4, 0.82, 0.42, TILE.stone);
      par2.translate(bs.x, bsB + 0.05, bs.y + s2 * (bs.h / 2));
      batch.add('stone', par2, stone);
      /* the arch ring, as voussoirs */
      for (var v = 0; v <= 12; v++) {
        var th = Math.PI * (v / 12);
        var vx = bs.x - Math.cos(th) * (bs.w / 2 + 0.4);
        var vy = bsB - 0.6 - Math.sin(th) * 2.4;
        var vs = G.box(1.0, 0.7, 0.5, TILE.stone);
        vs.rotateZ(-th + Math.PI / 2);
        vs.translate(vx, vy, bs.y + s2 * (bs.h / 2));
        batch.add('stone', vs, stone);
      }
      var wing = G.box(3.2, 3.2, 0.5, TILE.stone);
      wing.translate(bs.x - bs.w / 2 - 1.2, bsB - 3.2, bs.y + s2 * (bs.h / 2));
      batch.add('stone', wing, stone);
    }
    var bsDeck = G.box(bs.w + 1.2, 0.6, bs.h + 0.3, TILE.stone);
    bsDeck.translate(bs.x, bsB - 0.6, bs.y);
    batch.add('stone', bsDeck, stone);

    /* ---- the Bend Mart canopy and pumps ---- */
    var canB = h(1050, 962);
    var canopy = G.box(15, 0.5, 9, TILE.concrete);
    canopy.translate(1050, canB + 4.7, 962);
    batch.add('canopy', canopy, this.flat('canopy', 0xe8e5da, 0.5, 0.1));
    var canopyBand = G.box(15.3, 0.7, 9.3);
    canopyBand.translate(1050, canB + 4.3, 962);
    batch.add('canopyBand', canopyBand, this.flat('canopyBand', 0xb8452f, 0.55, 0.05));
    for (var cpost = -1; cpost <= 1; cpost += 2) {
      var cp = G.cyl(0.24, 0.24, 4.4, 8);
      cp.translate(1050 + cpost * 5.6, canB, 962);
      batch.add('canopy', cp, this.flat('canopy', 0xe8e5da, 0.5, 0.1));
    }
    for (var pump = -1; pump <= 1; pump += 2) {
      var island = G.box(4.4, 0.18, 1.5, TILE.concrete);
      island.translate(1050 + pump * 3.2, canB + 0.04, 962);
      batch.add('concrete', island, concrete);
      var pbody = G.box(1.1, 1.75, 0.62);
      pbody.translate(1050 + pump * 3.2, canB + 0.22, 962);
      batch.add('pump', pbody, this.flat('pumpBody', 0xd9d6cc, 0.5, 0.15));
      var phead = G.box(1.15, 0.5, 0.66);
      phead.translate(1050 + pump * 3.2, canB + 1.97, 962);
      batch.add('pumpHead', phead, this.flat('pumpHead', 0x2c3138, 0.42, 0.3));
    }

    /* ---- the ballfield backstop ---- */
    var bsX = 992, bsZ = 1252, bbB = h(bsX, bsZ);
    for (var bp = 0; bp <= 6; bp++) {
      var ang2 = -0.2 + (bp / 6) * 1.9;
      var pxx = bsX + Math.cos(ang2) * 11, pzz = bsZ + Math.sin(ang2) * 11;
      var bpost = G.cyl(0.08, 0.08, 4.2, 6);
      bpost.translate(pxx, h(pxx, pzz), pzz);
      batch.add('steelGalv', bpost, this.flat('galv', 0x9ea3a0, 0.5, 0.7));
    }
    /* the mesh itself, as a transparent plane */
    var meshTex = this.chainlinkTexture();
    for (var mseg = 0; mseg < 6; mseg++) {
      var a1 = -0.2 + (mseg / 6) * 1.9, a2 = -0.2 + ((mseg + 1) / 6) * 1.9;
      var x1 = bsX + Math.cos(a1) * 11, z1 = bsZ + Math.sin(a1) * 11;
      var x2 = bsX + Math.cos(a2) * 11, z2 = bsZ + Math.sin(a2) * 11;
      var len = U.dist(x1, z1, x2, z2);
      var panel = new T.Mesh(new T.PlaneGeometry(len, 4.0), meshTex);
      panel.position.set((x1 + x2) / 2, h((x1 + x2) / 2, (z1 + z2) / 2) + 2.0, (z1 + z2) / 2);
      panel.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
      this.root.add(panel);
    }

    /* ---- the framed-up flagpole, the hoops, the porta-john ---- */
    var fp = G.cyl(0.07, 0.09, 8.5, 8);
    fp.translate(844, h(844, 1166), 1166);
    batch.add('steelGalv', fp, this.flat('galv', 0x9ea3a0, 0.5, 0.7));
    var pj = G.box(1.2, 2.3, 1.2);
    pj.translate(1176, h(1176, 1238), 1238);
    batch.add('portajohn', pj, this.flat('pj', 0x4a6a58, 0.7, 0));
  };

  /* chain link, as an alpha-tested texture */
  S.chainlinkTexture = function () {
    if (this._chain) return this._chain;
    var cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    var c = cv.getContext('2d');
    c.clearRect(0, 0, 64, 64);
    c.strokeStyle = 'rgba(170,176,172,0.95)';
    c.lineWidth = 2.2;
    for (var i = -64; i < 128; i += 12) {
      c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 64, 64); c.stroke();
      c.beginPath(); c.moveTo(i + 64, 0); c.lineTo(i, 64); c.stroke();
    }
    /* same black-fringe problem as the grass: bleed the wire colour outward */
    ER.Mats.bleedAlpha(cv, '#aab0ac');
    var t = new T.CanvasTexture(cv);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.repeat.set(14, 5);
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 8;
    this._chain = new T.MeshStandardMaterial({
      map: t, transparent: true, alphaTest: 0.35, side: T.DoubleSide,
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
    for (i = 0; i < this.town.lots.length; i++) this.buildHouse(batch, this.town.lots[i], false);

    /* your rental, which is a lot like the others */
    var home = this.town.home;
    this.buildHouse(batch, {
      id: '__home', house: home.house, siding: home.siding, roofColor: home.roofColor,
      storeys: 1, style: 'cottage', porch: 'full', skirt: false, number: home.number,
      nx: 0, ny: 1, features: { ac: { x: 0, y: 0 } }
    }, true);

    for (i = 0; i < this.town.buildings.length; i++) this.buildBuilding(batch, this.town.buildings[i]);
    this.buildLandmarks(batch);
    batch.build(this.root, {});
    this.buildPanes();
  };
})(window.ER = window.ER || {});
