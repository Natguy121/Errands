/* Errands — browser smoke test for the first-person build.
 *
 *   npx http-server -p 8099 -s .   &&   node test/browser.js
 *
 * Builds the world in Chromium, walks it with real key events, picks things
 * out with the crosshair, searches a ruin, photographs a streetlamp, drives an
 * errand to completion, opens every screen, reloads a save, and fails on any
 * console error or uncaught exception. Screenshots land in .shots/.
 *
 * Headless Chromium treats the page as hidden and throttles both
 * requestAnimationFrame and timers, so the game's own loop stalls. This
 * harness therefore drives update/render explicitly, which is deterministic
 * as well as immune to throttling. In a real browser the game runs its own
 * rAF loop and none of this applies.
 */
'use strict';
var path = require('path');
var fs = require('fs');
var PORT = process.env.PORT || 8099;
var SHOTS = process.env.SHOTS || path.join(__dirname, '..', '.shots');
/* Capturing pictures out of a software rasteriser is slow and flaky in ways
   that say nothing about the game, so it is opt-in: SHOOT=1 node test/browser.js */
var SHOOT = !!process.env.SHOOT;
/* QUICK=1 skips the three stages that need a real compositor: the
   sightseeing tour, opening the overlay screens, and taking a photograph.
   Headless Chromium never produces a composited frame on its own -- rAF and
   timers are throttled because the page counts as hidden -- so the first time
   a layer or a readback surface is needed it is created synchronously inside
   whatever call happens to be running, which can take minutes on a software
   rasteriser and says nothing at all about the game. Everything else runs,
   including the whole errand loop. Drop QUICK on a machine with a GPU. */
var QUICK = !!process.env.QUICK;

var pw;
try { pw = require('/opt/node22/lib/node_modules/playwright'); }
catch (e) { pw = require('playwright'); }

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function () {
  if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
  /* No GPU flags. The quarter is drawn on a 2D context now, so there is no
     WebGL to fall back to a software rasteriser, no shader programs to
     compile and nothing here that needs ANGLE talked into existence. */
  var browser = await pw.chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-features=CalculateNativeWinOcclusion,IntensiveWakeUpThrottling']
  });
  var ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  var page = await ctx.newPage();
  page.setDefaultTimeout(90000);

  var errors = [], warnings = [];
  page.on('console', function (m) {
    var txt = m.text();
    if (m.type() === 'error') { if (/favicon/i.test(txt)) return; errors.push('console: ' + txt); }
    else if (m.type() === 'warning') warnings.push(txt);
  });
  page.on('pageerror', function (e) { errors.push('uncaught: ' + (e.message || e)); });

  var T0 = Date.now();
  function say(s) {
    console.log('  [' + ((Date.now() - T0) / 1000).toFixed(1).padStart(5) + 's] ' + s);
  }

  /* drive the game forward by a number of seconds of game time */
  async function tick(seconds, step) {
    step = step || (1 / 60);
    var n = Math.max(1, Math.round(seconds / step));
    var r = await page.evaluate(function (a) {
      var g = window.game, err = null;
      /* software rasterisation makes drawing about a hundred times the cost of
         the logic, so step the simulation every frame and draw only every
         eighth one, plus a final draw so whatever happens next sees a current
         frame. On a GPU the game draws every frame. */
      for (var i = 0; i < a[0]; i++) {
        try {
          g.update(a[1]);
          if (i % 8 === 0 || i === a[0] - 1) g.render();
        } catch (e) { err = (e && e.stack) || String(e); break; }
      }
      return { err: err, t: g.t };
    }, [n, step]);
    if (r.err) errors.push('the loop threw: ' + r.err.split('\n').slice(0, 4).join('  |  '));
    return r;
  }
  /* Capture through the game's own renderer: draw the frame into the
     offscreen canvas it already uses for photographs. Fixed at the
     photograph's size. This shows the quarter without the HTML HUD; uiShot
     covers the HUD frames. A timeout is a warning rather than a failure: it
     says nothing about the game. */
  async function worldShot(name) {
    if (!SHOOT) return;
    var pending = page.evaluate(function () {
      return window.game.view.snapshot(640, 400).toDataURL('image/png');
    });
    var url = await Promise.race([pending,
      new Promise(function (r) { setTimeout(function () { r(null); }, 25000); })]);
    if (!url) { warnings.push('capture of ' + name + ' timed out'); return; }
    fs.writeFileSync(path.join(SHOTS, name + '.png'),
      Buffer.from(url.split(',')[1], 'base64'));
  }
  async function uiShot(name) {
    if (!SHOOT) return;
    try {
      await page.screenshot({ path: path.join(SHOTS, name + '.png'), timeout: 25000 });
    } catch (e) {
      warnings.push('page screenshot for ' + name + ' timed out (software rasteriser)');
    }
  }

  await page.goto('http://127.0.0.1:' + PORT + '/index.html', { waitUntil: 'load' });

  /* ---- 1. the canvas ---- */
  var can2d = await page.evaluate(function () {
    var c = document.createElement('canvas');
    var g = c.getContext('2d');
    if (!g) return null;
    /* the two things the drawing leans on beyond fills and strokes */
    var p = g.createPattern(c, 'repeat');
    return { pattern: !!p, setTransform: !!(p && p.setTransform),
      matrix: typeof DOMMatrix !== 'undefined', ellipse: typeof g.ellipse === 'function' };
  });
  if (!can2d) errors.push('no 2D canvas context available');
  else {
    if (!can2d.pattern) errors.push('canvas patterns are unavailable, so every surface would be flat');
    if (!can2d.setTransform || !can2d.matrix) {
      errors.push('pattern.setTransform or DOMMatrix is missing, so the stone would not scale with the zoom');
    }
    if (!can2d.ellipse) errors.push('ctx.ellipse is missing, so half the glyphs would not draw');
    say('2D canvas with patterns, pattern transforms and ellipses');
  }

  /* ---- 2. build ---- */
  var t0 = Date.now();
  await page.click('#go');
  await page.waitForFunction(function () {
    return window.game && window.game.director && window.game.director.active &&
      window.game.scene && window.game.scene.raycastTargets.length > 0 &&
      window.game.scene.relief && window.game.shadersWarm;
  }, null, { timeout: 300000 });
  say('world built in ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');

  var drove = await tick(1.0);
  if (!(drove.t >= 0.9)) errors.push('driving the loop did not advance game time');
  say('loop ran a second of game time without throwing');

  var built = await page.evaluate(function () {
    var g = window.game;
    var tiles = Object.keys(g.scene.tiles);
    var missing = tiles.filter(function (k) {
      var t = g.scene.tiles[k];
      return !t || !t.width || !t.height;
    });
    return { tiles: tiles.length, missing: missing,
      relief: g.scene.relief ? g.scene.relief.width + 'x' + g.scene.relief.height : 'none',
      props: g.scene.raycastTargets.length,
      lamps: g.town.lamps.length,
      trees: g.town.trees.length,
      footprints: g.town.lots.length + g.town.buildings.length,
      metres: g.view.metres,
      errand: g.director.active.title,
      at: [Math.round(g.view.pos.x), Math.round(g.view.pos.z)] };
  });
  if (built.missing.length) errors.push('surfaces that did not generate: ' + built.missing.join(', '));
  say(built.tiles + ' generated surfaces, relief field ' + built.relief + ', ' +
    built.footprints + ' footprints, ' + built.trees + ' trees, ' + built.lamps + ' streetlamps');
  say(built.props + ' props, all of them pickable, at ' + built.metres + ' m across the short side');
  say('standing at ' + built.at.join(', ') + ' — "' + String(built.errand).slice(0, 58) + '…"');
  await worldShot('01-the-souk');

  /* ---- 3. walking and looking ---- */
  var before = await page.evaluate(function () {
    window.game.view.locked = true;
    return window.game.stats.walked;
  });
  for (var i = 0; i < 4; i++) {
    var key = ['KeyW', 'KeyD', 'KeyS', 'KeyA'][i];
    await page.keyboard.down(key);
    if (i < 2) await page.keyboard.down('ShiftLeft');
    await tick(0.55);
    await page.keyboard.up('ShiftLeft');
    await page.keyboard.up(key);
  }
  var after = await page.evaluate(function () { return window.game.stats.walked; });
  if (!(after > before + 2)) errors.push('walking did not move the player (' + before + ' → ' + after + ')');
  say('walked ' + (after - before).toFixed(1) + ' m on real key events');

  /* You face where you walk, and W is north whichever way you were facing.
     The alternative — turning the body and walking forward — is a
     first-person idea, and from above it steers like a tank. */
  var facings = await page.evaluate(async function () {
    var g = window.game, out = {};
    var dirs = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    for (var k in dirs) {
      if (!Object.prototype.hasOwnProperty.call(dirs, k)) continue;
      g.view.pos.x = 30.6; g.view.pos.z = 27.2;
      var held = {}; held[k] = true;
      var input = { is: function (n) { return !!held[n]; } };
      for (var i = 0; i < 10; i++) g.view.move(1 / 60, input);
      out[k] = { fx: +(-Math.sin(g.view.yaw)).toFixed(2), fy: +(-Math.cos(g.view.yaw)).toFixed(2) };
    }
    return out;
  });
  var wrongWay = [];
  [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]].forEach(function (c) {
    var f = facings[c[0]];
    if (!f || Math.abs(f.fx - c[1]) > 0.06 || Math.abs(f.fy - c[2]) > 0.06) {
      wrongWay.push(c[0] + ' faced ' + (f ? f.fx + ',' + f.fy : 'nowhere'));
    }
  });
  if (wrongWay.length) errors.push('walking did not turn you the way you went: ' + wrongWay.join('; '));
  say('you face the way you walk, on all four compass directions');

  /* the pointer decides what you are about to touch */
  var pointed = await page.evaluate(function () {
    var g = window.game;
    var target = g.town.props.fountain;
    var pos = g.town.propPos(target);
    /* stand an arm's length off it, with the pointer somewhere else entirely */
    g.view.pos.x = pos.x + 1.2; g.view.pos.z = pos.y + 1.2;
    g.player.x = g.view.pos.x; g.player.y = g.view.pos.z;
    g.view.aim.on = false;
    g.update(1 / 60);
    var blind = g.looking ? g.looking.id : null;
    /* now put the pointer on it */
    g.view.aim.on = true; g.view.aim.x = pos.x; g.view.aim.y = pos.y;
    g.update(1 / 60);
    var aimed = g.looking ? g.looking.id : null;
    /* and the screen-to-world round trip the pointer depends on */
    var s = g.view.worldToScreen(pos.x, pos.y);
    var back = g.view.screenToWorld(s.x, s.y);
    return { blind: blind, aimed: aimed,
      roundTrip: Math.hypot(back.x - pos.x, back.y - pos.y) };
  });
  if (pointed.aimed !== 'fountain') {
    errors.push('pointing at the fountain from an arm\'s length picked ' + pointed.aimed);
  }
  if (pointed.roundTrip > 0.01) {
    errors.push('the screen-to-world round trip is off by ' + pointed.roundTrip.toFixed(3) + ' m');
  }
  say('the pointer picks what it is over (' + pointed.aimed + '), and ' +
    (pointed.blind ? 'falls back to ' + pointed.blind : 'nothing') + ' when it is over nothing');

  /* ---- 4. places, hours, weather ---- */
  var scenes = [
    ['02-souk-midday', 21.4, 25.2, 12.4, 'fair', 22],
    ['03-quay-rain', 8.4, 30.0, 15.0, 'rain', 22],
    ['04-square-night', 30.6, 27.2, 1.5, 'fair', 18],
    ['05-all-of-it', 25.0, 25.0, 17.0, 'fair', 30]
  ];
  if (QUICK) scenes = scenes.slice(0, 0);
  for (var s2 = 0; s2 < scenes.length; s2++) {
    var sc = scenes[s2];
    await page.evaluate(function (a) {
      var g = window.game;
      g.view.pos.x = a[1]; g.view.pos.z = a[2];
      g.view.pos.y = g.town.heightAt(a[1], a[2]);
      g.view.metres = a[5];
      g.clock.minutes = a[3] * 60;
      g.clock.setWeather(a[4]);
      g.clock.wet = (a[4] === 'rain' || a[4] === 'storm') ? 1 : 0;
      g.clock.fogAmt = a[4] === 'fog' ? 0.85 : 0;
    }, sc);
    var sceneT = Date.now();
    await tick(0.4);
    await worldShot(sc[0]);
    if (process.env.VERBOSE) say('  \u00b7 ' + sc[0] + '  (' + (Date.now() - sceneT) + ' ms)');
  }
  say((SHOOT ? 'rendered and captured ' : 'rendered ') + scenes.length +
    ' places across the day and the weather' + (SHOOT ? '' : ' (SHOOT=1 to save them)'));

  /* The light has to actually change with the hour. This is the one thing
     that came across from the first-person renderer unchanged — the table of
     what the light does at each sun elevation, and the solar geometry on the
     clock — so it is worth holding it to the same behaviour. */
  var hours = await page.evaluate(function () {
    var g = window.game, out = [];
    [3, 6.5, 9, 13, 17, 19.3, 22].forEach(function (h) {
      g.clock.minutes = h * 60;
      g.clock.setWeather('fair');
      g.clock.wet = 0;
      g.scene.update(g, 0);
      var L = g.scene.light;
      out.push({ h: h, elev: +L.elev.toFixed(1), az: +L.azimuth.toFixed(0),
        wash: +L.washAlpha.toFixed(3), shade: +L.shade.toFixed(3),
        lamps: +L.lamps.toFixed(2) });
    });
    return out;
  });
  var noon = hours[3], night = hours[6], dawn = hours[1];
  if (!(noon.elev > 40)) errors.push('the midday sun is only ' + noon.elev + ' degrees up');
  if (!(night.wash > noon.wash + 0.3)) errors.push('night is not darker than noon');
  if (!(noon.shade > night.shade)) errors.push('shadows at noon are not stronger than at night');
  if (!(night.lamps > 0.9)) errors.push('the streetlamps are not on at ten at night');
  if (!(noon.lamps < 0.05)) errors.push('the streetlamps are on at one in the afternoon');
  if (!(dawn.az > 60)) errors.push('the dawn sun is not in the east (azimuth ' + dawn.az + ')');
  if (!(hours[5].az < -60)) errors.push('the dusk sun is not in the west, over the sea');
  say('the light runs the day: noon ' + noon.elev + ' deg with shadows at ' + noon.shade +
    ', night wash ' + night.wash + ' with the lamps at ' + night.lamps);

  /* ---- 5. the crosshair ---- */
  var picks = await page.evaluate(function () {
    var g = window.game, out = [];
    var cases = [
      ['plate_h01', 0, -0.2, 2.4],
      ['fountain', 0, -0.32, 2.4],
      ['dukkan_counter', 0, -0.1, 2.8],
      ['wall_mooring', 0, -0.4, 2.4]
    ];
    for (var c = 0; c < cases.length; c++) {
      var p = g.town.props[cases[c][0]];
      if (!p) { out.push([cases[c][0], 'missing']); continue; }
      /* pretend the errand wants this one, which is how the picker
         disambiguates overlapping volumes in play */
      if (g.director.active && g.director.active.steps[g.director.stepIndex]) {
        g.director.active.steps[g.director.stepIndex].at = cases[c][0];
      }
      var pos = g.town.propPos(p);
      g.view.pos.x = pos.x; g.view.pos.z = pos.y + cases[c][3];
      g.view.pos.y = g.town.heightAt(g.view.pos.x, g.view.pos.z);
      g.view.yaw = cases[c][1]; g.view.pitch = cases[c][2];
      g.update(1 / 60);
      out.push([cases[c][0], g.looking ? g.looking.id : null]);
    }
    return out;
  });
  var missed = picks.filter(function (p) { return p[0] !== p[1]; });
  var blind = picks.filter(function (p) { return !p[1]; });
  if (blind.length) {
    errors.push('the crosshair picked nothing at all when pointed at: ' +
      blind.map(function (m) { return m[0]; }).join(', '));
  }
  if (missed.length) {
    warnings.push('crosshair resolved to a neighbouring volume: ' +
      missed.map(function (m) { return m[0] + ' -> ' + m[1]; }).join(', '));
  }
  say('crosshair picked ' + (picks.length - missed.length) + ' of ' + picks.length +
    ' things exactly, and ' + (blind.length ? blind.length + ' not at all' : 'something every time'));

  /* ---- 6. hold E and search ---- */
  var held = await page.evaluate(function () {
    var g = window.game;
    g.director.issue('rusted_nail');
    var p = g.town.props.mahjour_room;
    g.view.pos.x = p.rect.x + p.rect.w / 2;
    g.view.pos.z = p.rect.y + p.rect.h / 2;
    g.view.pos.y = g.town.heightAt(g.view.pos.x, g.view.pos.z);
    g.view.pitch = -0.5;
    g.update(1 / 60);
    return { offer: !!g.director.offerAt(g.looking), looking: g.looking ? g.looking.id : null,
      prompt: g.promptText() ? g.promptText().text : null };
  });
  if (!held.offer) errors.push('standing in the collapsed room offered nothing (saw ' + held.looking + ')');
  say('in the collapsed room the prompt reads "' + held.prompt + '"');
  await page.keyboard.down('KeyE');
  await tick(3.6);
  var holdState = await page.evaluate(function () {
    var d = window.game.director;
    return { tries: d.progress ? (d.progress.tries || 0) : 0, tpl: d.active ? d.active.tplId : null,
      hasNail: window.game.count('nail_rusted') };
  });
  await page.keyboard.up('KeyE');
  if (!(holdState.tries >= 1 || holdState.hasNail > 0 || holdState.tpl !== 'rusted_nail')) {
    errors.push('holding E did not search the room (tries=' + holdState.tries + ')');
  }
  say('holding E searched it ' + holdState.tries + ' time(s)' +
    (holdState.hasNail ? ' and turned up the nail' : ''));
  await worldShot('18-searching-the-ruin');

  /* ---- 7. screens ---- */
  if (!QUICK) for (var k = 0; k < 2; k++) {
    var scr = [['KeyM', '22-map'], ['KeyJ', '23-journal']][k];
    await page.keyboard.press(scr[0]);
    await tick(0.3);
    var mode = await page.evaluate(function () { return window.game.mode; });
    if (mode === 'play') errors.push(scr[0] + ' did not open its screen');
    await uiShot(scr[1]);
    await page.keyboard.press('Escape');
    await tick(0.2);
  }
  say(QUICK ? 'map and journal skipped (QUICK)' : 'map and journal open and render');

  /* ---- 8. a whole errand ---- */
  var loop = await page.evaluate(function () {
    var g = window.game, d = g.director;
    d.issue('flattened_cap');
    var errand = d.active, guard = 0;
    /* the template picks its own patch of cracked paving, so ask the step
       where it wants you rather than naming a prop the town may not have */
    var prop = g.town.props[errand.steps[0].at];
    var pos = g.town.propPos(prop);
    g.view.pos.x = pos.x; g.view.pos.z = pos.y;
    g.view.pos.y = g.town.heightAt(pos.x, pos.y);
    g.player.x = g.view.pos.x; g.player.y = g.view.pos.z;
    while (d.active === errand && guard++ < 200) d.perform(prop);
    return { finished: d.active !== errand, next: d.active ? d.active.title : null,
      history: d.history.length };
  });
  if (!loop.finished) errors.push('could not finish an errand');
  if (!loop.next) errors.push('no replacement errand was issued');
  say('finished an errand; the next arrived at once — "' + String(loop.next).slice(0, 52) + '…"');

  /* ---- 9. residents ---- */
  var folk = await page.evaluate(function () {
    var g = window.game;
    g.clock.minutes = 12 * 60;
    g.clock.setWeather('fair');
    g.view.pos.x = 21.4; g.view.pos.z = 25.2;
    g.view.pos.y = g.town.heightAt(21.4, 25.2);
    g.view.yaw = Math.atan2(-20.0, 1.0);
    var start = g.people.map(function (r) { return [r.x, r.y]; });
    for (var i = 0; i < 200; i++) g.update(0.05);
    var moved = 0;
    for (var j = 0; j < g.people.length; j++) {
      if (Math.abs(g.people[j].x - start[j][0]) + Math.abs(g.people[j].y - start[j][1]) > 1) moved++;
    }
    /* they are dots on the paving now, so what matters is that they are on
       ground you could walk on and that the ones on screen are on screen */
    var cam = g.view.camera2d();
    var walls = g.town.lots.map(function (l) { return l.rect; })
      .concat(g.town.buildings.filter(function (b) { return !b.ruin && !b.open; })
        .map(function (b) { return b.rect; }));
    var onScreen = 0, inWalls = 0;
    for (var r2 = 0; r2 < g.people.length; r2++) {
      var r = g.people[r2];
      if (r.away) continue;
      var sx = r.x * cam.ppm + cam.ox, sy = r.y * cam.ppm + cam.oy;
      if (sx > 0 && sx < cam.w && sy > 0 && sy < cam.h) onScreen++;
      /* Not isBlocked: that grid is padded by 10 cm around every footprint,
         and a doorway is 5 cm off the wall, so anybody standing at their own
         front door counts as blocked. What is wrong is being inside the
         building. */
      for (var b = 0; b < walls.length; b++) {
        var q = walls[b];
        if (r.x > q[0] + 0.25 && r.x < q[0] + q[2] - 0.25 &&
            r.y > q[1] + 0.25 && r.y < q[1] + q[3] - 0.25) { inWalls++; break; }
      }
    }
    return { moved: moved, onScreen: onScreen, inWalls: inWalls, met: g.metCount(),
      away: g.people.filter(function (p) { return p.away; }).length,
      talking: g.people.filter(function (p) { return !!p.say; }).length,
      bubbles: g.scene.bubblePositions(g.people, g.view).length };
  });
  if (folk.moved < 3) errors.push('hardly any residents moved (' + folk.moved + ')');
  if (folk.inWalls) errors.push(folk.inWalls + ' residents are standing inside a wall');
  say(folk.moved + ' residents walked their routines; ' + folk.onScreen + ' on screen, none in a wall; ' +
    folk.away + ' out of town, ' + folk.met + ' met, ' + folk.talking + ' talking (' +
    folk.bubbles + ' bubbles placed)');
  await tick(0.4);
  await uiShot('24-souk-noon');

  /* ---- 10. lingering ---- */
  var lingered = await page.evaluate(function () {
    var g = window.game, t0 = g.clock.minutes;
    g.input.down.linger = true;
    for (var i = 0; i < 60; i++) g.update(0.05);
    g.input.down.linger = false;
    return (g.clock.minutes - t0 + 1440) % 1440;
  });
  if (lingered < 60) errors.push('lingering did not move the clock (' + lingered + ' minutes)');
  say('lingering three seconds moved the clock ' + Math.round(lingered) + ' game-minutes');

  /* ---- 11. cost per frame ---- */
  var perf = await page.evaluate(function () {
    var g = window.game;
    g.view.pos.x = 21.4; g.view.pos.z = 25.2;
    g.view.pos.y = g.town.heightAt(21.4, 25.2);
    function avg(fn, n) { var t = performance.now(); for (var i = 0; i < n; i++) fn(); return (performance.now() - t) / n; }
    var out = {};
    out.up = avg(function () { g.update(1 / 60); }, 40);
    g.view.metres = 22;
    out.near = avg(function () { g.render(); }, 20);
    g.view.metres = 30;                     /* the whole quarter at once */
    out.far = avg(function () { g.render(); }, 20);
    g.view.metres = 22;
    return out;
  });
  if (perf.up > 4) errors.push('the simulation costs ' + perf.up.toFixed(1) + ' ms a frame');
  if (perf.far > 26) errors.push('drawing the whole quarter costs ' + perf.far.toFixed(1) + ' ms a frame');
  say('per frame: ' + perf.up.toFixed(2) + ' ms simulation + ' + perf.near.toFixed(1) +
    ' ms drawing (' + perf.far.toFixed(1) + ' ms with the whole quarter on screen)');

  /* ---- 12. a photograph, last because it is the slowest ---- */
  if (!QUICK) {
    await page.evaluate(function () {
      var g = window.game;
      /* the dying lamp on the souk, with the camera over it: a photograph
         from above is the patch of the quarter the frame is on */
      var lamp = g.town.props.souk_lamp;
      g.view.pos.x = lamp.x; g.view.pos.z = lamp.y + 1.2;
      g.view.pos.y = g.town.heightAt(g.view.pos.x, g.view.pos.z);
      g.view.metres = 14;
      g.clock.minutes = 22.4 * 60;
      g.clock.setWeather('clear');
    });
    await tick(0.4);
    await page.keyboard.press('KeyC');
    await tick(0.3);
    await uiShot('19-viewfinder');
    await page.keyboard.press('Space');
    await tick(0.3);
    var photo = await page.evaluate(function () {
      var g = window.game;
      if (!g.photos.length) return { n: 0 };
      var cvs = g.photos[0].canvas;
      var d = cvs.getContext('2d').getImageData(0, 0, cvs.width, cvs.height).data;
      var lo = 255, hi = 0, sum = 0, n = 0;
      for (var i = 0; i < d.length; i += 40) { lo = Math.min(lo, d[i]); hi = Math.max(hi, d[i]); sum += d[i]; n++; }
      return { n: g.photos.length, w: cvs.width, h: cvs.height, mode: g.mode,
        range: hi - lo, mean: Math.round(sum / n) };
    });
    if (!photo.n) errors.push('the shutter produced no photograph');
    else if (photo.range < 24) errors.push('the photograph is flat/blank (range ' + photo.range + ')');
    await uiShot('20-photo-review');
    await page.keyboard.press('Digit1');
    await tick(0.3);
    var bw = await page.evaluate(function () { return window.game.photos[0].filter; });
    if (bw !== 'bw') errors.push('the black-and-white edit did not apply');
    await uiShot('21-photo-bw');
    say('photograph: ' + photo.w + '×' + photo.h + ', tonal range ' + photo.range +
      ', mean ' + photo.mean + ', converted to high-contrast B&W');
    await page.keyboard.press('Enter');
    await tick(0.2);

  }

  /* ---- 13. the save, through a reload ---- */
  await page.evaluate(function () {
    var g = window.game;
    g.stats.walked = 12345;
    g.director.history.push({ n: 999, tplId: 'test', title: 'A test entry', day: 3, at: '3:00 PM' });
    ER.Save.write(g);
  });
  await page.reload({ waitUntil: 'load' });
  await page.click('#go');
  await page.waitForFunction(function () {
    return window.game && window.game.director && window.game.director.active &&
      window.game.scene && window.game.shadersWarm;
  }, null, { timeout: 240000 });
  await tick(0.5);
  var reloaded = await page.evaluate(function () {
    return { walked: Math.round(window.game.stats.walked),
      history: window.game.director.history.length,
      errand: !!window.game.director.active };
  });
  if (reloaded.walked !== 12345) errors.push('the save did not restore (walked=' + reloaded.walked + ')');
  if (!reloaded.errand) errors.push('no errand after reloading a save');
  say('save restored: ' + reloaded.history + ' journal entries, ' + reloaded.walked + ' m walked');

  await uiShot('25-final');
  await browser.close();

  console.log('');
  if (warnings.length) {
    console.log('  ' + warnings.length + ' warning(s):');
    warnings.slice(0, 5).forEach(function (w) { console.log('   ~ ' + w.slice(0, 150)); });
    console.log('');
  }
  if (errors.length) {
    console.log('  ' + errors.length + ' BROWSER FAILURES:');
    errors.slice(0, 25).forEach(function (e) { console.log('   - ' + e.slice(0, 300)); });
    console.log('');
    process.exit(1);
  }
  console.log('  browser smoke test passed. screenshots in ' + path.relative(process.cwd(), SHOTS) + '/');
  console.log('');
  process.exit(0);
})().catch(function (e) {
  console.error('harness crashed: ' + ((e && e.stack) || e));
  process.exit(1);
});
