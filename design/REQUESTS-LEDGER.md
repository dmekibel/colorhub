# ColorHub master requests ledger

Built 2026-10-08 from David's 225 logged messages (about 140 are real messages; the rest are tool and task-notification noise, ignored), plus PLAN, ROADMAP §1-21, NOTES-TRACKER, HANDOFF, CLAUDE.md, DESIGN-SYSTEM, design/JOURNEY, COLOR-PAGE-PLAN, PANEL-VERDICT, and `git log` (228 commits, last = c9e020a). Read-only audit; status was judged from commits, files in `js/` and `data/`, and the docs. Anything I could not verify from the repo says so.

**Dates** are 2026-MM-DD HH:MM as logged (10-06 to 10-08). A date marked "NT" or "RM" is a quote that only exists in NOTES-TRACKER or ROADMAP (David's words, recorded by Claude), not in the message log.
**Status:** DONE = shipped on `main` and working as asked. PARTIAL = part shipped, or data built but not shown, or built but unmerged. NOT STARTED = specced or only discussed. REJECTED = David said no. SUPERSEDED = David changed his own mind later.
**Spec codes:** R§n = ROADMAP section · J = design/JOURNEY.md · DS = DESIGN-SYSTEM.md · CP = design/COLOR-PAGE-PLAN.md · PV = design/PANEL-VERDICT.md · NT = NOTES-TRACKER.md · HO = HANDOFF.md · CL = CLAUDE.md · WT = unmerged worktree under `.claude/worktrees/`.

## Counts

| Section | DONE | PARTIAL | NOT STARTED | REJECTED | SUPERSEDED | Rows |
|---|---|---|---|---|---|---|
| 0A Process rules | 18 | 5 | 0 | 0 | 0 | 23 |
| 0B Rejections / never-do | 0 | 0 | 0 | 28 | 1 | 29 |
| Areas 1-16 (requests) | 93 | 38 | 45 | 0 | 2 | 178 |
| **All rows** | **111** | **43** | **45** | **28** | **3** | **230** |

Of the 178 requests, 52% are shipped, 21% partly, 25% not started. Top 25 open items are at the end.

---

## 0A. Process rules (how David wants Claude to work)

These matter most. A rule marked DONE is written down in a durable place (CLAUDE.md, HANDOFF, memory); several were still broken in practice, and the note says where.

| ID | Rule | David said | Status | Evidence / note | Specced in |
|---|---|---|---|---|---|
| P1 | Be cheap: Sonnet (or Haiku) for agents, Opus only with his OK. | "be efficient with agents and credits use sonnet when possible" (10-07 07:07) | DONE | Memory `agent-model-cost.md`, HO "Cost first". Broken once: he asked "why did u use opus" (10-07 10:26). | HO, memory |
| P2 | Gameplan and get a go before any huge ask; give a size. | "We need to gameplan before doing crazy big asks" (10-07 10:24) | DONE | HO ("S/M/L and a go before anything big"). | HO |
| P3 | Follow Claude's recommendations on in-repo decisions; still confirm outward-facing actions (contacting people, publishing). | "I'm down to follow whatever u recommend" (10-07 08:56); "Go with ur recs" (10-07 14:59) | DONE | Memory `colorhub-decisions-follow-recs.md`, HO. | HO, memory |
| P4 | Go parallel and fast with agents when time (not credits) is the limit. CONFLICT: P1 says 1-2 agents at a time. | "Do everything as fast as possible with agents if that helps" (10-07 08:03); "as many agents as possible" (10-08 08:47) | PARTIAL | 10-08 08:47 overrides P1 for that day (credits reset, 5 a.m. deadline). The memory file still says 1-2 agents; it needs a dated exception. | memory vs NT |
| P5 | Be a conductor: direct many agents and sessions, keep context windows small, choreograph. | "be like a conductor" (10-08 08:47) | PARTIAL | HO + NT list worktrees; no orchestration doc exists yet. | NT |
| P6 | Push often so he can test on his phone. | "push what's done so far so i can try it" (10-07 08:29); again 09:04, 12:53, 15:48, 16:09 | DONE | Pushes every batch; ship checklist in HO. Phones get each push at once (2682533). | HO ship checklist |
| P7 | Keep him informed in plain words: tldr, ETA, what's left, agent status. | "tldr" (10-07 07:14); "How much longer" (12:59); "What's left how soon" (17:44); "update me on all the agents running" (19:49) | PARTIAL | He asked 8+ times; no standing status format exists. Worth a one-line standing format. | none |
| P8 | List every request in one place (this ledger). | "list every single request I've ever given you" (10-08 08:47) | DONE | This file. | this file |
| P9 | Design first, review every screen, with mockups he approves before building; show choices in chat as pictures. | "visualize it in chat for me" (10-07 14:04); "Design do the whole app still never happened wtf" (19:31) | PARTIAL | Memory `design-first-review-every-screen.md`; DS + mockups exist; whole-app rebuild is not done. | DS, memory |
| P10 | Give him a live tweak menu or widget to try settings himself and rate them. | "put it all in one like tweak menu" (10-07 15:28) | DONE | `#/lab/honey` + Tweak panel (0ec7ddb, 66217cc). | R§17, NT |
| P11 | Use a panel of judges for brainstorms (what stays and what goes). | "panel of judges to judge different aspects of the app" (10-07 09:25); also 15:24, 20:14 | DONE | design/PANEL-VERDICT.md (57 KEEP / 20 LATER / 3 CUT). Honeycomb styles not yet panel-judged. | PV |
| P12 | Brainstorm big and deep, think outside the box, "tenfold". | "brainstorm how to make this app better in every way" (10-07 07:29); "improved tenfold" (09:25, 10-08 08:47) | DONE | Brainstorm rounds became ROADMAP §1-21. | R§1-21 |
| P13 | Subtle motion: beautiful, never crazy; nothing snaps. | "I want subtle yet beautiful and appealing not like crazy wiggling" (10-07 17:57); "There should be no snapping." (19:24) | DONE | 4090144 (calm drift), 9e1e920 + 224c611 (sizes ease). He extended it to all panning (19:27). | NT |
| P14 | Simple surface, depth one tap away; never overwhelm, never a "clusterfuck". | "i dont want my app to make users overwhelmed" (10-07 07:37) | DONE | DESIGN.md feature hierarchy, CL "Depth by default, calm on the surface". | CL, DESIGN.md |
| P15 | Honest, grounded content: no myths, no buzz, hedge where books disagree; copyright-safe prose. | "grounded not like buzzed articles" (10-07 20:14) | DONE | CL myth list, 3 fact-check passes, color-KB prompts applied (0d50fc1, cc0246c). | CL, CP A1 |
| P16 | Cross-session prompts must account for what the other session already got. | "we need a new prompt. That takes into account the fact that the old prompt was already given." (10-07 07:55) | DONE | Second KB pass (cc0246c). | n/a |
| P17 | Learning-science grounding from his mental-gym KB. | "take inspiration from our mental gym learning KB" (10-07 08:27) | DONE | CL learning-science rules, J §0. | CL, J |
| P18 | Finish English first, Russian after. | "lets finish the app in english then do russian after" (10-07 09:03) | DONE | Recorded in HO and NT as deferred. | HO |
| P19 | Pause and hand off work when credits run out or when moving to the newer Claude app. | "pause all tasks with handoff" (10-07 12:17) | DONE | HANDOFF.md, NT "RESUME HERE". | HO, NT |
| P20 | Before saying "everything is paused", check for agents that agents spawned. | (HO, from this session) | DONE | HO "How to work". | HO |
| P21 | Test the real click paths before pushing. The "tap a color" bug came back 6 times. | "Clicking a color still doesn't open it." (10-07 21:24); 22:08; 22:15 | PARTIAL | Fixed twice after nav merges lost functions (6b5163c, c9e020a). No automated tap-through test exists in `tools/`. | HO ship checklist |
| P22 | Don't build big new things before using up already-found resources ("don't do 9000 before we take from the resources"). | "Don't do 9000 before we take from the resources we found" (10-07 16:38) | DONE | ISCC-NBS imported first (d14be3d); 9k stays switched off. | NT #0 |
| P23 | Audit for what got lost in the weeds: ask what was forgotten. | "anhything else we forgot or got lost in the weeds" (10-07 08:41) | DONE | This ledger plus NT. | this file |

## 0B. Explicit rejections and "never do X"

| ID | Never / rejected | David said | Status | Evidence / note | Specced in |
|---|---|---|---|---|---|
| X1 | "Where's the seam" game. | "Where's the seam feels a little weak." (10-07 11:30) | REJECTED | R "Rejected" list. | R top |
| X2 | Ghost of yourself. | "Ghost of yourself, we don't need that one." (11:30) | REJECTED | R top. | R top |
| X3 | Head-to-head duels and multiplayer (not now). | "duels we can think of later" (11:30) | REJECTED | Deferred, not dead. R top, NT "Ideas only". | R top |
| X4 | Rabbit-hole view (too close to the honeycomb). | "different from honeycomb, so no need for that one" (11:30) | REJECTED | R top. | R top |
| X5 | Mix with your own paints (for now). | "good idea, but too complicated for now" (11:30) | REJECTED | Deferred. R top. | R top |
| X6 | Seasonal skins. | "Seasonal skins is a bit too much." (11:30) | REJECTED | R top. | R top |
| X7 | Progress marks on honeycomb bubbles; any dimming or muting. | "is a bad idea cuz then honey comb won't look as cool" (12:01) | REJECTED | Rule: true colors only. 00aa3ae removed rings. Progress is a view toggle, not a marking. | R§12 |
| X8 | A colored-belt system. | "I don't want a literal belt system with colors." (12:37) | REJECTED | Stages instead (R§14). | R§14 |
| X9 | Teaching the 11 basics, or stages that grow by only +10. | "I don't want a small transition like learning 11 basics." (12:37) | REJECTED | Basics = placement only. | R§14 |
| X10 | See-through, glass, blurred controls. | "See-through is really bad." (14:11) | REJECTED | DS principle 2 "Controls are solid" (4ea4b5d). | DS §1 |
| X11 | A title island, a redundant name caption, a bottom bar that stays, or 3 top buttons on Home. | "I don't like that island above, which says the name of the color" (13:09) | REJECTED | 05683b6 removed title, caption, handle. | DS §1 p7 |
| X12 | Eye-shaped or heavy vignette. | "Ur vignette is too extreme" (13:17); "less eye shaped and more shaped like the iPhone screen" (14:04) | REJECTED | 831686a oval lens, softer vignette. | NT |
| X13 | Apple-Watch edge lens as the default (keep as an alternate). | "The way it looked before was better." (14:47) | REJECTED | 4822dd6 restored the round fisheye; edge lens is an option. | R§12 |
| X14 | A mini sheet with an "Open page" button between a color and its page. | "I hate that if you press in a color, you have to press the second time" (19:51 first words) | REJECTED | 86d32f6, 1a9b69b; rule in CL. | CL product rules |
| X15 | Blurry painting on open. | "clicking the painting opens it but blurry. That's lame" (11:45) | REJECTED | 72a01c5 (sharp or crisp copies). | HO known issues |
| X16 | Gaps and empty space in the honeycomb; uneven seams. | "I don't like those empty gaps." (15:28) | REJECTED | d8d8fc2 equal seams. | NT |
| X17 | Overlapping bubbles at any setting, including while sliding. | "make sure there is no overlap in any of the home settings" (17:03) | REJECTED | 88ab1a4, 224c611. | NT |
| X18 | Snapping or janky size changes. | "I don't like how the size of the circle snaps" (19:24) | REJECTED | 9e1e920. | NT |
| X19 | A special status for "the 101"; never say it in the UI; never link a color to its "closest of the 101". | "I don't view the 101 as some special list" (21:28) | REJECTED | 42b1604, 81384b5; CL rule. | CL |
| X20 | Literal Japanese names as taught or primary names in an English app. | "I don't see a reason learning colors in Japanese" (12:18) | REJECTED | 4eb25ca; Japanese kept as a note. See M3 for his nuance (a Japanese name is OK when no English name exists). | R§17 |
| X21 | Two names for one color / a color with no page. | "There's two names for a thing." (14:49) | REJECTED | One naming system (1e16283). | R§13 |
| X22 | Boring family-by-family lessons ("just the blues, then the reds"). | "Maybe your lesson system is boring" (19:42) | REJECTED | R§1 update, J. Not built yet (see L4). | R§1, J |
| X23 | One palette per painting or painter. | "I don't want just a single palette to represent them." (20:22) | REJECTED | CL philosophy. Data built; UI not (see A1). | CL, R§21 |
| X24 | A pull-down that closes a page while you are just scrolling. | "scroll all the way to the top and then scroll down" (20:18) | REJECTED | f116323. | NT |
| X25 | The paint-chip as the app's signature object. | (HO) "the paint-chip idea was rejected" | REJECTED | Signature object still open (HO open questions). | HO, R§11 |
| X26 | Trivial "find your color" and palette tools. | "feels a bit trivial" (07:58) | REJECTED | c24a0c8 taste engine rebuilt; palette engine still to come (St5). | R§16 |
| X27 | Fashion framed as museum collections (he meant color trends, couture, history). | "I don't fully understand what fashion has to do with museum stuff" (10:41) | REJECTED | e11670c built fashion as decades + Pantone + houses. | R§7, `js/world.js` |
| X28 | A 1,000-name cap on Home. | "I'm realizing 1000 is not enough for home view" (16:12) | SUPERSEDED | Wants ~9,000 (H11). | NT #0 |
| X29 | Hiding the colors' words / answer before the attempt. | (CL rule) | REJECTED | Recall-before-reveal rule. | CL |

---

## 1. Soul & philosophy

| ID | Request | David said | Status | Evidence / note | Specced in |
|---|---|---|---|---|---|
| S1 | The app sees the whole world through color: every thing is a color dataset; derive the most insight by default. | "think about the soul of the app because that dictates everything" (10-08 08:47) | DONE | Written as CL "The philosophy" (d76c46e). Realizing it is spread over A1-A8, C1-C3. | CL |
| S2 | Never one palette: many palettes, favorite combinations, how it changed, typical and atypical works. | "I want as much info as possible." (10-07 20:22) | PARTIAL | Data engine merged (a2b60d2, 9efbd58: 837 painters, decades, countries). Almost no UI reads `data/analysis`. See A1. | R§21, CL |
| S3 | Think like the most obsessive color nerd and best curator, design like Apple. | "improve the design even more... more iconic" (10-08 08:47) | PARTIAL | CL rule; design pass in progress. | CL |
| S4 | Learn by seeing; every page leaves you able to notice color in the real world. | "speed up learning in a more exploratory browsing way" (10-07 11:57) | PARTIAL | Missions/photo checks not built (T9). | CL, R§6 |
| S5 | Many lenses, one color: every color links out to paintings, poems, flowers, gems, films, fashion, and back. | "And everything will be interconnected?" (10-07 13:47) | PARTIAL | Color pages are hubs (HO). Reverse links (a flower or gem back to colors) exist; family trees, disambiguation pages do not. | R§7, CP |
| S6 | Two kinds of reading: a classical Wikipedia-style article, plus playful ways to interact. | "pick more classical learning tab with Wikipedia style article" (20:14) | PARTIAL | CP Read/Do designed and panel-judged; not built. | CP A, PV |
| S7 | Grounded and honest articles, not "buzzed". | "grounded not like buzzed articles" (20:14) | DONE | Rule in CP A1, CL myth list. | CP A1 |
| S8 | Helpful to artists and creators worldwide, possibly a money maker. | "something I can make money from in the future" (09:25) | NOT STARTED | See Business. | NT Later |
| S9 | Goal: someone can reach the top and know ~2,600 colors and tell them apart. | "reach the highest level of this app and know all 2,600 colors" (12:16) | PARTIAL | Stages specced (R§14); only the honeycomb preview exists. | R§14, J |
| S10 | Don't copy Peter Donahue's complexity; borrow his ideas, keep it simple. | "i dont want my app to make users overwhelmed" (07:37) | DONE | Credit link e7a3977; research/COLORNERD-IDEAS.md; Color Nerd mapped in CP B. | CP B |
| S11 | Learn from the Aesthetics Wiki. | "Anything we can learn from aesthetics wiki that we can apply" (09:17) | NOT STARTED | No trace in the repo. Probably answered in chat only. Needs an explicit decision. | none |
| S12 | The app's signature visual object. | (HO open question) | NOT STARTED | Paint-chip rejected; 3-5 reference screenshots still needed from David. | HO |

## 2. Design & UI

| ID | Request | David said | Status | Evidence / note | Specced in |
|---|---|---|---|---|---|
| D1 | Make it look like an expensive site (D and E variants best). | "D and E look the best. But still doesn't look like an expensive website." (10-06 23:58) | DONE | 139dbac museum editorial art direction. | DESIGN.md |
| D2 | More screen on mobile; the gym looks boring. | "Show me more screen here on mobile." (10-07 06:11) | DONE | 72a84de, cea3931 (gym as stations). | DESIGN.md |
| D3 | Take the whole design to the next level (Duolingo / ALTER intricacy, minimalist, iconic, fun). | "take the design of this app to the next level" (11:31) | PARTIAL | DS approved; tokens, rooms nav, color page, Learn it, Explore covers merged (4ea4b5d, 1a9b69b, db22e54). Train stations, bubble-to-page motion across screens, icon set, moments still open. | DS, R§11 |
| D4 | Do the whole-app design pass he asked for already. | "Design do the whole app still never happened wtf" (19:31) | PARTIAL | Same as D3; batches continuing (NT #9). | DS |
| D5 | Improve every UI element and make all of it smoother (a one-day push). | "Improve every aspect of the UI and the design" (10-08 08:47) | PARTIAL | Same. | DS, NT #9 |
| D6 | One unified system, consistent everywhere. | "It should be a unified system" (13:18) | PARTIAL | DS tokens and archetypes; not every screen conforms yet. | DS |
| D7 | Full-screen, decluttered Home feel. | "Show me more screen" (06:11) / Home 13:09 | DONE | 05683b6, 880944a, 965923e (one quiet menu button). | DS §11 |
| D8 | Home buttons: not ugly, not oddly placed; bigger icon or different texture; corners. | "still ugly buttons and weird placement maybe more in the corner?" (14:07) | PARTIAL | Solid corner buttons (880944a), 4 rooms rise from a corner stem (7237d4c); he said at 14:10 he was "not sure". Unconfirmed on his phone. | DS §2 |
| D9 | Bottom-corner menu like ALTER's garden; then he flipped twice. | "idea about alter garden inspiration was right all along" (14:04); before: "not sure I like the alter garden influence" (12:06) | SUPERSEDED | The later view won: rooms rise from a corner. | R§12, DS §2 |
| D10 | Swiping down closes a color page, but only from the top of the scroll. | "swiping down should close it also" (13:25); nuance 20:18 | DONE | 000035b, f116323. | NT |
| D11 | Sheets close with a swipe-down on iPhone. | "swiping down doesn't close it, which is a problem" (15:20) | DONE | 6ef4c35. | NT |
| D12 | Odd weird diagonal line next to the level. | "a weird diagonal line next to lecel" (08:24) | DONE | 71a2b07 dropped the sparkline. | NT |
| D13 | Lighter/darker feedback stays on screen long enough and says more than "red". | "it flashed so fast that you never had a chance to actually see it" (09:31) | DONE | d836ac2 (labels, one tip, wrong waits for Next). | NT |
| D14 | Ideas list gets a contents/jump row. | "a way to jump secitons like a contents thing in wikipedia" (08:48) | DONE | 1ce2276. | CP A1 p5 |
| D15 | "This looks weird" / "Also this broken" (screenshots not in the log). | "This looks weird" (20:46); "Also this broken" (20:49) | PARTIAL | Likely the 9k Home merge; fixes followed (224c611, b7dd1a5). Cannot identify precisely. | n/a |
| D16 | Motion pass, sound, haptics; moments (lesson complete, level up, new color owned). | "improve the design even more, make everything even smooth" (10-08 08:47) | PARTIAL | iPhone haptics (2c4a0c0) and the grow/shrink motion shipped; sound, moments, motion language not. | R§9, R§11, DS §8-9 |
| D17 | A real icon set, type scale, component sheet, design-QA list. | (R§11, approved 10-07 11:30) | PARTIAL | DS §13 QA list written; icon set and component sheet not built. | R§11, DS |
| D18 | Paintings open crisp. | "Yes" to fixing the blur (11:49) | DONE | 72a01c5 (SMK swaps to sharp; Chicago crisp with link). | HO |

## 3. Honeycomb / Home

| ID | Request | David said | Status | Evidence / note | Specced in |
|---|---|---|---|---|---|
| H1 | Honeycomb is a view of any set (red only, pastels), and one of many view modes. | "maybe honey comb is just a preview method for any number of things" (08:17) | DONE | Show/Look panel, collections, filters (4090144, 0ec7ddb). | R§12 |
| H2 | Sliders to pick any count (2,700 down to 10), a hue slice, saturation. | "maybe can be more dynamic like sliders" (08:20) | PARTIAL | Count snaps to 9 stages (14:11 he asked for that); hue/saturation slice sliders are not confirmed. | R§14 |
| H3 | Zoom in and out. | "we should add zoom in and out feature as well" (08:21) | DONE | 00d3eaf and later. | NT |
| H4 | The honeycomb is the home screen of the whole app. | "the whole every color honeycomb thing should be the home screen" (11:57) | DONE | bc3088f, b048904. | R§12, DS §2 |
| H5 | Toggle to see only learned colors; progress is a view, not a mark. | "u can toggle a view of all the colors u already learned" (12:01) | DONE | All / Learned / Learning / New (4090144). | R§12 |
| H6 | Tap a color: its full page opens directly. | "clicking on color should open that color fully" (12:04) | DONE | 86d32f6, 1046aa4. | R§12 |
| H7 | A tap on the center and the ring opens; farther ones glide to center first. | "tapping the ones that are around the center should all be openable" (21:27) | DONE | 9ce6ff6, b7dd1a5. | NT |
| H8 | Opening a color must work every time (regressions). | "Clicking on color still doesn't open its page." (22:08) | DONE | 6b5163c fixed a crash lost in the nav merge. Needs a confirm on his phone. | HO |
| H9 | View panel buttons work. | "View buttons don't click" (22:15) | DONE | c9e020a (bodyBuilt). Confirm on phone. | HO |
| H10 | Zoom out and stay there (repeats at edges are fine, even helpful). | "once you let go, it zooms back in" (14:45) | DONE | 9ed8a4d, 2af8f12, 0ec7ddb (stable zoom-out); capped at 5,000 bubbles for speed (cdbe0b0). | NT |
| H11 | Honeycomb up to ~5,000, then ~9,000 ("every shade"). | "Let's do 9k" (16:15); earlier "go up to 5k" (16:12) | PARTIAL | Loader, "Every name" (7,051) stop shipped; "Every shade" stays switched off (only 108 generated shades fit; 5b799dc). | NT #0 |
| H12 | Is 1,000 or 2,700 right for the explorer? | "U sure 1000 is enough for our purposes or is 2700 better?" (13:22) | SUPERSEDED | Measured (R§13 table), then David found gaps (16:12) and chose 9k. | R§13 |
| H13 | The Apple-Watch feel: strong scaling toward the middle. | "It's supposed to be more like the Apple Watch." (14:41) | DONE | 4822dd6 round fisheye restored; Lens slider (b656ecb). | R§12 |
| H14 | Many style presets and settings so he can pick his favorite; judge them. | "give me many options also to test in the app" (15:24) | DONE | 8 presets, #/lab/honey (0ec7ddb); 5 curated on Home; Globe in the lab (334f18b). Panel judging not run. | NT |
| H15 | Fill the black space; tune shape between circle and honeycomb. | "minimal amount of black space" (15:26) | DONE | d8d8fc2 (true cells, equal seams, shape). | NT |
| H16 | One tweak menu with sliders: center size, falloff, gap, and more. | "what if you made this dynamic system of sliders?" (15:28) | DONE | Tweak panel (66217cc), per-style saved tweaks (d8d8fc2). | NT |
| H17 | Magnifier: no gap next to the center; add a gap slider that is equal everywhere. | "make it so that gap is non-existent" (17:18) | DONE | d8d8fc2 pixel Gap slider. | NT |
| H18 | Honeycomb preset: a full honeycomb with corners and magnification. | "Why can't it be a full honeycomb?" (17:18) | DONE | d8d8fc2. | NT |
| H19 | Center the pattern above the open panel; separate the style picker from "how many". | "we should shift the middle of the pattern upwards" (17:27) | DONE | 4090144 (recentering, Show/Look split). | NT |
| H20 | No crash or white/black screen at 2,700 when switching modes. | "sometimes it just breaks the app. Completely" (17:27) | DONE | cdbe0b0. | NT |
| H21 | Not janky at 2,700; no animation snapping; applies to all panning. | "I didn't mean canning, panning specifically" (19:27) | DONE | 9e1e920 (budget, fast path). | NT |
| H22 | Words on every bubble; a subtle tall vignette. | "I want to see words on every color" (14:04) | DONE | 880944a, 831686a. | NT |
| H23 | Use the 9 stages as the honeycomb's amount control. | "stage one, all the way to stage nine" (14:11) | DONE | 3532c79, 831686a. | R§14 |
| H24 | Fix the Globe layout (even spread) and bring it back to Home. | (NT) Globe lab-only | PARTIAL | Fibonacci-sphere fix queued. | NT Smaller fixes |
| H25 | Alive: calm drift, finger-lag net, ripple. | "I want subtle yet beautiful" (17:57) | DONE | 4090144. | NT |

## 4. Navigation

| ID | Request | David said | Status | Evidence / note | Specced in |
|---|---|---|---|---|---|
| N1 | Pinterest-style Back: one step at a time, restoring the screen and scroll. | "go back one step at a time" (10-07 15:09) | DONE | 3588f4a, f7e3308; Studio 9023c51; Home 7989fbe. | R§17 |
| N2 | Every color, everywhere, is a tappable link; no dead swatches. | "there's not enough hyperlinks" (12:12) | DONE | 1e16283 (tappable swatches app-wide). | R§13 |
| N3 | One tap on any color opens its page: painting analysis, photo palettes, links. | "press on any color in it for it to open the page" (19:51) | DONE | 86d32f6, 1a9b69b. | CL |
| N4 | Rooms replace the tab bar; Today folds into Learn; Colors dropped from Explore. | (DS "Decided David 10-07") | DONE | 4ea4b5d, 5520204, db22e54. | DS §2 |
| N5 | Jump from a flashcard into the color's page, return to the same card. | "you should be able to click into it and read about it" (09:18) | DONE | 985c573; Learn it return (822f762). | R§12 |
| N6 | Search from Home ("sea", "rust", "Monet") that glides to the color. | (R§12 approved) | PARTIAL | Search lives at the top of the sheet; Monet/mood style search not built. | R§12 |
| N7 | Explore: merge Paintings + Poems into Art; keep ~4 filters. | (R§7 approved) | DONE | db22e54. | R§7 |
| N8 | Tap into a color from a painting at the same time return to where you were. | "go back where you started" (15:09) | DONE | N1. | R§17 |

## 5. Learning path & Journey

| ID | Request | David said | Status | Evidence / note | Specced in |
|---|---|---|---|---|---|
| L1 | More than linear progression: add features and goals. | "so u don't only have to do linear progression" (10-06 22:45) | PARTIAL | Train, Explore, Studio, World built; the path itself is the old unit/deck flow. | PLAN, R§1 |
| L2 | A creative Explore mode for names, philosophy, cultural history, palette relationships. | "creative explore mode for learning different stuff about colors" (10-06 22:51) | DONE | Explore pager, wiki, stories, World (db22e54). | R§7 |
| L3 | A whole Duolingo-style system: every tool applied in one lesson path, like ALTER's. | "we could create a whole Duolingo system for this app" (10-07 10:50) | NOT STARTED | J drafted (22 mockups); `practice.js` is 85% in WT a647b2e..., not merged. | R§1, J |
| L4 | Lessons mix many exercise types, not five colors at a time. | "Maybe your lesson system is boring" (19:42) | NOT STARTED | R§1 update 10-08; J §2. Same as L3 build. | R§1, J §2 |
| L5 | Stage system to replace the 100 cap; justify every number (25, 50, 100, 150...). | "Maybe a level before 50 can be 25? Idk make a case" (12:41) | PARTIAL | R§14 specced; honeycomb previews 9 stages; lessons do not use them. | R§14 |
| L6 | Smaller steps in the late stages. | "Don't u think it's a bit jump from 3-4 and 4-5" (12:47) | DONE | 6b6ab2e (late stages +200 max). | R§14 |
| L7 | Fields: ask what the user applies color to (film, painter, interior, digital...); support generalists. | "where you want to apply these skills" (12:22) | NOT STARTED | R§14 Fields, J §9. | R§14 |
| L8 | Don't be stuck on the 101; learn beyond it. | "I don't like that you're stuck on the 101 to learn" (NT, 10-08) | NOT STARTED | NT top item. Learn it works on 1,000 names? Not yet. | NT top |
| L9 | Learn it: any color becomes a 2-minute lesson with its look-alikes. | "quickly create you a lesson to learn the differences" (11:57) | DONE | d753873, 822f762, bc3088f. | R§12 |
| L10 | Tapping a color shows the colors it might be confused with. | "more colors around ur color that u might confuse it with" (11:42) | DONE | 4103d27 (look-alikes sheet). | R§13 |
| L11 | Rewards that are real and a little addictive: streak, Cabinet, gold replays; never lying about progress. | "Fun and a little addictive" (RM, 10-08) | NOT STARTED | J §10-11. | J, R§1 |
| L12 | A whole education through color: art, poetry, fashion, botany, gems, film steps inside lessons; interest switches. | (RM, 10-08) | NOT STARTED | J §9, §5.2. | R§1, J |
| L13 | Color mind profile and adaptive coach ("you confuse teal and cerulean"). | "u will do all this?" (10-07 08:41, pasted next-steps list item 1) | NOT STARTED | R§10. | R§10 |
| L14 | Honest progress: "Yours" = delayed unassisted recall. | (learning KB) | DONE | 5782ec6. | CL |

## 6. Practice & flashcards

| ID | Request | David said | Status | Evidence / note | Specced in |
|---|---|---|---|---|---|
| F1 | My own flashcard decks: first 50 or 100 shuffled, with Quizlet/Duolingo-style modes. | "set up my own flash cards" (10-07 19:37) | NOT STARTED | Nothing in `js/`. Practice (WT) has step components that could host it. | none yet |
| F2 | Say the name into the microphone and have it judged. | "uses microphone to judge" (19:40) | PARTIAL | `js/produce.js` uses SpeechRecognition (fee951f). Untested on a real iPhone (HO). | R§1 |
| F3 | Accept an abbreviation or a phrase. | "Abbreviation or phrase" (19:41) | NOT STARTED | Not verifiable in code. | none |
| F4 | Say "skip" to see the answer, same as "I don't know". | "Or u can say skip then it shows u same as idk" (19:41) | NOT STARTED | Not verifiable in code. | none |
| F5 | Production cards: Say it / Make it in reviews. | (pasted list, 08:41) | DONE | fee951f. | HO |
| F6 | Practice section (merged flashcard/step practice). | (NT RESUME HERE) | PARTIAL | WT a647b2e (85%); gate and merge pending. | NT |
| F7 | Spaced review, delayed "Yours" check. | (learning KB) | DONE | 5782ec6. | CL |

## 7. Train / eye gym & games

| ID | Request | David said | Status | Evidence / note | Specced in |
|---|---|---|---|---|---|
| T1 | Color memory with levels, getting harder. | "color memory can get progressivly harder" (08:26) | DONE | a0eb816. | R§5 |
| T2 | Make the whole gym modular, starting easy, tracking progress. | "starts easy and gets progressively harder" (08:27) | DONE | 419dacc (levels 1-20, dials, staircases, weak spots, check-ins). | R§4 |
| T3 | Deep brainstorm for odd-one-out: odd pair, X/Y gradients, tracking skill, flow. | "an X and Y gradient" (10:50); "clever progression system" | NOT STARTED | R§2, R§3, R§4, R§20 are specced; gym-engine has twist ladders only. | R§2-4, R§20 |
| T4 | Combine odd-one-out with rearrange and memory. | "combine spot the difference with rearrange" (10:50) | NOT STARTED | R§20 "Combinations". | R§20 |
| T5 | Add many nuances to the odd-one-out mechanic (his sister is hooked). | "a lot of nuances to that mechanic" (19:44) | NOT STARTED | R§20. | R§20 |
| T6 | Practice odd-one-out alone, with deeper progression. | "I want to be able to practice just that by itself" (22:47) | PARTIAL | A basic odd-one-out station exists (cea3931). The nuanced family does not. | R§2 |
| T7 | A results screen: % right, count, misses, percentile. | "what percentile you are in the world" (15:56) | PARTIAL | Results, misses side by side, replay, trend shipped (5c30266). World percentile needs a backend; NT #13. | NT #12-13 |
| T8 | Many more mini games for color and memory, inside the Journey. | "think of many more mini games for learning colors" (19:44) | NOT STARTED | R§20 game grammar. | R§20 |
| T9 | "Spotted teal today" photo missions; the app finds the color in the photo. | "Not a bad idea." (11:30) | NOT STARTED | R§6, R§4. | R§6 |
| T10 | Honest eye profile and difficulty that breathes. | "how to see how good the user really is" (10:50) | PARTIAL | Staircases exist; hidden skill estimate and profile not built. | R§4 |
| T11 | Favorite-color tool, tournament-style. | "tournament style or something" (06:35) | DONE | 5f8c24b pickers/taste; c24a0c8 taste map. Not literally a bracket. | HO |
| T12 | Colorist and Atelier shelves (cast, shot match, value scale, masses, Zorn). | (pasted list, 08:41) | DONE | 340b5cf, 8e18b59. | HO |
| T13 | Screen check and color accuracy. | (pasted list) | DONE | 67156c8. | DESIGN.md |
| T14 | Perception facts (15) proposed for the gym. | (KB prompt 2: "Don't build yet") | NOT STARTED | Proposal not yet written in the repo. | CP A5 (see-it) |
| T15 | Color harmony as music: a Train track (optional, later). | "Color harmony as music was my metaphor" (17:52) | NOT STARTED | Folded into the palette engine (4211bbd); Train track is later. | R§16 |

## 8. Color pages & articles

| ID | Request | David said | Status | Evidence / note | Specced in |
|---|---|---|---|---|---|
| C1 | An article for every color, deep where there is history, short where not; improved tenfold. | "writing an article for every single color" (10-08 08:47) | PARTIAL | 1,000 name pages (5c67e36), richer pages (1a9b69b, a3f4041). The rich-page build is 30% in WT a5d6b6e5...; the writing pipeline (R§19) has not run. | R§19, NT |
| C2 | A random color must not be an almost-empty page: paintings, links, hubs. | "doesn't instantly give you things like paintings, hyperlinks" (21:26) | PARTIAL | 6 painting thumbnails and % matches (a3f4041). Needs the rich pages. | NT #2 |
| C3 | The 2,700 or 1,000 names with computed facts, family trees, hub pages, disambiguation. | (pasted idea, 10-08 08:47) | NOT STARTED | R§19, CP. | R§19 |
| C4 | Color pages as hubs: paintings, poems, books, films, fashion, nature, gems. | (R§7) | DONE | HO "Color pages are hubs". | R§7 |
| C5 | No "closest of the 101" links or sections. | "I don't view the 101 as some special list" (21:28) | DONE | 42b1604, 81384b5. | CL |
| C6 | Show the nearest several names and how each differs. | "Maybe it could be the nearest multiple words." (12:16) | DONE | 42b1604; nearest 3-5 names with closeness. | R§13 |
| C7 | Read vs Do page; at least 40 Do ideas; panel-judged. | "check panel to judge what stays and what goes" (20:14) | PARTIAL | CP A; PV verdict ready; nothing built. | CP, PV |
| C8 | Pictures on flower, plant and gem pages. | "Flowers and plants needs pictures" (11:51) | DONE | 7d9a1e4, e59a44c, 10bcb65. | HO |
| C9 | Add Botany, Gems, Fashion sections. | "I want to add a section on botany" (10:38) | DONE | 2f5ee88, 37b0174, e11670c. | R§7 |
| C10 | Fashion = color trends by era, couture, fashion history. | "color trends in fashion, like the 90s" (10:41) | DONE | e11670c. Looks archive (WT a50bf8a3...) unmerged. | NT |
| C11 | Poetry from Japanese, Ancient Greek, and others; treat literature and film equally. | "reference Japanese and Ancient Greek poems" (08:54) | DONE | 1aaeb3e (11,440 poems), c66aad6 (passages, 32 films). | R§7 |
| C12 | Fix confusing name clashes (grayish white vs ecru article). | "why is it not the same article?" (14:49) | DONE | 1e16283, 5c67e36. | R§13 |
| C13 | "Country" in painting stats = where the painter is from, not the museum. | "based on where the painter is from" (14:00) | DONE | 2defdcf. | CP C |
| C14 | More painting stories, fact-checked, in batches. | (NT #11) | NOT STARTED | NT. | NT |
| C15 | Color-blind view, text contrast, grayscale on every page. | (pasted idea) | NOT STARTED | PV Top 10 #2. | PV |
| C16 | The "brighter" ambiguity fix. | (CP B Fix #5) | NOT STARTED | PV Top 10 #1. | PV |

## 9. Naming system & data

| ID | Request | David said | Status | Evidence / note | Specced in |
|---|---|---|---|---|---|
| M1 | One naming system everywhere (nameOf). | "There's two names for a thing." (14:49) | DONE | 1e16283, fa04be5. | R§13 |
| M2 | One primary English name per distinct color. | "we need one primary name for everything" (12:18) | DONE | R§13; plain English cleanup 4eb25ca, 7aa6868. | R§13 |
| M3 | Japanese names: not primary; but keep when no English name exists. | "a color doesn't have an English name" (12:19) | DONE | Japanese kept as notes; "Japanese traditional colors" collection planned. | R§17 |
| M4 | Primary names are plain English, honest closeness. | "closest to blank, but... sometimes it's not that close" (15:09) | DONE | 7aa6868. | R§17 |
| M5 | Core list ~1,000, then up to ~9,000 names. | "How high can we go with names? 10k?" (16:13) | PARTIAL | 7,051 searchable names (d14be3d); ~9k generated shades off (H11). | NT #0 |
| M6 | Find more name sources (paint, print books). | "more places we can take inspiration for color names" (16:35) | DONE | bbfc90b, research/NAME-SOURCES.md. | NT |
| M7 | Copyright of names: can I label a color and charge money? | "why would it be me taking copyright of someone else" (16:37) | DONE | Answered in chat (not verifiable here); rule: no trademarked colors in shop. | NT Later |
| M8 | Import ISCC-NBS names. | "Cuz apart from names I do want more color info" (16:40) | DONE | d14be3d (4,340 alternates). | NT |
| M9 | Digitize Maerz & Paul 1930 (full name, scan from Downloads). | "Maerz & Paul book full name" (18:03) | PARTIAL | 825 chips extracted (9efbd58); OCR cross-cell errors; held out of the library. He also asked if the scan was downloaded or read in place (19:20). | NT #3 |
| M10 | Honest note on the paper's yellowing. | "adjustment for paper becoming more yellow is flawless?" (19:21) | PARTIAL | Not verifiable here; needs a stated caveat. | R§19 |
| M11 | More names must mean more distinct shades, not just synonyms. | "The whole point of more is to be able to name more shades" (18:00) | PARTIAL | Only 108 generated shades fit; Maerz & Paul and Ridgway would add real ones. | R§19 |
| M12 | Core-names quality pass (Seafoam Green is cream; typos; 386 compound names). | (NT Smaller fixes) | NOT STARTED | NT. | NT |
| M13 | Historical pigment names. | (NT #1) | DONE | ae92dc2, 5b799dc. | NT |
| M14 | Choose-the-colors rules and a re-check; origin lines; Wada question; Donahue question. | "follow whatever u recommend" (08:56) | DONE | 3ec2228, 0d50fc1, 11c9d05. Wada palettes not published (copyright). | R§16 |
| M15 | Russian edition and multilingual names. | "then do russian after" (09:03) | NOT STARTED | Deferred by David. | NT Later |

## 10. Books & research

| ID | Request | David said | Status | Evidence / note | Specced in |
|---|---|---|---|---|---|
| B1 | Mine all the downloaded color books. | "go through all the books i downladed" (10-07 06:59) | DONE | 25 books, 3,433 notes in `../color-kb`. | CL |
| B2 | Prompt to apply the color KB in the other session. | "make a prompt that I can paste" (07:24) | DONE | cc0246c second pass. | CL |
| B3 | More books mined (Garfield, Balfour-Paul, Baty...). | "got a couple more books" (07:43) | DONE | cc0246c. | CL |
| B4 | Apply conflicts, upgrades, myths; add the myths list to honesty rules. | (pasted prompts 07:25, 07:55) | DONE | 0d50fc1, cc0246c; CL myth list. | CL |
| B5 | Single-source origin lines awaiting OK; perception facts for gym. | (prompts) | PARTIAL | 14 single-source lines settled by "follow your recs"; perception facts NOT proposed (T14). | NT |
| B6 | Wada palettes: how to use (copyright). Plate notes as painting candidates. | (prompt: "propose, don't build yet") | NOT STARTED | Wada page only (4f9a8c5). | R§16 |
| B7 | Do I need more books for more color info? | "Do I need to download any more books" (16:40) | DONE | Answered; M&P and Ridgway picked. | R§19 |

## 11. Explore / Art / art wiki

| ID | Request | David said | Status | Evidence / note | Specced in |
|---|---|---|---|---|---|
| E1 | More than 22 paintings. | "why only 22 paintings?" (08:34) | DONE | 23,531 paintings (8b94886). | HO |
| E2 | Add museums: the Met, Rijksmuseum. | "add more museums too, like the Met and Rijksmuseum" (08:41) | DONE | 0c02e8d (+NGA, SMK). The Met is a 165-painting sample. | HO known issues |
| E3 | Art wiki: artist, movement, decade, country, museum pages. | "I want as much info as possible." (20:22) | NOT STARTED | CP C, R§21 build step 3; PV "Top 10 #7-10". | CP C |
| E4 | Today in color; mood search. | (R§7) | NOT STARTED | R§7. | R§7 |
| E5 | Merge the paused Looks archive and ~270 wiki images. | (NT) | PARTIAL | Unmerged WTs. | NT |

## 12. Paintings analysis

| ID | Request | David said | Status | Evidence / note | Specced in |
|---|---|---|---|---|---|
| A1 | Per painter: several palettes, favorite combos, how colors changed, typical/atypical. | "which color they use most" (20:22) | PARTIAL | Data merged; no painter pages. | R§21 |
| A2 | Per painting: many readings and findings in plain words. | "derive as much color information as you can from it" (20:22) | PARTIAL | Data in `data/analysis/paintings-*.json`; the page shows the palette slider and highlight only. | R§21 |
| A3 | Painting palette must not be locked; colors must be clickable. | "the color palette is locked on a painting" (12:12) | DONE | 29b80ab, 0ba3a0c. | R§13 |
| A4 | Arrive from a color: highlight it ("5% aubergine"). | (12:12) | DONE | 0ba3a0c. | R§13 |
| A5 | Dynamic 3-20 palette, tap to name a spot. | (R§13) | DONE | 29b80ab. | R§13 |
| A6 | Sargent reads too dark: add watercolor sources. | (NT) | NOT STARTED | NT. | NT |
| A7 | Image analysis: upload an image, see closest painter/era/country, stats, fun facts. | "closest connected to Japan 1790 or this specific painter" (13:01) | NOT STARTED | R§15. | R§15 |
| A8 | Cross-match images and paintings with flowers, gems, fashion. | "this picture has floral influences" (13:07) | NOT STARTED | R§16. | R§16 |

## 13. Studio / palettes / image analysis / Mix lab

| ID | Request | David said | Status | Evidence / note | Specced in |
|---|---|---|---|---|---|
| St1 | Save uploaded photos per user. | "I want it saved in the app per user" (15:09) | DONE | f7e3308 (IndexedDB, local). | R§17 |
| St2 | Different clever techniques to get palettes from an image. | "different techniques and approaches for coming up with color palettes" (15:09) | PARTIAL | 854d60d (vivid colors). No strategy carousel. | R§16 |
| St3 | Mosaic picker: 6-400 tiles, finger-drag to collect a palette. | "turn it into a mosaic kind of, of colors" (13:07) | NOT STARTED | R§16. | R§16 |
| St4 | A very clever palette engine for sizes 3, 5, 10, 20 (Monet, Warhol, math). | "the app needs a very clever system for suggesting different types of color palettes" (13:07) | NOT STARTED | R§16; research/PALETTE-STRATEGIES.md not written. | R§16 |
| St5 | Music-metaphor harmony inside the engine. | "Color harmony as music was my metaphor" (17:52) | PARTIAL | Documented only (4211bbd). | R§16 |
| St6 | Mix lab: two colors at every ratio, four ways to mix, prediction game. | "predict what, what the result would be" (15:13) | NOT STARTED | R§18; Mixbox license gate (PV). | R§18 |
| St7 | Photo palettes: click any color for its page. | (19:51) | DONE | N3. | CL |
| St8 | Palette critique, mockups, exports. | (R§8, approved) | NOT STARTED | R§8. | R§8 |
| St9 | Camera names colors. | (PLAN "Name any color") | DONE | bc9a634. | PLAN |
| St10 | Rename photos and palettes; one-step Back in Studio. | (NT) | DONE | caf7b63. | NT |

## 14. Film archive

| ID | Request | David said | Status | Evidence / note | Specced in |
|---|---|---|---|---|---|
| FA1 | Directors like painters (Kubrick): palettes, evolution, signatures. | "Directors get the same treatment as painters" (NT, 10-08) | NOT STARTED | NT Later. | NT |
| FA2 | The film strip: per-shot progression, 1, 5 or 10 colors per shot, zoom to a scene. | "pick one color per shot or a palette of 5 or 10" (10-07 20:36) | NOT STARTED | "When we have more credits." Copyright: store only computed data. | NT |
| FA3 | Films as text with color passages. | "literature and films" (08:54) | DONE | js/films.js (32 films). | R§7 |

## 15. Business

| ID | Request | David said | Status | Evidence / note | Specced in |
|---|---|---|---|---|---|
| Bz1 | Make money someday. | "make money from in the future" (09:25) | NOT STARTED | NT Later (Plus, atlas site). | NT |
| Bz2 | Affiliate shopping: dress, posters, supplies. | "use affiliate marketing so people can order dress in that color" (19:40) | NOT STARTED | NT "Shop in this color". | NT |
| Bz3 | Can I charge for an app that names colors? | "why would it be me taking copyright of someone else" (16:37) | DONE | Answered; names not copyrightable; no trademarked colors. | NT |
| Bz4 | Percentile scores service and accounts. | "what percentile you are in the world" (15:56) | NOT STARTED | NT #13. | NT |
| Bz5 | Colordle daily game; free atlas site. | (NT Later) | NOT STARTED | NT. | NT |
| Bz6 | Reach out to Peter Donahue. | (08:53 asked) | NOT STARTED | Deferred; Claude drafts, David sends. | HO |
| Bz7 | SEO pages for search traffic. | (CL crawlable) | DONE | 848640c. 1,000 name pages skipped. | CL |

## 16. Tech / QA / performance

| ID | Request | David said | Status | Evidence / note | Specced in |
|---|---|---|---|---|---|
| Q1 | No crash at 2,700 colors. | see H20 | DONE | cdbe0b0. | NT |
| Q2 | No overlap while sliding center size. | "Sliding the center size creates overlap" (20:54) | DONE | 224c611. | NT |
| Q3 | Fix "tap a color doesn't open it". | "Clicking a color still doesn't open it." (21:24) | DONE | 1046aa4, b7dd1a5, 6b5163c. | HO |
| Q4 | "Clicking checking in start doesn't really work." | (22:38) | NOT STARTED | No commit names it. Probably the weekly check-in on Train, or the same lost-function class. Verify. | n/a |
| Q5 | Fix bugs I found on the phone first, then push. | "I had so many notes that u haven't applied yet" (15:48) | DONE | NT tracker. | NT |
| Q6 | Safe to run two Claude apps? | "is it dangerous for me" (07:04) | DONE | Answered in chat. | n/a |
| Q7 | Credits. | "Wait I'm running out of credits" (10:24); "I have 1% of tokens left" (22:04) | DONE | Pause + resume notes (893a489). | NT |
| Q8 | Untested on a real iPhone: Say it, voice, camera white balance. | (HO) | NOT STARTED | HO. | HO |

---

## Top 25 open items

Ranked by how often David asked, and how strongly (a swear, "wtf", "important", "I hate", or a repeated ask).

| Rank | Item | Why it ranks | Asks | Status | Size |
|---|---|---|---|---|---|
| 1 | Learning beyond the 101: stages to 1,000 as the path (L5, L8, S9) | He said it in 6 messages and in the NT top line. | 12:16, 12:22, 12:37, 12:41, 12:47, NT | NOT STARTED | M-L |
| 2 | The mixed Duolingo-style Journey (L3, L4) | 4 asks plus a "boring" complaint. J is ready for a build. | 10:50, 19:42, 19:44, 08:47 | NOT STARTED | L |
| 3 | Odd-one-out family and its combinations, with nuanced progression and a standalone practice (T3-T6) | 5 asks; his sister is hooked. | 10:42, 10:50, 19:44, 22:47 | NOT STARTED | M each |
| 4 | Rich page for every color, never empty (C1, C2) | Asked in 5 messages. WT is 30% done. | 16:40, 21:26, 20:14, 08:47 | PARTIAL | M-L |
| 5 | Painter and painting analysis shown in the app (A1, A2, E3) | "This is an important part of the app." Data is built, UI isn't. | 20:22, 08:47, 13:01 | PARTIAL | M |
| 6 | The palette engine and mosaic picker (St2-St5) | 4 asks, one very long and emphatic. | 13:07, 15:09, 17:52 | NOT STARTED | M-L |
| 7 | Whole-app design rebuild to DS (D3-D6) | "wtf" and "improve every aspect". | 11:31, 19:31, 08:47 | PARTIAL | L, batched |
| 8 | Image analysis and cross-matching with flowers, gems, fashion (A7, A8) | 3 asks. | 13:01, 13:07 | NOT STARTED | M + S-M |
| 9 | Mix lab with a prediction game (St6) | One detailed ask. | 15:13 | NOT STARTED | M |
| 10 | Own flashcard decks (F1) plus the voice extras (F3, F4) | Four messages in one hour. | 19:37, 19:40, 19:41 | NOT STARTED | M |
| 11 | Fields: ask what the user applies color to (L7) | A long, emphatic ask. | 12:22 | NOT STARTED | M |
| 12 | Every shade to ~9,000 on Home (H11, M5, M11) | 5 messages; he then said "hold until sources". Sources are in. | 16:12-16:38, 18:00 | PARTIAL | M |
| 13 | Merge Maerz & Paul after OCR cleanup (M9) | 6 messages; 825 chips waiting. | 18:01-19:12 | PARTIAL | M |
| 14 | World percentile score (T7, Bz4) | One ask; needs a backend. | 15:56 | PARTIAL | M |
| 15 | Practice merge (F6) | 85% done and in a worktree. | NT | PARTIAL | S |
| 16 | The film strip and the director archive (FA1, FA2) | Asked twice; "when we have more credits". | 20:36, NT | NOT STARTED | L |
| 17 | Photo missions: "spotted teal today" (T9) | Liked on 11:30. | 11:30 | NOT STARTED | S-M |
| 18 | Art wiki: painter/movement pages (E3) | CP C and PV KEEP. | 20:22 | NOT STARTED | M |
| 19 | Color mind profile and adaptive coach (L13) | Top of his "do next" list. | 08:41 | NOT STARTED | M |
| 20 | Motion, sound, haptics moments pass (D16) | Approved; asked for "smoother" 10-08. | 11:30, 08:47 | PARTIAL | M |
| 21 | Affiliate shop / print on demand (Bz2) | Sister's idea. | 19:40 | NOT STARTED | M |
| 22 | Confirm the Home fixes on his phone: tap opens, View buttons, check-in (H8, H9, Q4) | He reported the bug 4 times. | 21:24, 22:08, 22:15, 22:38 | PARTIAL | S |
| 23 | Studio critique, mockups, exports (St8) | Approved. | 11:30 | NOT STARTED | M |
| 24 | Aesthetics Wiki lessons (S11) and the Wada / Donahue decisions (B6, Bz6) | Asked once each; still undecided in the repo. | 09:17, 08:53 | NOT STARTED | S |
| 25 | Core-names quality pass and the "brighter" fix (M12, C16) | Quality debts. | NT | NOT STARTED | S |

---

## Appendix: messages with no request

"hi", "go", "Sup", "continue", "Yes", "sure", "tldr", "i'm confused", "Tbh I can't decide maybe 1", "Look around how?", "in my downloads" and similar short replies are answers to Claude's questions. The ledger counts them only through the rows they confirm (D18, L6).
