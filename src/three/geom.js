/* Errands — geometry helpers.
 *
 * Ribbons that follow the ground, gable roofs, and a batcher that merges
 * everything sharing a material so that thirty-one houses are a handful of
 * draw calls instead of nine hundred. */
(function (ER) {
  'use strict';
  var U = ER.U;
  var T = window.THREE;
  var G = {};

  /* ---------------- merging ---------------- */

  G.merge = function (geos) {
    if (!geos.length) return null;
    var hasUV = true, hasColor = false, i;
    for (i = 0; i < geos.length; i++) {
      if (!geos[i].attributes.uv) hasUV = false;
      if (geos[i].attributes.color) hasColor = true;
    }
    var vCount = 0, iCount = 0;
    for (i = 0; i < geos.length; i++) {
      vCount += geos[i].attributes.position.count;
      iCount += geos[i].index ? geos[i].index.count : geos[i].attributes.position.count;
    }
    var pos = new Float32Array(vCount * 3);
    var nrm = new Float32Array(vCount * 3);
    var uv = hasUV ? new Float32Array(vCount * 2) : null;
    var col = hasColor ? new Float32Array(vCount * 3) : null;
    var idx = (vCount > 65535 ? new Uint32Array(iCount) : new Uint16Array(iCount));
    var vo = 0, io = 0;
    for (i = 0; i < geos.length; i++) {
      var g = geos[i];
      var p = g.attributes.position.array;
      pos.set(p, vo * 3);
      if (g.attributes.normal) nrm.set(g.attributes.normal.array, vo * 3);
      if (uv && g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2);
      if (col) {
        if (g.attributes.color) col.set(g.attributes.color.array, vo * 3);
        else for (var c = 0; c < g.attributes.position.count; c++) {
          col[(vo + c) * 3] = col[(vo + c) * 3 + 1] = col[(vo + c) * 3 + 2] = 1;
        }
      }
      var n = g.attributes.position.count;
      if (g.index) {
        var gi = g.index.array;
        for (var k = 0; k < gi.length; k++) idx[io + k] = gi[k] + vo;
        io += gi.length;
      } else {
        for (var k2 = 0; k2 < n; k2++) idx[io + k2] = vo + k2;
        io += n;
      }
      vo += n;
    }
    var out = new T.BufferGeometry();
    out.setAttribute('position', new T.BufferAttribute(pos, 3));
    out.setAttribute('normal', new T.BufferAttribute(nrm, 3));
    if (uv) out.setAttribute('uv', new T.BufferAttribute(uv, 2));
    if (col) out.setAttribute('color', new T.BufferAttribute(col, 3));
    out.setIndex(new T.BufferAttribute(idx, 1));
    return out;
  };

  /* collect geometry per material, then emit one mesh per material */
  function Batch() { this.groups = {}; this.mats = {}; }

  Batch.prototype.add = function (key, geo, material, matrix) {
    if (!geo) return;
    if (matrix) { geo = geo.clone(); geo.applyMatrix4(matrix); }
    if (!this.groups[key]) { this.groups[key] = []; this.mats[key] = material; }
    else if (material && !this.mats[key]) this.mats[key] = material;
    this.groups[key].push(geo);
  };

  Batch.prototype.build = function (parent, opts) {
    opts = opts || {};
    var out = [];
    for (var key in this.groups) {
      if (!Object.prototype.hasOwnProperty.call(this.groups, key)) continue;
      var merged = G.merge(this.groups[key]);
      if (!merged) continue;
      var mesh = new T.Mesh(merged, this.mats[key]);
      mesh.castShadow = opts.castShadow !== false;
      mesh.receiveShadow = opts.receiveShadow !== false;
      mesh.name = key;
      parent.add(mesh);
      out.push(mesh);
      this.groups[key] = null;
    }
    this.groups = {};
    return out;
  };

  G.Batch = Batch;

  /* ---------------- primitives ---------------- */

  G.mat4 = function (x, y, z, ry, sx, sy, sz) {
    var m = new T.Matrix4();
    var q = new T.Quaternion().setFromEuler(new T.Euler(0, ry || 0, 0));
    m.compose(new T.Vector3(x, y, z), q, new T.Vector3(sx === undefined ? 1 : sx,
      sy === undefined ? 1 : sy, sz === undefined ? 1 : sz));
    return m;
  };

  /* an axis-aligned box whose origin is at the centre of its base */
  G.box = function (w, h, d, uvScale) {
    var g = new T.BoxGeometry(w, h, d);
    g.translate(0, h / 2, 0);
    if (uvScale) G.scaleUV(g, uvScale, w, h, d);
    return g;
  };

  /* rescale UVs so a tiling texture keeps a constant real-world size */
  G.scaleUV = function (g, perMetre, w, h, d) {
    var uv = g.attributes.uv, pos = g.attributes.position, nrm = g.attributes.normal;
    for (var i = 0; i < uv.count; i++) {
      var nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i)), nz = Math.abs(nrm.getZ(i));
      var su, sv;
      if (ny > nx && ny > nz) { su = w; sv = d; }
      else if (nx > nz) { su = d; sv = h; }
      else { su = w; sv = h; }
      uv.setXY(i, uv.getX(i) * su * perMetre, uv.getY(i) * sv * perMetre);
    }
    uv.needsUpdate = true;
    return g;
  };

  G.plane = function (w, d, uvPerMetre, segW, segD) {
    var g = new T.PlaneGeometry(w, d, segW || 1, segD || 1);
    g.rotateX(-Math.PI / 2);
    if (uvPerMetre) {
      var uv = g.attributes.uv;
      for (var i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w * uvPerMetre, uv.getY(i) * d * uvPerMetre);
    }
    return g;
  };

  G.cyl = function (rTop, rBot, h, seg, uvPerMetre) {
    var g = new T.CylinderGeometry(rTop, rBot, h, seg || 10, 1, false);
    g.translate(0, h / 2, 0);
    if (uvPerMetre) {
      var uv = g.attributes.uv;
      for (var i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * 2 * rBot * uvPerMetre, uv.getY(i) * h * uvPerMetre);
    }
    return g;
  };

  /* four corners -> two triangles, with a UV scale in metres */
  G.quad = function (a, b, c, d, uvPerMetre, flip) {
    var g = new T.BufferGeometry();
    var pos = new Float32Array([a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2]]);
    var ab = new T.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    var ad = new T.Vector3(d[0] - a[0], d[1] - a[1], d[2] - a[2]);
    var n = new T.Vector3().crossVectors(ab, ad).normalize();
    if (flip) n.negate();
    var nrm = new Float32Array(12);
    for (var i = 0; i < 4; i++) { nrm[i * 3] = n.x; nrm[i * 3 + 1] = n.y; nrm[i * 3 + 2] = n.z; }
    var wu = ab.length() * (uvPerMetre || 1), wv = ad.length() * (uvPerMetre || 1);
    var uv = new Float32Array([0, 0, wu, 0, wu, wv, 0, wv]);
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('normal', new T.BufferAttribute(nrm, 3));
    g.setAttribute('uv', new T.BufferAttribute(uv, 2));
    g.setIndex(flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]);
    return g;
  };

  /* Foliage cards are vertical, so their true normals face sideways and an
     overhead sun leaves them black. Pointing every normal straight up lights
     them like the ground they grow out of, which is how foliage should read. */
  G.upNormals = function (geo) {
    var n = geo.attributes.normal;
    for (var i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
    n.needsUpdate = true;
    return geo;
  };

  /* ---------------- ribbons that follow the ground ---------------- */

  /* pts: [[x,z],...] in town coordinates. heightFn(x,z) gives the surface. */
  G.ribbon = function (pts, opts) {
    var heightFn = opts.height;
    var width = opts.width;
    var lift = opts.lift || 0.02;
    var step = opts.step || 2.4;
    var uvPerMetre = opts.uvPerMetre || 0.25;
    var crown = opts.crown || 0;        /* centre higher than edges, like a real road */
    var half = width / 2;

    var total = ER.poly.length(pts);
    var n = Math.max(2, Math.ceil(total / step));
    var verts = [], norms = [], uvs = [], idx = [];
    var along = 0;

    for (var i = 0; i <= n; i++) {
      var s = (i / n) * total;
      var p = ER.poly.pointAt(pts, s);
      var nn = ER.poly.normal(pts, p.seg);
      var hC = heightFn(p.x, p.y) + lift;
      var lx = p.x + nn.x * half, lz = p.y + nn.y * half;
      var rx = p.x - nn.x * half, rz = p.y - nn.y * half;
      var hL = heightFn(lx, lz) + lift, hR = heightFn(rx, rz) + lift;
      /* the surface is flat across its width, sitting on the centreline */
      hL = hC - crown; hR = hC - crown;

      verts.push(lx, hL, lz, rx, hR, rz);
      norms.push(0, 1, 0, 0, 1, 0);
      uvs.push(0, along * uvPerMetre, width * uvPerMetre, along * uvPerMetre);
      if (i > 0) {
        var a = (i - 1) * 2, b = a + 1, c = i * 2, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
      if (i < n) along += total / n;
    }

    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(verts), 3));
    g.setAttribute('normal', new T.BufferAttribute(new Float32Array(norms), 3));
    g.setAttribute('uv', new T.BufferAttribute(new Float32Array(uvs), 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };

  /* a dashed centre line: short ribbons with gaps */
  G.dashes = function (pts, opts) {
    var geos = [];
    var total = ER.poly.length(pts);
    var dash = opts.dash || 3.0, gap = opts.gap || 6.0;
    var s = opts.offsetStart || 2;
    while (s + dash < total) {
      var seg = [];
      for (var q = 0; q <= 3; q++) {
        var p = ER.poly.pointAt(pts, s + (dash * q) / 3);
        seg.push([p.x, p.y]);
      }
      geos.push(G.ribbon(seg, { height: opts.height, width: opts.width, lift: opts.lift,
        step: dash / 2, uvPerMetre: 0.5 }));
      s += dash + gap;
    }
    return geos.length ? G.merge(geos) : null;
  };

  /* a continuous stripe offset from a road's centreline */
  G.edgeLine = function (pts, offset, opts) {
    var total = ER.poly.length(pts);
    var n = Math.max(2, Math.ceil(total / 3));
    var line = [];
    for (var i = 0; i <= n; i++) {
      var p = ER.poly.pointAt(pts, (i / n) * total);
      var nn = ER.poly.normal(pts, p.seg);
      line.push([p.x + nn.x * offset, p.y + nn.y * offset]);
    }
    return G.ribbon(line, opts);
  };

  /* ---------------- roofs ---------------- */

  /* a gable roof over a w x d footprint, ridge running along the longer side.
     Returns { roof, gables } so they can take different materials. */
  G.gable = function (w, d, rise, overhang, uvPerMetre) {
    var oh = overhang === undefined ? 0.45 : overhang;
    var ridgeAlongX = w >= d;
    var W = w + oh * 2, D = d + oh * 2;
    var roofGeos = [], gableGeos = [];
    var half = (ridgeAlongX ? D : W) / 2;
    var slope = rise;

    if (ridgeAlongX) {
      /* two planes meeting over a ridge parallel to x */
      roofGeos.push(G.quad(
        [-W / 2, 0, -D / 2], [W / 2, 0, -D / 2], [W / 2, slope, 0], [-W / 2, slope, 0], uvPerMetre));
      roofGeos.push(G.quad(
        [-W / 2, slope, 0], [W / 2, slope, 0], [W / 2, 0, D / 2], [-W / 2, 0, D / 2], uvPerMetre));
      /* the triangular ends, in the wall material */
      gableGeos.push(G.tri([-w / 2, 0, -d / 2], [-w / 2, 0, d / 2], [-w / 2, slope * (1 - oh / half), 0], uvPerMetre));
      gableGeos.push(G.tri([w / 2, 0, d / 2], [w / 2, 0, -d / 2], [w / 2, slope * (1 - oh / half), 0], uvPerMetre));
    } else {
      roofGeos.push(G.quad(
        [-W / 2, 0, -D / 2], [0, slope, -D / 2], [0, slope, D / 2], [-W / 2, 0, D / 2], uvPerMetre));
      roofGeos.push(G.quad(
        [0, slope, -D / 2], [W / 2, 0, -D / 2], [W / 2, 0, D / 2], [0, slope, D / 2], uvPerMetre));
      gableGeos.push(G.tri([-w / 2, 0, -d / 2], [w / 2, 0, -d / 2], [0, slope * (1 - oh / half), -d / 2], uvPerMetre));
      gableGeos.push(G.tri([w / 2, 0, d / 2], [-w / 2, 0, d / 2], [0, slope * (1 - oh / half), d / 2], uvPerMetre));
    }
    return { roof: G.merge(roofGeos), gables: G.merge(gableGeos), ridgeAlongX: ridgeAlongX };
  };

  G.tri = function (a, b, c, uvPerMetre) {
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(
      [a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]]), 3));
    var ab = new T.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    var ac = new T.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    var n = new T.Vector3().crossVectors(ab, ac).normalize();
    g.setAttribute('normal', new T.BufferAttribute(new Float32Array(
      [n.x, n.y, n.z, n.x, n.y, n.z, n.x, n.y, n.z]), 3));
    var s = uvPerMetre || 1;
    g.setAttribute('uv', new T.BufferAttribute(new Float32Array(
      [a[0] * s, a[1] * s, b[0] * s, b[1] * s, c[0] * s, c[1] * s]), 2));
    g.setIndex([0, 1, 2]);
    return g;
  };

  /* a hollow rectangular frame, for windows and doors */
  G.frame = function (w, h, thick, depth) {
    var geos = [];
    geos.push(G.box(w, thick, depth));                               /* sill */
    var top = G.box(w, thick, depth); top.translate(0, h - thick, 0);
    geos.push(top);
    var l = G.box(thick, h - thick * 2, depth); l.translate(-w / 2 + thick / 2, thick, 0);
    geos.push(l);
    var r = G.box(thick, h - thick * 2, depth); r.translate(w / 2 - thick / 2, thick, 0);
    geos.push(r);
    return G.merge(geos);
  };

  /* a catenary between two points, as a thin tube */
  G.wire = function (a, b, sag, radius, seg) {
    seg = seg || 8;
    var pts = [];
    for (var i = 0; i <= seg; i++) {
      var t = i / seg;
      var x = U.lerp(a.x, b.x, t), y = U.lerp(a.y, b.y, t), z = U.lerp(a.z, b.z, t);
      y -= Math.sin(t * Math.PI) * sag;
      pts.push(new T.Vector3(x, y, z));
    }
    var curve = new T.CatmullRomCurve3(pts);
    return new T.TubeGeometry(curve, seg, radius || 0.03, 4, false);
  };

  /* text baked to a canvas, for signs you can actually read */
  G.signTexture = function (lines, opts) {
    opts = opts || {};
    var w = opts.w || 512, h = opts.h || 256;
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var c = cv.getContext('2d');
    c.fillStyle = opts.bg || '#e8e4d6';
    c.fillRect(0, 0, w, h);
    if (opts.border) {
      c.strokeStyle = opts.border; c.lineWidth = opts.borderW || 10;
      c.strokeRect(c.lineWidth / 2 + 4, c.lineWidth / 2 + 4, w - c.lineWidth - 8, h - c.lineWidth - 8);
    }
    if (opts.grunge) {
      var rng = new ER.RNG('sign' + lines.join());
      for (var i = 0; i < 900; i++) {
        c.fillStyle = 'rgba(' + (rng.chance(0.5) ? '0,0,0,' : '255,255,255,') + rng.float(0.02, 0.1) + ')';
        c.fillRect(rng.float(0, w), rng.float(0, h), rng.float(1, 7), rng.float(1, 4));
      }
    }
    c.fillStyle = opts.fg || '#2a3340';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    var size = opts.size || Math.floor(h / (lines.length + 0.9));
    c.font = (opts.weight || '700') + ' ' + size + 'px ' + (opts.font || '"Helvetica Neue", Arial, sans-serif');
    for (var L = 0; L < lines.length; L++) {
      c.fillText(lines[L], w / 2, h / 2 + (L - (lines.length - 1) / 2) * size * 1.12);
    }
    var t = new T.CanvasTexture(cv);
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };

  ER.Geom = G;
})(window.ER = window.ER || {});
