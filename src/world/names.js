/* Errands — the name pools the quarter draws from.
   Thirty residents, the work they do, the alleys, and the junk underfoot. */
(function (ER) {
  'use strict';

  ER.Names = {
    /* ordinary, plausible for one block of a Lebanese coastal town */
    first: ['Georges', 'Nadia', 'Elie', 'Rita', 'Tony', 'Layla', 'Charbel', 'Zeina',
      'Maroun', 'Therese', 'Joseph', 'Mona', 'Fadi', 'Yara', 'Ziad', 'Hiba',
      'Antoine', 'Nour', 'Rami', 'Amal', 'Sami', 'Rana', 'Michel', 'Maya',
      'Wadih', 'Leila', 'Najib', 'Dany', 'Khalil', 'Marwan', 'Pierre', 'Hanna',
      'Milad', 'Salim', 'Boutros', 'Sarkis', 'Jad', 'Karim', 'Randa', 'Tala'],

    last: ['Khoury', 'Haddad', 'Sassine', 'Nakhle', 'Rizk', 'Assaf', 'Daher', 'Chami',
      'Karam', 'Semaan', 'Tannous', 'Zgheib', 'Mansour', 'Saade', 'Younes', 'Ghanem',
      'Sfeir', 'Maalouf', 'Nassar', 'Gerges', 'Chidiac', 'Bou Khalil', 'El Hage',
      'Abi Nader', 'Hobeika', 'Mouawad', 'Frangieh', 'Attieh', 'Bejjani', 'Aoun'],

    /* work that actually exists in a quarter this size, plus the remote jobs
       that have arrived in the last ten years and changed nothing visible */
    roles: [
      { t: 'squeezes the lemonade and will not say what else is in it', work: 'lemonade_counter', kind: 'lemonade' },
      { t: 'runs the furn and has burnt the same two knuckles for thirty years', work: 'furn_counter', kind: 'furn' },
      { t: 'keeps the dukkan and prints receipts nobody asked for', work: 'dukkan_counter', kind: 'dukkan' },
      { t: 'stacks the soap into a pyramid every Monday', work: 'sabon_counter', kind: 'sabon' },
      { t: 'brings the coffee before you have sat down', work: 'qahwe_counter', kind: 'qahwe' },
      { t: 'cuts hair under a pole that does not turn', work: 'barber_chair', kind: 'barber' },
      { t: 'fishes, and mends the nets on the quay when he does not', work: 'quay_nets', kind: 'fisher' },
      { t: 'fishes, and is the one who actually knows the weather', work: 'samke_door', kind: 'fisher' },
      { t: 'says the morning mass at Saydet el Bahr', work: 'chapel_door', kind: 'priest' },
      { t: 'unlocks the chapel and counts the candles', work: 'chapel_candles', kind: 'sacristan' },
      { t: 'sits on her balcony and misses nothing', work: 'teta_balcony', kind: 'teta' },
      { t: 'waters the pots on three doorsteps that are not hers', work: 'fountain', kind: 'waterer' },
      { t: 'keeps the generator running and collects for it in cash', work: 'souk_generator', kind: 'generator' },
      { t: 'drives the service taxi and parks where the souk gives out', work: 'souk_taxi', kind: 'driver' },
      { t: 'designs websites for a company in Beirut, from the roof', work: 'home', kind: 'remote' },
      { t: 'does the books for two guesthouses and a diving school', work: 'home', kind: 'remote' },
      { t: 'edits subtitles for a streaming service, badly paid', work: 'home', kind: 'remote' },
      { t: 'teaches maths online to children in three time zones', work: 'home', kind: 'remote' },
      { t: 'runs the guesthouse on Darb el Aaliye, four rooms', work: 'home', kind: 'guesthouse' },
      { t: 'teaches kiteboarding in summer and nothing in winter', work: 'sea_steps', kind: 'kite' },
      { t: 'is a nurse at the hospital up the coast, nights', work: 'out', kind: 'commuter' },
      { t: 'works at the port and is home at seven', work: 'out', kind: 'commuter' },
      { t: 'is retired from the municipality and inspects everything', work: 'square_bench', kind: 'retired' },
      { t: 'is retired and repoints the same wall every spring', work: 'home', kind: 'retired' },
      { t: 'is retired and walks the sea wall twice a day', work: 'wall_channel', kind: 'walker' },
      { t: 'feeds the cats and denies it', work: 'souk_cat_blue', kind: 'cats' },
      { t: 'sews at home and takes in from three streets', work: 'home', kind: 'home_biz' },
      { t: 'is home with a toddler and a monitor app', work: 'home', kind: 'parent' },
      { t: 'is nineteen and back for the summer, unimpressed', work: 'qahwe_chairs', kind: 'teen' },
      { t: 'is eleven, has a bike, and has opinions about the cats', work: 'square_cat', kind: 'kid' },
      { t: 'is nine and also collects things', work: 'square_cracks', kind: 'kid' },
      { t: 'is between things and honest about it', work: 'home', kind: 'idle' }
    ],

    /* the alleys */
    streets: {
      quay: 'Rue de la Mer',
      souk: 'Souk el Qadim',
      daraj: 'Darb el Daraj',
      mina: 'Bab el Mina',
      zaroub: 'Ez-Zaroub',
      aliya: 'Darb el Aaliye',
      tahta: 'Darb et Tahta',
      sharq: 'Darb esh Sharq'
    },

    junk: [
      'a bent washer', 'half a plastic comb', 'a dead lighter', 'a chewed pen cap',
      'a scrap of green glass, edges gone soft', 'an ice-cream stick, weathered smooth',
      'a AA battery, leaking', 'a length of orange net twine', 'a foil gum wrapper',
      'a screw with the head stripped', 'a doll arm', 'a tine off a rake',
      'a 500 lira coin from before', 'a brass grommet', 'a fish hook, rusted past use',
      'a hair elastic', 'a chunk of mortar shaped almost like Cyprus',
      'a bottle cap, crimped, sun-bleached', 'a zip tie, cut',
      'a piece of window screen, balled up', 'a shred of prayer card',
      'a key to nothing', 'a plastic soldier missing a leg',
      'a cigarette filter the sea has been at', 'a tooth (cat)',
      'a wasp nest, empty', 'a strip of chrome trim off a Mercedes',
      'a backgammon piece, white', 'a domino, double blank', 'a fuse',
      'a receipt, illegible', 'a marble with a bubble in it',
      'a corner of a Lebanese licence plate', 'a staple the size of a staple',
      'an olive pit, ancient', 'a spark plug', 'a pull-tab of the old kind',
      'a button, four holes, cream', 'a hinge pin', 'a coin, bent',
      'a pistachio shell', 'a length of shutter slat', 'a sequin',
      'a shard of blue tile', 'a fragment of terracotta, glazed on one side'
    ]
  };
})(typeof window !== 'undefined' ? (window.ER = window.ER || {}) : (global.ER = global.ER || {}));
