/* Errands — the thirty.
 *
 * They have jobs and routines and they walk on the roads. They are not
 * quest-givers; nobody in the quarter has ever given anybody an errand.
 * What they do is see you. Over and over, in a place too small to hide in.
 */
(function (ER) {
  'use strict';
  var U = ER.U;
  var N = ER.Names;

  /* ------------------------------------------------------------------ *
   *  what they say, arranged by how long they have been watching
   * ------------------------------------------------------------------ */

  var GENERIC = [
    /* 0 — you are new and that is the whole of it */
    ["You're in the old Latham place, right? Somebody said it went.",
     "Welcome. Nothing happens here, which some people are after.",
     "Trash is Thursday. They come early, so put it out Wednesday.",
     "Water pressure's poor on that side of Depot. Going in, you should know.",
     "If you need anything, we're the one with the blue door.",
     "You'll get used to the trains not coming.",
     "Internet's fine. Everybody asks that first.",
     "That your car out front, or does it belong to the house?"],

    /* 1 — they have started to notice the walking */
    ["You walk a lot.",
     "Third time I've seen you today. Not counting this.",
     "Saw you out on the grade yesterday. Long way to go on foot.",
     "You lose something? I can help you look.",
     "You're out in all weather, aren't you.",
     "My wife says you're the walker. That's you, then.",
     "You always have your hands full.",
     "I'd offer you a ride but you never seem to be going anywhere."],

    /* 2 — puzzled, and honest about being puzzled */
    ["What is it you're doing, exactly? I'm not being nosy.",
     "Somebody said you were up at the cemetery. In the dark.",
     "You're always carrying something. What's in the jar?",
     "Is this for work? Is it a job, what you're doing?",
     "Are you writing something? A book, or.",
     "My boy says you were counting the water tower.",
     "I watched you look at a wall for ten minutes yesterday.",
     "Somebody's got you doing all this, or is it you?"],

    /* 3 — concerned, and trying to be light about it */
    ["You eating? I'm asking as a neighbour.",
     "You can come sit inside, you know. Any time.",
     "Listen. Is somebody making you do this?",
     "I won't ask again. But I did wonder.",
     "You've lost weight since you came.",
     "There's nothing out there. I've lived here fifty years.",
     "It's alright if you don't want to say.",
     "Come by on Sunday. Just come by."],

    /* 4 — they have stopped asking and started helping */
    ["Don't tell me. I'd rather find out later.",
     "Moss is better on the north side this time of year. I looked it up for you.",
     "I put something by for you. It's on your porch.",
     "You'll want the ditch past the stone bridge. Nobody mows it.",
     "Whatever it is, you're nearly done, I'd say.",
     "I told Deb to leave you be.",
     "We talk about it. Not unkindly.",
     "You were right about the drain. I went and checked."]
  ];

  var BYKIND = {
    clerk: [
      ["Bag? No bag. Right."],
      ["You're in most days now."],
      ["That's the fourth jar this week. Not judging."],
      ["You want the receipt? You always want the receipt."],
      ["Jars are on aisle two. I ordered more in for you."]
    ],
    diner: [
      ["Coffee's on. Sit anywhere, it's all the same."],
      ["You want the usual? You don't have a usual yet."],
      ["You measured my step. I saw you measure my step."],
      ["Sit down and eat something. On me, I don't care."],
      ["Your usual. Don't argue, it's already poured."]
    ],
    post: [
      ["Your box is 14. Key's stiff, wiggle it."],
      ["Nothing for you today. Nothing yesterday either."],
      ["You read that whole board out loud. Both sides."],
      ["If you're expecting something, it isn't coming."],
      ["I left the board up longer. Figured you'd want to read it again."]
    ],
    hardware: [
      ["Whatever you're after, I've got one of it."],
      ["Twine again?"],
      ["You want my break-room spoon back? You still have my spoon."],
      ["Take the pencil. Just take it."],
      ["Baling wire's cut to length by the door. I do it Mondays now."]
    ],
    pastor: [
      ["We're at ten thirty, if you ever want. No pressure at all."],
      ["I see you go past the church most evenings."],
      ["The mint behind the church is yours if you want it. It's only mint."],
      ["Whatever you're carrying, you can set it down for an hour."],
      ["I put the cemetery gate light on a timer. For dusk."]
    ],
    kid: [
      ["Are you the new guy? My mom says don't bother people."],
      ["What's in your pockets? Mine's got a spring in it."],
      ["Why do you do that? No, but WHY?"],
      ["I collect stuff too. Do you want to see my stuff?"],
      ["I found you a nail. It's the rusty kind. I looked for ages."]
    ],
    teen: [
      ["Hey."],
      ["You're out here again."],
      ["Are you, like, a surveyor?"],
      ["Honestly this is the most interesting thing that's happened."],
      ["I put a bottle cap on your porch. Flat one. Old kind."]
    ],
    walker: [
      ["Morning. Second lap, me."],
      ["We keep meeting. You go one way, I go the other."],
      ["I do the loop twice. You do — I don't know what you do."],
      ["Sixty-one years I've walked this road. Never once picked anything up."],
      ["I've started looking at the ground. Thanks for that."]
    ],
    fire: [
      ["We test the siren at noon. Don't let it startle you."],
      ["You were stood in the middle of the ballfield at noon."],
      ["Nothing out at that farmhouse is safe to stand under."],
      ["If you go through those floors nobody'll know for a day."],
      ["Noon test is Saturdays now too. You'll want to know that."]
    ],
    farm: [
      ["Don't mind the dust. That's just September."],
      ["You're welcome on the ground, just shut the gate."],
      ["Found your stone on the post. Left it there."],
      ["If you need clay there's better clay on my side of the creek."],
      ["I leave the gate open now. Save you the climb."]
    ],
    remote: [
      ["Sorry — I'm on a call. I'm always on a call."],
      ["I see you from the window. I'm at the window all day."],
      ["Do you work? Sorry. That came out wrong."],
      ["I'd come out but I'm on East Coast hours."],
      ["I watch for you around four. It breaks up the day."]
    ],
    retired: [
      ["Garden's done for the year. That's that."],
      ["You're busier than I ever was."],
      ["I used to know what everybody was up to."],
      ["Sit on the wall a minute. Go on."],
      ["There's a jar on your step. Pint. It's clean."]
    ],
    school: [
      ["You'll see the kids at three. Mind the crossing."],
      ["One of mine did a picture of you. You were bent over."],
      ["They ask about you. I tell them you're busy."],
      ["You could come talk to them about — whatever it is."],
      ["We did a unit on collecting. Your fault entirely."]
    ],
    mechanic: [
      ["Anything running rough, bring it round."],
      ["You don't drive anywhere, do you."],
      ["Somebody scraped frost off my windshield and took it."],
      ["I leave the shop open. Take what you need."],
      ["Put a box by the door. Rusted stuff. Help yourself."]
    ],
    build: [
      ["Watch the nails. Whole lot's nails."],
      ["Scrap pile's fair game, just don't climb the framing."],
      ["You took three nails and stood them up. I saw them standing."],
      ["Hard hat's in the truck if you're going to be in there."],
      ["I sort the scrap by size now. Don't read into it."]
    ],
    commuter: [
      ["Just got in. Two hours each way, it's fine."],
      ["You're out here when I go and when I get back."],
      ["Do you sleep? Genuine question."],
      ["I'd say get a hobby but I think that's what this is."],
      ["I look for you on the drive in. You're always somewhere."]
    ],
    parent: [
      ["Sorry — she's teething. It's all teething."],
      ["We watch you out the front window. It's a whole thing."],
      ["She points at you. She points at you and says 'man'."],
      ["Come in for a coffee. The house is a state, I don't care."],
      ["She collects rocks now. Puts them in a jar. I hope you're happy."]
    ],
    coop: [
      ["Scale's open till four if you've got anything to weigh."],
      ["Spill's out back. Nobody minds."],
      ["You took one kernel. One."],
      ["I weighed a man's pocket once. Not yours. Yet."],
      ["Left the scale on for you. Weigh whatever you like."]
    ],
    custodian: [
      ["I do the school and the church. Somebody has to."],
      ["You're out before I am and I'm out at five."],
      ["I clean up after everybody and you're picking things up. Funny."],
      ["Don't go in the portable, the floor's soft."],
      ["I stopped sweeping the backstop. Figured you were using it."]
    ],
    bus: [
      ["Route's the same forty years. Kids change."],
      ["I pass you twice a day, both directions."],
      ["You were sat in my shelter in the rain."],
      ["Get in, I'll run you up the road. No? Alright."],
      ["I go slow past the grade now. In case you're on it."]
    ],
    home_biz: [
      ["Tuesdays, if you ever want a trim."],
      ["Everybody tells me things. You don't tell me anything."],
      ["Deb says you were at the cemetery. Deb says a lot."],
      ["Come Tuesday. Just to sit, even."],
      ["I don't repeat what's said in my front room. Not about you."]
    ],
    idle: [
      ["I'm between things. You?"],
      ["You've got more on than I have."],
      ["At least yours is something."],
      ["I'd help if I knew what it was."],
      ["We're the same, you and me. Only you kept busy."]
    ]
  };

  /* said instead, sometimes, when the situation is too obvious to ignore */
  function contextLine(r, g, tier) {
    if (!g || !g.clock) return null;
    var rng = g.rng || Math;
    var roll = rng.next ? rng.next() : Math.random();
    if (roll > 0.34) return null;
    var carrying = g.inventoryList ? g.inventoryList() : [];
    var jars = 0, i;
    for (i = 0; i < carrying.length; i++) if (carrying[i].id.indexOf('jar') === 0) jars += carrying[i].n;
    var ph = g.clock.phase(), wx = g.clock.weather;

    if (jars >= 2 && tier >= 2) return 'You need a hand with those?';
    if (jars >= 1 && tier >= 3) return "That's a good jar. Don't lose the lid.";
    if ((wx === 'rain' || wx === 'storm') && tier >= 1) return "You're soaked through. Go home.";
    if (wx === 'fog' && tier >= 2) return "Can't see the tower in this. You'll be out in it anyway.";
    if (ph === 'night' && tier >= 1) return "It's late to be out. Not that it's my business.";
    if (ph === 'dawn' && tier >= 2) return "You beat me up. Nobody beats me up.";
    if (ph === 'dusk' && tier >= 3) return "It goes dark quick this time of year.";
    return null;
  }

  /* ------------------------------------------------------------------ *
   *  daily routines. hour -> where they are meant to be.
   * ------------------------------------------------------------------ */

  var ROUTINES = {
    lemonade:  [[7, 'home'], [8, 'lemonade_counter'], [13.5, 'qahwe_counter'], [14.5, 'lemonade_counter'], [20, 'home']],
    furn:      [[4.5, 'home'], [5.25, 'furn_counter'], [13, 'home'], [16, 'furn_counter'], [19, 'home']],
    dukkan:    [[6.5, 'home'], [7.5, 'dukkan_counter'], [14, 'qahwe_counter'], [15, 'dukkan_counter'], [21, 'home']],
    sabon:     [[8, 'home'], [9, 'sabon_counter'], [13, 'qahwe_counter'], [14, 'sabon_counter'], [18.5, 'home']],
    qahwe:     [[6, 'home'], [6.75, 'qahwe_counter'], [15, 'home'], [16.5, 'qahwe_counter'], [22.5, 'home']],
    barber:    [[8, 'home'], [9, 'barber_chair'], [13, 'qahwe_counter'], [14, 'barber_chair'], [19, 'home']],
    fisher:    [[4, 'home'], [4.5, 'quay_boat'], [10, 'quay_nets'], [12.5, 'qahwe_counter'], [14, 'quay_nets'], [18, 'home']],
    priest:    [[6, 'home'], [6.5, 'chapel_door'], [9, 'home'], [17.5, 'chapel_door'], [19, 'home']],
    sacristan: [[5.5, 'home'], [6, 'chapel_candles'], [10, 'chapel_door'], [13, 'home'], [17, 'chapel_candles'], [19.5, 'home']],
    teta:      [[7, 'home'], [8, 'teta_balcony'], [12.5, 'home'], [15.5, 'teta_balcony'], [20.5, 'home']],
    waterer:   [[6, 'home'], [6.75, 'fountain'], [8.5, 'home'], [17.5, 'fountain'], [19, 'home']],
    generator: [[7, 'home'], [8, 'souk_generator'], [12, 'qahwe_counter'], [13, 'souk_generator'], [18, 'home']],
    driver:    [[6, 'home'], [6.5, 'souk_taxi'], [12.5, 'qahwe_counter'], [13.5, 'souk_taxi'], [19.5, 'home']],
    remote:    [[8, 'home'], [12.25, 'home'], [13, 'qahwe_counter'], [14, 'home'], [18.5, 'dukkan_counter'], [19.5, 'home']],
    guesthouse:[[7, 'home'], [8, 'home'], [11, 'dukkan_counter'], [12, 'home'], [17, 'qahwe_counter'], [18.5, 'home']],
    kite:      [[8, 'home'], [10, 'sea_steps'], [13, 'qahwe_counter'], [14.5, 'sea_steps'], [19, 'home']],
    commuter:  [[5.5, 'home'], [6, 'out'], [18.5, 'home'], [19.5, 'dukkan_counter'], [20, 'home']],
    retired:   [[7, 'home'], [9, 'square_bench'], [11.5, 'qahwe_counter'], [13, 'home'], [16.5, 'square_bench'], [18.5, 'home']],
    walker:    [[6.5, 'home'], [7, 'LOOP'], [9, 'home'], [11, 'qahwe_counter'], [12, 'home'], [16.5, 'LOOP'], [18.5, 'home']],
    cats:      [[6.5, 'home'], [7.25, 'souk_cat_blue'], [9, 'home'], [17, 'quay_cat'], [18.5, 'home']],
    parent:    [[7.5, 'home'], [10, 'fountain'], [11.5, 'home'], [15.5, 'square_cat'], [17, 'home']],
    home_biz:  [[8, 'home'], [9, 'home'], [12.5, 'dukkan_counter'], [13.5, 'home'], [17, 'home']],
    kid:       [[7, 'home'], [8, 'out'], [14.5, 'square_cat'], [17.5, 'dukkan_counter'], [18.5, 'home']],
    teen:      [[8.5, 'home'], [11, 'qahwe_chairs'], [14, 'sea_steps'], [17, 'qahwe_chairs'], [22, 'home']],
    idle:      [[9, 'home'], [11, 'square_bench'], [12.5, 'qahwe_counter'], [14, 'sea_steps'], [17, 'home']]
  };

  /* Saturday and Sunday get shorter, looser days, and mass is at nine */
  var WEEKEND = {
    furn: [[5, 'home'], [5.75, 'furn_counter'], [12, 'home']],
    qahwe: [[7, 'home'], [7.75, 'qahwe_counter'], [23, 'home']],
    priest: [[7.5, 'home'], [8.5, 'chapel_door'], [12, 'home']],
    sacristan: [[7, 'home'], [8, 'chapel_candles'], [12, 'home']],
    DEFAULT: [[8.5, 'home'], [9, 'chapel_door'], [10.5, 'qahwe_counter'], [12.5, 'home'],
      [16.5, 'square_bench'], [18, 'sea_steps'], [20, 'home']]
  };

  /* the loop the retired walk twice a day, which is most of the quarter */
  var LOOP = ['square_bench', 'fountain', 'souk_sign', 'wall_channel', 'sea_steps',
    'chapel_step', 'bench_landing', 'daraj_steps'];

  var CLOTHES = ['#6d7a63', '#4f5a68', '#8a6f58', '#7a4f4a', '#586b72', '#9a8f74',
    '#4a4f56', '#6b5f7a', '#7d8a86', '#a6907a', '#3f4a42', '#8f6a4f'];

  /* ------------------------------------------------------------------ *
   *  making people
   * ------------------------------------------------------------------ */

  function populate(town, rng) {
    var roles = rng.shuffle(N.roles.slice());
    var firsts = rng.shuffle(N.first.slice());
    var lasts = rng.shuffle(N.last.slice());
    var people = [];
    var surnameByLot = {};

    /* One surname per house, and thirty people across eighteen houses, so
       most doors have two names behind them. Fifty metres of old town holds
       families, not thirty unrelated strangers. */
    town.lots.forEach(function (l, li) { surnameByLot[l.id] = lasts[li % lasts.length]; });

    for (var i = 0; i < 30; i++) {
      var lotIndex = i % town.lots.length;
      var lot = town.lots[lotIndex];
      var role = roles[i % roles.length];
      var last = surnameByLot[lot.id];
      var age = role.kind === 'kid' ? rng.int(8, 11)
        : role.kind === 'teen' ? rng.int(14, 17)
        : role.kind === 'retired' || role.kind === 'walker' ? rng.int(66, 86)
        : role.kind === 'parent' ? rng.int(27, 38)
        : rng.int(23, 62);

      var r = {
        id: 'res' + i,
        first: firsts[i % firsts.length],
        last: last,
        name: firsts[i % firsts.length] + ' ' + last,
        age: age,
        role: role.t,
        kind: role.kind,
        workProp: role.work,
        home: lot.id,
        lotIndex: lotIndex,
        x: lot.front.x, y: lot.front.y,
        facing: 0,
        colour: rng.pick(CLOTHES),
        hat: rng.chance(0.3),
        build: rng.float(0.88, 1.12),
        speed: role.kind === 'kid' ? 1.9 : role.kind === 'teen' ? 1.6
          : (role.kind === 'retired' || role.kind === 'walker') ? 1.02 : 1.36,
        /* how much of you this person has personally seen */
        seen: 0,
        witnessed: 0,
        lastSeenDay: 0,
        met: false,
        /* movement */
        dest: null, destPos: null, path: null, pathI: 0, away: false,
        loopI: rng.int(0, LOOP.length - 1),
        say: null, sayT: 0, barkCooldown: 0,
        wander: rng.float(0, 6.28),
        rng: rng.sub('res' + i)
      };

      r.scheduleFor = function (dow) {
        var weekend = (dow === 0 || dow === 6);
        var base = weekend ? (WEEKEND[this.kind] || WEEKEND.DEFAULT) : (ROUTINES[this.kind] || ROUTINES.idle);
        var out = [];
        for (var k = 0; k < base.length; k++) {
          var at = base[k][1];
          if (at === 'LOOP') at = LOOP[(this.loopI + k) % LOOP.length];
          out.push({ h: base[k][0], at: at });
        }
        return out;
      };

      r.bark = function (tier, g) {
        tier = U.clamp(tier | 0, 0, 4);
        var ctx = contextLine(this, g, tier);
        if (ctx) return ctx;
        var mine = BYKIND[this.kind];
        var pickRng = this.rng;
        if (mine && mine[tier] && mine[tier].length && pickRng.chance(0.55)) return pickRng.pick(mine[tier]);
        return pickRng.pick(GENERIC[tier]);
      };

      people.push(r);
    }

    /* households: a couple of the lots get a shared surname, the way they do */
    for (var j = 1; j < people.length; j++) {
      if (rng.chance(0.14)) {
        people[j].last = people[j - 1].last;
        people[j].name = people[j].first + ' ' + people[j].last;
      }
    }
    /* names must still be unique or the journal gets confusing */
    var used = {};
    for (var k = 0; k < people.length; k++) {
      while (used[people[k].name]) {
        people[k].first = rng.pick(N.first);
        people[k].name = people[k].first + ' ' + people[k].last;
      }
      used[people[k].name] = 1;
    }
    return people;
  }

  /* ------------------------------------------------------------------ *
   *  living
   * ------------------------------------------------------------------ */

  function destFor(r, town, clock) {
    var sched = r.scheduleFor(clock.dowIndex);
    var h = clock.hourFloat();
    var at = 'home';
    for (var i = 0; i < sched.length; i++) if (h >= sched[i].h) at = sched[i].at;
    /* everybody is home and in bed at night */
    if (h < 5.4 || h > 22.4) at = 'home';
    return at;
  }

  function posFor(r, town, at) {
    if (at === 'out') return null;
    if (at === 'home') {
      var lot = town.lots[r.lotIndex];
      return { x: lot.front.x + Math.cos(r.wander) * 2.4, y: lot.front.y + Math.sin(r.wander) * 2.4 };
    }
    if (at === 'home_yard') {
      var l2 = town.lots[r.lotIndex];
      return U.rectCenter(l2.yard);
    }
    var pr = town.props[at];
    if (!pr) { var l3 = town.lots[r.lotIndex]; return { x: l3.front.x, y: l3.front.y }; }
    var pos = town.propPos(pr);
    return { x: pos.x + Math.cos(r.wander) * 2.0, y: pos.y + Math.sin(r.wander) * 2.0 };
  }

  function repath(r, town) {
    if (!r.destPos) { r.path = null; return; }
    var a = town.nearestNode(r.x, r.y);
    var b = town.nearestNode(r.destPos.x, r.destPos.y);
    var nodes = town.pathNodes(a, b);
    if (!nodes) { r.path = [r.destPos]; r.pathI = 0; return; }
    nodes.push(r.destPos);
    r.path = nodes;
    r.pathI = 0;
  }

  function update(people, town, clock, dt, player, game) {
    for (var i = 0; i < people.length; i++) {
      var r = people[i];

      if (r.sayT > 0) { r.sayT -= dt; if (r.sayT <= 0) r.say = null; }
      if (r.barkCooldown > 0) r.barkCooldown -= dt;

      var want = destFor(r, town, clock);
      if (want !== r.dest) {
        r.dest = want;
        r.wander += 1.7;
        r.destPos = posFor(r, town, want);
        r.away = (want === 'out');
        if (!r.away) repath(r, town);
      }
      if (r.away) continue;

      /* only simulate walking near the player; everyone else teleports along
         their day, which nobody is in a position to notice */
      var far = U.dist2(r.x, r.y, player.x, player.y) > 420 * 420;
      if (far) {
        if (r.destPos) { r.x = r.destPos.x; r.y = r.destPos.y; r.path = null; }
        continue;
      }

      if (r.path && r.pathI < r.path.length) {
        var tgt = r.path[r.pathI];
        var dx = tgt.x - r.x, dy = tgt.y - r.y;
        var d = Math.hypot(dx, dy);
        if (d < 1.6) { r.pathI++; }
        else {
          var sp = r.speed * (town.speedAt(r.x, r.y) || 1);
          r.x += (dx / d) * sp * dt;
          r.y += (dy / d) * sp * dt;
          r.facing = Math.atan2(dy, dx);
          r.moving = true;
        }
      } else {
        r.moving = false;
        /* drift a little so nobody stands perfectly still for a whole day */
        if (r.destPos) {
          var ddx = r.destPos.x - r.x, ddy = r.destPos.y - r.y, dd = Math.hypot(ddx, ddy);
          if (dd > 2.2) { r.x += (ddx / dd) * 0.5 * dt; r.y += (ddy / dd) * 0.5 * dt; r.moving = true; }
        }
      }

      /* being seen */
      var near = U.dist(r.x, r.y, player.x, player.y);
      if (near < 13) {
        if (clock.day !== r.lastSeenDay) { r.lastSeenDay = clock.day; r.seen++; }
        if (!r.met) { r.met = true; if (game) game.onMetResident(r); }
        if (r.barkCooldown <= 0 && near < 8.5) {
          r.barkCooldown = 26 + r.rng.float(0, 30);
          r.say = r.bark(game ? game.notorietyFor(r) : 0, game);
          r.sayT = 5.4;
          if (game) game.onBark(r, r.say);
        }
      }
    }
  }

  ER.populate = populate;
  ER.updateResidents = update;
  ER.residentLoop = LOOP;
})(typeof window !== 'undefined' ? (window.ER = window.ER || {}) : (global.ER = global.ER || {}));
