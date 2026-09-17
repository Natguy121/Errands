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

  /* The quarter is one block of a town, not an island. Looking east down the
     souk you can see past x=50, and without this there is nothing there: the
     ground simply stops and the sky shows under the horizon. So the shelf gets
     a skirt out to a hundred and fifty metres, and the rest of the quarter
     gets suggested by roof shapes beyond the edges -- near enough to read as
     more town, far enough that you never walk into them. */
  Scene3D.prototype.buildSurrounds = function () {
    var town = this.town, h = this.h;
    var batch = new G.Batch();
    var ground = this.material('stone', { color: 0xa2967f });
    var i;

    /* the skirt: eight coarse tiles around the world, sampling the shelf at
       its edge so there is no seam where they meet */
    var W = town.w, H2 = town.h, OUT = 150;
    var ring = [
      [-OUT, -OUT, OUT, OUT + H2 + OUT], [W, -OUT, OUT, OUT + H2 + OUT],
      [0, -OUT, W, OUT], [0, H2, W, OUT]
    ];
    for (i = 0; i < ring.length; i++) {
      var r = ring[i];
      var g = new T.PlaneGeometry(r[2], r[3], 8, 8);
      g.rotateX(-Math.PI / 2);
      var pos = g.attributes.position, uv = g.attributes.uv;
      var cx = r[0] + r[2] / 2, cz = r[1] + r[3] / 2;
      for (var k = 0; k < pos.count; k++) {
        var wx = pos.getX(k) + cx, wz = pos.getZ(k) + cz;
        pos.setY(k, h(wx, wz) - 0.05);
        uv.setXY(k, wx * 0.08, wz * 0.08);
      }
      g.computeVertexNormals();
      g.translate(cx, 0, cz);
      batch.add('skirt', g, ground);
    }

    /* and the rest of the quarter, as roofs */
    var rng = new ER.RNG('surrounds');
    var wall = this.material('limewash', { color: '#e0d3ba' });
    var tile = this.material('tile', {});
    for (i = 0; i < 46; i++) {
      var side = rng.int(0, 2);
      var bx, bz;
      if (side === 0) { bx = rng.float(W + 6, W + 70); bz = rng.float(-30, H2 + 30); }
      else if (side === 1) { bx = rng.float(8, W + 40); bz = rng.float(-70, -6); }
      else { bx = rng.float(8, W + 40); bz = rng.float(H2 + 6, H2 + 70); }
      var bw = rng.float(5, 11), bd = rng.float(5, 11);
      var bh = rng.float(3.2, 8.5);
      var base = h(bx, bz);
      var body = G.box(bw, bh, bd, 0.7);
      body.translate(bx, base, bz);
      batch.add('surroundwall', body, wall);
      var roof = G.gable(bw, bd, rng.float(0.9, 1.7), 0.4, 1.1);
      var rm = G.mat4(bx, base + bh, bz, rng.chance(0.5) ? 0 : Math.PI / 2);
      batch.add('surroundroof', roof.roof, tile, rm);
    }

    var built = batch.build(this.root, { castShadow: false });
    for (var m = 0; m < built.length; m++) built[m].receiveShadow = false;
  };

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
        height: h, width: rd.width + rd.shoulder * 2, lift: 0.022,
        step: 0.9, uvPerMetre: TILE.sett
      }), tread);

      /* the alley itself, very slightly crowned so the rain runs off it */
      batch.add(rd.steps ? 'alley_steps' : 'alley_stone', G.ribbon(pts, {
        height: h, width: rd.width, lift: 0.04, step: 0.55,
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

    /* No driveways. Nobody in the quarter can get a car within thirty metres
       of their own door, which is why there is one Mercedes parked where the
       souk gives out and a moped leaning on a wall. */
    /* your own front walk, and any other poured strip */
    for (i = 0; i < town.pavedStrips.length; i++) {
      var st = town.pavedStrips[i];
      batch.add('pad_' + st.kind, G.ribbon([[st.x0, st.y0], [st.x1, st.y1]], {
        height: h, width: st.w, lift: 0.048, step: 2, uvPerMetre: tiles[st.kind]
      }), mats[st.kind]);
    }

    /* The apron: everything inland of the quay, paved in setts. The quarter
       had sandy ground showing between the alleys and the walls, which made
       the souk read as a track across a field rather than a street. Kept
       lower than the alley ribbons so those still draw over it. */
    var aw = town.w - town.apron, STEP = 0.5;
    var apron = new T.PlaneGeometry(aw, town.h, Math.round(aw / STEP), Math.round(town.h / STEP));
    apron.rotateX(-Math.PI / 2);
    (function () {
      var acx = town.apron + aw / 2, acz = town.h / 2;
      var pos = apron.attributes.position, uv = apron.attributes.uv;
      for (var k = 0; k < pos.count; k++) {
        var wx = pos.getX(k) + acx, wz = pos.getZ(k) + acz;
        /* The terrain under this is sampled every sixteen centimetres and the
           paving every fifty, so on a slope the ground pokes up between the
           paving's vertices — which is exactly how the bare shelf came back
           through the flags of the square in green patches. Sit each vertex
           on the highest ground it spans, and a hair above that. */
        var top = h(wx, wz);
        for (var sx = -1; sx <= 1; sx++) {
          for (var sz = -1; sz <= 1; sz++) {
            var t = h(wx + sx * STEP * 0.5, wz + sz * STEP * 0.5);
            if (t > top) top = t;
          }
        }
        pos.setY(k, top + 0.02);
        uv.setXY(k, wx * TILE.sett, wz * TILE.sett);
      }
      apron.computeVertexNormals();
      apron.translate(acx, 0, acz);
    })();
    batch.add('apron', apron, mats.stone);

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
    /* There is no environment map in this renderer, so metalness is pure
       loss — a smooth metal with nothing to reflect is black. The colour
       has to come from the tint and the sky light instead. */
    var sea = this.material('water', { color: 0x2f6c80, roughness: 0.2, metalness: 0.04 });
    sea.emissive = new T.Color(0x0a2027);   /* the swell is never quite dark */
    sea.emissiveIntensity = 1;
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
    this.buildSurrounds();
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
