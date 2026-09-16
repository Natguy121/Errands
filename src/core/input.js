/* Errands — keys. */
(function (ER) {
  'use strict';

  function Input(target) {
    var self = this;
    this.down = {};
    this.pressed = {};
    this.wheel = 0;
    this.blocked = false;

    var MAP = {
      KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
      KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
      ShiftLeft: 'run', ShiftRight: 'run',
      ControlLeft: 'crouch', ControlRight: 'crouch', KeyQ: 'crouch',
      KeyE: 'act', Space: 'shoot', KeyZ: 'linger', KeyC: 'camera',
      KeyM: 'map', KeyJ: 'journal', KeyK: 'abandon', KeyH: 'hints',
      Enter: 'enter', Backspace: 'back', Escape: 'escape',
      Digit1: 'one', Digit2: 'two', Equal: 'zoomin', Minus: 'zoomout',
      KeyP: 'pause', KeyF: 'fiddle'
    };

    window.addEventListener('keydown', function (e) {
      var name = MAP[e.code];
      if (!name) return;
      if (e.code === 'Space' || e.code === 'Backspace' || e.code.indexOf('Arrow') === 0) e.preventDefault();
      if (!self.down[name]) self.pressed[name] = true;
      self.down[name] = true;
    });
    window.addEventListener('keyup', function (e) {
      var name = MAP[e.code];
      if (!name) return;
      self.down[name] = false;
    });
    window.addEventListener('blur', function () { self.down = {}; });
    window.addEventListener('wheel', function (e) {
      self.wheel += e.deltaY > 0 ? -1 : 1;
    }, { passive: true });
  }

  Input.prototype.was = function (name) { return !!this.pressed[name]; };
  Input.prototype.is = function (name) { return !!this.down[name]; };
  Input.prototype.endFrame = function () { this.pressed = {}; this.wheel = 0; };

  ER.Input = Input;
})(typeof window !== 'undefined' ? (window.ER = window.ER || {}) : (global.ER = global.ER || {}));
