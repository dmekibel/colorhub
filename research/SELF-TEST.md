# Your own experiment (self-test), 2026-10-07

An opt-in check that the learning loop actually works for the person using it. Off by default. Code: `js/pickit.js` (the `exp*` functions); tests: `tools/pickit_test.js`.

## Why
The learning KB's strongest finding (§1 #3) is that how learning feels is no evidence of learning; every progress signal should be a delayed, unassisted probe. The app's "yours" count is now such a probe (an objective check a day or more later). But it only counts names that were practiced, so it can't say whether the practice caused the knowing. A held-back control can.

## How it works
1. Turn it on: Today > menu > About the colors > "Start the experiment".
2. From the next unit on, 3 of the unit's colors (picked at random when you open the unit) are **held back**: they're left out of "meet the unit", the deck and reviews. You don't see which ones.
3. **Day 7 and day 30** after you finish the unit, a blind test is waiting (on the unit-done and review-done screens, and in About). It covers every color in the unit, practiced and held back, two ways:
   - **Same swatch:** the name, then four close shades (the color plus its three nearest names by CIEDE2000, at least 6 apart). Tap the right one.
   - **New shade:** the same, but the right swatch is a new shade of the name, 4 to 6 ΔE away in a random direction, kept nearer its own name than any of the other three. This tests the name's range, not one memorized swatch (KB §1 #9: transfer is near and surface-bound).
   - No feedback during the test, so the test doesn't teach the held-back colors before day 30.
4. After the day-30 test, the held-back colors join your normal reviews. Stopping the experiment releases them too.
5. Results are stored on the device (`S.exp`) and summed in About under "Your own experiment": practiced vs held back, same swatch vs new shade, per test day. If you're more than 30 days late, the day-7 test is skipped (two tests on one day mean nothing).

## Reading the results
- Chance is 1 in 4 (25%). Held-back colors should sit near chance unless you already knew them.
- Practiced well above held back at day 7, and still above at day 30: the loop works for you.
- Same swatch high but new shade low: you learned swatches, not names. More varied examples would help.
- Numbers are small (about 7 practiced and 3 held back per unit), so look at the totals across several units, not one.

## Limits (be honest about them)
- Held-back colors still show up elsewhere in the app (Explore, the color of the day, the gym, the honeycomb). Exposure there leaks into the control and makes the gap look smaller, not bigger.
- Four-choice recognition is easier than free recall (KB §2 N6). This measures "can pick it", the floor of knowing a name.
- One person, no blinding of the experimenter (you chose to run it). It's a sanity check, not a study.

## Storage
```
S.exp = { on, since, units: { "<unit id>": { held: [color ids], out: "<release date>",
  tests: { 7: { at, gap, res: [{ id, held, exact: true|false|null, shade: true|false|null }] }, 30: {...} } } } }
```
