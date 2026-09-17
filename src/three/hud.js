/* Errands — the interface, as HTML over the top of the world.
   Crisp text at any resolution, and the errand card can be as long as the
   errand needs it to be. */
(function (ER) {
  'use strict';
  var U = ER.U;

  function el(tag, cls, parent, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  }

  function HUD(game) {
    this.g = game;
    var root = this.root = el('div', 'hud', document.body);

    /* crosshair and the prompt that hangs under it */
    this.reticle = el('div', 'reticle', root);
    el('span', 'dot', this.reticle);
    this.ring = el('svg', 'ring', this.reticle);
    this.ring.innerHTML = '<circle cx="19" cy="19" r="15" class="ring-bg"/>' +
      '<circle cx="19" cy="19" r="15" class="ring-fg"/>';
    this.ringFg = this.ring.querySelector('.ring-fg');
    this.prompt = el('div', 'prompt', root);

    /* clock plate */
    this.clockBox = el('div', 'panel clock', root);
    this.clockTime = el('div', 'time', this.clockBox);
    this.clockMeta = el('div', 'meta', this.clockBox);
    this.clockDate = el('div', 'date', this.clockBox);
    this.clockWx = el('div', 'wx', this.clockBox);

    /* errand card */
    this.card = el('div', 'panel errand', root);
    this.cardHead = el('div', 'errand-head', this.card);
    this.cardTitle = el('div', 'errand-title', this.card);
    this.cardFine = el('div', 'errand-fine', this.card);
    this.cardSteps = el('ol', 'steps', this.card);

    /* pockets */
    this.inv = el('div', 'inventory', root);

    /* toasts and the completion card */
    this.toastBox = el('div', 'toasts', root);
    this.flashBox = el('div', 'flash', root);

    /* speech */
    this.bubbles = el('div', 'bubbles', root);

    /* key hints */
    this.hints = el('div', 'panel hints', root);
    this.hints.innerHTML = [
      ['WASD', 'walk'], ['SHIFT', 'run'], ['CTRL', 'crouch'], ['E', 'hold to act'],
      ['Z', 'linger'], ['C', 'camera'], ['M', 'map'], ['J', 'journal'],
      ['K', 'abandon errand'], ['H', 'hide this']
    ].map(function (r) { return '<span><b>' + r[0] + '</b>' + r[1] + '</span>'; }).join('');

    /* overlays */
    this.overlay = el('div', 'overlay', root);
    this.mapWrap = el('div', 'screen map-screen', this.overlay);
    this.mapCanvas = el('canvas', null, this.mapWrap);
    this.mapInfo = el('div', 'screen-head', this.mapWrap);
    this.journal = el('div', 'screen journal-screen', this.overlay);
    this.viewfinder = el('div', 'viewfinder', root);
    this.viewfinder.innerHTML =
      '<div class="vf-frame"><i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i>' +
      '<div class="vf-thirds"></div><div class="vf-list"></div><div class="vf-bar"></div></div>';
    this.vfList = this.viewfinder.querySelector('.vf-list');
    this.vfBar = this.viewfinder.querySelector('.vf-bar');
    this.review = el('div', 'screen review-screen', this.overlay);

    this.toasts = [];
    this.flash = null;
    this.hintT = 30;
    this.showHints = true;
    this._lastErrand = null;
    this._lastStep = -1;
    this._lastInv = '';
  }

  /* ---------------- messages ---------------- */

  HUD.prototype.toast = function (text, kind) {
    var node = el('div', 'toast ' + (kind || 'plain'), this.toastBox, text);
    this.toasts.push({ node: node, t: 0, life: kind === 'found' ? 5.0 : 3.8 });
    while (this.toasts.length > 5) {
      var old = this.toasts.shift();
      if (old.node.parentNode) old.node.parentNode.removeChild(old.node);
    }
  };

  HUD.prototype.flashCard = function (title, sub) {
    this.flashBox.innerHTML = '<div class="flash-title">' + title + '</div>' +
      (sub ? '<div class="flash-sub">' + sub + '</div>' : '');
    this.flashBox.classList.add('on');
    this.flash = { t: 0, life: 4.0 };
  };

  HUD.prototype.update = function (dt) {
    var i;
    for (i = this.toasts.length - 1; i >= 0; i--) {
      var t = this.toasts[i];
      t.t += dt;
      if (t.t > t.life) {
        if (t.node.parentNode) t.node.parentNode.removeChild(t.node);
        this.toasts.splice(i, 1);
      } else if (t.t > t.life - 0.8) t.node.style.opacity = String((t.life - t.t) / 0.8);
    }
    if (this.flash) {
      this.flash.t += dt;
      if (this.flash.t > this.flash.life) { this.flashBox.classList.remove('on'); this.flash = null; }
    }
    if (this.hintT > 0) {
      this.hintT -= dt;
      if (this.hintT <= 0) this.hints.classList.add('faded');
    }
    this.hints.style.display = this.showHints ? '' : 'none';
  };

  /* ---------------- the frame ---------------- */

  HUD.prototype.draw = function () {
    var g = this.g, cl = g.clock;

    /* clock */
    this.clockTime.textContent = cl.timeString();
    this.clockMeta.innerHTML = '<b>DAY ' + cl.day + '</b>' + U.cap(cl.phase());
    this.clockDate.textContent = cl.dateString();
    var wx = U.cap(cl.weatherLabel());
    if (cl.wet > 0.25 && cl.weatherInfo().wet < 0.3) wx += ', wet underfoot';
    var road = g.town.roadNameAt(g.view.pos.x, g.view.pos.z);
    this.clockWx.textContent = wx + (road ? '  ·  ' + road : '');

    this.drawErrand();
    this.drawInventory();
    this.drawPrompt();

    var mode = g.mode;
    this.overlay.classList.toggle('on', mode === 'map' || mode === 'journal' || mode === 'review');
    this.mapWrap.classList.toggle('on', mode === 'map');
    this.journal.classList.toggle('on', mode === 'journal');
    this.review.classList.toggle('on', mode === 'review');
    this.viewfinder.classList.toggle('on', mode === 'camera');
    this.reticle.classList.toggle('hidden', mode !== 'play');
    this.card.classList.toggle('hidden', mode !== 'play' && mode !== 'camera');
    this.clockBox.classList.toggle('hidden', mode !== 'play' && mode !== 'camera');
    this.inv.classList.toggle('hidden', mode !== 'play');

    if (mode === 'map') this.drawMap();
    if (mode === 'journal') this.drawJournal();
    if (mode === 'camera') this.drawViewfinder();
    if (mode === 'review') this.drawReview();
  };

  HUD.prototype.drawErrand = function () {
    var g = this.g, d = g.director, q = d.active;
    if (!q) { this.card.style.display = 'none'; return; }
    this.card.style.display = '';
    var stamp = q.n + ':' + d.stepIndex + ':' + (g.stepBlocker() || '') + ':' + (g.stepProgressText() || '');
    if (stamp === this._stamp) return;
    this._stamp = stamp;

    this.cardHead.innerHTML = '<b>ERRAND ' + U.commas(q.n) + '</b><span>' +
      U.commas(d.history.length) + ' DONE</span>';
    this.cardTitle.textContent = q.title;
    this.cardFine.textContent = q.fine || '';
    this.cardFine.style.display = q.fine ? '' : 'none';

    var html = '';
    for (var i = 0; i < q.steps.length; i++) {
      var st = q.steps[i];
      var state = d.stepState(i);
      html += '<li class="' + state + '">';
      html += '<i></i><span class="txt">' + st.text + '</span>';
      if (state === 'current') {
        if (st.fine) html += '<span class="sub fine">' + st.fine + '</span>';
        var at = (typeof st.at === 'string' && st.at !== 'ANY' && st.at !== 'HOME') ? g.town.props[st.at] : null;
        if (at && at.where) html += '<span class="sub where">' + at.where + '</span>';
        var blk = g.stepBlocker();
        if (blk) html += '<span class="sub block">' + U.cap(blk) + '</span>';
        var pr = g.stepProgressText();
        if (pr) html += '<span class="sub prog">' + pr + '</span>';
      }
      html += '</li>';
    }
    this.cardSteps.innerHTML = html;
  };

  HUD.prototype.drawInventory = function () {
    var g = this.g;
    var items = g.inventoryList();
    var key = items.map(function (i) { return i.id + i.n; }).join('|');
    if (key === this._lastInv) return;
    this._lastInv = key;
    if (!items.length) {
      this.inv.innerHTML = '<span class="empty">pockets empty</span>';
      return;
    }
    var html = '';
    for (var i = 0; i < items.length && i < 8; i++) {
      html += '<span class="chip ' + ER.itemKind(items[i].id) + '">' +
        ER.itemShort(items[i].id) + (items[i].n > 1 ? '<b>×' + items[i].n + '</b>' : '') + '</span>';
    }
    if (items.length > 8) html += '<span class="chip more">+' + (items.length - 8) + '</span>';
    this.inv.innerHTML = html;
  };

  HUD.prototype.drawPrompt = function () {
    var g = this.g;
    if (g.mode !== 'play') { this.prompt.classList.remove('on'); return; }
    var p = g.promptText();
    if (!p) { this.prompt.classList.remove('on'); return; }
    this.prompt.classList.add('on');
    this.prompt.classList.toggle('blocked', !!p.blocked);
    var sub = p.sub ? '<span class="psub">' + p.sub + '</span>' : '';
    this.prompt.innerHTML = '<kbd>' + p.key + '</kbd><span>' + p.text + '</span>' + sub;

    /* the hold ring */
    var frac = g.holdMax > 0 ? U.clamp(g.holdT / g.holdMax, 0, 1) : 0;
    var C = 2 * Math.PI * 15;
    this.ringFg.style.strokeDasharray = C;
    this.ringFg.style.strokeDashoffset = String(C * (1 - frac));
    this.reticle.classList.toggle('acting', frac > 0.001);
    this.reticle.classList.toggle('live', !p.blocked && !!p.actionable);
  };

  /* ---------------- speech bubbles ---------------- */

  HUD.prototype.drawBubbles = function (list) {
    var html = '';
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (!b.onScreen) continue;
      var scale = U.clamp(1.1 - b.dist / 44, 0.62, 1);
      html += '<div class="bubble" style="left:' + b.x.toFixed(0) + 'px;top:' + b.y.toFixed(0) +
        'px;transform:translate(-50%,-100%) scale(' + scale.toFixed(2) + ')">' +
        '<b>' + b.res.first + '</b>' + b.res.say + '</div>';
    }
    this.bubbles.innerHTML = html;
  };

  /* ---------------- the map ---------------- */

  HUD.prototype.drawMap = function () {
    var g = this.g, town = g.town;
    var cv = this.mapCanvas;
    var W = Math.min(window.innerWidth - 120, window.innerHeight - 170);
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = W * dpr; }
    cv.style.width = W + 'px'; cv.style.height = W + 'px';
    var c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    var s = W / town.w;
    function mx(x) { return x * s; }
    function my(y) { return y * s; }
    var i, k;

    /* the rock the quarter stands on */
    c.fillStyle = '#2a261f';
    c.fillRect(0, 0, W, W);

    /* the sea, west of the wall */
    c.fillStyle = '#20404c';
    c.fillRect(0, 0, mx(town.sea.edge), W);
    c.strokeStyle = 'rgba(180,196,200,0.5)';
    c.lineWidth = Math.max(1.2, 1.4 * s);
    c.beginPath();
    c.moveTo(mx(town.sea.wall.x), 0);
    c.lineTo(mx(town.sea.wall.x), W);
    c.stroke();

    /* the square */
    var sq = town.square;
    c.fillStyle = 'rgba(190,178,154,0.30)';
    c.fillRect(mx(sq.x), my(sq.y), sq.w * s, sq.h * s);

    /* the alleys */
    for (i = 0; i < town.roads.length; i++) {
      var rd = town.roads[i];
      c.strokeStyle = rd.steps ? 'rgba(206,196,176,0.72)' : 'rgba(198,190,172,0.62)';
      c.lineWidth = Math.max(1.6, rd.width * s * 0.85);
      c.lineCap = 'round';
      if (rd.steps) c.setLineDash([3.5, 2.5]);
      c.beginPath();
      c.moveTo(mx(rd.pts[0][0]), my(rd.pts[0][1]));
      for (k = 1; k < rd.pts.length; k++) c.lineTo(mx(rd.pts[k][0]), my(rd.pts[k][1]));
      c.stroke();
      c.setLineDash([]);
    }

    /* the houses and the shops, and the one you sleep in */
    for (i = 0; i < town.buildings.length; i++) {
      var b = town.buildings[i];
      c.fillStyle = b.ruin ? 'rgba(150,142,130,0.5)'
        : b.kind === 'chapel' ? 'rgba(240,236,224,0.92)' : 'rgba(228,220,202,0.86)';
      c.fillRect(mx(b.x), my(b.y), Math.max(2, b.w * s), Math.max(2, b.h * s));
    }
    for (i = 0; i < town.lots.length; i++) {
      var hs = town.lots[i].house;
      c.fillStyle = 'rgba(212,202,182,0.68)';
      c.fillRect(mx(hs.x), my(hs.y), Math.max(2, hs.w * s), Math.max(2, hs.h * s));
    }
    var hh = town.home.house;
    c.strokeStyle = '#e0bf6f'; c.lineWidth = 1.6;
    c.strokeRect(mx(hh.x) - 1, my(hh.y) - 1, Math.max(4, hh.w * s) + 2, Math.max(4, hh.h * s) + 2);

    /* the fountain */
    c.fillStyle = '#6f97a2';
    c.beginPath();
    c.ellipse(mx(sq.fountain.x), my(sq.fountain.y), Math.max(1.6, sq.fountain.r * s),
      Math.max(1.6, sq.fountain.r * s), 0, 0, 6.2832);
    c.fill();

    c.font = '9px ui-monospace, Menlo, monospace';
    c.fillStyle = 'rgba(206,204,192,0.6)';
    var labels = [['souk', 22, 25.0], ['quay', 8.4, 32], ['daraj', 21.0, 16],
      ['mina', 13.2, 38], ['zaroub', 28.2, 34], ['aliya', 30, 10.2],
      ['tahta', 26, 42.6], ['sharq', 45.0, 30]];
    for (i = 0; i < labels.length; i++) {
      var rdd = town.roadById[labels[i][0]];
      if (!rdd) continue;
      c.save();
      c.translate(mx(labels[i][1]), my(labels[i][2]));
      if (['church', 'quarry', 'elm', 'mill'].indexOf(labels[i][0]) >= 0) c.rotate(-Math.PI / 2);
      c.fillText(rdd.name.toUpperCase(), 0, 0);
      c.restore();
    }

    var known = 0;
    for (i = 0; i < town.landmarks.length; i++) {
      var lm = town.landmarks[i];
      var seen = g.discovered[lm.id];
      c.fillStyle = seen ? '#eae7db' : 'rgba(150,148,138,0.3)';
      c.beginPath(); c.arc(mx(lm.x), my(lm.y), seen ? 2.6 : 1.5, 0, 6.2832); c.fill();
      if (seen) {
        known++;
        c.font = '9.5px system-ui, sans-serif';
        c.fillStyle = 'rgba(236,232,218,0.78)';
        c.fillText(lm.name.replace(/^the /, ''), mx(lm.x) + 5, my(lm.y) + 3);
      }
    }
    var targets = g.currentTargets();
    for (i = 0; i < targets.length; i++) {
      var tp = town.propPos(targets[i]);
      if (!tp) continue;
      c.strokeStyle = '#e0bf6f'; c.lineWidth = 1.5;
      c.beginPath(); c.arc(mx(tp.x), my(tp.y), 4 + Math.sin(g.t * 3) * 1.4, 0, 6.2832); c.stroke();
    }
    for (i = 0; i < g.people.length; i++) {
      var pr = g.people[i];
      if (!pr.met || pr.away) continue;
      c.fillStyle = 'rgba(158,192,138,0.62)';
      c.beginPath(); c.arc(mx(pr.x), my(pr.y), 1.9, 0, 6.2832); c.fill();
    }
    /* you, and which way you are looking */
    var px = mx(g.view.pos.x), py = my(g.view.pos.z);
    c.save();
    c.translate(px, py);
    c.rotate(-g.view.yaw);
    c.fillStyle = '#e0bf6f';
    c.beginPath(); c.moveTo(0, -7); c.lineTo(4.4, 5); c.lineTo(-4.4, 5); c.closePath(); c.fill();
    c.restore();

    this.mapInfo.innerHTML = '<b>BATROUN &middot; EL QADIM</b><span>pop. 30 &middot; 50&times;50 m &middot; ' + known + ' of ' +
      town.landmarks.length + ' places found</span><em>M to close</em>';
  };

  /* ---------------- the journal ---------------- */

  HUD.prototype.drawJournal = function () {
    var g = this.g, d = g.director;
    if (this._journalStamp === d.history.length + ':' + g.photos.length + ':' + g.photoSel) return;
    this._journalStamp = d.history.length + ':' + g.photos.length + ':' + g.photoSel;
    var st = g.stats;
    var rows = [
      ['Errands completed', U.commas(d.history.length)],
      ['Errands abandoned', U.commas(d.abandoned)],
      ['Days in the quarter', String(g.clock.day)],
      ['Distance walked', (st.walked / 1000).toFixed(2) + ' km'],
      ['Things picked up', U.commas(st.picked)],
      ['Junk turned up', U.commas(st.junk)],
      ['Photographs taken', U.commas(g.photos.length)],
      ['Residents met', g.metCount() + ' of 30'],
      ['Times observed', U.commas(st.witnessed)],
      ['Places found', g.discoveredCount() + ' of ' + g.town.landmarks.length],
      ['Hours spent lingering', (st.lingered / 60).toFixed(1)]
    ];
    var html = '<div class="screen-head"><b>JOURNAL</b><em>↑↓ scroll · ←→ photographs · J to close</em></div>';
    html += '<div class="jcols"><div class="jtally"><h4>TALLY</h4>';
    for (var i = 0; i < rows.length; i++) {
      html += '<div class="trow"><span>' + rows[i][0] + '</span><b>' + rows[i][1] + '</b></div>';
    }
    html += '<p class="assess">' + g.selfAssessment() + '</p></div>';

    html += '<div class="jlist"><h4>COMPLETED, MOST RECENT FIRST</h4><div class="jscroll" id="jscroll">';
    if (!d.history.length) html += '<p class="empty">Nothing yet.</p>';
    for (var k = d.history.length - 1; k >= 0 && k > d.history.length - 260; k--) {
      var e = d.history[k];
      html += '<div class="jrow"><span class="n">' + e.n + '</span><span class="t">' + e.title +
        '</span><span class="w">day ' + e.day + ', ' + e.at + '</span></div>';
    }
    html += '</div></div></div>';

    html += '<div class="photostrip"><h4>PHOTOGRAPHS · 1 APPLIES HIGH-CONTRAST BLACK &amp; WHITE</h4><div class="strip">';
    if (!g.photos.length) html += '<p class="empty">No photographs. The camera is C.</p>';
    html += '</div></div>';
    this.journal.innerHTML = html;

    var strip = this.journal.querySelector('.strip');
    for (var p = Math.max(0, g.photos.length - 9); p < g.photos.length; p++) {
      var ph = g.photos[p];
      var wrap = el('div', 'thumb' + (p === g.photoSel ? ' sel' : ''), strip);
      if (ph.canvas) {
        ph.canvas.style.width = '150px';
        ph.canvas.style.height = '94px';
        wrap.appendChild(ph.canvas);
      }
      el('span', null, wrap, (ph.filter === 'bw' ? 'B&amp;W · ' : '') + ph.label);
    }
    var sc = this.journal.querySelector('#jscroll');
    if (sc) sc.scrollTop = g.journalScroll;
  };

  /* ---------------- camera ---------------- */

  HUD.prototype.drawViewfinder = function () {
    var g = this.g;
    var seen = g.framedTargets();
    var req = g.director.photoRequest();
    var html = '';
    for (var i = 0; i < seen.length && i < 8; i++) {
      var pr = g.town.props[seen[i]];
      var wanted = req && req.targets.indexOf(seen[i]) >= 0;
      var done = req && req.done.indexOf(seen[i]) >= 0;
      html += '<div class="' + (done ? 'done' : wanted ? 'want' : '') + '">' +
        (done ? '✓ ' : wanted ? '▸ ' : '· ') + (pr ? pr.name : seen[i]) + '</div>';
    }
    if (req && req.targets.indexOf('SELF') >= 0) {
      var bear = Math.abs(g.clock.shadowBearing()) * 180 / Math.PI;
      html += '<div class="' + (bear < 17 ? 'done' : 'want') + '">▸ your own shadow — ' +
        bear.toFixed(0) + '° off north</div>';
    }
    if (!html) html = '<div class="none">nothing the errand wants</div>';
    this.vfList.innerHTML = html;
    this.vfBar.innerHTML = '<span>SPACE  SHUTTER</span><b>' +
      g.clock.timeString().replace(' ', '') + '   f/8   ' +
      (g.clock.daylight() < 0.3 ? '1/8s' : '1/250s') + '</b><span>C  PUT IT AWAY</span>';
  };

  HUD.prototype.drawReview = function () {
    var g = this.g, ph = g.reviewPhoto;
    if (!ph) return;
    if (this._reviewOf === ph && this._reviewFilter === ph.filter) return;
    this._reviewOf = ph; this._reviewFilter = ph.filter;
    this.review.innerHTML = '';
    var wrap = el('div', 'review-wrap', this.review);
    if (ph.canvas) {
      ph.canvas.style.width = 'min(720px, 80vw)';
      ph.canvas.style.height = 'auto';
      wrap.appendChild(ph.canvas);
    }
    el('div', 'review-label', wrap, ph.label);
    el('div', 'review-keys', wrap,
      (ph.filter === 'bw' ? '<b>HIGH-CONTRAST B&amp;W APPLIED</b>' : '<b>1</b> HIGH-CONTRAST B&amp;W') +
      '   <b>ENTER</b> KEEP IT   <b>BACKSPACE</b> DELETE');
  };

  ER.HUD = HUD;
})(window.ER = window.ER || {});
