/* Errands — clock, calendar, weather.
   One real second is one town minute, so a day is twenty-four minutes.
   Dusk matters. Rain matters. Nothing else does. */
(function (ER) {
  'use strict';
  var U = ER.U;

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  var MDAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  var DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  /* weather states and how they follow each other */
  var WEATHER = {
    clear:    { label: 'clear',           wet: 0.0, dim: 0.00, fog: 0.00 },
    fair:     { label: 'fair',            wet: 0.0, dim: 0.02, fog: 0.00 },
    overcast: { label: 'overcast',        wet: 0.1, dim: 0.16, fog: 0.04 },
    drizzle:  { label: 'drizzle',         wet: 0.6, dim: 0.24, fog: 0.10 },
    rain:     { label: 'rain',            wet: 1.0, dim: 0.34, fog: 0.14 },
    storm:    { label: 'thunderstorm',    wet: 1.0, dim: 0.46, fog: 0.10 },
    fog:      { label: 'fog',             wet: 0.2, dim: 0.20, fog: 0.85 },
    frost:    { label: 'frost',           wet: 0.0, dim: 0.06, fog: 0.22 }
  };

  var TRANSITIONS = {
    clear:    [['clear', 5], ['fair', 4], ['overcast', 2], ['fog', 1]],
    fair:     [['fair', 5], ['clear', 3], ['overcast', 3], ['drizzle', 1]],
    overcast: [['overcast', 4], ['drizzle', 3], ['fair', 3], ['rain', 2], ['fog', 1]],
    drizzle:  [['drizzle', 3], ['rain', 2], ['overcast', 4], ['fair', 1]],
    rain:     [['rain', 3], ['drizzle', 3], ['storm', 1], ['overcast', 3]],
    storm:    [['storm', 1], ['rain', 4], ['overcast', 2]],
    fog:      [['fog', 2], ['overcast', 3], ['clear', 3], ['fair', 2]],
    frost:    [['clear', 4], ['fair', 3], ['overcast', 2]]
  };

  function Clock(seed, startDay) {
    this.rng = new ER.RNG(ER.hashStr('weather:' + seed));
    /* the game opens on the afternoon you arrive */
    this.minutes = 14 * 60 + 12;           // 2:12 PM
    this.day = 1;                          // days since you moved in
    this.month = 8;                        // September, zero-indexed
    this.date = startDay || 15;
    this.dowIndex = 2;                     // a Tuesday
    this.year = 2026;
    this.scale = 60;                       // game minutes per real second
    this.weather = 'fair';
    this.weatherFor = 90;                  // game minutes until next roll
    this.wet = 0;                          // 0..1, ground wetness, lags rain
    this.fogAmt = 0;
    this.listeners = [];
    this._lastHour = 14;
  }

  Clock.prototype.on = function (fn) { this.listeners.push(fn); };
  Clock.prototype._emit = function (ev, data) {
    for (var i = 0; i < this.listeners.length; i++) this.listeners[i](ev, data);
  };

  Clock.prototype.advance = function (dtSeconds, multiplier) {
    var dm = dtSeconds * this.scale * (multiplier || 1);
    this.minutes += dm;
    this.weatherFor -= dm;

    while (this.minutes >= 1440) {
      this.minutes -= 1440;
      this.day++;
      this.date++;
      this.dowIndex = (this.dowIndex + 1) % 7;
      var dim = MDAYS[this.month];
      if (this.date > dim) { this.date = 1; this.month = (this.month + 1) % 12; if (this.month === 0) this.year++; }
      this._emit('newday', this.day);
    }

    var h = this.hour();
    if (h !== this._lastHour) { this._lastHour = h; this._emit('hour', h); }

    if (this.weatherFor <= 0) this.rollWeather();

    /* ground takes a while to dry out; puddles outlast the rain */
    var target = WEATHER[this.weather].wet;
    var rate = target > this.wet ? 0.012 : 0.0022;
    this.wet += U.clamp(target - this.wet, -rate * dm, rate * dm);
    this.wet = U.clamp(this.wet, 0, 1);

    var ftarget = WEATHER[this.weather].fog;
    this.fogAmt += U.clamp(ftarget - this.fogAmt, -0.01 * dm, 0.01 * dm);
    this.fogAmt = U.clamp(this.fogAmt, 0, 1);
  };

  Clock.prototype.rollWeather = function () {
    var from = TRANSITIONS[this.weather] || TRANSITIONS.fair;
    var next = this.rng.pickWeighted(from, function (e) { return e[1]; })[0];
    /* a cold clear night late in the season leaves frost on windshields */
    if (this.hour() >= 4 && this.hour() < 8 && this.month >= 9 && this.rng.chance(0.28)) next = 'frost';
    if (next !== this.weather) this._emit('weather', next);
    this.weather = next;
    this.weatherFor = this.rng.int(70, 260);
  };

  Clock.prototype.setWeather = function (w) {
    if (!WEATHER[w]) return false;
    this.weather = w; this.weatherFor = 180; this._emit('weather', w); return true;
  };

  Clock.prototype.hour = function () { return Math.floor(this.minutes / 60) % 24; };
  Clock.prototype.minute = function () { return Math.floor(this.minutes % 60); };
  Clock.prototype.hourFloat = function () { return this.minutes / 60; };
  Clock.prototype.timeString = function () { return U.clock(this.hour(), this.minute()); };
  Clock.prototype.dateString = function () {
    return DOW[this.dowIndex] + ', ' + MONTHS[this.month] + ' ' + this.date;
  };
  Clock.prototype.weatherInfo = function () { return WEATHER[this.weather]; };
  Clock.prototype.weatherLabel = function () { return WEATHER[this.weather].label; };

  /* sunrise/sunset drift a little through the season */
  Clock.prototype.sunrise = function () { return 6.9 + (this.day * 0.008); };
  Clock.prototype.sunset = function () { return 19.4 - (this.day * 0.011); };

  /* named part of day — quests key off 'dusk' constantly */
  Clock.prototype.phase = function () {
    var h = this.hourFloat(), sr = this.sunrise(), ss = this.sunset();
    if (h < sr - 1.1) return 'night';
    if (h < sr + 0.4) return 'dawn';
    if (h < 11.5) return 'morning';
    if (h < 13.5) return 'midday';
    if (h < ss - 1.6) return 'afternoon';
    if (h < ss + 0.55) return 'dusk';
    if (h < ss + 1.5) return 'twilight';
    return 'night';
  };

  /* 0 = pitch dark, 1 = full sun */
  Clock.prototype.daylight = function () {
    var h = this.hourFloat(), sr = this.sunrise(), ss = this.sunset();
    var l;
    if (h <= sr - 1.2 || h >= ss + 1.4) l = 0;
    else if (h < sr + 0.5) l = U.smooth(U.clamp((h - (sr - 1.2)) / 1.7, 0, 1));
    else if (h > ss - 0.5) l = 1 - U.smooth(U.clamp((h - (ss - 0.5)) / 1.9, 0, 1));
    else l = 1;
    return l * (1 - WEATHER[this.weather].dim * 0.8);
  };

  /* Direction shadows are thrown, in radians; north is -y, east is +x.
     At solar noon the sun is due south, so shadows point north. */
  Clock.prototype.sunAngle = function () {
    var h = this.hourFloat(), sr = this.sunrise(), ss = this.sunset();
    var t = U.clamp((h - sr) / Math.max(0.001, ss - sr), 0, 1);
    return -Math.PI * 0.5 + (t - 0.5) * Math.PI * 1.15;
  };

  /* how far off true north the shadow currently falls, radians, signed */
  Clock.prototype.shadowBearing = function () {
    var a = this.sunAngle() + Math.PI / 2;
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  };

  /* true if hour-float is inside a wrapping window */
  Clock.prototype.inWindow = function (h0, h1) {
    var h = this.hourFloat();
    if (h0 <= h1) return h >= h0 && h <= h1;
    return h >= h0 || h <= h1;
  };

  Clock.prototype.save = function () {
    return { minutes: this.minutes, day: this.day, month: this.month, date: this.date,
      dowIndex: this.dowIndex, year: this.year, weather: this.weather,
      weatherFor: this.weatherFor, wet: this.wet, fogAmt: this.fogAmt };
  };
  Clock.prototype.load = function (s) {
    if (!s) return;
    for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) this[k] = s[k];
    this._lastHour = this.hour();
  };

  ER.Clock = Clock;
  ER.WEATHER = WEATHER;
  ER.MONTHS = MONTHS;
  ER.DOW = DOW;
})(typeof window !== 'undefined' ? (window.ER = window.ER || {}) : (global.ER = global.ER || {}));
