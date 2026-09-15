/* Errands — the name pools Hollis Bend draws from.
   Thirty residents, plus the dead in the cemetery, plus the streets. */
(function (ER) {
  'use strict';

  ER.Names = {
    /* deliberately unglamorous, plausible for a rural town of 30 */
    first: ['Dale', 'Marlene', 'Roy', 'Deb', 'Curtis', 'Janine', 'Wes', 'Trish', 'Arlen',
      'Bonnie', 'Duane', 'Cheryl', 'Kip', 'Lorna', 'Terrell', 'Angie', 'Hollis', 'Gwen',
      'Merle', 'Tammy', 'Otis', 'Priya', 'Bo', 'Nadine', 'Grady', 'Shauna', 'Rhett',
      'Fern', 'Lyle', 'Denise', 'Hank', 'Maribel', 'Clint', 'Rosalie', 'Ed', 'Junie',
      'Pete', 'Charlene', 'Vern', 'Yolanda', 'Coby', 'Imani', 'Dustin', 'Kelsey'],

    last: ['Latham', 'Pell', 'Vandermeer', 'Hobbs', 'Crandall', 'Mott', 'Strait', 'Okafor',
      'Bergeron', 'Nussbaum', 'Ivey', 'Rask', 'Delgado', 'Prine', 'Stolz', 'Wheat',
      'Fenno', 'Quarles', 'Ambrose', 'Tidwell', 'Sung', 'Boyer', 'Halter', 'Mundy',
      'Crick', 'Dowd', 'Pruitt', 'Leaming', 'Vance', 'Bitterman', 'Roush', 'Kettleman'],

    /* jobs that actually exist in a town this size in the present day */
    roles: [
      { t: 'runs the register at Bend Mart', work: 'bendmart_counter', kind: 'clerk' },
      { t: 'cooks at the diner', work: 'diner_counter', kind: 'diner' },
      { t: 'waits tables at the diner', work: 'diner_counter', kind: 'diner' },
      { t: 'is the postmaster', work: 'postoffice_boxes', kind: 'post' },
      { t: 'keeps the hardware store', work: 'hardware_counter', kind: 'hardware' },
      { t: 'teaches the combined 3rd-4th grade', work: 'school_door', kind: 'school' },
      { t: 'drives the school bus and plows in winter', work: 'busstop', kind: 'bus' },
      { t: 'does remote support for a logistics company', work: 'home', kind: 'remote' },
      { t: 'writes technical docs for a company in Seattle', work: 'home', kind: 'remote' },
      { t: 'is a bookkeeper for four farms and a church', work: 'home', kind: 'remote' },
      { t: 'does contract web work, mostly for dentists', work: 'home', kind: 'remote' },
      { t: 'manages a warehouse two towns over', work: 'out', kind: 'commuter' },
      { t: 'is a nurse, three twelves a week in the city', work: 'out', kind: 'commuter' },
      { t: 'runs the grain co-op scale', work: 'silo_spill', kind: 'coop' },
      { t: 'farms the north half of the section', work: 'field_north', kind: 'farm' },
      { t: 'farms and does custom baling', work: 'field_south', kind: 'farm' },
      { t: 'fixes small engines out of his garage', work: 'home', kind: 'mechanic' },
      { t: 'is framing the new house on Elm Court', work: 'construction_frame', kind: 'build' },
      { t: 'is retired from the state highway department', work: 'home', kind: 'retired' },
      { t: 'is retired, mostly gardens now', work: 'home', kind: 'retired' },
      { t: 'is retired and walks the same loop twice a day', work: 'home', kind: 'walker' },
      { t: 'pastors Trinity Methodist part-time', work: 'church_door', kind: 'pastor' },
      { t: 'is on disability and restores one lawn tractor', work: 'home', kind: 'retired' },
      { t: 'is fifteen and is not from here, apparently', work: 'busstop', kind: 'teen' },
      { t: 'is eleven and has a bike and opinions', work: 'park_hoop', kind: 'kid' },
      { t: 'is nine and collects things too', work: 'park_swing', kind: 'kid' },
      { t: 'cleans the school and the church', work: 'school_door', kind: 'custodian' },
      { t: 'is the volunteer fire chief and also sells insurance', work: 'firehouse_siren', kind: 'fire' },
      { t: 'does hair in the front room on Tuesdays', work: 'home', kind: 'home_biz' },
      { t: 'is home with a toddler and a monitor app', work: 'home', kind: 'parent' },
      { t: 'delivers for the rural route', work: 'postoffice_boxes', kind: 'post' },
      { t: 'is between things and honest about it', work: 'home', kind: 'idle' }
    ],

    /* older stock for the graves — the town's dead read a generation back */
    graveFirst: ['Eunice', 'Alvin', 'Hazel', 'Orville', 'Mabel', 'Clarence', 'Opal', 'Virgil',
      'Beulah', 'Homer', 'Vesta', 'Emmett', 'Lula', 'Alonzo', 'Effie', 'Wilbur', 'Myrtle',
      'Ervin', 'Cora', 'Silas', 'Etta', 'Rufus', 'Delia', 'Amos', 'Nola', 'Ezra', 'Ida',
      'Cyrus', 'Lavina', 'Asa', 'Prudence', 'Willis', 'Minerva', 'Enoch'],

    graveEpitaph: ['GONE HOME', 'AT REST', 'ASLEEP IN JESUS', 'BELOVED WIFE', 'BELOVED HUSBAND',
      'HE GAVE HIS BEST', 'SHE HATH DONE WHAT SHE COULD', 'FATHER', 'MOTHER',
      'INFANT SON', 'INFANT DAUGHTER', 'WE SHALL MEET AGAIN', 'RESTING', 'SUFFER THE CHILDREN',
      'A SOLDIER OF THE REPUBLIC', 'PEACE'],

    streets: {
      main: 'Main Street',
      church: 'Church Street',
      quarry: 'Quarry Road',
      depot: 'Depot Street',
      elm: 'Elm Court',
      cr9: 'County Road 9',
      mill: 'Old Mill Road'
    },

    junk: [
      'a bent washer', 'half a plastic comb', 'a dead lighter', 'a chewed pen cap',
      'a shard of amber glass, edges gone soft', 'a Popsicle stick, weathered smooth',
      'a AA battery, leaking', 'a length of orange baler twine', 'a foil gum wrapper',
      'a screw with the head stripped', 'a doll arm', 'a tine off a rake',
      'a 1997 quarter', 'a brass grommet', 'a shotgun shell, spent, red',
      'a hair elastic', 'a chunk of asphalt shaped almost like Ohio',
      'a bottle cap, crimped, sun-bleached', 'a zip tie, cut',
      'a piece of window screen, balled up', 'a fishhook, rusted past use',
      'a key to nothing', 'a plastic soldier missing a leg',
      'a wad of dryer lint that has been rained on', 'a tooth (animal)',
      'a mud dauber nest, empty', 'a strip of chrome trim',
      'a golf tee', 'a domino, double blank', 'a fuse',
      'a receipt, illegible', 'a marble with a bubble in it',
      'the corner of a license plate', 'a staple the size of a staple',
      'a walnut hull, black', 'a spark plug', 'a pull-tab of the old kind',
      'a button, four holes, cream', 'a hinge pin', 'a dime, bent'
    ]
  };
})(typeof window !== 'undefined' ? (window.ER = window.ER || {}) : (global.ER = global.ER || {}));
