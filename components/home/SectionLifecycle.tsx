import Image from "next/image";
import Link from "next/link";

import { SectionHeading } from "@/components/ui/SectionHeading";
import { ARCHIVE_OWNER, blueprintHref } from "@/lib/href";

/* ============================================================
   The landing's ending: five things the registry does, each one a way in.

   The section is the page's ending, so its five links are load-bearing: `beats.test.ts`
   holds every panel to a link and the whole section to exactly five anchors. Create points
   at `/skill` because the sentence beside it promises the interview, and Use points at the
   starter's file list because downloading a release is a thing you do to one blueprint.

   The human-interface / agent-interface pair at the foot is the one thing no panel says:
   the same registry answers a person through the website and an agent through MCP, with
   the same version pins. One `h2` and no eyebrow, because `.eyebrow` is rationed to one per
   page and the hero spends it.
   ============================================================ */

/**
 * The five stages, and the one sentence each of them gets.
 *
 * Each says what the stage is rather than what a reader should do about it, one idea per
 * sentence, because the link under each panel is already the instruction and five panels
 * in different grammars read as five unrelated notes.
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
    /* Three of the filter bar's five controls, the ones that narrow a search. The fork
       control is a display choice and the autonomy class would teach the vocabulary of a
       reading a reader has not met yet. Naming a control that does not exist is the defect
       this row once had. */
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
    /* `#files` is the file list whose header carries the download control; the release
       panel this once pointed at is gone from the blueprint page. */
    href: `${blueprintHref(ARCHIVE_OWNER, "starter-software-factory")}#files`,
    label: "Take the starter",
    title: "Use",
    text: "Plain files you can read. Download a release, one pinned version of the folder, then adapt it and run it with your own harness.",
    image: "/home/lifecycle/use.webp",
  },
  {
    index: "04",
    href: "/upload",
    label: "Publish",
    title: "Publish",
    text: "Your folder is checked in your browser, then published as one release that others fetch by exact version.",
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
        {/* A question rather than a claim: the five panels are the answer, so the heading
            only has to ask. `SectionHeading` rather than a bare `<h2>` because the component
            owns the display step. */}
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

        {/* No rule above this pair: five bordered cards against two lines of prose are
            already two different things. `mt-8` alone is the mock's 32px. */}
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <p className="text-sm leading-relaxed text-muted">
            <span className="font-mono text-cyan">Human interface:</span> search, inspect,
            download, check, and publish through the website.
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
