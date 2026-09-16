/* Errands — the pool, continued. */
(function (ER) {
  'use strict';
  var U = ER.U;

  function step(o) { o.need = o.need || []; o.take = o.take || []; o.give = o.give || []; return o; }
  function buy(s, i, t, f) { return step({ kind: 'buy', at: s, verb: 'BUY', item: i, give: [i], text: t, fine: f }); }
  function act(o) { o.kind = 'act'; return step(o); }
  function find(o) { o.kind = 'search'; o.verb = o.verb || 'SEARCH'; return step(o); }
  function gather(o) { o.kind = 'gather'; o.verb = o.verb || 'PICK'; return step(o); }
  function hold(o) { o.kind = 'wait'; o.verb = o.verb || 'WAIT'; return step(o); }
  function make(o) { o.kind = 'craft'; o.at = o.at || 'ANY'; return step(o); }
  function snap(o) { o.kind = 'photo'; o.verb = 'PHOTOGRAPH'; return step(o); }
  function retouch(o) { o.kind = 'edit'; return step(o); }
  function trek(o) { o.kind = 'walk'; return step(o); }
  function jot(o) { o.kind = 'note'; o.at = o.at || 'ANY'; o.verb = o.verb || 'WRITE'; return step(o); }

  var DUSK = { h0: 18.4, h1: 20.1, label: 'at dusk' };
  var PREDAWN = { h0: 4.6, h1: 6.7, label: 'before sunrise' };
  var NOON = { h0: 11.8, h1: 13.5, label: 'in the middle of the day' };
  var WET = ['rain', 'drizzle', 'storm'];

  function anyDitch(rng) { return rng.pick(['ditch_cr9', 'ditch_cr9_east']); }
  function anyFencepost(rng) { return rng.pick(['fencepost_0', 'fencepost_1', 'fencepost_2', 'fencepost_3']); }
  function anyDandelion(rng) { return rng.pick(['dandelion_park', 'dandelion_ballfield', 'dandelion_cr9']); }
  function anyMilkweed(rng) { return rng.pick(['milkweed_grade', 'milkweed_pasture']); }

  var POOL = [

    /* ---- 31. peel a label in one piece ---- */
    {
      id: 'peel_label', weight: 2, tags: ['recycling', 'delicate'],
      setup: function () { return {}; },
      title: function () { return 'Find a bottle in the recycling drop-off with its label still perfectly intact, and peel the label off in one piece'; },
      fine: function () { return 'One piece. If it tears you start over with a different bottle, which is the same as starting over.'; },
      steps: function () {
        return [
          find({ at: 'recycling_bins', item: 'bottle_labeled', tries: 4, text: 'Find a bottle with a perfect label' }),
          make({ verb: 'PEEL', text: 'Peel the label off in one piece', need: ['bottle_labeled'],
            take: ['bottle_labeled'], give: ['label_peeled'], hold: 6.0 })
        ];
      }
    },

    /* ---- 32. the grade, without the ties ---- */
    {
      id: 'walk_no_ties', weight: 2, tags: ['rail', 'endurance'],
      setup: function () { return {}; },
      title: function () { return 'Walk the entire length of the old railroad grade without stepping on a tie'; },
      fine: function () { return 'Pick your steps. If you run you will step on one, and you will know you did.'; },
      steps: function () {
        return [
          trek({ waypoints: ['rail_walk_0', 'rail_walk_1', 'rail_walk_2', 'rail_walk_3', 'rail_walk_4', 'rail_walk_5'],
            noRun: true, text: 'Walk the grade end to end, choosing every step',
            fine: 'Running resets it. So does leaving the ballast.' })
        ];
      }
    },

    /* ---- 33. frost off a windshield ---- */
    {
      id: 'frost_jar', weight: 2, tags: ['weather', 'water', 'rare'],
      setup: function () { return {}; },
      title: function () { return "Scrape the frost off a car windshield into a jar before sunrise, and seal it"; },
      fine: function () { return 'Somebody’s actual windshield. It has to be frost and it has to be before the sun gets on it.'; },
      steps: function () {
        return [
          buy('bendmart_counter', 'jar_empty', 'Buy a jar the night before'),
          act({ at: { tag: 'car' }, verb: 'SCRAPE', text: 'Scrape frost off a windshield into the jar',
            when: PREDAWN, weather: ['frost'], need: ['jar_empty'], take: ['jar_empty'], give: ['jar_frost'],
            fine: 'Any car in any driveway. Quietly.' }),
          make({ verb: 'SEAL', text: 'Seal it before it goes', need: ['jar_frost'] })
        ];
      }
    },

    /* ---- 34. a stone on the oldest grave ---- */
    {
      id: 'stone_on_oldest', weight: 2, tags: ['cemetery'],
      setup: function (rng, town) { return { grave: town.earliestGrave }; },
      title: function (p, town) {
        var g = town.props[p.grave].grave;
        return 'Find the grave with the earliest date in Hollis Bend Cemetery and leave a stone on it';
      },
      fine: function (p, town) {
        var g = town.props[p.grave].grave;
        return 'You will have to read all of them to be sure. The answer is ' + g.died + ', and you still have to read all of them.';
      },
      steps: function (p) {
        return [
          gather({ at: 'rail_ballast', item: 'stone_grave', n: 1, verb: 'PICK', text: 'Pick up a stone somewhere else first' }),
          act({ at: 'cemetery_gate', verb: 'ENTER', text: 'Go in at the gate' }),
          act({ at: p.grave, verb: 'LEAVE', text: 'Leave the stone on the earliest grave',
            need: ['stone_grave'], take: ['stone_grave'] })
        ];
      }
    },

    /* ---- 35. the third arch stone ---- */
    {
      id: 'mortar_chip', weight: 2, tags: ['bridge', 'stone'],
      setup: function (rng) { return { which: rng.pick(['third', 'fourth', 'second']), side: rng.pick(['left', 'right']) }; },
      title: function (p) { return 'Chip a piece of mortar from the ' + p.which + ' arch stone from the ' + p.side + ' on the underside of the stone bridge'; },
      fine: function (p) { return 'From the ' + p.side + '. Facing the bridge, not facing the water.'; },
      steps: function () {
        return [
          buy('hardware_counter', 'spoon', 'Borrow the break-room spoon from Pell Hardware', 'Curtis wants it back.'),
          act({ at: 'bridge_stone_arch', verb: 'CHIP', text: 'Chip out a piece of mortar',
            need: ['spoon'], give: ['mortar_chip'], hold: 5.0 })
        ];
      }
    },

    /* ---- 36. nine dandelion heads ---- */
    {
      id: 'dandelions_unblown', weight: 2, tags: ['plant', 'restraint'],
      setup: function (rng) { return { n: rng.pick([9, 9, 7, 11, 12]), patch: anyDandelion(rng) }; },
      title: function (p) { return 'Gather ' + U.spell(p.n) + ' dandelion heads that have gone fully to seed'; },
      fine: function () { return 'Do not blow on them. Not one. Not on the way home.'; },
      steps: function (p) {
        return [
          gather({ at: p.patch, item: 'dandelion', n: p.n, verb: 'PICK', text: 'Pick ' + U.spell(p.n) + ' seedheads, carefully' }),
          jot({ verb: 'FOLD', text: 'Get them home unblown', at: 'HOME',
            need: ['dandelion'], takeCount: { item: 'dandelion', n: p.n }, give: ['dandelions_nine'] })
        ];
      }
    },

    /* ---- 37. horseshoe nail ---- */
    {
      id: 'horseshoe_nail', weight: 2, tags: ['pasture', 'iron'],
      setup: function () { return {}; },
      title: function () { return 'Find a horseshoe nail along the pasture fence line west of Church Street'; },
      fine: function () { return 'There have been no horses here since the nineties. Find one anyway.'; },
      steps: function () {
        return [
          find({ at: 'pasture_fence', item: 'nail_horseshoe', tries: 6, text: 'Work the fence line' })
        ];
      }
    },

    /* ---- 38. your own shadow, north ---- */
    {
      id: 'shadow_north', weight: 2, tags: ['photo', 'noon'],
      setup: function (rng) { return { spot: rng.pick(['bridge_concrete_center', 'ballfield_center', 'bendmart_lot', 'oldlot']) }; },
      title: function (p, town) { return 'Photograph your own shadow at noon, standing on ' + town.props[p.spot].name + ', so that it points exactly north'; },
      fine: function () { return 'At noon your shadow is short and honest. North is up on the map and nowhere on the ground.'; },
      steps: function (p) {
        return [
          snap({ target: 'SELF', at: p.spot, when: NOON, text: 'Photograph your shadow pointing north',
            give: ['photo'], requireFacing: 'north' })
        ];
      }
    },

    /* ---- 39. the tar ball ---- */
    {
      id: 'tar_ball', weight: 2, tags: ['road', 'summerish'],
      setup: function () { return {}; },
      title: function () { return 'Take a sample of tar from where it has bubbled up on Main Street and roll it into a ball'; },
      fine: function () { return 'It will be on your hands for two days. Do it in the afternoon when it is soft.'; },
      steps: function () {
        return [
          act({ at: 'tar_bubble', verb: 'TAKE', text: 'Work a piece of tar loose', when: { h0: 12, h1: 18.5, label: 'in the heat of the day' } }),
          make({ verb: 'ROLL', text: 'Roll it into a ball', give: ['tar_ball'], hold: 4.0 })
        ];
      }
    },

    /* ---- 40. the worst hydrant ---- */
    {
      id: 'worst_hydrant', weight: 2, tags: ['survey', 'meditative'],
      setup: function (rng, town) { return { target: town.worstHydrant, mins: rng.int(20, 45) }; },
      title: function () { return 'Determine which fire hydrant in town has the most chipped paint, then sit with your back against it for a while'; },
      fine: function () { return 'There are five. You will need to look at all five, and you will need to be fair about it.'; },
      steps: function (p) {
        return [
          act({ at: 'hydrant_0', verb: 'LOOK', text: 'Assess the hydrant at Main and First', hold: 2.0 }),
          act({ at: 'hydrant_1', verb: 'LOOK', text: 'Assess the hydrant at Main and Second', hold: 2.0 }),
          act({ at: 'hydrant_2', verb: 'LOOK', text: 'Assess the hydrant at Main and Third', hold: 2.0 }),
          act({ at: 'hydrant_3', verb: 'LOOK', text: 'Assess the hydrant on Depot', hold: 2.0 }),
          act({ at: 'hydrant_4', verb: 'LOOK', text: 'Assess the last one', hold: 2.0 }),
          hold({ at: p.target, seconds: 22, verb: 'SIT', still: true, text: 'Sit with your back against the worst one' })
        ];
      }
    },

    /* ---- 41. one kernel, planted badly ---- */
    {
      id: 'plant_one_kernel', weight: 2, tags: ['absurd', 'futile'],
      setup: function (rng) { return { where: rng.pick(['oldlot', 'bendmart_lot', 'rail_ballast', 'storage_doors']) }; },
      title: function (p, town) { return 'Take a single kernel from the grain spill at the co-op and plant it in ' + town.props[p.where].name; },
      fine: function () { return 'Somewhere it will not grow. This is not a test of the kernel.'; },
      steps: function (p) {
        return [
          act({ at: 'silo_spill', verb: 'TAKE', text: 'Take one kernel', give: ['kernel'], hold: 1.6 }),
          act({ at: p.where, verb: 'PLANT', text: 'Plant it where it cannot grow', need: ['kernel'], take: ['kernel'], give: ['kernel_planted'] })
        ];
      }
    },

    /* ---- 42. rust, by coin ---- */
    {
      id: 'rust_by_coin', weight: 2, tags: ['rail', 'dust'],
      setup: function () { return {}; },
      title: function () { return 'Scrape rust off the old rail with the edge of a coin until you have a pinch of it'; },
      fine: function () { return 'A pinch. Between finger and thumb. You will know when it is a pinch.'; },
      steps: function () {
        return [
          buy('bendmart_counter', 'coin', 'Get a coin you are willing to ruin'),
          act({ at: 'rail_rust', verb: 'SCRAPE', text: 'Scrape rust off the rail with the coin',
            need: ['coin'], give: ['rust_pinch'], hold: 6.0 })
        ];
      }
    },

    /* ---- 43. the mailbox that lies ---- */
    {
      id: 'mailbox_mismatch', weight: 2, tags: ['survey', 'petty'],
      setup: function (rng, town) { return { lot: town.mismatchedMailbox }; },
      title: function () { return "Find the mailbox in town whose number does not match its house, and note the discrepancy"; },
      fine: function () { return 'Note it. Tell nobody. There is nothing to be done about it and it is wrong.'; },
      steps: function (p, town) {
        var lot = null;
        for (var i = 0; i < town.lots.length; i++) if (town.lots[i].id === p.lot) lot = town.lots[i];
        return [
          buy('hardware_counter', 'paper', 'Buy paper'),
          buy('hardware_counter', 'pencil', 'Buy a pencil'),
          act({ at: 'mailbox_' + p.lot, verb: 'READ', text: 'Read the number on the mailbox that is wrong',
            fine: 'It reads ' + (lot ? lot.mailbox.shown : '?') + '. The house is ' + (lot ? lot.number : '?') + '.' }),
          jot({ verb: 'WRITE', text: 'Write down the discrepancy',
            need: ['paper', 'pencil'], take: ['paper'], give: ['note_discrepancy'] })
        ];
      }
    },

    /* ---- 44. the siren test ---- */
    {
      id: 'siren_from_center', weight: 2, tags: ['sound', 'schedule'],
      setup: function () { return {}; },
      title: function () { return 'Listen to the volunteer fire siren test from the exact middle of the ballfield'; },
      fine: function () { return 'They test it at noon. The middle of the field, not the mound. There is no mound.'; },
      steps: function () {
        return [
          hold({ at: 'ballfield_center', seconds: 14, when: { h0: 11.85, h1: 12.35, label: 'at the noon test' },
            still: true, verb: 'LISTEN', text: 'Stand in the middle and listen to the whole test',
            give: ['recording_siren'] })
        ];
      }
    },

    /* ---- 45. safety glass to the sun ---- */
    {
      id: 'safety_glass_sun', weight: 2, tags: ['ditch', 'light'],
      setup: function (rng) { return { ditch: anyDitch(rng) }; },
      title: function () { return 'Find a cube of safety glass from an old wreck in the County Road 9 ditch and hold it up to the sun'; },
      fine: function () { return 'One cube, not a handful. Hold it up until you have understood it.'; },
      steps: function (p) {
        return [
          find({ at: p.ditch, item: 'glass_safety', tries: 5, text: 'Search the ditch for safety glass' }),
          act({ at: 'ANY', verb: 'HOLD', text: 'Hold it up to the sun',
            when: { h0: 8, h1: 17.5, label: 'while the sun is up' }, need: ['glass_safety'], hold: 4.0 })
        ];
      }
    },

    /* ---- 46. two equal piles ---- */
    {
      id: 'milkweed_halves', weight: 2, tags: ['plant', 'count'],
      setup: function (rng) { return { patch: anyMilkweed(rng) }; },
      title: function () { return 'Collect the seed pods from a single milkweed and count the seed into two equal piles'; },
      fine: function () { return 'One plant. If the count is odd, one seed goes in your pocket and the piles are equal.'; },
      steps: function (p) {
        return [
          act({ at: p.patch, verb: 'PICK', text: 'Take the pods off one milkweed', give: ['milkweed_pods'], hold: 2.6 }),
          jot({ at: 'HOME', verb: 'SORT', text: 'Count the seed into two equal piles',
            need: ['milkweed_pods'], take: ['milkweed_pods'], give: ['milkweed_split'], hold: 6.0 })
        ];
      }
    },

    /* ---- 47. a jar of fog ---- */
    {
      id: 'jar_of_fog', weight: 2, tags: ['weather', 'futile'],
      setup: function (rng) { return { where: rng.pick(['bridge_concrete_center', 'pond_edge', 'ballfield_center', 'cemetery_gate']) }; },
      title: function (p, town) { return 'Fill a jar with fog at ' + town.props[p.where].name + ' and seal it'; },
      fine: function () { return 'It will look like an empty jar. It is an empty jar. Seal it.'; },
      steps: function (p) {
        return [
          buy('bendmart_counter', 'jar_empty', 'Buy a jar'),
          act({ at: p.where, verb: 'FILL', text: 'Fill the jar with fog', weather: ['fog'],
            need: ['jar_empty'], take: ['jar_empty'], give: ['jar_fog'] }),
          make({ verb: 'SEAL', text: 'Seal the fog in', need: ['jar_fog'] })
        ];
      }
    },

    /* ---- 48. the warmest brick ---- */
    {
      id: 'warmest_brick', weight: 2, tags: ['touch', 'afternoon'],
      setup: function (rng) { return { h: rng.pick([15, 16, 16, 17]) }; },
      title: function (p) { return 'Find the warmest brick on the south wall of Pell Hardware at ' + U.clock(p.h, 0); },
      fine: function () { return 'With the back of your hand. Work across, not down. Somebody will ask what you are doing.'; },
      steps: function (p) {
        return [
          act({ at: 'hardware_southwall', verb: 'TOUCH', text: 'Find the warmest brick',
            when: { h0: p.h - 0.5, h1: p.h + 0.7, label: 'around ' + U.clock(p.h, 0) }, hold: 6.0, witnessed: true })
        ];
      }
    },

    /* ---- 49. the snake skin ---- */
    {
      id: 'snakeskin', weight: 2, tags: ['ruin', 'search'],
      setup: function () { return {}; },
      title: function () { return 'Find a shed snake skin under the porch of the Vandermeer place'; },
      fine: function () { return 'Under. You will have to get down. It is a rat snake and it is not there any more.'; },
      steps: function () {
        return [
          find({ at: 'farmhouse_porch', item: 'snakeskin', tries: 5, text: 'Reach under the porch' })
        ];
      }
    },

    /* ---- 50. three creek temperatures ---- */
    {
      id: 'creek_temps', weight: 2, tags: ['water', 'survey'],
      setup: function () { return {}; },
      title: function () { return 'Take the temperature of Little Fox Creek with your hand at three different points and rank them'; },
      fine: function () { return 'Your hand. Rank them. Commit to the ranking.'; },
      steps: function () {
        return [
          act({ at: 'creek_shallow_bend', verb: 'TOUCH', text: 'Hand in the water at the shallow bend', hold: 3.0 }),
          act({ at: 'creek_deep_bend', verb: 'TOUCH', text: 'Hand in the water at the deep bend', hold: 3.0, allowDecoy: true }),
          act({ at: 'bridge_stone_center', verb: 'TOUCH', text: 'Hand in the water at the stone bridge', hold: 3.0 }),
          jot({ verb: 'WRITE', text: 'Rank the three', give: ['note_ranking'] })
        ];
      }
    },

    /* ---- 51. blue glass ---- */
    {
      id: 'blue_glass', weight: 2, tags: ['alley', 'search'],
      setup: function () { return {}; },
      title: function () { return 'Find a shard of blue glass in the alley behind the feed store'; },
      fine: function () { return 'Blue. Not green held up against something blue.'; },
      steps: function () {
        return [
          find({ at: 'feedstore_alley', item: 'glass_blue', tries: 5, text: 'Search the alley' })
        ];
      }
    },

    /* ---- 52. the emptied receipt ---- */
    {
      id: 'bleach_receipt', weight: 2, tags: ['home', 'overnight', 'futile'],
      setup: function (rng) { return { days: rng.int(1, 2) }; },
      title: function (p) { return 'Leave a Bend Mart receipt on your windowsill until the sun has taken the ink off it'; },
      fine: function (p) { return 'Thermal paper. ' + (p.days > 1 ? 'Two days of sun.' : 'One good day of sun.') + ' Then keep the blank one.'; },
      steps: function (p) {
        return [
          buy('bendmart_counter', 'receipt', 'Get a receipt'),
          act({ at: 'home_windowsill', verb: 'PLACE', text: 'Lay it in the window', need: ['receipt'] }),
          act({ at: 'home_windowsill', verb: 'TAKE', text: 'Collect the blank receipt', dayOffset: p.days,
            need: ['receipt'], take: ['receipt'], give: ['receipt_bleached'] })
        ];
      }
    },

    /* ---- 53. the nest ---- */
    {
      id: 'empty_nest', weight: 2, tags: ['woods', 'restraint', 'meditative'],
      setup: function (rng) { return { secs: rng.int(18, 34) }; },
      title: function () { return 'Find a bird’s nest with no bird in it. Do not touch it. Look at it for a while'; },
      fine: function () { return 'Low in the hawthorns at the treeline. Do not touch it. That is the whole errand.'; },
      steps: function (p) {
        return [
          hold({ at: 'woods_nest', seconds: p.secs, still: true, verb: 'LOOK',
            text: 'Look at the nest for ' + U.spell(Math.round(p.secs / 10) * 10 || 20) + '-odd seconds',
            fine: 'Standing still. Not touching it.' })
        ];
      }
    },

    /* ---- 54. twine until there is none ---- */
    {
      id: 'twine_until_gone', weight: 2, tags: ['absurd', 'endurance'],
      setup: function (rng) { return { post: anyFencepost(rng) }; },
      title: function () { return 'Wrap twine around a fence post on the pasture line until you run out of twine'; },
      fine: function () { return 'Until you run out. Not until it looks finished.'; },
      steps: function (p) {
        return [
          buy('bendmart_counter', 'twine', 'Buy a full ball of twine'),
          act({ at: p.post, verb: 'WRAP', text: 'Wrap until the ball is gone',
            need: ['twine'], take: ['twine'], give: ['twine_spent'], hold: 9.0 })
        ];
      }
    },

    /* ---- 55. the pressed leaf ---- */
    {
      id: 'pressed_leaf', weight: 2, tags: ['plant', 'overnight'],
      setup: function () { return {}; },
      title: function () { return 'Take a leaf from the oldest maple on Church Street and press it flat under something heavy for one night'; },
      fine: function () { return 'The oldest one. It is the one that has been topped twice for the power line.'; },
      steps: function () {
        return [
          act({ at: 'church_maple', verb: 'TAKE LEAF', text: 'Take one leaf from the oldest maple', give: ['leaf_maple'] }),
          act({ at: 'home_door', verb: 'PRESS', text: 'Press it under something heavy at home', need: ['leaf_maple'] }),
          act({ at: 'home_door', verb: 'TAKE', text: 'Take it out in the morning', dayOffset: 1,
            need: ['leaf_maple'], take: ['leaf_maple'], give: ['leaf_pressed'] })
        ];
      }
    },

    /* ---- 56. cattails, and nothing after ---- */
    {
      id: 'cattail_dusk', weight: 2, tags: ['pond', 'dusk'],
      setup: function (rng) { return { n: rng.int(1, 3) }; },
      title: function (p) { return 'Cut ' + U.spell(p.n) + ' cattail' + (p.n > 1 ? 's' : '') + ' at the pond at dusk and carry ' + (p.n > 1 ? 'them' : 'it') + ' home'; },
      fine: function () { return 'At dusk. They shed in the house for a year. Everyone knows this.'; },
      steps: function (p) {
        return [
          gather({ at: 'pond_cattails', item: 'cattail', n: p.n, when: DUSK, verb: 'PICK',
            text: 'Cut ' + U.spell(p.n) + ' cattail' + (p.n > 1 ? 's' : '') }),
          act({ at: 'home_door', verb: 'ENTER', text: 'Carry them inside', need: ['cattail'] })
        ];
      }
    },

    /* ---- 57. the third dryer ---- */
    {
      id: 'third_dryer', weight: 2, tags: ['laundromat', 'sound'],
      setup: function (rng) { return { secs: rng.int(20, 40) }; },
      title: function () { return 'Listen to the third dryer at Wash & Go until you can hear the thing that is wrong with it'; },
      fine: function () { return 'Something in the drum. It comes around every one-and-a-bit seconds. Nobody has mentioned it.'; },
      steps: function (p) {
        return [
          hold({ at: 'laundromat_dryer', seconds: p.secs, still: true, verb: 'LISTEN',
            text: 'Listen to the third dryer', witnessed: true })
        ];
      }
    },

    /* ---- 58. the cemetery spigot ---- */
    {
      id: 'spigot_water', weight: 2, tags: ['cemetery', 'water', 'futile'],
      setup: function (rng, town) { return { grave: town.lambGrave || town.earliestGrave }; },
      title: function (p, town) {
        var g = town.props[p.grave] && town.props[p.grave].grave;
        return 'Fill a jar at the cemetery spigot and pour it out on ' + (g ? g.first + ' ' + g.last + "'s" : 'the oldest') + ' grave';
      },
      fine: function () { return 'There is nothing planted there. Pour it out anyway.'; },
      steps: function (p) {
        return [
          buy('bendmart_counter', 'jar_empty', 'Buy a jar'),
          act({ at: 'cemetery_spigot', verb: 'FILL', text: 'Fill the jar at the spigot',
            need: ['jar_empty'], take: ['jar_empty'], give: ['jar_spigot'] }),
          act({ at: p.grave, verb: 'PLACE', text: 'Pour it out on the grave', need: ['jar_spigot'], take: ['jar_spigot'], give: ['jar_empty'] })
        ];
      }
    },

    /* ---- 59. the ice machine ---- */
    {
      id: 'ice_machine', weight: 1, tags: ['sound', 'meditative'],
      setup: function (rng) { return { secs: rng.int(22, 40) }; },
      title: function () { return 'Stand at the Bend Mart ice machine until it cycles'; },
      fine: function () { return 'It drops a load of ice roughly every eleven minutes. Stand there.'; },
      steps: function (p) {
        return [
          hold({ at: 'bendmart_ice', seconds: p.secs, still: true, verb: 'LISTEN',
            text: 'Wait for the ice machine to cycle', witnessed: true })
        ];
      }
    },

    /* ---- 60. the well ---- */
    {
      id: 'farm_well', weight: 1, tags: ['ruin', 'sound'],
      setup: function (rng) { return { secs: rng.int(16, 28) }; },
      title: function () { return 'Listen at the capped well behind the Vandermeer place'; },
      fine: function () { return 'It is capped. Listen anyway. Do not lift the cap.'; },
      steps: function (p) {
        return [
          hold({ at: 'farmhouse_well', seconds: p.secs, still: true, verb: 'LISTEN', text: 'Put your ear to the cap' })
        ];
      }
    }
  ];

  ER.QuestPoolB = POOL;
})(typeof window !== 'undefined' ? (window.ER = window.ER || {}) : (global.ER = global.ER || {}));
