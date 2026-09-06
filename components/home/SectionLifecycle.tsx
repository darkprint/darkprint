import Image from "next/image";
import Link from "next/link";

import { SectionHeading } from "@/components/ui/SectionHeading";
import { ARCHIVE_OWNER, blueprintHref } from "@/lib/href";

/* ============================================================
   The landing's ending: five things the registry does, each one a way in.

   ── The page used to end twice ──
   This section sat immediately above `SectionDoors`, which asked "find a blueprint, or
   create one" with two buttons — and both of those destinations were already here, among
   five, with a sentence and a picture each. Seven calls to action closed the page, and two
   of them restated a choice the reader had just been offered.

   One of the two had to go. The links came off these panels first; the author reversed
   that and cut the doors instead: "remove the section Start with the job in front of you
   and substitute it with the content of One registry, two loops, adding a link to the
   correct section to each panel." That is the better half to keep. The doors offered two
   ways in; this offers five, each with the picture and the sentence that say what it is —
   and Learn, Use and Publish are three doors the two-card band never had.

   So the links are back and the section is the ending. `SectionDoors` is deleted.

   ── What each panel points at, and why it is that route ──
   Every href here is a real page and the label names it the way its own header does. Two
   are worth knowing: Create points at `/skill`, not `/build`, because the sentence beside
   it promises the interview and the interview is the authoring skill; and Use points at
   the starter's release section rather than at the shelf, because "take exact plain files"
   is a thing you do to one bundle.

   ── The pair at the foot stays ──
   The human-interface / agent-interface line is the one thing here that no panel says: the
   same registry answers a person through the website and an agent through MCP, with the
   same provenance and the same version pins. Its rule went with the heading block, not the
   pair: five bordered cards against two lines of prose are already two different things.

   ── What the section stopped saying about itself ──
   An eyebrow, a title and a two-line lead stood over the grid and all three are gone, on
   the 2026-08-11 hand-off. They said the same thing three times in three registers: the
   eyebrow named the two loops, the title named them again as a sentence, and the lead
   promised that both end on the same artifact — which is the landing's own argument and is
   made three beats earlier by the beat about what a blueprint pins.

   One `h2` replaces them, and it is a question rather than a claim: the five panels are the
   answer, so the heading only has to ask. `.eyebrow` is rationed to one per page and the
   hero has spent it, which is the same reason beat 2 and beat 3 gave theirs up.

   One thing genuinely went with the eyebrow rather than moving. `beats.test.ts` recorded
   that `SectionDoors`' deleted case was safe because "the two loops are named by the section
   above, whose eyebrow still reads One registry, two loops". No string on this page says
   `two loops` now. What names them is the grid itself — Find and Create are two of the five,
   each with a picture, a sentence and a link — and the pair at the foot, which says the two
   INTERFACES. That note is rewritten where it lives rather than left describing a string
   that is gone.
   ============================================================ */

/**
 * The five stages, and the one sentence each of them gets.
 *
 * ── The sentences were rewritten to be parallel, 2026-08-11 ──
 * They had drifted into five different grammars. Three were instructions in the imperative
 * ("Search by task…", "Take exact plain files…", "Validate a bundle and…"), one was an
 * invitation ("See how graphs, cards…"), and one was a description with the mechanism in it
 * ("…with the authoring skill"). Five panels in a row read as one list, and a list whose
 * items are not the same part of speech reads as five unrelated notes.
 *
 * Each is now what the stage IS rather than what a reader should do about it, one idea per
 * sentence, because the link under each panel is already the instruction and saying it twice
 * puts the verb in the weaker of the two places. Hrefs, labels, titles and images are
 * untouched; only `text` moved.
 */
const ACTIONS = [
  {
    index: "00",
    href: "/what-a-blueprint-is",
    label: "What a blueprint is",
    title: "Learn",
    text: "A blueprint is a graph, a card per node, and one vocabulary they are all written in.",
    image: "/home/lifecycle/learn.webp",
  },
  {
    index: "01",
    href: "/blueprints",
    label: "Search blueprints",
    title: "Find",
    /* "…narrow by shape, checkpoints, tools, and evidence" until 2026-09-04. Evidence was
       the last word and the one that had stopped meaning anything: the panel it named came
       off the blueprint page with the scoring feature, and `GalleryBrowser`'s filter bar
       never carried a facet by that name in the first place. Shape, checkpoints and tools
       were loose in the same direction, so all four are replaced by three controls that are
       really on `/blueprints`: category, phase covered, and the tag chips.

       Three of the bar's five, not all of them. The other two are the fork stance and the
       autonomy class, and neither belongs in a one-line beat about finding work: the fork
       control is a display choice rather than a way to narrow, and putting a class name on
       the landing would teach the vocabulary of a reading a reader has not met yet. Naming
       fewer controls than exist is a short sentence. Naming one that does not exist is the
       defect this row had. */
    text: "Search the registry by task, then narrow by category, phase and tag.",
    image: "/home/lifecycle/find.webp",
  },
  {
    index: "02",
    href: "/skill",
    label: "Assisted Design",
    title: "Create",
    text: "An interview turns your goal into a typed graph and a version-pinned card per node.",
    image: "/home/lifecycle/create.webp",
  },
  {
    index: "03",
    /* `#use-this-blueprint` until 2026-09-04. That anchor was the `Exact release` panel, and
       the owner asked it off the blueprint page in the pass that made that page read like a
       repository. Its download did not go with it: it moved into the file list's header as a
       `Code` control, so `#files` is where this beat's own sentence now lands. Repointed rather
       than left to ride a scroll to nowhere, which is what a fragment with no element does. */
    href: `${blueprintHref(ARCHIVE_OWNER, "starter-software-factory")}#files`,
    label: "Take the starter",
    title: "Use",
    text: "Plain files you can read. Download a release, adapt it and run it in your own harness.",
    image: "/home/lifecycle/use.webp",
  },
  {
    index: "04",
    href: "/upload",
    label: "Validate and publish",
    title: "Publish",
    text: "Validation checks the bundle, then one exact version goes back for others to fetch.",
    image: "/home/lifecycle/publish.webp",
  },
] as const;

export function SectionLifecycle() {
  return (
    <section
      id="lifecycle"
      className="relative scroll-mt-24 overflow-hidden border-t border-line bg-void py-20 sm:py-28"
    >
      {/* The drafting sheet, under the section that names both loops.
          ------------------------------------------------------------
          `.bp-grid` and not `.tech-grid`, on the author's instruction: the two graticules
          are not interchangeable. `tech-grid` is one 48px cyan rule and it means *technical
          surface*; `bp-grid` is the blueprint's own paper, a 96px major over a 16px minor in
          `--color-blueprint-line`, and it is what `ContentCard`, `Sheet` and every figure
          under `components/explain` draw a blueprint on. This section is the one that says
          what a blueprint is for, so it stands on the paper the rest of the site draws them
          on rather than on a generic technical ground.

          The mask is the Hero's, turned inside out. There it closes an ellipse around the
          wordmark; here it fades top and bottom so the ruling arrives out of the border
          above and leaves before the footer, which is what keeps a full-bleed graticule from
          reading as a texture swatch with two hard edges.

          ── The ground under it is blueprint, not void ──
          `.bp-grid` rules in `--color-blueprint-line` at 12% and 5%, and 12% of a light blue
          over `--color-void` is a grey whisper: the graticule was there and read as dust.
          Every other surface that draws it puts a cyanotype ground underneath first —
          `ContentCard` uses `bg-blueprint-deep/40`, `RunSystemMap` and `RunLayers` use /60 —
          because the paper is what makes the ruling blue. It was mounted here over the void
          and inherited none of that, so the ground comes with it now, on the author's word
          that this band should read blue. Same wash `ContentCard` uses, under the same mask,
          so the section fades up out of the border above it into a sheet and back down
          before the footer rather than switching colour at an edge. */}
      <div
        aria-hidden
        className="bp-grid pointer-events-none absolute inset-0 bg-blueprint-deep/40"
        style={{
          maskImage: "linear-gradient(to bottom, transparent, black 18%, black 82%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent, black 18%, black 82%, transparent)",
        }}
      />

      <div className="container-page relative">
        {/* One `h2`, where there were an eyebrow, a title and a two-line lead.
            ------------------------------------------------------------
            A subtraction rather than a rewrite: the five panels, their images, their links
            and the pair at the foot are untouched, and the heading block that stood over
            them is one line the author picked from five candidates.

            What the three lost strings were doing, and where it went:

              · the eyebrow `One registry, two loops` named the two halves. The panels name
                them better — Find and Create are two of the five, with a picture and a
                sentence each — and `.eyebrow` is rationed to one per page, which the hero
                has spent. `beats.test.ts` carries a note that leaned on this eyebrow; it is
                rewritten there rather than left describing a string that is gone.
              · the title `Find and reuse, or create and publish` was those same two halves
                again, in sentence form, immediately under the eyebrow saying them.
              · the lead promised "the same thing" at the end of both paths, which is the
                landing's own argument and is made three beats earlier, at length, by the
                beat about what a blueprint pins.

            "What the registry is for" is the question the five panels answer, so the heading
            asks it and stops. `SectionHeading` with a `title` and nothing else rather than a
            bare `<h2>`: the component owns the display step, and 32px at `sm` is what the
            mock draws. The 40px under it is the grid's own `mt-10`. */}
        <SectionHeading title="What the registry is for" />

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {ACTIONS.map((action) => (
            <article key={action.index} className="panel group flex min-w-0 flex-col overflow-hidden">
              <div className="relative aspect-[3/2] overflow-hidden border-b border-line bg-blueprint-deep">
                <Image
                  src={action.image}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 220px, (min-width: 768px) 50vw, 100vw"
                  className="object-cover transition-[transform,filter] duration-[420ms] ease-[cubic-bezier(0.23,1,0.32,1)] hoverable:group-hover:scale-[1.035] hoverable:group-hover:brightness-110"
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface/80 via-transparent to-transparent"
                />
              </div>
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-cyan">{action.index}</span>
                  <h3 className="font-display text-xl font-semibold text-fg">{action.title}</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted">{action.text}</p>
                {/* `mt-auto` so the five links sit on one line across the row however long
                    the sentence above each of them runs. */}
                <Link
                  href={action.href}
                  className="mt-auto pt-5 font-mono text-[12px] text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hoverable:hover:text-cyan-bright"
                >
                  {action.label} →
                </Link>
              </div>
            </article>
          ))}
        </div>

        {/* The rule above this pair is gone with the heading block. It was separating the
            five panels from the two sentences, and five bordered cards against two lines of
            prose are already two different things — the hairline was drawing a seam where
            the panels' own edges had drawn one. `mt-8` alone is the mock's 32px. */}
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <p className="text-sm leading-relaxed text-muted">
            <span className="font-mono text-cyan">Human interface:</span> search, inspect,
            compare, download, validate, and publish through the website.
          </p>
          <p className="text-sm leading-relaxed text-muted">
            <span className="font-mono text-violet">Agent interface:</span> search by task and
            fetch exact releases through MCP, with the same provenance and version pins.
          </p>
        </div>
      </div>
    </section>
  );
}
