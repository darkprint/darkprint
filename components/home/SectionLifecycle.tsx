import Image from "next/image";
import Link from "next/link";

import { SectionHeading } from "@/components/ui/SectionHeading";

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
   same provenance and the same version pins.
   ============================================================ */

const ACTIONS = [
  {
    index: "00",
    href: "/what-a-blueprint-is",
    label: "What a blueprint is",
    title: "Learn",
    text: "See how graphs, cards, and a shared vocabulary make workflows inspectable before they run.",
    image: "/home/lifecycle/learn.webp",
  },
  {
    index: "01",
    href: "/blueprints",
    label: "Search blueprints",
    title: "Find",
    text: "Search by task, then narrow by shape, human checkpoints, tools, and evidence.",
    image: "/home/lifecycle/find.webp",
  },
  {
    index: "02",
    href: "/skill",
    label: "Assisted Design",
    title: "Create",
    text: "Turn a goal into a typed graph and version-pinned cards with the authoring skill.",
    image: "/home/lifecycle/create.webp",
  },
  {
    index: "03",
    href: "/blueprints/starter-software-factory#use-this-blueprint",
    label: "Take the starter",
    title: "Use",
    text: "Take exact plain files, then adapt and run them inside your own harness.",
    image: "/home/lifecycle/use.webp",
  },
  {
    index: "04",
    href: "/upload",
    label: "Validate and publish",
    title: "Publish",
    text: "Validate a bundle and release one exact version for people and agents to retrieve.",
    image: "/home/lifecycle/publish.webp",
  },
] as const;

export function SectionLifecycle() {
  return (
    <section id="lifecycle" className="scroll-mt-24 border-t border-line bg-void py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          eyebrow="One registry, two loops"
          title="Find and reuse, or create and publish"
          lead="Both paths meet on the same blueprint page and leave you holding the same thing: a reproducible, version-pinned specification you can inspect before your own harness runs it."
        />

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

        <div className="mt-8 grid gap-4 border-t border-line pt-8 md:grid-cols-2">
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
