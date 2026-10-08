---
name: colorhub-verify
description: The pre-report verification loop for ColorHub lanes. Run it before reporting any lane as done, and after every merge of main. Covers the check scripts, the dangling-reference scan for functions that no longer exist, smoke, the click-path trace and 375x812 screenshots, and produces a PASS/FAIL block to paste into the report.
---

# ColorHub verify (run in order; stop and fix at the first FAIL)

All commands run from the repo root of YOUR worktree.

## 1. Static gates
```
node tools/check.js && node tools/check_wiki.js && node tools/check_names.js
```
(Also `node tools/check_shades.js` if you touched shades. Add your lane's own test script if it has one.)

## 2. Dangling-reference scan (catches the "undefined function after merge" class)
```
bash tools/undef_check.sh        # stopgap
node tools/undef_scan.js         # use this instead once L3 has landed it
```
FAIL if any name is called but defined nowhere in js/*.js or index.html. After a merge, also run:
`git diff HEAD~1 --stat` and for every function name your diff removed or renamed, `grep -rn "name(" js index.html` must find nothing.

## 3. Smoke
```
bash tools/smoke.sh              # once it exists (L3). Until then: node tools/serve.js, open #/today, #/train, #/explore, #/color/<any>, and read the console for errors.
```
FAIL on any console error on a screen you changed or any screen that imports a shared file you edited.

## 4. Click-path trace (every changed button or tap target)
For each handler you added or changed, list its calls in order. For each call write: what state it reads, what it writes, what it resets. Check that a later call does not undo an earlier one, and that the end state matches the button label. Then actually tap it in the headless browser (not just load the page).

## 5. Screens
Screenshot every changed screen at 375x812 (iframe wrapper; headless Chrome will not go below ~500px). Look at every image. State in one clause what each shows. Check the "one tap on a color opens its page" rule and that "the 101" appears nowhere in the UI.

## 6. Diff review
`git diff main --stat`, then read the diff of every SHARED file (router.js, core.js, index.html, app.css). Confirm each hunk is additive and listed under "MAY TOUCH". Confirm no `?v=` changed, no `git add -A` leftovers, no research/_raw, no book text.

## 7. Output block (paste into the report)
```
VERIFY  gates:PASS|FAIL  undef:PASS|FAIL  smoke:PASS|FAIL|N/A  clicks:PASS|FAIL  shots:PASS|FAIL  diff:PASS|FAIL
FAIL DETAILS: {none | one line each}
```
