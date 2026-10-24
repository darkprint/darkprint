import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { guideStyles as guide } from "@/components/ui/Guide";
import { SkillSetup } from "@/components/skill/SkillSetup";

/* ============================================================
   The page for the blueprint-writing skill: one command, an interview, a folder, and the
   three things the DarkPrint skill never does. MCP has its own page, on the owner's
   instruction, so a landing chip that promises one half never opens a page that is half
   the other.

   The closing section is not a list of unbuilt features. Everything the registry offers
   around the folder (accounts, drafts, publishing from the browser, publishing with an API
   key) exists and is linked from the tutorial's last step. What a reader holding a folder still needs
   to know is what the document they just installed will not do on their own machine, and
   that is a design statement about the skill, held by `components/skill/honesty.test.ts`.

   No `.route-box` on this page: every onward move is an inline link inside the sentence
   that gives a reason for making it.
   ============================================================ */

const LINK = "text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hoverable:hover:decoration-cyan";

/** The three limits, each with where the capability lives instead. */
const NEVER: readonly { label: string; body: React.ReactNode }[] = [
  {
    label: "Execution",
    body: "your own runner executes the blueprint",
  },
  {
    label: "Publishing",
    body: (
      <>
        publishing is your step. Upload the folder at{" "}
        <Link href="/upload" className={LINK}>Publish</Link>, or use a write-scoped API key from{" "}
        <Link href="/settings" className={LINK}>Settings</Link>.
      </>
    ),
  },
  {
    label: "Task searches",
    body: "the DarkPrint skill sends your one-sentence task to the registry's search while it drafts, and nothing else leaves your machine on its own. Validation, publishing and live previews need your permission",
  },
];

export const metadata: Metadata = {
  /* "Assisted Design" in all three places a route's name lives: this `<title>`, the `h1`
     below, and the nav row that sends a reader here. `components/site/nav.test.ts` holds
     them together. */
  title: "Assisted Design",
  /* The shared-link preview owes a reader the limit before they open the tab, so the
     description carries the same sentence the closing section prints. */
  description:
    "Install the DarkPrint skill to write blueprints with your coding agent. It runs nothing and sends nothing on its own beyond task searches. Publishing is your step.",
};

export default function SkillPage() {
  return (
    <div className={`${guide.page} container-page py-16 sm:py-20`}>
      <SectionHeading
        as="h1"
        eyebrow="Setup"
        title="Assisted Design"
        lead="Write a blueprint with your coding agent. The DarkPrint skill finds reusable work and helps define the rest."
      />

      <SkillSetup className="mt-10" />

      <section className={`${guide.panel} ${guide.human} mt-6 flex flex-col gap-5`}>
        <h2 className="font-display text-2xl font-semibold text-fg">Execution and sharing</h2>
        <p className="text-[15px] leading-relaxed text-muted">
          The DarkPrint skill writes files and runs nothing.
        </p>

        {/* The same hairline rows step 2 draws, in blueprint ink rather than amber: amber is
            reserved for a surface describing something that does not exist yet, and every
            capability these rows point at exists. */}
        <ul className="flex min-w-0 flex-col border-t border-line">
          {NEVER.map((item) => (
            <li
              key={item.label}
              className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1 border-b border-line py-3.5 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-5"
            >
              <span className="font-mono text-[12px] leading-relaxed tracking-[0.06em] text-blueprint-ink">
                {item.label}
              </span>
              <span className="min-w-0 text-[15px] leading-relaxed text-muted">{item.body}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
