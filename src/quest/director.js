/* Errands — the director.
 *
 * Issues an errand. Watches you do it. Issues another one. It has no plan.
 */
(function (ER) {
  'use strict';
  var U = ER.U;

  function pool() {
    return (ER.QuestPoolA || []).concat(ER.QuestPoolB || []);
  }

  function Director(game) {
    this.g = game;
    this.rng = new ER.RNG(ER.hashStr('errands:' + game.town.seedStr + ':' + Date.now()));
    this.active = null;
    this.stepIndex = 0;
    this.progress = null;        // per-step scratch state
    this.recent = [];            // template ids issued lately, to avoid immediate repeats
    this.history = [];           // completed errands, newest last
    this.abandoned = 0;
    this.issued = 0;
  }

  Director.prototype.templates = pool;

  /* ---------------- issuing ---------------- */

  Director.prototype.issue = function (forceId) {
    var all = pool(), self = this;
    var tpl = null;
    if (forceId) {
      for (var f = 0; f < all.length; f++) if (all[f].id === forceId) tpl = all[f];
    }
    if (!tpl) {
      tpl = this.rng.pickWeighted(all, function (t) {
        var w = t.weight || 1;
        var idx = self.recent.indexOf(t.id);
        if (idx >= 0) w *= 0.02;                       /* not that one again yet */
        return w;
      });
    }
    var params = tpl.setup ? tpl.setup(this.rng.sub('p' + this.issued + tpl.id), this.g.town) : {};
    var steps = tpl.steps(params, this.g.town);
    this.active = {
      tplId: tpl.id,
      n: ++this.issued,
      params: params,
      title: tpl.title(params, this.g.town),
      fine: tpl.fine ? tpl.fine(params, this.g.town) : null,
      tags: tpl.tags || [],
      steps: steps,
      startDay: this.g.clock.day,
      startedAt: this.g.clock.minutes
    };
    this.stepIndex = 0;
    this.progress = null;
    this.recent.push(tpl.id);
    while (this.recent.length > 14) this.recent.shift();
    this.g.onErrandIssued(this.active);
    return this.active;
  };

  Director.prototype.currentStep = function () {
    if (!this.active) return null;
    return this.active.steps[this.stepIndex] || null;
  };

  Director.prototype.stepState = function (i) {
    if (!this.active) return 'none';
    if (i < this.stepIndex) return 'done';
    if (i === this.stepIndex) return 'current';
    return 'todo';
  };

  /* ---------------- requirement checks ---------------- */

  Director.prototype.dayOk = function (st) {
    if (!st || !st.dayOffset) return true;
    return this.g.clock.day >= this.active.startDay + st.dayOffset;
  };

  Director.prototype.timeOk = function (st) {
    if (!st || !st.when) return true;
    return this.g.clock.inWindow(st.when.h0, st.when.h1);
  };

  Director.prototype.weatherOk = function (st) {
    if (!st || !st.weather) return true;
    return st.weather.indexOf(this.g.clock.weather) >= 0;
  };

  Director.prototype.itemsOk = function (st) {
    if (!st || !st.need || !st.need.length) return true;
    var counts = {};
    for (var i = 0; i < st.need.length; i++) {
      counts[st.need[i]] = (counts[st.need[i]] || 0) + 1;
      if (this.g.count(st.need[i]) < counts[st.need[i]]) return false;
    }
    return true;
  };

  /* is this prop the place for the current step? */
  Director.prototype.placeOk = function (st, prop) {
    if (!st) return false;
    var at = st.at;
    if (at === undefined || at === null) return true;
    if (at === 'ANY') return true;
    if (at === 'HOME') {
      return !!prop && (prop.id === 'home_door' || prop.id === 'home_porch' || prop.id === 'home_windowsill');
    }
    if (typeof at === 'object' && at.tag) {
      return !!prop && prop.tags.indexOf(at.tag) >= 0;
    }
    return !!prop && prop.id === at;
  };

  /* what is stopping me, in words */
  Director.prototype.blockReason = function (st, prop) {
    if (!st) return null;
    if (!this.dayOk(st)) return 'not until tomorrow';
    if (!this.timeOk(st)) return 'not ' + (st.when.label || 'now');
    if (!this.weatherOk(st)) return 'needs ' + st.weather.join(' or ');
    if (!this.itemsOk(st)) {
      var missing = [];
      var counts = {};
      for (var i = 0; i < st.need.length; i++) {
        counts[st.need[i]] = (counts[st.need[i]] || 0) + 1;
        if (this.g.count(st.need[i]) < counts[st.need[i]] && missing.indexOf(st.need[i]) < 0) missing.push(st.need[i]);
      }
      return 'you need ' + U.list(missing.map(ER.itemName));
    }
    return null;
  };

  /* the decoy props exist so that the fine print can be wrong about something */
  Director.prototype.decoyLine = function (st, prop) {
    if (!st || !prop || !prop.decoyFor) return null;
    var target = (typeof st.at === 'string') ? this.g.town.props[st.at] : null;
    if (target && target.decoyKey === prop.decoyFor && target.id !== prop.id) return prop.decoyLine;
    if (st.decoyKey && st.decoyKey === prop.decoyFor) return prop.decoyLine;
    return null;
  };

  /* ---------------- the interaction offered at a prop ---------------- */

  Director.prototype.offerAt = function (prop) {
    var st = this.currentStep();
    if (!st) return null;
    var kind = st.kind;

    /* steps you perform with your hands, wherever you happen to be */
    if ((kind === 'craft' || kind === 'note') && this.placeOk(st, prop)) {
      return { verb: st.verb || 'MAKE', label: ER.verbInfo(st.verb || 'MAKE').label,
        hold: st.hold || ER.verbInfo(st.verb || 'MAKE').hold, step: st, reason: this.blockReason(st, prop) };
    }
    if (!prop) return null;

    var decoy = this.decoyLine(st, prop);
    if (decoy) return { decoy: decoy, verb: st.verb, label: ER.verbInfo(st.verb || 'LOOK').label, step: st };

    if (kind === 'photo' || kind === 'photoset' || kind === 'edit' || kind === 'walk') return null;

    if (!this.placeOk(st, prop)) return null;
    if (kind === 'buy' && !prop.shop) return null;

    var verb = st.verb || (prop.verbs && prop.verbs[0]) || 'LOOK';
    var vi = ER.verbInfo(verb);
    return { verb: verb, label: vi.label, hold: st.hold || vi.hold, step: st,
      reason: this.blockReason(st, prop), kind: kind };
  };

  /* ---------------- completing a hold ---------------- */

  /* returns {ok, message, advanced} */
  Director.prototype.perform = function (prop) {
    var st = this.currentStep();
    if (!st) return { ok: false };
    var reason = this.blockReason(st, prop);
    if (reason) return { ok: false, message: U.cap(reason) + '.' };
    if (!this.placeOk(st, prop) && st.kind !== 'craft' && st.kind !== 'note') return { ok: false };

    var g = this.g, i;

    if (st.kind === 'search') {
      this.progress = this.progress || { tries: 0 };
      this.progress.tries++;
      var need = st.tries || 4;
      var got = this.progress.tries >= need ||
        (this.progress.tries >= Math.max(1, need - 2) && this.rng.chance(0.4));
      if (!got) {
        var junk = g.junkLine(prop);
        g.stats.junk++;
        return { ok: true, message: 'You turn up ' + junk + '.', junk: true };
      }
      g.add(st.item, 1);
      this.advance();
      return { ok: true, message: 'You find ' + ER.itemName(st.item) + '.', found: true };
    }

    if (st.kind === 'gather') {
      this.progress = this.progress || { got: 0 };
      this.progress.got++;
      g.add(st.item, 1);
      if (this.progress.got >= st.n) {
        this.advance();
        return { ok: true, message: U.cap(U.spell(st.n)) + '. That is all of them.', found: true };
      }
      return { ok: true, message: this.progress.got + ' of ' + st.n + '.', partial: true };
    }

    if (st.kind === 'buy') {
      g.add(st.item, 1);
      this.advance();
      return { ok: true, message: 'You buy ' + ER.itemName(st.item) + '.', shop: true };
    }

    /* act / craft / note all resolve the same way: take, give, advance */
    this.consume(st);
    var msg = null;
    if (st.give.length) msg = 'You have ' + U.list(st.give.map(ER.itemName)) + '.';
    if (st.witnessed) g.noteWitnessed(st);
    this.advance();
    return { ok: true, message: msg };
  };

  Director.prototype.consume = function (st) {
    var g = this.g, i;
    if (st.takeCount) g.remove(st.takeCount.item, st.takeCount.n);
    for (i = 0; i < st.take.length; i++) g.remove(st.take[i], 1);
    for (i = 0; i < st.give.length; i++) g.add(st.give[i], 1);
  };

  /* ---------------- the standing-still steps ---------------- */

  Director.prototype.waitTick = function (dt, prop, moving) {
    var st = this.currentStep();
    if (!st || st.kind !== 'wait') return null;
    if (!this.placeOk(st, prop)) { this.progress = null; return null; }
    if (this.blockReason(st, prop)) { this.progress = null; return { blocked: this.blockReason(st, prop) }; }
    if (st.still && moving) { this.progress = null; return { reset: true }; }
    this.progress = this.progress || { t: 0 };
    this.progress.t += dt;
    if (this.progress.t >= st.seconds) {
      this.consume(st);
      if (st.witnessed) this.g.noteWitnessed(st);
      this.advance();
      return { done: true };
    }
    return { t: this.progress.t, of: st.seconds };
  };

  /* ---------------- walking a route ---------------- */

  Director.prototype.walkTick = function (px, py, running) {
    var st = this.currentStep();
    if (!st || st.kind !== 'walk') return null;
    this.progress = this.progress || { i: 0, faults: 0 };
    var town = this.g.town;
    if (st.noRun && running) {
      if (this.progress.i > 0) {
        this.progress = { i: 0, faults: this.progress.faults + 1 };
        return { fault: 'You ran. You felt a tie go under your heel.' };
      }
      return null;
    }
    var wantId = st.waypoints[this.progress.i];
    var wp = town.props[wantId];
    if (!wp) { this.advance(); return { done: true }; }
    if (U.dist(px, py, wp.x, wp.y) < wp.r) {
      this.progress.i++;
      if (this.progress.i >= st.waypoints.length) {
        this.consume(st);
        this.advance();
        return { done: true };
      }
      return { reached: this.progress.i, of: st.waypoints.length };
    }
    return { i: this.progress.i, of: st.waypoints.length, next: wp };
  };

  /* ---------------- photographs ---------------- */

  Director.prototype.photoRequest = function () {
    var st = this.currentStep();
    if (!st) return null;
    if (st.kind === 'photo') {
      return { targets: [st.target], done: (this.progress && this.progress.done) || [],
        maxRange: st.maxRange || 22, when: st.when, at: st.at, requireFacing: st.requireFacing, single: true };
    }
    if (st.kind === 'photoset') {
      return { targets: st.targets, done: (this.progress && this.progress.done) || [],
        maxRange: st.maxRange || 10, single: false };
    }
    return null;
  };

  /* called by the camera when the shutter goes. photo = {id, targetsInFrame:[]} */
  Director.prototype.tookPhoto = function (photo) {
    var st = this.currentStep();
    if (!st) return { ok: false };
    var g = this.g;

    if (st.kind === 'photo') {
      var want = st.target;
      var okFrame = want === 'SELF' ? photo.self : photo.targetsInFrame.indexOf(want) >= 0;
      if (!okFrame) return { ok: false, message: 'Not in the frame.' };
      if (st.at && st.at !== 'ANY' && !this.placeOk(st, g.town.propAt(g.player.x, g.player.y, st.at)))
        return { ok: false, message: 'Not from here.' };
      if (!this.timeOk(st)) return { ok: false, message: 'Not ' + (st.when.label || 'now') + '.' };
      if (st.requireFacing === 'north' && Math.abs(photo.shadowBearing) > 0.30)
        return { ok: false, message: 'The shadow is not pointing north.' };
      photo.forStep = st;
      g.add('photo', 1);
      this.advance();
      return { ok: true, message: 'You have a photograph of it.' };
    }

    if (st.kind === 'photoset') {
      this.progress = this.progress || { done: [] };
      var hit = null;
      for (var i = 0; i < st.targets.length; i++) {
        var t = st.targets[i];
        if (this.progress.done.indexOf(t) >= 0) continue;
        if (photo.targetsInFrame.indexOf(t) >= 0) {
          var pos = g.town.propPos(t);
          if (U.dist(g.player.x, g.player.y, pos.x, pos.y) > (st.maxRange || 10)) {
            return { ok: false, message: 'Not from directly below.' };
          }
          hit = t; break;
        }
      }
      if (!hit) return { ok: false, message: 'Nothing on the list is in the frame.' };
      this.progress.done.push(hit);
      g.add('photo', 1);
      if (this.progress.done.length >= st.targets.length) {
        this.advance();
        return { ok: true, message: 'That is all of them.' };
      }
      return { ok: true, message: this.progress.done.length + ' of ' + st.targets.length + '.' };
    }
    return { ok: false };
  };

  /* the darkroom step: applying a filter in the journal */
  Director.prototype.editedPhoto = function (photo, filter) {
    var st = this.currentStep();
    if (!st || st.kind !== 'edit') return { ok: false };
    if (st.filter && st.filter !== filter) return { ok: false, message: 'Not that edit.' };
    this.advance();
    return { ok: true, message: 'High contrast. Black and white. Nobody asked for it.' };
  };

  /* ---------------- advancing and finishing ---------------- */

  Director.prototype.advance = function () {
    this.progress = null;
    this.stepIndex++;
    if (this.stepIndex >= this.active.steps.length) this.complete();
  };

  Director.prototype.complete = function () {
    var done = this.active;
    done.finishedDay = this.g.clock.day;
    done.finishedAt = this.g.clock.timeString();
    this.history.push({ n: done.n, tplId: done.tplId, title: done.title,
      day: done.finishedDay, at: done.finishedAt });
    while (this.history.length > 400) this.history.shift();
    this.g.onErrandComplete(done);
    this.active = null;
    this.stepIndex = 0;
    this.progress = null;
    /* another one. immediately. */
    this.issue();
  };

  Director.prototype.abandon = function () {
    if (!this.active) return;
    this.abandoned++;
    this.g.onErrandAbandoned(this.active);
    this.active = null;
    this.issue();
  };

  /* ---------------- persistence ---------------- */

  Director.prototype.save = function () {
    return {
      seed: this.rng.seed,
      stepIndex: this.stepIndex,
      progress: this.progress,
      recent: this.recent,
      history: this.history,
      abandoned: this.abandoned,
      issued: this.issued,
      active: this.active ? { tplId: this.active.tplId, n: this.active.n, params: this.active.params,
        startDay: this.active.startDay, startedAt: this.active.startedAt } : null
    };
  };

  Director.prototype.load = function (s) {
    if (!s) return;
    this.rng = new ER.RNG(s.seed >>> 0);
    this.recent = s.recent || [];
    this.history = s.history || [];
    this.abandoned = s.abandoned || 0;
    this.issued = s.issued || 0;
    if (s.active) {
      var all = pool(), tpl = null;
      for (var i = 0; i < all.length; i++) if (all[i].id === s.active.tplId) tpl = all[i];
      if (tpl) {
        var params = s.active.params;
        this.active = {
          tplId: tpl.id, n: s.active.n, params: params,
          title: tpl.title(params, this.g.town),
          fine: tpl.fine ? tpl.fine(params, this.g.town) : null,
          tags: tpl.tags || [],
          steps: tpl.steps(params, this.g.town),
          startDay: s.active.startDay, startedAt: s.active.startedAt
        };
        this.stepIndex = Math.min(s.stepIndex || 0, this.active.steps.length - 1);
        this.progress = s.progress || null;
      } else {
        this.issue();
      }
    }
  };

  ER.Director = Director;
  ER.questPool = pool;
})(typeof window !== 'undefined' ? (window.ER = window.ER || {}) : (global.ER = global.ER || {}));
