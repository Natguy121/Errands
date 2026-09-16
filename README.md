# Errands

A first-person open-world game set in **Hollis Bend** — a real, working
American town of thirty people and four square kilometres. There is asphalt,
a gas station that sells you a jar, working streetlamps, satellite dishes,
mowed yards, and one house going up on Elm Court.

You have the old Latham place on Depot Street, month to month. Nobody sent
for you. There is no main quest, no combat, no puzzle and no ending.

What there is, is the quest log, which fills itself:

> **ERRAND 1**
> Collect exactly one glass jar of water from the shallow bend beneath the
> concrete bridge, seal it, and wrap twine around the rim.
> *It must be the shallow bend. The deep bend is wrong. Three turns of twine, no more.*

Finish it and you are handed another one immediately, forever.

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
A day in Hollis Bend takes twenty-four real minutes. Progress saves itself
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

**The town is generated once from a seed and is the same town every time.**
Twelve roads with crowned asphalt, painted centre lines, graded gravel
shoulders and utility poles carrying catenary wires. Little Fox Creek comes
down from the north-east and is crossed twice: by the concrete bridge on Main
Street, and by the old stone bridge on County Road 9, which is where the moss
is. An abandoned rail grade runs across the south and stops at the creek,
because the trestle came out in the eighties.

Thirty house lots are anchored to their roads, so every house faces the
street, with driveways, parked cars, satellite dishes, sheds, gardens,
trampolines, clotheslines, propane tanks and mailboxes. Nineteen other
structures: Bend Mart, Halter's Diner, Pell Hardware, the post office, the
24-hour laundromat, the town hall and volunteer fire department, Trinity
Methodist, the elementary school and its portable classroom, the shuttered
feed store, self-storage, the co-op and its silos, the Vandermeer place
falling in on itself, the park pavilion, the bus shelter, the old mill
foundation, and the framed-up house on Elm Court.

The cemetery is on the rise, which is why it is there. It has forty-odd
stones, and the earliest date on any of them matters to one of the errands.

**Thirty residents** live in those houses. They have names, ages and jobs —
the clerk, the cook, the postmaster, three people who work remote, a nurse
who commutes, a retired highway man who walks the same loop twice a day, an
eleven-year-old with a bike and opinions. They walk the road network between
home and work on a daily schedule, and they see you. Over and over. What they
say to you changes as you accumulate errands, from *"Trash is Thursday, they
come early"* through *"Somebody said you were up at the cemetery, in the dark"*
to, eventually, *"Jars are on aisle two. I ordered more in for you."*

**Sixty errand templates**, each of which randomises its own particulars — the
grave, the count, the hour, the fence post, the exact number of turns of
twine — so the pool generates errands in the thousands. Eleven kinds of step:
buying, acting, searching, gathering, waiting, making, photographing,
photographing a whole set, editing a photograph, walking a route, and writing
something down. Errands can be gated on the hour (dusk, before sunrise, the
noon siren), on the weather (you cannot fill a jar with fog on a clear day),
and on the calendar (some things have to sit on your windowsill overnight).

A few places exist only so the fine print can be wrong about something. There
is a deep bend as well as a shallow one. There is mint behind the diner as
well as behind the church. There is a storm drain that does not echo.

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
    items.js            71 items, 46 verbs, two shops
    pool.js / pool2.js  60 errand templates
    director.js         issues one, watches it, issues another
  three/
    materials.js        every texture generated at load, with normal and
                        roughness maps derived from its own height field
    geom.js             ribbons that follow the ground, gable roofs, batching
    sky.js              sun, moon, stars, cloud; hands out the scene lighting
    world3d.js          terrain, roads, pads, creek, the grade
    structures.js       houses and buildings; instanced window panes
    scatter.js          trees, grass, fences, poles, cars, stones, hit volumes
    people3d.js         resident rigs and their walk
    fx.js              rain, wind, puddles, wet asphalt
    view.js             the camera, the controls, your hands
    hud.js              the interface, as HTML over the top
  game.js               wiring
test/
  run.js                9,400+ headless checks; proves all 60 errands solvable
  browser.js            Chromium smoke test; screenshots to .shots/
```

## Tests

```sh
node test/run.js
```

Checks town invariants, that the resident walk graph is fully connected, that
every interactable has somewhere to stand, that every errand template refers
only to props, items and verbs that exist — and then drives all sixty
templates to completion with a solver, so nothing in the pool can be
unfinishable.

It checks that paved ground reads as paved underfoot, so grass cannot grow
through the front walk, and that you can reach a prop from anywhere inside
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

The juxtaposition is the whole joke. A functioning town with internet and a
propane cage is a much stranger place to be scraping moss into a plastic spoon
than a ruin would be. Nothing here is post-apocalyptic; the lights work, the
diner is open, somebody is framing a house. You are the only thing out of
place, and the population is thirty, so there is nowhere to do this unobserved.

The errands never resolve into anything. Completing one earns a line of text
and the next errand. What accumulates instead is knowledge of the place: which
of the five hydrants has the worst paint, which drain echoes, where the clay
bank is, what time the tower's shadow crosses Quarry Road. By the two
hundredth errand the town has quietly adjusted around you, and nobody
remembers it being otherwise.

## Credits

three.js r160 by mrdoob and contributors, MIT licensed, vendored in `vendor/`.
Everything else — every texture, mesh, sound and word — is generated or
written here.
