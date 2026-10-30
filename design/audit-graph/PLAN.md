# The seeing audit, v2: measure first, invent last (2026-10-08)

A plan for the agent graph, not the ideas. Read-only on the app, so it can run while another session builds.

## 1. My verdict on v1 (the 19-agent graph)

v1 was a machine for more ideas, and ColorHub doesn't lack ideas. The requests ledger holds 230 rows with 88 unfinished, and five idea documents were written today alone. A panel's output is a document, and documents don't ship. That is why big panels "end up being nothing."

What v1 got right was the evidence layer. Ten minutes of looking at real data tonight found two things none of the four idea rounds caught:
- **A dead feature.** The "Its story lives with…" fallback for colors without an article has shown nothing on any color since the archive rebuild: `tools/analyze.py:1197` wipes `data/analysis/`, which deletes `articles-lite.json`.
- **A coverage gap.** 1,089 of the 2,037 colors were never queued for an article (247 described shades, plus ~840 with real sources: Ridgway 1912, pigments, people).

Other problems with v1:
- **Ten lenses overlap**, and lenses 6 to 10 add little over 1 to 5.
- **The novelty gate rewarded newness**, when the goal is impact.
- **It had no stop rule.** It was all-or-nothing spend.
- **It ended in a verdict file**, not in something David can see or decide on.

## 2. v2: each stage must earn the next

| Stage | What | Cost | Output |
|---|---|---|---|
| 1. Atlas | A script, `tools/atlas.js`, that measures the app as a graph: features that silently fail (missing data files, empty fallbacks); data computed but never shown; Learner Model signals written but never read; coverage holes (colors without an article, a picture or a painting; pages without states); screens with no way onward. | No agents; Claude writes the script | A ranked defect list with `file:line`, rerunnable forever. It joins smoke as a ratchet, so the numbers can only improve. |
| 2. Almosts | The 88 unfinished ledger items, ranked by closeness to done × how much seeing they add (David's rule: "almost good ideas are the biggest wins"). | One Sonnet agent, or a script | The top 15 almosts |
| **Checkpoint** | David reads one page: measured defects plus top almosts. | 2 minutes | **Stop here if that's enough.** It probably is for a week of lanes. |
| 3. Aimed invention | Only if earned. 2 to 3 Opus agents, each aimed where stage 1 shows the biggest hole (not pre-chosen lenses), plus one wildcard on far analogies (sommelier palate training, birding life lists, Shazam). Each returns at most 5 bets, with a mockup sketch and the evidence it answers. | 3 to 4 agents | At most 15 bets |
| 4. Court | One skeptic: a pre-mortem plus hits / almost / misses for every bet. | 1 Sonnet agent | At most 5 survivors; David picks; winners become lane briefs |

Most agents ever: about 5, against 19 in v1. Stages 1 and 2 cost almost nothing, and they decide whether stage 3 happens at all.

## 3. Guardrails
- Read-only on the app: no code edits, no `index.html`, no pushes. Outputs go only in `design/audit-graph/`. The atlas script is the one new file, under `tools/`, and the build session merges it.
- Respect the never-do list (REQUESTS-LEDGER 0B), the myths and naming rules in CLAUDE.md, and the book rule.
- Success is set in advance. Stage 1 must find at least 15 concrete, fixable defects that aren't already in the ledger. If it finds fewer, the app is healthier than it looks, invention really is the bottleneck, and stage 3 earns its spend.

## 4. Build notes found along the way (for the build session, not this one)
- **Sounds:** a tap on a color page's field-note drawers ("In paintings", "Its company"…) plays the generic `tap` (`js/sound.js:200`): a sine sweeping 560 to 820 Hz in 18 ms plus a 3.2 kHz noise click. That sweep and the click are the sharp thump. Fix: muffle the whole UI layer (lower pitch, slower attack, lowpass around 1–1.5 kHz, no click) and give `<summary>` taps their own very quiet breath.
- **Colors without an article:** restore `articles-lite.json` (`python3 tools/build_articles_lite.py`); make `tools/analyze.py` delete only its own outputs; add a check that fails if the file is missing. Then grow `rpTwinHTML` (`js/richpage.js`) from one twin within ΔE 10 into the 3 nearest stories, each one tap away.
- **Articles open with a picture** (David): `arDoorHTML` only shows a figure when the color page passes `fig`. Pick a lead image for every article: its own image, else its closest painting, gem or flower.
- **A second article wave** for the ~840 sourced colors that were never queued; size it before running.
