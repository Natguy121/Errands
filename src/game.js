/* Errands — the game.
 *
 * You have the back room of number 6, off the souk in the old quarter of
 * Batroun, month to month. Nobody sent for you. The quest log fills itself.
 */
(function (ER) {
  'use strict';
  var U = ER.U;

  /* Standing still runs the clock an hour a second, so waiting for dusk or
     for the noon siren costs seconds rather than minutes. */
  var LINGER = 60;

  function Game(canvas, seed) {
    this.cv = canvas;
    this.seedStr = seed || 'batroun';
    this.town = ER.generateTown(this.seedStr);
    this.clock = new ER.Clock(this.seedStr);
    this.rng = new ER.RNG('play:' + this.seedStr);

    this.view = new ER.View(canvas, this.town);
    this.scene = new ER.Scene2D(this.town, this.clock);
    this.view.scene = this.scene;          /* the view draws through it */
    this.sky = this.scene.light;           /* the light over the quarter */

    this.people = ER.populate(this.town, new ER.RNG('people:' + this.seedStr));
    this.peopleByLot = {};
    for (var i = 0; i < this.people.length; i++) this.peopleByLot[this.people[i].home] = this.people[i];

    /* residents still think in town coordinates, so keep a 2D shadow of you */
    this.player = { x: this.view.pos.x, y: this.view.pos.z, facing: 0, moving: false, running: false };

    this.input = new ER.Input();
    this.audio = new ER.Audio();
    this.hud = new ER.HUD(this);

    this.inv = {};
    this.stats = { walked: 0, picked: 0, junk: 0, witnessed: 0, lingered: 0 };
    this.discovered = {};
    this.photos = [];
    this.photoSel = 0;
    this.reviewPhoto = null;
    this.journalScroll = 0;
    this.milestones = {};
    this.flags = {};
    this.porchGifts = [];
    this.mode = 'play';
    this.photoSize = { w: 640, h: 400 };
    this.t = 0;
    this.holdT = 0;
    this.holdMax = 0;
    this.holdProp = null;
    this.saveTimer = 0;
    this.stepAcc = 0;

    this.director = new ER.Director(this);

    var self = this;
    this.clock.on(function (ev, data) { self.onClock(ev, data); });
  }

  /* ------------------------------------------------------------------ *
   *  build the world (called once, after construction)
   * ------------------------------------------------------------------ */

  Game.prototype.buildWorld = function (onProgress) {
    /* There is very little to build now. The surfaces are eight small noise
       tiles, the relief is one 200x200 shading pass over the height field,
       and everything else is drawn from the town data every frame. What used
       to be here — terrain chunks, eighteen house kits, 228 batched props and
       a shader warm-up that drew the quarter from twelve vantage points to
       stop the first walk down the souk compiling programs mid-stride — has
       no equivalent: a 2D context has no programs to compile. */
    var steps = [
      ['the surfaces', function (g) { g.scene.tiles = g.scene.tiles || {}; }],
      ['the shape of the rock', function (g) { g.scene.buildRelief(); }],
      ['the residents', function (g) {
        /* they walk the same graph they always did; from above they are dots */
        g.scene.game = g;
      }],
      ['one frame, to be sure', function (g) {
        g.view.resize();
        g.scene.update(g, 0);
        g.view.render();
        g.shadersWarm = true;          /* nothing to warm; the loader waits on it */
      }]
    ];
    this._buildSteps = steps;
    this._buildIndex = 0;
    this._onProgress = onProgress;
    return steps.length;
  };

  /* run one build step; the loader calls this until it returns false */
  Game.prototype.buildStep = function () {
    if (!this._buildSteps || this._buildIndex >= this._buildSteps.length) return false;
    var s = this._buildSteps[this._buildIndex++];
    if (this._onProgress) this._onProgress(s[0], this._buildIndex, this._buildSteps.length);
    s[1](this);
    return this._buildIndex < this._buildSteps.length;
  };

  /* ------------------------------------------------------------------ *
   *  inventory
   * ------------------------------------------------------------------ */

  Game.prototype.count = function (id) { return this.inv[id] || 0; };
  Game.prototype.add = function (id, n) {
    n = n || 1;
    this.inv[id] = (this.inv[id] || 0) + n;
    this.stats.picked += n;
  };
  Game.prototype.remove = function (id, n) {
    n = n || 1;
    this.inv[id] = Math.max(0, (this.inv[id] || 0) - n);
    if (!this.inv[id]) delete this.inv[id];
  };
  Game.prototype.inventoryList = function () {
    var out = [];
    for (var k in this.inv) {
      if (!Object.prototype.hasOwnProperty.call(this.inv, k)) continue;
      if (ER.Items[k] && ER.Items[k].ghost) continue;
      out.push({ id: k, n: this.inv[k] });
    }
    out.sort(function (a, b) { return b.n - a.n; });
    return out;
  };
  Game.prototype.heldItem = function () {
    var st = this.director.currentStep();
    if (st && st.need && st.need.length && this.count(st.need[0])) return st.need[0];
    if (st && st.give && st.give.length && this.count(st.give[0])) return st.give[0];
    var list = this.inventoryList();
    return list.length ? list[0].id : null;
  };

  Game.prototype.junkLine = function (prop) {
    var pool = prop && prop.searchPool ? ER.SearchPools[prop.searchPool] : null;
    var extras = pool && pool.extra ? pool.extra : [];
    if (extras.length && this.rng.chance(0.42)) return this.rng.pick(extras);
    return this.rng.pick(ER.Names.junk);
  };

  /* ------------------------------------------------------------------ *
   *  the residents' view of you
   * ------------------------------------------------------------------ */

  Game.prototype.notoriety = function () {
    var n = this.director.history.length;
    return n < 8 ? 0 : n < 26 ? 1 : n < 62 ? 2 : n < 130 ? 3 : 4;
  };
  Game.prototype.notorietyFor = function (r) {
    var base = this.notoriety();
    if (r.witnessed >= 3) base = Math.min(4, base + 1);
    if (r.seen >= 8) base = Math.min(4, base + 1);
    if (this.director.history.length < 3) base = 0;
    return base;
  };
  Game.prototype.residentOfLot = function (lotId) { return this.peopleByLot[lotId] || null; };
  Game.prototype.metCount = function () {
    var n = 0;
    for (var i = 0; i < this.people.length; i++) if (this.people[i].met) n++;
    return n;
  };
  Game.prototype.discoveredCount = function () {
    var n = 0;
    for (var k in this.discovered) if (Object.prototype.hasOwnProperty.call(this.discovered, k)) n++;
    return n;
  };

  Game.prototype.noteWitnessed = function () {
    var seenBy = 0;
    for (var i = 0; i < this.people.length; i++) {
      var r = this.people[i];
      if (r.away) continue;
      if (U.dist(r.x, r.y, this.player.x, this.player.y) < 26) {
        r.witnessed++; seenBy++;
        if (r.barkCooldown > 8) r.barkCooldown = 3.0;
      }
    }
    if (seenBy) {
      this.stats.witnessed += seenBy;
      this.hud.toast(seenBy === 1 ? 'Somebody saw you do that.' : seenBy + ' people saw you do that.', 'junk');
    }
  };

  Game.prototype.onMetResident = function (r) {
    this.hud.toast('You have met ' + r.name + ', ' + r.age + ', who ' + r.role + '.', 'found');
  };
  Game.prototype.onBark = function () {};

  /* ------------------------------------------------------------------ *
   *  errands
   * ------------------------------------------------------------------ */

  Game.prototype.onErrandIssued = function (q) {
    this.audio.play('issue');
    if (this.director.issued > 1) this.hud.toast('New errand: ' + q.title, 'found');
  };

  Game.prototype.onErrandComplete = function (q) {
    this.audio.play('done');
    var lines = [
      'No one will ever know.',
      'That is done. It changes nothing.',
      'Complete. There is no reward and there was never going to be.',
      'Done. The town is exactly as it was.',
      'Finished. You put it in your pocket.',
      'That is that.',
      'Done, and correctly, which matters to you.'
    ];
    this.hud.flashCard('ERRAND ' + U.commas(q.n) + ' COMPLETE', this.rng.pick(lines));
    this.checkMilestones(this.director.history.length);
  };

  Game.prototype.onErrandAbandoned = function (q) {
    this.audio.play('nope');
    this.hud.flashCard('ERRAND ' + U.commas(q.n) + ' ABANDONED',
      this.rng.pick(['You let it go. It did not resist.',
        'Abandoned. Nothing objects.',
        'You will think about it later, at the sink.']));
  };

  Game.prototype.checkMilestones = function (n) {
    var M = this.milestones;
    if (n >= 10 && !M.m10) {
      M.m10 = 1; this.porchGifts.push('jar_empty');
      this.hud.flashCard('SOMETHING ON YOUR PORCH',
        'A glass jar, clean, left on the step at number 6. No note.');
    }
    if (n >= 25 && !M.m25) {
      M.m25 = 1; this.flags.usual = 1;
      this.hud.flashCard('THE DINER HAS DECIDED', 'You have a usual now. Nobody asked you what it was.');
    }
    if (n >= 50 && !M.m50) {
      M.m50 = 1; this.porchGifts.push('nail_rusted'); this.porchGifts.push('cap_flattened');
      this.hud.flashCard('THEY HAVE STARTED HELPING',
        'A rusted nail and a flattened cap, on the step, in a margarine tub.');
    }
    if (n >= 100 && !M.m100) {
      M.m100 = 1; this.flags.free = 1;
      this.hud.flashCard('DALE HAS STOPPED CHARGING YOU', 'For jars. Only for jars.');
    }
    if (n >= 200 && !M.m200) {
      M.m200 = 1;
      this.hud.flashCard('TWO HUNDRED', 'The quarter has adjusted around you. Nobody remembers it being otherwise.');
    }
  };

  Game.prototype.onClock = function (ev, data) {
    if (ev === 'newday') { this.hud.toast('Day ' + data + ' in the quarter.', 'plain'); ER.Save.write(this); }
    if (ev === 'weather') {
      var labels = { rain: 'It starts raining.', drizzle: 'It starts to spit.',
        storm: 'A storm comes over the section.', fog: 'Fog settles in the low ground.',
        overcast: 'It clouds over.', clear: 'It clears off.', fair: 'It brightens.',
        frost: 'There is frost on everything.' };
      if (labels[data]) this.hud.toast(labels[data], 'plain');
    }
    if (ev === 'hour') {
      if (data === 12) {
        this.audio.play('siren');
        this.hud.toast('The chapel bell, twelve times.', 'plain');
      }
      if (data === 7 || data === 15) this.audio.play('bell');
    }
  };

  Game.prototype.lampOn = function (lamp) {
    var l = this.clock.daylight();
    if (l > 0.42) return false;
    if (lamp.dying) return Math.sin(this.t * 11 + lamp.phase) > -0.55;
    return true;
  };

  /* ------------------------------------------------------------------ *
   *  step state for the HUD
   * ------------------------------------------------------------------ */

  Game.prototype.currentTargets = function () {
    var st = this.director.currentStep();
    if (!st) return [];
    var out = [];
    if (st.kind === 'photoset') return st.targets.slice();
    if (st.kind === 'walk') {
      var pg = this.director.progress;
      var idx = pg ? pg.i : 0;
      if (st.waypoints[idx]) out.push(st.waypoints[idx]);
      return out;
    }
    if (st.kind === 'photo' && st.target !== 'SELF') out.push(st.target);
    if (typeof st.at === 'string' && st.at !== 'ANY' && st.at !== 'HOME') out.push(st.at);
    if (st.at === 'HOME') out.push('home_windowsill');
    if (st.at && typeof st.at === 'object' && st.at.tag) {
      var best = null, bd = Infinity;
      for (var i = 0; i < this.town.propList.length; i++) {
        var pr = this.town.propList[i];
        if (pr.tags.indexOf(st.at.tag) < 0) continue;
        var d = U.dist2(this.player.x, this.player.y, pr.x, pr.y);
        if (d < bd) { bd = d; best = pr.id; }
      }
      if (best) out.push(best);
    }
    return out;
  };

  Game.prototype.stepBlocker = function () {
    var st = this.director.currentStep();
    if (!st) return null;
    var d = this.director;
    if (!d.dayOk(st)) return 'not until tomorrow';
    if (!d.timeOk(st)) return 'only ' + (st.when.label || 'at the right time') + ' — it is ' + this.clock.timeString();
    if (!d.weatherOk(st)) return 'needs ' + U.list(st.weather, 'or') + ' — it is ' + this.clock.weatherLabel();
    if (!d.itemsOk(st)) {
      var missing = [], counts = {};
      for (var i = 0; i < st.need.length; i++) {
        counts[st.need[i]] = (counts[st.need[i]] || 0) + 1;
        if (this.count(st.need[i]) < counts[st.need[i]] && missing.indexOf(st.need[i]) < 0) missing.push(st.need[i]);
      }
      return 'you need ' + U.list(missing.map(ER.itemName));
    }
    return null;
  };

  Game.prototype.stepProgressText = function () {
    var st = this.director.currentStep(), pg = this.director.progress;
    if (!st) return null;
    if (st.kind === 'gather') return (pg ? pg.got : 0) + ' of ' + st.n + ' so far';
    if (st.kind === 'search' && pg && pg.tries) return pg.tries + ' attempt' + (pg.tries > 1 ? 's' : '') + ' so far';
    if (st.kind === 'photoset') return ((pg && pg.done) ? pg.done.length : 0) + ' of ' + st.targets.length + ' photographed';
    if (st.kind === 'walk') return ((pg ? pg.i : 0)) + ' of ' + st.waypoints.length + ' markers';
    if (st.kind === 'wait' && pg && pg.t) return Math.floor(pg.t) + ' of ' + st.seconds + ' seconds';
    return null;
  };

  /* ------------------------------------------------------------------ *
   *  what you are looking at
   * ------------------------------------------------------------------ */

  Game.prototype.pickProp = function () {
    var st = this.director.currentStep();
    var wanted = st && typeof st.at === 'string' && st.at !== 'ANY' && st.at !== 'HOME' ? st.at : null;

    /* if the errand wants a place you are standing in, that takes priority */
    if (wanted) {
      var wp = this.town.props[wanted];
      if (wp && wp.rect && this.town.inProp(wp, this.player.x, this.player.y, 0)) return wp;
    }
    var hit = this.view.pick(this.scene.raycastTargets, null, wanted);
    if (hit) {
      var p = this.town.props[hit.propId];
      if (p) return p;
    }
    /* Last resort: something you are practically standing on. The pointer
       has first call, but it can be nowhere near anything, and the errands
       assume that being at a prop's own stand point is enough to touch it.

       The reach is the prop's own extent plus an arm's length, not a flat
       cap. The first-person version had to work this out the hard way: a hit
       volume was a sphere of clamp(r, 0.6, 3.2) and a tighter cap put the
       widest props out of reach exactly when you were standing on them.
       From above the geometry is simpler, but the rule is the same one. */
    var near = this.town.propAt(this.player.x, this.player.y, wanted);
    if (near && near.rect) return near;
    if (near) {
      var pos = this.town.propPos(near);
      var reach = Math.min(near.r === undefined ? 0.8 : near.r, 3.2) + ER.REACH;
      if (U.dist(this.player.x, this.player.y, pos.x, pos.y) <= reach) return near;
    }
    return null;
  };

  Game.prototype.promptText = function () {
    if (this.mode !== 'play') return null;
    var prop = this.looking;
    var st = this.director.currentStep();

    if (st && (st.kind === 'photo' || st.kind === 'photoset')) return { key: 'C', text: 'Camera', actionable: true };
    if (st && st.kind === 'edit') return { key: 'J', text: 'Journal — the photograph needs editing', actionable: true };
    if (st && st.kind === 'wait') {
      if (this.director.placeOk(st, prop)) {
        var blk = this.stepBlocker();
        if (blk) return { key: 'Z', text: U.cap(blk), sub: 'linger to pass the time', blocked: true };
        return { key: '·', text: ER.verbInfo(st.verb).ing + ' — stand still', actionable: true };
      }
    }
    if (st && st.kind === 'walk') {
      return { key: '·', text: 'Walk it' + (st.noRun ? ' — and do not run' : ''), actionable: true };
    }

    var offer = this.director.offerAt(prop);
    if (offer) {
      if (offer.decoy) return { key: 'E', text: 'Look at it', blocked: true };
      if (offer.reason) return { key: 'E', text: U.cap(offer.reason), blocked: true };
      return { key: 'E', text: offer.label, sub: prop ? prop.name.replace(/^the /, '') : null, actionable: true };
    }
    if (this.porchGifts.length && prop && prop.id === 'home_porch') {
      return { key: 'E', text: 'Pick up what somebody left', actionable: true };
    }
    if (prop) {
      var verb = prop.verbs && prop.verbs.length ? prop.verbs[0] : 'LOOK';
      return { key: 'E', text: ER.verbInfo(verb).label, sub: prop.name.replace(/^the /, '') };
    }
    return null;
  };

  Game.prototype.flavour = function (prop) {
    if (!prop) return null;
    var g = prop.grave;
    if (g) {
      return g.first + ' ' + g.last + ', ' + g.born + '–' + g.died +
        (g.epitaph ? '. ' + g.epitaph + '.' : '.') +
        (g.lichen > 0.6 ? ' The lichen has most of it.' : '');
    }
    if (prop.lot) {
      var res = this.peopleByLot[prop.lot];
      if (res && prop.tags.indexOf('mailbox') >= 0)
        return res.met ? res.name + ' lives here.' : 'Somebody lives here. You have not met them.';
      if (prop.tags.indexOf('car') >= 0) return 'Unlocked, probably. Everything here is.';
      if (prop.tags.indexOf('dish') >= 0) return 'Still pointed where the installer left it.';
    }
    if (prop.searchPool) {
      var pool = ER.SearchPools[prop.searchPool];
      return 'You could go through ' + (pool ? pool.label : 'it') + '. There is no reason to.';
    }
    if (prop.shop) return 'You do not need anything.';
    return this.rng.pick([
      'You look at it for a while.', 'It is exactly what it is.',
      'Nothing about it has changed since yesterday.',
      'You note it, for no purpose.', 'It will still be here.',
      'You have looked at this before.'
    ]);
  };

  Game.prototype.tryAct = function (dt) {
    var inp = this.input;
    var prop = this.looking;
    var offer = this.director.offerAt(prop);

    if (inp.was('act')) {
      if (offer && offer.decoy) {
        this.hud.toast(offer.decoy, 'junk');
        this.audio.play('nope');
        this.holdT = 0; this.holdMax = 0;
        return;
      }
      if (offer && offer.reason) {
        this.hud.toast(U.cap(offer.reason) + '.', 'junk');
        this.audio.play('nope');
        return;
      }
      if (!offer) {
        if (this.porchGifts.length && prop && prop.id === 'home_porch') {
          for (var gi = 0; gi < this.porchGifts.length; gi++) this.add(this.porchGifts[gi], 1);
          this.hud.toast('You take it inside. You do not know who left it.', 'found');
          this.porchGifts = [];
          this.audio.play('found');
          return;
        }
        var fl = this.flavour(prop);
        if (fl) { this.hud.toast(fl, 'plain'); this.audio.play('set'); }
        return;
      }
    }

    if (!offer || offer.reason || offer.decoy) {
      this.holdT = 0; this.holdMax = 0; this.holdProp = null;
      this.view.setActing(0);
      return;
    }

    if (inp.is('act')) {
      var id = prop ? prop.id : 'ANY';
      if (this.holdProp !== id) { this.holdT = 0; this.holdProp = id; }
      this.holdMax = offer.hold || 2;
      this.holdT += dt;
      this.view.setActing(this.holdT / this.holdMax, offer.verb);
      var vi = ER.verbInfo(offer.verb);
      this._sfxAcc = (this._sfxAcc || 0) + dt;
      if (vi.sfx && this._sfxAcc > 0.3) { this._sfxAcc = 0; this.audio.play(vi.sfx); }
      if (this.holdT >= this.holdMax) {
        this.holdT = 0;
        var res = this.director.perform(prop);
        if (res && res.message) this.hud.toast(res.message, res.found ? 'found' : res.junk ? 'junk' : 'plain');
        if (res && res.found) this.audio.play('found');
        if (res && res.shop) this.audio.play('till');
        if (res && !res.ok && res.message) this.audio.play('nope');
      }
    } else {
      this.holdT = Math.max(0, this.holdT - dt * 2.6);
      this.view.setActing(this.holdT / Math.max(0.001, this.holdMax));
    }
  };

  /* ------------------------------------------------------------------ *
   *  photographs
   * ------------------------------------------------------------------ */

  Game.prototype.framedTargets = function () { return this.view.framed(this.scene, 80); };

  Game.prototype.shoot = function () {
    var cv = this.view.snapshot(this.photoSize.w, this.photoSize.h);
    var framed = this.framedTargets();
    var label = framed.length ? this.town.props[framed[0]].name.replace(/^the /, '') : 'nothing in particular';
    var photo = {
      canvas: cv, label: label + ', day ' + this.clock.day,
      filter: null, targetsInFrame: framed, self: true,
      shadowBearing: this.clock.shadowBearing(),
      day: this.clock.day, at: this.clock.timeString()
    };
    this.audio.play('shutter');
    var res = this.director.tookPhoto(photo);
    this.photos.push(photo);
    this.photoSel = this.photos.length - 1;
    this.reviewPhoto = photo;
    this.mode = 'review';
    this.exitLook();
    if (res && res.message) this.hud.toast(res.message, res.ok ? 'found' : 'junk');
    if (res && !res.ok) this.audio.play('nope');
  };

  ER.applyBW = function (canvas) {
    var c = canvas.getContext('2d');
    var d = c.getImageData(0, 0, canvas.width, canvas.height);
    var p = d.data;
    for (var i = 0; i < p.length; i += 4) {
      var l = (p[i] * 0.299 + p[i + 1] * 0.587 + p[i + 2] * 0.114) / 255;
      l = U.clamp((l - 0.5) * 2.4 + 0.5, 0, 1);
      l = l * l * (3 - 2 * l);
      var v = l * 255;
      p[i] = v; p[i + 1] = v; p[i + 2] = v;
    }
    c.putImageData(d, 0, 0);
    return canvas;
  };

  /* ------------------------------------------------------------------ *
   *  modes
   * ------------------------------------------------------------------ */

  /* Looking around used to mean pointer lock. From above there is nothing to
     lock: the mouse is a pointer, and the map, the journal and the viewfinder
     all want it back. Kept as no-ops because the mode changes call them. */
  Game.prototype.exitLook = function () {};
  Game.prototype.enterLook = function () {};

  Game.prototype.handleKeys = function () {
    var inp = this.input;

    if (inp.was('hints')) {
      this.hud.showHints = !this.hud.showHints;
      this.hud.hintT = this.hud.showHints ? 12 : 0;
      this.hud.hints.classList.remove('faded');
    }

    if (this.mode === 'review') {
      if (inp.was('one') && this.reviewPhoto && this.reviewPhoto.filter !== 'bw') {
        ER.applyBW(this.reviewPhoto.canvas);
        this.reviewPhoto.filter = 'bw';
        var r = this.director.editedPhoto(this.reviewPhoto, 'bw');
        if (r && r.message) this.hud.toast(r.message, r.ok ? 'found' : 'plain');
        this.audio.play(r && r.ok ? 'found' : 'paper');
      }
      if (inp.was('enter') || inp.was('escape') || inp.was('camera')) {
        this.reviewPhoto = null; this.mode = 'play'; this.enterLook();
      }
      if (inp.was('back')) {
        var idx = this.photos.indexOf(this.reviewPhoto);
        if (idx >= 0) this.photos.splice(idx, 1);
        this.photoSel = Math.max(0, this.photos.length - 1);
        this.reviewPhoto = null; this.mode = 'play'; this.enterLook();
      }
      return;
    }

    if (this.mode === 'camera') {
      if (inp.was('shoot')) this.shoot();
      if (inp.was('camera') || inp.was('escape')) this.mode = 'play';
      return;
    }

    if (this.mode === 'map') {
      if (inp.was('map') || inp.was('escape')) { this.mode = 'play'; this.enterLook(); }
      return;
    }

    if (this.mode === 'journal') {
      if (inp.was('journal') || inp.was('escape')) { this.mode = 'play'; this.enterLook(); }
      if (inp.is('up')) this.journalScroll = Math.max(0, this.journalScroll - 12);
      if (inp.is('down')) this.journalScroll += 12;
      if (inp.was('left')) { this.photoSel = Math.max(0, this.photoSel - 1); this.hud._journalStamp = null; }
      if (inp.was('right')) { this.photoSel = Math.min(this.photos.length - 1, this.photoSel + 1); this.hud._journalStamp = null; }
      if (inp.was('one') && this.photos[this.photoSel] && this.photos[this.photoSel].filter !== 'bw') {
        var ph = this.photos[this.photoSel];
        ER.applyBW(ph.canvas);
        ph.filter = 'bw';
        this.hud._journalStamp = null;
        var res = this.director.editedPhoto(ph, 'bw');
        if (res && res.message) this.hud.toast(res.message, res.ok ? 'found' : 'plain');
        this.audio.play(res && res.ok ? 'found' : 'paper');
      }
      return;
    }

    /* playing */
    if (inp.was('map')) { this.mode = 'map'; this.exitLook(); return; }
    if (inp.was('journal')) { this.mode = 'journal'; this.journalScroll = 0; this.hud._journalStamp = null; this.exitLook(); return; }
    if (inp.was('camera')) { this.mode = 'camera'; return; }
    if (inp.was('abandon')) this.director.abandon();
  };

  /* ------------------------------------------------------------------ *
   *  the loop
   * ------------------------------------------------------------------ */

  Game.prototype.update = function (dt) {
    this.t += dt;
    this.handleKeys();

    var lingering = false;
    if (this.mode === 'play' || this.mode === 'camera') {
      var moveRes = this.view.move(dt, this.input, this);
      this.player.x = this.view.pos.x;
      this.player.y = this.view.pos.z;
      this.player.moving = this.view.moving;
      this.player.running = this.view.running;
      this.player.facing = -this.view.yaw + Math.PI / 2;
      this.stats.walked += moveRes.moved;

      if (this.view.moving) {
        this.stepAcc += this.view.speedNow * dt;
        if (this.stepAcc > (this.view.running ? 1.55 : 1.08)) {
          this.stepAcc = 0;
          this.audio.step(this.town.terrainAt(this.player.x, this.player.y), this.clock.wet);
        }
      }

      this.looking = this.pickProp();
      lingering = this.input.is('linger') && !this.view.moving;
      if (lingering) this.stats.lingered += dt * LINGER;
      if (this.mode === 'play') this.tryAct(dt);
    }

    this.clock.advance(dt, lingering ? LINGER : 1);

    if (this.mode === 'play') {
      var w = this.director.waitTick(dt, this.looking, this.view.moving);
      if (w && w.done) this.audio.play('done');
      var wk = this.director.walkTick(this.player.x, this.player.y, this.view.running);
      if (wk && wk.fault) this.hud.toast(wk.fault, 'junk');
      if (wk && wk.reached) this.audio.play('set');
    }

    /* places you have walked up to are places you know about */
    var near = this.town.propsNear(this.player.x, this.player.y, 24);
    for (var i = 0; i < near.length; i++) {
      if (near[i].landmark && !this.discovered[near[i].id]) {
        this.discovered[near[i].id] = 1;
        this.hud.toast('Found: ' + near[i].name, 'plain');
      }
    }

    ER.updateResidents(this.people, this.town, this.clock, dt, this.player, this);

    /* --- world state --- */
    /* One call. The light, the shadow bearing, the lamps coming on, the rain
       and the swell all come out of the clock, and the scene reads them when
       it draws. */
    this.scene.update(this, dt);
    this.view.setHeld(this.mode === 'camera' ? 'photo' : this.heldItem());

    this.hud.update(dt);
    this.audio.ambience(this.clock, dt, this.town, this.player);

    this.saveTimer += dt;
    if (this.saveTimer > 25) { this.saveTimer = 0; ER.Save.write(this); }

    this.input.endFrame();
  };

  Game.prototype.render = function () {
    this.view.render();
    this.hud.draw();
    if (this.mode === 'play') {
      this.hud.drawBubbles(this.scene.bubblePositions(this.people, this.view));
    } else this.hud.bubbles.innerHTML = '';
  };

  /* ------------------------------------------------------------------ *
   *  the line the journal keeps about you
   * ------------------------------------------------------------------ */

  Game.prototype.selfAssessment = function () {
    var n = this.director.history.length;
    if (n === 0) return 'You have been here less than a day. Nothing is wrong.';
    if (n < 8) return 'You have started keeping things in your coat pockets.';
    if (n < 26) return 'You know which of the five hydrants is worst. You did not set out to know that.';
    if (n < 62) return 'You have stopped explaining. It was taking longer than the errands.';
    if (n < 130) return 'You could draw this town from memory, including the parts nobody looks at.';
    if (n < 240) return 'The residents have stopped asking. Two of them help. You are not sure when that started.';
    return 'There is no version of this that ends. You have made peace with the arrangement.';
  };

  /* ------------------------------------------------------------------ *
   *  saving
   * ------------------------------------------------------------------ */

  Game.prototype.loadFrom = function (d) {
    if (!d) return false;
    this.clock.load(d.clock);
    if (d.player) {
      this.view.pos.x = d.player.x;
      this.view.pos.z = d.player.y;
      this.view.pos.y = this.town.heightAt(d.player.x, d.player.y);
      this.view.yaw = d.player.yaw !== undefined ? d.player.yaw : Math.PI;
      this.player.x = d.player.x; this.player.y = d.player.y;
    }
    this.inv = d.inv || {};
    this.stats = d.stats || this.stats;
    this.discovered = d.discovered || {};
    this.milestones = d.milestones || {};
    if (d.people) {
      var byId = {};
      for (var i = 0; i < this.people.length; i++) byId[this.people[i].id] = this.people[i];
      for (var j = 0; j < d.people.length; j++) {
        var s = d.people[j], r = byId[s.id];
        if (r) { r.seen = s.seen || 0; r.met = !!s.met; r.witnessed = s.witnessed || 0; }
      }
    }
    this.director.load(d.director);
    if (!this.director.active) this.director.issue();
    return true;
  };

  Game.prototype.begin = function (fresh) {
    var saved = fresh ? null : ER.Save.read();
    if (saved && saved.seed === this.seedStr) {
      this.loadFrom(saved);
      this.hud.toast('You are still here. Day ' + this.clock.day + '.', 'plain');
    } else {
      this.director.issue();
      this.hud.flashCard('BATROUN · EL QADIM · POP. 30',
        'You have the back room at number 6, month to month. There is no reason for you to be here.');
    }
  };

  ER.Game = Game;
})(typeof window !== 'undefined' ? (window.ER = window.ER || {}) : (global.ER = global.ER || {}));
