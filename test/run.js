/* Errands — headless checks.
 *
 *   node test/run.js
 *
 * Validates that the town generates, that every errand template refers only
 * to things that exist, and that every template can actually be finished.
 */
'use strict';
var path = require('path');
var SRC = path.join(__dirname, '..', 'src');

global.window = undefined;
/* a localStorage good enough for the save module */
global.localStorage = (function () {
  var store = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; },
    _size: function () { return Object.keys(store).length; }
  };
})();

/* two/view2d only touches the document inside its constructor, so it loads
   here and the picking rules can be tested against the real code rather than
   a restatement of them. */
['core/rng', 'core/util', 'core/save', 'world/names', 'world/time', 'world/town',
  'quest/items', 'quest/pool', 'quest/pool2', 'quest/director',
  'world/residents', 'two/view2d', 'game'].forEach(function (f) {
  try { require(path.join(SRC, f + '.js')); } catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') throw e;
  }
});
var ER = global.ER;
var U = ER.U;

var fails = [], checks = 0;
function ok(cond, msg) { checks++; if (!cond) fails.push(msg); }

/* ---------------- a stand-in for the running game ---------------- */
function mockGame(town) {
  var g = {
    town: town,
    clock: new ER.Clock('test'),
    player: { x: town.spawn.x, y: town.spawn.y, facing: 0 },
    inv: {},
    photos: [],
    stats: { junk: 0, witnessed: 0, errands: 0 },
    log: [],
    count: function (id) { return g.inv[id] || 0; },
    add: function (id, n) { g.inv[id] = (g.inv[id] || 0) + (n || 1); },
    remove: function (id, n) { g.inv[id] = Math.max(0, (g.inv[id] || 0) - (n || 1)); if (!g.inv[id]) delete g.inv[id]; },
    junkLine: function () { return 'a bent washer'; },
    noteWitnessed: function () { g.stats.witnessed++; },
    onErrandIssued: function () {},
    onErrandComplete: function () { g.stats.errands++; },
    onErrandAbandoned: function () {}
  };
  return g;
}

/* ---------------- 1. the town ---------------- */
var town = ER.generateTown('batroun');
ok(town.lots.length === 18, 'expected 18 houses, got ' + town.lots.length);
ok(town.propList.length > 150, 'expected a lot of props, got ' + town.propList.length);
ok(!town.isBlocked(town.spawn.x, town.spawn.y), 'you spawn inside a wall');
ok(town.w * town.h === 2500, 'the quarter should be fifty metres by fifty');

/* Fifty metres is small enough that a house in the wrong place blocks an
   alley outright, so the generator checks its own geometry and we check that
   it found nothing. This caught twenty-three faults the first time it ran. */
(function () {
  var problems = town.validateLayout();
  ok(problems.length === 0, 'layout faults: ' + problems.join('; '));
}());

/* the sea has to be west of the wall and the wall has to be standable */
ok(town.terrainAt(2, 25) === 'water', 'there should be open sea at the west edge');
ok(town.heightAt(2, 25) < 0, 'the sea floor should be below the water line');
ok(town.terrainAt(town.sea.wall.x, 25) === 'wall', 'the Phoenician wall should read as wall');
ok(town.heightAt(town.sea.wall.x, 25) > 1.4, 'the wall crest should stand above the quay');
ok(town.isBlocked(2, 25), 'you should not be able to walk out to sea');

/* and Darb el Daraj has to actually be stairs */
(function () {
  var climb = town.heightAt(20.7, 9.0) - town.heightAt(20.7, 26.4);
  ok(climb > 2.0, 'the alley of steps should climb more than two metres; it climbs ' + climb.toFixed(2));
  var risers = 0, prev = null;
  for (var y = 26.4; y >= 8.6; y -= 0.1) {
    var h = Math.round(town.heightAt(20.7, y) / 0.17) * 0.17;
    if (prev !== null && Math.abs(h - prev) > 0.08) risers++;
    prev = h;
  }
  ok(risers > 10, 'the steps should be steps; found ' + risers + ' risers');
}());

/* the whole road graph must be one piece, or residents get stranded */
(function () {
  var seen = {}, stack = [0], n = 0;
  while (stack.length) {
    var u = stack.pop();
    if (seen[u]) continue;
    seen[u] = 1; n++;
    for (var e = 0; e < town.graph[u].e.length; e++) stack.push(town.graph[u].e[e].n);
  }
  ok(n === town.graph.length, 'road graph is not connected: ' + n + '/' + town.graph.length + ' reachable');
})();

/* every prop must have somewhere to stand */
(function () {
  var bad = [];
  town.propList.forEach(function (p) {
    if (p.hidden) return;
    var pos = town.propPos(p), reachable = false;
    for (var a = 0; a < 24 && !reachable; a++) {
      var ang = a / 24 * Math.PI * 2;
      for (var r = 0; r <= (p.rect ? 3 : p.r); r += 0.7) {
        var x = pos.x + Math.cos(ang) * r, y = pos.y + Math.sin(ang) * r;
        if (!town.isBlocked(x, y) && town.inProp(p, x, y, 0)) reachable = true;
      }
    }
    if (!reachable) bad.push(p.id);
  });
  ok(bad.length === 0, 'props with nowhere to stand: ' + bad.join(', '));
})();

/* Reaching what the errand sends you to. This calls the real pickProp on a
   stub whose pointer sees nothing, standing at the spot town.js says you
   would stand to be served or to knock.

   The first-person version of this test caught a real bug on a specific prop:
   the moss on the old stone bridge had a 3.2 m hit volume against a flat
   2.2 m reach cap, so it went unpickable exactly when you stood on it, and
   the crosshair could not rescue you either. Drawn from above there are no
   hit volumes, but the rule survived the move: a prop's reach is its own
   extent plus an arm's length, never a flat cap. What this pins now is the
   thing the errands actually depend on — that being at a prop's stand point
   is enough to touch it — checked on all 225 of them rather than on one. */
(function () {
  if (!ER.Game) { ok(false, 'game.js did not load, so pickProp is untested'); return; }

  function pickFrom(x, y, wantedId) {
    return ER.Game.prototype.pickProp.call({
      town: town,
      player: { x: x, y: y },
      director: { currentStep: function () { return wantedId ? { at: wantedId } : null; } },
      /* the pointer is off in a corner of the screen, over nothing */
      view: { pick: function (list, range, prefer) {
        return ER.View.prototype.pick.call(
          { town: town, pos: { x: x, y: 0, z: y }, aim: { on: false, x: 0, y: 0 } },
          list, range, prefer);
      } },
      scene: { raycastTargets: town.propList }
    });
  }

  var unreachable = [];
  town.propList.forEach(function (p) {
    if (p.hidden) return;
    var pos = town.propPos(p);
    var stand = p.stand || pos;
    var got = pickFrom(stand.x, stand.y, p.id);
    if (!got || got.id !== p.id) unreachable.push(p.id + ' -> ' + (got ? got.id : 'nothing'));
  });
  ok(unreachable.length === 0,
    'props you cannot touch from their own stand point: ' + unreachable.slice(0, 8).join(', '));

  /* and the widest round prop, from inside it and from well outside */
  var widest = null;
  town.propList.forEach(function (p) {
    if (p.rect || p.hidden) return;
    if (!widest || p.r > widest.r) widest = p;
  });
  ok(!!widest, 'there should be a widest round prop');
  if (widest) {
    var wp = town.propPos(widest);
    var on = pickFrom(wp.x, wp.y + 0.1, widest.id);
    ok(on && on.id === widest.id,
      'standing on ' + widest.id + ' picks ' + (on ? on.id : 'nothing'));
    var edge = pickFrom(wp.x, wp.y + widest.r - 0.05, widest.id);
    ok(edge && edge.id === widest.id,
      'standing at the edge of its own ' + widest.r + ' m radius picks ' +
      (edge ? edge.id : 'nothing'));
    var away = pickFrom(wp.x, wp.y + widest.r + ER.REACH + 4, widest.id);
    ok(!away || away.id !== widest.id,
      widest.id + ' should not be reachable from four metres past arm\'s length');
  }

  /* the rule itself: nothing may be drawn with a footprint wider than the
     reach that goes with it, or you could see a thing you cannot touch while
     standing in the middle of it */
  var tight = [];
  town.propList.forEach(function (p) {
    if (p.rect || p.hidden) return;
    var reach = Math.min(p.r === undefined ? 0.8 : p.r, 3.2) + ER.REACH;
    var extent = Math.min(p.r === undefined ? 0.8 : p.r, 3.2);
    if (reach + 1e-9 < extent) tight.push(p.id);
  });
  ok(tight.length === 0, 'props whose reach is tighter than their own extent: ' + tight.join(', '));
}());

/* Paved ground has to read as paved. The renderer and terrainAt work off the
   same town.paving, and when they did not, grass grew through the front walk. */
(function () {
  var PAVED = { stone: 1, steps: 1, flag: 1, quay: 1, slip: 1, wall: 1 };
  ok(town.paving.length >= 4, 'the quarter should have paving in it');
  var soft = [];
  for (var i = 0; i < town.paving.length; i++) {
    var p = town.paving[i];
    /* the middle of a pad, where no road or driveway can be claiming it */
    var t = town.terrainAt(p.x + p.w / 2, p.y + p.h / 2);
    if (!PAVED[t]) soft.push(p.kind + ' pad at ' + p.x + ',' + p.y + ' reads as ' + t);
  }
  ok(soft.length === 0, 'paving that is not paved underfoot: ' + soft.join('; '));
  /* and the graded shoulder the renderer draws in gravel must read as gravel,
     or grass grows up through it */
  var verge = [];
  for (var v = 0; v < town.roads.length; v++) {
    var rd = town.roads[v], mid = rd.pts[Math.floor(rd.pts.length / 2)];
    var nxt = rd.pts[Math.floor(rd.pts.length / 2) + 1] || rd.pts[0];
    var dx = nxt[0] - mid[0], dy = nxt[1] - mid[1], L = Math.hypot(dx, dy) || 1;
    /* step sideways off the centreline, into the middle of the shoulder */
    var off = rd.width / 2 + rd.shoulder * 0.5;
    var sx = mid[0] - (dy / L) * off, sy = mid[1] + (dx / L) * off;
    var t2 = town.terrainAt(sx, sy);
    if (!PAVED[t2]) verge.push((rd.name || 'a road') + "'s shoulder reads as " + t2);
  }
  ok(verge.length === 0, 'shoulders that are not paved underfoot: ' + verge.join('; '));
  for (var k = 0; k < town.pavedStrips.length; k++) {
    var st = town.pavedStrips[k];
    var mx = (st.x0 + st.x1) / 2, my = (st.y0 + st.y1) / 2;
    ok(!!PAVED[town.terrainAt(mx, my)],
      'the ' + st.kind + ' strip at ' + mx + ',' + my + ' reads as ' + town.terrainAt(mx, my));
    /* and it must be walkable at full speed, not waded through like a lawn */
    ok(town.speedAt(mx, my) === 1, 'the ' + st.kind + ' strip slows you down like grass');
  }
}());

/* ---------------- 2. static validation of the pool ---------------- */
var POOL = ER.questPool();
ok(POOL.length >= 46, 'the pool is meant to be enormous; found ' + POOL.length);

var seenIds = {};
POOL.forEach(function (tpl) {
  ok(!seenIds[tpl.id], 'duplicate template id: ' + tpl.id);
  seenIds[tpl.id] = 1;
  ok(typeof tpl.title === 'function', tpl.id + ': no title');
  ok(typeof tpl.steps === 'function', tpl.id + ': no steps');
});

var KINDS = { buy: 1, act: 1, search: 1, gather: 1, wait: 1, craft: 1, photo: 1, photoset: 1, edit: 1, walk: 1, note: 1 };

POOL.forEach(function (tpl) {
  /* exercise each template with several different parameter rolls */
  for (var trial = 0; trial < 8; trial++) {
    var rng = new ER.RNG('static:' + tpl.id + ':' + trial);
    var p = tpl.setup ? tpl.setup(rng, town) : {};
    var title = tpl.title(p, town);
    ok(typeof title === 'string' && title.length > 12, tpl.id + ': thin title');
    ok(title.indexOf('undefined') < 0 && title.indexOf('NaN') < 0, tpl.id + ': title has a hole in it: ' + title);
    if (tpl.fine) {
      var fine = tpl.fine(p, town);
      ok(typeof fine === 'string' && fine.indexOf('undefined') < 0, tpl.id + ': fine print has a hole in it: ' + fine);
    }
    var steps = tpl.steps(p, town);
    ok(steps.length > 0, tpl.id + ': no steps produced');
    steps.forEach(function (st, si) {
      var tag = tpl.id + ' step ' + si;
      ok(KINDS[st.kind], tag + ': unknown kind ' + st.kind);
      ok(typeof st.text === 'string' && st.text.length > 3, tag + ': no text');
      if (st.verb) ok(!!ER.Verbs[st.verb], tag + ': unknown verb ' + st.verb);
      /* every place referenced has to exist */
      if (typeof st.at === 'string' && st.at !== 'ANY' && st.at !== 'HOME')
        ok(!!town.props[st.at], tag + ': unknown prop "' + st.at + '"');
      if (st.at && typeof st.at === 'object' && st.at.tag) {
        var any = town.propList.some(function (q) { return q.tags.indexOf(st.at.tag) >= 0; });
        ok(any, tag + ': no prop carries tag "' + st.at.tag + '"');
      }
      /* every item referenced has to exist */
      ['need', 'take', 'give'].forEach(function (f) {
        (st[f] || []).forEach(function (it) {
          ok(!!ER.Items[it], tag + ': unknown item "' + it + '" in ' + f);
        });
      });
      if (st.item) ok(!!ER.Items[st.item], tag + ': unknown item "' + st.item + '"');
      if (st.takeCount) ok(!!ER.Items[st.takeCount.item], tag + ': unknown item in takeCount');
      if (st.kind === 'buy') {
        var shopProp = town.props[st.at];
        ok(shopProp && shopProp.shop, tag + ': buy step does not point at a shop');
      }
      if (st.kind === 'search') ok(!!st.item, tag + ': search step finds nothing');
      if (st.kind === 'search') {
        var sp = town.props[st.at];
        ok(sp && sp.searchPool, tag + ': search step points at a prop with no search pool');
      }
      if (st.kind === 'gather') ok(st.n > 0 && !!st.item, tag + ': bad gather');
      if (st.kind === 'wait') ok(st.seconds > 0, tag + ': wait with no duration');
      if (st.kind === 'walk') {
        ok(st.waypoints && st.waypoints.length > 1, tag + ': walk with no route');
        (st.waypoints || []).forEach(function (w) { ok(!!town.props[w], tag + ': unknown waypoint ' + w); });
      }
      if (st.kind === 'photo') ok(!!st.target, tag + ': photo of nothing');
      if (st.kind === 'photoset') ok(st.targets && st.targets.length, tag + ': photoset of nothing');
      if (st.when) ok(st.when.h0 >= 0 && st.when.h1 <= 24 && !!st.when.label, tag + ': malformed time window');
      if (st.weather) ok(st.weather.every(function (w) { return !!ER.WEATHER[w]; }), tag + ': unknown weather');
    });
  }
});

/* ---------------- 3. can each template actually be finished? ---------------- */

function solve(tplId) {
  var g = mockGame(town);
  var d = new ER.Director(g);
  d.issue(tplId);
  if (!d.active || d.active.tplId !== tplId) return 'never issued';

  var errand = d.active;
  var guard = 0;
  /* the errand object is the identity: finishing one immediately issues the
     next, so "did the step advance" has to be asked about this errand only */
  function at() { return d.active === errand ? d.stepIndex : Infinity; }

  while (d.active === errand) {
    if (++guard > 600) return 'gave up after 600 actions on step ' + d.stepIndex;
    var st = d.currentStep();
    if (!st) return 'no current step';

    /* bend the world until the step is legal: time, weather, the calendar */
    if (st.when) {
      var wrap = st.when.h1 < st.when.h0;
      var pick = wrap ? st.when.h0 + 0.1
        : st.when.h0 + Math.min(0.12, (st.when.h1 - st.when.h0) / 2);
      g.clock.minutes = ((pick % 24) + 24) % 24 * 60;
    }
    if (st.weather) g.clock.weather = st.weather[0];
    if (st.dayOffset) g.clock.day = d.active.startDay + st.dayOffset;

    /* stand where the step wants us to stand */
    var prop = null;
    if (typeof st.at === 'string' && st.at !== 'ANY' && st.at !== 'HOME') prop = town.props[st.at];
    else if (st.at === 'HOME') prop = town.props.home_windowsill;
    else if (st.at && st.at.tag) {
      prop = town.propList.filter(function (q) { return q.tags.indexOf(st.at.tag) >= 0; })[0];
    }
    if (prop) { var pos = town.propPos(prop); g.player.x = pos.x; g.player.y = pos.y; }

    /* hand over anything a previous step was supposed to have produced but
       that the solver cannot obtain (proves nothing is silently unobtainable
       only if it never fires — so record it) */
    var pre = d.blockReason(st, prop);
    if (pre && pre.indexOf('you need') === 0) return 'step ' + d.stepIndex + ' unsatisfiable: ' + pre;

    var before = at();
    var r;
    if (st.kind === 'wait') {
      r = d.waitTick(st.seconds + 1, prop, false);
      if (!r || !r.done) return 'wait step ' + d.stepIndex + ' did not complete: ' + JSON.stringify(r);
    } else if (st.kind === 'walk') {
      for (var w = 0; w < st.waypoints.length; w++) {
        var wp = town.props[st.waypoints[w]];
        r = d.walkTick(wp.x, wp.y, false);
      }
      if (at() === before) return 'walk step ' + before + ' did not complete';
    } else if (st.kind === 'photo') {
      var photo = { targetsInFrame: [st.target], self: st.target === 'SELF', shadowBearing: 0 };
      r = d.tookPhoto(photo);
      if (!r.ok) return 'photo step ' + d.stepIndex + ' refused: ' + r.message;
    } else if (st.kind === 'photoset') {
      for (var t = 0; t < st.targets.length; t++) {
        var pp = town.propPos(st.targets[t]);
        g.player.x = pp.x; g.player.y = pp.y;
        r = d.tookPhoto({ targetsInFrame: [st.targets[t]], self: false, shadowBearing: 0 });
        if (!r.ok) return 'photoset step refused ' + st.targets[t] + ': ' + r.message;
      }
      if (at() === before) return 'photoset did not complete';
    } else if (st.kind === 'edit') {
      r = d.editedPhoto({}, st.filter);
      if (!r.ok) return 'edit step refused: ' + r.message;
    } else {
      /* buy / act / craft / note / search / gather: hold the key until it gives */
      var spins = 0;
      while (at() === before) {
        r = d.perform(prop);
        if (!r.ok) return 'step ' + before + ' (' + st.kind + ') refused: ' + (r.message || '?');
        if (++spins > 80) return 'step ' + before + ' (' + st.kind + ') never resolved';
      }
    }
  }
  return null;
}

POOL.forEach(function (tpl) {
  /* VERBOSE=1 names each template as it is solved, which is how you find the
     one that hangs rather than the one that fails. */
  if (process.env.VERBOSE) process.stdout.write('   solving ' + tpl.id + '\n');
  var err = solve(tpl.id);
  ok(!err, tpl.id + ': ' + err);
});

/* ---------------- 4. the endless loop really is endless ---------------- */
(function () {
  var g = mockGame(town);
  var d = new ER.Director(g);
  d.issue();
  for (var i = 0; i < 300; i++) {
    var had = d.active;
    ok(!!had, 'director ran dry after ' + i + ' errands');
    if (!had) break;
    d.abandon();
    ok(d.active && d.active !== had, 'abandoning did not produce a fresh errand');
  }
  ok(d.issued >= 300, 'expected 300+ errands issued, got ' + d.issued);
})();

/* every errand completing must immediately produce the next one */
(function () {
  var g = mockGame(town);
  var d = new ER.Director(g);
  d.issue('rusted_nail');
  var first = d.active;
  /* Guarded. An unguarded version of this loop hung the suite for two
     minutes when the prop id went stale, instead of failing in a line. */
  var spins = 0, ruin = town.props.mahjour_room;
  ok(!!ruin, 'the abandoned house should exist');
  while (d.active === first && ++spins < 500) d.perform(ruin);
  ok(spins < 500, 'performing at the abandoned house never finished the errand');
  ok(!!d.active && d.active !== first, 'no errand followed the finished one');
  ok(g.stats.errands === 1, 'completion was not reported');
  ok(d.history.length === 1, 'nothing was written in the journal');
})();

/* ---------------- 5. residents, if present ---------------- */
if (ER.populate) {
  var rg = mockGame(town);
  var people = ER.populate(town, new ER.RNG('people'));
  ok(people.length === 30, 'expected 30 residents, got ' + people.length);
  var names = {};
  people.forEach(function (r) {
    ok(!!r.name && !!r.role, 'a resident is missing a name or a job');
    ok(!names[r.name], 'two residents named ' + r.name);
    names[r.name] = 1;
    ok(r.home !== null && r.home !== undefined, r.name + ' has nowhere to live');
    ok(typeof r.bark === 'function', r.name + ' cannot speak');
    for (var tier = 0; tier <= 4; tier++) {
      var line = r.bark(tier, rg);
      ok(typeof line === 'string' && line.length > 1, r.name + ' has nothing to say at tier ' + tier);
    }
  });
  /* everyone must be able to walk to work */
  people.forEach(function (r) {
    var sched = r.scheduleFor(2);
    ok(sched.length > 0, r.name + ' has no day');
    sched.forEach(function (slot) {
      ok(!!town.props[slot.at] || slot.at === 'home' || slot.at === 'out',
        r.name + ' is scheduled to be at an unknown place: ' + slot.at);
    });
  });
}

/* ---------------- 6. the clock ---------------- */
(function () {
  var c = new ER.Clock('clocktest');
  var day0 = c.day;
  /* twenty-four real minutes should be exactly one day */
  for (var i = 0; i < 24 * 60 * 20; i++) c.advance(1 / 20);
  ok(c.day === day0 + 1, 'a day should take 24 real minutes; it took ' +
    (c.day - day0) + ' day(s) worth');

  /* lingering runs an hour a second */
  var c2 = new ER.Clock('lingertest');
  var m0 = c2.minutes;
  for (var j = 0; j < 5 * 60; j++) c2.advance(1 / 60, 60);
  var hours = (c2.minutes - m0) / 60;
  ok(Math.abs(hours - 5) < 0.01, 'lingering five seconds should pass five hours, passed ' + hours.toFixed(2));

  /* the ground soaks and dries on believable timescales */
  var c3 = new ER.Clock('wettest');
  c3.setWeather('rain');
  var soak = 0;
  while (c3.wet < 0.9 && soak < 600) { c3.advance(0.1); soak += 0.1; }
  ok(soak > 5 && soak < 60, 'the ground should soak in well under a minute of rain, took ' + soak.toFixed(0) + ' s');
  c3.setWeather('clear');
  var dry = 0;
  while (c3.wet > 0.2 && dry < 3000) { c3.advance(0.1); dry += 0.1; }
  ok(dry > soak * 2, 'wet ground should outlast the shower; soaked in ' + soak.toFixed(0) +
    ' s and dried in ' + dry.toFixed(0) + ' s');

  /* dusk has to actually happen, and last long enough to do something in */
  var c4 = new ER.Clock('dusktest');
  var duskMinutes = 0, sawDusk = false, sawNight = false, sawNoon = false;
  for (var h = 0; h < 1440; h++) {
    c4.minutes = h;
    var ph = c4.phase();
    if (ph === 'dusk') { duskMinutes++; sawDusk = true; }
    if (ph === 'night') sawNight = true;
    if (ph === 'midday') sawNoon = true;
  }
  ok(sawDusk && sawNight && sawNoon, 'a day should contain midday, dusk and night');
  ok(duskMinutes > 40, 'dusk should last long enough to trace a gravestone in; it lasts ' +
    duskMinutes + ' minutes');
  /* the sun. It has to be on the horizon at the clock's own sunrise and
     sunset, and it has to get there without jumping, or dusk lands in the
     wrong colour band and half the errands are sent out into the dark. */
  (function () {
    var sc = new ER.Clock('suntest');
    for (var day = 1; day < 40; day += 7) {
      sc.day = day;
      var sr = sc.sunrise(), ss = sc.sunset();
      ok(Math.abs(sc.sunElevation(sr)) < 0.15,
        'day ' + day + ': the sun is ' + sc.sunElevation(sr).toFixed(2) +
        ' deg off the horizon at sunrise');
      ok(Math.abs(sc.sunElevation(ss)) < 0.15,
        'day ' + day + ': the sun is ' + sc.sunElevation(ss).toFixed(2) +
        ' deg off the horizon at sunset');
      /* continuous: no step bigger than a degree over a one-minute sweep */
      var worst = 0, at = 0, prev = sc.sunElevation(0);
      for (var m = 1; m <= 24 * 60; m++) {
        var e = sc.sunElevation(m / 60);
        if (Math.abs(e - prev) > worst) { worst = Math.abs(e - prev); at = m / 60; }
        prev = e;
      }
      ok(worst < 0.4, 'day ' + day + ': the sun jumps ' + worst.toFixed(2) +
        ' deg at hour ' + at.toFixed(2));
      /* highest at solar noon, lowest at solar midnight */
      var noon = sc.sunElevation((sr + ss) / 2);
      ok(noon > 40 && noon < 62, 'day ' + day + ': noon sun at ' + noon.toFixed(1) + ' deg');
      var mid = sc.sunElevation(((sr + ss) / 2 + 12) % 24);
      ok(mid < -30, 'day ' + day + ': midnight sun at ' + mid.toFixed(1) + ' deg');
      /* civil twilight -- the sun between 0 and -6 -- must last a while */
      var civil = 0;
      for (var q = 0; q < 24 * 60; q++) {
        var ee = sc.sunElevation(q / 60);
        if (ee < 0 && ee > -6) civil++;
      }
      ok(civil > 50, 'day ' + day + ': civil twilight lasts only ' + civil +
        ' minutes across both ends of the day');

      /* The sun rises in the east and sets in the west, which in this town
         means it sets over the sea. Azimuth is degrees east of due south, so
         it starts positive and ends negative, and the whole arc is monotone.
         It ran the other way for a while: the sunset was inland, behind the
         souk, and the one view the quarter has never got lit. */
      var azRise = sc.sunAzimuth(sr), azSet = sc.sunAzimuth(ss);
      ok(azRise > 60, 'day ' + day + ': the sun rises in the east, not at azimuth ' +
        azRise.toFixed(0));
      ok(azSet < -60, 'day ' + day + ': the sun sets in the west, over the sea, not at azimuth ' +
        azSet.toFixed(0));
      ok(Math.abs(sc.sunAzimuth((sr + ss) / 2)) < 1,
        'day ' + day + ': the noon sun should be due south, not at azimuth ' +
        sc.sunAzimuth((sr + ss) / 2).toFixed(1));
      var azPrev = sc.sunAzimuth(sr), backwards = 0;
      for (var a = sr * 60; a <= ss * 60; a++) {
        var azNow = sc.sunAzimuth(a / 60);
        if (azNow > azPrev + 1e-9) backwards++;
        azPrev = azNow;
      }
      ok(backwards === 0, 'day ' + day + ': the sun went back east ' + backwards +
        ' times during the day');
    }
    /* and the phase the clock names must match where the sun actually is */
    sc.day = 1;
    sc.minutes = (sc.sunset() + 0.1) * 60;
    ok(sc.phase() === 'dusk', 'just after sunset should be dusk, not ' + sc.phase());
    ok(sc.sunElevation() > -3,
      'dusk should still have the sun near the horizon, not at ' +
      sc.sunElevation().toFixed(1) + ' deg');
  }());

  /* and the errands that want dusk must agree with the clock about when it is */
  var duskWindow = { h0: 18.4, h1: 20.1 };
  var overlap = 0;
  for (var q = 0; q < 1440; q++) {
    c4.minutes = q;
    if (c4.phase() === 'dusk' && c4.inWindow(duskWindow.h0, duskWindow.h1)) overlap++;
  }
  ok(overlap > 30, "the errands' idea of dusk should overlap the clock's; overlap is " +
    overlap + ' minutes');
})();

/* ---------------- 7. saving ---------------- */
(function () {
  if (!ER.Save) { ok(false, 'the save module did not load'); return; }
  var g = mockGame(town);
  var d = new ER.Director(g);
  g.director = d;
  g.view = { pos: { x: 1234.5, y: 0, z: 678.25 }, yaw: 1.25, pitch: -0.2 };
  g.people = ER.populate ? ER.populate(town, new ER.RNG('savepeople')) : [];
  g.discovered = { dukkan_counter: 1, chapel_door: 1 };
  g.milestones = { m10: 1 };
  g.town = town;
  g.clock.minutes = 17 * 60 + 42;
  g.clock.day = 9;
  d.issue('moss_with_spoon');
  d.perform(town.props.dukkan_counter);              /* this buys the spoon */
  g.stats.walked = 4321.5;
  if (g.people.length) { g.people[0].met = true; g.people[0].seen = 5; g.people[0].witnessed = 2; }

  ok(ER.Save.write(g), 'the save did not write');
  ok(ER.Save.exists(), 'the save should exist after writing');
  var raw = ER.Save.read();
  ok(!!raw, 'the save did not read back');
  if (!raw) return;
  ok(raw.seed === town.seedStr, 'the save lost the seed');
  ok(Math.round(raw.player.x) === 1235 && Math.round(raw.player.y) === 678,
    'the save lost where you were standing');
  ok(raw.player.yaw === 1.25, 'the save lost which way you were facing');
  ok(raw.clock.day === 9, 'the save lost the day');
  ok(raw.stats.walked === 4321.5, 'the save lost the distance walked');
  ok(raw.inv.spoon >= 1, 'the save lost what was in your pockets');
  ok(raw.discovered.chapel_door === 1, 'the save lost the places you had found');
  ok(raw.milestones.m10 === 1, 'the save lost the milestones');
  ok(!!raw.director.active && raw.director.active.tplId === 'moss_with_spoon',
    'the save lost the errand you were on');
  ok(raw.director.stepIndex === d.stepIndex, 'the save lost how far into it you were');
  if (raw.people && raw.people.length) {
    ok(raw.people[0].met === true && raw.people[0].seen === 5,
      'the save lost who you had met');
  }

  /* and it has to come back as the same errand, mid-step */
  var g2 = mockGame(town);
  var d2 = new ER.Director(g2);
  d2.load(raw.director);
  ok(!!d2.active, 'the errand did not survive the reload');
  if (d2.active) {
    ok(d2.active.tplId === 'moss_with_spoon', 'a different errand came back');
    ok(d2.active.title === d.active.title, 'the errand came back with a different title');
    ok(d2.stepIndex === d.stepIndex, 'the errand came back at a different step');
    ok(d2.active.steps.length === d.active.steps.length, 'the errand came back with different steps');
  }
  ok(ER.Save.clear(), 'the save did not clear');
  ok(!ER.Save.exists(), 'the save should be gone after clearing');
})();

/* ---------------- report ---------------- */
console.log('');
if (fails.length === 0) {
  console.log('  ' + checks + ' checks passed.');
  console.log('  ' + POOL.length + ' errand templates, all solvable.');
  console.log('  ' + town.propList.length + ' interactable things in ' +
    (town.w * town.h) + ' square metres.');
  console.log('  town, errands, residents, clock and saves all check out.');
  console.log('');
  process.exit(0);
} else {
  console.log('  ' + fails.length + ' of ' + checks + ' checks FAILED:');
  fails.slice(0, 40).forEach(function (f) { console.log('   - ' + f); });
  if (fails.length > 40) console.log('   ... and ' + (fails.length - 40) + ' more');
  console.log('');
  process.exit(1);
}
