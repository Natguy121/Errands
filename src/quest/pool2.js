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
  function snapAll(o) { o.kind = 'photoset'; o.verb = 'PHOTOGRAPH'; return step(o); }
  function retouch(o) { o.kind = 'edit'; return step(o); }
  function trek(o) { o.kind = 'walk'; return step(o); }
  function jot(o) { o.kind = 'note'; o.at = o.at || 'ANY'; o.verb = o.verb || 'WRITE'; return step(o); }

  var DUSK = { h0: 18.4, h1: 20.1, label: 'at dusk' };
  var NIGHT = { h0: 21.5, h1: 4.5, label: 'after dark' };
  var PREDAWN = { h0: 4.6, h1: 6.7, label: 'before sunrise' };
  var NOON = { h0: 11.8, h1: 13.5, label: 'in the middle of the day' };
  var WET = ['rain', 'drizzle', 'storm'];

  function idsTagged(town, tag) {
    var out = [];
    for (var i = 0; i < town.propList.length; i++)
      if (town.propList[i].tags.indexOf(tag) >= 0) out.push(town.propList[i].id);
    return out;
  }
  function anyShutter(rng, town) { return rng.pick(idsTagged(town, 'shutter')); }
  function anyDoor(rng, town) { return rng.pick(idsTagged(town, 'knocker')); }
  function anyPots(rng, town) { return rng.pick(idsTagged(town, 'pot')); }
  function anyMeter(rng, town) { return rng.pick(idsTagged(town, 'meter')); }
  function anyArch(rng, town) {
    var a = idsTagged(town, 'arcade');
    return a.length ? rng.pick(a) : 'chapel_door';
  }
  function anyTank(rng, town) {
    var a = idsTagged(town, 'tank');
    return a.length ? rng.pick(a) : 'home_roof';
  }
  function allDishes(town) { return idsTagged(town, 'satellite'); }
  function anyCracks(rng) { return rng.pick(['square_cracks', 'zaroub_cracks', 'daraj_cracks']); }

  var POOL = [

    /* ---- 31. peel a label in one piece ---- */
    {
      id: 'label_one_piece', weight: 2, tags: ['craft', 'fiddly'],
      setup: function (rng) { return { tries: rng.int(2, 4) }; },
      title: function () { return 'Find a bottle on the shore with its label intact and peel the label off in one piece'; },
      fine: function (p) { return 'One piece. You will tear it. You are allowed ' + U.spell(p.tries) + ' bottles and then you are not.'; },
      steps: function () {
        return [
          find({ at: 'quay_nets', item: 'bottle_labeled', tries: 4,
            text: 'Look through what the sea has left in the nets' }),
          make({ verb: 'PEEL', text: 'Peel the label off in one piece',
            need: ['bottle_labeled'], take: ['bottle_labeled'], give: ['label_peeled'] })
        ];
      }
    },

    /* ---- 32. the receipt in the sun ---- */
    {
      id: 'bleach_a_receipt', weight: 2, tags: ['wait', 'absurd'],
      setup: function () { return {}; },
      title: function () { return 'Leave a receipt from the dukkan on your windowsill until the sun has taken everything off it'; },
      fine: function () { return 'Thermal paper. The sun empties it completely. It takes a day and it is not interesting to watch.'; },
      steps: function () {
        return [
          buy('dukkan_counter', 'receipt', 'Get a receipt at the dukkan', 'Nadia prints one anyway.'),
          act({ at: 'home_windowsill', verb: 'PLACE', text: 'Put the receipt on the windowsill', need: ['receipt'] }),
          hold({ at: 'home_windowsill', seconds: 60, dayOffset: 1, verb: 'WAIT',
            text: 'Leave it a whole day', take: ['receipt'], give: ['receipt_bleached'] })
        ];
      }
    },

    /* ---- 33. the sock ---- */
    {
      id: 'fold_one_sock', weight: 2, tags: ['absurd', 'quiet'],
      setup: function () { return {}; },
      title: function () { return 'Take one sock out of the box of left things at the dukkan and fold it anyway'; },
      fine: function () { return 'One sock. You cannot fold one sock. Fold it.'; },
      steps: function () {
        return [
          find({ at: 'dukkan_lostbox', item: 'sock', tries: 3, text: 'Go through the box' }),
          make({ verb: 'FOLD', text: 'Fold the one sock', need: ['sock'], take: ['sock'], give: ['sock_folded'] })
        ];
      }
    },

    /* ---- 34. the coin on the rail of the wall ---- */
    {
      id: 'coin_for_the_sea', weight: 2, tags: ['wait', 'sea'],
      setup: function (rng) { return { where: rng.pick(['wall_third_stone', 'wall_mooring', 'sea_steps']) }; },
      title: function (p, town) {
        return 'Leave a coin on ' + town.props[p.where].name + ' overnight and see what the salt does to it';
      },
      fine: function () { return 'It does very little in one night. Leave it anyway.'; },
      steps: function (p) {
        return [
          buy('dukkan_counter', 'coin', 'Get a coin you are willing to ruin'),
          act({ at: p.where, verb: 'PLACE', text: 'Leave the coin on the wall', need: ['coin'], take: ['coin'] }),
          hold({ at: p.where, seconds: 60, dayOffset: 1, verb: 'WAIT', text: 'Come back for it tomorrow',
            give: ['coin_sea'] })
        ];
      }
    },

    /* ---- 35. the tile ---- */
    {
      id: 'one_whole_tile', weight: 2, tags: ['search', 'ruin'],
      setup: function (rng) { return { n: rng.int(11, 26) }; },
      title: function (p) { return 'Count the fallen roof tiles at the abandoned house and bring back the ' + U.ordinal(p.n) + ' whole one'; },
      fine: function (p) { return 'Whole. Most are not. If there is no ' + U.ordinal(p.n) + ' whole one, take the last whole one and do not mention it.'; },
      steps: function (p) {
        return [
          act({ at: 'mahjour_tiles', verb: 'COUNT', text: 'Count the tiles in the heap' }),
          act({ at: 'mahjour_tiles', verb: 'TAKE', text: 'Take the ' + U.ordinal(p.n) + ' whole one',
            give: ['tile_whole'] })
        ];
      }
    },

    /* ---- 36. dust from the abandoned house ---- */
    {
      id: 'bag_of_dust', weight: 2, tags: ['absurd', 'ruin'],
      setup: function () { return {}; },
      title: function () { return 'Collect a bag of dust off the floor of the abandoned house and label it with the date'; },
      fine: function () { return 'The dust is mostly the house. Do not think about that while you are doing it.'; },
      steps: function () {
        return [
          buy('dukkan_counter', 'baggie', 'Buy a small plastic bag'),
          buy('dukkan_counter', 'pencil', 'Buy a pencil'),
          act({ at: 'mahjour_room', verb: 'DIG', text: 'Sweep dust into the bag',
            need: ['baggie'], take: ['baggie'], give: ['baggie_dust'] }),
          jot({ text: 'Write the date on the bag', need: ['baggie_dust', 'pencil'] })
        ];
      }
    },

    /* ---- 37. three pebbles ---- */
    {
      id: 'sort_three_pebbles', weight: 2, tags: ['sort', 'absurd'],
      setup: function () { return {}; },
      title: function () { return 'Pick three pebbles off the shore and sort them by how light they are, not how heavy'; },
      fine: function () { return 'Those are the same sort and you know it. Do it the way it is written.'; },
      steps: function () {
        return [
          find({ at: 'shore_clay', item: 'pebbles_sorted', tries: 3, text: 'Choose three pebbles' }),
          make({ verb: 'SORT', text: 'Sort them by lightness', need: ['pebbles_sorted'] })
        ];
      }
    },

    /* ---- 38. the well ---- */
    {
      id: 'listen_at_the_cistern', weight: 2, tags: ['listen', 'quiet'],
      setup: function (rng) { return { secs: rng.int(12, 22) }; },
      title: function () { return 'Put your ear to the lid of the old cistern on Darb et Tahta'; },
      fine: function () { return 'It is capped. Listen anyway. Do not lift the lid.'; },
      steps: function (p) {
        return [
          hold({ at: 'well_lid', seconds: p.secs, still: true, verb: 'LISTEN',
            text: 'Put your ear to the lid' })
        ];
      }
    },

    /* ---- 39. the arch count ---- */
    {
      id: 'count_the_arches', weight: 2, tags: ['count', 'look'],
      setup: function (rng, town) { return { at: anyArch(rng, town) }; },
      title: function (p, town) { return 'Count the arches on ' + town.props[p.at].name.replace(/^the /, '') + ' from directly underneath'; },
      fine: function () { return 'From underneath. From across the alley it is three and from underneath it is still three, but you have to check.'; },
      steps: function (p) {
        return [
          act({ at: p.at, verb: 'COUNT', text: 'Stand underneath and count them' }),
          snap({ target: p.at, text: 'Photograph them from underneath', give: ['photo'], maxRange: 6 })
        ];
      }
    },

    /* ---- 40. the meters ---- */
    {
      id: 'read_the_meters', weight: 2, tags: ['read', 'absurd'],
      setup: function (rng, town) { return { at: anyMeter(rng, town) }; },
      title: function (p, town) { return 'Read ' + town.props[p.at].name + ' and write the number down where nobody will find it'; },
      fine: function () { return 'It is not your meter. Write it on your own wall.'; },
      steps: function (p) {
        return [
          buy('dukkan_counter', 'paper', 'Buy a sheet of paper'),
          buy('dukkan_counter', 'pencil', 'Buy a pencil'),
          act({ at: p.at, verb: 'READ', text: 'Read the meter' }),
          jot({ at: 'home_windowsill', text: 'Write the number down at home',
            need: ['paper', 'pencil'], take: ['paper'], give: ['note_count'] })
        ];
      }
    },

    /* ---- 41. the drip ---- */
    {
      id: 'jar_under_the_drip', weight: 2, tags: ['water', 'wait'],
      setup: function (rng) { return { secs: rng.int(24, 40) }; },
      title: function () { return 'Hold a jar under the drainpipe on the steps until it has more water in it than it had'; },
      fine: function () { return 'It drips about twice a minute. You will lose interest before the jar does.'; },
      steps: function (p) {
        return [
          buy('dukkan_counter', 'jar_empty', 'Buy a glass jar'),
          hold({ at: 'daraj_drip', seconds: p.secs, verb: 'FILL', text: 'Hold the jar under the drip',
            need: ['jar_empty'], take: ['jar_empty'], give: ['jar_fountain'] })
        ];
      }
    },

    /* ---- 42. the chapel candles ---- */
    {
      id: 'count_the_candles', weight: 2, tags: ['count', 'quiet'],
      setup: function () { return {}; },
      title: function () { return 'Count the candles burning at Saydet el Bahr and take one drip of wax off the stand'; },
      fine: function () { return 'One drip. Off the stand, not off a candle. Abouna Maroun will see you and say nothing.'; },
      steps: function () {
        return [
          act({ at: 'chapel_candles', verb: 'COUNT', text: 'Count the candles', witnessed: true }),
          act({ at: 'chapel_candles', verb: 'TAKE', text: 'Take one drip of wax', give: ['wax_drip'] })
        ];
      }
    },

    /* ---- 43. the mint ---- */
    {
      id: 'chapel_mint', weight: 2, tags: ['gather', 'plant'],
      setup: function () { return {}; },
      title: function () { return 'Pick a handful of the mint by the chapel door and do nothing at all with it'; },
      fine: function () { return 'The mint is in the tin nearer the door. The other tin is basil. Nothing is to be done with it.'; },
      steps: function () {
        return [
          act({ at: 'chapel_mint', verb: 'PICK', text: 'Pick the chapel mint',
            give: ['mint_chapel'], decoyKey: 'mint' })
        ];
      }
    },

    /* ---- 44. one word into the wall ---- */
    {
      id: 'word_into_the_wall', weight: 2, tags: ['speak', 'absurd'],
      setup: function (rng) { return { word: rng.pick(['yes', 'later', 'mine', 'enough', 'Batroun']) }; },
      title: function (p) { return 'Say the word "' + p.word + '" into the channel in the sea wall and listen to what comes back'; },
      fine: function () { return 'Something comes back. It is the sea. It is always the sea.'; },
      steps: function (p) {
        return [
          act({ at: 'wall_channel', verb: 'SPEAK', text: 'Say it into the channel',
            decoyKey: 'channel', witnessed: true }),
          hold({ at: 'wall_channel', seconds: 11, still: true, verb: 'LISTEN',
            text: 'Listen for eleven seconds', give: ['recording_sea'] })
        ];
      }
    },

    /* ---- 45. the windshield ---- */
    {
      id: 'mercedes_glass', weight: 2, tags: ['scrape', 'car'],
      setup: function (rng) { return { corner: rng.pick(['the near corner', 'the far corner', 'the corner with the sticker']) }; },
      title: function (p) { return 'Wipe ' + p.corner + ' of the Mercedes windscreen and nothing else'; },
      fine: function () { return 'Nothing else. The rest stays as it is. It is not your car and it is not clean.'; },
      steps: function () {
        return [
          act({ at: 'souk_taxi', verb: 'WIPE', text: 'Wipe the one corner', witnessed: true })
        ];
      }
    },

    /* ---- 46. the backgammon board ---- */
    {
      id: 'unattended_board', weight: 2, tags: ['count', 'photo'],
      setup: function () { return {}; },
      title: function () { return 'Work out who is winning on the abandoned backgammon board outside the qahwe'; },
      fine: function () { return 'Do not move anything. Two men will come back for this game in about an hour.'; },
      steps: function () {
        return [
          act({ at: 'qahwe_board', verb: 'COUNT', text: 'Count the pieces on both sides' }),
          snap({ target: 'qahwe_board', text: 'Photograph the position', give: ['photo'], maxRange: 5 })
        ];
      }
    },

    /* ---- 47. the posters ---- */
    {
      id: 'lift_one_poster', weight: 2, tags: ['craft', 'paper'],
      setup: function (rng) { return { layer: rng.int(2, 5) }; },
      title: function (p) { return 'Lift the ' + U.ordinal(p.layer) + ' layer of poster off the wall on the souk without tearing the one underneath'; },
      fine: function () { return 'There are more layers than there are years. You will tear the one underneath.'; },
      steps: function () {
        return [
          act({ at: 'souk_posters', verb: 'PEEL', text: 'Work one layer loose', give: ['poster_scrap'] })
        ];
      }
    },

    /* ---- 48. the cat on the blue door ---- */
    {
      id: 'cat_on_the_blue_door', weight: 3, tags: ['photo', 'cats'],
      setup: function (rng) { return { wait: rng.int(14, 26) }; },
      title: function () { return 'Wait for the cat to sit on the blue door again, and photograph it there'; },
      fine: function () { return 'It sits there most of the day. It will not be there when you want it to be.'; },
      steps: function (p) {
        return [
          hold({ at: 'souk_cat_blue', seconds: p.wait, verb: 'WAIT', text: 'Wait for the cat to settle' }),
          snap({ target: 'souk_cat_blue', text: 'Photograph the cat on the door', give: ['photo'], maxRange: 7 })
        ];
      }
    },

    /* ---- 49. the water tanks ---- */
    {
      id: 'count_the_tanks', weight: 2, tags: ['count', 'roof'],
      setup: function () { return {}; },
      title: function () { return 'Count the black water tanks you can see from the bench on the landing'; },
      fine: function () { return 'From the bench. Not from the steps. The number from the steps is different and wrong.'; },
      steps: function () {
        return [
          act({ at: 'bench_landing', verb: 'COUNT', text: 'Sit on the bench and count the tanks' }),
          snap({ target: 'bench_landing', text: 'Photograph what you counted from', give: ['photo'], maxRange: 8 })
        ];
      }
    },

    /* ---- 50. every dish ---- */
    {
      id: 'every_dish', weight: 2, tags: ['photo', 'roof'],
      setup: function () { return {}; },
      title: function () { return 'Photograph every satellite dish in the quarter and note which way they all point'; },
      fine: function () { return 'They all point the same way. Note it anyway.'; },
      steps: function (p, town) {
        return [
          snapAll({ targets: allDishes(town), text: 'Photograph the dishes', give: ['photo'], maxRange: 14 }),
          buy('dukkan_counter', 'paper', 'Buy a sheet of paper'),
          buy('dukkan_counter', 'pencil', 'Buy a pencil'),
          jot({ text: 'Note which way they point', need: ['paper', 'pencil'], take: ['paper'], give: ['note_count'] })
        ];
      }
    },

    /* ---- 51. the cactus ---- */
    {
      id: 'prickly_pear', weight: 2, tags: ['look', 'plant'],
      setup: function (rng) { return { pads: rng.int(4, 9) }; },
      title: function (p) { return 'Count the pads on the prickly pear growing out of the wall on the steps — somebody says ' + U.spell(p.pads); },
      fine: function () { return 'Do not touch it to count it. People do and they regret it for a week.'; },
      steps: function () {
        return [
          act({ at: 'daraj_cactus', verb: 'COUNT', text: 'Count the pads without touching it' }),
          snap({ target: 'daraj_cactus', text: 'Photograph it as evidence', give: ['photo'], maxRange: 6 })
        ];
      }
    },

    /* ---- 52. the kaak ---- */
    {
      id: 'kaak_too_hot', weight: 3, tags: ['buy', 'wait'],
      setup: function (rng) { return { spot: rng.pick(['sea_steps', 'square_bench', 'bench_landing']) }; },
      title: function (p, town) {
        return 'Buy a kaak while it is still too hot to hold and carry it to ' + town.props[p.spot].name;
      },
      fine: function () { return 'Too hot to hold. That is the condition. If you can hold it comfortably you were too slow.'; },
      steps: function (p) {
        return [
          buy('furn_counter', 'kaak', 'Buy a kaak straight off the oven'),
          trek({ waypoints: ['furn_counter', p.spot], text: 'Carry it there', fine: 'Do not put it down.' }),
          hold({ at: p.spot, seconds: 12, verb: 'SIT', text: 'Sit with it until you can hold it properly',
            need: ['kaak'] })
        ];
      }
    },

    /* ---- 53. the soap pyramid ---- */
    {
      id: 'soap_pyramid', weight: 2, tags: ['count', 'shop'],
      setup: function (rng) { return { row: rng.int(2, 5) }; },
      title: function (p) { return 'Count the bars in the ' + U.ordinal(p.row) + ' row of the soap pyramid without disturbing it'; },
      fine: function () { return 'Rita builds it on Mondays. If it falls you will buy all of it.'; },
      steps: function () {
        return [
          act({ at: 'sabon_stack', verb: 'COUNT', text: 'Count the row', witnessed: true })
        ];
      }
    },

    /* ---- 54. the chairs ---- */
    {
      id: 'chairs_outside', weight: 2, tags: ['count', 'absurd'],
      setup: function (rng) { return { turn: rng.pick(['to face the sea', 'to face the wall', 'inward']) }; },
      title: function (p) { return 'Count the plastic chairs outside the qahwe and turn exactly one of them ' + p.turn; },
      fine: function () { return 'One. Joseph will turn it back within the hour and will not ask.'; },
      steps: function () {
        return [
          act({ at: 'qahwe_chairs', verb: 'COUNT', text: 'Count the chairs' }),
          act({ at: 'qahwe_chairs', verb: 'PLACE', text: 'Turn one of them', witnessed: true })
        ];
      }
    },

    /* ---- 55. the gas canisters ---- */
    {
      id: 'chained_canisters', weight: 2, tags: ['count', 'zaroub'],
      setup: function () { return {}; },
      title: function () { return 'Count the gas canisters chained up in the zaroub and find the one that is empty'; },
      fine: function () { return 'Lift each one slightly. One of them is empty and has been for a long time.'; },
      steps: function () {
        return [
          act({ at: 'zaroub_gas', verb: 'COUNT', text: 'Count the canisters' }),
          act({ at: 'zaroub_gas', verb: 'TOUCH', text: 'Find the empty one' })
        ];
      }
    },

    /* ---- 56. the boat, before sunrise ---- */
    {
      id: 'dew_off_the_boat', weight: 2, tags: ['predawn', 'water'],
      setup: function () { return {}; },
      title: function () { return 'Collect the dew off the blue boat before sunrise and seal it in a jar'; },
      fine: function () { return 'Before sunrise. After that there is no dew and you have got up for nothing.'; },
      steps: function () {
        return [
          buy('dukkan_counter', 'jar_empty', 'Buy a glass jar'),
          act({ at: 'quay_boat', verb: 'WIPE', when: PREDAWN, text: 'Wipe the dew off the hull into the jar',
            need: ['jar_empty'], take: ['jar_empty'], give: ['jar_dew'] }),
          make({ verb: 'SEAL', text: 'Seal it', need: ['jar_dew'] })
        ];
      }
    },

    /* ---- 57. the anchor ---- */
    {
      id: 'anchor_rust', weight: 2, tags: ['scrape', 'iron'],
      setup: function (rng) { return { arm: rng.pick(['the upper arm', 'the lower arm', 'the shank']) }; },
      title: function (p) { return 'Scrape ' + p.arm + ' of the anchor on the slipway back to the metal'; },
      fine: function () { return 'Back to the metal. It will be rust again by the autumn and that is not your problem.'; },
      steps: function () {
        return [
          buy('dukkan_counter', 'spoon', 'Buy a spoon to do it with', 'A spoon. Yes.'),
          act({ at: 'quay_anchor', verb: 'SCRAPE', text: 'Scrape it back to the metal',
            need: ['spoon'], give: ['rust_pinch'] })
        ];
      }
    },

    /* ---- 58. the tar ---- */
    {
      id: 'ball_of_tar', weight: 2, tags: ['craft', 'absurd'],
      setup: function (rng) { return { size: rng.pick(['a pea', 'a chickpea', 'a grape', 'your thumbnail']) }; },
      title: function (p) { return 'Roll the tar on the slipway into a ball the size of ' + p.size; },
      fine: function () { return 'It will stick to you for the rest of the day. This is understood.'; },
      steps: function () {
        return [
          act({ at: 'quay_tar', verb: 'TAKE', text: 'Take some tar off the slip', give: ['tar_ball'] }),
          make({ verb: 'ROLL', text: 'Roll it to size', need: ['tar_ball'] })
        ];
      }
    },

    /* ---- 59. the chickpea ---- */
    {
      id: 'plant_a_chickpea', weight: 2, tags: ['plant', 'absurd'],
      setup: function (rng) { return { where: rng.pick(['square_cracks', 'zaroub_cracks', 'daraj_cracks']) }; },
      title: function (p, town) {
        return 'Take one chickpea out of the open sack at the dukkan and plant it in ' + town.props[p.where].name;
      },
      fine: function () { return 'Somewhere it will not grow. This is not a test of the chickpea.'; },
      steps: function (p) {
        return [
          buy('dukkan_counter', 'chickpea', 'Take one chickpea'),
          act({ at: p.where, verb: 'PLANT', text: 'Plant it where it cannot grow',
            need: ['chickpea'], take: ['chickpea'], give: ['chickpea_planted'] })
        ];
      }
    },

    /* ---- 60. the olive leaf, silver side up ---- */
    {
      id: 'silver_side_up', weight: 2, tags: ['plant', 'quiet'],
      setup: function (rng) { return { n: rng.int(3, 7) }; },
      title: function (p) { return 'Lay ' + U.spell(p.n) + ' olive leaves on the fountain wall, all of them silver side up'; },
      fine: function () { return 'Silver side up. The wind will take them within the hour, which is fine.'; },
      steps: function (p) {
        return [
          gather({ at: 'olive_tree', item: 'leaf_olive', n: p.n, verb: 'TAKE LEAF',
            text: 'Take ' + U.spell(p.n) + ' leaves off the olive' }),
          act({ at: 'fountain', verb: 'PLACE', text: 'Lay them out silver side up',
            need: ['leaf_olive'], take: ['leaf_olive'] })
        ];
      }
    },

    /* ---- 61. the bougainvillea ---- */
    {
      id: 'one_bract', weight: 2, tags: ['plant', 'wait'],
      setup: function () { return {}; },
      title: function () { return 'Take one bougainvillea bract and keep it until it is completely dry'; },
      fine: function () { return 'They dry like paper and then they dry further. Keep it until it does nothing when you touch it.'; },
      steps: function (p, town) {
        var ids = idsTagged(town, 'bougainvillea');
        var at = ids.length ? ids[0] : 'zaroub_jasmine';
        return [
          act({ at: at, verb: 'PICK', text: 'Take one bract', give: ['bougain_bract'] }),
          act({ at: 'home_windowsill', verb: 'PLACE', text: 'Put it on the windowsill', need: ['bougain_bract'] }),
          hold({ at: 'home_windowsill', seconds: 60, dayOffset: 1, verb: 'WAIT', text: 'Leave it overnight' })
        ];
      }
    },

    /* ---- 62. the cicada ---- */
    {
      id: 'cicada_skin', weight: 2, tags: ['search', 'summer'],
      setup: function () { return {}; },
      title: function () { return 'Find the dried skin of one cicada on a wall in the quarter'; },
      fine: function () { return 'The skin, not the cicada. They come off whole and hold on afterwards, which is the unsettling part.'; },
      steps: function (p, town) {
        return [
          find({ at: 'zaroub_cracks', item: 'cicada_skin', tries: 5,
            text: 'Look along the wall at eye height' })
        ];
      }
    },

    /* ---- 63. the shutter paint ---- */
    {
      id: 'shutter_paint_chip', weight: 2, tags: ['scrape', 'colour'],
      setup: function (rng, town) { return { at: anyShutter(rng, town) }; },
      title: function (p, town) { return 'Take a chip of paint off ' + town.props[p.at].name + ' and match it to the sea'; },
      fine: function () { return 'Hold it up against the water. It will not match. Nothing matches the water.'; },
      steps: function (p) {
        return [
          act({ at: p.at, verb: 'TOUCH', text: 'Work a chip of paint loose', give: ['paintchip'] }),
          act({ at: 'sea_steps', verb: 'HOLD', text: 'Hold the chip up against the sea', need: ['paintchip'] })
        ];
      }
    },

    /* ---- 64. the knocker ---- */
    {
      id: 'brass_hand', weight: 2, tags: ['touch', 'look'],
      setup: function () { return {}; },
      title: function () { return 'Find the one door in the quarter with a brass hand for a knocker, and do not use it'; },
      fine: function () { return 'Do not knock. Touch it and go. Somebody is always in.'; },
      steps: function (p, town) {
        return [
          act({ at: town.khamsaDoor, verb: 'TOUCH', text: 'Touch the brass hand without knocking' }),
          snap({ target: town.khamsaDoor, text: 'Photograph the knocker', give: ['photo'], maxRange: 5 })
        ];
      }
    },

    /* ---- 65. the pots ---- */
    {
      id: 'water_somebody_pots', weight: 3, tags: ['water', 'kind'],
      setup: function (rng, town) { return { at: anyPots(rng, town) }; },
      title: function (p, town) { return 'Water ' + town.props[p.at].name + ' without being seen doing it'; },
      fine: function () { return 'Without being seen. In an alley three metres wide. Good luck.'; },
      steps: function (p) {
        return [
          buy('dukkan_counter', 'jar_empty', 'Buy a glass jar'),
          act({ at: 'fountain', verb: 'FILL', text: 'Fill it at the fountain',
            need: ['jar_empty'], take: ['jar_empty'], give: ['jar_fountain'] }),
          act({ at: p.at, verb: 'FILL', text: 'Water the pots', need: ['jar_fountain'], take: ['jar_fountain'],
            unwitnessed: true })
        ];
      }
    },

    /* ---- 66. the fountain, settled ---- */
    {
      id: 'settle_the_water', weight: 2, tags: ['water', 'wait'],
      setup: function () { return {}; },
      title: function () { return 'Fill a jar at the fountain and let it settle on your windowsill until you can see through it'; },
      fine: function () { return 'The fountain runs cloudy after rain. It clears overnight and then it is just water.'; },
      steps: function () {
        return [
          buy('dukkan_counter', 'jar_empty', 'Buy a glass jar'),
          act({ at: 'fountain', verb: 'FILL', text: 'Fill it at the fountain',
            need: ['jar_empty'], take: ['jar_empty'], give: ['jar_fountain'] }),
          act({ at: 'home_windowsill', verb: 'PLACE', text: 'Stand it on the windowsill', need: ['jar_fountain'] }),
          hold({ at: 'home_windowsill', seconds: 60, dayOffset: 1, verb: 'WAIT',
            text: 'Leave it overnight', take: ['jar_fountain'], give: ['jar_fountain_clear'] })
        ];
      }
    },

    /* ---- 67. the fog ---- */
    {
      id: 'jar_of_sea_fog', weight: 1, tags: ['weather', 'absurd'],
      setup: function () { return {}; },
      title: function () { return 'Catch a jar of sea fog off the wall and seal it before it decides otherwise'; },
      fine: function () { return 'It has to be foggy. You cannot make it foggy. Wait.'; },
      steps: function () {
        return [
          buy('dukkan_counter', 'jar_empty', 'Buy a glass jar'),
          act({ at: 'wall_channel', verb: 'FILL', weather: ['fog'], text: 'Open the jar in the fog',
            need: ['jar_empty'], take: ['jar_empty'], give: ['jar_fog'], decoyKey: 'channel' }),
          make({ verb: 'SEAL', text: 'Seal it quickly', need: ['jar_fog'] })
        ];
      }
    },

    /* ---- 68. the wet stone ---- */
    {
      id: 'wet_stone_colour', weight: 1, tags: ['weather', 'look'],
      setup: function () { return {}; },
      title: function () { return 'Photograph the souk paving wet, and again dry, and decide which is the real colour'; },
      fine: function () { return 'It rains for two days in November. Both photographs are of the same stone.'; },
      steps: function () {
        return [
          snap({ target: 'square_tile', weather: WET, text: 'Photograph the paving wet',
            give: ['photo'], maxRange: 5 }),
          snap({ target: 'square_tile', weather: ['clear', 'fair'], text: 'And again dry',
            give: ['photo'], maxRange: 5 })
        ];
      }
    },

    /* ---- 69. the gecko ---- */
    {
      id: 'gecko_skin', weight: 1, tags: ['search', 'absurd'],
      setup: function () { return {}; },
      title: function () { return 'Find a shed gecko skin behind the shutters of the abandoned house, mostly whole'; },
      fine: function () { return 'Mostly whole. They come off in pieces and the pieces are not interesting.'; },
      steps: function () {
        return [
          find({ at: 'mahjour_room', item: 'gecko_skin', tries: 5,
            text: 'Feel behind the shutters' })
        ];
      }
    },

    /* ---- 70. the lamp with the wasp nest ---- */
    {
      id: 'wasp_nest_lamp', weight: 1, tags: ['photo', 'night'],
      setup: function () { return {}; },
      title: function () { return 'Photograph the lamp in the zaroub with the old wasp nest inside it, lit'; },
      fine: function () { return 'The nest has been empty for years. The lamp still comes on and it still looks occupied.'; },
      steps: function () {
        return [
          snap({ target: 'zaroub_lamp', when: NIGHT, text: 'Photograph the lamp lit',
            give: ['photo'], maxRange: 6 }),
          retouch({ filter: 'warm', text: 'Warm the photograph up until it is worse' })
        ];
      }
    }
  ];

  ER.QuestPoolB = POOL;
})(typeof window !== 'undefined' ? (window.ER = window.ER || {}) : (global.ER = global.ER || {}));
