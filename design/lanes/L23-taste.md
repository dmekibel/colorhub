# L23: Taste and favorites (David, 2026-10-08)

David: "I want the app to have a better system to figure out your preferences. Maybe use the honeycomb feature of the home screen to quickly select multiple colors to save as your favorites. Then, once they're in your favorites, you can sort them as more or less favorite using different systems, not just tournament style, which is boring."

## Build
1. **Select mode on Home.** A "Pick favorites" mode from Home's chrome. Tap bubbles to heart them (they glow and get a small mark); drag across bubbles to select a run. The honeycomb keeps panning and zooming. A floating counter reads "12 picked · Save". Selections log `like` events in js/learner.js (if it's on main) and land in S.favs (via a migrateState step).
2. **Favorites shelf:** its own page (`#/favorites`), reachable from the You area and Studio. It shows a honeycomb of your favorites, plus the verbs from colorset.js (on the map, learn, play, palette, share).
3. **Ranking without tournaments.** Offer several quick, fun ways to rank; each one updates a single preference score per color (Bradley-Terry or Elo underneath):
   - **Best of three:** keep one and drop one from each set of 3, so a set of 3 gives two comparisons (best-worst scaling, the most efficient method).
   - **Tier board:** drag chips into tiers (Love / Like / Fine).
   - **Swipe stack:** quick yes/no, like or skip.
   - **Budget:** spend 10 drops of paint across your favorites.
   - **Drag to order:** for small sets (≤ 12).
   - **Context rounds:** "for a room / to wear / to paint with / for a logo". This gives a preference per context, because people's color taste depends on what it's for.
   Adaptive: pick the next comparisons that most reduce uncertainty; stop when the order is stable; show "confidence".
4. **Your taste profile.** Plain findings with honest n:
   - "You lean muted and cool: 70% of your loves are below the median chroma."
   - Your top families, and how your taste changes by context.
   - **The painter whose palette matches your loves** (via data/analysis artists), plus the painting.
   - A palette built from your top 5 (Studio).
   Reuse and replace the old js/taste.js where it overlaps, keeping its useful parts and its equal-count rule.
5. **Connections:**
   - Explore's For you weights by taste.
   - Practice gets a "Learn my favorites" deck.
   - Color pages show a ♥ and your rank.
   - The Cabinet's favorites shelf.
   - Share card: "My colors".

Tests: the ranking math converges, and best-of-three yields the right comparisons. Screenshot the select mode, the shelf, each ranking method and the profile at 375×812.
