/* Errands — every surface in the quarter, generated at load.
   There are no texture files. Each material gets an albedo, a normal map
   derived from its own height field, and a roughness map, so that light
   actually catches on things. */
(function (ER) {
  'use strict';
  var U = ER.U;
  var T = window.THREE;

  var SIZE = 256;
  var cache = {};

  /* ---------------- canvas helpers ---------------- */

  function canvas(size) {
    var c = document.createElement('canvas');
    c.width = c.height = size || SIZE;
    return c;
  }

  /* value noise straight onto a canvas, tiling by wrapping the lattice */
  function noiseFill(ctx, size, cells, seed, lo, hi, oct) {
    var rng = new ER.RNG(seed);
    var lat = [];
    var i, j;
    for (i = 0; i <= cells; i++) { lat[i] = []; for (j = 0; j <= cells; j++) lat[i][j] = rng.next(); }
    for (i = 0; i <= cells; i++) { lat[i][cells] = lat[i][0]; }
    for (j = 0; j <= cells; j++) { lat[cells][j] = lat[0][j]; }
    var img = ctx.getImageData(0, 0, size, size);
    var d = img.data;
    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        var v = 0, amp = 1, norm = 0, f = 1;
        for (var o = 0; o < (oct || 3); o++) {
          var fx = (x / size) * cells * f, fy = (y / size) * cells * f;
          var xi = Math.floor(fx) % cells, yi = Math.floor(fy) % cells;
          var tx = fx - Math.floor(fx), ty = fy - Math.floor(fy);
          tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
          var a = lat[xi][yi], b = lat[(xi + 1) % cells][yi];
          var c2 = lat[xi][(yi + 1) % cells], dd = lat[(xi + 1) % cells][(yi + 1) % cells];
          var top = a + (b - a) * tx, bot = c2 + (dd - c2) * tx;
          v += (top + (bot - top) * ty) * amp;
          norm += amp; amp *= 0.5; f *= 2;
        }
        v = v / norm;
        var g = (lo + (hi - lo) * v) * 255;
        var k = (y * size + x) * 4;
        d[k] = d[k + 1] = d[k + 2] = g; d[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  /* Sobel the luminance into a tangent-space normal map */
  function normalMap(src, strength) {
    var size = src.width;
    var sctx = src.getContext('2d');
    var s = sctx.getImageData(0, 0, size, size).data;
    var out = canvas(size);
    var octx = out.getContext('2d');
    var img = octx.createImageData(size, size);
    var d = img.data;
    function L(x, y) {
      x = (x + size) % size; y = (y + size) % size;
      return s[(y * size + x) * 4] / 255;
    }
    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        var dx = (L(x - 1, y - 1) + 2 * L(x - 1, y) + L(x - 1, y + 1))
               - (L(x + 1, y - 1) + 2 * L(x + 1, y) + L(x + 1, y + 1));
        var dy = (L(x - 1, y - 1) + 2 * L(x, y - 1) + L(x + 1, y - 1))
               - (L(x - 1, y + 1) + 2 * L(x, y + 1) + L(x + 1, y + 1));
        var nx = dx * (strength || 2), ny = dy * (strength || 2), nz = 1;
        var len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        var k = (y * size + x) * 4;
        d[k] = ((nx / len) * 0.5 + 0.5) * 255;
        d[k + 1] = ((ny / len) * 0.5 + 0.5) * 255;
        d[k + 2] = ((nz / len) * 0.5 + 0.5) * 255;
        d[k + 3] = 255;
      }
    }
    octx.putImageData(img, 0, 0);
    return out;
  }

  /* remap luminance into a roughness range */
  function roughMap(src, lo, hi) {
    var size = src.width;
    var s = src.getContext('2d').getImageData(0, 0, size, size);
    var d = s.data;
    for (var i = 0; i < d.length; i += 4) {
      var v = d[i] / 255;
      var r = (lo + (hi - lo) * v) * 255;
      d[i] = d[i + 1] = d[i + 2] = r;
    }
    var out = canvas(size);
    out.getContext('2d').putImageData(s, 0, 0);
    return out;
  }

  function tex(cv, repeat, colorSpace) {
    var t = new T.CanvasTexture(cv);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.repeat.set(repeat || 1, repeat || 1);
    t.anisotropy = 8;
    if (colorSpace) t.colorSpace = T.SRGBColorSpace;
    return t;
  }

  /* ---------------- the surfaces ---------------- */

  var BUILD = {

    grass: function () {
      var h = canvas(); var hc = h.getContext('2d');
      noiseFill(hc, SIZE, 16, 'grassH', 0.25, 1, 4);
      /* blades, scratched in so the normal map has something to bite on */
      var rng = new ER.RNG('blades');
      hc.lineWidth = 1;
      for (var i = 0; i < 2600; i++) {
        var x = rng.float(0, SIZE), y = rng.float(0, SIZE);
        var l = rng.float(2, 6), a = rng.float(-0.5, 0.5) - Math.PI / 2;
        hc.strokeStyle = 'rgba(255,255,255,' + rng.float(0.05, 0.3) + ')';
        hc.beginPath(); hc.moveTo(x, y); hc.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); hc.stroke();
      }
      var a = canvas(); var ac = a.getContext('2d');
      ac.drawImage(h, 0, 0);
      var img = ac.getImageData(0, 0, SIZE, SIZE), d = img.data;
      var n2 = new ER.Noise(ER.hashStr('grassTint'));
      for (var k = 0; k < d.length; k += 4) {
        var px = (k / 4) % SIZE, py = Math.floor((k / 4) / SIZE);
        var v = d[k] / 255;
        var dry = n2.fbm(px / 40, py / 40, 3);
        var r = U.lerp(56, 120, v * 0.7) + dry * 46;
        var g = U.lerp(74, 132, v) + dry * 28;
        var b = U.lerp(38, 72, v * 0.6) + dry * 14;
        d[k] = r; d[k + 1] = g; d[k + 2] = b;
      }
      ac.putImageData(img, 0, 0);
      return { albedo: a, height: h, rough: [0.72, 0.95], normalStrength: 1.5 };
    },

    field: function () {
      var h = canvas(); var hc = h.getContext('2d');
      noiseFill(hc, SIZE, 10, 'fieldH', 0.3, 1, 3);
      /* the rows a combine left */
      hc.strokeStyle = 'rgba(0,0,0,0.5)'; hc.lineWidth = 3;
      for (var r = 0; r < SIZE; r += 21) {
        hc.beginPath(); hc.moveTo(0, r); hc.lineTo(SIZE, r); hc.stroke();
      }
      hc.strokeStyle = 'rgba(255,255,255,0.28)'; hc.lineWidth = 6;
      for (var r2 = 10; r2 < SIZE; r2 += 21) {
        hc.beginPath(); hc.moveTo(0, r2); hc.lineTo(SIZE, r2); hc.stroke();
      }
      var a = canvas(); var ac = a.getContext('2d');
      ac.drawImage(h, 0, 0);
      var img = ac.getImageData(0, 0, SIZE, SIZE), d = img.data;
      for (var k = 0; k < d.length; k += 4) {
        var v = d[k] / 255;
        d[k] = U.lerp(96, 176, v); d[k + 1] = U.lerp(86, 156, v); d[k + 2] = U.lerp(52, 96, v);
      }
      ac.putImageData(img, 0, 0);
      return { albedo: a, height: h, rough: [0.78, 0.96], normalStrength: 1.8 };
    },

    asphalt: function () {
      var h = canvas(); var hc = h.getContext('2d');
      noiseFill(hc, SIZE, 48, 'asphH', 0.4, 0.8, 3);
      var rng = new ER.RNG('aggregate');
      for (var i = 0; i < 5200; i++) {
        var x = rng.float(0, SIZE), y = rng.float(0, SIZE), r = rng.float(0.5, 2.1);
        hc.fillStyle = 'rgba(' + (rng.chance(0.5) ? '255,255,255,' : '0,0,0,') + rng.float(0.1, 0.5) + ')';
        hc.beginPath(); hc.arc(x, y, r, 0, 6.2832); hc.fill();
      }
      /* cracks, and the tar somebody ran along them */
      hc.strokeStyle = 'rgba(0,0,0,0.75)';
      for (var c = 0; c < 7; c++) {
        var cx = rng.float(0, SIZE), cy = rng.float(0, SIZE), ang = rng.float(0, 6.28);
        hc.lineWidth = rng.float(0.7, 2);
        hc.beginPath(); hc.moveTo(cx, cy);
        for (var seg = 0; seg < 9; seg++) {
          ang += rng.float(-0.7, 0.7);
          cx += Math.cos(ang) * rng.float(6, 20); cy += Math.sin(ang) * rng.float(6, 20);
          hc.lineTo(cx, cy);
        }
        hc.stroke();
      }
      var a = canvas(); var ac = a.getContext('2d');
      ac.drawImage(h, 0, 0);
      var img = ac.getImageData(0, 0, SIZE, SIZE), d = img.data;
      for (var k = 0; k < d.length; k += 4) {
        var v = d[k] / 255;
        var g = U.lerp(34, 96, v);
        d[k] = g * 1.02; d[k + 1] = g; d[k + 2] = g * 1.04;
      }
      ac.putImageData(img, 0, 0);
      return { albedo: a, height: h, rough: [0.55, 0.88], normalStrength: 1.1 };
    },

    gravel: function () {
      var h = canvas(); var hc = h.getContext('2d');
      hc.fillStyle = '#404040'; hc.fillRect(0, 0, SIZE, SIZE);
      var rng = new ER.RNG('gravel');
      for (var i = 0; i < 3000; i++) {
        var x = rng.float(0, SIZE), y = rng.float(0, SIZE), r = rng.float(1.6, 4.6);
        var g = rng.float(0.35, 1);
        var grd = hc.createRadialGradient(x - r * 0.3, y - r * 0.3, 0.2, x, y, r);
        grd.addColorStop(0, 'rgba(255,255,255,' + g + ')');
        grd.addColorStop(1, 'rgba(0,0,0,0.35)');
        hc.fillStyle = grd;
        hc.beginPath(); hc.ellipse(x, y, r, r * rng.float(0.7, 1), rng.float(0, 3), 0, 6.2832); hc.fill();
      }
      var a = canvas(); var ac = a.getContext('2d');
      ac.drawImage(h, 0, 0);
      var img = ac.getImageData(0, 0, SIZE, SIZE), d = img.data;
      var tn = new ER.Noise(ER.hashStr('gravelTint'));
      for (var k = 0; k < d.length; k += 4) {
        var px = (k / 4) % SIZE, py = Math.floor((k / 4) / SIZE);
        var v = d[k] / 255, warm = tn.at(px / 9, py / 9);
        d[k] = U.lerp(72, 186, v) + warm * 16;
        d[k + 1] = U.lerp(68, 176, v) + warm * 10;
        d[k + 2] = U.lerp(60, 158, v);
      }
      ac.putImageData(img, 0, 0);
      return { albedo: a, height: h, rough: [0.7, 0.95], normalStrength: 2.6 };
    },

    concrete: function () {
      var h = canvas(); var hc = h.getContext('2d');
      noiseFill(hc, SIZE, 24, 'concH', 0.55, 0.85, 4);
      var rng = new ER.RNG('conc');
      for (var i = 0; i < 900; i++) {
        hc.fillStyle = 'rgba(0,0,0,' + rng.float(0.04, 0.16) + ')';
        hc.beginPath(); hc.arc(rng.float(0, SIZE), rng.float(0, SIZE), rng.float(0.6, 2.4), 0, 6.2832); hc.fill();
      }
      /* the broom finish */
      hc.strokeStyle = 'rgba(0,0,0,0.10)'; hc.lineWidth = 1;
      for (var y = 0; y < SIZE; y += 2) { hc.beginPath(); hc.moveTo(0, y); hc.lineTo(SIZE, y + rng.float(-1, 1)); hc.stroke(); }
      var a = canvas(); var ac = a.getContext('2d');
      ac.drawImage(h, 0, 0);
      var img = ac.getImageData(0, 0, SIZE, SIZE), d = img.data;
      for (var k = 0; k < d.length; k += 4) {
        var v = d[k] / 255, g = U.lerp(118, 186, v);
        d[k] = g; d[k + 1] = g * 0.99; d[k + 2] = g * 0.94;
      }
      ac.putImageData(img, 0, 0);
      return { albedo: a, height: h, rough: [0.6, 0.86], normalStrength: 0.8 };
    },

    dirt: function () {
      var h = canvas(); var hc = h.getContext('2d');
      noiseFill(hc, SIZE, 20, 'dirtH', 0.3, 0.9, 4);
      var rng = new ER.RNG('dirt');
      for (var i = 0; i < 1400; i++) {
        hc.fillStyle = 'rgba(255,255,255,' + rng.float(0.05, 0.3) + ')';
        hc.beginPath(); hc.arc(rng.float(0, SIZE), rng.float(0, SIZE), rng.float(0.7, 2.6), 0, 6.2832); hc.fill();
      }
      var a = canvas(); var ac = a.getContext('2d');
      ac.drawImage(h, 0, 0);
      var img = ac.getImageData(0, 0, SIZE, SIZE), d = img.data;
      for (var k = 0; k < d.length; k += 4) {
        var v = d[k] / 255;
        d[k] = U.lerp(72, 146, v); d[k + 1] = U.lerp(56, 116, v); d[k + 2] = U.lerp(40, 84, v);
      }
      ac.putImageData(img, 0, 0);
      return { albedo: a, height: h, rough: [0.8, 0.97], normalStrength: 2.0 };
    },

    /* vinyl lap siding, white, tinted per house by material colour */
    siding: function () {
      var h = canvas(); var hc = h.getContext('2d');
      hc.fillStyle = '#b4b4b4'; hc.fillRect(0, 0, SIZE, SIZE);
      var lap = SIZE / 8;
      for (var i = 0; i < 8; i++) {
        var y = i * lap;
        var grd = hc.createLinearGradient(0, y, 0, y + lap);
        grd.addColorStop(0, '#5a5a5a');
        grd.addColorStop(0.12, '#e8e8e8');
        grd.addColorStop(0.75, '#c2c2c2');
        grd.addColorStop(1, '#8e8e8e');
        hc.fillStyle = grd;
        hc.fillRect(0, y, SIZE, lap);
      }
      var rng = new ER.RNG('siding');
      for (var k = 0; k < 400; k++) {
        hc.fillStyle = 'rgba(0,0,0,' + rng.float(0.02, 0.07) + ')';
        hc.fillRect(rng.float(0, SIZE), rng.float(0, SIZE), rng.float(2, 14), rng.float(0.5, 1.5));
      }
      var a = canvas();
      a.getContext('2d').drawImage(h, 0, 0);
      return { albedo: a, height: h, rough: [0.45, 0.72], normalStrength: 1.2, white: true };
    },

    /* Lime render over sandstone block, which is what almost every wall in
       the quarter is. Greyscale, so each house tints it with its own wash. */
    limewash: function () {
      var h = canvas(); var hc = h.getContext('2d');
      noiseFill(hc, SIZE, 6, 'washH', 0.62, 0.92, 4);
      var rng = new ER.RNG('limewash');
      /* the block courses showing faintly through the render */
      var course = SIZE / 5;
      hc.globalAlpha = 0.20;
      for (var r = 0; r < 5; r++) {
        hc.fillStyle = '#5a5a5a';
        hc.fillRect(0, r * course, SIZE, 1.4);
        var off = (r % 2) * course * 0.5;
        for (var b = 0; b < 3; b++) {
          hc.fillRect(off + b * (SIZE / 3), r * course, 1.2, course);
        }
      }
      hc.globalAlpha = 1;
      /* and the patches where it has come off back to the stone */
      for (var k = 0; k < 26; k++) {
        var px = rng.float(0, SIZE), py = rng.float(0, SIZE), pr = rng.float(4, 22);
        var g2 = hc.createRadialGradient(px, py, 0, px, py, pr);
        g2.addColorStop(0, 'rgba(90,90,90,' + rng.float(0.22, 0.5) + ')');
        g2.addColorStop(1, 'rgba(90,90,90,0)');
        hc.fillStyle = g2;
        hc.beginPath(); hc.ellipse(px, py, pr, pr * rng.float(0.5, 1), rng.float(0, 3), 0, 6.2832); hc.fill();
      }
      /* rain staining, always downward */
      for (var d2 = 0; d2 < 34; d2++) {
        hc.fillStyle = 'rgba(70,70,70,' + rng.float(0.03, 0.10) + ')';
        hc.fillRect(rng.float(0, SIZE), rng.float(0, SIZE * 0.6), rng.float(1, 4), rng.float(20, 90));
      }
      var a = canvas();
      a.getContext('2d').drawImage(h, 0, 0);
      return { albedo: a, height: h, rough: [0.62, 0.88], normalStrength: 1.0, white: true };
    },

    /* bare ramleh block, for plinths, the sea wall and anything unrendered */
    sandstone: function () {
      var h = canvas(); var hc = h.getContext('2d');
      noiseFill(hc, SIZE, 20, 'sandH', 0.48, 0.86, 4);
      var rng = new ER.RNG('sandstone');
      /* coursed, with the joints raked out */
      var course = SIZE / 4;
      for (var r = 0; r < 4; r++) {
        hc.fillStyle = 'rgba(40,36,30,0.55)';
        hc.fillRect(0, r * course, SIZE, 2.6);
        var off = (r % 2) * course * 0.6;
        for (var b = 0; b < 3; b++) {
          hc.fillRect((off + b * (SIZE / 3)) % SIZE, r * course, 2.2, course);
        }
      }
      /* the bedding lines the stone was cut along */
      for (var k = 0; k < 90; k++) {
        hc.fillStyle = 'rgba(255,255,255,' + rng.float(0.03, 0.10) + ')';
        hc.fillRect(rng.float(0, SIZE), rng.float(0, SIZE), rng.float(8, 40), rng.float(0.6, 1.6));
      }
      var a = canvas(); var ac = a.getContext('2d');
      ac.drawImage(h, 0, 0);
      var img = ac.getImageData(0, 0, SIZE, SIZE), d = img.data;
      for (var q = 0; q < d.length; q += 4) {
        var v = d[q] / 255;
        d[q] = U.lerp(132, 214, v);
        d[q + 1] = U.lerp(118, 196, v);
        d[q + 2] = U.lerp(96, 163, v);
      }
      ac.putImageData(img, 0, 0);
      return { albedo: a, height: h, rough: [0.66, 0.9], normalStrength: 1.5 };
    },

    /* terracotta roof tile, half-round, in rows down the pitch */
    tile: function () {
      var h = canvas(); var hc = h.getContext('2d');
      hc.fillStyle = '#6a6a6a'; hc.fillRect(0, 0, SIZE, SIZE);
      var rng = new ER.RNG('rooftile');
      var cols = 7, colW = SIZE / cols;
      for (var c2 = 0; c2 < cols; c2++) {
        var x0 = c2 * colW;
        var grd = hc.createLinearGradient(x0, 0, x0 + colW, 0);
        grd.addColorStop(0, '#4c4c4c');
        grd.addColorStop(0.32, '#e2e2e2');
        grd.addColorStop(0.62, '#b4b4b4');
        grd.addColorStop(1, '#565656');
        hc.fillStyle = grd;
        hc.fillRect(x0, 0, colW, SIZE);
      }
      /* the laps down each run */
      var rows = 6, rowH = SIZE / rows;
      for (var r2 = 0; r2 < rows; r2++) {
        hc.fillStyle = 'rgba(30,30,30,0.45)';
        hc.fillRect(0, r2 * rowH, SIZE, 2.2);
        hc.fillStyle = 'rgba(255,255,255,0.10)';
        hc.fillRect(0, r2 * rowH + 2.2, SIZE, 2.0);
      }
      /* lichen, which every roof in the quarter has */
      for (var k2 = 0; k2 < 40; k2++) {
        hc.fillStyle = 'rgba(200,205,180,' + rng.float(0.05, 0.16) + ')';
        var lx = rng.float(0, SIZE), ly = rng.float(0, SIZE), lr = rng.float(2, 9);
        hc.beginPath(); hc.ellipse(lx, ly, lr, lr * 0.7, 0, 0, 6.2832); hc.fill();
      }
      var a2 = canvas(); var ac2 = a2.getContext('2d');
      ac2.drawImage(h, 0, 0);
      var img2 = ac2.getImageData(0, 0, SIZE, SIZE), d3 = img2.data;
      for (var q2 = 0; q2 < d3.length; q2 += 4) {
        var v2 = d3[q2] / 255;
        d3[q2] = U.lerp(96, 206, v2);
        d3[q2 + 1] = U.lerp(52, 118, v2);
        d3[q2 + 2] = U.lerp(38, 84, v2);
      }
      ac2.putImageData(img2, 0, 0);
      return { albedo: a2, height: h, rough: [0.58, 0.86], normalStrength: 1.7 };
    },

    shingle: function () {
      var h = canvas(); var hc = h.getContext('2d');
      hc.fillStyle = '#8a8a8a'; hc.fillRect(0, 0, SIZE, SIZE);
      var rng = new ER.RNG('shingle');
      var rowH = SIZE / 8, tabW = SIZE / 6;
      for (var r = 0; r < 8; r++) {
        var off = (r % 2) * tabW / 2;
        for (var t = -1; t < 7; t++) {
          var x = t * tabW + off, y = r * rowH;
          var g = rng.float(0.55, 1.0);
          hc.fillStyle = 'rgba(' + (g * 255 | 0) + ',' + (g * 255 | 0) + ',' + (g * 255 | 0) + ',1)';
          hc.fillRect(x + 0.5, y + 0.5, tabW - 1, rowH - 1);
          hc.fillStyle = 'rgba(0,0,0,0.55)';
          hc.fillRect(x, y + rowH - 2, tabW, 2);
          hc.fillRect(x, y, 1.4, rowH);
        }
      }
      /* granules */
      for (var i = 0; i < 6000; i++) {
        hc.fillStyle = 'rgba(' + (rng.chance(0.5) ? '255,255,255,' : '0,0,0,') + rng.float(0.05, 0.3) + ')';
        hc.fillRect(rng.float(0, SIZE), rng.float(0, SIZE), 1, 1);
      }
      var a = canvas();
      a.getContext('2d').drawImage(h, 0, 0);
      return { albedo: a, height: h, rough: [0.72, 0.95], normalStrength: 1.9, white: true };
    },

    brick: function () {
      var h = canvas(); var hc = h.getContext('2d');
      hc.fillStyle = '#d8d8d8'; hc.fillRect(0, 0, SIZE, SIZE);     /* mortar */
      var rng = new ER.RNG('brick');
      var bh = SIZE / 10, bw = SIZE / 4;
      for (var r = 0; r < 10; r++) {
        var off = (r % 2) * bw / 2;
        for (var c = -1; c < 5; c++) {
          var x = c * bw + off + 1.6, y = r * bh + 1.6;
          var g = rng.float(0.28, 0.62);
          hc.fillStyle = 'rgba(' + (g * 255 | 0) + ',' + (g * 255 | 0) + ',' + (g * 255 | 0) + ',1)';
          hc.fillRect(x, y, bw - 3.2, bh - 3.2);
        }
      }
      var a = canvas(); var ac = a.getContext('2d');
      ac.drawImage(h, 0, 0);
      var img = ac.getImageData(0, 0, SIZE, SIZE), d = img.data;
      for (var k = 0; k < d.length; k += 4) {
        var v = d[k] / 255;
        if (v > 0.72) { d[k] = 196; d[k + 1] = 190; d[k + 2] = 178; }   /* mortar */
        else { d[k] = U.lerp(96, 176, v * 1.5); d[k + 1] = U.lerp(52, 96, v * 1.5); d[k + 2] = U.lerp(42, 74, v * 1.5); }
      }
      ac.putImageData(img, 0, 0);
      return { albedo: a, height: h, rough: [0.62, 0.9], normalStrength: 2.2 };
    },

    wood: function () {
      var h = canvas(); var hc = h.getContext('2d');
      noiseFill(hc, SIZE, 4, 'woodH', 0.4, 0.9, 3);
      var rng = new ER.RNG('wood');
      /* grain */
      for (var i = 0; i < 180; i++) {
        var y = rng.float(0, SIZE);
        hc.strokeStyle = 'rgba(' + (rng.chance(0.5) ? '0,0,0,' : '255,255,255,') + rng.float(0.05, 0.28) + ')';
        hc.lineWidth = rng.float(0.5, 2.2);
        hc.beginPath();
        hc.moveTo(0, y);
        for (var x = 0; x <= SIZE; x += 16) hc.lineTo(x, y + Math.sin(x / 30 + i) * rng.float(0.4, 2.4));
        hc.stroke();
      }
      /* board joints */
      hc.strokeStyle = 'rgba(0,0,0,0.6)'; hc.lineWidth = 2;
      for (var b = 0; b < SIZE; b += SIZE / 4) { hc.beginPath(); hc.moveTo(0, b); hc.lineTo(SIZE, b); hc.stroke(); }
      var a = canvas(); var ac = a.getContext('2d');
      ac.drawImage(h, 0, 0);
      var img = ac.getImageData(0, 0, SIZE, SIZE), d = img.data;
      for (var k = 0; k < d.length; k += 4) {
        var v = d[k] / 255;
        d[k] = U.lerp(72, 158, v); d[k + 1] = U.lerp(52, 116, v); d[k + 2] = U.lerp(34, 78, v);
      }
      ac.putImageData(img, 0, 0);
      return { albedo: a, height: h, rough: [0.62, 0.92], normalStrength: 1.6 };
    },

    bark: function () {
      var h = canvas(); var hc = h.getContext('2d');
      noiseFill(hc, SIZE, 6, 'barkH', 0.2, 0.9, 3);
      var rng = new ER.RNG('bark');
      hc.lineWidth = 3;
      for (var i = 0; i < 130; i++) {
        var x = rng.float(0, SIZE);
        hc.strokeStyle = 'rgba(0,0,0,' + rng.float(0.15, 0.5) + ')';
        hc.beginPath(); hc.moveTo(x, 0);
        for (var y = 0; y <= SIZE; y += 12) hc.lineTo(x + Math.sin(y / 22 + i) * rng.float(1, 5), y);
        hc.stroke();
      }
      var a = canvas(); var ac = a.getContext('2d');
      ac.drawImage(h, 0, 0);
      var img = ac.getImageData(0, 0, SIZE, SIZE), d = img.data;
      for (var k = 0; k < d.length; k += 4) {
        var v = d[k] / 255;
        d[k] = U.lerp(46, 116, v); d[k + 1] = U.lerp(38, 96, v); d[k + 2] = U.lerp(32, 76, v);
      }
      ac.putImageData(img, 0, 0);
      return { albedo: a, height: h, rough: [0.78, 0.96], normalStrength: 3.0 };
    },

    stone: function () {
      var h = canvas(); var hc = h.getContext('2d');
      hc.fillStyle = '#cccccc'; hc.fillRect(0, 0, SIZE, SIZE);
      var rng = new ER.RNG('stone');
      /* coursed rubble */
      var y = 0;
      while (y < SIZE) {
        var rowH = rng.float(24, 40), x = -rng.float(0, 30);
        while (x < SIZE) {
          var w = rng.float(26, 62);
          var g = rng.float(0.42, 0.86);
          hc.fillStyle = 'rgba(' + (g * 255 | 0) + ',' + (g * 255 | 0) + ',' + (g * 255 | 0) + ',1)';
          hc.beginPath();
          hc.moveTo(x + 2, y + 2);
          hc.lineTo(x + w - 2 + rng.float(-3, 3), y + 3);
          hc.lineTo(x + w - 3, y + rowH - 3 + rng.float(-3, 3));
          hc.lineTo(x + 3, y + rowH - 2);
          hc.closePath(); hc.fill();
          x += w;
        }
        y += rowH;
      }
      for (var i = 0; i < 2400; i++) {
        hc.fillStyle = 'rgba(' + (rng.chance(0.5) ? '255,255,255,' : '0,0,0,') + rng.float(0.04, 0.2) + ')';
        hc.fillRect(rng.float(0, SIZE), rng.float(0, SIZE), 1.4, 1.4);
      }
      var a = canvas(); var ac = a.getContext('2d');
      ac.drawImage(h, 0, 0);
      var img = ac.getImageData(0, 0, SIZE, SIZE), d = img.data;
      var mn = new ER.Noise(ER.hashStr('moss'));
      for (var k = 0; k < d.length; k += 4) {
        var px = (k / 4) % SIZE, py = Math.floor((k / 4) / SIZE);
        var v = d[k] / 255;
        var g2 = U.lerp(150, 232, v);   /* it is always tinted; keep it pale */
        /* Damp in the joints, not mildew over everything. This runs on the
           paving of the whole quarter now, and at full strength it read as
           green blotches across every alley and the square. */
        var moss = U.clamp((mn.fbm(px / 26, py / 26, 3) - 0.66) * 3.4, 0, 1) * 0.5;
        d[k] = U.lerp(g2 * 1.02, 126, moss);
        d[k + 1] = U.lerp(g2, 136, moss);
        d[k + 2] = U.lerp(g2 * 0.92, 104, moss);
      }
      ac.putImageData(img, 0, 0);
      return { albedo: a, height: h, rough: [0.66, 0.94], normalStrength: 2.4 };
    },

    rust: function () {
      var h = canvas(); var hc = h.getContext('2d');
      noiseFill(hc, SIZE, 14, 'rustH', 0.3, 0.9, 4);
      var a = canvas(); var ac = a.getContext('2d');
      ac.drawImage(h, 0, 0);
      var img = ac.getImageData(0, 0, SIZE, SIZE), d = img.data;
      for (var k = 0; k < d.length; k += 4) {
        var v = d[k] / 255;
        d[k] = U.lerp(84, 168, v); d[k + 1] = U.lerp(44, 92, v); d[k + 2] = U.lerp(30, 54, v);
      }
      ac.putImageData(img, 0, 0);
      return { albedo: a, height: h, rough: [0.7, 0.95], normalStrength: 2.0 };
    },

    /* the water surface: only a normal map matters */
    water: function () {
      var h = canvas(); var hc = h.getContext('2d');
      noiseFill(hc, SIZE, 10, 'waterH', 0.35, 0.65, 3);
      /* Near-white, because the sea's colour comes from the material tint.
         Painted at #2e4a50 it multiplied with the tint down to half a per
         cent reflectance and the Mediterranean rendered black. */
      var a = canvas(); var ac = a.getContext('2d');
      ac.fillStyle = '#eef4f5'; ac.fillRect(0, 0, SIZE, SIZE);
      ac.globalAlpha = 0.16; ac.drawImage(h, 0, 0); ac.globalAlpha = 1;
      return { albedo: a, height: h, rough: [0.05, 0.2], normalStrength: 0.7, white: true };
    }
  };

  /* Metalness only pays off against an environment to reflect, and this
     renderer has none: the sky is a shader on a dome, not a cubemap. A metal
     surface here loses its diffuse and gets nothing back, so the iron of the
     lamps and the overhead wires came out at rgb(0,0,0) — ink, not metal. Cap
     it low enough that everything keeps a diffuse term, and let the roughness
     and the normal maps do the work of looking like metal. */
  var METAL_CAP = 0.2;

  /* ---------------- public ---------------- */

  function maps(name) {
    if (cache[name]) return cache[name];
    var built = BUILD[name]();
    var out = {
      albedo: built.albedo,
      normal: normalMap(built.height, built.normalStrength),
      rough: roughMap(built.height, built.rough[0], built.rough[1]),
      white: !!built.white
    };
    cache[name] = out;
    return out;
  }

  /* a standard material with all three maps wired up */
  function mat(name, opts) {
    opts = opts || {};
    var m = maps(name);
    var rep = opts.repeat || 1;
    var material = new T.MeshStandardMaterial({
      map: tex(m.albedo, rep, true),
      normalMap: tex(m.normal, rep),
      roughnessMap: tex(m.rough, rep),
      color: opts.color !== undefined ? new T.Color(opts.color) : 0xffffff,
      metalness: opts.metalness !== undefined ? Math.min(opts.metalness, METAL_CAP) : 0.0,
      roughness: opts.roughness !== undefined ? opts.roughness : 1.0,
      side: opts.side || T.FrontSide
    });
    if (opts.repeatX || opts.repeatY) {
      var rx = opts.repeatX || rep, ry = opts.repeatY || rep;
      material.map.repeat.set(rx, ry);
      material.normalMap.repeat.set(rx, ry);
      material.roughnessMap.repeat.set(rx, ry);
    }
    if (opts.normalScale !== undefined) material.normalScale = new T.Vector2(opts.normalScale, opts.normalScale);
    if (opts.transparent) { material.transparent = true; material.opacity = opts.opacity; }
    material.userData.texName = name;
    return material;
  }

  /* plain painted or moulded things that do not need a texture */
  function flat(color, rough, metal, opts) {
    opts = opts || {};
    return new T.MeshStandardMaterial({
      color: new T.Color(color),
      roughness: rough === undefined ? 0.7 : rough,
      metalness: metal === undefined ? 0 : Math.min(metal, METAL_CAP),
      side: opts.side || T.FrontSide,
      transparent: !!opts.transparent,
      opacity: opts.opacity === undefined ? 1 : opts.opacity,
      emissive: new T.Color(opts.emissive || 0x000000),
      emissiveIntensity: opts.emissiveIntensity === undefined ? 1 : opts.emissiveIntensity,
      flatShading: !!opts.flatShading
    });
  }

  ER.Mats = { mat: mat, flat: flat, maps: maps, tex: tex, canvas: canvas,
    normalMap: normalMap, roughMap: roughMap, noiseFill: noiseFill, SIZE: SIZE };
})(window.ER = window.ER || {});
