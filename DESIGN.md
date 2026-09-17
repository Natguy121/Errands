# Errands — design notes

## The pitch

A realistic first-person open world, fifty metres square, thirty residents,
in which the entire gameplay loop is randomly generated, absurdly specific
side quests and nothing else.

## Setting: Batroun, the old quarter

Not abandoned, not dying, not post-anything. One block of a working Lebanese
coastal town. This is load-bearing — the humour and the unease both come from
the juxtaposition, and a ruin would dissolve them. So the quarter has:

- stone alleys between 1.7 and 3.4 m wide, worn smooth down the middle, and
  Darb el Daraj, which is stairs
- a furn open at half five, Abou Georges' lemonade stand with the pips left
  in, a soap shop whose pyramid is rebuilt every Monday, a qahwe open until
  eleven with plastic chairs on the paving and a backgammon game nobody has
  finished, a barber under a pole that does not turn, and a dukkan that prints
  a receipt whether you want one or not
- eighteen maintained houses: sandstone under lime render, painted shutters,
  tile roofs, triple-arched windows, geraniums in pots by the door,
  bougainvillea over the arch, laundry across the alley, a black water tank
  and a satellite dish on nearly every roof, and the meter boxes and
  thrown-across wiring that feed them
- the quarter's own diesel generator, and a man who comes round for the money
- alley lanterns on wall brackets that come on at dusk, two of which are dying
- and, at the edges: one house on the zaroub with the roof down in a single
  room, and the sea

The things that are ruined are ruined for ordinary reasons and are outnumbered
by the things that work.

### Fifty metres

The scale is the joke, and it cuts harder than four square kilometres did. In a
township you could at least be strange somewhere nobody was looking. Here
every errand is ninety seconds from every other one, so you return to the same
fountain eleven times in a day for eleven unrelated reasons, watched by the
same thirty people from balconies two metres above your head. A place too small
to hide it, literally.

It also changes the engineering. Fifty metres does not leave room for a
procedural street grid to be subtly wrong in — a house half a metre out blocks
an alley outright — so the alleys and the footprints are hand-laid and then
checked by `validateLayout()`, which the headless tests run: no two buildings
overlapping, nothing standing in an alley. It found twenty-three faults the
first time it ran. Trees are the opposite: hand-picking positions lost five out
of ten to the alley filter, so the generator sweeps the free ground and places
them where there is actually room.

### Topography

The land is not flat. The quarter is built on a rock shelf that climbs away
from the water — 1.1 m at the wall to 7.8 m at the top corner — and the shelf
goes under the sea two metres west of the Phoenician wall, whose crest stands
proud of the quay and can be walked on.

Alleys are graded flat out to 2.6 m either side of their centreline, which at
this scale is the whole alley and a bit of the wall. Darb el Daraj is graded
differently: its on-alley height quantises to a 0.17 m riser, so the ground
itself is stepped and you climb it a tread at a time. Nosings are laid on top
wherever the height changes, which is what makes it read as a stair rather
than a ramp.

## The loop

1. You arrive. No story, no reason, no main quest.
2. The quest log issues one errand.
3. You do it.
4. The quest log issues another, immediately.
5. Go to 3.

There is no payoff and the game says so. Completing an errand earns one line
of text — *"No one will ever know."*, *"Done, and correctly, which matters to
you."* — and the next errand. `K` abandons one, which earns a slightly
different line.

## Errand design

Seventy templates. Each is a small factory: it rolls its own parameters
against the generated quarter, writes its own title and fine print from them,
and emits an ordered list of steps. So the pool is not seventy errands, it is
seventy *kinds* of errand with thousands of instances.

A template looks like this:

```js
{
  id: 'jar_of_sea_water', weight: 3, tags: ['water', 'fiddly'],
  setup: rng => ({ knots: rng.int(2, 4) }),
  title: () => 'Collect exactly one glass jar of sea water from the shallow
                channel cut through the Phoenician wall, seal it, and wrap
                twine around the rim',
  fine: p => 'It must be the shallow channel. The deep one further along is ' +
             'wrong. ' + spell(p.knots) + ' turns of twine, no more.',
  steps: p => [ buy(...), buy(...), act(...), make(...), make(...) ]
}
```

### Eleven step kinds

| kind | what it is |
|---|---|
| `buy` | at a shop counter; hands you the item |
| `act` | go to a place, hold the verb, consume and produce items |
| `search` | hold in a search zone until it turns up; mostly junk |
| `gather` | accumulate N of something |
| `wait` | stand still for N seconds, possibly at a specific hour or in rain |
| `craft` | done with your hands, wherever you are |
| `photo` | frame a thing in the viewfinder and shoot it |
| `photoset` | do that for a whole list of things |
| `edit` | apply a filter to a photograph in the journal |
| `walk` | touch waypoints in order, sometimes without running |
| `note` | write something down, sort something, count something |

### Gates

Steps can require an hour window (`dusk`, `before sunrise`, `the noon test`),
a weather state (`fog`, `frost`, `rain`), or a day offset — *"collect it once
the sun has had a day with it. Tomorrow. Not tonight."*

Gates are what turn errands into a relationship with the town's clock. An
errand that needs fog is not an errand you can finish now, so it sits in the
log while you learn where the fog settles. `Z` lingers, running the clock
twenty-two times faster, which is the closest the game comes to a fast-travel.

### Decoys

Three places exist purely so the fine print can be *wrong about something*:

- the **deep channel** in the sea wall as well as the shallow one
- the **basil in the other tin** by the chapel door, next to the mint
- the **younger fig** by the shrine, next to the oldest one
- the **three steps at the bottom** of Darb el Daraj, which are the kerb
- a **storm drain that does not echo**

Going to the wrong one gives you a refusal, not a failure: *"This is the deep
bend. The errand said the shallow bend. You put the jar back in your coat."*
This is the single cheapest thing in the design and it does more for the tone
than anything else, because it establishes that the errands have opinions.

### Junk

Searching mostly fails. Sixteen search pools each have their own flavour of
refuse on top of a shared forty-entry list — *a doll arm*, *a tooth (animal)*,
*a chunk of asphalt shaped almost like Ohio*, *a staple the size of a staple*.
The journal counts what you have turned up. Nothing uses the count.

## The thirty

The residents are not quest-givers. Nobody in the quarter has ever given
anybody an errand. What they do is *see you*.

Each has a name, an age, work, a house and a daily route, and walks the alley
graph between them on a schedule that differs at the weekend, when there is
mass at nine. Two commute up the coast and are simply absent for the day.
Thirty people across eighteen houses means most doors have two names behind
them and families share a surname.

Their dialogue is tiered by how many errands you have completed and how much
of it they have personally witnessed:

| tier | register | example |
|---|---|---|
| 0 | neighbourly | "The water comes on at six. Fill something before then." |
| 1 | noticing | "Third time I've seen you today. Not counting this." |
| 2 | puzzled | "Somebody said you were out on the wall. In the dark." |
| 3 | concerned | "Listen. Is somebody making you do this?" |
| 4 | complicit | "Jars are on the shelf above the olives. I got more in for you." |

Twenty-two job-specific line sets sit on top of a generic pool, plus
contextual overrides that fire when the situation is too obvious to ignore —
if you are carrying two jars in the rain at eleven at night, somebody will
mention it.

Some errand steps are flagged `witnessed`. Saying one word into the channel in
the sea wall is one; turning exactly one of the qahwe's chairs to face the wall
is another. Doing those in front of people accelerates their tier and earns a
toast: *"Three people saw you do that."* In an alley two metres wide this is
not hard to arrange.

### Milestones

At 10, 25, 50, 100 and 200 errands the town adjusts, quietly and without
resolving anything:

- a clean pint jar appears on your porch, no note
- the qahwe decides you have a usual, without asking what it is
- a rusted nail and a flattened cap turn up on the step in a margarine tub
- Dale stops charging you. For jars. Only for jars.
- *"The quarter has adjusted around you. Nobody remembers it being otherwise."*

## Rendering approach

First person, three.js, everything procedural. There are no asset files in the
repository — no textures, no models, no audio. This is a constraint with a
payoff: the whole town is a few hundred kilobytes of source.

**Materials.** Thirteen surfaces, each generated at load into canvases: an
albedo, a normal map derived by Sobel from the surface's own height field, and
a roughness map remapped from the same height field. Asphalt gets aggregate
speckle and tar-filled cracks; siding gets eight courses of vinyl lap with a
specular roll-off on each; shingles get staggered tabs and granules; the stone
bridge gets coursed rubble with moss driven by its own noise field.

**Shader warm-up.** The loader's last step draws the town from twelve vantage
points across the day and then cycles all seven weather states and all four
HUD modes, including one pass into the offscreen target a photograph uses. Programs -- and especially
the shadow-depth variants -- otherwise compile on first sight of each
material, so the first walk into town, the first shower and the first
photograph would each hitch. Paying once behind the loading bar is strictly
better, and on a software rasteriser the difference is seconds per stall
rather than milliseconds.

**The sun** is real geometry rather than a curve that looked about right. The
clock commits to a sunrise and a sunset, and `Clock.sunElevation` picks the
declination that produces exactly that day length at a northern latitude --
`cos(H at sunset) = -tan(lat) tan(decl)` -- so one continuous curve covers the
day and the night and the sun sits exactly on the horizon at the moment the
clock calls sunset. This matters more than it sounds like it should. The
previous version was an offset cosine that put the sun four degrees *under* the
horizon at its own sunset and then handed over to a separate night curve twelve
minutes later, jumping two degrees in an instant. Twilight came out at
thirty-five minutes instead of ninety and skipped the warm part altogether, so
7:24 PM -- labelled "Dusk" in the corner of the screen, and the hour a good
many errands send you out to the sea wall -- rendered as deep night. The clock owns
the model now, because the sky and the errand gates keying off dusk must not
be able to disagree about where the sun is.

**Sky.** An analytic scattering-shaped gradient driven by the sun's elevation
through ten hand-tuned stops, with a real sun disc, a tight Mie lobe, a wide
aureole, two layers of drifting fbm cloud lit from the sun's side, stars with a
faint galactic band, and a moon. The same ten stops hand out the directional
light colour and intensity, the hemisphere ambient, and the fog colour — so the
scene is lit by the sky rather than beside it.

**Geometry.** Alleys, their unswept edges and the courses of the sea wall are ribbons
extruded along their polylines, sampling the terrain height at every step, so
nothing floats and nothing sinks. Houses are assembled from a shared kit:
foundation, walls, gable roof with a real overhang, fascia, half-round gutters
with one downspout, porch deck and posts, recessed window frames with sills,
a door with a knob, a brick chimney. Everything sharing a material is merged
into one buffer at build time — eighteen houses come to a handful of draw
calls rather than nine hundred.

**Instancing.** Trees (trunks, displaced-icosphere canopies, stacked cones for
conifers), grass, weeds, plant patches, window panes, streetlamp lenses and
puddles are all instanced. Window panes and lamp lenses carry their lit state
in `instanceColor`, patched into `totalEmissiveRadiance` with a six-line
`onBeforeCompile`, so the whole town can come on at dusk house by house
according to whether its resident is home.

**Grass** follows you: six thousand tufts redistributed within 13 m whenever
you move more than nine, shrinking away over the outer half of that radius
rather than stopping at a line. A slice of 2200 goes down per frame so the
sweep never lands in one hitch, and they are rejected off roads, shoulders,
paving and buildings by the same terrain query the collision uses. Another
500 taller weeds go in only on the bare shelf, because the alleys are swept
and the square is flagged. There are no lawns here at all: the tuft count came
down from six thousand to nine hundred when the world became stone.

The counts came down from nine thousand and 2600 after near-field
alpha-tested cards each doing a shadow-map lookup pegged the GPU process for
minutes at a time; dropping `receiveShadow` on all of it and trimming the
counts took drawing to 2-3 ms a frame even looking straight down into it. The
radii came in twice, and the second time for a different reason: area-uniform
placement is correct for grass, since it gives constant density per square
metre, but it puts most of the tufts in the outer ring, which is exactly the
distance at which a card stops being a clump and becomes a one-pixel sliver.
Thousands of slivers is what the streaking was.

**Reaching what you are standing on.** The crosshair picks props out of
invisible hit volumes -- a box for a rect, otherwise a sphere of
`clamp(r, 0.6, 3.2)`. Those volumes are `DoubleSide` so that standing inside
a search zone still registers, and that much works: from inside, the ray hits
the far wall on its way out. What does not work is the range check. For a
3.2 m sphere entered near one edge the exit lands 5.6 m away, past the 5.4 m
the crosshair reaches, so the only intersection gets culled -- and the prop
becomes unpickable exactly when you are closest to it. The fallback that was
meant to cover this capped at a flat 2.2 m, which is tighter than some props'
own radius, so it could not. A prop's reach is now
`max(2.2, min(r, 3.2))`: the extent of its own hit volume, with the old
2.2 m kept as a floor so small things keep their grace. The moss on the old
stone bridge -- one of the errands from the original brief -- could not be
scraped while standing on the bridge until this was fixed.

**What is paved is data.** `town.paving` lists every lot, apron and walk as a
rectangle, and `town.pavedStrips` the poured lines. The renderer lays them
down and `terrainAt` reads the same list, so a concrete walk is concrete to
the grass, to a resident's walking speed and to the eye at once. While that
list lived in the renderer, the simulation did not know the front walk
existed and grass grew up through it.

**Three ways to make foliage black.** Every alpha-cutout card in the town was
black at one point or another, for three unrelated reasons, and they are
worth writing down because each one looks exactly like the others:

1. *Normals.* A vertical card's true normal faces sideways, so an overhead
   sun leaves it unlit. The cards get their normals forced to point straight
   up. `DoubleSide` undoes this -- three flips the normal on back faces, and
   a flipped up-normal points down and gets lit by the hemisphere light's
   *ground* colour -- so tufts are six `FrontSide` cards at sixty-degree
   intervals rather than three double-sided ones.
2. *Premultiplied canvas storage.* A single RGBA canvas cannot carry both
   colour and cutout: the browser stores canvas pixels premultiplied, so
   anything at alpha 0 comes back with its colour gone and filtering blends
   the visible blades toward black. Every cutout is an opaque colour `map`
   plus a separate greyscale `alphaMap`.
3. *`vertexColors` without a `color` attribute.* This was the last one and the
   worst. three defines `USE_COLOR` from `material.vertexColors` alone,
   without checking the geometry actually has the attribute, and the vertex
   shader then runs `vColor *= color` against the default generic attribute
   value -- which is `(0,0,0,1)`. Everything multiplied out to zero. Nothing
   warns; the material simply renders black. `USE_INSTANCING_COLOR` is a
   separate define driven only by the buffer existing, and the fragment
   prefix declares `vColor` for it too, so per-instance tint wants
   `instanceColor` and no flag at all. The same mistake was on the window
   panes and lamp lenses, where it multiplied the patched
   `totalEmissiveRadiance` by zero -- the town never lit up at night, and the
   cause was not the lighting code but a flag set on a material.

**Match the blades to the ground.** A tuft card seen almost edge-on is a
one-pixel sliver, and if the card is much brighter than the terrain it stands
in, every one of those slivers reads as a bright scratch -- six thousand of
them and the lawn looks combed rather than grown. The terrain grass albedo
averages about rgb(101,117,55), and the blades had drifted forty per cent over
that while they were being brightened to chase what turned out to be the
`vertexColors` bug. Isolating it took one render with the tufts hidden and one
with the terrain hidden: each was clean on its own, which ruled out both and
pointed at the contrast between them.

**Displace by position, not by index.** `IcosahedronGeometry` is non-indexed:
every face carries its own copy of each corner. The tree canopies were being
kicked about with a per-vertex random, which gave the same corner a different
offset for each face sharing it, and the canopy came apart into a cloud of
loose triangles. Lit from the front that passes for foliage, which is why it
survived so long; in silhouette against a dusk sky it is black shards with gaps
between them. Sampling one noise field along the three axis pairs gives every
copy of a corner the same answer, so the mass stays closed and still looks
grown rather than moulded -- and it costs no extra triangles, which matters
when one canopy geometry is instanced across a thousand trees.

**Weather.** Rain is instanced streaks falling in a box around the camera with
splash rings on the ground. Wetness drops the roughness and darkens the colour
of asphalt and concrete, which is most of what wet roads actually look like,
and puddles fade in and outlast the shower. Wind bends anything with blades in
the vertex shader, gusting on two sine periods, scaled by the weather.

**Your hands** are in their own scene rendered after a depth clear, so they
never clip a wall. They hold a stand-in built for whatever kind of thing the
errand has you carrying — a jar with liquid and a lid and twine at the rim, a
sheet of paper, a spoon with moss in it — and they lean in while you hold `E`.

## Deliberate omissions

- **No interiors.** Counters, bins and dryers are interacted with from the
  doorway, and the prose says "inside". Full interiors for twenty buildings
  would have cost more than they returned.
- **No economy.** Items are bought and it simply works. An economy would add a
  fail state to a game whose whole point is that nothing is at stake.
- **No fail states at all.** You cannot die, lose, run out or be locked out. An
  errand you cannot face is abandoned with `K`.
- **No objective markers.** The errand names the place in words and the map
  labels the places you have actually walked up to. The faint ring on a target
  only appears within 46 m. Finding things is the game.

## Testing

`test/run.js` runs 9,400+ assertions with no browser: town invariants, full
connectivity of the resident walk graph, a standable position adjacent to every
one of the 215 interactables, and static validation that every step in every
template refers only to props, items and verbs that exist — checked across
six parameter rolls per template. Then a solver drives all seventy templates
to completion, bending the clock and the weather as each step demands, which
means no template can ship unfinishable.

`test/browser.js` builds the world in Chromium and plays it: real key events
for walking, mouse-look, eye height checked over a hill, a bridge, a ridge and
a field, crosshair picking against four different props, a held `E` that
searches a ruin, a photograph checked for tonal range so a blank frame fails,
the black-and-white edit, every screen, an errand driven to completion,
resident rigs checked to be standing on the ground rather than in it,
lingering, frame cost, and a save round-tripped through a reload. Any console
error or uncaught exception fails the run.

Two things about that harness are worth knowing, because both cost real time
to work out and neither is a fault in the game:

- Headless Chromium treats the page as hidden, so it throttles both
  `requestAnimationFrame` and timers and the game's own loop simply stops.
  The harness therefore steps `update`/`render` itself, which is deterministic
  as well as immune to throttling.
- Screenshots are opt-in (`SHOOT=1`). The only GPU in a headless container is
  SwiftShader, which JITs a pipeline per combination of material, state and
  framebuffer; reading pixels back out of an offscreen target costs seconds and
  sometimes tens of seconds, entirely unpredictably. Steady-state drawing, by
  contrast, measures 3-5 ms a frame at 1280x720 even on that rasteriser, so the
  slowness is in the capture path, not the renderer.
