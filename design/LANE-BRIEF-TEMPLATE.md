# Lane brief template (conductor fills the {braces}; paste the result into the Agent prompt)

You are lane {L#}: {name}. Model: {model}. Worktree: yours, isolated.

## 0. Read first (paths, do not ask for pasted copies)
1. CLAUDE.md (philosophy, product rules, myths list)
2. design/MASTER-PLAN-2026-10-08.md: §1 Soul, §2, and your lane in §4
3. design/INSTINCTS.md (lessons from earlier lanes; obey them)
4. {lane-specific files, max 3}

## 1. Goal and done signal
Goal: {one sentence}.
Done when: {observable, e.g. "tap a painter in Explore opens #/painter/<slug> and shows 3 sections; screenshot at 375x812"}.

## 2. Write surface (merge-collision control)
- OWNS (create/edit freely): {files}
- MAY TOUCH, ADDITIVE ONLY, smallest possible edit, one line or one block, never reformat or reorder: {router.js ROUTED list / core.js / index.html script tag}
- MUST NOT TOUCH: everything else, including index.html `?v=` tags (the conductor bumps them), CLAUDE.md, other lanes' files.
- New top-level names: prefix them with `{lanePrefix}_` (all js shares one global scope; a duplicate breaks the app).

## 3. Before you touch a SHARED file (router.js, core.js, index.html, app.css) the first time
Write in your notes, from real grep output, not memory:
a. every file that calls what you will change (grep -n "name(" js/*.js index.html)
b. the exact lines you will add or change
c. why this edit cannot remove or rename an existing name
If you cannot fill a, b and c, do not edit the file.

## 4. Merge discipline
- `git merge main` into your worktree before starting and again before reporting. Keep both sides of every conflict.
- After EVERY merge: run the dangling-reference scan (colorhub-verify step 2). A merge that deletes a function someone else calls is the #1 way we broke the app.
- Commit with explicit paths only. Never `git add -A`. Never research/_raw or book text. Do not push.

## 5. Genius check (standing rule)
Build at least two real connections to other systems (Color Graph, Learner Model, articles, Journey, Train, Explore, Studio, painters, Cabinet). List them in the report.

## 6. Verify before reporting
Run the `colorhub-verify` skill. Paste its PASS/FAIL block into your report. If any line is FAIL, fix it or say so plainly. Never report a FAIL as done.

## 7. Report (max 20 lines, this exact shape; the conductor pastes it into the log)
```
LANE {L#} {name}  STATUS: DONE | PARTIAL | BLOCKED
SHIPPED: {3-6 bullets, user-visible}
FILES: owned {..} / shared edits {file:lines}
CONNECTIONS: {2+ links to other systems}
VERIFY: {the PASS/FAIL block}
SCREENSHOTS: {paths}
LEFT: {what is not done}
LESSONS: {0-3 lines in the form "WHEN <trigger> DO <action> (evidence: ...)", or "none"}
SELF-CHECK (1-5, one clause each): accuracy / completeness / clarity
```
Do not spawn subagents. If blocked, stop and say exactly what you need.
