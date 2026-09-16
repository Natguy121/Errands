/* Errands — sound, all of it generated. There are no audio files to load,
   which is fortunate, because there is no budget and no internet. */
(function (ER) {
  'use strict';
  var U = ER.U;

  function Audio() {
    this.ok = false;
    this.ctx = null;
    this.muted = false;
    this.beds = {};
  }

  Audio.prototype.start = function () {
    if (this.ok) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { this.ctx = new AC(); } catch (e) { return false; }
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);

    /* one second of noise, reused for everything rough */
    var sr = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, sr * 2, sr);
    var d = this.noise.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    this._bed('wind', 320, 0.0, 'lowpass', 0.9);
    this._bed('rain', 1800, 0.0, 'bandpass', 1.4);
    this.ok = true;
    return true;
  };

  Audio.prototype.resume = function () {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  };

  Audio.prototype._bed = function (name, freq, gain, type, q) {
    var src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    var f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q || 1;
    var g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
    this.beds[name] = { gain: g, filter: f };
  };

  Audio.prototype.setBed = function (name, value, freq) {
    if (!this.ok || !this.beds[name]) return;
    var b = this.beds[name];
    var t = this.ctx.currentTime;
    b.gain.gain.setTargetAtTime(this.muted ? 0 : value, t, 0.5);
    if (freq) b.filter.frequency.setTargetAtTime(freq, t, 0.8);
  };

  /* ---- one-shots ---- */

  Audio.prototype.blip = function (freq, dur, type, vol, slide) {
    if (!this.ok || this.muted) return;
    var t = this.ctx.currentTime;
    var o = this.ctx.createOscillator();
    var g = this.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(vol || 0.1, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  };

  Audio.prototype.burst = function (dur, freq, q, vol, type) {
    if (!this.ok || this.muted) return;
    var t = this.ctx.currentTime;
    var s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    var f = this.ctx.createBiquadFilter();
    f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
    var g = this.ctx.createGain();
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(vol || 0.08, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t, Math.random()); s.stop(t + dur + 0.02);
  };

  var STEP = {
    asphalt:  { f: 1500, q: 1.2, v: 0.045, d: 0.07 },
    concrete: { f: 1700, q: 1.4, v: 0.048, d: 0.07 },
    gravel:   { f: 2600, q: 0.7, v: 0.075, d: 0.12 },
    ballast:  { f: 2900, q: 0.6, v: 0.085, d: 0.14 },
    grass:    { f: 900,  q: 0.8, v: 0.04,  d: 0.10 },
    field:    { f: 1100, q: 0.7, v: 0.055, d: 0.13 },
    woods:    { f: 700,  q: 0.8, v: 0.05,  d: 0.14 },
    water:    { f: 520,  q: 0.5, v: 0.10,  d: 0.22 },
    dirt:     { f: 800,  q: 0.9, v: 0.05,  d: 0.10 }
  };

  Audio.prototype.step = function (terrain, wet) {
    var s = STEP[terrain] || STEP.grass;
    this.burst(s.d, s.f * (0.9 + Math.random() * 0.2), s.q, s.v * (wet > 0.4 ? 1.3 : 1));
    if (wet > 0.5 && Math.random() < 0.4) this.burst(0.16, 420, 0.6, 0.05, 'lowpass');
  };

  var SFX = {
    scrape:  function (a) { a.burst(0.42, 1900, 0.8, 0.07); },
    dig:     function (a) { a.burst(0.30, 700, 0.7, 0.09, 'lowpass'); },
    rummage: function (a) { a.burst(0.26, 2400, 0.6, 0.06); },
    rustle:  function (a) { a.burst(0.22, 3400, 0.5, 0.05); },
    water:   function (a) { a.burst(0.5, 620, 0.5, 0.09, 'lowpass'); a.blip(320, 0.2, 'sine', 0.03, 1.5); },
    paper:   function (a) { a.burst(0.18, 4200, 0.4, 0.045); },
    lid:     function (a) { a.blip(1300, 0.09, 'square', 0.05, 0.7); },
    clay:    function (a) { a.burst(0.3, 400, 0.8, 0.07, 'lowpass'); },
    wire:    function (a) { a.blip(900, 0.14, 'triangle', 0.045, 1.4); },
    cloth:   function (a) { a.burst(0.2, 1200, 0.5, 0.04); },
    set:     function (a) { a.blip(520, 0.08, 'sine', 0.05, 0.8); },
    till:    function (a) { a.blip(1760, 0.07, 'square', 0.05); a.blip(2340, 0.09, 'square', 0.04); },
    door:    function (a) { a.blip(1480, 0.10, 'triangle', 0.05); a.blip(1976, 0.14, 'triangle', 0.04); },
    shutter: function (a) { a.burst(0.05, 3000, 1.5, 0.12); a.blip(1200, 0.04, 'square', 0.05, 0.5); },
    found:   function (a) { a.blip(660, 0.10, 'triangle', 0.06); a.blip(880, 0.16, 'triangle', 0.05); },
    done:    function (a) { a.blip(523, 0.14, 'sine', 0.05); a.blip(784, 0.22, 'sine', 0.045); },
    issue:   function (a) { a.blip(392, 0.10, 'sine', 0.035); },
    nope:    function (a) { a.blip(180, 0.16, 'sawtooth', 0.045, 0.7); },
    siren:   function (a) { a.blip(620, 2.4, 'sawtooth', 0.05, 1.3); },
    bell:    function (a) { a.blip(1046, 0.7, 'sine', 0.045); a.blip(1568, 0.5, 'sine', 0.03); },
    cricket: function (a) { a.blip(4400 + Math.random() * 500, 0.035, 'square', 0.022); },
    bird:    function (a) { a.blip(2600 + Math.random() * 1600, 0.09, 'sine', 0.03, 1.6); },
    dog:     function (a) { a.blip(280, 0.14, 'sawtooth', 0.05, 0.6); },
    truck:   function (a) { a.burst(1.8, 180, 0.6, 0.05, 'lowpass'); },
    ice:     function (a) { a.burst(0.9, 2600, 0.4, 0.07); }
  };

  Audio.prototype.play = function (name) {
    if (!this.ok || this.muted || !SFX[name]) return;
    SFX[name](this);
  };

  /* the ambience, mixed from the hour and the sky */
  Audio.prototype.ambience = function (clock, dt, town, player) {
    if (!this.ok) return;
    var wx = clock.weather, ph = clock.phase();
    var rain = wx === 'storm' ? 0.10 : wx === 'rain' ? 0.065 : wx === 'drizzle' ? 0.028 : 0;
    this.setBed('rain', rain, wx === 'storm' ? 2400 : 1800);
    var wind = 0.012 + (wx === 'storm' ? 0.03 : wx === 'fog' ? 0.004 : 0.010);
    this.setBed('wind', wind, ph === 'night' ? 240 : 360);

    this._t = (this._t || 0) + dt;
    var night = (ph === 'night' || ph === 'twilight' || ph === 'dusk');
    if (night && rain === 0) {
      this._cr = (this._cr || 0) + dt;
      if (this._cr > 0.16 + Math.random() * 0.3) { this._cr = 0; this.play('cricket'); }
    }
    if ((ph === 'dawn' || ph === 'morning') && rain === 0) {
      this._bd = (this._bd || 0) + dt;
      if (this._bd > 1.4 + Math.random() * 3.6) { this._bd = 0; this.play('bird'); }
    }
    this._dg = (this._dg || 0) + dt;
    if (this._dg > 30 + Math.random() * 90) { this._dg = 0; if (Math.random() < 0.5) this.play('dog'); }
  };

  Audio.prototype.mute = function (on) {
    this.muted = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0 : 0.5, this.ctx.currentTime, 0.1);
  };

  ER.Audio = Audio;
})(typeof window !== 'undefined' ? (window.ER = window.ER || {}) : (global.ER = global.ER || {}));
