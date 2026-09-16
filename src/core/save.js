/* Errands — saving. Everything but the photographs, which live only in the
   session, the way photographs of nothing should. */
(function (ER) {
  'use strict';
  var KEY = 'errands.hollisbend.v1';

  ER.Save = {
    write: function (game) {
      try {
        var data = {
          v: 1,
          seed: game.town.seedStr,
          clock: game.clock.save(),
          player: { x: game.view.pos.x, y: game.view.pos.z, yaw: game.view.yaw, pitch: game.view.pitch },
          inv: game.inv,
          stats: game.stats,
          discovered: game.discovered,
          director: game.director.save(),
          people: game.people.map(function (r) {
            return { id: r.id, seen: r.seen, met: r.met, witnessed: r.witnessed };
          }),
          milestones: game.milestones,
          savedAt: Date.now()
        };
        localStorage.setItem(KEY, JSON.stringify(data));
        return true;
      } catch (e) { return false; }
    },

    read: function () {
      try {
        var raw = localStorage.getItem(KEY);
        if (!raw) return null;
        var d = JSON.parse(raw);
        return (d && d.v === 1) ? d : null;
      } catch (e) { return null; }
    },

    clear: function () {
      try { localStorage.removeItem(KEY); return true; } catch (e) { return false; }
    },

    exists: function () {
      try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
    }
  };
})(typeof window !== 'undefined' ? (window.ER = window.ER || {}) : (global.ER = global.ER || {}));
