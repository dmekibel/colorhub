# Study the map 2 (2026-10-08)

David: "One of the most genius features in Train is Study the map. Improve it tenfold. 'Name it': most are too hard.
'Path' doesn't make sense. The levels are split linearly; a slider could be more subtle, more gradual."

## 1. Honest audit of v1

| Mode | What it asks | Why it hurts | Verdict |
|---|---|---|---|
| Find it | "Find celadon": tap it on a board of 4 / 6 / 10 bubbles, then the whole map | The core skill, and it works. But 10 bubbles to the whole map (hundreds) is a cliff, and a miss on the whole map is a flat "wrong": no warmer/colder, no path that teaches. | **Keep, rebuild the curve**: more steps, a hint before a reveal, a reveal path that names the colors in between. |
| Name it | One bubble breathes; pick its name from 4 or 6, then type it | Wrong options come from the top 614 names even at level 10, so you're asked to tell celadon from eau de nil when you've never seen either. From breath 2 it's free typing of names you may never have met. The bubble sits alone, with no context. | **Fix**: options only from the field you're studying (names you can know), 3 options to start, the neighbors' names showing as landmarks, typing only at the very top of help. |
| Neighborhood | A ringed corner with its names hidden; tap each one and name it | Good idea, but the naming is just as over-hard, and "Reveal all" ends it with nothing in between. | **Keep, make it a matching game**: the names offered are exactly the ring's own names; typing only at the top. |
| Path | Walk from one color to another, one map neighbor at a time | The honeycomb's neighbors come from how the layout packs, not from how we see. "The shortest path" is a puzzle about the packing, not about color, and nobody can tell why a step is right. | **Cut.** Its best part (the words between two colors) moves into Find it's reveal path. |
| Light up 5 | Five new colors placed daily, then found from memory | Clear, daily and honest. | **Keep** as "Today's five". |
| Levels 10 / 25 / 50 / 100 / 250 / 614 / all | The field | Seven chips with big jumps (250 to 614 is a different game). | **Replace** with a gradual "How many colors" slider (19 stops, from 10 to every name). |
| Easy / Medium / Hard / Expert / Edge | The board-size band | Five words that mean little, and a second idea of difficulty next to levels. | **Replace** with one "How much help" slider (7 stops, from 3 to pick from up to the whole field), adapted for you under For you. |

## 2. Brainstorm (36 ideas)
1. One continuous field slider (how many colors).
2. One help slider (how many bubbles are candidates).
3. For you moves the help slider for you: a staircase (two right in a row step up, a miss steps down).
4. The field grows when 90% of it is found ("Grow the map to 40").
5. Warmer/colder: a first miss on a big board doesn't fail. It lights the answer's neighborhood and says which way to go.
6. A second miss reveals.
7. Reveal path: from your tap to the answer, naming the colors in between.
8. Colors you've already found keep their names on the map as landmarks (a scaffold that grows into memory).
9. Multiple choice before free recall, always.
10. Name it with the neighbors' names showing (context).
11. Name it options only from the field.
12. Typing only at the top of the help slider.
13. Wander: a calm mode with every name on. Tap to hear a color's note and read how it differs from the last one. No score.
14. Color notes (js/sound.js) on every tap, and a "right" that climbs with the streak.
15. 10-round sessions, about 60 to 90 seconds.
16. A streak line from 3 in a row.
17. The end screen lights up every color found so far in this field.
18. "Study this painting on the map" (the painting set) stays.
19. Due, mix-ups and favorites sets stay.
20. Families as neighborhoods.
21. A daily seeded challenge (the same 10 for everyone). Later.
22. A heat map of misses. Later.
23. "Where teal lives" said as a region ("between blue-green and slate").
24. Ghost labels that fade over three sessions (folded into 8).
25. The fog of the unmet (kept, opt-in).
26. A speed bonus. Rejected: it rushes perception.
27. Lives. Rejected: punishing.
28. A timer. Rejected: not calm.
29. Path cut.
30. A compass arrow toward the answer. Rejected: it becomes a pointer game, not memory.
31. A zoom hint that frames a smaller area (part of 5).
32. Hearing the target's note before you search. Later.
33. Test out at the whole field (3 rounds).
34. The field's found count on the Train tile.
35. Misses come back later in the session.
36. A shareable result line. Later.

## 3. Chosen design
- **Modes**: Find it, Name it, Neighborhood, Today's five, and **Wander** (no score). Path is gone.
- **Two ways in** (CLAUDE.md): **For you** (the default) adapts *help* per field with a staircase, and offers to grow the field once 90% of it is found. **Choose** shows two sliders with live descriptions. *How many colors*: 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 200, 250, 300, 400, 500, 614 or every name. *How much help*: 3, 4, 6, 8, 12 or 20 to pick from, or the whole field. Test out sits here too.
- **Find it**: from 12 to pick from upward, a first miss counts as *warmer*. The answer's neighbors light up, the map glides there, and the words say which way to go ("lighter and bluer than yours"). Finding it on the second tap counts as "next door" (half credit, not a first-try right). A second miss reveals the answer, and the reveal path names up to four colors between your tap and it.
- **Name it**: options come from the field (same family first): 3 at the most help, then 4, then 6. Typing only at the whole-field stop. The neighbors' names show as landmarks while you choose.
- **Landmarks**: colors you've already found in this field keep their names during Find it from 12 to pick from upward, so the map becomes a growing memory, not a blank.
- **Sound**: sfx right / near / wrong / combo / complete / settle, and each tapped bubble's own color note.
- **End screen**: stars, n of N on the first try, the field's found count, and the map zoomed out with every color found so far in this field ringed and named: the area you've conquered. Plus For you's next step ("Grow the map to 40").
