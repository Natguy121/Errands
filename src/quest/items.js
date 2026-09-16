/* Errands — the things you end up carrying, and the things you do to them. */
(function (ER) {
  'use strict';

  /* kind drives the little procedural icon in the inventory strip */
  var I = {
    /* containers and their contents */
    jar_empty:        { name: 'a glass jar',                                short: 'jar',            kind: 'jar' },
    jar_sea:          { name: 'a jar of sea water from the wall',            short: 'jar · sea',      kind: 'jar', fill: '#3f6f78' },
    jar_sea_sealed:   { name: 'a sealed jar of sea water',                   short: 'jar · sealed',   kind: 'jar', fill: '#3f6f78', lid: true },
    jar_sea_twined:   { name: 'a sealed jar of sea water, twine at the rim',  short: 'jar · done',     kind: 'jar', fill: '#3f6f78', lid: true, twine: true },
    jar_fountain:     { name: 'a jar of fountain water, clouded',            short: 'jar · fountain', kind: 'jar', fill: '#7a8a7e' },
    jar_fountain_clear: { name: 'a jar of fountain water you can see through', short: 'jar · clear',   kind: 'jar', fill: '#94a49a' },
    jar_chapel:       { name: 'a jar from the tap at Saydet el Bahr',        short: 'jar · chapel',   kind: 'jar', fill: '#7d8f96' },
    jar_fog:          { name: 'a jar of sea fog',                            short: 'jar · fog',      kind: 'jar', fill: '#c9ccc8', lid: true },
    jar_dew:          { name: 'a jar of dew off the blue boat',              short: 'jar · dew',      kind: 'jar', fill: '#cfe0e4', lid: true },

    /* string, cloth, wire */
    twine:            { name: 'a ball of net twine',                         short: 'twine',          kind: 'wire' },
    twine_measure:    { name: 'a length of twine, knotted at the measurement', short: 'twine · knot', kind: 'wire' },
    twine_spent:      { name: 'the cardboard core of a twine ball',          short: 'twine core',     kind: 'wire' },
    wire_fish:        { name: 'a length of wire off the net frame',          short: 'wire',           kind: 'wire' },
    wire_circle:      { name: 'wire wound to the rim of a coffee cup',       short: 'wire ring',      kind: 'wire' },
    sock:             { name: 'one sock from the box at the dukkan',         short: 'sock',           kind: 'cloth' },
    sock_folded:      { name: 'one sock, folded anyway',                     short: 'sock · folded',  kind: 'cloth' },

    /* tools and stationery */
    spoon:            { name: 'a tin spoon',                                 short: 'spoon',          kind: 'tool' },
    spoon_mossy:      { name: 'a spoonful of moss off the sea wall',         short: 'spoon · moss',   kind: 'tool', fill: '#5f7a43' },
    pencil:           { name: 'a carpenter pencil',                          short: 'pencil',         kind: 'tool' },
    paper:            { name: 'a sheet of paper',                            short: 'paper',          kind: 'paper' },
    matchbox:         { name: 'an empty matchbox',                           short: 'matchbox',       kind: 'box' },
    baggie:           { name: 'a small plastic bag',                         short: 'bag',            kind: 'box' },
    coin:             { name: 'a coin you are willing to ruin',              short: 'coin',           kind: 'metal' },
    receipt:          { name: 'a receipt from the dukkan',                   short: 'receipt',        kind: 'paper' },
    receipt_numbered: { name: 'a receipt with a number on the back',         short: 'receipt · no.',  kind: 'paper' },
    receipt_bleached: { name: 'a receipt the sun has emptied',               short: 'receipt · blank', kind: 'paper' },
    rubbing:          { name: 'a pencil rubbing of the letter in the wall',  short: 'rubbing',        kind: 'paper' },
    note_discrepancy: { name: 'a note of the discrepancy',                   short: 'note',           kind: 'paper' },
    note_ranking:     { name: 'a ranking of three fountain temperatures',    short: 'ranking',        kind: 'paper' },
    note_count:       { name: 'a number you arrived at twice, differently',  short: 'count',          kind: 'paper' },

    /* what you can buy */
    lemonade:         { name: 'a glass of lemonade with the pips left in',   short: 'lemonade',       kind: 'jar', fill: '#d8d06a' },
    lemonade_warm:    { name: 'a glass of lemonade, no longer cold',         short: 'lemonade · warm', kind: 'jar', fill: '#cfc878' },
    kaak:             { name: 'a kaak, still too hot',                       short: 'kaak',           kind: 'leaf' },
    coffee:           { name: 'a finjan of coffee',                          short: 'coffee',         kind: 'jar', fill: '#3a2a20' },
    soap_bar:         { name: 'a bar of olive-oil soap',                     short: 'soap',           kind: 'box' },
    soap_shaved:      { name: 'a bar of soap with one corner shaved off',    short: 'soap · shaved',  kind: 'box' },

    /* iron and rust */
    nail_rusted:      { name: 'a rusted nail',                               short: 'nail · rust',    kind: 'nail' },
    nail_boat:        { name: 'a boat nail, square in section',              short: 'nail · boat',    kind: 'nail' },
    nails_three:      { name: 'three nails of three lengths',                short: '3 nails',        kind: 'nail' },
    spike_iron:       { name: 'an iron spike off the old harbour ironwork',  short: 'spike',          kind: 'metal' },
    rust_pinch:       { name: 'a pinch of rust off the mooring ring',        short: 'rust',           kind: 'dust', fill: '#8a4a29' },
    hubcap:           { name: 'a hubcap off the Mercedes',                   short: 'hubcap',         kind: 'metal' },
    paintchip:        { name: 'a paint chip off a shutter',                  short: 'paint chip',     kind: 'chip', fill: '#2f6f8f' },
    hook_fish:        { name: 'one fish hook, straightened',                 short: 'hook',           kind: 'nail' },

    /* stone, clay, glass, tile */
    clay_wild:        { name: 'a lump of shore clay',                        short: 'clay',           kind: 'clay' },
    clay_die:         { name: 'a clay die, still soft',                      short: 'die · wet',      kind: 'clay' },
    clay_die_dry:     { name: 'a clay die, sun-dried and slightly wrong',    short: 'die · dry',      kind: 'clay' },
    mortar_chip:      { name: 'a chip of mortar out of the sea wall',        short: 'mortar',         kind: 'chip' },
    pebbles_sorted:   { name: 'three shore pebbles, sorted by lightness',    short: 'pebbles',        kind: 'box' },
    stone_marker:     { name: 'a stone chosen to be a marker',              short: 'stone',          kind: 'chip' },
    stone_niche:      { name: 'a stone for leaving in the niche',            short: 'stone',          kind: 'chip' },
    glass_blue:       { name: 'a scrap of blue sea glass',                   short: 'glass · blue',   kind: 'glass', fill: '#3d6b8a' },
    glass_safety:     { name: 'a cube of safety glass',                      short: 'glass · safety', kind: 'glass', fill: '#8fa89c' },
    tile_shard:       { name: 'a shard of roof tile',                        short: 'tile',           kind: 'chip', fill: '#a8603f' },
    tile_whole:       { name: 'one whole roof tile, off the heap',           short: 'tile · whole',   kind: 'chip', fill: '#a8603f' },
    cap_flattened:    { name: 'a flattened bottle cap, pre-twist-off',       short: 'cap',            kind: 'cap' },
    coin_souk:        { name: 'a coin off the floor of the souk',            short: 'coin · souk',    kind: 'metal' },
    coin_sea:         { name: 'a coin the sea has worn blank',               short: 'coin · worn',    kind: 'metal' },
    tar_ball:         { name: 'a ball of slipway tar',                       short: 'tar',            kind: 'clay', fill: '#23201e' },

    /* growing and formerly growing things */
    leaf_fig:         { name: 'a leaf off the oldest fig',                   short: 'leaf · fig',     kind: 'leaf' },
    leaf_pressed:     { name: 'a fig leaf, pressed flat overnight',          short: 'leaf · flat',    kind: 'leaf' },
    leaf_olive:       { name: 'an olive leaf, silver side up',               short: 'leaf · olive',   kind: 'leaf' },
    mint_chapel:      { name: 'a handful of the chapel mint',                short: 'mint',           kind: 'leaf' },
    caper_sprig:      { name: 'a sprig of caper off the wall',               short: 'caper',          kind: 'leaf' },
    caper_pods:       { name: 'the pods off one caper plant',                short: 'pods',           kind: 'seed' },
    caper_split:      { name: 'caper seed counted into two equal piles',     short: 'two piles',      kind: 'seed' },
    pip:              { name: 'a lemon pip',                                 short: 'pip',            kind: 'seed', stack: true },
    pips_kept:        { name: 'forty-one pips, the heavy three discarded',    short: 'pips',           kind: 'seed' },
    jasmine_head:     { name: 'one jasmine flower, closed',                  short: 'jasmine',        kind: 'seed', stack: true },
    jasmine_nine:     { name: 'nine jasmine flowers, none of them open',     short: '9 flowers',      kind: 'seed' },
    bougain_bract:    { name: 'one bougainvillea bract, paper-dry',          short: 'bract',          kind: 'leaf' },
    lemon:            { name: 'one lemon off the courtyard tree',            short: 'lemon',          kind: 'seed' },
    chickpea:         { name: 'one chickpea out of the dukkan sack',         short: 'chickpea',       kind: 'seed' },
    chickpea_planted: { name: 'the memory of planting one chickpea badly',    short: '—',              kind: 'seed', ghost: true },
    cicada_skin:      { name: 'the dried skin of one cicada',                short: 'cicada',         kind: 'shell' },
    gecko_skin:       { name: 'a shed gecko skin, mostly whole',             short: 'gecko skin',     kind: 'shell' },
    urchin_shell:     { name: 'one urchin shell, unbroken',                  short: 'urchin',         kind: 'shell' },
    limpet:           { name: 'a limpet shell off the wall',                 short: 'limpet',         kind: 'shell' },

    /* dust and residue */
    baggie_dust:      { name: 'a bag of dust off the abandoned house',       short: 'bag · dust',     kind: 'dust', fill: '#9a9183' },
    bottle_labeled:   { name: 'a bottle with its label perfectly intact',    short: 'bottle',         kind: 'glass', fill: '#7d9a76' },
    label_peeled:     { name: 'a label peeled off in one piece',             short: 'label',          kind: 'paper' },
    poster_scrap:     { name: 'one layer of poster, lifted whole',           short: 'poster',         kind: 'paper' },
    wax_drip:         { name: 'a drip of candle wax off the chapel stand',   short: 'wax',            kind: 'chip', fill: '#e6dcc0' },

    /* recordings and photographs */
    recording_sea:    { name: 'eleven seconds of the sea in the wall',       short: 'audio · 11s',    kind: 'audio' },
    recording_bells:  { name: 'the chapel bell, from the fountain square',   short: 'audio · bell',   kind: 'audio' },
    recording_gen:    { name: 'the generator changing its mind',             short: 'audio · gen',    kind: 'audio' },
    photo:            { name: 'a photograph',                                short: 'photo',          kind: 'photo' }
  };

  /* every verb you can hold E on, with how long it takes and what to call it */
  var V = {
    BUY:       { label: 'Buy',        ing: 'Buying',        hold: 0.8, sfx: 'till' },
    FILL:      { label: 'Fill',       ing: 'Filling',       hold: 2.6, sfx: 'water' },
    SCRAPE:    { label: 'Scrape',     ing: 'Scraping',      hold: 3.4, sfx: 'scrape' },
    CHIP:      { label: 'Chip',       ing: 'Chipping',      hold: 3.8, sfx: 'scrape' },
    DIG:       { label: 'Dig',        ing: 'Digging',       hold: 3.2, sfx: 'dig' },
    SEARCH:    { label: 'Search',     ing: 'Searching',     hold: 2.2, sfx: 'rummage' },
    PICK:      { label: 'Pick',       ing: 'Picking',       hold: 1.6, sfx: 'rustle' },
    TAKE:      { label: 'Take',       ing: 'Taking',        hold: 1.4, sfx: 'rustle' },
    'TAKE LEAF': { label: 'Take a leaf', ing: 'Reaching',   hold: 1.8, sfx: 'rustle' },
    TRACE:     { label: 'Trace',      ing: 'Tracing',       hold: 4.6, sfx: 'paper' },
    RUB:       { label: 'Rub',        ing: 'Rubbing',       hold: 4.2, sfx: 'paper' },
    MEASURE:   { label: 'Measure',    ing: 'Measuring',     hold: 3.0, sfx: 'paper' },
    COUNT:     { label: 'Count',      ing: 'Counting',      hold: 5.2, sfx: null },
    READ:      { label: 'Read',       ing: 'Reading',       hold: 3.0, sfx: 'paper' },
    'READ ALOUD': { label: 'Read it aloud', ing: 'Reading aloud', hold: 7.0, sfx: null },
    LISTEN:    { label: 'Listen',     ing: 'Listening',     hold: 4.0, sfx: null },
    SPEAK:     { label: 'Say one word', ing: 'Saying it',   hold: 2.0, sfx: null },
    LOOK:      { label: 'Look',       ing: 'Looking',       hold: 1.6, sfx: null },
    TOUCH:     { label: 'Touch',      ing: 'Touching',      hold: 2.4, sfx: null },
    WIPE:      { label: 'Wipe',       ing: 'Wiping',        hold: 3.0, sfx: 'scrape' },
    WRAP:      { label: 'Wrap',       ing: 'Wrapping',      hold: 4.4, sfx: 'rustle' },
    SEAL:      { label: 'Seal',       ing: 'Sealing',       hold: 2.0, sfx: 'lid' },
    KNOT:      { label: 'Knot',       ing: 'Knotting',      hold: 2.2, sfx: 'rustle' },
    SHAPE:     { label: 'Shape',      ing: 'Shaping',       hold: 5.4, sfx: 'clay' },
    ROLL:      { label: 'Roll',       ing: 'Rolling',       hold: 3.0, sfx: 'clay' },
    WIND:      { label: 'Wind',       ing: 'Winding',       hold: 4.0, sfx: 'wire' },
    SORT:      { label: 'Sort',       ing: 'Sorting',       hold: 4.0, sfx: 'rummage' },
    PLACE:     { label: 'Place',      ing: 'Placing',       hold: 1.4, sfx: 'set' },
    PLANT:     { label: 'Plant',      ing: 'Planting',      hold: 2.6, sfx: 'dig' },
    BALANCE:   { label: 'Balance',    ing: 'Balancing',     hold: 3.4, sfx: 'set' },
    MARK:      { label: 'Mark',       ing: 'Marking',       hold: 2.0, sfx: 'set' },
    LEAVE:     { label: 'Leave it',   ing: 'Leaving it',    hold: 1.6, sfx: 'set' },
    STAND:     { label: 'Stand',      ing: 'Standing',      hold: 1.2, sfx: null },
    SIT:       { label: 'Sit',        ing: 'Sitting',       hold: 1.2, sfx: null },
    WAIT:      { label: 'Wait',       ing: 'Waiting',       hold: 1.0, sfx: null },
    WRITE:     { label: 'Write',      ing: 'Writing',       hold: 2.8, sfx: 'paper' },
    PRESS:     { label: 'Press',      ing: 'Pressing',      hold: 2.2, sfx: 'set' },
    PEEL:      { label: 'Peel',       ing: 'Peeling',       hold: 4.8, sfx: 'paper' },
    FOLD:      { label: 'Fold',       ing: 'Folding',       hold: 2.2, sfx: 'cloth' },
    WRING:     { label: 'Wring',      ing: 'Wringing',      hold: 2.4, sfx: 'cloth' },
    RECORD:    { label: 'Record',     ing: 'Recording',     hold: 1.0, sfx: null },
    ENTER:     { label: 'Go in',      ing: 'Going in',      hold: 0.9, sfx: 'door' },
    OPEN:      { label: 'Open',       ing: 'Opening',       hold: 1.2, sfx: 'door' },
    HOLD:      { label: 'Hold it up', ing: 'Holding it up', hold: 3.0, sfx: null },
    DISCARD:   { label: 'Discard',    ing: 'Discarding',    hold: 2.6, sfx: 'rustle' },
    PHOTOGRAPH:{ label: 'Photograph', ing: 'Framing',       hold: 0.4, sfx: 'shutter' }
  };

  /* shop stock. nobody in the quarter finds any of this remarkable. */
  var SHOPS = {
    dukkan: {
      name: 'the dukkan',
      lines: ['Nadia rings it up without looking at it.', 'The fridge motor starts as you leave.'],
      stock: [
        { item: 'jar_empty', label: 'a glass jar', note: 'the shelf above the olives' },
        { item: 'twine', label: 'a ball of net twine', note: 'by the till, with the clothes pegs' },
        { item: 'spoon', label: 'a tin spoon', note: 'out of the cup by the coffee' },
        { item: 'baggie', label: 'a small plastic bag', note: 'they come in fifties, you take one' },
        { item: 'matchbox', label: 'an empty matchbox', note: 'the matches come out first' },
        { item: 'pencil', label: 'a carpenter pencil', note: 'flat, so it will not roll off a wall' },
        { item: 'paper', label: 'a sheet of paper', note: 'off the pad by the phone' },
        { item: 'coin', label: 'change, deliberately', note: 'for ruining' },
        { item: 'receipt', label: 'a receipt', note: 'Nadia prints one whether you want it or not' },
        { item: 'chickpea', label: 'one chickpea', note: 'out of the open sack' }
      ]
    },
    lemonade: {
      name: "Abou Georges' lemonade stand",
      lines: ['Abou Georges does not ask whether you want the pips in.',
        'He wipes the counter after you, not before.'],
      stock: [
        { item: 'lemonade', label: 'a glass of lemonade', note: 'the pips are part of it' },
        { item: 'lemon', label: 'one lemon out of the crate', note: 'he picks it, not you' }
      ]
    },
    furn: {
      name: 'the furn',
      lines: ['Elie slides it across on paper and says nothing.',
        'The oven breathes out at you as the door goes.'],
      stock: [
        { item: 'kaak', label: 'a kaak, straight off the oven', note: 'too hot to hold properly' },
        { item: 'paper', label: 'the paper it came on', note: 'a little translucent now' }
      ]
    },
    sabon: {
      name: 'the soap shop',
      lines: ['Rita wraps it in tissue you will throw away at the door.',
        'The whole shop smells like the inside of a jar of olives.'],
      stock: [
        { item: 'soap_bar', label: 'a bar of olive-oil soap', note: 'off the bottom of the pyramid' },
        { item: 'twine', label: 'a length of string', note: 'she ties the parcel with it' },
        { item: 'paper', label: 'a sheet of tissue paper', note: 'thinner than you want' }
      ]
    },
    qahwe: {
      name: 'the qahwe',
      lines: ['Joseph brings it without being asked and takes nothing for it.',
        'Somebody moves a backgammon piece behind you.'],
      stock: [
        { item: 'coffee', label: 'a finjan of coffee', note: 'sweet unless you say otherwise, and you did not' },
        { item: 'wire_fish', label: 'a length of wire off the chair frame', note: 'nobody stops you' }
      ]
    }
  };

  ER.Items = I;
  ER.Verbs = V;
  ER.Shops = SHOPS;

  ER.itemName = function (id) { return (I[id] && I[id].name) || id; };
  ER.itemShort = function (id) { return (I[id] && I[id].short) || id; };
  ER.itemKind = function (id) { return (I[id] && I[id].kind) || 'chip'; };
  ER.verbInfo = function (v) { return V[v] || { label: v, ing: v, hold: 2.0, sfx: null }; };
})(typeof window !== 'undefined' ? (window.ER = window.ER || {}) : (global.ER = global.ER || {}));
