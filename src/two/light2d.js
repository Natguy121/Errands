/* Errands — the light over the quarter, for a flat world.
 *
 * The town is drawn from above now, so there is no sky dome to shade and no
 * directional light to aim. What survives from the first-person renderer is
 * the part that was measured rather than guessed: the table of what the light
 * looks like at each sun elevation, and the solar geometry on the clock that
 * says where the sun is. Both were tuned by reading pixels off rendered
 * frames — 8 PM ground luminance went from 1.6 to 11.1 when the elevation
 * model replaced the old linear arc — so they are kept as they are.
 *
 * Here they come out as three things a 2D frame can use: a colour to wash
 * over the whole quarter, a strength for that wash, and a bearing and length
 * for the shadow every wall throws across the paving.
 */
(function (ER) {
  'use strict';
  var U = ER.U;

  /* elevation in degrees -> what the light is doing.
     keep these sorted ascending; everything between is interpolated.
       wash  the colour the whole frame is tinted toward
       washA how much of it, 0..1
       sun   the colour of light falling on a lit surface
       sunI  how bright that light is
       amb   the colour in shadow
       shade how dark a shadow gets, 0..1 */
  var STOPS = [
    { e: -90, wash: 0x0c1226, washA: 0.80, sun: 0x0d121e, sunI: 0.00, amb: 0x24304f, shade: 0.06 },
    { e: -14, wash: 0x121a33, washA: 0.74, sun: 0x161a24, sunI: 0.00, amb: 0x2b3862, shade: 0.08 },
    { e:  -8, wash: 0x1d2440, washA: 0.64, sun: 0x3a2c38, sunI: 0.06, amb: 0x2f3b58, shade: 0.12 },
    { e:  -4, wash: 0x4a3b52, washA: 0.48, sun: 0x8c4a34, sunI: 0.30, amb: 0x4d5f84, shade: 0.20 },
    { e:  -1, wash: 0x8a5a48, washA: 0.34, sun: 0xd2643a, sunI: 0.85, amb: 0x66789c, shade: 0.30 },
    { e:   3, wash: 0xc98a52, washA: 0.26, sun: 0xffa057, sunI: 1.75, amb: 0x7c8fb2, shade: 0.40 },
    { e:   9, wash: 0xe0b483, washA: 0.17, sun: 0xffd39a, sunI: 2.45, amb: 0x95a8c6, shade: 0.46 },
    { e:  18, wash: 0xf0e2c8, washA: 0.09, sun: 0xfff0d6, sunI: 3.05, amb: 0x9db2cd, shade: 0.50 },
    { e:  34, wash: 0xfaf2e2, washA: 0.05, sun: 0xfff7e9, sunI: 3.45, amb: 0xa1b7d1, shade: 0.52 },
    { e:  60, wash: 0xfffdf6, washA: 0.03, sun: 0xfffbf4, sunI: 3.60, amb: 0xa5bad4, shade: 0.54 }
  ];

  /* the weather's own hand on top of the light */
  var WEATHER = {
    clear:    { mul: 1.06, wash: null,     washA: 0.00, shade: 1.10 },
    fair:     { mul: 1.00, wash: null,     washA: 0.00, shade: 1.00 },
    overcast: { mul: 0.72, wash: 0x9aa4ac, washA: 0.20, shade: 0.34 },
    drizzle:  { mul: 0.62, wash: 0x8e99a2, washA: 0.26, shade: 0.22 },
    rain:     { mul: 0.52, wash: 0x77838d, washA: 0.32, shade: 0.12 },
    storm:    { mul: 0.38, wash: 0x5d6873, washA: 0.42, shade: 0.06 },
    fog:      { mul: 0.66, wash: 0xc2c8c6, washA: 0.46, shade: 0.10 },
    frost:    { mul: 0.94, wash: 0xd4e0ea, washA: 0.12, shade: 0.78 }
  };

  function rgb(hex) {
    return { r: (hex >> 16) & 255, g: (hex >> 8) & 255, b: hex & 255 };
  }

  function mixRGB(a, b, t) {
    return {
      r: Math.round(U.lerp(a.r, b.r, t)),
      g: Math.round(U.lerp(a.g, b.g, t)),
      b: Math.round(U.lerp(a.b, b.b, t))
    };
  }

  function css(c, alpha) {
    if (alpha === undefined) return 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')';
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + alpha.toFixed(3) + ')';
  }

  function blend(a, b, t) {
    return {
      wash: mixRGB(rgb(a.wash), rgb(b.wash), t),
      washA: U.lerp(a.washA, b.washA, t),
      sun: mixRGB(rgb(a.sun), rgb(b.sun), t),
      sunI: U.lerp(a.sunI, b.sunI, t),
      amb: mixRGB(rgb(a.amb), rgb(b.amb), t),
      shade: U.lerp(a.shade, b.shade, t)
    };
  }

  function sample(elevDeg) {
    if (elevDeg <= STOPS[0].e) return blend(STOPS[0], STOPS[0], 0);
    for (var i = 0; i < STOPS.length - 1; i++) {
      if (elevDeg <= STOPS[i + 1].e) {
        var t = (elevDeg - STOPS[i].e) / (STOPS[i + 1].e - STOPS[i].e);
        return blend(STOPS[i], STOPS[i + 1], U.smooth(U.clamp(t, 0, 1)));
      }
    }
    return blend(STOPS[STOPS.length - 1], STOPS[STOPS.length - 1], 0);
  }

  function Light() {
    this.elev = 0;
    this.azimuth = 0;
    this.state = sample(40);
    this.wash = css(this.state.wash, 0);
    this.washAlpha = 0;
    this.shade = 0.5;
    /* Shadows fall away from the sun. The azimuth is degrees east of due
       south, and in the drawing +x is east and +y is south, so a sun in the
       east throws its shadows west: the offset is the negative of the sun's
       own horizontal direction. */
    this.shadowDX = 0;
    this.shadowDY = 0;
    this.daylight = 1;
    this.lamps = 0;
  }

  Light.prototype.update = function (clock) {
    var h = clock.hourFloat();
    this.elev = clock.sunElevation(h);
    this.azimuth = clock.sunAzimuth(h);
    var s = sample(this.elev);
    var wx = WEATHER[clock.weather] || WEATHER.fair;

    /* the overcast wash goes on over the hour's own colour, not instead of it */
    var washCol = s.wash, washA = s.washA;
    if (wx.wash !== null) {
      var over = rgb(wx.wash);
      var total = washA + wx.washA * (1 - washA);
      washCol = total > 0.0001
        ? mixRGB(washCol, over, (wx.washA * (1 - washA)) / total)
        : washCol;
      washA = total;
    }
    this.state = s;
    this.wash = css(washCol, 1);
    this.washRGB = washCol;
    this.washAlpha = U.clamp(washA, 0, 0.92);

    /* Shadows are long at the ends of the day and short at noon, and they
       vanish altogether under cloud, because there is nothing casting them. */
    this.shade = U.clamp(s.shade * wx.shade, 0, 0.62);
    var elevRad = Math.max(3, this.elev) * Math.PI / 180;
    var len = U.clamp(1 / Math.tan(elevRad), 0, 5.5);
    var az = this.azimuth * Math.PI / 180;
    /* +x east, +y south; the sun at azimuth 0 is due south, so its own
       horizontal direction is (sin az, cos az) and the shadow is the reverse */
    this.shadowDX = -Math.sin(az) * len;
    this.shadowDY = -Math.cos(az) * len;
    this.shadowLen = len;

    this.sunStrength = s.sunI * wx.mul;
    this.daylight = clock.daylight();
    /* the lamps come on when the light goes, which is also when the windows do */
    this.lamps = U.clamp((0.42 - this.daylight) / 0.30, 0, 1);
    return this;
  };

  /* what a surface of this base colour looks like under the current light */
  Light.prototype.tint = function (hex, lit) {
    var base = typeof hex === 'number' ? rgb(hex) : hex;
    var k = U.clamp(0.24 + this.sunStrength * 0.21, 0.1, 1.05);
    var toward = lit === false ? this.state.amb : this.state.sun;
    var out = mixRGB(base, mixRGB(base, toward, 0.32), 1);
    out = { r: Math.round(out.r * k), g: Math.round(out.g * k), b: Math.round(out.b * k) };
    var w = this.washRGB || this.state.wash;
    out = mixRGB(out, w, this.washAlpha * 0.55);
    return css({
      r: U.clamp(out.r, 0, 255) | 0,
      g: U.clamp(out.g, 0, 255) | 0,
      b: U.clamp(out.b, 0, 255) | 0
    });
  };

  ER.Light2D = Light;
  ER.light2dInternals = { STOPS: STOPS, WEATHER: WEATHER, sample: sample, css: css, rgb: rgb, mixRGB: mixRGB };
})(typeof window !== 'undefined' ? (window.ER = window.ER || {}) : (global.ER = global.ER || {}));
