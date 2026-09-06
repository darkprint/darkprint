
// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-94) (cited at line 51): n/a — external CLI over git
/* ============================================================
   The blueprint-writing skill, as one string.
   ------------------------------------------------------------
   The skill lives in this repository and the skills CLI reads it over git, so there is
   nothing hosted, nothing to zip and no version to keep in step with a download. What a
   reader needs from the site is therefore one line of text, and that line is printed on
   four surfaces: the landing's band (`components/hero/SetupChips.tsx`, where it is one of
   two commands), a draft bundle's empty-repo panel (`components/bundle/DraftLanding.tsx`),
   `/capabilities`' skill section (`app/capabilities/page.tsx`), and `/skill` itself through
   `components/skill/SkillSetup.tsx`, which is the only one that explains anything.

   A fifth stood in that list until 2026-09-06: `/build`'s second exit, at
   `components/build/AgentHandoff.tsx`, which printed the command beside the agent brief it
   was the durable form of. The owner deleted the route and its component tree that day
   ("it is not useful and make confusion"), so the exit, its brief and its copy of this
   line are all gone. The four above are what a grep for the export returns today. The
   sentence this replaces said "six" and then named five, and which sixth surface it meant
   could not be recovered, so the number here is a count taken rather than one carried
   forward. Take it again before trusting it.

   Six hand-typed copies of a command a reader retypes into a terminal is the shape that
   drifts the day the repository moves, and the failure is silent: a wrong command produces
   an error in somebody else's shell, never a red test here. So it is written once.

   ── The command does not run today, and every one of the six says so ──
   `api.github.com/repos/Brotherhood94/darkprint` answers 404 unauthenticated (measured
   2026-09-02 and again 2026-09-05), because this repository is private. The skills CLI
   reads it over git by name, so the one line this module exists to publish fails for every
   reader except its owner. The owner ruled on 2026-09-05 that the repository stays private
   and the command stays printed, qualified wherever it renders (§11.0 Q8) — removing it
   was the alternative and was rejected, because a command that comes back needs the six
   surfaces rewritten from nothing.

   **The qualification is one block per surface, and each carries a comment naming this
   paragraph.** The day the repository goes public, delete those six blocks and nothing
   else: no copy above them was softened to make room, and no claim about what the DarkPrint
   skill DOES was changed. It is written, it is not unfinished, and what is missing is read
   access to the repository holding it. A qualification that says otherwise replaces one
   false claim with a different one.

   The prose is per surface rather than one exported constant, deliberately: a band cell has
   room for six words and `/skill` has room for three sentences, and the site already writes
   the npm-package limit per surface for the same reason (`/capabilities`, `CloneMenu`,
   `DraftLanding`). What is single-sourced is the COMMAND, which is the string that fails
   silently when it drifts. `components/skill/SkillSetup.test.ts` holds each surface's own
   wording, in the shape `components/site/honesty.test.ts` uses for a ledger row.

   ── The word `skill` is already taken on this site ──
   `lib/core/card/schema.ts` defines `skill?: string` as a per-node behaviour document
   ("such as `skills/planner.md`"), and `/what-a-blueprint-is#the-words` prints, in the
   open, that the engine reads nothing at the other end of that path. That skill sits one
   level BELOW the graph: it hands one agent a capability, while the blueprint decides who
   is wired to whom. This one inverts that, because it WRITES the graph.

   Never print "the skill" unqualified on any surface. "The DarkPrint skill" or "the
   blueprint-writing skill", both of which a reader can tell from a card's `skill:` field
   at a glance, and `/skill` spends one sentence saying so outright.

   ── What it emits, and the two things it deliberately does not ──
   The registry shape: `topology.dot`, one YAML card per node, and `README.md`. NOT
   `factory.dot`: that file used to be compiled out of the other two by
   `lib/content/bundle-export.ts` on the way out of DarkPrint, and a skill that emitted its
   own copy of the Attractor emit rules would be free to drift from the exporter the day
   either changed. `factory.dot` no longer exists anywhere in a published bundle either
   (owner instruction, 2026-08-25), so the two folder shapes agree on this file's absence
   now, not only on why the skill never wrote it. NOT `AGENTS.md` either, by the same
   instruction and for the same day: the skill wrote one until this pass, and a published
   bundle carried one until this pass, and both stopped in the same commit.

   ── What no test here can hold ──
   Everything else the site claims about an artefact is checked against the artefact:
   `workspace.test.ts` walks all eighty bundles, `honesty.test.ts` renders the real pages.
   The skill's behaviour is read by an external CLI out of git, so nothing in
   `npx tsc --noEmit` or the suite fails on the day its output stops matching what these
   two routes say it writes. That is a standing cost of shipping it, not an oversight, and
   it is the reason both surfaces describe the output in the fewest words that are true.
   ============================================================ */

/**
 * The command a reader types, exactly as it must be typed.
 *
 * No `$` prompt in the value: the prompt is a rendering convention of whichever surface
 * prints it, and a `$` that reaches the clipboard is a command that fails.
 */
export const SKILL_INSTALL_COMMAND = "npx skills@latest add Brotherhood94/darkprint";

/**
 * Where the command is explained.
 *
 * This read `/install`, and the comment here argued for it: one "set your agent up"
 * destination, already linked from both surfaces printing the command, and a route of its
 * own would cost a tenth header row a week after the IA pass took the header down to nine.
 *
 * The author overruled it on 2026-08-07 — "I prefer two pages, one for the skill and one
 * for the mcp" — and the header row is the price, knowingly paid. What the old argument
 * missed is that the landing now names the two halves separately and sends a reader at
 * one of them by name: the hero prints "Design your blueprint" over this command and
 * "Connect via MCP" over the other. A chip that promises one half and opens a page that is
 * half something else spends the reader's click on navigation they did not ask for. Two
 * destinations, two chips, and neither page has to hedge about the other.
 */
export const SKILL_ROUTE = "/skill";
