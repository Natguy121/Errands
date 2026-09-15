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
['core/rng', 'core/util', 'world/names', 'world/time', 'world/town',
  'quest/items', 'quest/pool', 'quest/pool2', 'quest/director',
  'world/residents'].forEach(function (f) {
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
var town = ER.generateTown('hollis bend');
ok(town.lots.length === 30, 'expected 30 house lots, got ' + town.lots.length);
ok(town.propList.length > 150, 'expected a lot of props, got ' + town.propList.length);
ok(town.cemetery.graves.length > 30, 'cemetery is too empty');
ok(!town.isBlocked(town.spawn.x, town.spawn.y), 'you spawn inside a wall');
ok(town.w * town.h === 4000000, 'the town should be four square kilometres');

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
  while (d.active === first) d.perform(town.props.farmhouse_collapsed);
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

/* ---------------- report ---------------- */
console.log('');
if (fails.length === 0) {
  console.log('  ' + checks + ' checks passed.');
  console.log('  ' + POOL.length + ' errand templates, all solvable.');
  console.log('  ' + town.propList.length + ' interactable things in ' +
    (town.w / 1000 * town.h / 1000) + ' km².');
  console.log('');
  process.exit(0);
} else {
  console.log('  ' + fails.length + ' of ' + checks + ' checks FAILED:');
  fails.slice(0, 40).forEach(function (f) { console.log('   - ' + f); });
  if (fails.length > 40) console.log('   ... and ' + (fails.length - 40) + ' more');
  console.log('');
  process.exit(1);
}
