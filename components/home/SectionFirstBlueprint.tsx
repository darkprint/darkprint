import Link from "next/link";

import { SectionHeading } from "@/components/ui/SectionHeading";

/* ============================================================
   The landing's ending: one door, to the tutorial.

   The page closes on the thing a reader does next rather than on a
   list of everything the site offers. The four steps under the
   heading are the tutorial's own path, so the reader knows what they
   are walking into before they click. `beats.test.ts` holds the
   ending to exactly three links: the door, the skill the first step
   installs, and the registry the third step searches.

   The drafting sheet behind it is the blueprint's own paper
   (`.bp-grid` over a cyanotype ground), the same ground `ContentCard`
   and every figure under `components/explain` draw a blueprint on,
   so the page ends on the surface the rest of it has been drawing on.
   ============================================================ */

const STEPS = [
  {
    index: "01",
    title: "Design it in conversation",
    text: (
      <>
        Install the{" "}
        <Link href="/skill" className="text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hoverable:hover:decoration-cyan">
          blueprint-writing skill
        </Link>{" "}
        in your coding agent and describe a small task: watch the prices of a few trading
        cards across the sites that list them. It interviews you and drafts the nodes.
      </>
    ),
  },
  {
    index: "02",
    title: "Watch the graph take shape",
    text: "A live page on this site draws the blueprint as you answer, in the same panel every published one is shown in.",
  },
  {
    index: "03",
    title: "Enrich it through MCP",
    text: "Connect the registry to your agent and ask for observability on top of a node. It searches the registry by meaning and brings back the blueprint that adds it.",
  },
  {
    index: "04",
    title: "Keep it on your account",
    text: "Sign in and publish the result as a private blueprint. Only you can open it until you decide otherwise.",
  },
] as const;

export function SectionFirstBlueprint() {
  return (
    <section
      id="first-blueprint"
      className="relative scroll-mt-24 overflow-hidden border-t border-line bg-void py-20 sm:py-28"
    >
      {/* Masked top and bottom so the ruling arrives out of the border above and leaves
          before the footer, rather than reading as a texture swatch with two hard edges. */}
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
        <SectionHeading
          title="Write your first blueprint"
          lead="Learn it by making one. The tutorial takes you from a task to a folder your agent can run, with the graph drawing itself as you answer."
        />

        <ol className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <li key={step.index} className="panel flex min-w-0 flex-col gap-3 p-5">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] text-cyan">{step.index}</span>
                <h3 className="font-display text-lg font-semibold text-fg">{step.title}</h3>
              </div>
              <p className="text-sm leading-relaxed text-muted">{step.text}</p>
            </li>
          ))}
        </ol>

        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
          <Link
            href="/tutorial"
            className="inline-flex items-center gap-2 rounded-md border border-cyan bg-cyan/10 px-5 py-3 font-mono text-sm text-cyan transition-colors hoverable:hover:bg-cyan/20"
          >
            Write your first blueprint <span aria-hidden>→</span>
          </Link>
          <p className="text-sm leading-relaxed text-muted">
            Or start from a published one:{" "}
            <Link
              href="/blueprints"
              className="font-mono text-[13px] text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hoverable:hover:decoration-cyan"
            >
              Search blueprints →
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
