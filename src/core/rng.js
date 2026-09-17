/* Errands — deterministic randomness.
   Everything in the quarter is generated from one seed, so the place is the
   same town every time you load it, and the errands are not. */
(function (ER) {
  'use strict';

  function hashStr(s) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(a) {
    return function () {
      a = a + 0x6d2b79f5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function RNG(seed) {
    if (typeof seed === 'string') seed = hashStr(seed);
    this.seed = seed >>> 0;
    this._n = mulberry32(this.seed);
  }

  RNG.prototype.next = function () { return this._n(); };

  RNG.prototype.float = function (a, b) {
    if (b === undefined) { b = a; a = 0; }
    return a + this._n() * (b - a);
  };

  /* inclusive on both ends */
  RNG.prototype.int = function (a, b) {
    if (b === undefined) { b = a; a = 0; }
    return a + Math.floor(this._n() * (b - a + 1));
  };

  RNG.prototype.chance = function (p) { return this._n() < p; };

  RNG.prototype.sign = function () { return this._n() < 0.5 ? -1 : 1; };

  RNG.prototype.pick = function (arr) {
    if (!arr || !arr.length) return undefined;
    return arr[Math.floor(this._n() * arr.length)];
  };

  /* pick n distinct entries, order randomised */
  RNG.prototype.picks = function (arr, n) {
    var pool = this.shuffle(arr.slice());
    return pool.slice(0, Math.max(0, Math.min(n, pool.length)));
  };

  RNG.prototype.pickWeighted = function (arr, weightOf) {
    var total = 0, i;
    for (i = 0; i < arr.length; i++) total += Math.max(0, weightOf(arr[i], i));
    if (total <= 0) return this.pick(arr);
    var r = this._n() * total;
    for (i = 0; i < arr.length; i++) {
      r -= Math.max(0, weightOf(arr[i], i));
      if (r <= 0) return arr[i];
    }
    return arr[arr.length - 1];
  };

  RNG.prototype.shuffle = function (arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(this._n() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };

  /* roughly normal, clamped to +/-3 sigma */
  RNG.prototype.gauss = function (mean, sd) {
    var s = this._n() + this._n() + this._n() + this._n() + this._n() + this._n() - 3;
    return mean + s * (sd / 1.0);
  };

  /* a child generator, stable for a given tag */
  RNG.prototype.sub = function (tag) {
    return new RNG((this.seed ^ hashStr(String(tag))) >>> 0);
  };

  /* ---- value noise, smooth, seeded. used for terrain mottling ---- */
  function Noise(seed) {
    this.seed = typeof seed === 'string' ? hashStr(seed) : (seed >>> 0);
  }

  Noise.prototype._h = function (xi, yi) {
    var h = this.seed;
    h ^= Math.imul(xi | 0, 0x27d4eb2d);
    h = Math.imul(h ^ h >>> 15, 0x85ebca6b);
    h ^= Math.imul(yi | 0, 0x165667b1);
    h = Math.imul(h ^ h >>> 13, 0xc2b2ae35);
    return ((h ^ h >>> 16) >>> 0) / 4294967296;
  };

  Noise.prototype.at = function (x, y) {
    var xf = Math.floor(x), yf = Math.floor(y);
    var tx = x - xf, ty = y - yf;
    var sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    var a = this._h(xf, yf), b = this._h(xf + 1, yf);
    var c = this._h(xf, yf + 1), d = this._h(xf + 1, yf + 1);
    var top = a + (b - a) * sx, bot = c + (d - c) * sx;
    return top + (bot - top) * sy;
  };

  /* fractal sum, returns 0..1 */
  Noise.prototype.fbm = function (x, y, octaves, lac, gain) {
    octaves = octaves || 3; lac = lac || 2; gain = gain || 0.5;
    var amp = 1, freq = 1, sum = 0, norm = 0;
    for (var i = 0; i < octaves; i++) {
      sum += this.at(x * freq, y * freq) * amp;
      norm += amp;
      amp *= gain; freq *= lac;
    }
    return sum / norm;
  };

  ER.hashStr = hashStr;
  ER.RNG = RNG;
  ER.Noise = Noise;
})(typeof window !== 'undefined' ? (window.ER = window.ER || {}) : (global.ER = global.ER || {}));
