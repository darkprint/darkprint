
// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-94) (cited at line 51): n/a — external CLI over git
/* ============================================================
   The blueprint-writing skill, as one string.
   ------------------------------------------------------------
   The skill lives in this repository and the skills CLI reads it over git, so there is
   nothing hosted, nothing to zip and no version to keep in step with a download. What a
   reader needs from the site is therefore one line of text, and that line is printed on
   three routes: the landing's hero chip (`components/hero/Wordmark.tsx`, where it is one
   of two commands and the only one that runs), `/build`'s second exit
   (`components/build/AgentHandoff.tsx`, beside the brief it is the durable form of) and
   `/skill`, which is the only one of the three that explains anything.

   Three hand-typed copies of a command a reader retypes into a terminal is the shape that
   drifts the day the repository moves, and the failure is silent: a wrong command produces
   an error in somebody else's shell, never a red test here. So it is written once.

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
