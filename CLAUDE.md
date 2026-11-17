# Tock-8

A drum machine and song studio that runs entirely in the browser. Every sound is synthesised with the Web Audio API; there are no samples, no build step, no dependencies and no network calls. It is aimed at EU hard dance (hardstyle, jumpstyle, tekk, hardcore) and at someone new to music production, so features should stay approachable and explain themselves in plain words.

Live at https://corporateweapon.github.io/tock-8/ (GitHub Pages, `main` branch, repo root). Pushing to `main` is the deploy. The pocket page is installed on a phone as a Home Screen app and on a PC as a desktop shortcut, so a push changes what real devices load next time they are online.

## Files

| File | What it is |
|---|---|
| `index.html` | The pocket machine: 8 voices, 16 steps, 4 patterns per beat, 5 kits. Works on phone and desktop. |
| `studio.html` | The studio: up to 16 tracks, patterns of 1, 2 or 4 bars, a song made of parts, a piano roll, a mixer. Desktop only; do not spend effort making it work on phones. |
| `engine.js` | Shared by both pages, exposed as `window.Tock`. Kits, the built-in beats (`PRESETS`), every voice, both audio rigs, the song renderer, WAV / zip / MIDI writers, `analyse`. **Sounds live only here.** |
| `sw.js`, `manifest.webmanifest`, `icon-*.png` | Offline copy and install metadata. `sw.js` is network-first; add any new file the pages load to its `SHELL` list. |
| `tools/serve.py` | Local server that also accepts `POST /save/<name>` and writes into `renders/` (ignored by git). |
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
```

`renderAndSave` returns `{saved: 'E:\\...\\renders\\file.wav'}` under `tools/serve.py`, or `{downloaded: name}` anywhere else. A whole song renders in a few seconds. Long calls can exceed a tool timeout: start the work, stash the result on `window`, and read it in a second call.

## You cannot hear it. Measure it.

`analyse` returns `seconds`, `peak`, `rmsDb`, `clippedPct`, `silentPct` and the share of energy that is low (under 200 Hz), mid, and high (over 2.5 kHz). Use it to catch silence, clipping, a part that is far louder or quieter than its neighbours, or a mix with no highs. Reference points from the built-in material: classic beats sit around -16 to -20 dB RMS, hard kits around -10 to -13 dB, and a hard kit drop is about 75% low / 22% mid / 2% high. Rendering one part at a time (`from`/`to`) shows how an arrangement moves. To compare how loud tracks are against each other, render each one alone (`only`) with the project's `crunch` set to 0: with crunch on, the master distortion lifts a quiet track played alone and the numbers mislead. In the songs that ship, the lead sits 10 to 14 dB under the kick, pads and stabs 15 to 17 dB under, and breaks 4 to 6 dB under drops. Measurements do not tell you whether something sounds good. Say plainly that a sound is unheard, and treat the owner's ears as the test.

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
- `kit`: 0 CLASSIC (kick, snare, hat, open hat, clap, tom, rim, cowbell), 1 HARD, 2 JUMP, 3 TEKK, 4 CORE. On kits 1 to 4 the rows are kick, snare, hat, open hat, clap, reverse bass, screech lead, crash.
- `n` digits are steps of a natural minor scale (1 = home note, 8 = an octave up).
- The full form (`getBeat()`) expands these to `pats[4][8][16]` (values 0 to 3) and `pit[4][8][16]` (0 to 7).

## Project format (studio page)

```js
{ name: 'FIRST DROP', bpm: 150, swing: 0, key: 0, scale: 'minor', crunch: 20, vol: 50,
  tracks: [ { id: 'kick', inst: 'hkick', name: 'KICK', lv: 100, pan: 0, tn: 0, verb: 0, echo: 0 } ],
  patterns: [ { id: 'main', name: 'MAIN', bars: 2, rows: {
      kick: 'X...X...X...X...X...X...X...X...',            // hits only
      saw:  { notes: [ [0, 7, 3], [3, 9, 3, 2] ] }          // [step, scaleStep, lengthInSteps, loudness 1-3]
  } } ],
  song: [ { name: 'INTRO', pat: 'main', rep: 4, fx: 'open', only: ['kick', 'hat'] },
          { name: 'DROP',  pat: 'main', rep: 8, off: { riser: true } } ] }
```

- `setProject` runs everything through `Tock.normProject`, which fills defaults and expands the compact rows above into `{v, n, l}` arrays (loudness 0 to 3, scale step, length in steps). `getProject()` returns the expanded form.
- `key` is semitones away from A (-6 to 6). `scale` is `minor`, `harmonic`, `phrygian` or `major`. Scale step 0 is the home note, 7 is an octave up, negatives go down. Only instruments marked `pitched` follow key and notes.
- A part plays `pat` `rep` times. `off` switches tracks off for that part; `only` is a shorthand that switches off everything not listed. `fx` sweeps a master filter across the part: `open` (muffled to bright), `close`, `thin` (bass drains away, for a build) or `none`.
- Limits: 16 tracks, 32 patterns, 64 parts, patterns of 1, 2 or 4 bars (16 steps a bar).
- Instrument ids: classic drums `kick snare hat open clap tom rim bell`; hard drums `hkick jkick tkick ckick hsnare crash`; bass `rbass tbass sub`; synths `screech saw pluck stab hoover acid choir`; effects `zap riser fall boom`. `riser` and `fall` last as long as their note, so give them a long one. `hoover` swoops up into each note. `acid` slides when a note starts while the previous one is still held (give the first a length of 2), and a loud note opens its filter further. `choir` and `stab` play a three-note chord from one note; `choir` swells in slowly and wants notes a bar long.
- The piano roll shows scale steps -7 to 14. Keep notes inside that range and use the track's `tn` (12 = an octave up) to move a part higher or lower.
- `tkick` and `tbass` sit a whole tone below the other sounds (their home note is G, not A). Give those tracks `tn: 2` so they follow the song key.
- The finished songs are `DEMOS` in `engine.js`, written in this compact form (`Tock.DEMOS`, `Tock.demo(id)`). Add new ones there; they appear in the studio's Songs sheet.

## Rules that are easy to break

- Saved work lives in the browser: `localStorage` keys `tock8.v2` (pocket) and `tock8.studio.v1` (studio). Never change what those keys mean without migrating old data; `Tock.norm` and `Tock.normProject` exist to upgrade older shapes on load.
- The built-in beat list can grow, but existing names must keep working: saved sessions find their beat by name.
- The original classic kit and the first 18 beats are liked as they are. Do not retune them. New sounds go in as new voices or kits.
- Both pages load the engine as `engine.js?v=<version>`. When `engine.js` changes, raise `version` at the top of it and the `?v=` in both script tags, so a browser cannot pair a new page with a stored older engine. Pages should also cope with an older engine (check a new `Tock` member exists before using it).
- After touching `engine.js`, re-render a classic beat and a hard beat from the pocket page and compare `analyse` numbers with the reference points above, then check the pocket page at phone width (375 px): no sideways scroll, the floating play key works.
- No external requests of any kind (fonts, scripts, analytics). The pocket page must keep working offline from a Home Screen icon.
- The owner finds the `screech` lead too keyboard-like for tekk and frenchcore (said 2026-11-16). For those styles carry the tune with `hoover`, `acid`, `saw` or a kick that plays notes.
- Commit author for this repository is the GitHub no-reply address already set in the local git config.
