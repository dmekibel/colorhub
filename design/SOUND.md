# Sound (js/sound.js)

Feel: inspired by the warm, bubbly feel of early-2010s console menus (marimba, kalimba, glass and music-box plucks, soft pops, airy whooshes), quiet and tactile. All sounds are original and synthesized live with the Web Audio API: FM plucks, sines, filtered noise, and a reverb impulse generated in code. No audio files and no libraries.

## Rules
- Silent until the first real (trusted) tap. Never in `#shot=` mode, never in the smoke harness (its synthetic taps don't start audio).
- `navigator.audioSession.type = "ambient"`: mixes with the user's music and follows the silent switch.
- One sound per gesture: everything in one task is queued and the most meaningful sound wins. At most one sound per 60 ms unless the newer one matters more.
- Every envelope starts from 0 with a linear attack and falls to silence before it stops (no clicks). A compressor sits on the master. UI sounds stay under ~600 ms; only the fanfares and the ambient bed run longer.
- UI sounds are muffled (David, 2026-10-08: too sharp): lowpass at or under 1.5 kHz, attack 6-10 ms, no noise clicks, low pitch, small glides. Covers tap, tick, select, back, open, close, reveal and tuck. Game feedback (right, wrong, flourishes) is deliberately untouched.
- Drawers: a click on `<summary>` inside `<details>` plays `reveal` (a very quiet low filtered-noise breath) when opening and `tuck` (softer, falling) when closing. The click fires before the toggle, so the open state is read inverted.
- Settings: Sound (default on, quiet), Calm music (default off), and volume. They live in S.sound, S.music and S.vol. These are additive keys, so migrateState doesn't need a step.

## Central hooks (the games needed no edits)
- `buzz()` (core.js) calls `sndBuzz(ms)`, so the haptic vocabulary is also the sound vocabulary: 4 = tick, 8 = select, 10/12 = right, 10·40·10 = wrong, 8·30·8 = close, 8·50·8 = streak, 10·30·20 = done, 12·60·12 = best, 8·30·8·30·14 = level up.
- One delegated click listener: Next / next level = a forward pluck. Back or close = a reverse pluck. A tap on anything carrying a color (data-swatch, data-hex, --c) plays that color's note. Any other button gets a soft tap.
- A MutationObserver: a sheet opening whooshes up and closing whooshes down, and the rooms fan-out plays an arpeggio, one note per bubble. Any end-of-session screen (`.result`, `.pr-res`, `.dp-end`) gets a flourish: a warm horn swell and a sparkle whose notes come from the colors on that screen. If most answers were misses it plays a gentle settle chord instead.
- Right answers climb the pentatonic scale with the streak. A miss resets the streak, and so do 25 s of quiet.
- Swipe deck: the reveal is a paper whisper plus the card's own color note. Knew it and Again each have their own sound.

## Color → note: `colorTone(hex)`
- Lightness (L*) gives the pitch: 14 steps of the C major pentatonic, C4 to A6. Darks are low and pales are high, and any palette is in tune with itself.
- Chroma gives the timbre: greys (C* < 9) are a soft felt sine, and more chroma means a higher FM index and an open filter.
- Hue picks the instrument: reds, oranges and yellows a marimba, greens and teals a kalimba, blues a glass bell, violets and magentas a music box. Hue also pans the note slightly.
- `sfxChord(hexes, {shares})` rolls a palette from low to high. Bigger areas play louder.

## Calm music
A generative felt piano with long reverb, slow pads and long silences, inspired by the mood of quiet sandbox-game soundtracks. It never quotes a melody. Each section walks a small chord chain (I, ii, iii, IV, vi) in C, F or G. It plays zero to two short rubato phrases drawn from the chord tones, then rests for 5 to 13 s. It ducks to a whisper inside games and decks. It is off by default. Turn it on in Settings or at `#/lab/sounds`.

## Audition
`#/lab/sounds`, also reachable from Settings ("Hear every sound"): every sound has a play button, there's a color grid (pitch rises with lightness), and you can play a painting's palette as a chord.
