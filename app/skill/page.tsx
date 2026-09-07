import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeading } from "@/components/ui/SectionHeading";
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

const LINK = "text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan";

/** The three limits, each with where the capability lives instead. */
const NEVER: readonly { label: string; body: React.ReactNode }[] = [
  {
    label: "run",
    body: "no node runs and no model is called on your behalf. The folder is text, and whichever runner you choose executes it",
  },
  {
    label: "publish by itself",
    body: (
      <>
        publishing is your step. Sign in at{" "}
        <Link href="/welcome" className={LINK}>
          Welcome
        </Link>
        , name the blueprint at{" "}
        <Link href="/new" className={LINK}>
          New blueprint
        </Link>
        , then press Publish on{" "}
        <Link href="/upload" className={LINK}>
          Upload
        </Link>{" "}
        or POST the folder from your terminal with a write-scoped API key from{" "}
        <Link href="/settings" className={LINK}>
          Settings
        </Link>
      </>
    ),
  },
  {
    label: "send",
    body: "nothing leaves your machine on its own. Checking the folder against the registry's validator, and publishing it, are steps it asks you for and you take",
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
    "One command puts the blueprint-writing skill in your own agent. It interviews you, searches the registry for what already exists, and writes a folder of topology.dot, one card per node, blueprint.yaml and README.md. The DarkPrint skill runs nothing and sends nothing on its own; publishing is a step you take on this site or with an API key.",
};

export default function SkillPage() {
  return (
    <div className="container-page py-16 sm:py-20">
      <SectionHeading
        as="h1"
        eyebrow="Setup"
        title="Assisted Design"
        lead="One command puts the blueprint-writing skill in the agent you already use. It interviews you about the work, searches the registry for a blueprint or cards that already do part of it, and writes what you decided as a folder the registry can store."
      />

      <SkillSetup className="mt-10" />

      <section className="mt-11 flex flex-col gap-5 border-t border-line pt-10">
        <h2 className="font-display text-2xl font-semibold text-fg">What it never does</h2>
        <p className="text-[15px] leading-relaxed text-muted">
          The DarkPrint skill writes files and runs nothing. Whatever it is asked, three
          limits hold, and each names where the capability lives instead.
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
