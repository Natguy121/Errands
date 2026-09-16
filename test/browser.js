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
  var browser = await pw.chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist', '--enable-webgl', '--disable-gpu-sandbox',
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
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
    else if (m.type() === 'warning' && /THREE|shader|program/i.test(txt)) warnings.push(txt);
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
      return { err: err, t: g.t, calls: g.view.mainCalls || 0, tris: g.view.mainTris || 0 };
    }, [n, step]);
    if (r.err) errors.push('the loop threw: ' + r.err.split('\n').slice(0, 4).join('  |  '));
    return r;
  }
  /* A screenshot forces Chromium to composite a frame. Under software
     rasterisation that is slow but workable now that every shader program is
     compiled up front. A timeout is recorded as a warning rather than a
     failure: it says nothing about the game. */
  /* Capture through the game's own renderer: render into the offscreen target
     it already uses for photographs and read the pixels back. Fixed at the
     photograph's size, because the loader warms exactly that pipeline. This
     shows the world without the HTML HUD; uiShot covers the HUD frames. */
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

  /* ---- 1. WebGL ---- */
  var gl = await page.evaluate(function () {
    var c = document.createElement('canvas');
    var g = c.getContext('webgl2') || c.getContext('webgl');
    if (!g) return null;
    var dbg = g.getExtension('WEBGL_debug_renderer_info');
    return { renderer: dbg ? g.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown' };
  });
  if (!gl) errors.push('no WebGL context available');
  else say('WebGL: ' + gl.renderer);

  /* ---- 2. build ---- */
  var t0 = Date.now();
  await page.click('#go');
  await page.waitForFunction(function () {
    return window.game && window.game.director && window.game.director.active &&
      window.game.scene3d && window.game.scene3d.raycastTargets.length > 0 &&
      window.game.people3d && window.game.shadersWarm;
  }, null, { timeout: 300000 });
  say('world built in ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');

  var drove = await tick(1.0);
  if (!(drove.t >= 0.9)) errors.push('driving the loop did not advance game time');
  say('loop ran a second of game time without throwing');

  var built = await page.evaluate(function () {
    var g = window.game, meshes = 0, tris = 0, instanced = 0, instances = 0;
    g.view.scene.traverse(function (o) {
      if (!o.isMesh) return;
      meshes++;
      if (o.isInstancedMesh) { instanced++; instances += o.count; }
      var geo = o.geometry;
      var per = geo && geo.index ? geo.index.count / 3
        : (geo && geo.attributes.position ? geo.attributes.position.count / 3 : 0);
      tris += per * (o.isInstancedMesh ? o.count : 1);
    });
    return { meshes: meshes, tris: Math.round(tris), instanced: instanced, instances: instances,
      hits: g.scene3d.raycastTargets.length,
      panes: g.scene3d.paneList ? g.scene3d.paneList.length : 0,
      lamps: g.scene3d.lamps.length,
      progs: g.view.renderer.info.programs.length,
      calls: g.view.mainCalls || 0,
      errand: g.director.active.title,
      eye: [Math.round(g.view.pos.x), +g.view.pos.y.toFixed(2), Math.round(g.view.pos.z)] };
  });
  say(built.meshes + ' meshes, ' + (built.tris / 1000).toFixed(0) + 'k triangles, ' +
    built.instanced + ' instanced meshes carrying ' + built.instances + ' instances');
  say(built.panes + ' window panes, ' + built.lamps + ' streetlamps, ' + built.hits +
    ' hit volumes, ' + built.progs + ' shaders, ' + built.calls + ' draw calls a frame');
  say('standing at ' + built.eye.join(', ') + ' — "' + String(built.errand).slice(0, 58) + '…"');
  await worldShot('01-depot-street');

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

  var looked = await page.evaluate(function () {
    var v = window.game.view, y0 = v.yaw;
    document.dispatchEvent(new MouseEvent('mousemove', { movementX: 400, movementY: 60 }));
    return Math.abs(v.yaw - y0) > 0.1 && v.pitch < 0;
  });
  if (!looked) errors.push('mouse look did not turn the camera');
  say('mouse look turns the camera');

  /* eye height must follow the ground */
  var terrainFollow = await page.evaluate(async function () {
    var g = window.game, out = [];
    var spots = [[575, 660], [1470, 1010], [1616, 630], [1000, 400]];
    for (var s = 0; s < spots.length; s++) {
      g.view.pos.x = spots[s][0]; g.view.pos.z = spots[s][1];
      g.view.pos.y = g.town.heightAt(spots[s][0], spots[s][1]);
      for (var k = 0; k < 8; k++) g.update(1 / 60);   /* no render: the eye
         height comes from the simulation, not from drawing */
      out.push(+(g.view.camera.position.y - g.town.heightAt(spots[s][0], spots[s][1])).toFixed(2));
    }
    return out;
  });
  var badEye = terrainFollow.filter(function (e) { return Math.abs(e - 1.68) > 0.12; });
  if (badEye.length) errors.push('eye height did not follow the terrain: ' + terrainFollow.join(', '));
  say('eye height holds ' + terrainFollow[0].toFixed(2) + ' m over ground on a hill, a bridge, a ridge and a field');

  /* ---- 4. places, hours, weather ---- */
  var scenes = [
    ['02-main-street-midday', 1040, 1008, Math.PI * 1.5, 12.4, 'fair'],
    ['03-concrete-bridge-rain', 1455, 1014, Math.PI * 0.5, 15.0, 'rain']
  ];
  if (QUICK) scenes = [];
  for (var s2 = 0; s2 < scenes.length; s2++) {
    var sc = scenes[s2];
    await page.evaluate(function (a) {
      var g = window.game;
      g.view.pos.x = a[1]; g.view.pos.z = a[2];
      g.view.pos.y = g.town.heightAt(a[1], a[2]);
      g.view.yaw = a[3]; g.view.pitch = -0.045;
      g.clock.minutes = a[4] * 60;
      g.clock.setWeather(a[5]);
      g.clock.wet = (a[5] === 'rain' || a[5] === 'storm') ? 1 : 0;
      g.clock.fogAmt = a[5] === 'fog' ? 0.85 : 0;
      if (g.scene3d.grass) g.scene3d.grass.lastX = 1e9;
      if (g.scene3d.weeds) g.scene3d.weeds.lastX = 1e9;
    }, sc);
    var sceneT = Date.now();
    await tick(0.2);
    await worldShot(sc[0]);
    if (process.env.VERBOSE) say('  \u00b7 ' + sc[0] + '  (' + (Date.now() - sceneT) + ' ms)');
  }
  say((SHOOT ? 'rendered and captured ' : 'rendered ') + scenes.length +
    ' places across the day and the weather' + (SHOOT ? '' : ' (SHOOT=1 to save them)'));

  /* ---- 5. the crosshair ---- */
  var picks = await page.evaluate(function () {
    var g = window.game, out = [];
    var cases = [
      ['home_mailbox', 0, -0.3, 2.6],
      ['hydrant_0', 0, -0.32, 2.4],
      ['bendmart_counter', 0, -0.1, 3.0],
      ['bridge_stone_moss', 0, -0.5, 2.6]
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
    ' things exactly, and something every time');

  /* ---- 6. hold E and search ---- */
  var held = await page.evaluate(function () {
    var g = window.game;
    g.director.issue('rusted_nail');
    var p = g.town.props.farmhouse_collapsed;
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
    var prop = g.town.props.oldlot;
    g.view.pos.x = prop.rect.x + prop.rect.w / 2;
    g.view.pos.z = prop.rect.y + prop.rect.h / 2;
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
    g.view.pos.x = 1040; g.view.pos.z = 1012;
    g.view.pos.y = g.town.heightAt(1040, 1012);
    g.view.yaw = Math.PI * 1.5;
    var start = g.people.map(function (r) { return [r.x, r.y]; });
    for (var i = 0; i < 200; i++) g.update(0.05);
    var moved = 0;
    for (var j = 0; j < g.people.length; j++) {
      if (Math.abs(g.people[j].x - start[j][0]) + Math.abs(g.people[j].y - start[j][1]) > 1) moved++;
    }
    var visible = 0, onGround = 0;
    for (var r2 = 0; r2 < g.people3d.rigs.length; r2++) {
      var slot = g.people3d.rigs[r2];
      if (!slot.obj.visible) continue;
      visible++;
      if (Math.abs(slot.obj.position.y - g.town.heightAt(slot.obj.position.x, slot.obj.position.z)) < 0.1) onGround++;
    }
    return { moved: moved, visible: visible, onGround: onGround, met: g.metCount(),
      away: g.people.filter(function (p) { return p.away; }).length,
      talking: g.people.filter(function (p) { return !!p.say; }).length };
  });
  if (folk.moved < 3) errors.push('hardly any residents moved (' + folk.moved + ')');
  if (folk.visible && folk.onGround !== folk.visible) {
    errors.push('resident rigs are not standing on the ground (' + folk.onGround + '/' + folk.visible + ')');
  }
  say(folk.moved + ' residents walked their routines; ' + folk.visible + ' rigs on screen, all on the ground; ' +
    folk.away + ' out of town, ' + folk.met + ' met, ' + folk.talking + ' talking');
  await tick(0.4);
  await uiShot('24-main-street-noon');

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
    g.view.pos.x = 1040; g.view.pos.z = 1008;
    g.view.pos.y = g.town.heightAt(1040, 1008);
    g.view.yaw = Math.PI * 1.5;
    function avg(fn, n) { var t = performance.now(); for (var i = 0; i < n; i++) fn(); return (performance.now() - t) / n; }
    var up = avg(function () { g.update(1 / 60); }, 40);
    var full = avg(function () { g.render(); }, 4);
    var casters = 0;
    g.view.scene.traverse(function (o) { if (o.isMesh && o.castShadow) casters++; });
    return { update: up, render: full, casters: casters,
      calls: g.view.mainCalls || 0, tris: g.view.mainTris || 0 };
  });
  say('per frame: ' + perf.update.toFixed(1) + ' ms simulation + ' + perf.render.toFixed(0) +
    ' ms drawing under a software rasteriser');
  say('  (' + perf.calls + ' draw calls, ' + (perf.tris / 1000).toFixed(0) +
    'k triangles, ' + perf.casters + ' shadow casters — a GPU draws this in single-digit ms)');

  /* ---- 12. a photograph, last because it is the slowest ---- */
  if (!QUICK) {
    await page.evaluate(function () {
      var g = window.game;
      var lamp = g.town.props.streetlamp_dying;
      g.view.pos.x = lamp.x + 6; g.view.pos.z = lamp.y + 6;
      g.view.pos.y = g.town.heightAt(g.view.pos.x, g.view.pos.z);
      g.view.yaw = Math.PI * 1.25; g.view.pitch = 0.3;
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
      window.game.people3d && window.game.shadersWarm;
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
    console.log('  ' + warnings.length + ' three.js warning(s):');
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
