/* Errands — the ground of the old quarter, in three dimensions.
   The rock shelf, the stone alleys and the stair that climbs out of the
   souk, the square, the quay, the Phoenician wall and the sea. */
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
    stone: 0.55, rust: 0.6, bark: 0.9, water: 0.12,
    /* the quarter's own surfaces. A fifty-metre world is looked at from close
       up, so these tile tighter than a township's did. */
    sandstone: 0.85, limewash: 0.7, tile: 1.1, flag: 0.6, sett: 0.9, sea: 0.06
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
    var mat = this.material('stone', { repeat: 1, color: 0xbfae92 });
    mat.vertexColors = true;
    var nz = new ER.Noise(town.seed ^ 0x3b1);
    var group = new T.Group();
    group.name = 'terrain';

    /* The shelf the quarter stands on, painted into vertex colours: bleached
       and grey where the sea gets at it, warmer and dustier inland. */
    function tintAt(x, z) {
      var c = new T.Color(1, 1, 1);
      var dry = nz.fbm(x / 9, z / 9, 3);
      c.setRGB(0.90 + dry * 0.20, 0.87 + dry * 0.18, 0.78 + dry * 0.16);
      /* salt-bleached within a few metres of the water */
      var salt = U.clamp(1 - (x - town.sea.edge) / 7, 0, 1);
      c.lerp(new T.Color(0.96, 0.95, 0.92), salt * 0.55);
      /* and below the water line it is dark wet rock */
      if (x < town.sea.edge) c.multiplyScalar(U.lerp(1.0, 0.42, U.clamp((town.sea.edge - x) / 2.5, 0, 1)));
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

  /* There are no fields. Fifty metres of old town is walls and paving, and
     the one bit of open ground is the square, which buildPads lays. */

  /* ================================================================== *
   *  roads
   * ================================================================== */

  Scene3D.prototype.buildRoads = function () {
    var town = this.town, h = this.h, self = this;
    var batch = new G.Batch();
    /* Alleys are stone setts, worn smooth down the middle. Nothing here has
       ever been painted, so there are no road markings at all. */
    var sett = this.material('stone', { color: 0xa89b84 });
    var tread = this.material('stone', { color: 0xb3a691 });

    for (var i = 0; i < town.roads.length; i++) {
      var rd = town.roads[i];
      var pts = rd.pts.map(function (p) { return [p[0], p[1]]; });

      /* the rough edge where the setts meet the wall */
      batch.add('verge', G.ribbon(pts, {
        height: h, width: rd.width + rd.shoulder * 2, lift: 0.008,
        step: 0.9, uvPerMetre: TILE.sett
      }), tread);

      /* the alley itself, very slightly crowned so the rain runs off it */
      batch.add(rd.steps ? 'alley_steps' : 'alley_stone', G.ribbon(pts, {
        height: h, width: rd.width, lift: 0.03, step: 0.55,
        uvPerMetre: rd.steps ? TILE.flag : TILE.sett,
        crown: 0.022
      }), rd.steps ? tread : sett);

    }

    /* No markings and no crosswalk. Nothing in the quarter has ever been
       painted, and a stone alley two metres wide has no centre to mark. */

    batch.build(this.root, { castShadow: false });
  };

  /* ================================================================== *
   *  driveways, pads, sidewalks
   * ================================================================== */

  Scene3D.prototype.buildPads = function () {
    var town = this.town, h = this.h;
    var batch = new G.Batch();
    /* flag: the square, laid in big slabs. quay: the promenade along the
       wall. slip: the concrete slipway the boats come up. */
    var mats = {
      flag: this.material('stone', { color: 0xb8ab94 }),
      quay: this.material('stone', { color: 0xada08a }),
      slip: this.material('concrete', { color: 0x9e988c }),
      stone: this.material('stone', { color: 0xa89b84 })
    };
    var tiles = { flag: TILE.flag, quay: TILE.sett, slip: TILE.concrete, stone: TILE.sett };
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
    var batch = new G.Batch();

    /* The sea. One large plane at the water line, running well past the west
       edge of the world so there is no visible end to it, and a darker band
       of wet rock where it meets the shelf. */
    var sea = this.material('water', { color: 0x2d5f70, roughness: 0.14, metalness: 0.28 });
    var SEA_W = 420, SEA_H = 420;
    var g = new T.PlaneGeometry(SEA_W, SEA_H, 40, 40);
    g.rotateX(-Math.PI / 2);
    var pos = g.attributes.position, uv = g.attributes.uv;
    var cx = town.sea.edge - SEA_W / 2 + 2.0, cz = town.h / 2;
    for (var k = 0; k < pos.count; k++) {
      var wx = pos.getX(k) + cx, wz = pos.getZ(k) + cz;
      pos.setY(k, town.sea.level);
      uv.setXY(k, wx * TILE.sea, wz * TILE.sea);
    }
    g.computeVertexNormals();
    g.translate(cx, 0, cz);
    batch.add('sea', g, sea);

    /* the wet band: rock the swell keeps dark, just seaward of the wall */
    var wet = this.material('stone', { color: 0x4c4a42, roughness: 0.32 });
    var wpts = [];
    for (var y = -2; y <= town.h + 2; y += 2) wpts.push([town.sea.edge - 0.9, y]);
    batch.add('wetrock', G.ribbon(wpts, {
      height: function (x, z) { return h(x, z) + 0.02; },
      width: 2.6, lift: 0, step: 2, uvPerMetre: TILE.stone
    }), wet);

    var built = batch.build(this.root, { castShadow: false });
    for (var m = 0; m < built.length; m++) built[m].receiveShadow = false;
    this.seaMesh = this.root.getObjectByName('sea');
  };

  /* ================================================================== *
   *  the abandoned grade
   * ================================================================== */

  /* There is no railway. The nearest track is up the coast and out of the
     world. buildRail is kept as a no-op so the build list reads the same. */
  Scene3D.prototype.buildRail = function () {};

  Scene3D.prototype.pruneShadowCasters = function () {
    var n = 0;
    this.root.traverse(function (o) {
      if (o.isMesh && NO_CAST.indexOf(o.name) >= 0) { o.castShadow = false; n++; }
    });
    return n;
  };

  Scene3D.prototype.build = function () {
    this.buildTerrain();
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
