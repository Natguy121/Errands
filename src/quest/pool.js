/* Errands — the pool.
 *
 * Forty-six templates. Each one randomises its own specifics, so the pool
 * generates errands in the thousands. No template rewards you. No template
 * refers to any other template. There is no order and there is no end.
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

  function anyGrave(rng, town) {
    return rng.pick(town.cemetery.graves).id;
  }
  function anyDish(rng, town) {
    var ids = [];
    for (var i = 0; i < town.propList.length; i++)
      if (town.propList[i].tags.indexOf('dish') >= 0) ids.push(town.propList[i].id);
    return rng.pick(ids);
  }
  function allDishes(town) {
    var ids = [];
    for (var i = 0; i < town.propList.length; i++)
      if (town.propList[i].tags.indexOf('dish') >= 0) ids.push(town.propList[i].id);
    return ids;
  }
  function anyDandelion(rng) { return rng.pick(['dandelion_park', 'dandelion_ballfield', 'dandelion_cr9']); }
  function anyMilkweed(rng) { return rng.pick(['milkweed_grade', 'milkweed_pasture']); }
  function anyDitch(rng) { return rng.pick(['ditch_cr9', 'ditch_cr9_east']); }
  function anyFencepost(rng) { return rng.pick(['fencepost_0', 'fencepost_1', 'fencepost_2', 'fencepost_3']); }

  /* ================================================================== *
   *  THE POOL
   * ================================================================== */

  var POOL = [

    /* ---- 1. the one about the jar ---- */
    {
      id: 'jar_of_creek_water', weight: 3, tags: ['water', 'fiddly'],
      setup: function (rng) { return { knots: rng.int(2, 4) }; },
      title: function () { return 'Collect exactly one glass jar of water from the shallow bend beneath the concrete bridge, seal it, and wrap twine around the rim'; },
      fine: function (p) { return 'It must be the shallow bend. The deep bend is wrong. ' + U.cap(U.spell(p.knots)) + ' turns of twine, no more.'; },
      steps: function (p) {
        return [
          buy('bendmart_counter', 'jar_empty', 'Buy a glass pint jar at Bend Mart', 'A pint. Not a quart.'),
          buy('bendmart_counter', 'twine', 'Buy a ball of twine while you are in there'),
          act({ at: 'creek_shallow_bend', verb: 'FILL', text: 'Fill the jar at the shallow bend beneath the concrete bridge',
            need: ['jar_empty'], take: ['jar_empty'], give: ['jar_creek'], decoyKey: 'bend' }),
          make({ verb: 'SEAL', text: 'Seal the jar', need: ['jar_creek'], take: ['jar_creek'], give: ['jar_creek_sealed'] }),
          make({ verb: 'WRAP', text: 'Wrap ' + U.spell(p.knots) + ' turns of twine around the rim',
            need: ['jar_creek_sealed', 'twine'], take: ['jar_creek_sealed'], give: ['jar_creek_twined'] })
        ];
      }
    },

    /* ---- 2. the rusted nail ---- */
    {
      id: 'rusted_nail', weight: 3, tags: ['ruin', 'iron'],
      setup: function () { return {}; },
      title: function () { return "Find a rusted nail in the most collapsed room of the Vandermeer place"; },
      fine: function () { return 'The northeast room, where the ceiling came down in 2011. Square nails do not count. It has to be rusted through.'; },
      steps: function () {
        return [
          find({ at: 'farmhouse_collapsed', item: 'nail_rusted', tries: 4,
            text: 'Search the collapsed northeast room', fine: 'Mind the joists.' })
        ];
      }
    },

    /* ---- 3. the iron spike ---- */
    {
      id: 'iron_spike', weight: 3, tags: ['rail', 'iron'],
      setup: function (rng) { return { markers: rng.int(3, 5) }; },
      title: function () { return 'Walk the old railroad grade and find a discarded iron spike'; },
      fine: function (p) { return 'Walk it. Do not drive around to the far end. There are ' + U.spell(p.markers) + ' markers to pass.'; },
      steps: function (p) {
        var wps = [];
        for (var i = 0; i < p.markers; i++) wps.push('rail_walk_' + i);
        return [
          trek({ waypoints: wps, text: 'Walk the grade past ' + U.spell(p.markers) + ' markers', fine: 'West end to east.' }),
          find({ at: 'rail_ballast', item: 'spike_iron', tries: 5, text: 'Search the ballast for a discarded spike' })
        ];
      }
    },

    /* ---- 4. the gravestone at dusk ---- */
    {
      id: 'grave_rubbing_dusk', weight: 3, tags: ['cemetery', 'dusk'],
      setup: function (rng, town) { return { grave: anyGrave(rng, town) }; },
      title: function (p, town) {
        var g = town.props[p.grave].grave;
        return 'Visit the cemetery at dusk and trace the engraving on ' + g.first + ' ' + g.last + "'s stone";
      },
      fine: function (p, town) {
        var g = town.props[p.grave].grave;
        return g.born + '–' + g.died + '. Dusk specifically. Not afternoon and not dark.';
      },
      steps: function (p) {
        return [
          buy('hardware_counter', 'paper', 'Buy a sheet of paper'),
          buy('hardware_counter', 'pencil', 'Buy a carpenter pencil'),
          act({ at: p.grave, verb: 'TRACE', text: 'Trace the engraving', when: DUSK,
            need: ['paper', 'pencil'], take: ['paper'], give: ['rubbing'], fine: 'Side of the lead, not the point.' })
        ];
      }
    },

    /* ---- 5. moss, with a spoon ---- */
    {
      id: 'moss_with_spoon', weight: 3, tags: ['bridge', 'moss'],
      setup: function (rng) { return { side: rng.pick(['upstream', 'downstream']) }; },
      title: function () { return 'Scrape moss off the old stone bridge with a spoon'; },
      fine: function (p) { return 'The ' + p.side + ' face. A spoon. Not a knife, not a stick, not your thumbnail.'; },
      steps: function () {
        return [
          buy('bendmart_counter', 'spoon', 'Acquire a spoon', 'The plastic ones by the coffee are free, which is not the same as acquiring one.'),
          act({ at: 'bridge_stone_moss', verb: 'SCRAPE', text: 'Scrape the moss into the spoon',
            need: ['spoon'], take: ['spoon'], give: ['spoon_mossy'] })
        ];
      }
    },

    /* ---- 6. the flattened cap ---- */
    {
      id: 'flattened_cap', weight: 3, tags: ['lot', 'search'],
      setup: function () { return {}; },
      title: function () { return 'Search the old feed store lot for a flattened bottle cap of the pre-twist-off kind'; },
      fine: function () { return 'Crimped edge, twenty-one teeth. If it unscrews it is not old enough and you will know.'; },
      steps: function () {
        return [
          find({ at: 'oldlot', item: 'cap_flattened', tries: 5, text: 'Search the cracked asphalt' })
        ];
      }
    },

    /* ---- 7. the clay die ---- */
    {
      id: 'clay_die', weight: 3, tags: ['clay', 'home', 'overnight'],
      setup: function (rng) { return { pips: rng.pick([6, 6, 6, 4, 8, 20]) }; },
      title: function (p) { return 'Shape wild clay into a ' + p.pips + '-sided die and sun-dry it on your windowsill'; },
      fine: function (p) { return 'Dug clay, not bought clay. ' + (p.pips === 20 ? 'Twenty faces. You will get most of them.' : 'It will not be square. Nothing is.'); },
      steps: function () {
        return [
          act({ at: 'clay_bank', verb: 'DIG', text: 'Dig clay out of the cut bank at the end of Old Mill Road', give: ['clay_wild'] }),
          make({ verb: 'SHAPE', text: 'Shape the clay into a die', need: ['clay_wild'], take: ['clay_wild'], give: ['clay_die'] }),
          act({ at: 'home_windowsill', verb: 'PLACE', text: 'Put it on your windowsill', need: ['clay_die'] }),
          act({ at: 'home_windowsill', verb: 'TAKE', text: 'Collect it once the sun has had a day with it',
            dayOffset: 1, need: ['clay_die'], take: ['clay_die'], give: ['clay_die_dry'],
            fine: 'Tomorrow. Not tonight.' })
        ];
      }
    },

    /* ---- 8. the dying streetlamp ---- */
    {
      id: 'lamp_photo_bw', weight: 3, tags: ['photo', 'night'],
      setup: function (rng) { return { cycles: rng.int(2, 4) }; },
      title: function () { return 'Photograph the dying streetlamp on Quarry Road and edit the photograph to high-contrast black and white'; },
      fine: function (p) { return 'Wait for it to cycle dark ' + U.spell(p.cycles) + ' times first. It is not broken, it is dying, and those are different.'; },
      steps: function (p) {
        return [
          hold({ at: 'streetlamp_dying', seconds: 6 + p.cycles * 4, when: NIGHT, still: true,
            text: 'Stand under the lamp until it cycles dark ' + U.spell(p.cycles) + ' times' }),
          snap({ target: 'streetlamp_dying', when: NIGHT, text: 'Photograph the lamp', give: ['photo'] }),
          retouch({ filter: 'bw', text: 'Edit the photograph to high-contrast black and white',
            fine: 'Open the journal. Press 1.' })
        ];
      }
    },

    /* ---- 9. ladder rungs ---- */
    {
      id: 'count_rungs', weight: 2, tags: ['count', 'tower'],
      setup: function (rng) { return { from: rng.pick(['the ground', 'the gravel', 'directly beneath it']) }; },
      title: function (p) { return "Count the rungs on the water tower's ladder from " + p.from + ", then write the number on the back of a Bend Mart receipt"; },
      fine: function () { return 'From the ground. Do not climb it. The cage counts as rungs; the cage is the point.'; },
      steps: function () {
        return [
          buy('bendmart_counter', 'receipt', 'Get a receipt from Bend Mart', 'Buy anything. Buy the cheapest thing.'),
          act({ at: 'watertower_ladder', verb: 'COUNT', text: 'Count the rungs from the ground', need: ['receipt'] }),
          jot({ verb: 'WRITE', text: 'Write the number on the back of the receipt',
            need: ['receipt'], take: ['receipt'], give: ['receipt_numbered'] })
        ];
      }
    },

    /* ---- 10. three gravels ---- */
    {
      id: 'sort_gravel', weight: 2, tags: ['rail', 'sort'],
      setup: function (rng) { return { n: 3, order: rng.pick(['lightest to darkest', 'darkest to lightest']) }; },
      title: function (p) { return 'Collect three gravels of three different colours from the railroad ballast and sort them into a matchbox, ' + p.order; },
      fine: function () { return 'Three colours, not three stones. Grey does not count twice.'; },
      steps: function (p) {
        return [
          buy('bendmart_counter', 'matchbox', 'Get an empty matchbox'),
          gather({ at: 'rail_ballast', item: 'stone_marker', n: 3, verb: 'PICK',
            text: 'Pick three gravels of three different colours', fine: 'Wet them to tell. Everything is grey dry.' }),
          jot({ verb: 'SORT', text: 'Sort them into the matchbox, ' + p.order,
            need: ['matchbox'], take: ['matchbox', 'stone_marker', 'stone_marker', 'stone_marker'], give: ['gravel_sorted'] })
        ];
      }
    },

    /* ---- 11. eleven seconds ---- */
    {
      id: 'eleven_seconds', weight: 2, tags: ['bridge', 'time', 'audio'],
      setup: function (rng) {
        var h = rng.int(6, 20), m = rng.pick([7, 11, 14, 19, 23, 37, 41, 53]);
        return { h: h, m: m, secs: rng.pick([11, 11, 11, 13, 17]) };
      },
      title: function (p) {
        return 'Stand at the exact centre of the concrete bridge at ' + U.clock(p.h, p.m) +
          ' and record ' + U.spell(p.secs) + ' seconds of whatever is happening';
      },
      fine: function (p) { return 'The centre. Pace it off if you have to. ' + U.cap(U.spell(p.secs)) + ' seconds, and if a truck comes, that is the recording.'; },
      steps: function (p) {
        var w = { h0: p.h + p.m / 60 - 0.18, h1: p.h + p.m / 60 + 0.25, label: 'at ' + U.clock(p.h, p.m) };
        return [
          hold({ at: 'bridge_concrete_center', seconds: p.secs, when: w, still: true, verb: 'RECORD',
            text: 'Record ' + U.spell(p.secs) + ' seconds from the centre of the bridge', give: ['recording_bridge'] })
        ];
      }
    },

    /* ---- 12. the unmatched sock ---- */
    {
      id: 'lone_sock', weight: 2, tags: ['laundromat', 'absurd'],
      setup: function () { return {}; },
      title: function () { return "Take one sock from the laundromat's lost-and-found, establish that it matches nothing, and fold it anyway"; },
      fine: function () { return 'One sock. Check it against the whole bin. Then fold it as though it had a partner.'; },
      steps: function () {
        return [
          find({ at: 'laundromat_lostfound', item: 'sock', tries: 2, text: 'Dig a sock out of the lost-and-found bin' }),
          act({ at: 'laundromat_lostfound', verb: 'SEARCH', text: 'Check it against every other sock in the bin', need: ['sock'], hold: 5.0 }),
          make({ verb: 'FOLD', text: 'Fold it anyway', need: ['sock'], take: ['sock'], give: ['sock_folded'] })
        ];
      }
    },

    /* ---- 13. measuring the diner step ---- */
    {
      id: 'measure_step', weight: 2, tags: ['diner', 'measure'],
      setup: function (rng) { return { what: rng.pick(['width', 'depth', 'rise']) }; },
      title: function (p) { return "Measure the " + p.what + " of the diner's front step with twine, knot the twine at the measurement, and keep the twine"; },
      fine: function () { return 'Keep it. There is no plan for it. Keep it.'; },
      steps: function (p) {
        return [
          buy('bendmart_counter', 'twine', 'Buy twine'),
          act({ at: 'diner_step', verb: 'MEASURE', text: 'Lay the twine across the ' + p.what + ' of the step', need: ['twine'] }),
          make({ verb: 'KNOT', text: 'Knot the twine at the measurement', need: ['twine'], take: ['twine'], give: ['twine_measure'] })
        ];
      }
    },

    /* ---- 14. photograph every dish ---- */
    {
      id: 'dishes_from_below', weight: 2, tags: ['photo', 'walking'],
      setup: function (rng, town) {
        var all = allDishes(town);
        var n = Math.min(all.length, rng.int(4, 7));
        return { targets: rng.picks(all, n), n: n };
      },
      title: function (p) { return 'Photograph ' + U.spell(p.n) + ' of the satellite dishes in town from directly below'; },
      fine: function () { return 'Directly below. If the yard has a dog, that is between you and the dog.'; },
      steps: function (p) {
        return [
          snapAll({ targets: p.targets, text: 'Photograph ' + U.spell(p.n) + ' dishes from underneath', maxRange: 7 })
        ];
      }
    },

    /* ---- 15. dust off the storage doors ---- */
    {
      id: 'storage_dust', weight: 2, tags: ['dust'],
      setup: function () { return {}; },
      title: function () { return 'Fill a sandwich bag with the dust from the tops of the self-storage unit doors'; },
      fine: function () { return 'The tops. Where nobody has ever wiped. You will need to reach.'; },
      steps: function () {
        return [
          buy('bendmart_counter', 'baggie', 'Get a sandwich bag'),
          act({ at: 'storage_doors', verb: 'WIPE', text: 'Wipe the tops of the doors into the bag',
            need: ['baggie'], take: ['baggie'], give: ['baggie_dust'], hold: 4.4 })
        ];
      }
    },

    /* ---- 16. the paint chip ---- */
    {
      id: 'paint_chip_match', weight: 2, tags: ['ballfield', 'colour'],
      setup: function (rng) { return { where: rng.pick(['the hydrant with the worst paint', 'the bad hoop at the park', 'the padlocked feed store door']) }; },
      title: function () { return "Scrape a paint chip off the ballfield backstop's corner post"; },
      fine: function (p) { return 'Then go hold it up against ' + p.where + ' until you are satisfied about it.'; },
      steps: function (p, town) {
        var target = p.where.indexOf('hydrant') >= 0 ? town.worstHydrant
          : p.where.indexOf('hoop') >= 0 ? 'park_hoop' : 'feedstore_door';
        return [
          act({ at: 'ballfield_backstop', verb: 'SCRAPE', text: 'Scrape a chip off the corner post', give: ['paintchip'] }),
          act({ at: target, verb: 'HOLD', text: 'Hold the chip against ' + p.where, need: ['paintchip'] })
        ];
      }
    },

    /* ---- 17. penny on the rail ---- */
    {
      id: 'penny_on_rail', weight: 2, tags: ['rail', 'overnight'],
      setup: function () { return {}; },
      title: function () { return 'Find a penny in the Bend Mart lot, lay it on the old rail, and come back for it tomorrow'; },
      fine: function () { return 'Nothing runs on that rail and has not since 1986. Come back tomorrow anyway.'; },
      steps: function () {
        return [
          find({ at: 'bendmart_lot', item: 'penny', tries: 4, text: 'Search the Bend Mart lot for a penny' }),
          act({ at: 'rail_rust', verb: 'PLACE', text: 'Lay the penny on the rail', need: ['penny'], take: ['penny'] }),
          act({ at: 'rail_rust', verb: 'TAKE', text: 'Come back for it tomorrow', dayOffset: 1, give: ['penny_flat'],
            fine: 'It will be exactly as you left it. That is the finding.' })
        ];
      }
    },

    /* ---- 18. forty acorns, four discarded ---- */
    {
      id: 'forty_acorns', weight: 2, tags: ['gather', 'absurd'],
      setup: function (rng) { return { total: rng.pick([40, 40, 36, 44]), drop: rng.int(3, 5) }; },
      title: function (p) { return 'Collect exactly ' + U.spell(p.total) + ' acorns under the oaks by the cemetery, then discard the ' + U.spell(p.drop) + ' heaviest'; },
      fine: function (p) { return 'Weigh them in your hand. You will be wrong about at least one. Keep ' + (p.total - p.drop) + '.'; },
      steps: function (p) {
        return [
          gather({ at: 'acorn_ground', item: 'acorn', n: p.total, verb: 'PICK',
            text: 'Pick ' + U.spell(p.total) + ' acorns' }),
          jot({ verb: 'DISCARD', text: 'Discard the ' + U.spell(p.drop) + ' heaviest',
            need: ['acorn'], takeCount: { item: 'acorn', n: p.total }, give: ['acorns_kept'] })
        ];
      }
    },

    /* ---- 19. wire ring ---- */
    {
      id: 'wire_ring', weight: 2, tags: ['craft'],
      setup: function (rng) { return { ref: rng.pick(['a coffee cup rim', 'the mouth of a pint jar', 'the top of a fence post']) }; },
      title: function (p) { return 'Wind a length of baling wire into a circle the size of ' + p.ref; },
      fine: function () { return 'It will be an oval. Wind it again.'; },
      steps: function () {
        return [
          buy('hardware_counter', 'wire_bale', 'Buy a length of baling wire off the spool'),
          make({ verb: 'WIND', text: 'Wind it into a circle', need: ['wire_bale'], take: ['wire_bale'], give: ['wire_circle'], hold: 5.6 })
        ];
      }
    },

    /* ---- 20. the bulletin board, aloud ---- */
    {
      id: 'read_board_aloud', weight: 2, tags: ['public', 'absurd'],
      setup: function () { return {}; },
      title: function () { return 'Read the entire post office bulletin board aloud'; },
      fine: function () { return 'All of it. Do not skip the dog.'; },
      steps: function () {
        return [
          act({ at: 'postoffice_board', verb: 'READ ALOUD', text: 'Read the board aloud, all of it', hold: 8.0, witnessed: true })
        ];
      }
    },

    /* ---- 21. one full rain shower ---- */
    {
      id: 'sit_out_rain', weight: 2, tags: ['weather', 'meditative'],
      setup: function (rng) { return { spot: rng.pick(['busstop', 'park_pavilion', 'home_porch']) }; },
      title: function (p, town) { return 'Sit in ' + town.props[p.spot].name + ' for the length of one full rain shower'; },
      fine: function () { return 'Until it stops. If it does not stop, that is also an answer.'; },
      steps: function (p) {
        return [
          hold({ at: p.spot, seconds: 30, weather: WET, verb: 'SIT', still: true,
            text: 'Sit it out', fine: 'It has to actually be raining.' })
        ];
      }
    },

    /* ---- 22. the tower's shadow ---- */
    {
      id: 'tower_shadow', weight: 2, tags: ['time', 'mark'],
      setup: function (rng) { return { h: rng.pick([16, 17, 17, 18]) }; },
      title: function (p) { return "Find where the cell tower's shadow crosses Quarry Road at " + U.clock(p.h, 0) + ' and mark the spot with a stone'; },
      fine: function () { return 'A stone you chose. Not the nearest stone.'; },
      steps: function (p) {
        var w = { h0: p.h - 0.4, h1: p.h + 0.6, label: 'around ' + U.clock(p.h, 0) };
        return [
          gather({ at: 'rail_ballast', item: 'stone_marker', n: 1, verb: 'PICK', text: 'Choose a stone' }),
          act({ at: 'celltower_shadow', verb: 'MARK', text: "Mark where the shadow crosses the road", when: w,
            need: ['stone_marker'], take: ['stone_marker'] })
        ];
      }
    },

    /* ---- 23. pond water, settled ---- */
    {
      id: 'pond_settle', weight: 2, tags: ['water', 'home', 'overnight'],
      setup: function () { return {}; },
      title: function () { return 'Collect a jar of pond water and let it settle on your windowsill until you can see through it'; },
      fine: function () { return 'Do not shake it to check. Checking is shaking.'; },
      steps: function () {
        return [
          buy('bendmart_counter', 'jar_empty', 'Buy a jar'),
          act({ at: 'pond_edge', verb: 'FILL', text: 'Fill it at the pond', need: ['jar_empty'], take: ['jar_empty'], give: ['jar_pond'] }),
          act({ at: 'home_windowsill', verb: 'PLACE', text: 'Set it on the windowsill', need: ['jar_pond'] }),
          act({ at: 'home_windowsill', verb: 'TAKE', text: 'Look at it tomorrow', dayOffset: 1,
            need: ['jar_pond'], take: ['jar_pond'], give: ['jar_pond_settled'] })
        ];
      }
    },

    /* ---- 24. the cornerstone rubbing ---- */
    {
      id: 'cornerstone_rubbing', weight: 2, tags: ['civic', 'paper'],
      setup: function () { return {}; },
      title: function () { return 'Take a rubbing of the date on the town hall cornerstone using paper and the side of a pencil'; },
      fine: function () { return 'The side. Using the point is a drawing, not a rubbing.'; },
      steps: function () {
        return [
          buy('hardware_counter', 'paper', 'Buy paper'),
          buy('hardware_counter', 'pencil', 'Buy a pencil'),
          act({ at: 'townhall_cornerstone', verb: 'RUB', text: 'Rub the date through the paper',
            need: ['paper', 'pencil'], take: ['paper'], give: ['rubbing'] })
        ];
      }
    },

    /* ---- 25. hubcap on a fence post ---- */
    {
      id: 'hubcap_balance', weight: 2, tags: ['ditch', 'absurd'],
      setup: function (rng) { return { ditch: anyDitch(rng), post: anyFencepost(rng) }; },
      title: function () { return 'Find a hubcap in the ditch along County Road 9 and balance it on a fence post'; },
      fine: function () { return 'Balance, not hang. It should be able to fall and choose not to.'; },
      steps: function (p) {
        return [
          find({ at: p.ditch, item: 'hubcap', tries: 4, text: 'Search the ditch for a hubcap' }),
          act({ at: p.post, verb: 'BALANCE', text: 'Balance it on a fence post', need: ['hubcap'], take: ['hubcap'] })
        ];
      }
    },

    /* ---- 26. the correct mint ---- */
    {
      id: 'church_mint', weight: 2, tags: ['plant', 'precision'],
      setup: function () { return {}; },
      title: function () { return 'Pick the mint growing behind the church'; },
      fine: function () { return 'Behind the church. Not the mint behind the diner. They are the same plant and this is not the point.'; },
      steps: function () {
        return [
          act({ at: 'church_mint', verb: 'PICK', text: 'Pick the church mint', give: ['mint_church'], decoyKey: 'mint' })
        ];
      }
    },

    /* ---- 27. the drain that echoes ---- */
    {
      id: 'echo_drain', weight: 2, tags: ['absurd', 'sound'],
      setup: function (rng) { return { word: rng.pick(['your own name', 'the name of the town', 'one word of your choosing, and mean it', '"hello", flatly', 'the day of the week']) }; },
      title: function (p) { return 'Find the storm drain on Depot Street that echoes and say ' + p.word + ' into it'; },
      fine: function () { return 'Only one of the drains echoes. The others are just drains, and you will have to check.'; },
      steps: function () {
        return [
          act({ at: 'storm_drain_echo', verb: 'SPEAK', text: 'Say it into the drain', decoyKey: 'echo', witnessed: true })
        ];
      }
    },

    /* ---- 28. three nails in a row ---- */
    {
      id: 'three_nails', weight: 2, tags: ['construction', 'sort'],
      setup: function (rng) { return { order: rng.pick(['shortest first', 'longest first']) }; },
      title: function (p) { return 'Find three nails of three different lengths in the scrap pile on Elm Court and stand them in a row, ' + p.order; },
      fine: function () { return 'Standing. On their heads. On gravel. Yes.'; },
      steps: function (p) {
        return [
          gather({ at: 'construction_scrap', item: 'nail_rusted', n: 3, verb: 'SEARCH',
            text: 'Find three nails of three different lengths', hold: 2.4 }),
          jot({ verb: 'SORT', text: 'Stand them in a row, ' + p.order,
            need: ['nail_rusted'], takeCount: { item: 'nail_rusted', n: 3 }, give: ['nails_three'] })
        ];
      }
    },

    /* ---- 29. the cicada skin ---- */
    {
      id: 'cicada_skin', weight: 2, tags: ['woods', 'delicate'],
      setup: function () { return {}; },
      title: function () { return 'Collect the dried skin of one cicada from the treeline, intact'; },
      fine: function () { return 'Intact. The legs are the problem. The legs are always the problem.'; },
      steps: function () {
        return [
          find({ at: 'treeline', item: 'cicada_skin', tries: 5, text: 'Search the treeline for a cicada skin' })
        ];
      }
    },

    /* ---- 30. the OPEN sign, off ---- */
    {
      id: 'sign_off_photo', weight: 2, tags: ['photo', 'night'],
      setup: function () { return {}; },
      title: function () { return "Photograph the diner's OPEN sign while it is off"; },
      fine: function () { return 'It goes off at eight. The photograph has to be of the sign, not of the window.'; },
      steps: function () {
        return [
          snap({ target: 'diner_sign', when: { h0: 20.2, h1: 5.5, label: 'after the diner closes' },
            text: 'Photograph the sign, off', give: ['photo'], maxRange: 12 })
        ];
      }
    }
  ];

  ER.QuestPoolA = POOL;
})(typeof window !== 'undefined' ? (window.ER = window.ER || {}) : (global.ER = global.ER || {}));
