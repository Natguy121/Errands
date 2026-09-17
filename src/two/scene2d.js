/* Errands — the quarter, drawn from above.
 *
 * Everything here is vectors and patterns on a 2D context. There are no
 * models and no textures on disk: the stone, the setts, the flags and the
 * water are small noise tiles generated at load and used as repeating
 * patterns in world space, so they stay the right size in metres however far
 * you zoom in.
 *
 * The world it draws is exactly the world the errands talk about — the same
 * alley polylines, the same footprints, the same 225 props — so anything you
 * can see you can walk to, and anything an errand names is on the screen
 * somewhere.
 */
(function (ER) {
  'use strict';
  var U = ER.U;

  /* pixels to the metre inside a pattern tile */
  var PPT = 32;

  /* ------------------------------------------------------------------ *
   *  the surfaces, as tiling patterns
   * ------------------------------------------------------------------ */

  function tile(px, paint) {
    var cv = document.createElement('canvas');
    cv.width = cv.height = px;
    paint(cv.getContext('2d'), px);
    return cv;
  }

  /* speckle, wrapped so the tile has no seam */
  function speckle(c, px, rng, n, cols, rMin, rMax) {
    for (var i = 0; i < n; i++) {
      var x = rng.float(0, px), y = rng.float(0, px), r = rng.float(rMin, rMax);
      c.fillStyle = rng.pick(cols);
      for (var wx = -1; wx <= 1; wx++) {
        for (var wy = -1; wy <= 1; wy++) {
          c.beginPath();
          c.arc(x + wx * px, y + wy * px, r, 0, 6.2832);
          c.fill();
        }
      }
    }
  }

  /* a course of blocks, offset every other row, joints raked out */
  function coursed(c, px, rng, base, joint, rowH, colW, jitter) {
    c.fillStyle = base;
    c.fillRect(0, 0, px, px);
    c.strokeStyle = joint;
    c.lineWidth = 1;
    var rows = Math.round(px / rowH);
    for (var r = 0; r < rows; r++) {
      var y = (r / rows) * px;
      c.beginPath(); c.moveTo(0, y); c.lineTo(px, y); c.stroke();
      var off = (r % 2) * colW * 0.5;
      for (var x = off; x < px + colW; x += colW) {
        var xx = x + rng.float(-jitter, jitter);
        c.beginPath(); c.moveTo(xx, y); c.lineTo(xx, y + px / rows); c.stroke();
      }
    }
  }

  function buildTiles() {
    var out = {};
    var rng = new ER.RNG('surfaces2d');

    /* the bare limestone shelf: dust, chips and the odd pocket of scrub */
    out.shelf = tile(PPT * 4, function (c, px) {
      c.fillStyle = '#cbbfa4'; c.fillRect(0, 0, px, px);
      speckle(c, px, rng, 220, ['#c2b498', '#d6cbb2', '#b8a98c', '#dad0b8'], 0.8, 3.4);
      speckle(c, px, rng, 26, ['#a89a7c'], 3, 7);
    });

    /* The apron: the stone between the buildings that is nobody's alley.
       Kept a shade greyer and darker than the alleys themselves, because a
       game about walking eight named alleys has to show you where they are,
       and when every surface was the same beige they all disappeared. */
    out.apron = tile(PPT * 3, function (c, px) {
      coursed(c, px, rng, '#b9ae97', 'rgba(104,94,76,0.55)', 9, 14, 1.4);
      speckle(c, px, rng, 150, ['#b3a892', '#c1b6a0', '#aca08a'], 0.7, 2.2);
    });

    /* the setts of the alleys, worn pale down the middle where people walk */
    out.sett = tile(PPT * 3, function (c, px) {
      coursed(c, px, rng, '#ddd2b8', 'rgba(126,114,92,0.5)', 9, 14, 1.4);
      speckle(c, px, rng, 150, ['#d7ccb2', '#e5dbc3', '#cfc4a9'], 0.7, 2.2);
    });

    /* the big slabs of the square and the chapel forecourt */
    out.flag = tile(PPT * 4, function (c, px) {
      coursed(c, px, rng, '#d8ceb8', 'rgba(118,108,90,0.5)', 22, 30, 0.8);
      speckle(c, px, rng, 120, ['#d2c8b1', '#e0d7c2'], 0.8, 2.6);
    });

    /* the promenade along the wall */
    out.quay = tile(PPT * 3, function (c, px) {
      coursed(c, px, rng, '#cdc2ab', 'rgba(110,102,86,0.5)', 11, 11, 1.0);
      speckle(c, px, rng, 140, ['#c7bca5', '#d6ccb6'], 0.7, 2.2);
    });

    /* the concrete of the slipway, tarred at the waterline */
    out.slip = tile(PPT * 3, function (c, px) {
      c.fillStyle = '#c0bdb2'; c.fillRect(0, 0, px, px);
      speckle(c, px, rng, 180, ['#b8b5a9', '#cac7bc', '#a9a69b'], 0.7, 2.4);
    });

    /* the coping of the Phoenician wall */
    out.wall = tile(PPT * 3, function (c, px) {
      coursed(c, px, rng, '#c4b79c', 'rgba(96,88,72,0.6)', 13, 20, 1.2);
    });

    /* limewash over sandstone, for the roofs seen from above */
    out.terrace = tile(PPT * 3, function (c, px) {
      c.fillStyle = '#d9d2c2'; c.fillRect(0, 0, px, px);
      speckle(c, px, rng, 90, ['#d2cbba', '#e2dbcb'], 1, 3);
    });

    /* pantiles, in runs down the pitch */
    out.tiles = tile(PPT * 3, function (c, px) {
      c.fillStyle = '#a8603f'; c.fillRect(0, 0, px, px);
      for (var x = 0; x < px; x += 7) {
        var g = c.createLinearGradient(x, 0, x + 7, 0);
        g.addColorStop(0, 'rgba(0,0,0,0.22)');
        g.addColorStop(0.45, 'rgba(255,255,255,0.16)');
        g.addColorStop(1, 'rgba(0,0,0,0.20)');
        c.fillStyle = g; c.fillRect(x, 0, 7, px);
      }
      c.strokeStyle = 'rgba(60,30,20,0.28)'; c.lineWidth = 1;
      for (var y = 0; y < px; y += 11) { c.beginPath(); c.moveTo(0, y); c.lineTo(px, y); c.stroke(); }
    });

    /* the sea, one tile of swell */
    out.sea = tile(PPT * 4, function (c, px) {
      c.fillStyle = '#2f6c80'; c.fillRect(0, 0, px, px);
      speckle(c, px, rng, 90, ['#35788d', '#2a6276', '#3b8299'], 2, 9);
    });

    return out;
  }

  /* ------------------------------------------------------------------ *
   *  the props, as glyphs
   * ------------------------------------------------------------------ */

  /* Two hundred and twenty-five things, and you need to be able to tell at a
     glance which is the one the errand means. Tags come first so that a jar
     of sea water and a jar from the fountain look like the same kind of
     thing, and the family decides the shape: round for anything you pick up
     or fill, square for anything built, a wedge for anything that points. */
  var GLYPH = [
    ['fountain', 'ring', '#8fb6c4'],
    ['water', 'ring', '#5f97ad'],
    ['sea', 'ring', '#4f8ca3'],
    ['tap', 'ring', '#7fa8b8'],
    ['cistern', 'ring', '#6f8a96'],
    ['lamp', 'lamp', '#d8c489'],
    ['light', 'lamp', '#d8c489'],
    ['sign', 'wedge', '#39704c'],
    ['enamel', 'wedge', '#39704c'],
    ['poster', 'sheet', '#c9c0a8'],
    ['paper', 'sheet', '#ddd6c2'],
    ['plate', 'wedge', '#2f5c3e'],
    ['number', 'wedge', '#2f5c3e'],
    ['cat', 'cat', '#a89679'],
    ['boat', 'boat', '#2f6f8f'],
    ['net', 'mesh', '#6d7a5e'],
    ['car', 'box', '#7c7e80'],
    ['mercedes', 'box', '#8d8f90'],
    ['moped', 'box', '#6a2f2f'],
    ['tank', 'drum', '#2f3132'],
    ['dish', 'dish', '#d2cfc4'],
    ['satellite', 'dish', '#d2cfc4'],
    ['wires', 'mesh', '#55574f'],
    ['meter', 'box', '#8e8a7e'],
    ['generator', 'box', '#7a6f52'],
    ['gas', 'drum', '#a8563f'],
    ['diesel', 'drum', '#8a6a3f'],
    ['oven', 'box', '#8a5742'],
    ['bread', 'round', '#c99a55'],
    ['coffee', 'round', '#5b4030'],
    ['lemon', 'round', '#d8c84a'],
    ['lemonade', 'round', '#e0d271'],
    ['soap', 'box', '#94a06e'],
    ['olive', 'round', '#6b7a4a'],
    ['caper', 'leaf', '#5f7a3f'],
    ['fig', 'leaf', '#5c7a41'],
    ['mint', 'leaf', '#5f8a4f'],
    ['basil', 'leaf', '#4f7a3f'],
    ['jasmine', 'leaf', '#dfe4d0'],
    ['bougainvillea', 'leaf', '#b3457f'],
    ['geranium', 'leaf', '#c2483c'],
    ['cactus', 'leaf', '#6c8256'],
    ['flower', 'leaf', '#c05a86'],
    ['pot', 'pot', '#a9643f'],
    ['pots', 'pot', '#a9643f'],
    ['terracotta', 'pot', '#a9643f'],
    ['shell', 'round', '#c8bca4'],
    ['clay', 'round', '#9d6a46'],
    ['tile', 'box', '#a8603f'],
    ['stone', 'round', '#a89d86'],
    ['moss', 'leaf', '#5f7a4a'],
    ['wall', 'box', '#b8ab90'],
    ['step', 'box', '#c0b49a'],
    ['steps', 'box', '#c0b49a'],
    ['stair', 'box', '#c0b49a'],
    ['paving', 'box', '#c8bca4'],
    ['cracks', 'crack', '#9c9078'],
    ['shore', 'round', '#b0a58c'],
    ['lostfound', 'box', '#9a8f78'],
    ['door', 'door', '#6b4f3a'],
    ['knocker', 'ring', '#b08d4a'],
    ['brass', 'ring', '#b08d4a'],
    ['window', 'box', '#48555c'],
    ['windowsill', 'box', '#b9ae96'],
    ['shutter', 'box', '#2f6f8f'],
    ['balcony', 'box', '#9aa0a6'],
    ['railing', 'mesh', '#5e584f'],
    ['bell', 'ring', '#b09048'],
    ['cross', 'wedge', '#cfc8b8'],
    ['candle', 'flame', '#e8d08a'],
    ['wax', 'round', '#ddd2b4'],
    ['shrine', 'box', '#cfc4ac'],
    ['niche', 'box', '#c4b79e'],
    ['chapel', 'box', '#e0d8c4'],
    ['bench', 'box', '#8e7a58'],
    ['chair', 'box', '#7a6a4e'],
    ['board', 'box', '#8a6f4a'],
    ['backgammon', 'box', '#8a6f4a'],
    ['arghile', 'flame', '#7a5a7a'],
    ['crate', 'box', '#9c7d4f'],
    ['box', 'box', '#9a8f78'],
    ['canister', 'drum', '#8a8f86'],
    ['rope', 'mesh', '#a89469'],
    ['twine', 'mesh', '#b5a276'],
    ['hook', 'wedge', '#8a8f86'],
    ['iron', 'box', '#5c564c'],
    ['rust', 'box', '#8a5535'],
    ['pipe', 'box', '#7a7f78'],
    ['drip', 'ring', '#7fa8b8'],
    ['tar', 'round', '#33302c'],
    ['coal', 'round', '#3a3632'],
    ['fire', 'flame', '#c76a33'],
    ['press', 'box', '#7f6a4a'],
    ['mirror', 'box', '#9fb0b8'],
    ['barber', 'box', '#b8bcbe'],
    ['fish', 'round', '#8fa3ab'],
    ['shed', 'box', '#b9c0bd'],
    ['ruin', 'box', '#a89b84'],
    ['collapsed', 'box', '#9d9280'],
    ['laundry', 'sheet', '#dfe2e0'],
    ['line', 'mesh', '#c8c8c0'],
    ['roof', 'box', '#c6bca8'],
    ['tree', 'leaf', '#6e7d4c'],
    ['leaf', 'leaf', '#6e7d4c'],
    ['plant', 'leaf', '#5f7a4a'],
    ['view', 'wedge', '#b8c4cc'],
    ['anchor', 'wedge', '#6a6f68'],
    ['slip', 'box', '#c0bdb2'],
    ['arch', 'box', '#c4b79e'],
    ['arcade', 'box', '#c4b79e'],
    ['pole', 'box', '#9ba09c'],
    ['wood', 'box', '#8a7048'],
    ['plastic', 'box', '#9aa8a4'],
    ['paint', 'round', '#8a6a9a'],
    ['wasp', 'round', '#c8a23f'],
    ['electric', 'box', '#8e8a7e'],
    ['blue', 'box', '#3f7f93'],
    ['black', 'box', '#3a3632'],
    ['broken', 'crack', '#9c9078'],
    ['dukkan', 'box', '#c8b894'],
    ['shop', 'box', '#c8b894'],
    ['home', 'box', '#d8c8a8']
  ];

  function glyphFor(p) {
    var tags = p.tags || [];
    for (var g = 0; g < GLYPH.length; g++) {
      if (tags.indexOf(GLYPH[g][0]) >= 0) return GLYPH[g];
    }
    return ['thing', 'round', '#a39a86'];
  }

  /* ------------------------------------------------------------------ *
   *  the scene
   * ------------------------------------------------------------------ */

  function Scene2D(town, clock) {
    this.town = town;
    this.clock = clock;
    this.light = new ER.Light2D();
    this.tiles = buildTiles();
    this.patterns = {};
    this.t = 0;
    this.game = null;
    /* what the picker may choose from: everything the town calls a prop.
       The first-person renderer needed invisible spheres for this; from above
       the footprint on the paving is the hit area. */
    this.raycastTargets = town.propList;
    this.rain = [];
    this.relief = null;
  }

  Scene2D.prototype.pattern = function (ctx, name) {
    /* Patterns are per-context, and the photograph draws into its own, so
       key the cache by context as well as by surface. */
    var key = name + (ctx.__erKey || (ctx.__erKey = 'c' + (Scene2D._ctxN = (Scene2D._ctxN || 0) + 1)));
    if (this.patterns[key]) return this.patterns[key];
    var p = ctx.createPattern(this.tiles[name], 'repeat');
    if (p && p.setTransform && typeof DOMMatrix !== 'undefined') {
      p.setTransform(new DOMMatrix([1 / PPT, 0, 0, 1 / PPT, 0, 0]));
    }
    this.patterns[key] = p;
    return p;
  };

  /* the shelf's relief, baked once: light where the rock rises toward the
     sun's side, dark in the hollows. It is the only thing left of the
     topography once the camera goes overhead, and without it the island
     reads as a flat sheet of paper. */
  Scene2D.prototype.buildRelief = function () {
    var town = this.town;
    var N = 200;                            /* 4 samples to the metre */
    var cv = document.createElement('canvas');
    cv.width = cv.height = N;
    var c = cv.getContext('2d');
    var img = c.createImageData(N, N);
    var d = img.data;
    var step = town.w / N;
    for (var j = 0; j < N; j++) {
      for (var i = 0; i < N; i++) {
        var x = i * step, y = j * step;
        var hx = town.heightAt(x + step, y) - town.heightAt(x - step, y);
        var hy = town.heightAt(x, y + step) - town.heightAt(x, y - step);
        /* lit from the north-west, which is the sea, because that is where
           the light comes from for most of the interesting hours */
        var lambert = U.clamp(0.5 - (hx * 0.9 + hy * 0.9) * 1.6, 0, 1);
        var k = (j * N + i) * 4;
        var v = Math.round(U.lerp(-44, 44, lambert));
        d[k] = d[k + 1] = d[k + 2] = v > 0 ? 255 : 0;
        d[k + 3] = Math.min(255, Math.abs(v) * 2);
      }
    }
    c.putImageData(img, 0, 0);
    this.relief = cv;
  };

  /* ---------------- the ground ---------------- */

  Scene2D.prototype.drawGround = function (ctx) {
    var town = this.town, L = this.light;

    /* the sea, to the horizon on every side that is not the island */
    ctx.fillStyle = this.pattern(ctx, 'sea');
    ctx.fillRect(-200, -200, town.w + 400, town.h + 400);
    /* the swell, drifting */
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = '#8fc0cf';
    ctx.lineWidth = 0.06;
    var drift = (this.t * 0.35) % 3;
    for (var s = -200; s < town.h + 200; s += 3) {
      ctx.beginPath();
      for (var xx = -200; xx <= town.w + 200; xx += 4) {
        var yy = s + drift + Math.sin((xx + this.t * 1.4) * 0.22) * 0.5;
        if (xx === -200) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
    }
    ctx.restore();

    /* the shallows over the shelf, then the wet rock the swell keeps dark */
    ctx.fillStyle = 'rgba(126,196,204,0.30)';
    ctx.fillRect(town.sea.edge - 7, -2, 7.4, town.h + 4);
    ctx.fillStyle = 'rgba(60,66,62,0.55)';
    ctx.fillRect(town.sea.edge - 1.6, -2, 2.2, town.h + 4);

    ctx.fillStyle = this.pattern(ctx, 'shelf');
    ctx.fillRect(town.sea.edge - 0.4, 0, town.w - town.sea.edge + 0.4, town.h);
    if (this.relief) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.drawImage(this.relief, 0, 0, town.w, town.h);
      ctx.restore();
    }

    /* inland of the quay the quarter is paved wall to wall */
    ctx.fillStyle = this.pattern(ctx, 'apron');
    ctx.fillRect(town.apron, 0, town.w - town.apron, town.h);

    /* the places somebody bothered to lay properly */
    for (var i = 0; i < town.paving.length; i++) {
      var p = town.paving[i];
      ctx.fillStyle = this.pattern(ctx, this.tiles[p.kind] ? p.kind : 'flag');
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = 'rgba(90,82,66,0.35)';
      ctx.lineWidth = 0.05;
      ctx.strokeRect(p.x, p.y, p.w, p.h);
    }

    /* the alleys: the unswept shoulder, then the swept stone */
    var r, pts;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    /* the kerb: a dark line the width of the alley plus its shoulders, which
       is what makes an alley read as a route between two walls rather than a
       gap in the paving */
    for (r = 0; r < town.roads.length; r++) {
      var rd = town.roads[r];
      ctx.strokeStyle = 'rgba(92,82,64,0.55)';
      ctx.lineWidth = rd.width + rd.shoulder * 2 + 0.16;
      strokePoly(ctx, rd.pts);
      ctx.strokeStyle = 'rgba(158,146,120,0.75)';
      ctx.lineWidth = rd.width + rd.shoulder * 2;
      strokePoly(ctx, rd.pts);
    }
    for (r = 0; r < town.roads.length; r++) {
      var rd2 = town.roads[r];
      ctx.strokeStyle = this.pattern(ctx, rd2.steps ? 'flag' : 'sett');
      ctx.lineWidth = rd2.width;
      strokePoly(ctx, rd2.pts);
      /* the swept crown down the middle, which is what makes an alley read
         as a route rather than a gap between two walls */
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.strokeStyle = '#f0e8d4';
      ctx.lineWidth = rd2.width * 0.42;
      strokePoly(ctx, rd2.pts);
      ctx.restore();
      /* and the risers, on the one that climbs */
      if (rd2.steps) this.drawSteps(ctx, rd2);
    }

    /* the Phoenician wall: the coping, and the face it presents to the sea */
    var wall = town.sea.wall;
    ctx.strokeStyle = 'rgba(70,64,52,0.5)';
    ctx.lineWidth = wall.halfWidth * 2 + 0.5;
    strokePoly(ctx, wall.pts);
    ctx.strokeStyle = this.pattern(ctx, 'wall');
    ctx.lineWidth = wall.halfWidth * 2;
    strokePoly(ctx, wall.pts);
  };

  Scene2D.prototype.drawSteps = function (ctx, rd) {
    var len = ER.poly.length(rd.pts);
    ctx.save();
    ctx.strokeStyle = 'rgba(96,88,70,0.6)';
    ctx.lineWidth = 0.05;
    for (var s = 0.4; s < len; s += 0.45) {
      var at = ER.poly.pointAt(rd.pts, s);
      var n = ER.poly.normal(rd.pts, at.seg);
      ctx.beginPath();
      ctx.moveTo(at.x + n.x * rd.width / 2, at.y + n.y * rd.width / 2);
      ctx.lineTo(at.x - n.x * rd.width / 2, at.y - n.y * rd.width / 2);
      ctx.stroke();
    }
    ctx.restore();
  };

  /* ---------------- buildings ---------------- */

  Scene2D.prototype.drawBuildings = function (ctx) {
    var town = this.town, L = this.light;
    var all = [];
    var i;
    for (i = 0; i < town.lots.length; i++) {
      var l = town.lots[i];
      all.push({ rect: l.rect, storeys: l.storeys || 1, roof: l.roof, roofColor: l.roofColor,
        wash: l.siding, face: l.face, door: l.door, number: l.number, lot: l,
        home: town.home && town.home.lot === l.id });
    }
    for (i = 0; i < town.buildings.length; i++) {
      var b = town.buildings[i];
      all.push({ rect: b.rect, storeys: b.storeys || 1, roof: b.civic ? 'tile' : 'flat',
        roofColor: b.roofColor, wash: b.wall, face: b.face, number: null,
        bld: b, ruin: b.ruin, open: b.open });
    }

    /* the shadows first, all of them, so no wall is drawn over its neighbour's */
    var sx = L.shadowDX, sy = L.shadowDY;
    if (L.shade > 0.02) {
      ctx.save();
      ctx.fillStyle = 'rgba(38,34,28,' + L.shade.toFixed(3) + ')';
      for (i = 0; i < all.length; i++) {
        var a = all[i];
        if (a.ruin || a.open) continue;
        var hgt = 0.22 + 2.62 * a.storeys;
        shadowQuad(ctx, a.rect, sx * hgt * 0.34, sy * hgt * 0.34);
      }
      ctx.restore();
    }

    for (i = 0; i < all.length; i++) this.drawOne(ctx, all[i]);
  };

  Scene2D.prototype.drawOne = function (ctx, a) {
    var L = this.light;
    var x = a.rect[0], y = a.rect[1], w = a.rect[2], h = a.rect[3];

    if (a.ruin) {
      /* four courses of stone and the sky: the walls, and the beams that
         came down inside them */
      ctx.fillStyle = L.tint(0xa89b84);
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(40,36,30,0.30)';
      ctx.fillRect(x + 0.55, y + 0.55, w - 1.1, h - 1.1);
      ctx.strokeStyle = 'rgba(70,62,48,0.7)';
      ctx.lineWidth = 0.08;
      ctx.strokeRect(x, y, w, h);
      var rr = new ER.RNG('ruinbeams' + x);
      ctx.strokeStyle = 'rgba(100,88,66,0.85)';
      ctx.lineWidth = 0.12;
      for (var b = 0; b < 7; b++) {
        var bx = x + rr.float(0.6, w - 0.6), by = y + rr.float(0.6, h - 0.6);
        var ang = rr.float(0, 3.14), ln = rr.float(0.8, Math.min(w, h) - 0.6);
        ctx.beginPath();
        ctx.moveTo(bx - Math.cos(ang) * ln / 2, by - Math.sin(ang) * ln / 2);
        ctx.lineTo(bx + Math.cos(ang) * ln / 2, by + Math.sin(ang) * ln / 2);
        ctx.stroke();
      }
      return;
    }

    if (a.open) {
      /* the lemonade kiosk: a tin roof on four posts, and the counter */
      ctx.fillStyle = 'rgba(158,163,156,0.85)';
      ctx.fillRect(x - 0.25, y - 0.25, w + 0.5, h + 0.5);
      ctx.strokeStyle = 'rgba(60,56,50,0.8)';
      ctx.lineWidth = 0.06;
      ctx.strokeRect(x - 0.25, y - 0.25, w + 0.5, h + 0.5);
      ctx.fillStyle = L.tint(0xa8956f);
      ctx.fillRect(x, y + h - 0.5, w, 0.5);
      return;
    }

    var pitched = a.roof === 'tile';
    if (pitched) {
      ctx.fillStyle = this.pattern(ctx, 'tiles');
      ctx.fillRect(x - 0.3, y - 0.3, w + 0.6, h + 0.6);
      /* the tint the lot was given, over the pantiles */
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = a.roofColor || '#a8603f';
      ctx.fillRect(x - 0.3, y - 0.3, w + 0.6, h + 0.6);
      ctx.restore();
      /* the ridge, down the long way, with the two pitches either side */
      ctx.strokeStyle = 'rgba(255,240,220,0.5)';
      ctx.lineWidth = 0.12;
      ctx.beginPath();
      if (w >= h) { ctx.moveTo(x + 0.2, y + h / 2); ctx.lineTo(x + w - 0.2, y + h / 2); }
      else { ctx.moveTo(x + w / 2, y + 0.2); ctx.lineTo(x + w / 2, y + h - 0.2); }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(48,26,18,0.45)';
      ctx.lineWidth = 0.07;
      ctx.strokeRect(x - 0.3, y - 0.3, w + 0.6, h + 0.6);
    } else {
      /* a flat terrace: the slab, the parapet round it, and whatever is
         standing up there */
      ctx.fillStyle = this.pattern(ctx, 'terrace');
      ctx.fillRect(x, y, w, h);
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = a.wash || '#e1d0b2';
      ctx.fillRect(x, y, w, h);
      ctx.restore();
      ctx.strokeStyle = L.tint(0xc9c0aa);
      ctx.lineWidth = 0.2;
      ctx.strokeRect(x + 0.1, y + 0.1, w - 0.2, h - 0.2);
      ctx.strokeStyle = 'rgba(58,50,38,0.8)';
      ctx.lineWidth = 0.1;
      ctx.strokeRect(x, y, w, h);
    }

    /* the black water tank and the dish, which is what this skyline is */
    if (a.lot && a.lot.features) {
      if (a.lot.features.tank) {
        var tcx = x + w * 0.5, tcy = y + h * 0.65;
        ctx.fillStyle = 'rgba(30,31,32,0.92)';
        dot(ctx, tcx, tcy, 0.45);
        ctx.strokeStyle = 'rgba(150,150,145,0.5)';
        ctx.lineWidth = 0.04;
        ring(ctx, tcx, tcy, 0.45);
      }
      if (a.lot.features.dish) {
        var dcx = x + w * 0.74, dcy = y + h * 0.24;
        ctx.fillStyle = 'rgba(214,211,200,0.95)';
        ctx.beginPath();
        ctx.arc(dcx, dcy, 0.34, 0.5, 0.5 + Math.PI * 1.35);
        ctx.closePath();
        ctx.fill();
      }
      if (a.lot.features.laundry) {
        /* a line across the terrace, with things on it */
        ctx.strokeStyle = 'rgba(210,210,200,0.75)';
        ctx.lineWidth = 0.035;
        ctx.beginPath();
        ctx.moveTo(x + 0.3, y + h * 0.35);
        ctx.lineTo(x + w - 0.3, y + h * 0.4);
        ctx.stroke();
        ctx.fillStyle = 'rgba(232,236,234,0.9)';
        for (var q = 0; q < 4; q++) {
          var t = 0.2 + q * 0.2;
          ctx.fillRect(x + 0.3 + (w - 0.6) * t, y + h * (0.35 + 0.05 * t), 0.16, 0.34);
        }
      }
    }

    /* the outside stair to the roof, on about a third of them */
    if (a.lot && a.lot.stair) {
      ctx.fillStyle = L.tint(0xb5a88e);
      ctx.fillRect(x - 0.9, y + 0.2, 0.9, Math.min(h - 0.4, 2.2));
      ctx.strokeStyle = 'rgba(80,72,58,0.6)';
      ctx.lineWidth = 0.04;
      for (var st = 0; st < 7; st++) {
        var sy2 = y + 0.2 + st * (Math.min(h - 0.4, 2.2) / 7);
        ctx.beginPath(); ctx.moveTo(x - 0.9, sy2); ctx.lineTo(x, sy2); ctx.stroke();
      }
    }

    /* the door, on the wall it is actually on */
    if (a.door || a.face) {
      var dpt = a.door || frontMid(a.rect, a.face);
      ctx.fillStyle = L.tint(0x6b4f3a);
      dot(ctx, dpt.x, dpt.y, 0.22);
      ctx.strokeStyle = 'rgba(40,34,26,0.8)';
      ctx.lineWidth = 0.04;
      ring(ctx, dpt.x, dpt.y, 0.22);
    }
    if (a.home) {
      ctx.strokeStyle = '#e8c96a';
      ctx.lineWidth = 0.12;
      ctx.setLineDash([0.45, 0.3]);
      ctx.strokeRect(x - 0.35, y - 0.35, w + 0.7, h + 0.7);
      ctx.setLineDash([]);
    }
  };

  /* ---------------- trees, lamps, signs ---------------- */

  Scene2D.prototype.drawTrees = function (ctx) {
    var town = this.town, L = this.light;
    var COL = {
      palm: '#6f8a49', jacaranda: '#7b8ab0', fig: '#5d7a41',
      lemon: '#7f8f45', olive: '#8b9470'
    };
    var i, t;
    if (L.shade > 0.02) {
      ctx.fillStyle = 'rgba(38,34,28,' + (L.shade * 0.7).toFixed(3) + ')';
      for (i = 0; i < town.trees.length; i++) {
        t = town.trees[i];
        dot(ctx, t.x + L.shadowDX * 1.1, t.y + L.shadowDY * 1.1, t.r * 0.85);
      }
    }
    for (i = 0; i < town.trees.length; i++) {
      t = town.trees[i];
      var col = COL[t.kind] || '#6e7d4c';
      /* a crown is not a circle. two lobes off-centre and a ragged edge is
         enough from this height, and it keeps the olives from looking like
         somebody rolled marbles down the alley. */
      var rr = new ER.RNG('crown' + t.x + t.y);
      ctx.fillStyle = L.tint(parseInt(col.slice(1), 16));
      ctx.beginPath();
      for (var a = 0; a <= 18; a++) {
        var ang = (a / 18) * 6.2832;
        var rad = t.r * (0.82 + rr.float(0, 0.3));
        var px = t.x + Math.cos(ang) * rad, py = t.y + Math.sin(ang) * rad * 0.92;
        if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      /* the sunlit side */
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#e8f0cf';
      dot(ctx, t.x - L.shadowDX * t.r * 0.18, t.y - L.shadowDY * t.r * 0.18, t.r * 0.45);
      ctx.restore();
      /* the trunk, just visible under it */
      ctx.fillStyle = 'rgba(70,56,40,0.85)';
      dot(ctx, t.x, t.y, 0.14);
    }
  };

  Scene2D.prototype.drawWires = function (ctx) {
    /* the supply, thrown across the alleys wall to wall, which is both how it
       looks and why the errand about counting the wires exists */
    var town = this.town;
    ctx.save();
    ctx.strokeStyle = 'rgba(52,50,46,0.32)';
    ctx.lineWidth = 0.04;
    var rng = new ER.RNG('wires2d');
    for (var i = 0; i < town.roads.length; i++) {
      var rd = town.roads[i];
      var len = ER.poly.length(rd.pts);
      for (var s = 3; s < len - 2; s += rng.float(5.5, 9)) {
        var at = ER.poly.pointAt(rd.pts, s);
        var n = ER.poly.normal(rd.pts, at.seg);
        var reach = rd.width / 2 + 0.55;
        var runs = rng.int(2, 5);
        for (var j = 0; j < runs; j++) {
          var off = (j - (runs - 1) / 2) * 0.1;
          ctx.beginPath();
          ctx.moveTo(at.x + n.x * reach + n.y * off, at.y + n.y * reach - n.x * off);
          ctx.lineTo(at.x - n.x * reach + n.y * off, at.y - n.y * reach - n.x * off);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  };

  Scene2D.prototype.drawSigns = function (ctx) {
    var town = this.town;
    for (var i = 0; i < town.signs.length; i++) {
      var sg = town.signs[i];
      var shop = sg.kind === 'shop';
      ctx.fillStyle = shop ? '#2f5f72' : '#2c5c3c';
      ctx.fillRect(sg.x - 0.3, sg.y - 0.09, 0.6, 0.18);
      ctx.strokeStyle = 'rgba(242,239,228,0.85)';
      ctx.lineWidth = 0.035;
      ctx.strokeRect(sg.x - 0.3, sg.y - 0.09, 0.6, 0.18);
    }
  };

  /* ---------------- props ---------------- */

  Scene2D.prototype.drawProps = function (ctx, cam) {
    var town = this.town, L = this.light;
    var halfW = cam.w / (2 * cam.ppm) + 2, halfH = cam.h / (2 * cam.ppm) + 2;
    var looking = this.game && this.game.looking ? this.game.looking.id : null;
    var wanted = null;
    if (this.game && this.game.director) {
      var st = this.game.director.currentStep();
      if (st && typeof st.at === 'string') wanted = st.at;
    }
    var list = town.propList;
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      var x = p.rect ? p.rect.x + p.rect.w / 2 : p.x;
      var y = p.rect ? p.rect.y + p.rect.h / 2 : p.y;
      if (Math.abs(x - cam.cx) > halfW || Math.abs(y - cam.cy) > halfH) continue;

      if (p.rect) {
        /* a place rather than a thing: the room where the roof came down,
           the chapel doorway */
        ctx.strokeStyle = 'rgba(80,72,58,0.45)';
        ctx.lineWidth = 0.05;
        ctx.setLineDash([0.3, 0.22]);
        ctx.strokeRect(p.rect.x, p.rect.y, p.rect.w, p.rect.h);
        ctx.setLineDash([]);
      }

      var g = glyphFor(p);
      /* Small. There are 225 of them inside fifty metres, and at the size
         they started they were the loudest thing on the screen — the town
         underneath had disappeared behind its own contents. */
      drawGlyph(ctx, g[1], x, y, U.clamp(p.r === undefined ? 0.28 : p.r * 0.24, 0.13, 0.36), g[2], L);

      if (p.id === wanted) {
        ctx.strokeStyle = '#f0d27a';
        ctx.lineWidth = 0.07;
        ring(ctx, x, y, 0.62 + Math.sin(this.t * 3) * 0.05);
      }
      if (p.id === looking) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.06;
        ring(ctx, x, y, 0.46);
      }
    }
  };

  function drawGlyph(ctx, shape, x, y, r, col, L) {
    ctx.fillStyle = col;
    ctx.strokeStyle = 'rgba(32,28,22,0.75)';
    ctx.lineWidth = 0.035;
    switch (shape) {
      case 'box':
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        ctx.strokeRect(x - r, y - r, r * 2, r * 2);
        break;
      case 'ring':
        dot(ctx, x, y, r);
        ctx.strokeStyle = 'rgba(250,250,245,0.8)';
        ring(ctx, x, y, r * 0.55);
        break;
      case 'drum':
        dot(ctx, x, y, r);
        ctx.strokeStyle = 'rgba(32,28,22,0.75)';
        ring(ctx, x, y, r);
        ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.stroke();
        break;
      case 'wedge':
        ctx.beginPath();
        ctx.moveTo(x, y - r); ctx.lineTo(x + r, y + r * 0.7); ctx.lineTo(x - r, y + r * 0.7);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      case 'sheet':
        ctx.fillRect(x - r * 0.75, y - r, r * 1.5, r * 2);
        ctx.strokeRect(x - r * 0.75, y - r, r * 1.5, r * 2);
        break;
      case 'leaf':
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.62, 0.7, 0, 6.2832);
        ctx.fill(); ctx.stroke();
        break;
      case 'pot':
        ctx.beginPath();
        ctx.moveTo(x - r, y - r * 0.8); ctx.lineTo(x + r, y - r * 0.8);
        ctx.lineTo(x + r * 0.6, y + r); ctx.lineTo(x - r * 0.6, y + r);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#5f7a4a';
        dot(ctx, x, y - r * 0.85, r * 0.7);
        break;
      case 'lamp':
        ctx.fillStyle = 'rgba(70,66,58,0.9)';
        dot(ctx, x, y, r * 0.9);
        ctx.fillStyle = col;
        dot(ctx, x, y, r * 0.45);
        break;
      case 'dish':
        ctx.beginPath();
        ctx.arc(x, y, r, 0.5, 0.5 + Math.PI * 1.4);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      case 'cat':
        dot(ctx, x, y, r * 0.8);
        ctx.beginPath();
        ctx.moveTo(x - r * 0.6, y - r * 0.5); ctx.lineTo(x - r * 0.2, y - r * 1.1);
        ctx.lineTo(x + r * 0.05, y - r * 0.5); ctx.closePath(); ctx.fill();
        break;
      case 'boat':
        ctx.beginPath();
        ctx.moveTo(x - r * 1.3, y); ctx.quadraticCurveTo(x, y + r * 1.1, x + r * 1.3, y);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      case 'mesh':
        ctx.strokeStyle = col;
        ctx.lineWidth = 0.04;
        for (var m = -1; m <= 1; m++) {
          ctx.beginPath(); ctx.moveTo(x - r, y + m * r * 0.6); ctx.lineTo(x + r, y + m * r * 0.6); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x + m * r * 0.6, y - r); ctx.lineTo(x + m * r * 0.6, y + r); ctx.stroke();
        }
        break;
      case 'crack':
        ctx.strokeStyle = 'rgba(70,62,48,0.8)';
        ctx.lineWidth = 0.05;
        ctx.beginPath();
        ctx.moveTo(x - r, y - r * 0.4); ctx.lineTo(x - r * 0.2, y + r * 0.2);
        ctx.lineTo(x + r * 0.3, y - r * 0.3); ctx.lineTo(x + r, y + r * 0.5);
        ctx.stroke();
        break;
      case 'door':
        ctx.fillRect(x - r * 0.55, y - r, r * 1.1, r * 2);
        ctx.strokeRect(x - r * 0.55, y - r, r * 1.1, r * 2);
        break;
      case 'flame':
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(x, y - r * 1.2);
        ctx.quadraticCurveTo(x + r, y, x, y + r);
        ctx.quadraticCurveTo(x - r, y, x, y - r * 1.2);
        ctx.fill();
        break;
      default:
        dot(ctx, x, y, r);
        ctx.stroke();
    }
  }

  /* ---------------- people ---------------- */

  Scene2D.prototype.drawPeople = function (ctx, people) {
    var L = this.light;
    if (!people) return;
    for (var i = 0; i < people.length; i++) {
      var r = people[i];
      if (r.away) continue;
      if (L.shade > 0.02) {
        ctx.fillStyle = 'rgba(38,34,28,' + (L.shade * 0.6).toFixed(3) + ')';
        dot(ctx, r.x + L.shadowDX * 0.45, r.y + L.shadowDY * 0.45, 0.3);
      }
      ctx.fillStyle = r.met ? '#c4a882' : '#9a9384';
      dot(ctx, r.x, r.y, 0.28);
      ctx.strokeStyle = 'rgba(30,26,20,0.8)';
      ctx.lineWidth = 0.05;
      ring(ctx, r.x, r.y, 0.28);
      /* which way they are walking, so a street of people has a direction */
      if (r.facing !== undefined) {
        ctx.strokeStyle = 'rgba(30,26,20,0.75)';
        ctx.lineWidth = 0.07;
        ctx.beginPath();
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(r.x + Math.cos(r.facing) * 0.42, r.y - Math.sin(r.facing) * 0.42);
        ctx.stroke();
      }
    }
  };

  Scene2D.prototype.drawPlayer = function (ctx, view) {
    var L = this.light;
    var x = view.pos.x, y = view.pos.z;
    var fx = -Math.sin(view.yaw), fy = -Math.cos(view.yaw);
    if (L.shade > 0.02) {
      ctx.fillStyle = 'rgba(38,34,28,' + (L.shade * 0.65).toFixed(3) + ')';
      dot(ctx, x + L.shadowDX * 0.5, y + L.shadowDY * 0.5, 0.32);
    }
    /* how far you can reach, so you can tell when you are close enough */
    ctx.strokeStyle = 'rgba(255,248,224,0.26)';
    ctx.lineWidth = 0.05;
    ctx.setLineDash([0.3, 0.26]);
    ring(ctx, x, y, ER.REACH);
    ctx.setLineDash([]);

    /* You have to be findable. In a quarter of two hundred and twenty-five
       small things, a beige dot in the middle of beige paving is not: at
       night, with the lamps lit, the brightest thing on the screen was a
       streetlamp four metres away and you were nowhere. */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var halo = ctx.createRadialGradient(x, y, 0, x, y, 1.5);
    halo.addColorStop(0, 'rgba(255,246,214,0.30)');
    halo.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    ctx.restore();

    var bobR = 0.30 + Math.sin(view.bob * 2) * 0.016 * view.bobAmp;
    ctx.fillStyle = '#2a2620';
    dot(ctx, x, y, bobR + 0.09);
    ctx.fillStyle = '#fff6df';
    dot(ctx, x, y, bobR);
    /* which way you are facing, as a wedge out of the front of you */
    ctx.fillStyle = '#2a2620';
    ctx.beginPath();
    ctx.moveTo(x + fx * 0.56, y + fy * 0.56);
    ctx.lineTo(x + fx * 0.14 - fy * 0.20, y + fy * 0.14 + fx * 0.20);
    ctx.lineTo(x + fx * 0.14 + fy * 0.20, y + fy * 0.14 - fx * 0.20);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fff6df';
    ctx.lineWidth = 0.05;
    ctx.stroke();

    /* The hold ring is the HUD's, drawn in crisp SVG and positioned on you
       by hud.drawPrompt. Drawing a second one here in world space only gave
       everything two rings a hair out of step with each other. */
  };

  /* ---------------- night, weather ---------------- */

  Scene2D.prototype.drawTint = function (ctx, cam) {
    var L = this.light;
    if (L.washAlpha < 0.004) return;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = L.washAlpha;
    ctx.fillStyle = L.wash;
    ctx.fillRect(cam.cx - cam.w / cam.ppm, cam.cy - cam.h / cam.ppm,
      cam.w * 2 / cam.ppm, cam.h * 2 / cam.ppm);
    ctx.restore();
  };

  Scene2D.prototype.drawLamps = function (ctx, cam) {
    var town = this.town, L = this.light;
    if (L.lamps < 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < town.lamps.length; i++) {
      var lp = town.lamps[i];
      if (Math.abs(lp.x - cam.cx) > cam.w / cam.ppm || Math.abs(lp.y - cam.cy) > cam.h / cam.ppm) continue;
      /* the dying one on the souk is why the errand about it exists */
      var flick = lp.dying
        ? 0.35 + 0.65 * Math.max(0, Math.sin(this.t * 7 + lp.phase) * 0.5 + 0.5)
        : 0.92 + Math.sin(this.t * 1.7 + lp.phase) * 0.05;
      var R = 4.6;
      var g = ctx.createRadialGradient(lp.x, lp.y, 0, lp.x, lp.y, R);
      g.addColorStop(0, 'rgba(255,214,150,' + (0.5 * L.lamps * flick).toFixed(3) + ')');
      g.addColorStop(0.45, 'rgba(255,196,120,' + (0.16 * L.lamps * flick).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(255,190,110,0)');
      ctx.fillStyle = g;
      ctx.fillRect(lp.x - R, lp.y - R, R * 2, R * 2);
      ctx.fillStyle = 'rgba(255,232,180,' + (0.85 * L.lamps * flick).toFixed(3) + ')';
      dot(ctx, lp.x, lp.y, 0.14);
    }
    ctx.restore();
  };

  /* the windows of the houses whose people are home */
  Scene2D.prototype.drawWindows = function (ctx) {
    var L = this.light;
    if (L.lamps < 0.02) return;
    var g = this.game;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < this.town.lots.length; i++) {
      var l = this.town.lots[i];
      var home = true;
      if (g && g.peopleByLot && g.peopleByLot[l.id]) {
        var r = g.peopleByLot[l.id];
        home = !r.away && U.dist(r.x, r.y, l.rect[0] + l.rect[2] / 2, l.rect[1] + l.rect[3] / 2) < 4;
      }
      if (!home) continue;
      var cx = l.rect[0] + l.rect[2] * 0.3, cy = l.rect[1] + l.rect[3] * 0.3;
      ctx.fillStyle = 'rgba(255,222,160,' + (0.5 * L.lamps).toFixed(3) + ')';
      dot(ctx, cx, cy, 0.3);
    }
    ctx.restore();
  };

  Scene2D.prototype.drawWeather = function (ctx, cam, dt) {
    var wet = this.clock.wet || 0;
    var wx = this.clock.weather;
    if (wx === 'fog' || (this.clock.fogAmt || 0) > 0.02) {
      ctx.save();
      ctx.globalAlpha = 0.35 + (this.clock.fogAmt || 0) * 0.3;
      ctx.fillStyle = '#c6ccc9';
      ctx.fillRect(cam.cx - cam.w / cam.ppm, cam.cy - cam.h / cam.ppm,
        cam.w * 2 / cam.ppm, cam.h * 2 / cam.ppm);
      ctx.restore();
    }
    if (wet < 0.05) { this.rain.length = 0; return; }

    /* Rain seen from above is not streaks: it is the marks it makes. Dashes
       falling with the wind, and rings where they land. */
    var want = Math.round(340 * wet);
    var halfW = cam.w / (2 * cam.ppm) + 1, halfH = cam.h / (2 * cam.ppm) + 1;
    var rng = this.rainRng || (this.rainRng = new ER.RNG('rain2d'));
    while (this.rain.length < want) {
      this.rain.push({ x: cam.cx + rng.float(-halfW, halfW), y: cam.cy + rng.float(-halfH, halfH),
        v: rng.float(7, 13), a: rng.float(0, 6.2832), life: rng.float(0, 1) });
    }
    while (this.rain.length > want) this.rain.pop();
    ctx.save();
    ctx.strokeStyle = 'rgba(206,226,238,0.8)';
    ctx.lineWidth = 0.055;
    var gust = 0.6 + Math.sin(this.t * 0.4) * 0.3;
    for (var i = 0; i < this.rain.length; i++) {
      var d = this.rain[i];
      d.life -= dt * 2.2;
      if (d.life <= 0 || Math.abs(d.x - cam.cx) > halfW || Math.abs(d.y - cam.cy) > halfH) {
        d.x = cam.cx + rng.float(-halfW, halfW);
        d.y = cam.cy + rng.float(-halfH, halfH);
        d.life = rng.float(0.4, 1);
      }
      d.x += gust * dt * 1.2;
      d.y += gust * dt * 0.6;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x + gust * 0.22, d.y + gust * 0.12);
      ctx.stroke();
      if (d.life < 0.25) {
        ctx.strokeStyle = 'rgba(216,234,246,' + (d.life * 2.6).toFixed(2) + ')';
        ring(ctx, d.x, d.y, (0.25 - d.life) * 1.9);
        ctx.strokeStyle = 'rgba(206,226,238,0.8)';
      }
    }
    ctx.restore();
  };

  /* ---------------- the whole frame ---------------- */

  Scene2D.prototype.draw = function (ctx, view, cam, opts) {
    opts = opts || {};
    var dt = opts.dt === undefined ? 1 / 60 : opts.dt;
    ctx.save();
    ctx.clearRect(0, 0, cam.w, cam.h);
    /* world space: one unit is one metre, so every line width below is in
       metres and stays right at any zoom */
    ctx.translate(cam.ox, cam.oy);
    ctx.scale(cam.ppm, cam.ppm);
    ctx.imageSmoothingEnabled = true;

    this.drawGround(ctx);
    this.drawBuildings(ctx);
    this.drawTrees(ctx);
    /* the props go over the footprints, because half of them are on a wall,
       in a doorway or on a counter, and under them they were invisible */
    this.drawProps(ctx, cam);
    this.drawSigns(ctx);
    if (cam.ppm > 26) this.drawWires(ctx);
    this.drawPeople(ctx, this.game && this.game.people);

    this.drawTint(ctx, cam);
    this.drawWindows(ctx);
    this.drawLamps(ctx, cam);
    /* after the night wash, because you are the one thing that must never be
       hard to find */
    if (!opts.noPlayer) this.drawPlayer(ctx, view);
    this.drawWeather(ctx, cam, opts.photo ? 0 : dt);

    ctx.restore();

    /* the names of the alleys, in screen pixels so they stay readable */
    if (!opts.photo) this.drawLabels(ctx, cam);
  };

  Scene2D.prototype.drawLabels = function (ctx, cam) {
    var town = this.town;
    ctx.save();
    ctx.font = '600 11px ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var i = 0; i < town.roads.length; i++) {
      var rd = town.roads[i];
      if (!rd.name) continue;
      var len = ER.poly.length(rd.pts);
      var at = ER.poly.pointAt(rd.pts, len * 0.5);
      if (Math.abs(at.x - cam.cx) > cam.w / (2 * cam.ppm) || Math.abs(at.y - cam.cy) > cam.h / (2 * cam.ppm)) continue;
      var sx = at.x * cam.ppm + cam.ox, sy = at.y * cam.ppm + cam.oy;
      var p0 = rd.pts[at.seg], p1 = rd.pts[at.seg + 1];
      var ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
      if (ang > Math.PI / 2) ang -= Math.PI;
      if (ang < -Math.PI / 2) ang += Math.PI;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(ang);
      ctx.fillStyle = 'rgba(28,24,18,0.42)';
      ctx.fillText(rd.name.toUpperCase(), 0, 1);
      ctx.fillStyle = 'rgba(250,244,228,0.62)';
      ctx.fillText(rd.name.toUpperCase(), 0, 0);
      ctx.restore();
    }
    ctx.restore();
  };

  /* what the game calls once a frame */
  Scene2D.prototype.update = function (game, dt) {
    this.game = game;
    this.t += dt;
    this.light.update(this.clock);
  };

  /* Where the speech bubbles go. From above a resident is a dot on the
     paving, so the bubble sits directly over it — no projection, no rig
     height, no checking whether the camera can see their head. */
  Scene2D.prototype.bubblePositions = function (people, view) {
    var out = [];
    if (!people) return out;
    var cam = view.camera2d();
    for (var i = 0; i < people.length; i++) {
      var r = people[i];
      if (!r.say || r.away) continue;
      var sx = r.x * cam.ppm + cam.ox, sy = r.y * cam.ppm + cam.oy;
      out.push({
        res: r,
        x: sx, y: sy - 18,
        dist: U.dist(r.x, r.y, view.pos.x, view.pos.z),
        onScreen: sx > -60 && sx < cam.w + 60 && sy > -20 && sy < cam.h + 60
      });
    }
    return out;
  };

  /* the interface the first-person scene had, so game.js and the tests can
     ask the same questions of both */
  Scene2D.prototype.updateWindows = function () {};
  Scene2D.prototype.updateLamps = function () {};
  Scene2D.prototype.updateGrass = function () {};

  /* ---------------- little helpers ---------------- */

  function dot(ctx, x, y, r) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
  }
  function ring(ctx, x, y, r) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.stroke();
  }
  function strokePoly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  }
  /* The ground a wall of this height hides from the sun: the footprint moved
     along the shadow vector, plus the two strips swept out behind its leading
     edges. Drawn as one path, in one direction, so the nonzero winding rule
     fills all of it — the first attempt overlapped four closed subpaths and
     the middle of every shadow cancelled itself out. */
  function shadowQuad(ctx, rect, dx, dy) {
    var x = rect[0], y = rect[1], w = rect[2], h = rect[3];
    /* the two corners the light leaves first, and the two it leaves last */
    var x0 = dx >= 0 ? x : x + w, x1 = dx >= 0 ? x + w : x;
    var y0 = dy >= 0 ? y : y + h, y1 = dy >= 0 ? y + h : y;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y0);
    ctx.lineTo(x1 + dx, y0 + dy);
    ctx.lineTo(x1 + dx, y1 + dy);
    ctx.lineTo(x0 + dx, y1 + dy);
    ctx.lineTo(x0, y1);
    ctx.closePath();
    ctx.fill();
  }
  function frontMid(rect, face) {
    var x = rect[0], y = rect[1], w = rect[2], h = rect[3];
    if (face === 'n') return { x: x + w / 2, y: y - 0.05 };
    if (face === 's') return { x: x + w / 2, y: y + h + 0.05 };
    if (face === 'w') return { x: x - 0.05, y: y + h / 2 };
    return { x: x + w + 0.05, y: y + h / 2 };
  }

  ER.Scene2D = Scene2D;
  ER.scene2dInternals = { GLYPH: GLYPH, glyphFor: glyphFor, buildTiles: buildTiles, PPT: PPT };
})(typeof window !== 'undefined' ? (window.ER = window.ER || {}) : (global.ER = global.ER || {}));
