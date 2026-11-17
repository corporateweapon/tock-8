# Tock-8

A drum machine and song studio that runs entirely in the browser. Every sound is synthesised with the Web Audio API; there are no samples, no build step, no dependencies and no network calls. It is aimed at EU hard dance (hardstyle, jumpstyle, tekk, hardcore) and at someone new to music production, so features should stay approachable and explain themselves in plain words.

Live at https://corporateweapon.github.io/tock-8/ (GitHub Pages, `main` branch, repo root). Pushing to `main` is the deploy. The pocket page is installed on a phone as a Home Screen app and on a PC as a desktop shortcut, so a push changes what real devices load next time they are online.

## Files

| File | What it is |
|---|---|
| `index.html` | The pocket machine: 8 voices, 16 steps, 4 patterns per beat, 5 kits. Works on phone and desktop. |
| `studio.html` | The studio: up to 16 tracks, patterns of 1, 2 or 4 bars, a song made of parts, a piano roll, a mixer. Desktop only; do not spend effort making it work on phones. |
| `engine.js` | Shared by both pages, exposed as `window.Tock`. Kits, the built-in beats (`PRESETS`), every voice, both audio rigs, the song renderer, WAV / zip / MIDI writers, `analyse`. **Sounds live only here.** |
| `board.js` | The live board (`window.TockBoard`), opened from the studio's Live key. One canvas that draws a DJ board playing along with the song. It only watches: it never edits the project. Desktop only. |
| `sw.js`, `manifest.webmanifest`, `icon-*.png` | Offline copy and install metadata. `sw.js` is network-first; add any new file the pages load to its `SHELL` list. |
| `tools/serve.py` | Local server that also accepts `POST /save/<name>` (wav, mid, zip, json, png) and writes into `renders/` (ignored by git). |
| `tock8.ico` | Icon for the PC desktop shortcut. Leave it in place. |

## Running it

`python tools/serve.py 8766` then open `http://localhost:8766/` (pocket) or `/studio.html`. `.claude/launch.json` has this as the `tock-8` preview. The pages also work opened straight from disk, but saving files to `renders/` needs the server.

## Driving it from a script: `window.tock8`

Both pages expose `window.tock8` (`tock8.page` is `'pocket'` or `'studio'`, `tock8.help()` summarises the calls). Use it from the browser pane's JavaScript tool instead of clicking through the interface.

Pocket page:

```js
tock8.presets()                      // [{name, style, bpm, kit}]
tock8.loadPreset('HARDSTYLE')        // returns the full beat
tock8.setBeat(beat)                  // compact or full beat, see below
tock8.getBeat()
tock8.setChain(true)                 // exports then cover every filled pattern
await tock8.renderAndSave('loop')    // 'loop' | 'stems' | 'midi' -> {saved: path, audio: measurements}
```

Studio page:

```js
tock8.instruments()                  // every sound a track can use
tock8.getProject(); tock8.setProject(project)
tock8.newFromBeat('TEKK')            // start a song from a pocket beat (name or beat object)
tock8.demos(); tock8.demo('nachtschicht')   // the finished songs that ship with the studio, and opening one
await tock8.renderAndSave('song')    // 'song' | 'stems' | 'midi' | 'pattern' | 'project'
await tock8.render('song', {from: 2, to: 3, tail: 0})   // one part only -> {name, type, bytes}
tock8.analyse(bytes)                 // measurements of a WAV made here
tock8.live(); tock8.live(false)      // open and close the live board
tock8.liveState()                    // what the board is showing: decks, crossfader, filter, faders, which pads are lit
await tock8.liveShot('name', [x, y, w, h], 2)   // save a picture of the board (crop in board units, 1600 by 900) -> {saved: path}
```

`renderAndSave` returns `{saved: 'E:\\...\\renders\\file.wav'}` under `tools/serve.py`, or `{downloaded: name}` anywhere else. A whole song renders in a few seconds. Long calls can exceed a tool timeout: start the work, stash the result on `window`, and read it in a second call.

## You cannot hear it. Measure it.

`analyse` returns `seconds`, `peak`, `rmsDb`, `clippedPct`, `silentPct` and the share of energy that is low (under 200 Hz), mid, and high (over 2.5 kHz). Use it to catch silence, clipping, a part that is far louder or quieter than its neighbours, or a mix with no highs. Reference points from the built-in material: classic beats sit around -16 to -20 dB RMS, hard kits around -10 to -13 dB, and a hard kit drop is about 75% low / 22% mid / 2% high. Rendering one part at a time (`from`/`to`) shows how an arrangement moves. To compare how loud tracks are against each other, render each one alone (`only`) with the project's `crunch` set to 0: with crunch on, the master distortion lifts a quiet track played alone and the numbers mislead. In the songs that ship, the lead sits 10 to 14 dB under the kick, pads and stabs 15 to 17 dB under, and breaks 4 to 6 dB under drops. Measurements do not tell you whether something sounds good. Say plainly that a sound is unheard, and treat the owner's ears as the test.

## The live board

`board.js` draws everything on one canvas in a fixed 1600 by 900 layout that is scaled to fit the window. The studio's clock calls `TockBoard.step(...)` for each step it schedules; the board reads the project through a small host object (`boardHost` in `studio.html`) and never writes to it.

- Each deck holds a pattern as a record: one ring per track (track 1 outermost), one turn per bar, a mark sounding as it passes the rail at 12 o'clock. Cells behind the rail already show the next bar. Consecutive parts that use the same pattern stay on one deck; a change of pattern throws the crossfader to the other deck, which was already showing that pattern cued.
- The tower shows the part effect (`open` / `close` / `thin` / `gate` / `pump`) as a key and on the Filter knob, the one-shot sounds (`riser fall boom zap crash siren scratch`) as keys, and the room and echo sends. A part's `speed` moves the tempo slides and spins the records faster or slower; its `shift` turns the Key knob. A `scratch` note drags the live record back and forth. The bank has a strip per track: fader down when the part switches the track off, meter, note window, pad.
- The live record burns (`drawFire`): 64 flame tongues round the rim whose height follows the spectrum (the record carries bass on one side and treble on the other, so the tall side turns with it), plus the kick and any riser. The colour set is one of `PAL`: `hot` normally, `white` at full energy or a part sped past about 110%, `gas` (cold blue) while `thin` drains the bass, `ghost` (violet) under about 80% speed, and `pilot` (a low blue ring) on a cued deck or when stopped. `gate` snuffs the fire on the cut steps. Flames are drawn behind the record so the rings stay readable.
- Lightning (`zap`, drawn by `drawBolts`): a synth or bass note arcs from the label out to its ring for as long as it sounds, drums throw a short bolt to the rim, `crash` and `boom` ring the record, `zap` and `boom` send a bolt from their key to the record, a scratch spits bolts off the needle, and a change of deck sends one across the crossfader. Each kick also sends a ring of light across the record and embers off the rim; the rim dots on the live record are a spectrum meter.
- Calm mode (the Calm key, M, or the computer's reduced-motion setting) removes sparks, lightning, embers, shake and flashes and leaves a low, slow flame.
- `liveState()` also reports each deck's `fire` (which colour set), `fuel` and `flames`, plus `bolts`, `embers`, `sound` (low, mid, high) and `frameMs` (what a frame costs to draw; about 1.5 ms when checked).
- Checking it: the Browser pane does not run animation frames while it is hidden, so drive frames yourself (`setInterval(function(){ TockBoard.render(); }, 16)` while the song plays), then look at `tock8.liveState()` and save pictures with `tock8.liveShot(...)` and read the PNG. A new sound or effect needs no board change unless it should get its own key: those lists are `SHOTS` and `FXK` at the top of `board.js`.

## Beat format (pocket page)

Compact form, as used in `PRESETS` and accepted by `setBeat`:

```js
{ name: 'HARDSTYLE', kit: 1, bpm: 150, swing: 0, space: 18, crunch: 20,
  lv: [100,90,60,70,85,85,70,60],          // level per row, 0 to 150 (optional)
  tn: [0,0,0,0,0,0,0,0],                   // tune per row in semitones (optional)
  p: [ [ 'X...X...X...X...', '................', '.o.o.o.o.o.o.o.o', '..x...x...x...x.',
         '....x.......x...', '................', '..x..x..x..x.x..', '................' ] ],
  n: [ { 6: '..1..1..3..5.4..' } ] }       // notes per pattern: row index -> digits 1 to 8
```

- `p` holds up to 4 patterns (A to D), each exactly 8 rows of exactly 16 characters: `.` off, `x` hit, `X` loud, `o` soft.
- `kit`: 0 CLASSIC (kick, snare, hat, open hat, clap, tom, rim, cowbell), 1 HARD, 2 JUMP, 3 TEKK, 4 CORE. On kits 1 to 4 the rows are kick, snare, hat, open hat, clap, reverse bass, lead, crash. The lead is the screech on HARD and JUMP and the hoover on TEKK and CORE (swapped 2026-11-16 at the owner's request).
- `n` digits are steps of a natural minor scale (1 = home note, 8 = an octave up).
- The full form (`getBeat()`) expands these to `pats[4][8][16]` (values 0 to 3) and `pit[4][8][16]` (0 to 7).

## Project format (studio page)

```js
{ name: 'FIRST DROP', bpm: 150, swing: 0, key: 0, scale: 'minor', crunch: 20, vol: 50,
  tracks: [ { id: 'kick', inst: 'hkick', name: 'KICK', lv: 100, pan: 0, tn: 0, verb: 0, echo: 0, drive: 0, tone: 0 } ],
  patterns: [ { id: 'main', name: 'MAIN', bars: 2, rows: {
      kick: 'X...X...X...X...X...X...X...X...',            // hits only
      saw:  { notes: [ [0, 7, 3], [3, 9, 3, 2] ] }          // [step, scaleStep, lengthInSteps, loudness 1-3]
  } } ],
  song: [ { name: 'INTRO', pat: 'main', rep: 4, fx: 'open', only: ['kick', 'hat'] },
          { name: 'DROP',  pat: 'main', rep: 8, off: { riser: true }, shift: 2, speed: 125 } ] }
```

- `setProject` runs everything through `Tock.normProject`, which fills defaults and expands the compact rows above into `{v, n, l}` arrays (loudness 0 to 3, scale step, length in steps). `getProject()` returns the expanded form.
- `key` is semitones away from A (-6 to 6). `scale` is `minor`, `harmonic`, `phrygian` or `major`. Scale step 0 is the home note, 7 is an octave up, negatives go down. Only instruments marked `pitched` follow key and notes.
- A part plays `pat` `rep` times. `off` switches tracks off for that part; `only` is a shorthand that switches off everything not listed. `fx` works on the whole mix for the length of the part: `open` (muffled to bright), `close`, `thin` (bass drains away, for a build), `gate` (chop: the sound is cut on every second step), `pump` (bright on each beat, closing before the next) or `none`.
- A part can also carry `shift` (-12 to 12 semitones, moves every pitched sound in that part) and `speed` (50 to 200 percent of the song tempo). Because of `speed`, never work out time as steps times `Tock.stepSec(P)`: use `Tock.secSd(P, part)` for one part and `Tock.songSeconds(P)` for the whole song.
- A track can carry `drive` (0 to 100, its own distortion) and `tone` (-100 darker to 100 thinner). A track with both at 0 skips that chain entirely, so older songs render exactly as before.
- Limits: 16 tracks, 32 patterns, 64 parts, patterns of 1, 2 or 4 bars (16 steps a bar).
- Instrument ids: classic drums `kick snare hat open clap tom rim bell`; hard drums `hkick jkick tkick ckick hsnare crash`; bass `rbass tbass sub`; synths `screech saw pluck stab hoover acid scream choir yoi metal`; effects `zap riser fall boom siren scratch`. `riser` and `fall` last as long as their note, so give them a long one. `hoover` swoops up into each note. `acid` slides when a note starts while the previous one is still held (give the first a length of 2), and a loud note opens its filter further. `scream` is the acid line's harsher sibling (square wave, heavy drive) and slides and accents the same way; it sits well an octave up (`tn: 12`). `yoi` is a vowel lead (o to i on every note); long held notes read about 8 dB louder than short ones, so mark those soft. `metal` is a short FM bleep. `siren` wails for as long as its note is held and `scratch` drags back and forth once every two steps of its note; both last as long as the note, like `riser`. `choir` and `stab` play a three-note chord from one note; `choir` swells in slowly and wants notes a bar long.
- The piano roll shows scale steps -7 to 14. Keep notes inside that range and use the track's `tn` (12 = an octave up) to move a part higher or lower.
- `tkick` and `tbass` sit a whole tone below the other sounds (their home note is G, not A). Give those tracks `tn: 2` so they follow the song key.
- The finished songs are `DEMOS` in `engine.js`, written in this compact form (`Tock.DEMOS`, `Tock.demo(id)`). Add new ones there; they appear in the studio's Songs sheet. Helpers beside them keep dense lines short: `al(offset, 'XxsxS.x.', [scale steps])` writes an acid bar as a rhythm (x note, X loud, s slides into the next, S both), `cyc(steps, every, offset, [scale steps], length, loudEvery)` places a note every few steps, and `ev(steps, every, offset)` does the same for a drum row.

## Rules that are easy to break

- Saved work lives in the browser: `localStorage` keys `tock8.v2` (pocket) and `tock8.studio.v1` (studio). Never change what those keys mean without migrating old data; `Tock.norm` and `Tock.normProject` exist to upgrade older shapes on load.
- The built-in beat list can grow, but existing names must keep working: saved sessions find their beat by name.
- The original classic kit and the first 18 beats are liked as they are. Do not retune them. New sounds go in as new voices or kits.
- Both pages load the engine as `engine.js?v=<version>`, and the studio loads `board.js?v=<version>` the same way. When `engine.js` or `board.js` changes, raise `version` at the top of `engine.js` and the `?v=` in every script tag, so a browser cannot pair a new page with a stored older engine. Pages should also cope with an older engine (check a new `Tock` member exists before using it).
- After touching `engine.js`, re-render a classic beat and a hard beat from the pocket page and compare `analyse` numbers with the reference points above, then check the pocket page at phone width (375 px): no sideways scroll, the floating play key works.
- No external requests of any kind (fonts, scripts, analytics). The pocket page must keep working offline from a Home Screen icon.
- The owner's favourite of the first songs was the acid one (Acid Teknival); the next three (Saurebad, Kernschmelze, Drehwurm) are all acid-led, and the three after that (Schleudergang, Alarmstufe Rot, Kurzschluss) were asked to be "even crazier" and lean on part speed and shift, chop and pump, and the yoi, metal, siren and scratch sounds.
- "Samples" here still means synthesised sounds: nothing in the app loads an audio file.
- The owner asked for the board's records to be pushed further with flames, electric sparks and colour that follows the beat and sound (2026-11-17), calling the board "great thus far": more spectacle on the board is welcome. Keeping the rings readable under it is a rule Claude set for itself, not something the owner said.
- The owner finds the `screech` lead too keyboard-like for tekk and frenchcore (said 2026-11-16). For those styles carry the tune with `hoover`, `acid`, `saw` or a kick that plays notes.
- Commit author for this repository is the GitHub no-reply address already set in the local git config.
