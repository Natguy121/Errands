# Errands

A first-person open-world game set in one block of the old quarter of
**Batroun**, on the Lebanese coast. Fifty metres by fifty: eight stone alleys,
eighteen sandstone houses with painted shutters and tile roofs, a fountain
square, the souk, the Phoenician sea wall with the Mediterranean behind it, and
a chapel on the rocks. Thirty people live here. There is mains electricity when
the mains feel like it, a generator when they do not, satellite dishes on every
roof and black water tanks on every parapet.

You have the back room of number 6, off the souk, month to month. Nobody sent
for you. There is no main quest, no combat, no puzzle and no ending.

What there is, is the quest log, which fills itself:

> **ERRAND 1**
> Collect exactly one glass jar of sea water from the shallow channel cut
> through the Phoenician wall, seal it, and wrap twine around the rim.
> *It must be the shallow channel. The deep one further along is wrong. Three turns of twine, no more.*

Finish it and you are handed another one immediately, forever.

Fifty metres is the joke. Every errand is ninety seconds' walk from every
other one, so you will be back at the same fountain eleven times today for
eleven unrelated reasons, in front of the same thirty people.

---

## Running it

No build step, no install, no network access at runtime. It needs to be served
over HTTP rather than opened as a file, because browsers will not let a page
read its own textures off `file://`:

```sh
npx http-server -p 8099 -s .     # or: python3 -m http.server 8099
```

Then open **http://localhost:8099/** and press **Move in**.

Requires WebGL2 and a mouse (it takes a pointer lock to look around).
A day in the quarter takes twenty-four real minutes. Progress saves itself
every twenty-five seconds and on every new day.

The loading bar spends its last step drawing the town from twelve vantage
points and cycling every weather state and every overlay screen. That is deliberate: shader programs,
and especially the shadow-depth variants, otherwise compile the first time you
actually see each material, so walking into town or catching the first shower
would hitch. Better to pay for it once, behind the bar.

### Controls

| | |
|---|---|
| **Mouse** | look |
| **W A S D** | walk |
| **Shift** | run |
| **Ctrl** / **Q** | crouch |
| **E** (hold) | do the thing |
| **Z** | linger — the clock runs an hour a second while you stand still |
| **C** | raise the camera · **Space** shutter |
| **1** | apply high-contrast black and white to a photograph |
| **M** | map · **J** journal |
| **K** | abandon this errand and take the next one |
| **H** | hide the key list |
| **Esc** | release the mouse |

---

## What is actually in here

**The quarter is generated once from a seed and is the same quarter every
time.** Eight stone alleys: the souk running east from the quay, Rue de la Mer
along the sea wall, Bab el Mina dropping to the harbour, Ez-Zaroub so narrow
you turn your shoulders to pass somebody, an upper and a lower alley, an east
alley, and Darb el Daraj, which is stairs — the terrain quantises to a 0.17 m
stone tread, so it climbs 3.16 m in about twenty risers and you walk up it a
step at a time.

The Phoenician sea wall runs the whole west side with a crest you can stand on
and the Mediterranean behind it, and there is a channel cut through it where
the sea comes in. Saydet el Bahr sits on the rocks at the top of the quay with
a bell in its gable and an iron cross on the roof. Sahat en-Nafoura is seven
metres by six with a fountain in the middle and one broken tile in the floor.

Eighteen houses, packed close enough to share walls: sandstone under lime
render in whatever wash was going that decade, painted shutters, tile or flat
roofs, triple-arched windows on the first floor, outside stone stairs,
balconies, geraniums in terracotta pots by every door, bougainvillea over some
of the arches, a black water tank and a satellite dish on nearly every roof,
and the meter boxes and the thrown-across wiring that actually feed them. Ten
other structures: the furn, Abou Georges' lemonade stand, the soap shop, the
qahwe with its plastic chairs and an abandoned backgammon game, Tony's barber
shop, the dukkan on Darb et Tahta, the fishermen's shed on the quay, Teta
Therese's house, the chapel, and the house on the zaroub that nobody has lived
in since the roof came down in one room.

**228 things you can walk up to and press E on**, in 2500 square metres. That
density is the point: the moss on the third stone of the sea wall, the iron
mooring ring, the letter cut into the wall, the urchin shells somebody lined
up on the coping, the capers growing out of the joints, the cracked tread
eleven steps up, the drainpipe that drips, the cistern lid, the gas canisters
chained in the zaroub, the tangle of wires at the pole, the quarter's
generator, the posters pasted over each other, and three cats.

**Thirty residents** live in those eighteen houses, so most doors have two
names behind them and the quarter has families in it. They have names, ages
and work — the lemonade man, the baker at the furn, the woman who keeps the
dukkan, Abouna who says the morning mass, the teta who sits on her balcony and
misses nothing, the man who keeps the generator running and collects for it in
cash, four people working remote from their roofs, a nurse who commutes up the
coast, the woman who waters pots on three doorsteps that are not hers, and an
eleven-year-old with a bike and opinions about the cats. They walk the alley
network between home and work on a daily schedule, and they see you. Over and
over, because there is nowhere else to be.

**Seventy errand templates**, each of which randomises its own particulars —
the stone, the count, the hour, the shutter, the exact number of turns of
twine — so the pool generates errands in the thousands. Eleven kinds of step:
buying, acting, searching, gathering, waiting, making, photographing,
photographing a whole set, editing a photograph, walking a route, and writing
something down. Errands can be gated on the hour (dusk, after dark, before
sunrise), on the weather (you cannot catch a jar of sea fog on a clear day),
and on the calendar (some things have to sit on your windowsill overnight).

A few things exist only so the fine print can be wrong about something. There
is a deep channel in the wall as well as a shallow one. There is basil in the
other tin by the chapel door. There is a younger fig by the shrine. The three
steps at the bottom of Darb el Daraj are the kerb and do not count.

---

## Repository layout

```
index.html              the page, the HUD styles, the loader
vendor/three.min.js     three.js r160 (MIT), vendored so nothing is fetched at runtime
src/
  core/
    rng.js              seeded PRNG + value noise; the town is deterministic
    util.js             geometry, colour and text helpers
    input.js            keyboard
    audio.js            all sound, synthesised — there are no audio files
    save.js             localStorage
  world/
    names.js            name, job, epitaph and junk pools
    time.js             clock, calendar, weather, sun position
    town.js             the town: roads, water, lots, buildings, props,
                        topography, collision grid, resident walk graph
    residents.js        the thirty, their routines and their dialogue
  quest/
    items.js            the quarter's items and verbs, and five shops
    pool.js / pool2.js  70 errand templates
    director.js         issues one, watches it, issues another
  three/
    materials.js        every texture generated at load, with normal and
                        roughness maps derived from its own height field
    geom.js             ribbons that follow the ground, roofs, arches, batching
    sky.js              sun, moon, stars, cloud; hands out the scene lighting
    world3d.js          the rock shelf, the alleys, the paving, the sea
    structures.js       houses and buildings; instanced window panes
    scatter.js          trees, weeds, wiring, wall lamps, signs, props, hit volumes
    people3d.js         resident rigs and their walk
    fx.js               rain, wind, puddles, wet stone
    view.js             the camera, the controls, your hands
    hud.js              the interface, as HTML over the top
  game.js               wiring
test/
  run.js                11,000+ headless checks; proves all 70 errands solvable
  browser.js            Chromium smoke test; screenshots to .shots/
```

## Tests

```sh
node test/run.js
```

Checks the quarter's invariants, that the resident walk graph is fully connected, that
every interactable has somewhere to stand, that every errand template refers
only to props, items and verbs that exist — and then drives all seventy
templates to completion with a solver, so nothing in the pool can be
unfinishable.

It checks the layout: that no footprint stands in an alley or on top of
another, and that paved ground reads as paved underfoot, so nothing grows up
through it. It checks that you can reach a prop from anywhere inside
it, by calling the real picking code on a stub. It checks the clock and the
sun: a day really is twenty-four real minutes, the sun really is on the
horizon at sunrise and sunset and never jumps more than a fraction of a
degree in a minute, and dusk really does last long enough to trace a
gravestone in. And it round-trips a save, errand and step position included.

```sh
npx http-server -p 8099 -s . &
node test/browser.js              # add SHOOT=1 to save screenshots to .shots/
```

Builds the world in Chromium, drives it with real key events and mouse-look,
checks eye height over four kinds of ground, picks things out with the
crosshair, searches a ruin, photographs a streetlamp and applies the edit,
completes an errand, checks the resident rigs are standing on the ground
rather than in it, opens every screen, lingers, times a frame, reloads a save,
and fails on any console error or uncaught exception.

Two flags, both for headless containers where the only GPU is a software
rasteriser:

- `SHOOT=1` saves screenshots. Off by default: reading pixels back out of a
  software rasteriser takes tens of seconds, unpredictably.
- `QUICK=1` skips the three stages that need a real compositor — the
  sightseeing tour, opening the overlay screens, and taking a photograph.
  Headless Chromium never produces a composited frame on its own, because it
  treats the page as hidden and throttles both `requestAnimationFrame` and
  timers; so the first time a layer or a readback surface is needed, it gets
  created synchronously inside whatever call is running. Everything else runs,
  including the whole errand loop. Drop `QUICK` on a machine with a GPU.

---

## Why it works

The juxtaposition is the whole joke. A working quarter with wifi, satellite
dishes and a man who comes round for the generator money is a much stranger
place to be scraping moss into a tin spoon than a ruin would be. Nothing here
is post-apocalyptic; the furn is open at half five, the qahwe is open until
eleven, somebody is repointing a wall. You are the only thing out of place.

And the place is fifty metres across, which makes it worse. In four square
kilometres you could at least be strange somewhere nobody was looking. Here
the same thirty people watch you count the same steps for the third time
today, from balconies two metres above your head.

The errands never resolve into anything. Completing one earns a line of text
and the next errand. What accumulates instead is knowledge of the place: which
shutter is actually the bluest, which stone in the wall has the moss on it,
where the clay is under the wall, what the fountain sounds like at four in the
morning, which of the three cats will sit still. By the two hundredth errand
the quarter has quietly adjusted around you, and nobody remembers it being
otherwise.

## Credits

three.js r160 by mrdoob and contributors, MIT licensed, vendored in `vendor/`.
Everything else — every texture, mesh, sound and word — is generated or
written here.
