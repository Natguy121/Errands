/* Errands — the pool.
 *
 * Thirty templates here and thirty more next door. Each one randomises its
 * own specifics, so the pool generates errands in the thousands. No template
 * rewards you. No template refers to any other template. There is no order
 * and there is no end.
 *
 * Fifty metres of old town means every errand is within ninety seconds' walk
 * of every other one, which is the joke: you will be back at this fountain
 * eleven times today for eleven unrelated reasons.
 */
(function (ER) {
  'use strict';
  var U = ER.U;

  /* ---------------- step constructors ---------------- */

  function step(o) {
    o.need = o.need || [];
    o.take = o.take || [];
    o.give = o.give || [];
    return o;
  }

  function buy(shopProp, item, text, fine) {
    return step({ kind: 'buy', at: shopProp, verb: 'BUY', item: item, give: [item], text: text, fine: fine });
  }
  function act(o) { o.kind = 'act'; return step(o); }
  function find(o) { o.kind = 'search'; o.verb = o.verb || 'SEARCH'; return step(o); }
  function gather(o) { o.kind = 'gather'; o.verb = o.verb || 'PICK'; return step(o); }
  function hold(o) { o.kind = 'wait'; o.verb = o.verb || 'WAIT'; return step(o); }
  function make(o) { o.kind = 'craft'; o.at = o.at || 'ANY'; return step(o); }
  function snap(o) { o.kind = 'photo'; o.verb = 'PHOTOGRAPH'; return step(o); }
  function snapAll(o) { o.kind = 'photoset'; o.verb = 'PHOTOGRAPH'; return step(o); }
  function retouch(o) { o.kind = 'edit'; return step(o); }
  function trek(o) { o.kind = 'walk'; return step(o); }
  function jot(o) { o.kind = 'note'; o.at = o.at || 'ANY'; o.verb = o.verb || 'WRITE'; return step(o); }

  var DUSK = { h0: 18.4, h1: 20.1, label: 'at dusk' };
  var NIGHT = { h0: 21.5, h1: 4.5, label: 'after dark' };
  var PREDAWN = { h0: 4.6, h1: 6.6, label: 'before sunrise' };
  var NOON = { h0: 11.8, h1: 13.5, label: 'in the middle of the day' };
  var WET = ['rain', 'drizzle', 'storm'];

  /* things there are several of, so the errand can name one arbitrarily */
  function idsTagged(town, tag) {
    var out = [];
    for (var i = 0; i < town.propList.length; i++)
      if (town.propList[i].tags.indexOf(tag) >= 0) out.push(town.propList[i].id);
    return out;
  }
  function anyShutter(rng, town) { return rng.pick(idsTagged(town, 'shutter')); }
  function anyDoor(rng, town) { return rng.pick(idsTagged(town, 'knocker')); }
  function anyPlate(rng, town) { return rng.pick(idsTagged(town, 'plate')); }
  function anyPots(rng, town) { return rng.pick(idsTagged(town, 'pot')); }
  function anyCat(rng, town) { return rng.pick(idsTagged(town, 'cat')); }
  function anyDish(rng, town) { return rng.pick(idsTagged(town, 'satellite')); }
  function allCats(town) { return idsTagged(town, 'cat'); }
  function anyCracks(rng) { return rng.pick(['square_cracks', 'zaroub_cracks', 'daraj_cracks']); }
  function anyFig(rng) { return rng.pick(['square_fig', 'mahjour_fig']); }

  /* ================================================================== *
   *  THE POOL
   * ================================================================== */

  var POOL = [

    /* ---- 1. the one about the jar ---- */
    {
      id: 'jar_of_sea_water', weight: 3, tags: ['water', 'fiddly'],
      setup: function (rng) { return { knots: rng.int(2, 4) }; },
      title: function () { return 'Collect exactly one glass jar of sea water from the shallow channel cut through the Phoenician wall, seal it, and wrap twine around the rim'; },
      fine: function (p) { return 'It must be the shallow channel. The deep one further along is wrong. ' + U.cap(U.spell(p.knots)) + ' turns of twine, no more.'; },
      steps: function (p) {
        return [
          buy('dukkan_counter', 'jar_empty', 'Buy a glass jar at the dukkan', 'The small one. Not the olive jar.'),
          buy('dukkan_counter', 'twine', 'Buy a ball of twine while you are in there'),
          act({ at: 'wall_channel', verb: 'FILL', text: 'Fill the jar at the shallow channel in the sea wall',
            need: ['jar_empty'], take: ['jar_empty'], give: ['jar_sea'], decoyKey: 'channel' }),
          make({ verb: 'SEAL', text: 'Seal the jar', need: ['jar_sea'], take: ['jar_sea'], give: ['jar_sea_sealed'] }),
          make({ verb: 'WRAP', text: 'Wrap ' + U.spell(p.knots) + ' turns of twine around the rim',
            need: ['jar_sea_sealed', 'twine'], take: ['jar_sea_sealed'], give: ['jar_sea_twined'] })
        ];
      }
    },

    /* ---- 2. the rusted nail ---- */
    {
      id: 'rusted_nail', weight: 3, tags: ['ruin', 'iron'],
      setup: function () { return {}; },
      title: function () { return 'Find a rusted nail in the room of the abandoned house where the roof came down'; },
      fine: function () { return 'The room on the zaroub side, where the roof went in the nineties. Square boat nails do not count. It has to be rusted through.'; },
      steps: function () {
        return [
          find({ at: 'mahjour_room', item: 'nail_rusted', tries: 4,
            text: 'Search the room where the roof came down', fine: 'Mind the beams.' })
        ];
      }
    },

    /* ---- 3. the iron spike ---- */
    {
      id: 'wall_spike', weight: 2, tags: ['walk', 'iron'],
      setup: function (rng) { return { from: rng.pick(['sea_steps', 'chapel_step']) }; },
      title: function () { return 'Walk the whole length of the sea wall and come back with a discarded iron spike'; },
      fine: function () { return 'The whole length. End to end. The harbour ironwork sheds them and nobody picks them up.'; },
      steps: function (p) {
        return [
          trek({ waypoints: ['sea_steps', 'wall_channel', 'wall_letter', 'wall_third_stone'],
            text: 'Walk the sea wall from end to end', fine: 'It is forty-odd metres. Do it anyway.' }),
          find({ at: 'quay_hooks', item: 'spike_iron', tries: 3, verb: 'SEARCH',
            text: 'Find a spike among the harbour iron', from: p.from })
        ];
      }
    },

    /* ---- 4. the chapel at dusk ---- */
    {
      id: 'trace_the_letter', weight: 3, tags: ['dusk', 'stone'],
      setup: function (rng) { return { word: rng.pick(['aleph', 'a hook', 'a tent peg', 'an eye']) }; },
      title: function () { return 'Go to the sea wall below Saydet el Bahr at dusk and take a rubbing of the letter cut into the stone'; },
      fine: function (p) { return 'Somebody says it is ' + p.word + '. It has to be at dusk, and it has to be a rubbing, not a drawing.'; },
      steps: function () {
        return [
          buy('dukkan_counter', 'paper', 'Buy a sheet of paper'),
          buy('dukkan_counter', 'pencil', 'Buy a carpenter pencil'),
          act({ at: 'wall_letter', verb: 'RUB', when: DUSK, text: 'Rub the letter through the paper',
            need: ['paper', 'pencil'], take: ['paper'], give: ['rubbing'] })
        ];
      }
    },

    /* ---- 5. moss off the sea wall, with a spoon ---- */
    {
      id: 'moss_with_spoon', weight: 3, tags: ['scrape', 'absurd'],
      setup: function (rng) { return { spoons: rng.pick(['tin', 'tin', 'tin']) }; },
      title: function () { return 'Scrape the moss off the third stone of the sea wall using a spoon'; },
      fine: function () { return 'A spoon. Not a knife, not your thumbnail. The third stone from the chapel end, counting the one that is half under.'; },
      steps: function () {
        return [
          buy('dukkan_counter', 'spoon', 'Buy a spoon at the dukkan', 'Nadia will ask what for. Do not explain.'),
          act({ at: 'wall_third_stone', verb: 'SCRAPE', text: 'Scrape the moss off the third stone',
            need: ['spoon'], take: ['spoon'], give: ['spoon_mossy'] })
        ];
      }
    },

    /* ---- 6. the flattened bottle cap ---- */
    {
      id: 'flattened_cap', weight: 3, tags: ['search', 'ground'],
      setup: function (rng) { return { where: anyCracks(rng) }; },
      title: function () { return 'Search the paving of the old souk for a flattened bottle cap from before twist-offs'; },
      fine: function () { return 'Flattened, by feet and years. If it still has a crimp on it, it is too new.'; },
      steps: function (p) {
        return [
          find({ at: p.where, item: 'cap_flattened', tries: 5,
            text: 'Go through the gaps in the paving', fine: 'On your knees, in public.' })
        ];
      }
    },

    /* ---- 7. the clay die ---- */
    {
      id: 'clay_die', weight: 3, tags: ['craft', 'wait'],
      setup: function (rng) { return { pips: rng.int(1, 6) }; },
      title: function () { return 'Dig clay from under the sea wall, shape it into a die, and leave it on your windowsill to dry in the sun'; },
      fine: function (p) { return 'Six faces. The ' + U.spell(p.pips) + ' goes opposite the ' + U.spell(7 - p.pips) + '. It will come out slightly wrong.'; },
      steps: function () {
        return [
          act({ at: 'shore_clay', verb: 'DIG', text: 'Dig a lump of clay from under the wall', give: ['clay_wild'] }),
          make({ verb: 'SHAPE', text: 'Shape the clay into a die',
            need: ['clay_wild'], take: ['clay_wild'], give: ['clay_die'] }),
          act({ at: 'home_windowsill', verb: 'PLACE', text: 'Leave the die on your windowsill',
            need: ['clay_die'] }),
          hold({ at: 'home_windowsill', seconds: 60, dayOffset: 1, verb: 'WAIT',
            text: 'Let the sun have it until tomorrow', take: ['clay_die'], give: ['clay_die_dry'] })
        ];
      }
    },

    /* ---- 8. the dying streetlamp ---- */
    {
      id: 'dying_lamp', weight: 3, tags: ['photo', 'night'],
      setup: function () { return {}; },
      title: function () { return 'Photograph the dying streetlamp on the souk and edit the photograph to high-contrast black and white'; },
      fine: function () { return 'Wait for it to cycle dark three times first. It is not broken, it is dying, and those are different.'; },
      steps: function () {
        return [
          hold({ at: 'souk_lamp', seconds: 14, when: NIGHT, verb: 'STAND',
            text: 'Stand under the lamp until it cycles dark three times' }),
          snap({ target: 'souk_lamp', when: NIGHT, text: 'Photograph the lamp', give: ['photo'], maxRange: 10 }),
          retouch({ filter: 'bw', text: 'Edit the photograph to high-contrast black and white' })
        ];
      }
    },

    /* ---- 9. the lemonade you may not drink ---- */
    {
      id: 'warm_lemonade', weight: 3, tags: ['carry', 'wait'],
      setup: function (rng) { return { spot: rng.pick(['sea_steps', 'bench_landing', 'square_bench']) }; },
      title: function (p, town) {
        var n = town.props[p.spot];
        return 'Buy a glass of lemonade and carry it to ' + n.name + ' without drinking any of it';
      },
      fine: function () { return 'Abou Georges leaves the pips in. Carry it until it is warm. Then you may drink it, and it will not be nice.'; },
      steps: function (p) {
        return [
          buy('lemonade_counter', 'lemonade', 'Buy a glass of lemonade'),
          hold({ at: p.spot, seconds: 30, verb: 'SIT', text: 'Sit with it until it goes warm',
            need: ['lemonade'], take: ['lemonade'], give: ['lemonade_warm'] })
        ];
      }
    },

    /* ---- 10. the bluest shutter ---- */
    {
      id: 'bluest_shutter', weight: 2, tags: ['look', 'colour'],
      setup: function () { return {}; },
      title: function () { return 'Decide which shutter in the quarter is the bluest, and photograph it'; },
      fine: function () { return 'There is a correct answer. Nobody will confirm it.'; },
      steps: function (p, town) {
        return [
          snap({ target: town.bluestShutter, text: 'Photograph the bluest shutter in the quarter',
            give: ['photo'], maxRange: 8 })
        ];
      }
    },

    /* ---- 11. count the steps, twice, differently ---- */
    {
      id: 'count_the_steps', weight: 3, tags: ['count', 'absurd'],
      setup: function () { return {}; },
      title: function () { return 'Count the steps of Darb el Daraj going up, count them again coming down, and write down the second number'; },
      fine: function () { return 'The three at the bottom are the kerb and do not count. The numbers will not agree. Write down the second one.'; },
      steps: function () {
        return [
          buy('dukkan_counter', 'paper', 'Buy a sheet of paper'),
          buy('dukkan_counter', 'pencil', 'Buy a pencil'),
          act({ at: 'daraj_steps', verb: 'COUNT', text: 'Count the steps on the way up', decoyKey: 'steps' }),
          act({ at: 'daraj_steps', verb: 'COUNT', text: 'Count them again on the way down' }),
          jot({ text: 'Write down the number you got the second time',
            need: ['paper', 'pencil'], take: ['paper'], give: ['note_count'] })
        ];
      }
    },

    /* ---- 12. the pips ---- */
    {
      id: 'lemon_pips', weight: 2, tags: ['gather', 'count'],
      setup: function (rng) { return { n: rng.int(38, 47), drop: rng.int(2, 4) }; },
      title: function (p) {
        return 'Collect exactly ' + U.spell(p.n) + ' lemon pips from the tree behind number 6, then discard the ' +
          U.spell(p.drop) + ' heaviest';
      },
      fine: function (p) { return 'Weigh them in your hand. You will be wrong about at least one. Keep ' + (p.n - p.drop) + '.'; },
      steps: function (p) {
        return [
          gather({ at: 'lemon_tree', item: 'pip', n: p.n, verb: 'PICK',
            text: 'Pick ' + U.spell(p.n) + ' pips out of the windfalls' }),
          make({ verb: 'DISCARD', text: 'Discard the ' + U.spell(p.drop) + ' heaviest',
            need: ['pip'], take: ['pip'], give: ['pips_kept'] })
        ];
      }
    },

    /* ---- 13. the mismatched plate ---- */
    {
      id: 'mismatched_plate', weight: 2, tags: ['look', 'note'],
      setup: function () { return {}; },
      title: function () { return 'Find the house in the quarter whose number plate does not match its number, and write the discrepancy down'; },
      fine: function () { return 'One of them is wrong. The neighbours know which and will not say, because the man who painted it is dead.'; },
      steps: function (p, town) {
        return [
          buy('dukkan_counter', 'paper', 'Buy a sheet of paper'),
          buy('dukkan_counter', 'pencil', 'Buy a pencil'),
          act({ at: 'plate_' + town.mismatchedPlate, verb: 'READ', text: 'Read the plate that is wrong' }),
          jot({ text: 'Write down the discrepancy',
            need: ['paper', 'pencil'], take: ['paper'], give: ['note_discrepancy'] })
        ];
      }
    },

    /* ---- 14. the fountain, three times ---- */
    {
      id: 'fountain_temperatures', weight: 2, tags: ['water', 'absurd'],
      setup: function (rng) { return { gap: rng.int(20, 40) }; },
      title: function () { return 'Put your hand in the fountain at three different times of day and rank the three temperatures'; },
      fine: function () { return 'Your hand is the instrument. There is no instrument.'; },
      steps: function (p) {
        return [
          act({ at: 'fountain', verb: 'TOUCH', when: PREDAWN, text: 'Feel the water before sunrise' }),
          act({ at: 'fountain', verb: 'TOUCH', when: NOON, text: 'Feel it again in the middle of the day' }),
          act({ at: 'fountain', verb: 'TOUCH', when: DUSK, text: 'And once more at dusk' }),
          buy('dukkan_counter', 'paper', 'Buy a sheet of paper'),
          buy('dukkan_counter', 'pencil', 'Buy a pencil'),
          jot({ text: 'Rank the three', need: ['paper', 'pencil'], take: ['paper'], give: ['note_ranking'] })
        ];
      }
    },

    /* ---- 15. the cats ---- */
    {
      id: 'every_cat', weight: 2, tags: ['photo', 'cats'],
      setup: function () { return {}; },
      title: function () { return 'Photograph every cat in the quarter in one afternoon'; },
      fine: function () { return 'There are three. There are always three. They are not always the same three.'; },
      steps: function (p, town) {
        return [
          snapAll({ targets: allCats(town), text: 'Photograph all three cats', give: ['photo'], maxRange: 9 })
        ];
      }
    },

    /* ---- 16. the urchin shells ---- */
    {
      id: 'urchin_count', weight: 2, tags: ['count', 'sea'],
      setup: function (rng) { return { take: rng.int(1, 2) }; },
      title: function () { return 'Count the urchin shells somebody lined up on the sea wall, then take one and put it back the other way round'; },
      fine: function () { return 'Whoever lines them up will notice. They will not say anything.'; },
      steps: function () {
        return [
          act({ at: 'wall_urchins', verb: 'COUNT', text: 'Count the shells' }),
          act({ at: 'wall_urchins', verb: 'TAKE', text: 'Take one', give: ['urchin_shell'] }),
          act({ at: 'wall_urchins', verb: 'PLACE', text: 'Put it back upside down',
            need: ['urchin_shell'], take: ['urchin_shell'] })
        ];
      }
    },

    /* ---- 17. the fig leaf, pressed ---- */
    {
      id: 'pressed_fig_leaf', weight: 2, tags: ['wait', 'plant'],
      setup: function (rng) { return { under: rng.pick(['the soap', 'a tile', 'the jar', 'your shoe']) }; },
      title: function () { return 'Take one leaf from the oldest fig in the quarter and press it flat under something heavy overnight'; },
      fine: function (p) { return 'The oldest. Not the one by the shrine. Press it under ' + p.under + '.'; },
      steps: function () {
        return [
          act({ at: 'square_fig', verb: 'TAKE LEAF', text: 'Take a leaf from the oldest fig',
            give: ['leaf_fig'], decoyKey: 'fig' }),
          act({ at: 'home_windowsill', verb: 'PRESS', text: 'Press it flat at home', need: ['leaf_fig'] }),
          hold({ at: 'home_windowsill', seconds: 60, dayOffset: 1, verb: 'WAIT',
            text: 'Leave it until the morning', take: ['leaf_fig'], give: ['leaf_pressed'] })
        ];
      }
    },

    /* ---- 18. the mooring ring ---- */
    {
      id: 'ring_of_rust', weight: 2, tags: ['scrape', 'iron'],
      setup: function (rng) { return { bag: rng.pick(['bag', 'matchbox']) }; },
      title: function () { return 'Scrape a pinch of rust off the mooring ring in the sea wall and keep it in a matchbox'; },
      fine: function () { return 'A pinch. Not a handful. The ring has been there longer than the wall has been useless.'; },
      steps: function () {
        return [
          buy('dukkan_counter', 'matchbox', 'Buy an empty matchbox'),
          act({ at: 'wall_mooring', verb: 'SCRAPE', text: 'Scrape the ring',
            need: ['matchbox'], give: ['rust_pinch'] })
        ];
      }
    },

    /* ---- 19. the chapel bell, from the square ---- */
    {
      id: 'bell_from_square', weight: 2, tags: ['listen', 'record'],
      setup: function (rng) { return { secs: rng.int(9, 16) }; },
      title: function (p) { return 'Record ' + U.spell(p.secs) + ' seconds of the chapel bell from the fountain square, not from the chapel'; },
      fine: function () { return 'From the square. The whole point is the distance.'; },
      steps: function (p) {
        return [
          hold({ at: 'fountain', seconds: p.secs, still: true, verb: 'LISTEN',
            text: 'Stand at the fountain and listen for the bell', give: ['recording_bells'] })
        ];
      }
    },

    /* ---- 20. the three nails ---- */
    {
      id: 'three_nails', weight: 2, tags: ['search', 'iron'],
      setup: function () { return {}; },
      title: function () { return 'Find three nails of three different lengths in the abandoned house and lay them out shortest to longest'; },
      fine: function () { return 'Three different lengths. Two the same is a failure and you will know.'; },
      steps: function () {
        return [
          find({ at: 'mahjour_room', item: 'nails_three', tries: 6,
            text: 'Search the fallen room for nails' }),
          make({ verb: 'SORT', text: 'Lay them out shortest to longest', need: ['nails_three'] })
        ];
      }
    },

    /* ---- 21. the wire ring ---- */
    {
      id: 'wire_to_the_cup', weight: 2, tags: ['craft', 'fiddly'],
      setup: function () { return {}; },
      title: function () { return 'Wind a length of wire to exactly the rim of a coffee cup from the qahwe'; },
      fine: function () { return 'The cup goes back. The wire does not.'; },
      steps: function () {
        return [
          buy('qahwe_counter', 'coffee', 'Buy a finjan of coffee'),
          buy('qahwe_counter', 'wire_fish', 'Take a length of wire off the chair frame'),
          make({ verb: 'WIND', text: 'Wind the wire to the rim of the cup',
            need: ['coffee', 'wire_fish'], take: ['wire_fish'], give: ['wire_circle'] })
        ];
      }
    },

    /* ---- 22. the shaved soap ---- */
    {
      id: 'shaved_soap', weight: 2, tags: ['craft', 'absurd'],
      setup: function (rng) { return { corner: rng.pick(['top left', 'bottom right', 'the corner nearest the stamp']) }; },
      title: function (p) { return 'Buy a bar of olive-oil soap and shave exactly one corner off it — ' + p.corner; },
      fine: function () { return 'Rita will wrap it. Unwrap it in front of her and do it there.'; },
      steps: function () {
        return [
          buy('sabon_counter', 'soap_bar', 'Buy a bar of soap'),
          make({ at: 'sabon_counter', verb: 'CHIP', text: 'Shave one corner off it',
            need: ['soap_bar'], take: ['soap_bar'], give: ['soap_shaved'] })
        ];
      }
    },

    /* ---- 23. the jasmine, unopened ---- */
    {
      id: 'nine_jasmine', weight: 2, tags: ['gather', 'plant'],
      setup: function (rng) { return { n: rng.int(7, 11) }; },
      title: function (p) { return 'Pick ' + U.spell(p.n) + ' jasmine flowers out of the zaroub, none of them open'; },
      fine: function () { return 'Closed. If one opens in your hand you have to start the count again, and you will not.'; },
      steps: function (p) {
        return [
          gather({ at: 'zaroub_jasmine', item: 'jasmine_head', n: p.n, verb: 'PICK',
            text: 'Pick ' + U.spell(p.n) + ' closed flowers' }),
          make({ verb: 'PLACE', text: 'Set them out on your windowsill', at: 'home_windowsill',
            need: ['jasmine_head'], take: ['jasmine_head'], give: ['jasmine_nine'] })
        ];
      }
    },

    /* ---- 24. the broken tile ---- */
    {
      id: 'the_broken_tile', weight: 2, tags: ['look', 'measure'],
      setup: function (rng) { return { knots: rng.int(1, 3) }; },
      title: function () { return 'Measure the crack in the one broken tile in the fountain square with twine, and knot the twine at the measurement'; },
      fine: function (p) { return U.cap(U.spell(p.knots)) + ' knot' + (p.knots > 1 ? 's' : '') + '. The crack has not moved in forty years.'; },
      steps: function () {
        return [
          buy('dukkan_counter', 'twine', 'Buy a ball of twine'),
          act({ at: 'square_tile', verb: 'MEASURE', text: 'Lay the twine along the crack', need: ['twine'] }),
          make({ verb: 'KNOT', text: 'Knot the twine at the measurement',
            need: ['twine'], take: ['twine'], give: ['twine_measure'] })
        ];
      }
    },

    /* ---- 25. the wires ---- */
    {
      id: 'count_the_wires', weight: 2, tags: ['count', 'photo'],
      setup: function () { return {}; },
      title: function () { return 'Count the wires leaving the pole on the souk, then photograph it so you can be told you are wrong'; },
      fine: function () { return 'Nobody agrees on the number. Everybody has a number.'; },
      steps: function () {
        return [
          act({ at: 'souk_wires', verb: 'COUNT', text: 'Count the wires' }),
          snap({ target: 'souk_wires', text: 'Photograph the knot of wires', give: ['photo'], maxRange: 9 })
        ];
      }
    },

    /* ---- 26. the generator ---- */
    {
      id: 'generator_changes_mind', weight: 2, tags: ['listen', 'wait'],
      setup: function (rng) { return { secs: rng.int(18, 30) }; },
      title: function () { return 'Stand by the generator until it changes its mind, and record the moment it does'; },
      fine: function () { return 'It changes its mind about twice an hour. You will hear it before you notice it.'; },
      steps: function (p) {
        return [
          hold({ at: 'souk_generator', seconds: p.secs, still: true, verb: 'LISTEN',
            text: 'Wait for the generator to falter', give: ['recording_gen'] })
        ];
      }
    },

    /* ---- 27. the capers ---- */
    {
      id: 'caper_piles', weight: 2, tags: ['gather', 'count'],
      setup: function () { return {}; },
      title: function () { return 'Take the pods off one caper plant in the sea wall and count the seed into two equal piles'; },
      fine: function () { return 'One plant. If the count is odd, one seed goes in your pocket and the piles are equal.'; },
      steps: function () {
        return [
          act({ at: 'wall_capers', verb: 'PICK', text: 'Take the pods off one caper', give: ['caper_pods'] }),
          make({ verb: 'SORT', text: 'Count the seed into two equal piles',
            need: ['caper_pods'], take: ['caper_pods'], give: ['caper_split'] })
        ];
      }
    },

    /* ---- 28. the warm stone ---- */
    {
      id: 'warmest_stone', weight: 2, tags: ['touch', 'absurd'],
      setup: function (rng) { return { side: rng.pick(['south', 'west']) }; },
      title: function (p) { return 'Find the warmest stone on the ' + p.side + ' wall of the abandoned house in the afternoon'; },
      fine: function () { return 'With the back of your hand. The front of your hand is no good for this and everyone knows it.'; },
      steps: function () {
        return [
          act({ at: 'mahjour_room', verb: 'TOUCH', when: { h0: 14.5, h1: 17.5, label: 'in the afternoon' },
            text: 'Feel along the wall for the warmest stone' })
        ];
      }
    },

    /* ---- 29. the laundry ---- */
    {
      id: 'count_the_washing', weight: 2, tags: ['count', 'photo'],
      setup: function (rng) { return { item: rng.pick(['socks', 'shirts', 'pegs', 'things that are white']) }; },
      title: function (p) { return 'Count the ' + p.item + ' on the line across Darb el Aaliye before anybody takes it in'; },
      fine: function () { return 'Before they take it in. After that the number is a memory and does not count.'; },
      steps: function () {
        return [
          act({ at: 'aliya_laundry', verb: 'COUNT', when: { h0: 8.0, h1: 16.0, label: 'while it is still out' },
            text: 'Count the washing' }),
          snap({ target: 'aliya_laundry', text: 'Photograph the line', give: ['photo'], maxRange: 10 })
        ];
      }
    },

    /* ---- 30. the shrine ---- */
    {
      id: 'stone_in_the_niche', weight: 2, tags: ['place', 'quiet'],
      setup: function (rng) { return { word: rng.pick(['sorry', 'again', 'thank you', 'nothing']) }; },
      title: function () { return 'Choose one stone off the shore, carry it to the niche in the fountain square, and leave it there'; },
      fine: function (p) { return 'Say one word when you put it down. Say "' + p.word + '". Nobody is listening.'; },
      steps: function () {
        return [
          find({ at: 'shore_clay', item: 'stone_niche', tries: 3, verb: 'SEARCH',
            text: 'Choose a stone off the shore' }),
          act({ at: 'square_shrine', verb: 'PLACE', text: 'Leave the stone in the niche',
            need: ['stone_niche'], take: ['stone_niche'] }),
          act({ at: 'square_shrine', verb: 'SPEAK', text: 'Say the word', witnessed: true })
        ];
      }
    }
  ];

  ER.QuestPoolA = POOL;
})(typeof window !== 'undefined' ? (window.ER = window.ER || {}) : (global.ER = global.ER || {}));
