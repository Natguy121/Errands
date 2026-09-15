/* Errands — the things you end up carrying, and the things you do to them. */
(function (ER) {
  'use strict';

  /* kind drives the little procedural icon in the inventory strip */
  var I = {
    /* containers and their contents */
    jar_empty:        { name: 'a glass pint jar',                         short: 'jar',            kind: 'jar' },
    jar_creek:        { name: 'a jar of creek water',                      short: 'jar · creek',    kind: 'jar', fill: '#6d8a86' },
    jar_creek_sealed: { name: 'a sealed jar of creek water',               short: 'jar · sealed',   kind: 'jar', fill: '#6d8a86', lid: true },
    jar_creek_twined: { name: 'a sealed jar of creek water, twine at the rim', short: 'jar · done', kind: 'jar', fill: '#6d8a86', lid: true, twine: true },
    jar_pond:         { name: 'a jar of pond water, clouded',              short: 'jar · pond',     kind: 'jar', fill: '#6f7550' },
    jar_pond_settled: { name: 'a jar of pond water you can see through',   short: 'jar · clear',    kind: 'jar', fill: '#8a9a92' },
    jar_fog:          { name: 'a jar of fog',                              short: 'jar · fog',      kind: 'jar', fill: '#c9ccc8', lid: true },
    jar_frost:        { name: 'a jar of windshield frost',                 short: 'jar · frost',    kind: 'jar', fill: '#d5e2e6', lid: true },
    jar_spigot:       { name: 'a jar of cemetery water',                   short: 'jar · spigot',   kind: 'jar', fill: '#7d8f96' },

    /* string, cloth, wire */
    twine:            { name: 'a ball of jute twine',                      short: 'twine',          kind: 'wire' },
    twine_measure:    { name: 'a length of twine, knotted at the step',    short: 'twine · knot',   kind: 'wire' },
    twine_spent:      { name: 'the cardboard core of a twine ball',        short: 'twine core',     kind: 'wire' },
    wire_bale:        { name: 'a length of baling wire',                   short: 'bale wire',      kind: 'wire' },
    wire_circle:      { name: 'baling wire wound to a coffee-cup rim',     short: 'wire ring',      kind: 'wire' },
    sock:             { name: 'one sock from the lost-and-found',          short: 'sock',           kind: 'cloth' },
    sock_folded:      { name: 'one sock, folded anyway',                   short: 'sock · folded',  kind: 'cloth' },

    /* tools and stationery */
    spoon:            { name: 'a plastic spoon',                           short: 'spoon',          kind: 'tool' },
    spoon_mossy:      { name: 'a spoonful of bridge moss',                 short: 'spoon · moss',   kind: 'tool', fill: '#5f7a43' },
    pencil:           { name: 'a carpenter pencil',                        short: 'pencil',         kind: 'tool' },
    paper:            { name: 'a sheet of paper',                          short: 'paper',          kind: 'paper' },
    matchbox:         { name: 'an empty matchbox',                         short: 'matchbox',       kind: 'box' },
    baggie:           { name: 'a sandwich bag',                            short: 'baggie',         kind: 'box' },
    coin:             { name: 'a coin you are willing to ruin',            short: 'coin',           kind: 'metal' },
    receipt:          { name: 'a Bend Mart receipt',                       short: 'receipt',        kind: 'paper' },
    receipt_numbered: { name: 'a receipt with a number on the back',       short: 'receipt · no.',  kind: 'paper' },
    receipt_bleached: { name: 'a receipt the sun has emptied',             short: 'receipt · blank', kind: 'paper' },
    rubbing:          { name: 'a pencil rubbing of the cornerstone date',  short: 'rubbing',        kind: 'paper' },
    note_discrepancy: { name: 'a note of the discrepancy',                 short: 'note',           kind: 'paper' },
    note_ranking:     { name: 'a ranking of three creek temperatures',     short: 'ranking',        kind: 'paper' },

    /* iron and rust */
    nail_rusted:      { name: 'a rusted nail',                             short: 'nail · rust',    kind: 'nail' },
    nail_horseshoe:   { name: 'a horseshoe nail',                          short: 'nail · shoe',    kind: 'nail' },
    nails_three:      { name: 'three nails of three lengths',              short: '3 nails',        kind: 'nail' },
    spike_iron:       { name: 'a discarded iron spike',                    short: 'spike',          kind: 'metal' },
    rust_pinch:       { name: 'a pinch of rail rust',                      short: 'rust',           kind: 'dust', fill: '#8a4a29' },
    hubcap:           { name: 'a hubcap from the ditch',                   short: 'hubcap',         kind: 'metal' },
    paintchip:        { name: 'a paint chip off the backstop',             short: 'paint chip',     kind: 'chip', fill: '#5a7a5f' },

    /* stone, clay, glass */
    clay_wild:        { name: 'a lump of wild clay',                       short: 'clay',           kind: 'clay' },
    clay_die:         { name: 'a clay die, still soft',                    short: 'die · wet',      kind: 'clay' },
    clay_die_dry:     { name: 'a clay die, sun-dried and slightly wrong',  short: 'die · dry',      kind: 'clay' },
    mortar_chip:      { name: 'a chip of bridge mortar',                   short: 'mortar',         kind: 'chip' },
    gravel_sorted:    { name: 'three gravels, sorted by lightness',        short: 'gravel',         kind: 'box' },
    stone_marker:     { name: 'a stone chosen to be a marker',             short: 'stone',          kind: 'chip' },
    stone_grave:      { name: 'a stone for leaving on a grave',            short: 'stone',          kind: 'chip' },
    glass_blue:       { name: 'a shard of blue glass',                     short: 'glass · blue',   kind: 'glass', fill: '#3d6b8a' },
    glass_safety:     { name: 'a cube of safety glass',                    short: 'glass · safety', kind: 'glass', fill: '#8fa89c' },
    cap_flattened:    { name: 'a flattened bottle cap, pre-twist-off',     short: 'cap',            kind: 'cap' },
    penny:            { name: 'a penny from the Bend Mart lot',            short: 'penny',          kind: 'metal' },
    penny_flat:       { name: 'a penny the rail has had a night with',     short: 'penny · flat',   kind: 'metal' },
    tar_ball:         { name: 'a ball of road tar',                        short: 'tar',            kind: 'clay', fill: '#23201e' },

    /* growing and formerly growing things */
    leaf_maple:       { name: 'a leaf from the oldest maple',              short: 'leaf',           kind: 'leaf' },
    leaf_pressed:     { name: 'a maple leaf, pressed flat overnight',      short: 'leaf · flat',    kind: 'leaf' },
    mint_church:      { name: 'a handful of church mint',                  short: 'mint',           kind: 'leaf' },
    cattail:          { name: 'a cattail',                                 short: 'cattail',        kind: 'leaf' },
    acorn:            { name: 'an acorn',                                  short: 'acorn',          kind: 'seed', stack: true },
    acorns_kept:      { name: 'thirty-six acorns, the heavy four discarded', short: 'acorns',       kind: 'seed' },
    dandelion:        { name: 'a dandelion gone entirely to seed',         short: 'dandelion',      kind: 'seed', stack: true },
    dandelions_nine:  { name: 'nine dandelion heads, unblown',             short: '9 heads',        kind: 'seed' },
    milkweed_pods:    { name: 'the pods off one milkweed',                 short: 'pods',           kind: 'seed' },
    milkweed_split:   { name: 'milkweed seed counted into two equal piles', short: 'two piles',     kind: 'seed' },
    kernel:           { name: 'one kernel of co-op corn',                  short: 'kernel',         kind: 'seed' },
    kernel_planted:   { name: 'the memory of planting one kernel badly',   short: '—',              kind: 'seed', ghost: true },
    cicada_skin:      { name: 'the dried skin of one cicada',              short: 'cicada',         kind: 'shell' },
    snakeskin:        { name: 'a shed snake skin, mostly whole',           short: 'snakeskin',      kind: 'shell' },

    /* dust and residue */
    baggie_dust:      { name: 'a sandwich bag of storage-door dust',       short: 'bag · dust',     kind: 'dust', fill: '#9a9183' },
    bottle_labeled:   { name: 'a bottle with its label perfectly intact',  short: 'bottle',         kind: 'glass', fill: '#7d9a76' },
    label_peeled:     { name: 'a label peeled off in one piece',           short: 'label',          kind: 'paper' },

    /* recordings and photographs */
    recording_bridge: { name: 'eleven seconds of the concrete bridge',     short: 'audio · 11s',    kind: 'audio' },
    recording_siren:  { name: 'the siren test, from the middle of the field', short: 'audio · siren', kind: 'audio' },
    photo:            { name: 'a photograph',                              short: 'photo',          kind: 'photo' }
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

  /* shop stock. nobody in Hollis Bend finds any of this remarkable. */
  var SHOPS = {
    bendmart: {
      name: 'Bend Mart',
      lines: ['Dale rings it up without looking at it.', 'The door chimes on the way out.'],
      stock: [
        { item: 'jar_empty', label: 'a glass pint jar', note: 'aisle two, with the canning lids' },
        { item: 'twine', label: 'a ball of jute twine', note: 'by the register' },
        { item: 'spoon', label: 'a plastic spoon', note: 'in the cup by the coffee' },
        { item: 'baggie', label: 'a sandwich bag', note: 'they are sold in fifties, you take one' },
        { item: 'matchbox', label: 'an empty matchbox', note: 'the matches come out first' },
        { item: 'coin', label: 'change, deliberately', note: 'for ruining' },
        { item: 'receipt', label: 'a receipt', note: 'they print whether you want one or not' }
      ]
    },
    hardware: {
      name: 'Pell Hardware',
      lines: ['Curtis writes it in a ledger. There is no need for the ledger.', 'The floorboards announce you both ways.'],
      stock: [
        { item: 'wire_bale', label: 'a length of baling wire', note: 'off the spool out back' },
        { item: 'pencil', label: 'a carpenter pencil', note: 'flat, so it will not roll off a rafter' },
        { item: 'paper', label: 'a sheet of paper', note: 'torn off the order pad' },
        { item: 'twine', label: 'a ball of jute twine', note: 'the good jute' },
        { item: 'spoon', label: 'a spoon, metal, from the break room', note: 'Curtis wants it back' }
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
