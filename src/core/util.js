/* Errands — small shared helpers. */
(function (ER) {
  'use strict';
  var U = {};

  U.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };
  U.smooth = function (t) { return t * t * (3 - 2 * t); };
  U.dist = function (ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); };
  U.dist2 = function (ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };

  /* distance from point to segment, and the closest point on it */
  U.segDist = function (px, py, ax, ay, bx, by) {
    var vx = bx - ax, vy = by - ay;
    var wx = px - ax, wy = py - ay;
    var len2 = vx * vx + vy * vy;
    var t = len2 > 0 ? U.clamp((wx * vx + wy * vy) / len2, 0, 1) : 0;
    var cx = ax + vx * t, cy = ay + vy * t;
    return { d: U.dist(px, py, cx, cy), t: t, x: cx, y: cy };
  };

  U.pointInRect = function (px, py, r) {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  };

  U.rectsOverlap = function (a, b, pad) {
    pad = pad || 0;
    return !(a.x + a.w + pad < b.x || b.x + b.w + pad < a.x ||
             a.y + a.h + pad < b.y || b.y + b.h + pad < a.y);
  };

  U.rectCenter = function (r) { return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; };

  /* ---- colour ---- */
  U.rgb = function (r, g, b) {
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  };
  U.rgba = function (r, g, b, a) {
    return 'rgba(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ',' + a + ')';
  };
  U.shade = function (hex, amt) {
    var c = U.parseHex(hex);
    return U.rgb(U.clamp(c[0] + amt, 0, 255), U.clamp(c[1] + amt, 0, 255), U.clamp(c[2] + amt, 0, 255));
  };
  U.parseHex = function (hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  };
  U.mixHex = function (a, b, t) {
    var x = U.parseHex(a), y = U.parseHex(b);
    return U.rgb(U.lerp(x[0], y[0], t), U.lerp(x[1], y[1], t), U.lerp(x[2], y[2], t));
  };

  /* ---- text ---- */
  U.ordinal = function (n) {
    var s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  U.commas = function (n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  var WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
    'eighteen', 'nineteen', 'twenty'];
  var TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  U.spell = function (n) {
    n = n | 0;
    if (n <= 20) return WORDS[n];
    if (n < 100) {
      var t = TENS[Math.floor(n / 10)], o = n % 10;
      return o ? t + '-' + WORDS[o] : t;
    }
    return String(n);
  };

  U.cap = function (s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; };

  /* "it must be the shallow bend" style clause joining */
  U.list = function (arr, conj) {
    conj = conj || 'and';
    if (arr.length <= 1) return arr[0] || '';
    if (arr.length === 2) return arr[0] + ' ' + conj + ' ' + arr[1];
    return arr.slice(0, -1).join(', ') + ', ' + conj + ' ' + arr[arr.length - 1];
  };

  U.clock = function (h, m) {
    var ap = h < 12 ? 'AM' : 'PM';
    var hh = h % 12; if (hh === 0) hh = 12;
    return hh + ':' + (m < 10 ? '0' : '') + (m | 0) + ' ' + ap;
  };

  /* How far your arm goes. It belongs here rather than in the renderer
     because both sides need it: the drawing puts a faint ring at this radius
     so you can see when you are close enough, and the rules use it to decide
     what you are able to touch. */
  ER.REACH = 1.9;

  ER.U = U;
})(typeof window !== 'undefined' ? (window.ER = window.ER || {}) : (global.ER = global.ER || {}));
