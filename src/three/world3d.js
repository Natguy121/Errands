/* Errands — the ground of Hollis Bend, in three dimensions.
   Terrain, roads with painted lines and graded shoulders, the creek,
   the abandoned grade, the fields, and every pad of asphalt in town. */
(function (ER) {
  'use strict';
  var U = ER.U;
  var T = window.THREE;
  var G = ER.Geom;
  var M = ER.Mats;

  /* how many texture tiles fit in a metre, per surface */
  var TILE = {
    grass: 0.5, field: 0.16, asphalt: 0.26, gravel: 0.62, concrete: 0.4,
    dirt: 0.45, siding: 0.62, shingle: 0.9, brick: 1.33, wood: 0.5,
    stone: 0.55, rust: 0.6, bark: 0.9, water: 0.12
  };

  function Scene3D(town, clock) {
    this.town = town;
    this.clock = clock;
    this.root = new T.Group();
    this.root.name = 'hollisbend';
    this.h = function (x, z) { return town.heightAt(x, z); };
    this.mats = {};
    this.lamps = [];
    this.windows = [];
    this.interactables = [];
    this.raycastTargets = [];
  }

  Scene3D.prototype.material = function (name, opts) {
    var key = name + ':' + JSON.stringify(opts || {});
    if (!this.mats[key]) this.mats[key] = M.mat(name, opts || {});
    return this.mats[key];
  };

  Scene3D.prototype.flat = function (key, color, rough, metal, opts) {
    var k = 'flat:' + key;
    if (!this.mats[k]) this.mats[k] = M.flat(color, rough, metal, opts);
    return this.mats[k];
  };

  /* ================================================================== *
   *  terrain
   * ================================================================== */

  Scene3D.prototype.buildTerrain = function () {
    var town = this.town, h = this.h;
    var TILES = 10, SIZE = town.w / TILES, SEG = 30;
    var mat = this.material('grass', { repeat: 1 });
    mat.vertexColors = true;
    var nz = new ER.Noise(town.seed ^ 0x3b1);
    var group = new T.Group();
    group.name = 'terrain';

    /* broad colour regions, painted into vertex colours */
    function tintAt(x, z) {
      var c = new T.Color(1, 1, 1);
      var dry = nz.fbm(x / 180, z / 180, 3);
      c.setRGB(0.86 + dry * 0.26, 0.92 + dry * 0.16, 0.78 + dry * 0.1);
      var i;
      for (i = 0; i < town.woods.length; i++) {
        var w = town.woods[i];
        var inside = U.pointInRect(x, z, { x: w.x - 12, y: w.y - 12, w: w.w + 24, h: w.h + 24 });
        if (inside) { c.multiplyScalar(0.46); c.r *= 1.06; break; }
      }
      /* the pasture is grazed short and paler */
      for (i = 0; i < town.fields.length; i++) {
        var f = town.fields[i];
        if (f.crop === 'pasture' && U.pointInRect(x, z, f)) { c.multiplyScalar(1.04); c.b *= 0.94; }
      }
      return c;
    }

    for (var ty = 0; ty < TILES; ty++) {
      for (var tx = 0; tx < TILES; tx++) {
        var g = new T.PlaneGeometry(SIZE, SIZE, SEG, SEG);
        g.rotateX(-Math.PI / 2);
        var pos = g.attributes.position, uv = g.attributes.uv;
        var cols = new Float32Array(pos.count * 3);
        var ox = tx * SIZE + SIZE / 2, oz = ty * SIZE + SIZE / 2;
        for (var i = 0; i < pos.count; i++) {
          var wx = pos.getX(i) + ox, wz = pos.getZ(i) + oz;
          pos.setY(i, h(wx, wz));
          uv.setXY(i, wx * TILE.grass, wz * TILE.grass);
          var c = tintAt(wx, wz);
          cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
        }
        g.setAttribute('color', new T.BufferAttribute(cols, 3));
        g.computeVertexNormals();
        var mesh = new T.Mesh(g, mat);
        mesh.position.set(ox, 0, oz);
        mesh.receiveShadow = true;
        mesh.castShadow = false;
        mesh.name = 'terrain_' + tx + '_' + ty;
        group.add(mesh);
      }
    }
    this.root.add(group);
    this.terrainGroup = group;
  };

  /* ================================================================== *
   *  fields laid over the terrain
   * ================================================================== */

  Scene3D.prototype.buildFields = function () {
    var town = this.town, h = this.h;
    var batch = new G.Batch();
    var cropMat = {
      corn:    this.material('field', { color: 0xbba268 }),
      bean:    this.material('field', { color: 0x9c9a5e }),
      hay:     this.material('field', { color: 0x8a9a5c }),
      pasture: null,
      fallow:  this.material('dirt', { color: 0xb0a084 })
    };
    for (var i = 0; i < town.fields.length; i++) {
      var f = town.fields[i];
      if (!cropMat[f.crop]) continue;
      var segX = Math.max(2, Math.round(f.w / 14)), segZ = Math.max(2, Math.round(f.h / 14));
      var g = new T.PlaneGeometry(f.w, f.h, segX, segZ);
      g.rotateX(-Math.PI / 2);
      var pos = g.attributes.position, uv = g.attributes.uv;
      var cx = f.x + f.w / 2, cz = f.y + f.h / 2;
      for (var k = 0; k < pos.count; k++) {
        var wx = pos.getX(k) + cx, wz = pos.getZ(k) + cz;
        pos.setY(k, h(wx, wz) + 0.035);
        /* rows run with the field's own direction */
        if (f.dir === 0) uv.setXY(k, wx * TILE.field * 0.5, wz * TILE.field);
        else uv.setXY(k, wz * TILE.field * 0.5, wx * TILE.field);
      }
      g.computeVertexNormals();
      g.translate(cx, 0, cz);
      batch.add('field_' + f.crop, g, cropMat[f.crop]);
    }
    var meshes = batch.build(this.root, { castShadow: false });
    for (var m = 0; m < meshes.length; m++) meshes[m].receiveShadow = true;
  };

  /* ================================================================== *
   *  roads
   * ================================================================== */

  Scene3D.prototype.buildRoads = function () {
    var town = this.town, h = this.h, self = this;
    var batch = new G.Batch();
    var asphalt = this.material('asphalt', {});
    var gravel = this.material('gravel', {});
    var paint = this.flat('paintYellow', 0xd8b955, 0.82, 0);
    var paintW = this.flat('paintWhite', 0xd8d6cc, 0.82, 0);

    for (var i = 0; i < town.roads.length; i++) {
      var rd = town.roads[i];
      var pts = rd.pts.map(function (p) { return [p[0], p[1]]; });

      /* the graded shoulder, a touch lower than the surface */
      batch.add('shoulder', G.ribbon(pts, {
        height: h, width: rd.width + rd.shoulder * 2, lift: 0.012,
        step: 3.2, uvPerMetre: TILE.gravel
      }), gravel);

      /* the surface itself, crowned so water runs off */
      batch.add(rd.kind === 'asphalt' ? 'road_asphalt' : 'road_gravel', G.ribbon(pts, {
        height: h, width: rd.width, lift: 0.055, step: 2.2,
        uvPerMetre: rd.kind === 'asphalt' ? TILE.asphalt : TILE.gravel,
        crown: 0.055
      }), rd.kind === 'asphalt' ? asphalt : gravel);

      if (rd.bulb) {
        var bg = G.plane(rd.bulb.r * 2, rd.bulb.r * 2, TILE.asphalt, 10, 10);
        var bp = bg.attributes.position, bu = bg.attributes.uv;
        for (var b = 0; b < bp.count; b++) {
          var bx = bp.getX(b) + rd.bulb.x, bz = bp.getZ(b) + rd.bulb.y;
          var inside = U.dist(bx, bz, rd.bulb.x, rd.bulb.y) <= rd.bulb.r;
          bp.setY(b, h(bx, bz) + (inside ? 0.05 : 0.012));
          bu.setXY(b, bx * TILE.asphalt, bz * TILE.asphalt);
        }
        bg.computeVertexNormals();
        bg.translate(rd.bulb.x, 0, rd.bulb.y);
        batch.add('road_asphalt', bg, asphalt);
      }

      /* markings */
      if (rd.marks === 'center') {
        var d = G.dashes(pts, { height: h, width: 0.14, lift: 0.075, dash: 3.0, gap: 6.4 });
        if (d) batch.add('paint_y', d, paint);
        if (rd.id === 'main') {
          batch.add('paint_w', G.edgeLine(pts, rd.width / 2 - 0.35,
            { height: h, width: 0.12, lift: 0.075, step: 3, uvPerMetre: 0.5 }), paintW);
          batch.add('paint_w', G.edgeLine(pts, -(rd.width / 2 - 0.35),
            { height: h, width: 0.12, lift: 0.075, step: 3, uvPerMetre: 0.5 }), paintW);
        }
      }
    }

    /* the crosswalk by the school */
    for (var cw = 0; cw < 6; cw++) {
      var cx = 893 + cw * 1.6;
      var q = G.quad([cx, 0, 1126.4], [cx + 0.7, 0, 1126.4], [cx + 0.7, 0, 1133.6], [cx, 0, 1133.6], 0.5);
      var qp = q.attributes.position;
      for (var qi = 0; qi < qp.count; qi++) qp.setY(qi, h(qp.getX(qi), qp.getZ(qi)) + 0.075);
      q.computeVertexNormals();
      batch.add('paint_w', q, paintW);
    }

    batch.build(this.root, { castShadow: false });
  };

  /* ================================================================== *
   *  driveways, pads, sidewalks
   * ================================================================== */

  Scene3D.prototype.buildPads = function () {
    var town = this.town, h = this.h;
    var batch = new G.Batch();
    var mats = {
      asphalt: this.material('asphalt', {}),
      concrete: this.material('concrete', {}),
      gravel: this.material('gravel', {}),
      dirt: this.material('dirt', {})
    };
    var tiles = { asphalt: TILE.asphalt, concrete: TILE.concrete, gravel: TILE.gravel, dirt: TILE.dirt };
    var i;

    for (i = 0; i < town.lots.length; i++) {
      var dw = town.lots[i].driveway;
      batch.add('pad_' + dw.kind, G.ribbon([[dw.x0, dw.y0], [dw.x1, dw.y1]], {
        height: h, width: dw.w, lift: 0.048, step: 2, uvPerMetre: tiles[dw.kind]
      }), mats[dw.kind]);
    }
    /* your own front walk, and any other poured strip */
    for (i = 0; i < town.pavedStrips.length; i++) {
      var st = town.pavedStrips[i];
      batch.add('pad_' + st.kind, G.ribbon([[st.x0, st.y0], [st.x1, st.y1]], {
        height: h, width: st.w, lift: 0.048, step: 2, uvPerMetre: tiles[st.kind]
      }), mats[st.kind]);
    }

    /* the lots, aprons and walks, taken from the town so that terrainAt
       agrees with what is actually on the ground */
    for (i = 0; i < town.paving.length; i++) {
      var p = town.paving[i];
      var segX = Math.max(2, Math.round(p.w / 10)), segZ = Math.max(2, Math.round(p.h / 10));
      var g = new T.PlaneGeometry(p.w, p.h, segX, segZ);
      g.rotateX(-Math.PI / 2);
      var pos = g.attributes.position, uv = g.attributes.uv;
      var cx = p.x + p.w / 2, cz = p.y + p.h / 2;
      for (var k = 0; k < pos.count; k++) {
        var wx = pos.getX(k) + cx, wz = pos.getZ(k) + cz;
        pos.setY(k, h(wx, wz) + 0.05);
        uv.setXY(k, wx * tiles[p.kind], wz * tiles[p.kind]);
      }
      g.computeVertexNormals();
      g.translate(cx, 0, cz);
      batch.add('pad_' + p.kind, g, mats[p.kind]);
    }
    var built = batch.build(this.root, { castShadow: false });
    for (var m = 0; m < built.length; m++) built[m].receiveShadow = true;
  };

  /* ================================================================== *
   *  Little Fox Creek, and the pond
   * ================================================================== */

  Scene3D.prototype.buildWater = function () {
    var town = this.town, h = this.h;
    var creek = town.creek;
    var pts = creek.pts.map(function (p) { return [p[0], p[1]]; });

    /* the cut: mud banks stepping down to the water */
    var batch = new G.Batch();
    var mud = this.material('dirt', { color: 0x9a8b70 });
    batch.add('bank', G.ribbon(pts, { height: function (x, z) { return h(x, z) - 0.30; },
      width: creek.width + 7.0, lift: 0, step: 3, uvPerMetre: TILE.dirt }), mud);
    batch.add('bank', G.ribbon(pts, { height: function (x, z) { return h(x, z) - 0.72; },
      width: creek.width + 2.6, lift: 0, step: 2.4, uvPerMetre: TILE.dirt }), mud);
    var built = batch.build(this.root, { castShadow: false });
    for (var m = 0; m < built.length; m++) built[m].receiveShadow = true;

    /* the water. shallow, and you can see the bottom, which is the point. */
    var waterMaps = M.maps('water');
    var wmat = new T.MeshStandardMaterial({
      color: 0x4a6a70,
      normalMap: M.tex(waterMaps.normal, 1),
      roughness: 0.14,
      metalness: 0.06,
      transparent: true,
      opacity: 0.80
    });
    wmat.normalMap.repeat.set(1, 1);
    wmat.normalScale = new T.Vector2(0.55, 0.55);
    this.waterMat = wmat;

    var wgeo = G.ribbon(pts, { height: function (x, z) { return h(x, z) - 0.80; },
      width: creek.width, lift: 0, step: 2.2, uvPerMetre: TILE.water });
    var wmesh = new T.Mesh(wgeo, wmat);
    wmesh.name = 'creek';
    wmesh.receiveShadow = false;
    this.root.add(wmesh);

    /* the retaining pond */
    var pd = town.pond;
    var pg = new T.CircleGeometry(pd.r, 48);
    pg.rotateX(-Math.PI / 2);
    var ppos = pg.attributes.position, puv = pg.attributes.uv;
    var lowest = Infinity;
    for (var i = 0; i < ppos.count; i++) {
      var wx = ppos.getX(i) + pd.x, wz = ppos.getZ(i) + pd.y;
      lowest = Math.min(lowest, h(wx, wz));
    }
    for (var j = 0; j < ppos.count; j++) {
      ppos.setY(j, 0);
      puv.setXY(j, (ppos.getX(j) + pd.x) * TILE.water, (ppos.getZ(j) + pd.y) * TILE.water);
    }
    pg.computeVertexNormals();
    var pmesh = new T.Mesh(pg, wmat);
    pmesh.position.set(pd.x, lowest + 0.55, pd.y);
    pmesh.name = 'pond';
    this.root.add(pmesh);
    /* the mud bowl under it */
    var bowl = new T.CircleGeometry(pd.r + 5, 40);
    bowl.rotateX(-Math.PI / 2);
    var bpos = bowl.attributes.position, buv = bowl.attributes.uv;
    for (var b = 0; b < bpos.count; b++) {
      var bx = bpos.getX(b), bz = bpos.getZ(b);
      var dd = Math.sqrt(bx * bx + bz * bz);
      bpos.setY(b, -1.6 * Math.max(0, 1 - dd / (pd.r + 5)) + 0.2);
      buv.setXY(b, (bx + pd.x) * TILE.dirt, (bz + pd.y) * TILE.dirt);
    }
    bowl.computeVertexNormals();
    var bmesh = new T.Mesh(bowl, mud);
    bmesh.position.set(pd.x, lowest + 0.5, pd.y);
    bmesh.receiveShadow = true;
    this.root.add(bmesh);
    this.pondLevel = lowest + 0.55;
  };

  /* ================================================================== *
   *  the abandoned grade
   * ================================================================== */

  Scene3D.prototype.buildRail = function () {
    var town = this.town, h = this.h;
    var pts = town.rail.pts.map(function (p) { return [p[0], p[1]]; });
    var batch = new G.Batch();
    var ballast = this.material('gravel', { color: 0xa09689 });
    var tieMat = this.material('wood', { color: 0x6a5a48 });
    var railMat = this.material('rust', { color: 0xb0a49a, metalness: 0.55, roughness: 0.62 });

    /* the embankment, raised about half a metre above the ground */
    function grade(x, z) { return h(x, z) + 0.42; }
    batch.add('ballast', G.ribbon(pts, { height: function (x, z) { return h(x, z) + 0.06; },
      width: 11.5, lift: 0, step: 3, uvPerMetre: TILE.gravel }), ballast);
    batch.add('ballast', G.ribbon(pts, { height: grade, width: 7.0, lift: 0, step: 2.4,
      uvPerMetre: TILE.gravel }), ballast);

    /* ties, every 65 cm, rotted and uneven */
    var total = ER.poly.length(pts);
    var rng = new ER.RNG('ties');
    for (var s = 2; s < total; s += 0.66) {
      var p = ER.poly.pointAt(pts, s);
      var n = ER.poly.normal(pts, p.seg);
      var ang = Math.atan2(n.tx, n.ty);
      var tie = G.box(2.62, 0.17, 0.24, TILE.wood);
      var m = G.mat4(p.x, grade(p.x, p.y) + 0.02, p.y, -ang + rng.float(-0.03, 0.03));
      batch.add('ties', tie, tieMat, m);
    }

    /* the rails themselves */
    for (var side = -1; side <= 1; side += 2) {
      var line = [];
      var n2 = Math.ceil(total / 4);
      for (var i = 0; i <= n2; i++) {
        var q = ER.poly.pointAt(pts, (i / n2) * total);
        var nn = ER.poly.normal(pts, q.seg);
        line.push([q.x + nn.x * side * 0.717, q.y + nn.y * side * 0.717]);
      }
      batch.add('rails', G.ribbon(line, { height: function (x, z) { return grade(x, z) + 0.19; },
        width: 0.14, lift: 0, step: 4, uvPerMetre: 1 }), railMat);
      batch.add('rails', G.ribbon(line, { height: function (x, z) { return grade(x, z) + 0.10; },
        width: 0.08, lift: 0, step: 4, uvPerMetre: 1 }), railMat);
    }
    batch.build(this.root, {});
  };

  /* Flat-on-the-ground and hair-thin geometry costs a full pass through the
     shadow map and returns nothing you can see. */
  var NO_CAST = ['wires', 'gutter', 'trim', 'fascia', 'paint_y', 'paint_w', 'rails',
    'ties', 'grate', 'bins', 'tar', 'grain', 'porchdeck', 'barbwire', 'mbflag',
    'carlens', 'carlensR', 'signpost', 'clay', 'osb', 'picket', 'seat', 'rim',
    'board', 'mbpost', 'dish', 'antenna', 'flatroof', 'shoptrim'];

  Scene3D.prototype.pruneShadowCasters = function () {
    var n = 0;
    this.root.traverse(function (o) {
      if (o.isMesh && NO_CAST.indexOf(o.name) >= 0) { o.castShadow = false; n++; }
    });
    return n;
  };

  Scene3D.prototype.build = function () {
    this.buildTerrain();
    this.buildFields();
    this.buildRoads();
    this.buildPads();
    this.buildWater();
    this.buildRail();
    if (this.buildStructures) this.buildStructures();
    if (this.buildScatter) this.buildScatter();
    this.pruneShadowCasters();
    return this.root;
  };

  ER.Scene3D = Scene3D;
  ER.TILE = TILE;
})(window.ER = window.ER || {});
