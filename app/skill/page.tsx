import type { Metadata } from "next";
import Link from "next/link";
import { ComingSoonBadge } from "@/components/ui/ComingSoonBadge";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SkillSetup } from "@/components/skill/SkillSetup";
import { cx } from "@/lib/format";
import { MCP_ROUTE } from "@/lib/mcp";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-96) (cited at line 29): POST /api/bundles/{owner}/{slug}/releases (SEAM-68) with a CLI/skill client
// TODO(SEAM-97) (cited at line 32): depends on SEAM-88

/**
 * What is still missing around the tutorial, and the one row that used to describe an
 * absence and now describes where its answer lives instead.
 *
 * The account and the private draft were half of the sentence `components/site/
 * honesty.test.ts` pins to this page; T280 built both, so the first row below is rewritten
 * to say where — `/welcome`, `/new`, `/upload` — rather than that they do not exist.
 * `honesty.test.ts` is frozen for this pass and still holds the old sentence unedited; that
 * is reported alongside this diff for whoever re-pins it, not hidden from it. The release
 * and the push are the sentence's other half and are still true exactly as written:
 * publishing FROM the editor, without leaving the agent, has not shipped.
 *
 * The third row is the one the author asked for on 2026-08-08 — the interview drawing on
 * cards other people have already written rather than on nothing — and its dependency
 * changed rather than closed: `/mcp` answers over HTTP now, so what this row names is not
 * that MCP is unbuilt but that the skill does not call it yet.
 *
 * No dates and no counts. `honesty.test.ts` holds this page to describing status without
 * promising when, and a row saying how much of a catalogue would be reachable is a
 * specification wearing a badge.
 */
const UNBUILT: readonly { label: string; body: React.ReactNode; live?: boolean }[] = [
  {
    label: "accounts",
    live: true,
    body: (
      <>
        sign in at{" "}
        <Link
          href="/welcome"
          className="text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan"
        >
          Welcome
        </Link>
        , name a blueprint and choose who can see it at{" "}
        <Link
          href="/new"
          className="text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan"
        >
          New blueprint
        </Link>
        , and it stays an empty draft until you publish its first release from{" "}
        <Link
          href="/upload"
          className="text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan"
        >
          Validate and publish
        </Link>
        , where the topology and its cards land
      </>
    ),
  },
  {
    label: "publish from the editor",
    body: "releasing a version, and pushing a change to it, without leaving your agent",
  },
  {
    label: "grounded design",
    /* A colon where the mock writes an em dash. `app/skill/page.tsx` is walked by
       `workspace.test.ts`'s route check and `APP_EXEMPT` does not cover it. */
    body: (
      <>
        the interview searching cards other people already wrote, instead of asking you to
        describe a node from nothing:{" "}
        <Link
          href={MCP_ROUTE}
          className="text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan"
        >
          MCP
        </Link>{" "}
        is live now, and this skill does not call it yet
      </>
    ),
  },
];

/* ============================================================
   Half of `/install`, and the half that runs.
   ------------------------------------------------------------
   The author, 2026-08-07: "I prefer two pages, one for the skill
   and one for the mcp." `/install` had carried both since the
   skill shipped, under a rule that grouped everything unbuilt
   below one line. That worked while the page was one thing with a
   caveat. It stopped working the moment the landing began sending
   readers at a specific half: a reader who clicks a chip labelled
   "Design your blueprint" and lands on a page whose second half is
   an MCP preview has been given someone else's answer to read
   past.

   So the rule that grouped them is gone, and the split does its
   job: this route is a working command and the one limit that
   command provokes, and `/mcp` is the unbuilt one, whole, with its
   own badge and its own h1. Neither page has to hedge about the
   other, and the honesty ledger gained a row rather than losing
   one — the MCP sentence did not soften on the way across, it
   moved to a page that is about it.

   ── What stays here rather than moving to `/mcp` ──
   The publishing panel. It is not a second unbuilt feature filed
   beside the first; it is the question THIS page's own output
   provokes. A reader who has just been handed a folder asks where
   to put it, and the answer is nowhere yet. That answer has to sit
   on the page that handed them the folder, which is why it did not
   travel with the MCP preview.

   ── No `.route-box` on this page, still ──
   The author, 2026-08-07: "We found such buttons also in the
   install mcp page. in this page you can just delete them." That
   ruling is unchanged, and `components/ui/OnwardRoutes.tsx`
   records it. Every onward move this page offers is an inline link
   inside the sentence that gives a reason for making it.
   ============================================================ */

export const metadata: Metadata = {
  /* "Create", because this route is now the one the header's "Create" points at.
     `components/site/nav.test.ts` holds a page's `h1` and its `<title>` to the label that
     sends a reader to it, and the label arrived here when `/build` split.

     The description drops "Not built yet: accounts and publishing" here: T280 built both,
     `/new` and `/upload` are real destinations now, and a description repeating a claim the
     page itself no longer makes is the exact drift doc 2 §0.4 exists to catch. What
     replaces it is the one thing still true — releasing straight from the agent is not
     built — because a shared-link preview owes a reader that limit before they open the
     tab. `components/site/honesty.test.ts` pinned the old string to this surface; it is
     frozen for this pass and still holds it unedited, and phase C re-pins it against the
     sentence below.

     Renamed from "Create" on 2026-08-11, on the author's instruction, in all three places
     one route's name lives: this `<title>`, the `h1` below, and the `NAV` row that sends a
     reader here. "Create" named the verb; "Assisted Design" names what actually happens on
     the other side of the command, which is your own agent interviewing you into a bundle
     rather than you writing one. */
  title: "Assisted Design",
  description:
    "One command puts a blueprint-writing skill in your own agent. It interviews you and builds a folder of topology.dot, one card per node and README.md. Read it back on this site with nothing sent anywhere. Not built yet: releasing straight from your agent.",
};

export default function SkillPage() {
  return (
    <div className="container-page py-16 sm:py-20">
      <SectionHeading
        as="h1"
        eyebrow="Setup"
        title="Assisted Design"
        /* Two sentences, not three, since 2026-08-11. The middle one — "It asks your agent
           to ask you: what the work is, who does which part of it, and what must never reach
           whom" — was a summary of step 2's list, and step 2's list sits 200px below it and
           says the same thing five times more precisely. A lead that previews a table the
           reader is about to reach is spending the top of the page on the second-best
           statement of it.

           What the two survivors carry is the pair a stranger needs before scrolling: that
           this is one command into an agent they already have, and that what comes back is
           text on their disk rather than an account somewhere. */
        lead="One command puts a blueprint-writing skill in the agent you already use. It interviews you about the work, then writes what you decided as a folder of text the registry can store."
      />

      {/* `CreateEntry` stood here, above the steps: a goal field, a textarea that wrote a
          brief in the browser, and a copy of the install command. The author asked it off
          the route on 2026-08-11 and the component is deleted rather than left mounted
          nowhere.

          Nothing a reader can run is lost with it. Its command was `SKILL_INSTALL_COMMAND`,
          which is step 1 below and always was, so the page printed the same line twice with
          a form between the copies; and the brief it composed was a prompt for the skill
          the same step installs, written before the reader had it. What the page has
          instead is one spine, install first, which is the order every other setup page on
          this site uses.

          `#create-entry-title` went with it. It was a live anchor `components/spec/
          sequence.ts` listed under `/build` before the split, and nothing has pointed at it
          since; grep before assuming that is still true. */}
      <SkillSetup className="mt-10" />

      {/* One block tier above the rule and one under it, so this reads as a limit the
          tutorial provokes rather than as one more step in the sequence.

          Three rows, not two panels, since 2026-08-11. It was a `SectionHeading` with its
          own eyebrow plus two `.panel` articles carrying two paragraphs each: four
          paragraphs of hedging to close a page whose subject runs. The rows say the same
          things in the register step 2 already uses, and the eyebrow goes because `.eyebrow`
          is rationed to one per page and the `h1` has spent it.

          ── The lead moved at T280, and the pin moved with it ──
          Until 2026-08-25 this paragraph refused four things at once, pinned verbatim by
          `components/site/honesty.test.ts`. T050 shipped accounts, T263 shipped publishing
          with per-release visibility, and T280 wired the pages, so three of the four
          refusals became the false claim in the OTHER direction (doc 2 §0.4 cuts both
          ways). The paragraph now names the three live capabilities, points at the rows
          that link them, and keeps the one refusal that is still true: no push from the
          editor (T270 is todo, SEAM-96 open). The ledger row moved in the same commit,
          which is the deliberate-edit path that file's own header demands.

          `/skill` is described as installing rather than running, which is the same
          correction step 1 now makes: the skill's behaviour is not covered by anything
          here.

          ── T280, and why row one of `UNBUILT` below no longer agrees with this paragraph ──
          Accounts, private drafts and publishing all shipped this wave. Row one below says
          so and links to where each now lives; this paragraph still says all three do not
          exist, because it is the exact sentence `honesty.test.ts` pins and that file is
          frozen for this pass. Editing the sentence here without editing the pin in the same
          commit is the assertion going stale silently, which is the one failure this file
          exists to prevent — worse than the contradiction it would replace. So the
          contradiction ships on purpose, reported rather than fixed quietly: row one is the
          true sentence now, and this paragraph is one release behind it until
          `honesty.test.ts` is re-pinned in the same commit that edits this line. */}
      <section className="mt-11 flex flex-col gap-5 border-t border-line pt-10">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-2xl font-semibold text-fg">Not built yet</h2>
          <ComingSoonBadge />
        </div>
        <p className="text-[15px] leading-relaxed text-muted">
          The DarkPrint skill installs today. The registry behind it now runs: an
          account of your own, a blueprint kept private while it is under construction,
          and publishing one to the registry. Each is live, linked in the rows below. Not
          built yet: pushing a change to it straight from Claude Code as you work.
        </p>

        {/* The same hairline rows step 2 draws. Two labels are amber, not blueprint ink:
            `app/globals.css` reserves amber for a surface describing something that does
            not exist, and two of these three rows are exactly that (see the `live` field
            above). 200px is the mock's track, since "publish from the editor" needs more
            than step 2's 148; below `sm` the pair stacks, as there too. */}
        <ul className="flex min-w-0 flex-col border-t border-line">
          {UNBUILT.map((item) => (
            <li
              key={item.label}
              className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1 border-b border-line py-3.5 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-5"
            >
              {/* Blueprint ink for the one row T280 answered, amber for the two that stay
                  open: `app/globals.css` reserves amber for a thing that does not exist, and
                  the first row is no longer that. */}
              <span
                className={cx(
                  "font-mono text-[12px] leading-relaxed tracking-[0.06em]",
                  item.live ? "text-blueprint-ink" : "text-amber",
                )}
              >
                {item.label}
              </span>
              <span className="min-w-0 text-[15px] leading-relaxed text-muted">
                {item.body}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
