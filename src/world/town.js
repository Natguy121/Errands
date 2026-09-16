/* Errands — Hollis Bend, population 30, four square kilometres.
   A real place: asphalt, a gas station that works, satellite dishes, mowed
   yards, one house going up on Elm Court. Generated from a seed so that it
   is the same town every time. Nothing here is abandoned except the things
   that are actually abandoned. */
(function (ER) {
  'use strict';
  var U = ER.U;

  var W = 2000, H = 2000;            // metres. 2km x 2km = 4 square kilometres.
  var CELL = 2;                      // collision grid resolution, metres

  var N = ER.Names;

  /* ------------------------------------------------------------------ *
   *  road / water geometry, hand-laid then dressed procedurally
   * ------------------------------------------------------------------ */

  function roadDefs() {
    return [
      { id: 'main', name: N.streets.main, kind: 'asphalt', width: 7.4, marks: 'center', shoulder: 2.2,
        sidewalk: [[860, 1250]],
        pts: [[0, 1000], [320, 1002], [640, 999], [900, 1001], [1180, 1000], [1470, 1000], [1760, 997], [2000, 998]] },

      { id: 'church', name: N.streets.church, kind: 'asphalt', width: 6.4, marks: 'none', shoulder: 1.6,
        pts: [[762, 520], [760, 700], [763, 860], [760, 1000], [758, 1130], [760, 1300]] },

      { id: 'schurch', name: 'South Church Street', kind: 'gravel', width: 5.0, marks: 'none', shoulder: 1.2,
        pts: [[760, 1300], [766, 1450], [770, 1560], [768, 1636]] },

      { id: 'quarry', name: N.streets.quarry, kind: 'gravel', width: 5.4, marks: 'none', shoulder: 1.4,
        pts: [[1298, 300], [1304, 480], [1300, 700], [1303, 860], [1302, 1000]] },

      { id: 'depot', name: N.streets.depot, kind: 'asphalt', width: 6.2, marks: 'none', shoulder: 1.8,
        sidewalk: [[840, 1010]],
        pts: [[540, 1136], [700, 1132], [900, 1130], [1080, 1132], [1180, 1134], [1330, 1132], [1460, 1130], [1562, 1128]] },

      { id: 'elm', name: N.streets.elm, kind: 'asphalt', width: 5.6, marks: 'none', shoulder: 1.4,
        pts: [[1180, 1134], [1182, 1230], [1180, 1318]], bulb: { x: 1180, y: 1318, r: 20 } },

      { id: 'cr9', name: N.streets.cr9, kind: 'asphalt', width: 6.0, marks: 'center', shoulder: 2.6,
        pts: [[0, 1620], [240, 1562], [520, 1598], [768, 1636], [1020, 1652], [1240, 1662], [1399, 1678], [1560, 1700], [1800, 1734], [2000, 1762]] },

      { id: 'mill', name: N.streets.mill, kind: 'gravel', width: 4.6, marks: 'none', shoulder: 1.0,
        pts: [[1460, 1130], [1446, 1212], [1412, 1300], [1372, 1382], [1352, 1414]] },

      { id: 'cemlane', name: 'Cemetery Lane', kind: 'gravel', width: 4.2, marks: 'none', shoulder: 1.0,
        pts: [[760, 700], [672, 692], [592, 680]] },

      { id: 'farmlane', name: 'Farm Lane', kind: 'gravel', width: 4.2, marks: 'none', shoulder: 1.0,
        pts: [[1302, 420], [1430, 412], [1570, 418], [1676, 430]] },

      { id: 'coop', name: 'Co-op Access', kind: 'gravel', width: 5.2, marks: 'none', shoulder: 1.2,
        pts: [[1562, 1128], [1580, 1196], [1574, 1254]] },

      { id: 'schooldrive', name: 'School Drive', kind: 'asphalt', width: 5.0, marks: 'none', shoulder: 1.2,
        pts: [[900, 1130], [903, 1186], [944, 1206], [986, 1200]] }
    ];
  }

  /* Little Fox Creek: down from the north on the east side, out the bottom.
     Crosses Main Street (concrete bridge) and County Road 9 (stone bridge). */
  function creekDef() {
    return {
      width: 4.6,
      pts: [[1652, 0], [1600, 150], [1646, 320], [1568, 470], [1516, 642], [1488, 820],
        [1470, 1000], [1444, 1152], [1428, 1300], [1432, 1404], [1418, 1470], [1400, 1560],
        [1399, 1678], [1418, 1786], [1386, 1900], [1392, 2000]]
    };
  }

  /* the old spur. the trestle over the creek came out in the eighties, so the
     grade simply stops at the west bank. */
  function railDef() {
    return { pts: [[0, 1298], [300, 1332], [700, 1372], [1100, 1424], [1300, 1448], [1408, 1462]] };
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

  /* unit normal of the segment a point falls on, pointing +90deg from travel */
  function polyNormal(pts, seg) {
    var a = pts[seg], b = pts[seg + 1];
    var dx = b[0] - a[0], dy = b[1] - a[1];
    var len = Math.hypot(dx, dy) || 1;
    return { x: -dy / len, y: dx / len, tx: dx / len, ty: dy / len };
  }

  /* where two polylines cross, approximately. used to place the bridges. */
  function polyIntersect(a, b) {
    for (var i = 0; i < a.length - 1; i++) {
      for (var j = 0; j < b.length - 1; j++) {
        var p = segIntersect(a[i], a[i + 1], b[j], b[j + 1]);
        if (p) return p;
      }
    }
    return null;
  }

  function segIntersect(p1, p2, p3, p4) {
    var d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0]);
    if (Math.abs(d) < 1e-9) return null;
    var t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d;
    var u = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d;
    if (t < 0 || t > 1 || u < 0 || u > 1) return null;
    return { x: p1[0] + t * (p2[0] - p1[0]), y: p1[1] + t * (p2[1] - p1[1]) };
  }

  ER.poly = { pointAt: polyPointAt, length: polyLength, nearest: polyNearest,
    normal: polyNormal, intersect: polyIntersect };

  /* ------------------------------------------------------------------ *
   *  house lots. anchored to a road so every house faces the road.
   * ------------------------------------------------------------------ */

  /* [roadId, distanceAlongRoad, side(+1 = normal direction), style] */
  function lotAnchors() {
    return [
      ['main', 235, -1, 'twostory'], ['main', 335, 1, 'ranch'], ['main', 430, -1, 'farmhouse'],
      ['main', 530, 1, 'ranch'], ['main', 635, -1, 'cottage'],
      ['main', 1565, -1, 'ranch'], ['main', 1680, 1, 'newer'], ['main', 1800, -1, 'twostory'],

      ['church', 62, -1, 'ranch'], ['church', 148, -1, 'twostory'],
      ['church', 238, -1, 'cottage'], ['church', 322, -1, 'ranch'],

      ['depot', 40, -1, 'cottage'], ['depot', 62, 1, 'ranch'], ['depot', 218, 1, 'twostory'],
      ['depot', 243, -1, 'ranch'], ['depot', 402, 1, 'cottage'], ['depot', 462, -1, 'ranch'],

      ['elm', 42, 1, 'newer'], ['elm', 42, -1, 'newer'], ['elm', 124, -1, 'newer'],
      ['elm', 188, 1, 'newer'],

      ['cr9', 155, -1, 'farmhouse'], ['cr9', 425, 1, 'ranch'], ['cr9', 905, -1, 'twostory'],
      ['cr9', 1255, 1, 'ranch'], ['cr9', 1655, -1, 'farmhouse'],

      ['quarry', 262, 1, 'trailer'], ['quarry', 442, -1, 'ranch'],

      ['farmlane', 182, 1, 'farmhouse']
    ];
  }

  var STYLES = {
    ranch:     { w: [15, 19], d: [9, 11],  storeys: 1, siding: ['#cfd3cb', '#d9d2c0', '#b9c3c6', '#e2ddd1', '#c8b9a6'], roof: ['#6d6a63', '#57544e', '#7a6f61'], porch: 'small' },
    twostory:  { w: [11, 14], d: [9, 11],  storeys: 2, siding: ['#e8e4d8', '#d6c9b4', '#b8bfae', '#cfc4b8'],            roof: ['#4f4b46', '#635a4d', '#6b5f52'], porch: 'full' },
    farmhouse: { w: [12, 15], d: [10, 13], storeys: 2, siding: ['#efece1', '#e6e2d4', '#dfd8c6'],                        roof: ['#5b5750', '#6e6257', '#4a4640'], porch: 'wrap' },
    newer:     { w: [17, 22], d: [11, 14], storeys: 2, siding: ['#d8cdb8', '#c9c2b4', '#e0d7c6', '#b6ada0'],            roof: ['#4a4643', '#5a5450', '#3f3d3a'], porch: 'stoop', garage: true },
    cottage:   { w: [10, 12], d: [8, 10],  storeys: 1, siding: ['#dfe0d6', '#cdd6cf', '#e6dcc9'],                        roof: ['#615c55', '#726657'], porch: 'small' },
    trailer:   { w: [16, 19], d: [5.5, 6.5], storeys: 1, siding: ['#e4e2dc', '#d8dbd9'],                                  roof: ['#8e8c86'], porch: 'deck', skirt: true }
  };

  var CAR_COLORS = ['#8e9196', '#b9bcc0', '#3c4147', '#6e7b84', '#7a2f2b', '#2f4356',
    '#d8d5cd', '#4a5b3f', '#8b7355', '#1f2225', '#a8472f'];

  function makeLot(rng, town, anchor, index) {
    var roadId = anchor[0], s = anchor[1], side = anchor[2], styleKey = anchor[3];
    var road = town.roadById[roadId];
    if (!road) return null;
    var p = polyPointAt(road.pts, s);
    var nrm = polyNormal(road.pts, p.seg);
    var nx = nrm.x * side, ny = nrm.y * side;
    var st = STYLES[styleKey];

    var frontage = rng.float(30, 44);
    var depth = roadId === 'cr9' || roadId === 'farmlane' || roadId === 'quarry' ? rng.float(58, 78) : rng.float(40, 56);
    var setback = (road.width / 2) + road.shoulder + rng.float(9, 17);

    /* yard, axis-aligned, centred on the offset point */
    var cx = p.x + nx * (setback + depth / 2);
    var cy = p.y + ny * (setback + depth / 2);
    var yard = { x: cx - frontage / 2, y: cy - depth / 2, w: frontage, h: depth };

    /* house, pushed toward the road inside the yard */
    var hw = rng.float(st.w[0], st.w[1]), hd = rng.float(st.d[0], st.d[1]);
    var horiz = Math.abs(nx) < Math.abs(ny);    /* road runs east-west -> house is wide */
    var bw = horiz ? hw : hd, bh = horiz ? hd : hw;
    var hx = p.x + nx * (setback + (horiz ? bh : bw) / 2 + 1);
    var hy = p.y + ny * (setback + (horiz ? bh : bw) / 2 + 1);
    var house = { x: hx - bw / 2, y: hy - bh / 2, w: bw, h: bh };

    var lot = {
      id: 'lot' + index,
      index: index,
      road: roadId, s: s, side: side,
      style: styleKey,
      storeys: st.storeys,
      yard: yard,
      house: house,
      front: { x: p.x + nx * (road.width / 2 + road.shoulder + 1.5), y: p.y + ny * (road.width / 2 + road.shoulder + 1.5) },
      curb: { x: p.x + nx * (road.width / 2 + 0.6), y: p.y + ny * (road.width / 2 + 0.6) },
      nx: nx, ny: ny,
      siding: rng.pick(st.siding),
      roofColor: rng.pick(st.roof),
      porch: st.porch,
      skirt: !!st.skirt,
      garage: !!st.garage && rng.chance(0.85),
      features: {},
      trees: [],
      lawnMown: rng.chance(0.82),
      number: 0
    };

    /* address numbers, the way rural addresses actually run */
    var base = Math.round(s / 9) * 2;
    lot.number = Math.max(2, base + (side > 0 ? 1 : 2)) + (roadId === 'cr9' ? 1200 : roadId === 'elm' ? 100 : 0);
    lot.mailbox = {
      x: lot.curb.x + nrm.tx * rng.float(-5, 5),
      y: lot.curb.y + nrm.ty * rng.float(-5, 5),
      label: String(lot.number),
      shown: String(lot.number)
    };

    /* driveway: a strip from the road edge to the house */
    var dOff = rng.float(-1, 1) * (frontage / 2 - 5);
    var dwx = p.x + nrm.tx * dOff, dwy = p.y + nrm.ty * dOff;
    lot.driveway = {
      x0: dwx + nx * (road.width / 2), y0: dwy + ny * (road.width / 2),
      x1: dwx + nx * (setback + 1.5), y1: dwy + ny * (setback + 1.5),
      w: rng.float(3.1, 4.4),
      kind: roadId === 'quarry' || roadId === 'cr9' || roadId === 'farmlane' ? 'gravel'
        : rng.chance(0.55) ? 'concrete' : 'asphalt'
    };

    var f = lot.features;
    if (rng.chance(0.74)) {
      f.cars = [];
      var nCars = rng.chance(0.3) ? 2 : 1;
      for (var c = 0; c < nCars; c++) {
        f.cars.push({
          x: lot.driveway.x1 - nx * (4.5 + c * 5.6), y: lot.driveway.y1 - ny * (4.5 + c * 5.6),
          ang: Math.atan2(ny, nx),
          color: rng.pick(CAR_COLORS),
          kind: rng.pickWeighted(['sedan', 'pickup', 'suv', 'hatch'], function (k) {
            return k === 'pickup' ? 4 : k === 'suv' ? 3 : k === 'sedan' ? 3 : 1;
          }),
          onBlocks: rng.chance(0.06)
        });
      }
    }
    if (rng.chance(0.58)) {
      f.dish = { x: house.x + house.w * rng.float(0.15, 0.85), y: house.y + house.h * rng.float(0.1, 0.9),
        r: rng.float(0.5, 0.75), pole: rng.chance(0.4) };
    }
    if (rng.chance(0.46)) {
      f.garden = { x: yard.x + rng.float(2, yard.w - 12), y: yard.y + yard.h - rng.float(9, 15),
        w: rng.float(7, 11), h: rng.float(4.5, 7.5), rows: rng.int(3, 6),
        crop: rng.pick(['tomato', 'bean', 'squash', 'flower', 'corn']) };
    }
    if (rng.chance(0.42)) f.shed = { x: yard.x + rng.float(1, 4), y: yard.y + yard.h - rng.float(6, 9),
      w: rng.float(3.2, 4.6), h: rng.float(2.8, 4.0), color: rng.pick(['#8d8578', '#a5a096', '#6f6a60']) };
    if (rng.chance(0.3)) f.fence = { kind: rng.pick(['chain', 'picket', 'wire']), sides: rng.picks(['n', 's', 'e', 'w'], rng.int(2, 4)) };
    if (rng.chance(0.15)) f.trampoline = { x: yard.x + yard.w * rng.float(0.2, 0.8), y: yard.y + yard.h * rng.float(0.55, 0.85), r: rng.float(3.4, 4.2) };
    if (rng.chance(0.09)) f.pool = { x: yard.x + yard.w * rng.float(0.25, 0.75), y: yard.y + yard.h * rng.float(0.6, 0.85), r: rng.float(3.6, 5.0) };
    if (rng.chance(0.16)) f.swingset = { x: yard.x + yard.w * rng.float(0.2, 0.8), y: yard.y + yard.h * rng.float(0.6, 0.85) };
    if (rng.chance(0.26)) f.clothesline = { x: yard.x + 3, y: yard.y + yard.h * rng.float(0.6, 0.8), w: rng.float(7, 12), hung: rng.chance(0.5) };
    if (rng.chance(0.3)) f.woodpile = { x: yard.x + rng.float(1, yard.w - 5), y: yard.y + yard.h * rng.float(0.5, 0.8), w: rng.float(3, 6) };
    if (rng.chance(0.2)) f.tractor = { x: yard.x + rng.float(2, yard.w - 4), y: yard.y + yard.h * rng.float(0.55, 0.8) };
    if (rng.chance(0.12)) f.flag = { x: lot.front.x + nrm.tx * 4, y: lot.front.y + nrm.ty * 4 };
    if (rng.chance(0.18)) f.hoop = { x: lot.driveway.x0 + nrm.tx * 3.4, y: lot.driveway.y0 + nrm.ty * 3.4 };
    if (rng.chance(0.8)) f.ac = { x: house.x + house.w + 0.8, y: house.y + house.h * 0.5 };
    if (rng.chance(0.28)) f.propane = { x: yard.x + yard.w - rng.float(2, 5), y: yard.y + yard.h * rng.float(0.5, 0.75) };

    var nTrees = rng.int(1, 4);
    for (var t = 0; t < nTrees; t++) {
      var tx = yard.x + rng.float(1.5, yard.w - 1.5);
      var ty = yard.y + rng.float(1.5, yard.h - 1.5);
      if (U.pointInRect(tx, ty, { x: house.x - 2, y: house.y - 2, w: house.w + 4, h: house.h + 4 })) continue;
      lot.trees.push({ x: tx, y: ty, r: rng.float(3.2, 7.4), kind: rng.pick(['maple', 'oak', 'spruce', 'ash', 'crab']) });
    }
    return lot;
  }

  /* ------------------------------------------------------------------ *
   *  the buildings that are not houses
   * ------------------------------------------------------------------ */

  function buildingDefs() {
    return [
      { id: 'bendmart', name: 'Bend Mart', sub: 'GAS · BAIT · ATM', x: 1006, y: 926, w: 29, h: 18,
        wall: '#dcd8cc', roof: '#5d5a54', sign: { x: 1040, y: 918, text: 'BEND MART', color: '#b8452f' }, lit: true, kind: 'shop' },
      { id: 'hardware', name: 'Pell Hardware', sub: 'SINCE 1961', x: 878, y: 928, w: 27, h: 20,
        wall: '#a8654d', roof: '#4e4a45', brick: true, sign: { x: 891, y: 922, text: 'PELL HARDWARE', color: '#2d3f52' }, kind: 'shop' },
      { id: 'townhall', name: 'Town Hall & Volunteer Fire Dept.', sub: null, x: 1118, y: 922, w: 32, h: 22,
        wall: '#d2cec2', roof: '#4a4742', brick: true, civic: true, sign: { x: 1134, y: 915, text: 'HOLLIS BEND', color: '#38404a' }, kind: 'civic' },
      { id: 'diner', name: "Halter's Diner", sub: 'BREAKFAST ALL DAY', x: 898, y: 1018, w: 25, h: 17,
        wall: '#e0dccf', roof: '#6b6257', sign: { x: 910, y: 1012, text: "HALTER'S", color: '#c2562f' }, lit: true, kind: 'shop' },
      { id: 'postoffice', name: 'U.S. Post Office 66' + '431', sub: null, x: 1096, y: 1016, w: 19, h: 15,
        wall: '#cfd2cd', roof: '#54514c', civic: true, sign: { x: 1105, y: 1010, text: 'US POST OFFICE', color: '#2a3a52' }, kind: 'civic' },
      { id: 'laundromat', name: 'Wash & Go', sub: 'OPEN 24 HOURS', x: 1126, y: 1016, w: 17, h: 15,
        wall: '#d8dad4', roof: '#5b5852', sign: { x: 1134, y: 1010, text: 'WASH & GO', color: '#3f6a7a' }, lit: true, alwaysLit: true, kind: 'shop' },
      { id: 'church', name: 'Trinity Methodist', sub: null, x: 700, y: 878, w: 25, h: 34,
        wall: '#eeeadd', roof: '#5a564f', steeple: true, kind: 'civic' },
      { id: 'school', name: 'Hollis Bend Elementary', sub: 'K-6', x: 856, y: 1158, w: 58, h: 31,
        wall: '#cbb9a4', roof: '#4d4a45', brick: true, civic: true, sign: { x: 885, y: 1152, text: 'HOLLIS BEND ELEM.', color: '#3a4a3c' }, kind: 'civic' },
      { id: 'portable', name: 'Portable Classroom', sub: null, x: 920, y: 1162, w: 15, h: 9,
        wall: '#d7d4cb', roof: '#8c8880', kind: 'shed' },
      { id: 'feedstore', name: 'Hollis Bend Feed & Seed', sub: 'CLOSED', x: 1230, y: 1020, w: 47, h: 25,
        wall: '#9d9384', roof: '#57534c', derelict: true, sign: { x: 1253, y: 1014, text: 'FEED & SEED', color: '#6b6357' }, kind: 'derelict' },
      { id: 'storage', name: 'Bend Self Storage', sub: null, x: 1396, y: 1168, w: 55, h: 13,
        wall: '#c0bcb2', roof: '#8a867e', units: 3, kind: 'shed' },
      { id: 'coopshed', name: 'Farmers Co-op', sub: 'SCALE', x: 1536, y: 1262, w: 32, h: 21,
        wall: '#8e9a8c', roof: '#55524c', kind: 'civic' },
      { id: 'farmhouse', name: 'the Vandermeer place', sub: null, x: 1668, y: 408, w: 17, h: 13,
        wall: '#b3ac9c', roof: '#4b463f', derelict: true, collapsed: true, storeys: 2, kind: 'derelict' },
      { id: 'farmbarn', name: 'the Vandermeer barn', sub: null, x: 1700, y: 440, w: 24, h: 17,
        wall: '#7d5c4a', roof: '#4a423b', derelict: true, collapsed: true, kind: 'derelict' },
      { id: 'pavilion', name: 'the park pavilion', sub: null, x: 690, y: 1196, w: 17, h: 12,
        wall: null, roof: '#7b6f60', open: true, kind: 'shed' },
      { id: 'busshelter', name: 'the bus shelter', sub: null, x: 894, y: 1112, w: 4.5, h: 2.6,
        wall: '#b6bcbd', roof: '#7f8486', open: true, kind: 'shed' },
      { id: 'millfound', name: 'the old mill foundation', sub: null, x: 1338, y: 1402, w: 18, h: 13,
        wall: '#8e8a80', roof: null, ruin: true, kind: 'derelict' },
      { id: 'radioshed', name: 'the repeater shed', sub: null, x: 1612, y: 636, w: 4, h: 3.4,
        wall: '#aeb2ac', roof: '#6f6c66', kind: 'shed' },
      { id: 'newbuild', name: 'the house going up on Elm Court', sub: null, x: 1136, y: 1244, w: 21, h: 15,
        wall: '#cdb98d', roof: null, framing: true, kind: 'construction' }
    ];
  }

  /* ------------------------------------------------------------------ *
   *  searchable ground. holding E in one of these turns up mostly junk.
   * ------------------------------------------------------------------ */

  ER.SearchPools = {
    parkinglot:   { label: 'the Bend Mart lot', extra: ['a squashed straw', 'a lottery scratcher, losing', 'a windshield-washer squeegee blade'] },
    oldlot:       { label: 'the old feed store lot', extra: ['a chunk of safety glass, green', 'a bottle cap, flattened but modern', 'a cigarette filter gone to fluff', 'a tar-soaked pebble'] },
    ballast:      { label: 'the railroad ballast', extra: ['a tie plate, half buried', 'a spike, bent double and useless', 'a lump of clinker', 'a rail anchor'] },
    farmhouse:    { label: 'the collapsed room', extra: ['a square nail, snapped', 'a scrap of wallpaper, roses', 'a jar lid, no jar', 'a length of knob-and-tube wire', 'a linoleum tile corner'] },
    farmporch:    { label: 'under the porch', extra: ['a mason jar, cracked through', 'an owl pellet', 'a marble, cats-eye', 'a boot sole'] },
    barn:         { label: 'the barn floor', extra: ['a hames strap buckle', 'a corn cob, petrified', 'a length of bale wire', 'a horseshoe, too broken'] },
    ditch:        { label: 'the ditch along County Road 9', extra: ['a beer can, faded to pink', 'a mud flap', 'a length of fan belt', 'a hubcap, cracked'] },
    pasture:      { label: 'the fence line', extra: ['a staple pulled from a post', 'a tuft of hide-hair on barbed wire', 'a sun-cracked ear tag'] },
    alley:        { label: 'the alley behind the feed store', extra: ['a pallet nail', 'a shard of blue glass, too small', 'a pigeon feather'] },
    woods:        { label: 'the treeline', extra: ['a shotgun wad', 'a deer tooth', 'a gall the size of a plum', 'a cicada wing, single'] },
    recycling:    { label: 'the recycling bins', extra: ['a cap with no bottle', 'a label peeled in three pieces', 'a jar ring, rusted'] },
    scrap:        { label: 'the scrap pile', extra: ['a bent joist hanger', 'a snapped chalk line', 'a shim', 'a drywall screw, stripped'] },
    dugout:       { label: 'the dugout', extra: ['a sunflower-seed shell midden', 'a batting glove, left hand', 'a chunk of pine tar'] },
    culvert:      { label: 'the culvert', extra: ['a tennis ball, waterlogged', 'a plastic army man', 'a comb with three teeth'] },
    lostfound:    { label: 'the lost-and-found bin', extra: ['a single mitten, child\'s', 'a phone charger for a phone nobody has', 'a bra strap', 'a hotel keycard', 'a sock, but not the sock'] },
    lot:          { label: 'the gravel', extra: [] }
  };

  /* ------------------------------------------------------------------ *
   *  props — everything you can walk up to and press E on
   * ------------------------------------------------------------------ */

  function prop(town, o) {
    o.r = o.r || 2.8;
    o.verbs = o.verbs || ['LOOK'];
    o.tags = o.tags || [];
    if (!o.name) o.name = o.id;
    town.props[o.id] = o;
    town.propList.push(o);
    return o;
  }

  function buildProps(town, rng) {
    var p = function (o) { return prop(town, o); };
    var bridgeC = town.bridges.concrete, bridgeS = town.bridges.stone;

    /* ---- Bend Mart ---- */
    p({ id: 'bendmart_counter', name: 'the register at Bend Mart', x: 1020, y: 946, r: 3.4,
      where: 'inside Bend Mart, on Main Street', verbs: ['BUY'], shop: 'bendmart', tags: ['shop', 'indoor'], landmark: true });
    p({ id: 'bendmart_pump', name: 'pump two', x: 1048, y: 962, r: 3.0,
      where: 'under the canopy at Bend Mart', verbs: ['READ'], tags: ['pump'] });
    p({ id: 'bendmart_ice', name: 'the ice machine', x: 1008, y: 940, r: 2.6,
      where: 'against the north wall of Bend Mart', verbs: ['OPEN', 'LISTEN'], tags: ['machine'] });
    p({ id: 'bendmart_air', name: 'the air hose', x: 1038, y: 980, r: 2.6,
      where: 'at the edge of the Bend Mart lot', verbs: ['LISTEN'], tags: ['machine'] });
    p({ id: 'bendmart_lot', name: 'the Bend Mart lot', rect: { x: 1000, y: 948, w: 74, h: 36 },
      where: 'the asphalt at Bend Mart', verbs: ['SEARCH'], searchPool: 'parkinglot', tags: ['asphalt', 'search'] });
    p({ id: 'bendmart_propane', name: 'the propane cage', x: 1000, y: 972, r: 2.4,
      where: 'beside the Bend Mart door', verbs: ['LOOK'], tags: [] });

    /* ---- diner ---- */
    p({ id: 'diner_door', name: "the door of Halter's Diner", x: 910, y: 1017, r: 3.0,
      where: 'Main Street, south side', verbs: ['ENTER'], tags: ['door', 'diner'], landmark: true });
    p({ id: 'diner_counter', name: 'the counter at the diner', x: 916, y: 1016.6, r: 3.0,
      where: 'inside the diner', verbs: ['SIT'], tags: ['indoor', 'diner'] });
    p({ id: 'diner_step', name: "the diner's front step", x: 910, y: 1014, r: 2.4,
      where: 'Main Street, south side', verbs: ['MEASURE'], tags: ['step', 'concrete'] });
    p({ id: 'diner_sign', name: "the diner's OPEN sign", x: 903, y: 1018.5, r: 3.2,
      where: 'in the diner window', verbs: ['LOOK'], photo: true, tags: ['sign', 'neon'] });
    p({ id: 'diner_mint', name: 'the mint behind the diner', x: 895, y: 1038, r: 2.6,
      where: 'behind the diner, by the grease drum', verbs: ['PICK'], tags: ['mint', 'plant'],
      decoyFor: 'mint', decoyLine: 'This is the diner mint. The errand specified the church mint. They are not the same mint.' });
    p({ id: 'diner_drum', name: 'the grease drum', x: 890, y: 1036, r: 2.4, where: 'behind the diner', verbs: ['LOOK'] });

    /* ---- hardware / town hall / post office / laundromat ---- */
    p({ id: 'hardware_counter', name: 'the counter at Pell Hardware', x: 884, y: 950.6, r: 3.2,
      where: 'inside Pell Hardware, Main Street', verbs: ['BUY'], shop: 'hardware', tags: ['shop', 'indoor'], landmark: true });
    p({ id: 'hardware_southwall', name: 'the south wall of the hardware store', x: 897, y: 949.4, r: 3.4,
      where: 'the brick wall facing Main Street', verbs: ['TOUCH'], tags: ['brick', 'warm'] });
    p({ id: 'townhall_cornerstone', name: 'the town hall cornerstone', x: 1116.4, y: 941, r: 2.4,
      where: 'the southwest corner of the town hall', verbs: ['RUB'], tags: ['stone', 'engraved'], landmark: true });
    p({ id: 'firehouse_siren', name: 'the fire siren', x: 1146, y: 924, r: 3.6,
      where: 'on the mast above the fire bay', verbs: ['LOOK'], tags: ['siren'] });
    p({ id: 'postoffice_board', name: 'the post office bulletin board', x: 1099, y: 1013.2, r: 2.6,
      where: 'outside the post office, Main Street', verbs: ['READ'], tags: ['board', 'paper'], landmark: true });
    p({ id: 'postoffice_boxes', name: 'the post office boxes', x: 1110, y: 1013.6, r: 3.0,
      where: 'inside the post office', verbs: ['ENTER'], tags: ['indoor'] });
    p({ id: 'laundromat_lostfound', name: 'the lost-and-found bin', x: 1131, y: 1013.4, r: 3.0,
      where: 'inside Wash & Go', verbs: ['SEARCH'], searchPool: 'lostfound', tags: ['indoor', 'bin'], landmark: true });
    p({ id: 'laundromat_dryer', name: 'the third dryer', x: 1139, y: 1013.4, r: 2.6,
      where: 'inside Wash & Go', verbs: ['LISTEN'], tags: ['indoor', 'machine'] });

    /* ---- church, maple, mint, cemetery ---- */
    p({ id: 'church_door', name: 'the door of Trinity Methodist', x: 726, y: 896, r: 3.2,
      where: 'Church Street', verbs: ['ENTER'], tags: ['door'], landmark: true });
    p({ id: 'church_mint', name: 'the mint behind the church', x: 694, y: 902, r: 2.8,
      where: 'the shady side of the church, Church Street', verbs: ['PICK'], tags: ['mint', 'plant'] });
    p({ id: 'church_maple', name: 'the oldest maple on Church Street', x: 742, y: 842, r: 4.2,
      where: 'Church Street, in front of the parsonage lot', verbs: ['TAKE LEAF'], tags: ['tree', 'maple'] });
    p({ id: 'cemetery_gate', name: 'the cemetery gate', x: 592, y: 678, r: 3.4,
      where: 'the end of Cemetery Lane', verbs: ['ENTER'], tags: ['gate'], landmark: true });

    /* ---- the two bridges ---- */
    p({ id: 'bridge_concrete_center', name: 'the exact centre of the concrete bridge', x: bridgeC.x, y: bridgeC.y, r: 2.2,
      where: 'Main Street, over Little Fox Creek', verbs: ['STAND'], tags: ['bridge', 'concrete'], landmark: true });
    p({ id: 'bridge_concrete_rail', name: "the concrete bridge's railing", x: bridgeC.x + 4, y: bridgeC.y - 5, r: 2.6,
      where: 'Main Street, over Little Fox Creek', verbs: ['LOOK'], tags: ['bridge'] });
    var creekS = polyNearest(town.creek.pts, bridgeC.x, bridgeC.y).s;
    var shallow = polyPointAt(town.creek.pts, creekS + 19);
    var shallowN = polyNormal(town.creek.pts, shallow.seg);
    var deep = polyPointAt(town.creek.pts, creekS + 152);
    p({ id: 'creek_shallow_bend', name: 'the shallow bend beneath the concrete bridge',
      x: shallow.x + shallowN.x * 1.6, y: shallow.y + shallowN.y * 1.6, r: 3.4,
      where: 'the creek bank, downstream of the Main Street bridge', verbs: ['FILL', 'SEARCH'], searchPool: 'culvert', tags: ['water', 'creek', 'shallow'] });
    p({ id: 'creek_deep_bend', name: 'the deep bend', x: deep.x, y: deep.y, r: 3.4,
      where: 'further down Little Fox Creek', verbs: ['FILL'], tags: ['water', 'creek', 'deep'],
      decoyFor: 'bend', decoyLine: 'This is the deep bend. The errand said the shallow bend. You put the jar back in your coat.' });
    p({ id: 'bridge_stone_moss', name: 'the mossy stones of the old stone bridge', x: bridgeS.x - 3, y: bridgeS.y + 4, r: 3.2,
      where: 'County Road 9, where it crosses the creek', verbs: ['SCRAPE'], tags: ['bridge', 'stone', 'moss'], landmark: true });
    p({ id: 'bridge_stone_arch', name: 'the third arch stone from the left', x: bridgeS.x + 3, y: bridgeS.y + 6, r: 2.4,
      where: 'the underside of the stone bridge', verbs: ['CHIP'], tags: ['bridge', 'stone', 'mortar'] });
    p({ id: 'bridge_stone_center', name: 'the middle of the stone bridge', x: bridgeS.x, y: bridgeS.y, r: 2.4,
      where: 'County Road 9, over the creek', verbs: ['STAND'], tags: ['bridge', 'stone'] });

    /* ---- the railroad grade ---- */
    var rail = town.rail.pts, railLen = polyLength(rail);
    p({ id: 'rail_ballast', name: 'the railroad ballast', rect: { x: 560, y: 1330, w: 420, h: 58 },
      where: 'the old grade, west of South Church Street', verbs: ['SEARCH'], searchPool: 'ballast', tags: ['search', 'rail'], landmark: true });
    p({ id: 'rail_rust', name: 'the rail itself', x: 880, y: 1394, r: 3.0,
      where: 'the old grade', verbs: ['SCRAPE'], tags: ['rail', 'rust', 'iron'] });
    for (var w = 0; w < 6; w++) {
      var q = polyPointAt(rail, (railLen * (w + 0.5)) / 6);
      p({ id: 'rail_walk_' + w, name: 'the grade at ' + U.ordinal(w + 1) + ' marker', x: q.x, y: q.y, r: 14,
        where: 'along the old grade', verbs: [], waypoint: true, hidden: true, tags: ['rail'] });
    }
    var railEnd = rail[rail.length - 1];
    p({ id: 'rail_end', name: 'where the trestle used to be', x: railEnd[0] - 6, y: railEnd[1], r: 4.0,
      where: 'the east end of the grade, at the creek', verbs: ['LOOK'], tags: ['rail'] });

    /* ---- the Vandermeer place ---- */
    p({ id: 'farmhouse_collapsed', name: 'the most collapsed room', rect: { x: 1668, y: 414, w: 10, h: 7 },
      where: 'the back northeast room of the Vandermeer place, off Farm Lane', verbs: ['SEARCH'], searchPool: 'farmhouse', tags: ['search', 'ruin', 'indoor'], landmark: true });
    p({ id: 'farmhouse_porch', name: 'under the farmhouse porch', rect: { x: 1666, y: 402, w: 20, h: 6 },
      where: 'the front porch of the Vandermeer place', verbs: ['SEARCH'], searchPool: 'farmporch', tags: ['search', 'ruin'] });
    p({ id: 'farmhouse_barn', name: 'the barn floor', rect: { x: 1700, y: 440, w: 24, h: 17 },
      where: 'the Vandermeer barn, off Farm Lane', verbs: ['SEARCH'], searchPool: 'barn', tags: ['search', 'ruin'] });
    p({ id: 'farmhouse_well', name: 'the capped well', x: 1692, y: 428, r: 2.6,
      where: 'between the house and the barn', verbs: ['LISTEN'], tags: ['well'] });

    /* ---- the old lot, the alley ---- */
    p({ id: 'oldlot', name: 'the old parking lot', rect: { x: 1224, y: 1050, w: 62, h: 44 },
      where: 'in front of the shuttered feed store, Depot Street', verbs: ['SEARCH'], searchPool: 'oldlot', tags: ['search', 'asphalt', 'cracked'], landmark: true });
    p({ id: 'feedstore_alley', name: 'the alley behind the feed store', rect: { x: 1224, y: 1006, w: 60, h: 11 },
      where: 'behind the feed store, Depot Street', verbs: ['SEARCH'], searchPool: 'alley', tags: ['search'] });
    p({ id: 'feedstore_door', name: 'the padlocked feed store door', x: 1253, y: 1047.4, r: 2.8,
      where: 'Depot Street', verbs: ['LOOK'], tags: ['door', 'locked'] });

    /* ---- water tower, cell tower, silos ---- */
    p({ id: 'watertower_ladder', name: "the water tower's ladder", x: town.watertower.x - 7, y: town.watertower.y + 8, r: 3.0,
      where: 'the water tower, north of Main on the rise', verbs: ['COUNT'], tags: ['ladder', 'steel'], landmark: true });
    p({ id: 'watertower_base', name: 'under the water tower', x: town.watertower.x, y: town.watertower.y + 10, r: 5.0,
      where: 'the water tower', verbs: ['LISTEN'], tags: ['steel'] });
    p({ id: 'celltower_base', name: 'the base of the cell tower', x: town.celltower.x, y: town.celltower.y + 6, r: 4.0,
      where: 'the ridge, east of Quarry Road', verbs: ['LISTEN'], tags: ['steel'], landmark: true });
    p({ id: 'celltower_shadow', name: "where the tower's shadow crosses Quarry Road", x: 1303, y: 688, r: 4.6,
      where: 'Quarry Road, level with the ridge', verbs: ['MARK'], tags: ['shadow', 'gravel'] });
    p({ id: 'silo_spill', name: 'the grain spill at the co-op', x: 1572, y: 1236, r: 3.4,
      where: 'the Farmers Co-op, off the access road', verbs: ['TAKE'], tags: ['grain'], landmark: true });
    p({ id: 'coop_scale', name: 'the co-op scale', x: 1546, y: 1258.5, r: 3.0,
      where: 'the Farmers Co-op', verbs: ['STAND'], tags: ['scale'] });

    /* ---- school, ballfield, park, bus ---- */
    p({ id: 'school_door', name: 'the school door', x: 885, y: 1157, r: 3.4,
      where: 'Hollis Bend Elementary, off Depot Street', verbs: ['ENTER'], tags: ['door'], landmark: true });
    p({ id: 'school_flagpole', name: 'the school flagpole', x: 844, y: 1166, r: 2.6,
      where: 'in front of the school', verbs: ['LOOK'], tags: ['pole'] });
    p({ id: 'school_hoop', name: 'the school hoop with the chain net', x: 934, y: 1196, r: 3.0,
      where: 'the school blacktop', verbs: ['LOOK'], tags: ['hoop'] });
    p({ id: 'ballfield_backstop', name: "the backstop's corner post", x: 992, y: 1250, r: 2.8,
      where: 'the ballfield, behind the school', verbs: ['SCRAPE'], tags: ['paint', 'steel'], landmark: true });
    p({ id: 'ballfield_center', name: 'the exact middle of the ballfield', x: 1016, y: 1292, r: 3.2,
      where: 'the ballfield', verbs: ['STAND'], tags: ['grass'] });
    p({ id: 'ballfield_dugout', name: 'the home dugout', rect: { x: 964, y: 1258, w: 14, h: 5 },
      where: 'the ballfield', verbs: ['SEARCH'], searchPool: 'dugout', tags: ['search'] });
    p({ id: 'park_swing', name: 'the swing set', x: 650, y: 1190, r: 3.4,
      where: 'the town park, Depot Street', verbs: ['SIT'], tags: ['swing'], landmark: true });
    p({ id: 'park_pavilion', name: 'the park pavilion', x: 698, y: 1202, r: 5.0,
      where: 'the town park', verbs: ['SIT'], tags: ['shelter'] });
    p({ id: 'park_hoop', name: 'the bad hoop at the park', x: 664, y: 1234, r: 3.2,
      where: 'the park court', verbs: ['LOOK'], tags: ['hoop'] });
    p({ id: 'busstop', name: 'the bus shelter', x: 896, y: 1114, r: 3.2,
      where: 'Depot Street, across from the school', verbs: ['SIT'], tags: ['shelter'], landmark: true });

    /* ---- pond, drains, culverts ---- */
    p({ id: 'pond_edge', name: "the pond's edge", x: 400 - 46, y: 1180, r: 4.0,
      where: 'the retaining pond west of the park', verbs: ['FILL'], tags: ['water', 'pond'], landmark: true });
    p({ id: 'pond_cattails', name: 'the cattails', x: 392, y: 1132, r: 4.4,
      where: 'the north edge of the pond', verbs: ['PICK'], tags: ['plant'] });
    p({ id: 'pond_culvert', name: 'the pond culvert', rect: { x: 340, y: 1148, w: 12, h: 10 },
      where: 'the inlet on the west side of the pond', verbs: ['SEARCH', 'LISTEN'], searchPool: 'culvert', tags: ['search', 'concrete'] });
    p({ id: 'storm_drain_echo', name: 'the storm drain that echoes', x: 604, y: 1128, r: 2.4,
      where: 'the north gutter of Depot Street, near the park', verbs: ['SPEAK'], tags: ['drain', 'echo'] });
    p({ id: 'storm_drain_other', name: 'a storm drain', x: 1082, y: 1004, r: 2.4,
      where: 'Main Street', verbs: ['SPEAK'], tags: ['drain'],
      decoyFor: 'echo', decoyLine: 'You say the word. It does not echo. This is a normal drain and you feel normal saying so.' });

    /* ---- storage, recycling, construction ---- */
    p({ id: 'storage_doors', name: 'the tops of the storage unit doors', x: 1422, y: 1167, r: 5.6,
      where: 'Bend Self Storage, off Old Mill Road', verbs: ['WIPE'], tags: ['dust', 'steel'], landmark: true });
    p({ id: 'recycling_bins', name: 'the recycling bins', rect: { x: 1470, y: 1112, w: 22, h: 12 },
      where: 'the drop-off at the co-op access road', verbs: ['SEARCH'], searchPool: 'recycling', tags: ['search'], landmark: true });
    p({ id: 'construction_scrap', name: 'the scrap pile', rect: { x: 1160, y: 1252, w: 13, h: 11 },
      where: 'the new house on Elm Court', verbs: ['SEARCH'], searchPool: 'scrap', tags: ['search'], landmark: true });
    p({ id: 'construction_frame', name: 'the framing on Elm Court', x: 1146, y: 1250, r: 5.0,
      where: 'Elm Court', verbs: ['LOOK'], tags: ['lumber'] });
    p({ id: 'construction_john', name: 'the porta-john', x: 1176, y: 1238, r: 2.4,
      where: 'Elm Court', verbs: ['LOOK'], tags: [] });

    /* ---- the edges: woods, pasture, ditch, clay, tar ---- */
    p({ id: 'treeline', name: 'the treeline', rect: { x: 280, y: 180, w: 520, h: 120 },
      where: 'the woods along the north edge of the section', verbs: ['SEARCH'], searchPool: 'woods', tags: ['search', 'woods'], landmark: true });
    p({ id: 'woods_nest', name: 'a nest with no bird in it', x: 470, y: 268, r: 3.0,
      where: 'low in a hawthorn at the treeline', verbs: ['LOOK'], tags: ['nest'] });
    p({ id: 'pasture_fence', name: 'the fence line', rect: { x: 300, y: 660, w: 260, h: 26 },
      where: 'the pasture west of Church Street', verbs: ['SEARCH'], searchPool: 'pasture', tags: ['search', 'fence'], landmark: true });
    p({ id: 'ditch_cr9', name: 'the ditch along County Road 9', rect: { x: 300, y: 1566, w: 420, h: 22 },
      where: 'the north ditch of County Road 9, west of the crossing', verbs: ['SEARCH'], searchPool: 'ditch', tags: ['search', 'ditch'], landmark: true });
    p({ id: 'ditch_cr9_east', name: 'the far ditch on County Road 9', rect: { x: 1440, y: 1690, w: 340, h: 22 },
      where: 'the south ditch of County Road 9, east of the stone bridge', verbs: ['SEARCH'], searchPool: 'ditch', tags: ['search', 'ditch'] });
    p({ id: 'clay_bank', name: 'the clay bank', x: 1348, y: 1408, r: 4.2,
      where: 'the cut bank at the end of Old Mill Road', verbs: ['DIG'], tags: ['clay'], landmark: true });
    p({ id: 'tar_bubble', name: 'the tar where it has bubbled up', x: 1252, y: 1002, r: 2.8,
      where: 'Main Street, the eastbound lane past the feed store', verbs: ['TAKE'], tags: ['tar', 'asphalt'] });
    p({ id: 'field_north', name: 'the north field', rect: { x: 900, y: 340, w: 300, h: 220 },
      where: 'the north half of the section', verbs: ['LOOK'], tags: ['field'] });
    p({ id: 'field_south', name: 'the south field', rect: { x: 240, y: 1760, w: 380, h: 200 },
      where: 'the ground south of County Road 9', verbs: ['LOOK'], tags: ['field'] });

    /* ---- the dying streetlamp, and its honest neighbours ---- */
    p({ id: 'streetlamp_dying', name: 'the dying streetlamp on Quarry Road', x: 1290, y: 700, r: 4.0,
      where: 'Quarry Road, the only pole between Main and the farm lane', verbs: ['WAIT'], photo: true, tags: ['lamp', 'dying'], landmark: true });

    /* ---- your rented house ---- */
    var home = town.home;
    p({ id: 'home_door', name: 'your front door', x: home.doorX, y: home.doorY, r: 3.0,
      where: 'the old Latham place, Depot Street', verbs: ['ENTER'], tags: ['door', 'home'], landmark: true });
    p({ id: 'home_porch', name: 'your porch', x: home.porchX, y: home.porchY, r: 3.2,
      where: 'the old Latham place, Depot Street', verbs: ['SIT'], tags: ['home'] });
    p({ id: 'home_windowsill', name: 'your windowsill', x: home.sillX, y: home.sillY, r: 2.6,
      where: 'the south-facing window of your rental', verbs: ['PLACE'], tags: ['home', 'sun'] });
    p({ id: 'home_mailbox', name: 'your mailbox', x: home.mailX, y: home.mailY, r: 2.4,
      where: 'the curb at the old Latham place', verbs: ['OPEN'], tags: ['mailbox', 'home'] });

    /* ---- plant patches ---- */
    var patches = [
      ['dandelion_park', 'the dandelions at the park', { x: 620, y: 1250, w: 46, h: 30 }, 'the rough grass past the park court'],
      ['dandelion_ballfield', 'the dandelions past the outfield', { x: 1030, y: 1320, w: 52, h: 34 }, 'past the ballfield outfield'],
      ['dandelion_cr9', 'the dandelions on the county right-of-way', { x: 880, y: 1600, w: 60, h: 26 }, 'the right-of-way along County Road 9'],
      ['milkweed_grade', 'the milkweed on the grade', { x: 1140, y: 1404, w: 60, h: 30 }, 'the embankment of the old grade'],
      ['milkweed_pasture', 'the milkweed by the pasture gate', { x: 470, y: 700, w: 40, h: 26 }, 'inside the pasture gate']
    ];
    for (var pi = 0; pi < patches.length; pi++) {
      p({ id: patches[pi][0], name: patches[pi][1], rect: patches[pi][2], where: patches[pi][3],
        verbs: ['PICK'], tags: [patches[pi][0].indexOf('dandelion') === 0 ? 'dandelion' : 'milkweed', 'plant'] });
    }
    p({ id: 'acorn_ground', name: 'the ground under the big oaks', rect: { x: 640, y: 640, w: 80, h: 70 },
      where: 'under the oaks between the church and the cemetery', verbs: ['PICK'], tags: ['acorn', 'plant'] });

    /* ---- hydrants: five of them, one worst ---- */
    var hydrantSpots = [[884, 992], [1084, 992], [1180, 1006], [712, 1124], [960, 1124]];
    var worst = rng.int(0, hydrantSpots.length - 1);
    for (var hi = 0; hi < hydrantSpots.length; hi++) {
      p({ id: 'hydrant_' + hi, name: 'the hydrant at ' + (hydrantSpots[hi][1] < 1000 ? 'Main and ' : 'Depot and ') + U.ordinal(hi + 1),
        x: hydrantSpots[hi][0], y: hydrantSpots[hi][1], r: 2.4, verbs: ['SIT'],
        where: hydrantSpots[hi][1] < 1010 ? 'Main Street' : 'Depot Street',
        chipped: hi === worst ? 1.0 : rng.float(0.1, 0.62), tags: ['hydrant', 'paint'] });
      if (hi === worst) town.worstHydrant = 'hydrant_' + hi;
    }

    /* ---- fence posts you can wrap twine around until you run out ---- */
    for (var fp = 0; fp < 4; fp++) {
      var fx = 312 + fp * 62, fy = 664 + (fp % 2) * 3;
      p({ id: 'fencepost_' + fp, name: 'a fence post on the pasture line', x: fx, y: fy, r: 2.2,
        where: 'the pasture fence west of Church Street', verbs: ['WRAP'], tags: ['fencepost'] });
    }

    return town;
  }

  /* ------------------------------------------------------------------ *
   *  the cemetery. forty-odd stones, the oldest of which matters.
   * ------------------------------------------------------------------ */

  function buildCemetery(town, rng) {
    var plot = { x: 500, y: 596, w: 148, h: 112 };
    town.cemetery = { plot: plot, graves: [] };
    var styles = ['tablet', 'tablet', 'tablet', 'flat', 'obelisk', 'lamb', 'military', 'tablet', 'flat'];
    var rows = 6, perRow = 8;
    var earliest = null, lambId = null;
    var usedLamb = false;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < perRow; c++) {
        if (rng.chance(0.08)) continue;                     /* gaps, as in life */
        var id = 'grave_' + r + '_' + c;
        var gx = plot.x + 14 + c * ((plot.w - 26) / (perRow - 1)) + rng.float(-1.2, 1.2);
        var gy = plot.y + 16 + r * ((plot.h - 30) / (rows - 1)) + rng.float(-0.8, 0.8);
        var style = rng.pick(styles);
        if (style === 'lamb') { if (usedLamb) style = 'tablet'; else { usedLamb = true; lambId = id; } }
        var born = rng.int(1832, 1946);
        var died = born + rng.int(1, 89);
        if (died > 2019) died = 2019 - rng.int(0, 40);
        if (style === 'lamb') { born = rng.int(1878, 1931); died = born + rng.int(0, 4); }
        var g = {
          id: id, x: gx, y: gy, style: style,
          first: rng.pick(N.graveFirst),
          last: rng.pick(N.last),
          born: born, died: died,
          epitaph: rng.chance(0.62) ? rng.pick(N.graveEpitaph) : null,
          lichen: rng.float(0, 1),
          lean: rng.float(-0.09, 0.09),
          legible: rng.float(0.25, 1)
        };
        town.cemetery.graves.push(g);
        if (!earliest || g.died < earliest.died) earliest = g;

        prop(town, {
          id: id, name: g.first + ' ' + g.last + ', ' + g.born + '–' + g.died,
          x: gx, y: gy, r: 2.1, verbs: ['TRACE'], grave: g,
          where: 'Hollis Bend Cemetery, row ' + (r + 1), tags: ['grave', 'stone', style]
        });
      }
    }
    town.earliestGrave = earliest ? earliest.id : town.cemetery.graves[0].id;
    town.lambGrave = lambId;
    prop(town, { id: 'cemetery_spigot', name: 'the cemetery spigot', x: plot.x + 8, y: plot.y + plot.h - 8,
      r: 2.4, verbs: ['FILL'], where: 'inside the cemetery gate', tags: ['water', 'tap'] });
    return town;
  }

  /* ------------------------------------------------------------------ *
   *  scenery: woods, fields, poles, signs, town streetlamps
   * ------------------------------------------------------------------ */

  function buildScenery(town, rng) {
    var i;

    town.woods = [
      { x: 260, y: 150, w: 600, h: 160 },
      { x: 0, y: 60, w: 300, h: 250 },
      { x: 1740, y: 1180, w: 260, h: 330 },
      { x: 60, y: 1820, w: 340, h: 180 }
    ];

    /* September: corn standing, beans turning, hay cut twice already */
    town.fields = [
      { x: 880, y: 320, w: 340, h: 250, crop: 'corn',   dir: 0 },
      { x: 1380, y: 120, w: 300, h: 230, crop: 'bean',  dir: 1 },
      { x: 180, y: 380, w: 380, h: 250, crop: 'hay',    dir: 0 },
      { x: 120, y: 760, w: 400, h: 200, crop: 'pasture', dir: 0 },
      { x: 1560, y: 760, w: 380, h: 200, crop: 'corn',  dir: 1 },
      { x: 200, y: 1760, w: 420, h: 220, crop: 'bean',  dir: 0 },
      { x: 1500, y: 1860, w: 420, h: 140, crop: 'hay',  dir: 0 },
      { x: 180, y: 1120, w: 180, h: 200, crop: 'fallow', dir: 0 },
      { x: 1600, y: 400, w: 300, h: 240, crop: 'hay',   dir: 1 }
    ];

    /* Everything that has been paved, poured or graded flat, as data rather
       than as geometry. The renderer lays these down and terrainAt reads the
       same list, so a concrete walk is concrete to the grass, to the
       residents' walking speed and to the eye at once. Keeping it in the
       renderer is what had tufts of lawn growing up through the front walk. */
    town.paving = [
      { x: 1000, y: 946, w: 78, h: 38, kind: 'asphalt' },   /* Bend Mart */
      { x: 1224, y: 1050, w: 62, h: 44, kind: 'asphalt' },  /* the old feed store lot */
      { x: 1224, y: 1006, w: 60, h: 11, kind: 'gravel' },   /* the alley */
      { x: 878, y: 1190, w: 66, h: 22, kind: 'asphalt' },   /* school blacktop */
      { x: 650, y: 1222, w: 30, h: 20, kind: 'asphalt' },   /* the park court */
      { x: 1390, y: 1182, w: 68, h: 13, kind: 'gravel' },   /* storage apron */
      { x: 1464, y: 1106, w: 34, h: 22, kind: 'gravel' },   /* recycling drop-off */
      { x: 1516, y: 1232, w: 104, h: 60, kind: 'gravel' },  /* co-op yard */
      { x: 1122, y: 1234, w: 68, h: 42, kind: 'dirt' },     /* the new build */
      { x: 1656, y: 396, w: 80, h: 74, kind: 'dirt' },      /* the Vandermeer yard */
      { x: 562, y: 650, w: 50, h: 34, kind: 'gravel' },     /* cemetery turnaround */
      { x: 886, y: 1008, w: 50, h: 10, kind: 'concrete' },  /* the walk in front of the diner */
      { x: 1000, y: 984, w: 82, h: 5, kind: 'concrete' },   /* the walk at Bend Mart */
      { x: 1090, y: 1008, w: 76, h: 9, kind: 'concrete' },  /* post office and laundromat walk */
      { x: 874, y: 920, w: 290, h: 5, kind: 'concrete' }    /* the north side of Main, such as it is */
    ];

    /* poured in a line rather than a rectangle: your own front walk */
    town.pavedStrips = [
      { x0: 679.5, y0: 1130, x1: 679.5, y1: 1116, w: 3.2, kind: 'concrete' }
    ];

    /* scattered trees, denser near water and the old places */
    town.trees = [];
    var tn = new ER.Noise(town.seed ^ 0x51ee);
    for (i = 0; i < 1500; i++) {
      var tx = rng.float(0, W), ty = rng.float(0, H);
      var dens = tn.fbm(tx / 260, ty / 260, 3);
      var nearCreek = polyNearest(town.creek.pts, tx, ty).d;
      var boost = nearCreek < 30 ? 0.45 : 0;
      if (dens + boost < 0.56) continue;
      if (town.isBlocked(tx, ty)) continue;
      if (onRoad(town, tx, ty, 6)) continue;
      if (inAnyRect(town.fields, tx, ty)) continue;
      town.trees.push({ x: tx, y: ty, r: rng.float(3, 8.5),
        kind: rng.pick(['oak', 'maple', 'ash', 'spruce', 'walnut', 'hawthorn']) });
    }
    /* deliberate stands */
    var stands = [[640, 650, 8, 'oak'], [700, 640, 7, 'oak'], [664, 690, 9, 'oak'],
      [520, 620, 6, 'spruce'], [628, 620, 5, 'spruce'], [1690, 470, 7, 'walnut'],
      [1660, 392, 6, 'maple'], [470, 268, 4.2, 'hawthorn'], [742, 842, 8.5, 'maple']];
    for (i = 0; i < stands.length; i++)
      town.trees.push({ x: stands[i][0], y: stands[i][1], r: stands[i][2], kind: stands[i][3] });
    for (i = 0; i < town.woods.length; i++) {
      var wd = town.woods[i];
      for (var k = 0; k < (wd.w * wd.h) / 420; k++) {
        town.trees.push({ x: wd.x + rng.float(0, wd.w), y: wd.y + rng.float(0, wd.h),
          r: rng.float(4, 9), kind: rng.pick(['oak', 'ash', 'maple', 'spruce']) });
      }
    }

    /* utility poles along the paved roads, with wire between them */
    town.poles = [];
    var paved = ['main', 'church', 'depot', 'elm', 'cr9', 'quarry'];
    for (i = 0; i < paved.length; i++) {
      var rd = town.roadById[paved[i]];
      if (!rd) continue;
      var len = polyLength(rd.pts), spacing = 58, prev = null;
      for (var s = 12; s < len; s += spacing) {
        var q = polyPointAt(rd.pts, s), nn = polyNormal(rd.pts, q.seg);
        var side = (paved[i] === 'main' || paved[i] === 'cr9') ? -1 : 1;
        var px = q.x + nn.x * side * (rd.width / 2 + rd.shoulder + 1.6);
        var py = q.y + nn.y * side * (rd.width / 2 + rd.shoulder + 1.6);
        var pole = { x: px, y: py, prev: prev, transformer: rng.chance(0.14) };
        town.poles.push(pole);
        prev = pole;
      }
    }

    /* streetlamps: only the built-up blocks have them */
    town.lamps = [];
    var lampSpots = [];
    for (var lx = 856; lx <= 1216; lx += 52) lampSpots.push([lx, 989, 'main']);
    for (var lx2 = 880; lx2 <= 1136; lx2 += 58) lampSpots.push([lx2, 1011, 'main']);
    for (var ly = 1060; ly <= 1300; ly += 62) lampSpots.push([748, ly, 'church']);
    for (var lx3 = 620; lx3 <= 1180; lx3 += 64) lampSpots.push([lx3, 1120, 'depot']);
    for (i = 0; i < lampSpots.length; i++) {
      town.lamps.push({ x: lampSpots[i][0], y: lampSpots[i][1], dying: false,
        phase: rng.float(0, 6.28), r: 26 });
    }
    /* the one on Quarry Road that is going. it is going slowly. */
    town.lamps.push({ x: 1290, y: 700, dying: true, phase: 0, r: 24, propId: 'streetlamp_dying' });

    /* signs */
    town.signs = [
      { x: 150, y: 1014, text: 'HOLLIS BEND\nPOP. 30', kind: 'limit', ang: 0 },
      { x: 1880, y: 986, text: 'HOLLIS BEND\nPOP. 30', kind: 'limit', ang: Math.PI },
      { x: 774, y: 1012, text: 'STOP', kind: 'stop' },
      { x: 1290, y: 1012, text: 'STOP', kind: 'stop' },
      { x: 1192, y: 1120, text: 'STOP', kind: 'stop' },
      { x: 780, y: 1120, text: 'STOP', kind: 'stop' },
      { x: 946, y: 984, text: 'SPEED\nLIMIT\n25', kind: 'speed' },
      { x: 1440, y: 986, text: 'BRIDGE\nMAY ICE', kind: 'warn' },
      { x: 1372, y: 1670, text: 'WEIGHT\nLIMIT\n8 TON', kind: 'warn' },
      { x: 806, y: 1378, text: 'NO\nTRESPASSING', kind: 'warn' },
      { x: 1276, y: 1046, text: 'FOR SALE\nOR LEASE', kind: 'warn' },
      { x: 592, y: 664, text: 'HOLLIS BEND\nCEMETERY', kind: 'limit' },
      { x: 1160, y: 1232, text: 'LOT 4\nSOLD', kind: 'warn' }
    ];

    /* the water tower and the cell tower are landmarks in their own right */
    town.watertower = town.watertower || { x: 1176, y: 856, r: 11 };
    town.celltower = town.celltower || { x: 1618, y: 618 };
    town.silos = town.silos || [{ x: 1580, y: 1248, r: 6.5 }, { x: 1596, y: 1252, r: 6.5 }];

    return town;
  }

  /* shove a point out through whichever wall of the rect it is nearest to */
  function pushOutOfRect(x, y, r, pad, freeTest) {
    var cands = [
      { d: x - r.x,           x: r.x - pad,       y: y },
      { d: r.x + r.w - x,     x: r.x + r.w + pad, y: y },
      { d: y - r.y,           x: x,               y: r.y - pad },
      { d: r.y + r.h - y,     x: x,               y: r.y + r.h + pad }
    ].sort(function (a, b) { return a.d - b.d; });
    for (var i = 0; i < cands.length; i++) {
      if (!freeTest || freeTest(cands[i].x, cands[i].y)) return { x: cands[i].x, y: cands[i].y };
    }
    return { x: cands[0].x, y: cands[0].y };
  }

  function inAnyRect(list, x, y) {
    for (var i = 0; i < list.length; i++) if (U.pointInRect(x, y, list[i])) return true;
    return false;
  }

  function onRoad(town, x, y, pad) {
    for (var i = 0; i < town.roads.length; i++) {
      var rd = town.roads[i];
      if (polyNearest(rd.pts, x, y).d < rd.width / 2 + rd.shoulder + (pad || 0)) return true;
    }
    return false;
  }

  /* ------------------------------------------------------------------ *
   *  collision, terrain, and the road graph the residents walk on
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

  /* insert a vertex into every road at every place two roads cross, so the
     resident walking graph is actually connected */
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
    function nodeAt(x, y) {
      var key = Math.round(x / 4) + ',' + Math.round(y / 4);
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
    /* stitch nodes that sit on top of each other but rounded apart */
    for (i = 0; i < nodes.length; i++) {
      for (j = i + 1; j < nodes.length; j++) {
        var dd = U.dist(nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y);
        if (dd < 9) {
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

    /* dijkstra; the graph is a couple of hundred nodes so this is free */
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
   *  assembly
   * ------------------------------------------------------------------ */

  function generateTown(seedStr) {
    var seed = ER.hashStr(String(seedStr || 'hollis bend'));
    var rng = new ER.RNG(seed);
    var town = {
      name: 'Hollis Bend', w: W, h: H, seed: seed, seedStr: String(seedStr || 'hollis bend'),
      props: {}, propList: [], lots: [], buildings: [],
      watertower: { x: 1176, y: 856, r: 11 },
      celltower: { x: 1618, y: 618 },
      silos: [{ x: 1580, y: 1248, r: 6.5 }, { x: 1596, y: 1252, r: 6.5 }]
    };

    town.roads = splitAtIntersections(roadDefs());
    town.roadById = {};
    for (var i = 0; i < town.roads.length; i++) town.roadById[town.roads[i].id] = town.roads[i];

    town.creek = creekDef();
    town.rail = railDef();
    town.pond = { x: 400, y: 1180, r: 54 };

    /* the bridges sit exactly where the roads meet the water */
    var bc = polyIntersect(town.roadById.main.pts, town.creek.pts) || { x: 1470, y: 1000 };
    var bs = polyIntersect(town.roadById.cr9.pts, town.creek.pts) || { x: 1399, y: 1678 };
    town.bridges = {
      concrete: { x: bc.x, y: bc.y, w: 26, h: 15, kind: 'concrete', road: 'main' },
      stone: { x: bs.x, y: bs.y, w: 17, h: 13, kind: 'stone', road: 'cr9' }
    };

    /* houses */
    var anchors = lotAnchors();
    for (var a = 0; a < anchors.length; a++) {
      var lot = makeLot(rng.sub('lot' + a), town, anchors[a], a);
      if (lot) town.lots.push(lot);
    }

    /* your rental. the old Latham place, month to month, furnished badly. */
    town.home = {
      house: { x: 672, y: 1101, w: 15, h: 13 },
      doorX: 679.5, doorY: 1114.8,
      porchX: 679.5, porchY: 1118.4,
      sillX: 684.6, sillY: 1114.6,
      mailX: 680, mailY: 1126.4,
      siding: '#d7d2c3', roofColor: '#67625a', number: 118,
      trees: [{ x: 674, y: 1122, r: 5.2, kind: 'maple' }, { x: 690, y: 1106, r: 4.1, kind: 'crab' }]
    };
    town.spawn = { x: 679.5, y: 1122 };

    town.buildings = buildingDefs();
    town.buildingById = {};
    for (var b = 0; b < town.buildings.length; b++) town.buildingById[town.buildings[b].id] = town.buildings[b];

    /* ---- collision ---- */
    makeGrid(town);
    for (var L = 0; L < town.lots.length; L++) {
      var lt = town.lots[L];
      blockRect(town, lt.house.x, lt.house.y, lt.house.w, lt.house.h, 0);
      if (lt.features.shed) blockRect(town, lt.features.shed.x, lt.features.shed.y, lt.features.shed.w, lt.features.shed.h, 0);
      if (lt.features.pool) blockCircle(town, lt.features.pool.x, lt.features.pool.y, lt.features.pool.r);
    }
    blockRect(town, town.home.house.x, town.home.house.y, town.home.house.w, town.home.house.h, 0);
    for (var B = 0; B < town.buildings.length; B++) {
      var bd = town.buildings[B];
      if (bd.open || bd.ruin || bd.collapsed || bd.framing) continue;
      blockRect(town, bd.x, bd.y, bd.w, bd.h, 0);
    }
    /* you can get into the ruins, but not through their standing walls */
    blockRect(town, 1664, 404, 3, 22, 0);
    blockRect(town, 1697, 437, 3, 23, 0);
    for (var S = 0; S < town.silos.length; S++) blockCircle(town, town.silos[S].x, town.silos[S].y, town.silos[S].r);
    blockCircle(town, town.pond.x, town.pond.y, town.pond.r - 13);
    var wt = town.watertower;
    blockCircle(town, wt.x - 8, wt.y + 9, 1.2); blockCircle(town, wt.x + 8, wt.y + 9, 1.2);
    blockCircle(town, wt.x - 8, wt.y - 7, 1.2); blockCircle(town, wt.x + 8, wt.y - 7, 1.2);
    blockCircle(town, town.celltower.x, town.celltower.y, 2.4);

    town.isBlocked = function (x, y) {
      if (x < 1 || y < 1 || x > W - 1 || y > H - 1) return true;
      var gx = (x / CELL) | 0, gy = (y / CELL) | 0;
      return town.blocked[gy * town.gw + gx] === 1;
    };

    /* ---- terrain, for footsteps and for how fast you can move ---- */
    town.terrainAt = function (x, y) {
      var k, rd, nr;
      for (k = 0; k < town.roads.length; k++) {
        rd = town.roads[k];
        nr = polyNearest(rd.pts, x, y);
        if (nr.d < rd.width / 2) return rd.kind;
        if (rd.bulb && U.dist(x, y, rd.bulb.x, rd.bulb.y) < rd.bulb.r) return rd.kind;
      }
      nr = polyNearest(town.creek.pts, x, y);
      if (nr.d < town.creek.width / 2 + 1) return 'water';
      if (U.dist(x, y, town.pond.x, town.pond.y) < town.pond.r) return 'water';
      nr = polyNearest(town.rail.pts, x, y);
      if (nr.d < 5) return 'ballast';
      for (k = 0; k < town.lots.length; k++) {
        var dw = town.lots[k].driveway;
        if (U.segDist(x, y, dw.x0, dw.y0, dw.x1, dw.y1).d < dw.w / 2) return dw.kind;
      }
      for (k = 0; k < town.propList.length; k++) {
        var pr = town.propList[k];
        if (pr.rect && (pr.tags.indexOf('asphalt') >= 0) && U.pointInRect(x, y, pr.rect)) return 'asphalt';
      }
      for (k = 0; k < town.pavedStrips.length; k++) {
        var st = town.pavedStrips[k];
        if (U.segDist(x, y, st.x0, st.y0, st.x1, st.y1).d < st.w / 2) return st.kind;
      }
      for (k = 0; k < town.paving.length; k++) {
        if (U.pointInRect(x, y, town.paving[k])) return town.paving[k].kind;
      }
      if (inAnyRect(town.fields, x, y)) return 'field';
      if (inAnyRect(town.woods, x, y)) return 'woods';
      return 'grass';
    };

    /* ---- speed multiplier by ground ---- */
    town.speedAt = function (x, y) {
      var t = town.terrainAt(x, y);
      if (t === 'water') return 0.42;
      if (t === 'ballast') return 0.78;
      if (t === 'field') return 0.82;
      if (t === 'woods') return 0.74;
      if (t === 'grass') return 0.93;
      return 1;
    };

    /* ---- topography. flat where the graders went, not flat elsewhere. ----
       Sampled once into a coarse grid and interpolated after that, so the
       renderer can ask for thousands of heights a frame without noticing. */
    (function () {
      var hn = new ER.Noise(seed ^ 0x7e11a1);

      /* a spatial index of every road segment, so "how far is the road" is
         a handful of tests instead of a hundred and sixty */
      var BUCKET = 70;
      var bw = Math.ceil(W / BUCKET), bh = Math.ceil(H / BUCKET);
      var buckets = new Array(bw * bh);
      function addSeg(list, ax, ay, bx, by, edge) {
        var x0 = Math.max(0, Math.floor((Math.min(ax, bx) - edge - 30) / BUCKET));
        var x1 = Math.min(bw - 1, Math.floor((Math.max(ax, bx) + edge + 30) / BUCKET));
        var y0 = Math.max(0, Math.floor((Math.min(ay, by) - edge - 30) / BUCKET));
        var y1 = Math.min(bh - 1, Math.floor((Math.max(ay, by) + edge + 30) / BUCKET));
        for (var gy = y0; gy <= y1; gy++) for (var gx = x0; gx <= x1; gx++) {
          var k = gy * bw + gx;
          if (!buckets[k]) buckets[k] = [];
          buckets[k].push([ax, ay, bx, by, edge]);
        }
      }
      for (var ri = 0; ri < town.roads.length; ri++) {
        var rd = town.roads[ri], edge = rd.width / 2 + rd.shoulder;
        for (var si = 0; si < rd.pts.length - 1; si++)
          addSeg(buckets, rd.pts[si][0], rd.pts[si][1], rd.pts[si + 1][0], rd.pts[si + 1][1], edge);
      }

      function nearestRoad(x, y) {
        var gx = U.clamp(Math.floor(x / BUCKET), 0, bw - 1);
        var gy = U.clamp(Math.floor(y / BUCKET), 0, bh - 1);
        var list = buckets[gy * bw + gx];
        if (!list) return null;
        var best = null, bd = Infinity;
        for (var i = 0; i < list.length; i++) {
          var sg = list[i];
          var r = U.segDist(x, y, sg[0], sg[1], sg[2], sg[3]);
          var beyond = r.d - sg[4];
          if (beyond < bd) { bd = beyond; best = { x: r.x, y: r.y, beyond: beyond }; }
        }
        return best;
      }

      /* the land itself, before anybody graded anything */
      function raw(x, y) {
        var h = (hn.fbm(x / 760, y / 760, 3) - 0.5) * 7.4     /* the shape of the section */
              + (hn.fbm(x / 230, y / 230, 3) - 0.5) * 2.6     /* rolls */
              + (hn.fbm(x / 64, y / 64, 2) - 0.5) * 0.55;     /* lumps */
        /* the cemetery is on the rise, which is why it is there */
        var dc2 = (x - 575) * (x - 575) + (y - 652) * (y - 652);
        h += 7.0 * Math.exp(-dc2 / 18225);
        /* the ridge the cell tower and the repeater shed stand on */
        var dr2 = (x - 1616) * (x - 1616) + (y - 618) * (y - 618);
        h += 9.5 * Math.exp(-dr2 / 32400);
        /* and Little Fox Creek has cut itself down through all of it */
        var cn = polyNearest(town.creek.pts, x, y);
        h -= 3.4 * Math.exp(-(cn.d * cn.d) / 5476);
        return h;
      }

      /* graded flat out to 26 m either side of every road */
      function graded(x, y) {
        var h = raw(x, y);
        var nr = nearestRoad(x, y);
        if (nr && nr.beyond < 26) {
          var onRoad = raw(nr.x, nr.y);
          h = U.lerp(onRoad, h, U.smooth(U.clamp(nr.beyond / 26, 0, 1)));
        }
        return h;
      }

      /* bake it: 5 m grid, bilinear after that */
      var STEP = 5;
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

      /* the surface normal, for laying things down so they sit on the ground */
      town.slopeAt = function (x, y) {
        var e = 2.0;
        return { dx: (town.heightAt(x + e, y) - town.heightAt(x - e, y)) / (2 * e),
          dy: (town.heightAt(x, y + e) - town.heightAt(x, y - e)) / (2 * e) };
      };

      town.heightGrid = { data: grid, step: STEP, w: gw, h: gh2 };
    })();

    buildCemetery(town, rng.sub('graves'));
    buildProps(town, rng.sub('props'));
    buildScenery(town, rng.sub('scenery'));
    buildGraph(town);

    /* one mailbox in town has a number that is not its number */
    var shuffled = rng.sub('mailmix').shuffle(town.lots.slice());
    var oddLot = shuffled[0];
    oddLot.mailbox.shown = String(Math.max(2, oddLot.number + rng.sub('mailmix2').pick([-20, -12, 12, 20, 200])));
    oddLot.mailbox.mismatched = true;
    town.mismatchedMailbox = oddLot.id;
    for (var mL = 0; mL < town.lots.length; mL++) {
      var ml = town.lots[mL];
      prop(town, { id: 'mailbox_' + ml.id, name: 'the mailbox at ' + ml.mailbox.shown + ' ' +
          (N.streets[ml.road] || 'the road'),
        x: ml.mailbox.x, y: ml.mailbox.y, r: 2.2, verbs: ['READ'],
        where: N.streets[ml.road] || 'the road', lot: ml.id, tags: ['mailbox'] });
      if (ml.features.cars) {
        for (var cI = 0; cI < ml.features.cars.length; cI++) {
          var car = ml.features.cars[cI];
          prop(town, { id: 'car_' + ml.id + '_' + cI,
            name: 'the ' + car.kind + ' in the driveway at ' + ml.number + ' ' + (N.streets[ml.road] || ''),
            x: car.x, y: car.y - 2.6, r: 3.0, verbs: ['SCRAPE', 'LOOK'],
            where: N.streets[ml.road] || 'the road', lot: ml.id, tags: ['car', 'windshield'] });
        }
      }
      if (ml.features.dish) {
        var dsh = ml.features.dish, hs = ml.house, outP = pushOutOfRect(dsh.x, dsh.y, hs, 2.0, function (qx, qy) { return !town.isBlocked(qx, qy); });
        prop(town, { id: 'dish_' + ml.id, name: 'the satellite dish at ' + ml.number + ' ' + (N.streets[ml.road] || ''),
          x: outP.x, y: outP.y, r: 3.0, verbs: ['LOOK'], photo: true, dishAt: { x: dsh.x, y: dsh.y },
          where: N.streets[ml.road] || 'the road', lot: ml.id, tags: ['dish', 'satellite'] });
      }
    }

    /* the map legend */
    town.landmarks = [];
    for (var pl = 0; pl < town.propList.length; pl++) {
      var pp = town.propList[pl];
      if (pp.landmark) town.landmarks.push({ id: pp.id, name: pp.name, x: pp.rect ? pp.rect.x + pp.rect.w / 2 : pp.x,
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
      if (pr.rect) return U.pointInRect(x, y, { x: pr.rect.x - slack - 1.4, y: pr.rect.y - slack - 1.4,
        w: pr.rect.w + (slack + 1.4) * 2, h: pr.rect.h + (slack + 1.4) * 2 });
      return U.dist(x, y, pr.x, pr.y) <= pr.r + slack;
    };

    /* the closest prop you could plausibly be talking about */
    town.propAt = function (x, y, preferId) {
      var best = null, bestScore = Infinity;
      for (var k = 0; k < town.propList.length; k++) {
        var pr = town.propList[k];
        if (pr.hidden) continue;
        if (!town.inProp(pr, x, y, 0)) continue;
        var pos = town.propPos(pr);
        var score = U.dist(x, y, pos.x, pos.y) - (pr.id === preferId ? 200 : 0) - (pr.rect ? 0 : 1.5);
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
      return bd < 60 ? best.name : null;
    };

    return town;
  }

  ER.generateTown = generateTown;
  ER.TOWN_W = W;
  ER.TOWN_H = H;
})(typeof window !== 'undefined' ? (window.ER = window.ER || {}) : (global.ER = global.ER || {}));
