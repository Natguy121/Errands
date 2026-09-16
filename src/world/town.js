/* Errands — Batroun, the old quarter. Fifty metres by fifty.
 *
 * One block of the souk, the alley of steps, a fountain square, the
 * Phoenician wall and the sea behind it. Eighteen sandstone houses packed
 * tight enough that you hear the neighbours, and about two hundred small
 * things you can walk up to and press E on.
 *
 * Everything is hand-laid at this scale. Fifty metres does not leave room
 * for a procedural street grid to be wrong in, so the alleys and the houses
 * are placed by hand and then checked by validateLayout(), which the headless
 * tests run: no two buildings may overlap, and nothing may stand in an alley.
 */
(function (ER) {
  'use strict';
  var U = ER.U;
  var N = ER.Names || {};

  var W = 50, H = 50;          /* metres. the whole world. */
  var CELL = 0.35;             /* collision grid. alleys are 1.7 m wide. */

  /* ------------------------------------------------------------------ *
   *  the alleys. narrow, stone, and older than the houses on them.
   * ------------------------------------------------------------------ */

  function alleyDefs() {
    return [
      { id: 'quay', name: 'Rue de la Mer', kind: 'stone', width: 3.4, shoulder: 0.35,
        pts: [[8.2, 1.6], [8.0, 14], [8.5, 26], [8.1, 38], [8.3, 48.4]] },

      { id: 'souk', name: 'Souk el Qadim', kind: 'stone', width: 3.0, shoulder: 0.3,
        pts: [[6.8, 26.2], [18, 25.4], [30, 24.6], [40, 24.2], [47.6, 23.7]] },

      /* the alley of steps. it climbs the shelf the quarter is built on. */
      { id: 'daraj', name: 'Darb el Daraj', kind: 'steps', width: 2.2, shoulder: 0.2, steps: true,
        pts: [[19.4, 26.6], [20.4, 18], [21.6, 12], [22.3, 8.4]] },

      { id: 'mina', name: 'Bab el Mina', kind: 'stone', width: 2.6, shoulder: 0.25,
        pts: [[13.7, 23.4], [13.4, 27.5], [13.0, 34], [12.6, 44], [12.8, 48.4]] },

      /* the narrow one. you turn your shoulders to pass someone. */
      { id: 'zaroub', name: 'Ez-Zaroub', kind: 'stone', width: 1.7, shoulder: 0.15,
        pts: [[27.1, 23.2], [27.9, 32], [28.4, 39], [28.1, 44.2]] },

      { id: 'aliya', name: 'Darb el Aaliye', kind: 'stone', width: 2.4, shoulder: 0.25,
        pts: [[6.9, 11.9], [22, 11.0], [34, 10.4], [46.8, 9.8]] },

      { id: 'tahta', name: 'Darb et Tahta', kind: 'stone', width: 2.6, shoulder: 0.25,
        pts: [[7.1, 43.9], [24, 42.8], [36, 42.2], [46.4, 41.7]] },

      { id: 'sharq', name: 'Darb esh Sharq', kind: 'stone', width: 2.4, shoulder: 0.25,
        pts: [[46.2, 8.2], [45.2, 24.0], [44.6, 36], [44.9, 43.0]] }
    ];
  }

  /* the sea, and the wall the Phoenicians cut to keep it out of the harbour */
  function seaDef() {
    return {
      /* the water surface is at zero. the land climbs away from it. */
      level: 0,
      edge: 6.2,                                   /* where the rock goes under */
      wall: { x: 6.3, halfWidth: 0.85, top: 2.5,   /* the crest, walkable */
        pts: [[6.3, 0], [6.25, 12], [6.4, 26], [6.2, 38], [6.35, 50]] }
    };
  }

  /* ------------------------------------------------------------------ *
   *  polyline helpers
   * ------------------------------------------------------------------ */

  function polyPointAt(pts, s) {
    var acc = 0, i;
    for (i = 0; i < pts.length - 1; i++) {
      var d = U.dist(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
      if (acc + d >= s) {
        var t = (s - acc) / d;
        return { x: U.lerp(pts[i][0], pts[i + 1][0], t), y: U.lerp(pts[i][1], pts[i + 1][1], t), seg: i };
      }
      acc += d;
    }
    var last = pts[pts.length - 1];
    return { x: last[0], y: last[1], seg: pts.length - 2 };
  }

  function polyLength(pts) {
    var acc = 0;
    for (var i = 0; i < pts.length - 1; i++) acc += U.dist(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    return acc;
  }

  function polyNearest(pts, x, y) {
    var best = { d: Infinity, x: 0, y: 0, seg: 0, t: 0, s: 0 }, acc = 0;
    for (var i = 0; i < pts.length - 1; i++) {
      var r = U.segDist(x, y, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
      var segLen = U.dist(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
      if (r.d < best.d) best = { d: r.d, x: r.x, y: r.y, seg: i, t: r.t, s: acc + segLen * r.t };
      acc += segLen;
    }
    return best;
  }

  function polyNormal(pts, seg) {
    var a = pts[seg], b = pts[seg + 1];
    var dx = b[0] - a[0], dy = b[1] - a[1];
    var len = Math.hypot(dx, dy) || 1;
    return { x: -dy / len, y: dx / len, tx: dx / len, ty: dy / len };
  }

  function segIntersect(p1, p2, p3, p4) {
    var d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0]);
    if (Math.abs(d) < 1e-9) return null;
    var t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d;
    var u = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d;
    if (t < 0 || t > 1 || u < 0 || u > 1) return null;
    return { x: p1[0] + t * (p2[0] - p1[0]), y: p1[1] + t * (p2[1] - p1[1]) };
  }

  function polyIntersect(a, b) {
    for (var i = 0; i < a.length - 1; i++) {
      for (var j = 0; j < b.length - 1; j++) {
        var p = segIntersect(a[i], a[i + 1], b[j], b[j + 1]);
        if (p) return p;
      }
    }
    return null;
  }

  ER.poly = { pointAt: polyPointAt, length: polyLength, nearest: polyNearest,
    normal: polyNormal, intersect: polyIntersect };

  /* ------------------------------------------------------------------ *
   *  the houses. sandstone, two storeys, triple-arched window on the
   *  first floor, tile roof, shutters painted whatever was going.
   * ------------------------------------------------------------------ */

  /* Hand-laid: id, rect, the alley it answers to, which way the door faces,
     storeys, and the street number painted by the door. */
  function houseDefs() {
    return [
      { id: 'h01', rect: [11.6, 13.2, 6.2, 3.6], road: 'aliya',  face: 'n', storeys: 2, number: 3 },
      { id: 'h02', rect: [14.2, 17.4, 4.2, 4.0], road: 'souk',   face: 's', storeys: 2, number: 5 },
      { id: 'h03', rect: [23.0, 13.0, 4.6, 4.0], road: 'aliya',  face: 'n', storeys: 2, number: 7 },
      { id: 'h04', rect: [28.4, 13.0, 4.6, 4.0], road: 'aliya',  face: 'n', storeys: 2, number: 9 },
      { id: 'h05', rect: [34.0, 13.0, 4.6, 4.0], road: 'aliya',  face: 'n', storeys: 1, number: 11 },
      { id: 'h06', rect: [23.0, 18.0, 4.0, 3.4], road: 'souk',   face: 's', storeys: 2, number: 13 },
      { id: 'h07', rect: [33.2, 18.0, 4.4, 3.4], road: 'souk',   face: 's', storeys: 2, number: 15 },
      { id: 'h08', rect: [15.4, 30.4, 4.6, 3.6], road: 'mina',   face: 'w', storeys: 2, number: 17 },
      { id: 'h09', rect: [20.4, 30.4, 4.4, 3.6], road: 'zaroub', face: 'e', storeys: 2, number: 19 },
      { id: 'h10', rect: [15.4, 35.4, 4.6, 4.0], road: 'tahta',  face: 's', storeys: 2, number: 21 },
      { id: 'h11', rect: [29.6, 34.8, 4.6, 4.2], road: 'souk',   face: 'n', storeys: 2, number: 23 },
      { id: 'h12', rect: [35.2, 34.8, 4.4, 4.2], road: 'souk',   face: 'n', storeys: 1, number: 25 },
      { id: 'h13', rect: [38.6, 30.2, 3.4, 3.4], road: 'souk',   face: 'w', storeys: 2, number: 6 },
      { id: 'h14', rect: [23.2,  2.2, 4.6, 4.4], road: 'aliya',  face: 's', storeys: 2, number: 2 },
      { id: 'h15', rect: [29.2,  2.2, 4.6, 4.4], road: 'aliya',  face: 's', storeys: 2, number: 4 },
      { id: 'h16', rect: [35.0,  2.2, 4.8, 4.4], road: 'aliya',  face: 's', storeys: 1, number: 8 },
      { id: 'h17', rect: [22.4, 44.6, 4.2, 3.0], road: 'tahta',  face: 'n', storeys: 2, number: 10 },
      { id: 'h18', rect: [36.4, 44.6, 4.2, 3.0], road: 'tahta',  face: 'n', storeys: 1, number: 12 }
    ];
  }

  /* everything that is not somebody's house */
  function buildingDefs() {
    return [
      { id: 'chapel', name: 'Saydet el Bahr', kind: 'chapel', rect: [11.2, 2.4, 5.4, 4.4],
        road: 'quay', face: 's', where: 'the rocks at the top of the quay' },
      { id: 'samke', name: "the fishermen's shed", kind: 'shed', rect: [11.4, 17.4, 2.2, 3.2],
        road: 'quay', face: 'w', where: 'the quay' },
      { id: 'furn', name: 'the furn', kind: 'bakery', rect: [15.2, 27.6, 3.2, 2.2],
        road: 'souk', face: 'n', shop: 'furn', where: 'the souk' },
      { id: 'lemonade', name: "Abou Georges' lemonade stand", kind: 'kiosk', rect: [20.9, 27.6, 2.8, 2.0],
        road: 'souk', face: 'n', shop: 'lemonade', where: 'the souk' },
      { id: 'sabon', name: 'the soap shop', kind: 'shop', rect: [28.8, 18.6, 3.2, 2.8],
        road: 'souk', face: 's', shop: 'sabon', where: 'the souk' },
      { id: 'barber', name: "Tony's barber shop", kind: 'shop', rect: [38.6, 18.6, 3.0, 2.8],
        road: 'souk', face: 's', shop: null, where: 'the souk' },
      { id: 'qahwe', name: 'the qahwe', kind: 'cafe', rect: [38.8, 26.6, 3.4, 2.6],
        road: 'souk', face: 'n', shop: 'qahwe', where: 'the souk' },
      { id: 'mahjour', name: 'the abandoned house', kind: 'ruin', rect: [22.0, 35.0, 3.8, 3.2],
        road: 'zaroub', face: 'e', derelict: true, where: 'the zaroub' },
      { id: 'dukkan', name: 'the dukkan', kind: 'shop', rect: [16.4, 44.6, 4.0, 3.0],
        road: 'tahta', face: 'n', shop: 'dukkan', where: 'Darb et Tahta' },
      { id: 'beit_teta', name: "Teta Therese's house", kind: 'house', rect: [30.2, 44.6, 4.4, 3.2],
        road: 'tahta', face: 'n', storeys: 2, where: 'Darb et Tahta' }
    ];
  }

  /* the fountain square, and the other places somebody bothered to pave */
  function pavingDefs() {
    return [
      { x: 30.6, y: 27.2, w: 7.0, h: 5.8, kind: 'flag' },    /* Sahat en-Nafoura */
      { x: 7.0, y: 1.6, w: 3.2, h: 46.8, kind: 'quay' },     /* the quay itself */
      { x: 8.6, y: 8.2, w: 6.2, h: 1.8, kind: 'flag' },      /* the chapel forecourt */
      { x: 9.0, y: 44.6, w: 4.0, h: 4.2, kind: 'slip' },     /* the slipway */
      { x: 38.0, y: 10.8, w: 3.0, h: 1.8, kind: 'flag' }     /* the bench landing */
    ];
  }

  /* ------------------------------------------------------------------ *
   *  searchable ground. holding E in one of these turns up mostly junk.
   * ------------------------------------------------------------------ */

  var SEARCH_POOLS = {
    ruin: ['a rusted nail', 'a shard of floor tile', 'a dry wasp nest', 'half a roof tile',
      'a bent spoon', 'a page of a 1974 newspaper', 'a door hinge', 'a cracked marble'],
    shore: ['a worn scrap of blue glass', 'a limpet shell', 'a lump of shore clay',
      'a bottle cap', 'a length of net twine', 'a sea urchin spine', 'a flat black pebble'],
    lostfound: ['one earring', 'a key with no label', 'a rosary bead', 'a bus token',
      'a prayer card', 'a lighter that still works', 'a child’s hair clip'],
    cracks: ['a coin worn smooth', 'a shirt button', 'a fish hook', 'a pistachio shell',
      'a bottle cap', 'a nail', 'a fragment of tile']
  };

  /* ------------------------------------------------------------------ *
   *  props — everything you can walk up to and press E on
   * ------------------------------------------------------------------ */

  function prop(town, o) {
    o.r = o.r || 1.1;
    o.verbs = o.verbs || ['LOOK'];
    o.tags = o.tags || [];
    if (!o.name) o.name = o.id;
    town.props[o.id] = o;
    town.propList.push(o);
    return o;
  }

  /* where the door of a rect-shaped thing ends up, and the spot in the alley
     in front of it you would stand on to knock */
  function facePoint(rect, face, out) {
    var x = rect[0], y = rect[1], w = rect[2], h = rect[3];
    if (face === 'n') return { x: x + w * 0.5, y: y - out };
    if (face === 's') return { x: x + w * 0.5, y: y + h + out };
    if (face === 'w') return { x: x - out, y: y + h * 0.5 };
    return { x: x + w + out, y: y + h * 0.5 };
  }

  ER.SEARCH_POOLS = SEARCH_POOLS;

  /* Somewhere you can actually stand: walk outward from the wall until the
     collision grid lets go. Fifty metres of alley leaves no slack for a prop
     you cannot get to. */
  function standable(town, x, y, dx, dy) {
    for (var s = 0; s <= 2.4; s += 0.3) {
      var px = x + dx * s, py = y + dy * s;
      if (!town.isBlocked(px, py)) return { x: px, y: py };
    }
    for (var a = 0; a < 16; a++) {
      var ang = a / 16 * Math.PI * 2;
      for (var r = 0.5; r <= 2.6; r += 0.3) {
        var qx = x + Math.cos(ang) * r, qy = y + Math.sin(ang) * r;
        if (!town.isBlocked(qx, qy)) return { x: qx, y: qy };
      }
    }
    return { x: x, y: y };
  }

  /* The spot in the alley you would stand on to be served, or to knock.
     Derived from the frontage rather than written down, so moving a building
     by a metre does not leave its counter behind in the middle of the souk --
     which is exactly what happened the first time these were hand-placed. */
  function frontOf(town, b, along, out) {
    var f = b.face;
    var dx = f === 'w' ? -1 : (f === 'e' ? 1 : 0);
    var dy = f === 'n' ? -1 : (f === 's' ? 1 : 0);
    var base = facePoint(b.rect, f, out === undefined ? 1.1 : out);
    if (dx === 0) base.x += along; else base.y += along;
    return standable(town, base.x, base.y, dx, dy);
  }

  function buildProps(town, rng) {
    var p = function (o) { return prop(town, o); };
    var wall = town.sea.wall, sq = town.square;
    var B = town.buildingById;
    var at = function (id, along, out) { return frontOf(town, B[id], along || 0, out); };

    /* ---- the sea, and the wall the Phoenicians cut ---- */
    p({ id: 'wall_channel', name: 'the channel cut through the Phoenician wall',
      x: wall.x + 1.6, y: 21.4, r: 1.6, verbs: ['FILL', 'LISTEN', 'LOOK'], landmark: true,
      photo: true, searchPool: 'shore', where: 'the sea wall', tags: ['sea', 'wall', 'water'] });
    p({ id: 'wall_third_stone', name: 'the third stone from the chapel end',
      x: wall.x + 1.5, y: 9.8, r: 1.2, verbs: ['SCRAPE', 'TOUCH', 'LOOK'],
      where: 'the sea wall', tags: ['wall', 'moss', 'stone'] });
    p({ id: 'wall_mooring', name: 'the iron mooring ring in the wall',
      x: wall.x + 1.5, y: 30.6, r: 1.1, verbs: ['SCRAPE', 'TOUCH', 'LOOK'],
      where: 'the sea wall', tags: ['wall', 'iron', 'rust'] });
    p({ id: 'wall_letter', name: 'the stone with a letter cut into it',
      x: wall.x + 1.5, y: 16.2, r: 1.1, verbs: ['TRACE', 'RUB', 'TOUCH'], photo: true,
      where: 'the sea wall', tags: ['wall', 'stone', 'letter'] });
    p({ id: 'wall_urchins', name: 'the urchin shells somebody lined up on the wall',
      x: wall.x + 1.5, y: 35.8, r: 1.1, verbs: ['COUNT', 'TAKE', 'LOOK'],
      where: 'the sea wall', tags: ['wall', 'shell'] });
    p({ id: 'wall_capers', name: 'the capers growing out of the wall',
      x: wall.x + 1.5, y: 26.8, r: 1.2, verbs: ['PICK', 'LOOK'],
      where: 'the sea wall', tags: ['wall', 'caper', 'plant'] });
    p({ id: 'shore_clay', name: 'the grey clay under the wall',
      x: wall.x + 1.5, y: 40.4, r: 1.3, verbs: ['DIG', 'TAKE'],
      searchPool: 'shore', where: 'below the sea wall', tags: ['clay', 'shore'] });
    p({ id: 'sea_steps', name: 'the steps cut down into the water',
      x: wall.x + 1.6, y: 44.0, r: 1.4, verbs: ['COUNT', 'SIT', 'LOOK'], landmark: true,
      where: 'the sea wall', tags: ['sea', 'steps'] });

    /* ---- the quay ---- */
    p({ id: 'quay_nets', name: 'the nets drying on the quay',
      x: 9.2, y: 21.6, r: 1.4, verbs: ['TOUCH', 'SEARCH', 'LOOK'], searchPool: 'shore',
      photo: true, where: 'the quay', tags: ['net', 'twine'] });
    p({ id: 'quay_boat', name: 'the blue boat pulled up on the slipway',
      x: 9.6, y: 46.2, r: 1.8, verbs: ['TOUCH', 'LOOK'], photo: true, landmark: true,
      where: 'the slipway', tags: ['boat', 'blue', 'paint'] });
    p({ id: 'quay_anchor', name: 'the anchor nobody has moved in thirty years',
      x: 9.2, y: 43.2, r: 1.3, verbs: ['SCRAPE', 'TOUCH', 'LOOK'], photo: true,
      where: 'the slipway', tags: ['iron', 'rust', 'anchor'] });
    p({ id: 'quay_tar', name: 'the tar the boats have left on the slip',
      x: 9.4, y: 47.6, r: 1.2, verbs: ['TAKE', 'TOUCH'],
      where: 'the slipway', tags: ['tar', 'slip'] });
    p({ id: 'samke_door', name: "the fishermen's shed",
      x: at('samke').x, y: at('samke').y, r: 1.3, verbs: ['LISTEN', 'LOOK'],
      where: 'the quay', tags: ['shed', 'fish'] });
    p({ id: 'quay_hooks', name: 'the box of hooks outside the shed',
      x: at('samke', 1.3, 1.0).x, y: at('samke', 1.3, 1.0).y, r: 1.1,
      verbs: ['SEARCH', 'LOOK'], searchPool: 'shore',
      where: 'the quay', tags: ['hook', 'iron'] });

    /* ---- Saydet el Bahr ---- */
    var chapel = B.chapel;
    p({ id: 'chapel_door', name: 'the door of Saydet el Bahr',
      rect: { x: chapel.rect[0], y: chapel.rect[1], w: chapel.rect[2], h: chapel.rect[3] },
      verbs: ['ENTER', 'LOOK'], landmark: true, photo: true,
      where: 'the rocks at the top of the quay', tags: ['chapel', 'door'] });
    p({ id: 'chapel_bell', name: 'the bell rope at Saydet el Bahr',
      x: at('chapel', -1.8).x, y: at('chapel', -1.8).y, r: 1.2,
      verbs: ['LISTEN', 'TOUCH', 'LOOK'], where: 'the chapel', tags: ['bell', 'rope'] });
    p({ id: 'chapel_step', name: 'the step at Saydet el Bahr, worn to a dish',
      x: at('chapel', 0, 0.9).x, y: at('chapel', 0, 0.9).y, r: 1.2,
      verbs: ['MEASURE', 'TOUCH', 'SIT'], where: 'the chapel', tags: ['step', 'stone'] });
    p({ id: 'chapel_candles', name: 'the candle stand inside the chapel door',
      x: at('chapel', 1.6).x, y: at('chapel', 1.6).y, r: 1.1,
      verbs: ['COUNT', 'LOOK'], where: 'the chapel', tags: ['candle', 'wax'] });
    p({ id: 'chapel_cross', name: 'the iron cross on the chapel roof',
      x: at('chapel', 0, 1.6).x, y: at('chapel', 0, 1.6).y, r: 1.4,
      verbs: ['LOOK'], photo: true, up: 5.2, where: 'the chapel', tags: ['cross', 'iron'] });
    p({ id: 'chapel_tap', name: 'the tap on the chapel wall',
      x: at('chapel', -2.4, 1.4).x, y: at('chapel', -2.4, 1.4).y, r: 1.1,
      verbs: ['FILL', 'LOOK'], where: 'the chapel', tags: ['tap', 'water'] });
    p({ id: 'chapel_mint', name: 'the mint in the tin by the chapel door',
      x: at('chapel', 2.2, 1.3).x, y: at('chapel', 2.2, 1.3).y, r: 1.0,
      verbs: ['PICK', 'LOOK'], where: 'the chapel', tags: ['mint', 'plant'] });

    /* ---- the fountain square ---- */
    p({ id: 'fountain', name: 'the fountain in Sahat en-Nafoura',
      x: sq.fountain.x, y: sq.fountain.y + 1.6, r: 1.7, verbs: ['FILL', 'LISTEN', 'LOOK'],
      landmark: true, photo: true, where: 'the fountain square', tags: ['fountain', 'water'] });
    p({ id: 'fountain_spout', name: 'the brass spout of the fountain',
      x: sq.fountain.x - 1.7, y: sq.fountain.y, r: 1.1, verbs: ['SCRAPE', 'TOUCH', 'WIPE'],
      where: 'the fountain square', tags: ['brass', 'spout'] });
    p({ id: 'square_bench', name: 'the stone bench in the square, worn smooth',
      x: sq.x + 1.0, y: sq.y + sq.h - 1.0, r: 1.3, verbs: ['SIT', 'MEASURE', 'LOOK'],
      where: 'the fountain square', tags: ['bench', 'stone'] });
    p({ id: 'square_tile', name: 'the one broken tile in the square floor',
      x: sq.x + sq.w - 1.2, y: sq.y + 1.1, r: 1.1, verbs: ['TOUCH', 'LOOK', 'CHIP'],
      where: 'the fountain square', tags: ['tile', 'broken'] });
    p({ id: 'square_fig', name: 'the fig tree in the corner of the square',
      x: sq.x + sq.w - 1.1, y: sq.y + sq.h - 1.1, r: 1.5, verbs: ['TAKE LEAF', 'PICK', 'LOOK'],
      photo: true, where: 'the fountain square', tags: ['fig', 'tree', 'leaf'] });
    p({ id: 'square_cracks', name: 'the cracks between the flagstones',
      x: sq.x + 2.6, y: sq.y + sq.h - 1.5, r: 1.4, verbs: ['SEARCH', 'LOOK'],
      searchPool: 'cracks', where: 'the fountain square', tags: ['cracks', 'paving'] });
    p({ id: 'square_shrine', name: 'the niche with the Virgin in it',
      x: sq.x + 1.2, y: sq.y + 0.9, r: 1.2, verbs: ['PLACE', 'LOOK', 'SPEAK'],
      photo: true, where: 'the fountain square', tags: ['shrine', 'niche'] });

    /* ---- the souk ---- */
    p({ id: 'lemonade_counter', name: "the counter at Abou Georges' lemonade stand",
      x: at('lemonade').x, y: at('lemonade').y, r: 1.4, verbs: ['BUY', 'LOOK'],
      shop: 'lemonade', landmark: true, where: 'the souk', tags: ['shop', 'lemonade'] });
    p({ id: 'lemonade_crates', name: 'the crates of lemons stacked by the stand',
      x: at('lemonade', -1.4, 1.0).x, y: at('lemonade', -1.4, 1.0).y, r: 1.2,
      verbs: ['COUNT', 'TAKE', 'LOOK'], where: 'the souk', tags: ['lemon', 'crate'] });
    p({ id: 'lemonade_press', name: 'the lemon press, which has never been washed',
      x: at('lemonade', 1.5, 1.0).x, y: at('lemonade', 1.5, 1.0).y, r: 1.1,
      verbs: ['WIPE', 'LOOK'], where: 'the souk', tags: ['press', 'brass'] });
    p({ id: 'furn_counter', name: 'the counter at the furn',
      x: at('furn').x, y: at('furn').y, r: 1.4, verbs: ['BUY', 'LOOK'],
      shop: 'furn', landmark: true, where: 'the souk', tags: ['shop', 'bread'] });
    p({ id: 'furn_oven', name: 'the mouth of the oven at the furn',
      x: at('furn', -1.3, 1.0).x, y: at('furn', -1.3, 1.0).y, r: 1.2,
      verbs: ['LOOK', 'TOUCH'], photo: true, where: 'the souk', tags: ['oven', 'fire'] });
    p({ id: 'sabon_counter', name: 'the counter at the soap shop',
      x: at('sabon').x, y: at('sabon').y, r: 1.3, verbs: ['BUY', 'LOOK'],
      shop: 'sabon', where: 'the souk', tags: ['shop', 'soap'] });
    p({ id: 'sabon_stack', name: 'the pyramid of olive-oil soap',
      x: at('sabon', -1.3, 1.0).x, y: at('sabon', -1.3, 1.0).y, r: 1.2,
      verbs: ['COUNT', 'TOUCH', 'LOOK'], photo: true, where: 'the souk', tags: ['soap', 'stack'] });
    p({ id: 'qahwe_counter', name: 'the counter at the qahwe',
      x: at('qahwe').x, y: at('qahwe').y, r: 1.4, verbs: ['BUY', 'LOOK'],
      shop: 'qahwe', landmark: true, where: 'the souk', tags: ['shop', 'coffee'] });
    p({ id: 'qahwe_chairs', name: 'the plastic chairs outside the qahwe',
      x: at('qahwe', -1.6, 1.5).x, y: at('qahwe', -1.6, 1.5).y, r: 1.4,
      verbs: ['SIT', 'COUNT', 'LOOK'], where: 'the souk', tags: ['chair', 'plastic'] });
    p({ id: 'qahwe_arghile', name: 'the arghile somebody left on a stool',
      x: at('qahwe', 1.6, 1.2).x, y: at('qahwe', 1.6, 1.2).y, r: 1.1,
      verbs: ['LOOK', 'LISTEN'], photo: true, where: 'the souk', tags: ['arghile', 'coal'] });
    p({ id: 'qahwe_board', name: 'the backgammon board, mid-game, unattended',
      x: at('qahwe', 0, 2.3).x, y: at('qahwe', 0, 2.3).y, r: 1.2,
      verbs: ['COUNT', 'LOOK'], photo: true, where: 'the souk', tags: ['backgammon', 'board'] });
    p({ id: 'barber_pole', name: "the barber's pole, which does not turn",
      x: at('barber', 1.2, 1.0).x, y: at('barber', 1.2, 1.0).y, r: 1.1,
      verbs: ['TOUCH', 'LOOK'], photo: true, where: 'the souk', tags: ['barber', 'pole'] });
    p({ id: 'barber_chair', name: "the chair in Tony's barber shop",
      x: at('barber').x, y: at('barber').y, r: 1.2, verbs: ['SIT', 'LOOK'],
      where: 'the souk', tags: ['barber', 'chair'] });
    p({ id: 'dukkan_counter', name: 'the counter at the dukkan',
      x: at('dukkan').x, y: at('dukkan').y, r: 1.4, verbs: ['BUY', 'LOOK'],
      shop: 'dukkan', landmark: true, where: 'Darb et Tahta', tags: ['shop', 'dukkan'] });
    p({ id: 'dukkan_lostbox', name: 'the box of things left at the dukkan',
      x: at('dukkan', -1.6, 1.0).x, y: at('dukkan', -1.6, 1.0).y, r: 1.2,
      verbs: ['SEARCH', 'LOOK'], searchPool: 'lostfound',
      where: 'Darb et Tahta', tags: ['lostfound', 'box'] });
    p({ id: 'dukkan_crates', name: 'the crates stacked outside the dukkan',
      x: at('dukkan', 1.7, 1.0).x, y: at('dukkan', 1.7, 1.0).y, r: 1.2,
      verbs: ['COUNT', 'SEARCH', 'LOOK'], searchPool: 'cracks',
      where: 'Darb et Tahta', tags: ['crate'] });

    /* ---- the fixtures nobody looks at ---- */
    p({ id: 'souk_lamp', name: 'the streetlamp on the souk that is going',
      x: 33.4, y: 26.0, r: 1.4, verbs: ['STAND', 'LOOK'], photo: true, landmark: true,
      dying: true, up: 3.4, where: 'the souk', tags: ['lamp', 'light', 'dying'] });
    p({ id: 'souk_wires', name: 'the knot of wires at the pole on the souk',
      x: 36.2, y: 26.0, r: 1.3, verbs: ['COUNT', 'LOOK'], photo: true, up: 3.0,
      where: 'the souk', tags: ['wires', 'pole'] });
    p({ id: 'souk_meters', name: 'the bank of electricity meters',
      x: 31.4, y: 22.6, r: 1.2, verbs: ['READ', 'COUNT', 'LOOK'], photo: true,
      where: 'the souk', tags: ['meter', 'electric'] });
    p({ id: 'souk_generator', name: "the quarter's generator",
      x: 26.6, y: 26.4, r: 1.3, verbs: ['LISTEN', 'LOOK'],
      where: 'the souk', tags: ['generator', 'diesel'] });
    p({ id: 'souk_posters', name: 'the posters pasted over each other on the wall',
      x: 28.2, y: 22.6, r: 1.3, verbs: ['READ', 'PEEL', 'LOOK'], photo: true,
      where: 'the souk', tags: ['poster', 'paper'] });
    p({ id: 'souk_sign', name: 'the enamel street sign at the corner of the souk',
      x: 24.2, y: 26.4, r: 1.2, verbs: ['READ', 'LOOK'], photo: true,
      where: 'the souk', tags: ['sign', 'enamel'] });
    p({ id: 'souk_moped', name: 'the moped leaning on the wall of the souk',
      x: 37.8, y: 22.4, r: 1.3, verbs: ['TOUCH', 'LOOK'], photo: true,
      where: 'the souk', tags: ['moped', 'mirror'] });
    p({ id: 'souk_taxi', name: 'the Mercedes parked where the souk gives out',
      x: 46.6, y: 20.4, r: 1.8, verbs: ['SCRAPE', 'WIPE', 'LOOK'], photo: true,
      where: 'the east end of the souk', tags: ['car', 'windshield', 'mercedes'] });
    p({ id: 'souk_cat_blue', name: 'the cat that sits on the blue door',
      x: 34.8, y: 22.4, r: 1.2, verbs: ['LOOK', 'SPEAK'], photo: true, cat: true,
      where: 'the souk', tags: ['cat', 'blue'] });
    p({ id: 'square_cat', name: 'the cat that owns the fountain square',
      x: sq.x + 4.4, y: sq.y + 0.9, r: 1.2, verbs: ['LOOK', 'SPEAK'], photo: true, cat: true,
      where: 'the fountain square', tags: ['cat'] });
    p({ id: 'quay_cat', name: 'the cat that waits outside the fishermen’s shed',
      x: 9.4, y: 18.0, r: 1.2, verbs: ['LOOK', 'SPEAK'], photo: true, cat: true,
      where: 'the quay', tags: ['cat'] });

    /* ---- the alley of steps ---- */
    p({ id: 'daraj_steps', name: 'the steps of Darb el Daraj',
      x: 20.9, y: 15.6, r: 1.6, verbs: ['COUNT', 'MEASURE', 'LOOK'], landmark: true, photo: true,
      where: 'the alley of steps', tags: ['steps', 'stone'] });
    p({ id: 'daraj_broken', name: 'the cracked tread, eleven up',
      x: 21.4, y: 13.2, r: 1.1, verbs: ['MEASURE', 'TOUCH', 'CHIP'],
      where: 'the alley of steps', tags: ['steps', 'broken', 'stone'] });
    p({ id: 'daraj_railing', name: 'the iron railing on the steps',
      x: 20.5, y: 18.6, r: 1.2, verbs: ['SCRAPE', 'TOUCH', 'LOOK'],
      where: 'the alley of steps', tags: ['iron', 'rust', 'railing'] });
    p({ id: 'daraj_cactus', name: 'the prickly pear growing out of the wall',
      x: 22.2, y: 9.4, r: 1.2, verbs: ['LOOK', 'TOUCH'], photo: true,
      where: 'the alley of steps', tags: ['cactus', 'plant'] });
    p({ id: 'daraj_drip', name: 'the drainpipe on the steps that drips',
      x: 20.1, y: 21.6, r: 1.2, verbs: ['LISTEN', 'FILL', 'LOOK'],
      where: 'the alley of steps', tags: ['pipe', 'drip', 'water'] });
    p({ id: 'daraj_cracks', name: 'the gaps between the treads',
      x: 20.7, y: 17.2, r: 1.2, verbs: ['SEARCH', 'LOOK'], searchPool: 'cracks',
      where: 'the alley of steps', tags: ['cracks', 'steps'] });

    /* ---- the zaroub, and the house nobody has lived in ---- */
    var ruin = B.mahjour;
    p({ id: 'mahjour_room', name: 'the room in the abandoned house where the roof came down',
      rect: { x: ruin.rect[0], y: ruin.rect[1], w: ruin.rect[2], h: ruin.rect[3] },
      verbs: ['SEARCH', 'DIG', 'LOOK'], searchPool: 'ruin', landmark: true, photo: true,
      where: 'the zaroub', tags: ['ruin', 'collapsed'] });
    p({ id: 'mahjour_door', name: 'the door of the abandoned house, with a cat flap cut in it',
      x: at('mahjour', -0.9).x, y: at('mahjour', -0.9).y, r: 1.2,
      verbs: ['TOUCH', 'LOOK', 'LISTEN'], photo: true,
      where: 'the zaroub', tags: ['door', 'wood', 'blue'] });
    p({ id: 'mahjour_fig', name: 'the fig that is taking the abandoned house apart',
      x: at('mahjour', 1.1).x, y: at('mahjour', 1.1).y, r: 1.3,
      verbs: ['TAKE LEAF', 'LOOK'], photo: true,
      where: 'the zaroub', tags: ['fig', 'tree', 'leaf'] });
    p({ id: 'mahjour_tiles', name: 'the roof tiles in a heap where they fell',
      x: at('mahjour', 0, 1.9).x, y: at('mahjour', 0, 1.9).y, r: 1.2,
      verbs: ['COUNT', 'TAKE', 'LOOK'], searchPool: 'ruin',
      where: 'the zaroub', tags: ['tile', 'terracotta'] });
    p({ id: 'zaroub_jasmine', name: 'the jasmine that has the whole zaroub',
      x: 29.1, y: 32.6, r: 1.3, verbs: ['PICK', 'LOOK'], photo: true,
      where: 'the zaroub', tags: ['jasmine', 'plant', 'flower'] });
    p({ id: 'zaroub_gas', name: 'the gas canisters chained up in the zaroub',
      x: 29.3, y: 40.2, r: 1.2, verbs: ['COUNT', 'LOOK'],
      where: 'the zaroub', tags: ['gas', 'canister'] });
    p({ id: 'zaroub_cracks', name: 'the gaps in the paving of the zaroub',
      x: 28.0, y: 30.4, r: 1.3, verbs: ['SEARCH', 'LOOK'], searchPool: 'cracks',
      where: 'the zaroub', tags: ['cracks', 'paving'] });
    p({ id: 'zaroub_lamp', name: 'the lamp in the zaroub with a wasp nest in it',
      x: 28.7, y: 37.4, r: 1.2, verbs: ['LOOK'], photo: true, up: 2.8,
      where: 'the zaroub', tags: ['lamp', 'wasp'] });

    /* ---- odds and ends ---- */
    p({ id: 'teta_balcony', name: "Teta Therese's balcony",
      x: at('beit_teta', 0, 1.4).x, y: at('beit_teta', 0, 1.4).y, r: 1.5,
      verbs: ['LOOK', 'SPEAK'], photo: true, up: 3.2,
      where: 'Darb et Tahta', tags: ['balcony', 'iron', 'pots'] });
    p({ id: 'lemon_tree', name: 'the lemon tree in the courtyard behind number 6',
      x: 43.0, y: 33.4, r: 1.4, verbs: ['PICK', 'TAKE LEAF', 'LOOK'], photo: true, landmark: true,
      where: 'behind number 6', tags: ['lemon', 'tree', 'leaf'] });
    p({ id: 'olive_tree', name: 'the olive nobody planted on purpose',
      x: 42.6, y: 39.4, r: 1.4, verbs: ['TAKE LEAF', 'PICK', 'LOOK'], photo: true,
      where: 'Darb esh Sharq', tags: ['olive', 'tree', 'leaf'] });
    p({ id: 'well_lid', name: 'the iron lid over the old cistern',
      x: 19.6, y: 41.0, r: 1.2, verbs: ['LISTEN', 'TOUCH', 'LOOK'], photo: true,
      where: 'Darb et Tahta', tags: ['cistern', 'iron', 'lid'] });
    p({ id: 'bench_landing', name: 'the bench on the landing that looks at the sea',
      x: 39.0, y: 11.9, r: 1.4, verbs: ['SIT', 'LOOK'], photo: true, landmark: true,
      where: 'Darb el Aaliye', tags: ['bench', 'view'] });
    p({ id: 'aliya_laundry', name: 'the line of washing across Darb el Aaliye',
      x: 26.4, y: 10.8, r: 1.5, verbs: ['COUNT', 'LOOK'], photo: true, up: 3.4,
      where: 'Darb el Aaliye', tags: ['laundry', 'line'] });
    p({ id: 'sharq_dish', name: 'the satellite dish on the corner of Darb esh Sharq',
      x: 45.2, y: 31.2, r: 1.4, verbs: ['LOOK'], photo: true, up: 4.2,
      where: 'Darb esh Sharq', tags: ['dish', 'satellite'] });

    /* ---- your own room, at the back of number 6 ---- */
    var hl = town.lots.filter(function (l) { return l.id === town.home.lot; })[0];
    p({ id: 'home_door', name: 'your door, the back one at number ' + hl.number,
      x: hl.stand.x, y: hl.stand.y, r: 1.3, verbs: ['ENTER', 'LOOK'],
      landmark: true, where: 'number ' + hl.number, tags: ['door', 'home'] });
    p({ id: 'home_windowsill', name: 'your windowsill',
      x: standable(town, hl.rect[0] + hl.rect[2] + 1.0, hl.rect[1] + 1.0, 1, 0).x,
      y: standable(town, hl.rect[0] + hl.rect[2] + 1.0, hl.rect[1] + 1.0, 1, 0).y,
      r: 1.3, verbs: ['PLACE', 'LOOK'], landmark: true,
      where: 'your room at number ' + hl.number, tags: ['windowsill', 'home'] });
    p({ id: 'home_roof', name: 'the roof over your room',
      x: hl.stand.x, y: hl.stand.y, r: 1.3, verbs: ['LOOK'], up: 6.0,
      where: 'number ' + hl.number, tags: ['roof', 'home', 'tank'] });

    /* ---- decoys. the fine print has to be able to be wrong about
           something, or being told which stone would mean nothing. ---- */
    p({ id: 'wall_channel_deep', name: 'the deeper channel, further along the wall',
      x: wall.x + 1.6, y: 24.6, r: 1.4, verbs: ['FILL', 'LISTEN', 'LOOK'],
      decoyFor: 'channel', decoyLine: 'This is the deep channel. The errand said the shallow one.',
      where: 'the sea wall', tags: ['sea', 'wall', 'water'] });
    p({ id: 'square_fig_young', name: 'the younger fig by the shrine',
      x: sq.x + 2.0, y: sq.y + 1.0, r: 1.2, verbs: ['TAKE LEAF', 'PICK', 'LOOK'],
      decoyFor: 'fig', decoyLine: 'This one went in nine years ago. The errand said the oldest.',
      where: 'the fountain square', tags: ['fig', 'tree', 'leaf'] });
    p({ id: 'chapel_basil', name: 'the basil in the other tin',
      x: at('chapel', 3.2, 1.3).x, y: at('chapel', 3.2, 1.3).y, r: 1.0,
      verbs: ['PICK', 'LOOK'],
      decoyFor: 'mint', decoyLine: 'This is basil. The mint is in the tin nearer the door.',
      where: 'the chapel', tags: ['basil', 'plant'] });
    p({ id: 'daraj_lower_three', name: 'the three steps at the bottom of the alley',
      x: 20.0, y: 24.2, r: 1.2, verbs: ['COUNT', 'MEASURE', 'LOOK'],
      decoyFor: 'steps', decoyLine: 'These three are the kerb. The flight proper starts above them.',
      where: 'the alley of steps', tags: ['steps', 'stone'] });

    /* ---- and every house, dressed ---- */
    town.lots.forEach(function (l) {
      var f = l.face;
      var dx = f === 'w' ? -1 : (f === 'e' ? 1 : 0);
      var dy = f === 'n' ? -1 : (f === 's' ? 1 : 0);
      var st = standable(town, l.door.x + dx * 0.9, l.door.y + dy * 0.9, dx, dy);
      var alley = (town.roadById[l.road] || {}).name || 'the alley';
      var side = standable(town, l.rect[0] + l.rect[2] * 0.5 - dy * 1.6, l.rect[1] + l.rect[3] * 0.5 - dx * 1.6, -dy, -dx);

      p({ id: 'door_' + l.id, name: 'the door of number ' + l.number + ' on ' + alley,
        x: st.x, y: st.y, r: 1.2, verbs: ['TOUCH', 'LISTEN', 'LOOK'],
        where: alley, lot: l.id, tags: ['door', 'wood', 'knocker'] });

      p({ id: 'shutter_' + l.id, name: 'the shutters of number ' + l.number,
        x: st.x, y: st.y, r: 1.2, verbs: ['LOOK', 'TOUCH'], photo: true, up: 3.6,
        shutter: l.shutter, where: alley, lot: l.id, tags: ['shutter', 'paint', 'blue'] });

      p({ id: 'plate_' + l.id, name: 'the number plate at ' + l.plate.shown + ' ' + alley,
        x: st.x, y: st.y, r: 1.1, verbs: ['READ', 'LOOK'],
        where: alley, lot: l.id, tags: ['plate', 'number'] });

      p({ id: 'meter_' + l.id, name: 'the meter on the wall of number ' + l.number,
        x: side.x, y: side.y, r: 1.1, verbs: ['READ', 'LOOK'],
        where: alley, lot: l.id, tags: ['meter', 'electric'] });

      if (l.features.pots) {
        p({ id: 'pots_' + l.id, name: 'the pots outside number ' + l.number,
          x: st.x, y: st.y, r: 1.2, verbs: ['COUNT', 'LOOK', 'FILL'], photo: true,
          pots: l.features.pots, where: alley, lot: l.id, tags: ['pot', 'plant', 'geranium'] });
      }
      if (l.features.tank) {
        p({ id: 'tank_' + l.id, name: 'the water tank on the roof of number ' + l.number,
          x: st.x, y: st.y, r: 1.3, verbs: ['LOOK'], photo: true, up: 7.0,
          where: alley, lot: l.id, tags: ['tank', 'roof', 'black'] });
      }
      if (l.features.dish) {
        p({ id: 'dish_' + l.id, name: 'the dish on number ' + l.number,
          x: st.x, y: st.y, r: 1.3, verbs: ['LOOK'], photo: true, up: 6.4,
          where: alley, lot: l.id, tags: ['dish', 'satellite'] });
      }
      if (l.features.bougain) {
        p({ id: 'bougain_' + l.id, name: 'the bougainvillea over the door of number ' + l.number,
          x: st.x, y: st.y, r: 1.3, verbs: ['PICK', 'LOOK'], photo: true,
          where: alley, lot: l.id, tags: ['bougainvillea', 'plant', 'flower'] });
      }
      if (l.arcade) {
        p({ id: 'arcade_' + l.id, name: 'the three arches of number ' + l.number,
          x: st.x, y: st.y, r: 1.3, verbs: ['COUNT', 'LOOK'], photo: true, up: 4.4,
          where: alley, lot: l.id, tags: ['arch', 'arcade', 'window'] });
      }
      if (l.stair) {
        p({ id: 'stair_' + l.id, name: 'the outside stair of number ' + l.number,
          x: side.x, y: side.y, r: 1.3, verbs: ['COUNT', 'MEASURE', 'LOOK'],
          where: alley, lot: l.id, tags: ['stair', 'stone'] });
      }
    });

    /* the bluest shutter in the quarter, decided once and for all */
    var bluest = null, best = -1;
    town.lots.forEach(function (l) {
      var c = l.shutter;
      var r = parseInt(c.substr(1, 2), 16), g = parseInt(c.substr(3, 2), 16), b = parseInt(c.substr(5, 2), 16);
      var score = b - (r + g) / 2;
      if (score > best) { best = score; bluest = l; }
    });
    town.bluestShutter = 'shutter_' + bluest.id;
    town.props[town.bluestShutter].bluest = true;

    /* and the one door whose knocker is a hand */
    var khamsa = rng.pick(town.lots.slice());
    town.props['door_' + khamsa.id].khamsa = true;
    town.props['door_' + khamsa.id].name = 'the door with the brass hand on it, at number ' + khamsa.number;
    town.khamsaDoor = 'door_' + khamsa.id;
  }

  /* ------------------------------------------------------------------ *
   *  collision
   * ------------------------------------------------------------------ */

  function makeGrid(town) {
    town.cell = CELL;
    town.gw = Math.ceil(W / CELL);
    town.gh = Math.ceil(H / CELL);
    town.blocked = new Uint8Array(town.gw * town.gh);
  }

  function blockRect(town, x, y, w, h, pad) {
    pad = pad || 0;
    var x0 = Math.max(0, Math.floor((x - pad) / CELL)), x1 = Math.min(town.gw - 1, Math.ceil((x + w + pad) / CELL));
    var y0 = Math.max(0, Math.floor((y - pad) / CELL)), y1 = Math.min(town.gh - 1, Math.ceil((y + h + pad) / CELL));
    for (var gy = y0; gy <= y1; gy++) for (var gx = x0; gx <= x1; gx++) town.blocked[gy * town.gw + gx] = 1;
  }

  function blockCircle(town, cx, cy, r) {
    var x0 = Math.max(0, Math.floor((cx - r) / CELL)), x1 = Math.min(town.gw - 1, Math.ceil((cx + r) / CELL));
    var y0 = Math.max(0, Math.floor((cy - r) / CELL)), y1 = Math.min(town.gh - 1, Math.ceil((cy + r) / CELL));
    for (var gy = y0; gy <= y1; gy++) for (var gx = x0; gx <= x1; gx++) {
      if (U.dist2(gx * CELL + CELL / 2, gy * CELL + CELL / 2, cx, cy) <= r * r) town.blocked[gy * town.gw + gx] = 1;
    }
  }

  /* nudge a point out of a rect it is sitting inside, preferring somewhere
     you can actually stand */
  function pushOutOfRect(x, y, rect, pad, freeTest) {
    var rx = rect[0], ry = rect[1], rw = rect[2], rh = rect[3];
    var cands = [
      { x: x, y: ry - pad }, { x: x, y: ry + rh + pad },
      { x: rx - pad, y: y }, { x: rx + rw + pad, y: y }
    ];
    for (var i = 0; i < cands.length; i++) if (freeTest(cands[i].x, cands[i].y)) return cands[i];
    return cands[0];
  }

  function inAnyRect(list, x, y) {
    for (var i = 0; i < list.length; i++) if (U.pointInRect(x, y, list[i])) return true;
    return false;
  }

  function onAlley(town, x, y, pad) {
    for (var i = 0; i < town.roads.length; i++) {
      var rd = town.roads[i];
      if (polyNearest(rd.pts, x, y).d < rd.width / 2 + rd.shoulder + (pad || 0)) return true;
    }
    return false;
  }

  /* ------------------------------------------------------------------ *
   *  the alley graph the residents walk on
   * ------------------------------------------------------------------ */

  function splitAtIntersections(roads) {
    var adds = [];
    var i, j;
    for (i = 0; i < roads.length; i++) adds.push([]);
    for (i = 0; i < roads.length; i++) {
      for (j = i + 1; j < roads.length; j++) {
        var A = roads[i].pts, B = roads[j].pts;
        for (var a = 0; a < A.length - 1; a++) {
          for (var b = 0; b < B.length - 1; b++) {
            var hit = segIntersect(A[a], A[a + 1], B[b], B[b + 1]);
            if (!hit) continue;
            var ta = U.dist(A[a][0], A[a][1], hit.x, hit.y) / Math.max(0.001, U.dist(A[a][0], A[a][1], A[a + 1][0], A[a + 1][1]));
            var tb = U.dist(B[b][0], B[b][1], hit.x, hit.y) / Math.max(0.001, U.dist(B[b][0], B[b][1], B[b + 1][0], B[b + 1][1]));
            if (ta > 0.02 && ta < 0.98) adds[i].push({ seg: a, t: ta, x: hit.x, y: hit.y });
            if (tb > 0.02 && tb < 0.98) adds[j].push({ seg: b, t: tb, x: hit.x, y: hit.y });
          }
        }
      }
    }
    for (i = 0; i < roads.length; i++) {
      if (!adds[i].length) continue;
      adds[i].sort(function (p, q) { return p.seg - q.seg || p.t - q.t; });
      var out = [], idx = 0;
      for (var s = 0; s < roads[i].pts.length - 1; s++) {
        out.push(roads[i].pts[s]);
        while (idx < adds[i].length && adds[i][idx].seg === s) { out.push([adds[i][idx].x, adds[i][idx].y]); idx++; }
      }
      out.push(roads[i].pts[roads[i].pts.length - 1]);
      roads[i].pts = out;
    }
    return roads;
  }

  function buildGraph(town) {
    var nodes = [], index = {};
    /* 0.7 m buckets, because the alleys are metres apart and not tens of
       metres. Stitching at 1.6 m closes the junctions the intersection pass
       put within a whisker of each other. */
    function nodeAt(x, y) {
      var key = Math.round(x / 0.7) + ',' + Math.round(y / 0.7);
      if (index[key] !== undefined) return index[key];
      index[key] = nodes.length;
      nodes.push({ x: x, y: y, e: [] });
      return index[key];
    }
    var i, j;
    for (i = 0; i < town.roads.length; i++) {
      var pts = town.roads[i].pts, prev = -1;
      for (j = 0; j < pts.length; j++) {
        var n = nodeAt(pts[j][0], pts[j][1]);
        if (prev >= 0 && prev !== n) {
          var d = U.dist(nodes[prev].x, nodes[prev].y, nodes[n].x, nodes[n].y);
          nodes[prev].e.push({ n: n, d: d });
          nodes[n].e.push({ n: prev, d: d });
        }
        prev = n;
      }
    }
    for (i = 0; i < nodes.length; i++) {
      for (j = i + 1; j < nodes.length; j++) {
        var dd = U.dist(nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y);
        if (dd < 1.6) {
          nodes[i].e.push({ n: j, d: dd });
          nodes[j].e.push({ n: i, d: dd });
        }
      }
    }
    town.graph = nodes;

    town.nearestNode = function (x, y) {
      var best = -1, bd = Infinity;
      for (var k = 0; k < nodes.length; k++) {
        var d = U.dist2(x, y, nodes[k].x, nodes[k].y);
        if (d < bd) { bd = d; best = k; }
      }
      return best;
    };

    town.pathNodes = function (from, to) {
      if (from < 0 || to < 0) return null;
      var dist = new Float64Array(nodes.length).fill(Infinity);
      var prevArr = new Int32Array(nodes.length).fill(-1);
      var done = new Uint8Array(nodes.length);
      dist[from] = 0;
      for (var iter = 0; iter < nodes.length; iter++) {
        var u = -1, bd = Infinity;
        for (var k = 0; k < nodes.length; k++) if (!done[k] && dist[k] < bd) { bd = dist[k]; u = k; }
        if (u < 0) break;
        if (u === to) break;
        done[u] = 1;
        for (var e = 0; e < nodes[u].e.length; e++) {
          var v = nodes[u].e[e].n, nd = dist[u] + nodes[u].e[e].d;
          if (nd < dist[v]) { dist[v] = nd; prevArr[v] = u; }
        }
      }
      if (dist[to] === Infinity) return null;
      var out = [], c = to;
      while (c >= 0) { out.unshift({ x: nodes[c].x, y: nodes[c].y }); c = prevArr[c]; }
      return out;
    };
    return town;
  }

  /* ------------------------------------------------------------------ *
   *  layout validation. fifty metres is small enough that a house in the
   *  wrong place blocks an alley outright, so the tests check this.
   * ------------------------------------------------------------------ */

  function validateLayout(town) {
    var problems = [];
    var all = [];
    town.lots.forEach(function (l) { all.push({ id: l.id, rect: l.rect }); });
    town.buildings.forEach(function (b) { all.push({ id: b.id, rect: b.rect }); });

    var i, j;
    for (i = 0; i < all.length; i++) {
      var a = all[i], ar = { x: a.rect[0], y: a.rect[1], w: a.rect[2], h: a.rect[3] };
      /* inside the world, with a margin */
      if (a.rect[0] < 0.5 || a.rect[1] < 0.5 ||
          a.rect[0] + a.rect[2] > W - 0.5 || a.rect[1] + a.rect[3] > H - 0.5) {
        problems.push(a.id + ' hangs off the edge of the world');
      }
      for (j = i + 1; j < all.length; j++) {
        var b = all[j], br = { x: b.rect[0], y: b.rect[1], w: b.rect[2], h: b.rect[3] };
        if (U.rectsOverlap(ar, br, 0.2)) problems.push(a.id + ' and ' + b.id + ' are in the same place');
      }
      /* and nothing may stand in an alley: sample the rect's outline */
      for (var k = 0; k < town.roads.length; k++) {
        var rd = town.roads[k], half = rd.width / 2;
        var hit = null;
        for (var t = 0; t <= 1.0001 && !hit; t += 0.1) {
          var pts = [
            [a.rect[0] + a.rect[2] * t, a.rect[1]],
            [a.rect[0] + a.rect[2] * t, a.rect[1] + a.rect[3]],
            [a.rect[0], a.rect[1] + a.rect[3] * t],
            [a.rect[0] + a.rect[2], a.rect[1] + a.rect[3] * t]
          ];
          for (var q = 0; q < pts.length; q++) {
            if (polyNearest(rd.pts, pts[q][0], pts[q][1]).d < half) { hit = rd.id; break; }
          }
        }
        if (hit) problems.push(a.id + ' stands in ' + hit);
      }
    }
    return problems;
  }

  /* ------------------------------------------------------------------ *
   *  assembly
   * ------------------------------------------------------------------ */

  function generateTown(seedStr) {
    seedStr = seedStr || 'batroun';
    var seed = ER.hashStr(seedStr);
    var rng = new ER.RNG(seed);

    var town = {
      seedStr: seedStr, seed: seed, w: W, h: H,
      props: {}, propList: []
    };

    town.roads = splitAtIntersections(alleyDefs());
    town.roadById = {};
    town.roads.forEach(function (r) { town.roadById[r.id] = r; });

    town.sea = seaDef();
    town.paving = pavingDefs();
    town.pavedStrips = [];                 /* nothing here is a poured strip */
    town.square = { x: 30.6, y: 27.2, w: 7.0, h: 5.8, fountain: { x: 34.1, y: 30.1, r: 0.95 } };

    town.buildings = buildingDefs();
    town.buildingById = {};
    town.buildings.forEach(function (b) { town.buildingById[b.id] = b; });

    /* the houses, dressed procedurally from a hand-laid footprint */
    town.lots = houseDefs().map(function (d, i) {
      var lr = rng.sub('house' + d.id);
      var door = facePoint(d.rect, d.face, 0.05);
      var stand = facePoint(d.rect, d.face, 1.35);
      return {
        id: d.id, rect: d.rect, road: d.road, face: d.face,
        storeys: d.storeys, number: d.number,
        house: d.rect,
        door: door, stand: stand, front: stand,
        /* limewash over sandstone, in whatever was going that decade */
        wash: lr.pick(['#e8dcc6', '#e3d3b4', '#dfd0bd', '#e7d9c4', '#d9c9ae', '#eadfcb', '#ddcdb2']),
        shutter: lr.pick(['#2f6f8f', '#356f86', '#2b6076', '#3f7f93', '#4a7f6a', '#7a5a3c', '#2a5d7a']),
        roof: d.storeys > 1 ? lr.pick(['tile', 'tile', 'flat']) : lr.pick(['tile', 'flat']),
        arcade: d.storeys > 1 && lr.chance(0.72),   /* the triple-arched window */
        balcony: d.storeys > 1 && lr.chance(0.58),
        stair: lr.chance(0.34),                      /* an outside stone stair */
        features: {
          tank: lr.chance(0.85),                     /* black water tank on the roof */
          dish: lr.chance(0.7),
          pots: lr.int(2, 7),
          bougain: lr.chance(0.5),
          jasmine: lr.chance(0.35),
          laundry: lr.chance(0.55),
          meter: true
        },
        plate: { shown: String(d.number), x: door.x, y: door.y }
      };
    });

    makeGrid(town);
    /* the sea is not walkable, and neither is anybody's wall */
    for (var sx = 0; sx < town.gw; sx++) {
      for (var sy = 0; sy < town.gh; sy++) {
        if (sx * CELL + CELL / 2 < town.sea.edge - 1.2) town.blocked[sy * town.gw + sx] = 1;
      }
    }
    town.lots.forEach(function (l) { blockRect(town, l.rect[0], l.rect[1], l.rect[2], l.rect[3], 0.1); });
    town.buildings.forEach(function (b) { blockRect(town, b.rect[0], b.rect[1], b.rect[2], b.rect[3], 0.1); });
    blockCircle(town, town.square.fountain.x, town.square.fountain.y, town.square.fountain.r + 0.2);

    town.isBlocked = function (x, y) {
      if (x < 0.2 || y < 0.2 || x > W - 0.2 || y > H - 0.2) return true;
      var gx = Math.floor(x / CELL), gy = Math.floor(y / CELL);
      if (gx < 0 || gy < 0 || gx >= town.gw || gy >= town.gh) return true;
      return !!town.blocked[gy * town.gw + gx];
    };

    /* ---- what is underfoot ---- */
    town.terrainAt = function (x, y) {
      var k, rd, nr;
      if (x < town.sea.edge - 1.35) return 'water';
      /* the crest of the Phoenician wall */
      if (Math.abs(x - town.sea.wall.x) < town.sea.wall.halfWidth + 0.15) return 'wall';
      for (k = 0; k < town.roads.length; k++) {
        rd = town.roads[k];
        nr = polyNearest(rd.pts, x, y);
        if (nr.d < rd.width / 2) return rd.kind;
        /* the shoulder is the same stone, just never swept */
        if (nr.d < rd.width / 2 + rd.shoulder) return 'stone';
      }
      for (k = 0; k < town.paving.length; k++) {
        if (U.pointInRect(x, y, town.paving[k])) return town.paving[k].kind;
      }
      return 'rock';
    };

    town.speedAt = function (x, y) {
      var t = town.terrainAt(x, y);
      if (t === 'water') return 0.40;
      if (t === 'steps') return 0.62;
      if (t === 'rock') return 0.84;
      if (t === 'slip') return 0.88;
      if (t === 'wall') return 0.78;
      return 1;
    };

    /* ---- the shelf the quarter stands on ----
       Batroun's old town is built on a rock shelf that climbs away from the
       water. Sampled once into a half-metre grid and interpolated after, so
       the renderer can ask for thousands of heights a frame. */
    (function () {
      var hn = new ER.Noise(seed ^ 0x8a7c11);

      function raw(x, y) {
        var h = 1.35
          + U.smooth(U.clamp((x - 7.0) / 32, 0, 1)) * 3.2      /* the climb inland */
          + U.smooth(U.clamp((26 - y) / 18, 0, 1)) * 2.8       /* and the shelf the steps climb */
          + (hn.fbm(x / 26, y / 26, 3) - 0.5) * 1.0            /* the shelf is not flat */
          + (hn.fbm(x / 6.5, y / 6.5, 2) - 0.5) * 0.18;        /* and it is not smooth */
        /* west of the wall the rock goes under the water */
        h -= 6.0 * U.smooth(U.clamp((town.sea.edge - x) / 3.0, 0, 1));
        /* the wall itself: a crest you can stand on */
        var wt = U.clamp(1 - Math.abs(x - town.sea.wall.x) / (town.sea.wall.halfWidth + 0.35), 0, 1);
        h = U.lerp(h, town.sea.wall.top, U.smooth(wt));
        return h;
      }

      /* Flat where the alleys are, and stepped where the alley is stairs.
         Fifty metres means the grading reach is metres, not tens of metres. */
      var RISER = 0.17;
      function graded(x, y) {
        var h = raw(x, y);
        var best = null, bd = Infinity;
        for (var i = 0; i < town.roads.length; i++) {
          var rd = town.roads[i];
          var nr = polyNearest(rd.pts, x, y);
          var beyond = nr.d - (rd.width / 2 + rd.shoulder);
          if (beyond < bd) { bd = beyond; best = { rd: rd, nr: nr, beyond: beyond }; }
        }
        if (best && best.beyond < 2.6) {
          var onAlleyH = raw(best.nr.x, best.nr.y);
          if (best.rd.steps) onAlleyH = Math.round(onAlleyH / RISER) * RISER;
          h = U.lerp(onAlleyH, h, U.smooth(U.clamp(best.beyond / 2.6, 0, 1)));
        }
        /* and the square is a poured floor, dead level */
        var sq = town.square;
        if (U.pointInRect(x, y, sq)) {
          h = U.lerp(h, raw(sq.x + sq.w / 2, sq.y + sq.h / 2), 0.85);
        }
        return h;
      }

      var STEP = 0.5;
      var gw = Math.floor(W / STEP) + 2, gh2 = Math.floor(H / STEP) + 2;
      var grid = new Float32Array(gw * gh2);
      for (var yy = 0; yy < gh2; yy++)
        for (var xx = 0; xx < gw; xx++)
          grid[yy * gw + xx] = graded(xx * STEP, yy * STEP);

      town.heightAt = function (x, y) {
        var fx = U.clamp(x / STEP, 0, gw - 1.001), fy = U.clamp(y / STEP, 0, gh2 - 1.001);
        var ix = fx | 0, iy = fy | 0;
        var tx = fx - ix, ty = fy - iy;
        var i00 = iy * gw + ix;
        var a = grid[i00], b = grid[i00 + 1], c = grid[i00 + gw], d = grid[i00 + gw + 1];
        return (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty;
      };

      town.slopeAt = function (x, y) {
        var e = 0.4;
        return { dx: (town.heightAt(x + e, y) - town.heightAt(x - e, y)) / (2 * e),
          dy: (town.heightAt(x, y + e) - town.heightAt(x, y - e)) / (2 * e) };
      };

      town.heightGrid = { data: grid, step: STEP, w: gw, h: gh2 };
    })();

    /* you have the back room of number 6, on the zaroub side of h13 */
    var homeLot = town.lots.filter(function (l) { return l.id === 'h13'; })[0];
    town.home = {
      lot: homeLot.id, rect: homeLot.rect,
      door: { x: homeLot.door.x, y: homeLot.door.y },
      windowsill: { x: homeLot.rect[0] + homeLot.rect[2] + 0.15, y: homeLot.rect[1] + 1.2 },
      roof: { x: homeLot.rect[0] + homeLot.rect[2] / 2, y: homeLot.rect[1] + homeLot.rect[3] / 2 }
    };
    town.spawn = { x: homeLot.stand.x, y: homeLot.stand.y };

    buildProps(town, rng.sub('props'));
    buildGraph(town);

    /* one name plate in the quarter does not match its house */
    var shuffled = rng.sub('platemix').shuffle(town.lots.slice());
    var oddLot = shuffled[0];
    oddLot.plate.shown = String(Math.max(2, oddLot.number + rng.sub('platemix2').pick([-6, -4, 4, 6, 20])));
    oddLot.plate.mismatched = true;
    town.mismatchedPlate = oddLot.id;

    /* the map legend */
    town.landmarks = [];
    for (var pl = 0; pl < town.propList.length; pl++) {
      var pp = town.propList[pl];
      if (pp.landmark) town.landmarks.push({ id: pp.id, name: pp.name,
        x: pp.rect ? pp.rect.x + pp.rect.w / 2 : pp.x,
        y: pp.rect ? pp.rect.y + pp.rect.h / 2 : pp.y });
    }

    /* ---- lookup helpers ---- */
    town.propPos = function (id) {
      var pr = (id && typeof id === 'object') ? id : town.props[id];
      if (!pr) return null;
      if (pr.rect) return { x: pr.rect.x + pr.rect.w / 2, y: pr.rect.y + pr.rect.h / 2 };
      return { x: pr.x, y: pr.y };
    };

    town.inProp = function (pr, x, y, slack) {
      slack = slack || 0;
      if (!pr) return false;
      if (pr.rect) return U.pointInRect(x, y, { x: pr.rect.x - slack - 0.7, y: pr.rect.y - slack - 0.7,
        w: pr.rect.w + (slack + 0.7) * 2, h: pr.rect.h + (slack + 0.7) * 2 });
      return U.dist(x, y, pr.x, pr.y) <= pr.r + slack;
    };

    town.propAt = function (x, y, preferId) {
      var best = null, bestScore = Infinity;
      for (var k = 0; k < town.propList.length; k++) {
        var pr = town.propList[k];
        if (pr.hidden) continue;
        if (!town.inProp(pr, x, y, 0)) continue;
        var pos = town.propPos(pr);
        var score = U.dist(x, y, pos.x, pos.y) - (pr.id === preferId ? 200 : 0) - (pr.rect ? 0 : 0.5);
        if (score < bestScore) { bestScore = score; best = pr; }
      }
      return best;
    };

    town.propsNear = function (x, y, r) {
      var out = [];
      for (var k = 0; k < town.propList.length; k++) {
        var pos = town.propPos(town.propList[k]);
        if (U.dist(x, y, pos.x, pos.y) < r) out.push(town.propList[k]);
      }
      return out;
    };

    town.roadNameAt = function (x, y) {
      var best = null, bd = Infinity;
      for (var k = 0; k < town.roads.length; k++) {
        var d = polyNearest(town.roads[k].pts, x, y).d;
        if (d < bd) { bd = d; best = town.roads[k]; }
      }
      return bd < 6 ? best.name : null;
    };

    town.validateLayout = function () { return validateLayout(town); };

    return town;
  }

  ER.generateTown = generateTown;
  ER.TOWN_W = W;
  ER.TOWN_H = H;
  ER.facePoint = facePoint;
  ER.polyNearestPts = polyNearest;
  ER.townInternals = { prop: prop, pushOutOfRect: pushOutOfRect, onAlley: onAlley,
    inAnyRect: inAnyRect, blockCircle: blockCircle, blockRect: blockRect, CELL: CELL };
})(typeof window !== 'undefined' ? (window.ER = window.ER || {}) : (global.ER = global.ER || {}));
