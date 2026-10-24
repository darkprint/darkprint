import type { Metadata } from "next";
import Link from "next/link";

import { MCP_CLIENTS } from "@/components/mcp/clients";
import { SpecPager } from "@/components/spec/SpecPager";
import { LivePrompt, StartLive } from "@/components/tutorial/StartLive";
import { CodePanel, GuideStepHeading, guideStyles as guide } from "@/components/ui/Guide";
import { SectionHeading } from "@/components/ui/SectionHeading";
import {
  SKILL_ARCHIVE_ROOT,
  SKILL_INSTALL_COMMAND,
  SKILL_INSTALL_COMMAND_CODEX,
  SKILL_PACKAGE,
  SKILL_TREE_PATH,
} from "@/lib/skill";

/* ============================================================
   /tutorial: write one blueprint in your own agent, and watch it here.

   The work happens on the reader's machine. The blueprint-writing
   skill interviews them inside Claude Code or Codex and writes the
   folder there; this site opens a live page the skill posts each draft
   to, searches the registry when the agent asks over MCP, and stores
   the folder when the reader publishes it. Nothing on this site runs
   the blueprint, and the copy below says so where a reader might think
   otherwise.

   Five steps, each a section with an id the Learn rail links to
   (`components/spec/sequence.ts`) and `scroll-mt-24` so the sticky
   header does not cover the heading it lands on. Every command a reader
   pastes is imported: the install lines from `lib/skill.ts`, the MCP
   lines from `components/mcp/clients.ts`, the prompts from
   `components/tutorial/prompts.ts`. `tutorial-page.test.ts` holds each
   against its source.
   ============================================================ */

export const metadata: Metadata = {
  title: "Write your first blueprint",
  description:
    "Write a blueprint in your own agent while a live page here draws the graph, then enrich it over MCP and keep it on your account.",
};

/** The last stop of the Learn sequence; the pager at the foot reads the list. */
const HERE = "/tutorial";

const LINK =
  "text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hoverable:hover:decoration-cyan";

/** The two agents the blueprint-writing skill installs into, so the MCP step shows the same two. */
const TERMINAL_CLIENTS = MCP_CLIENTS.filter(
  (client) => client.id === "claude-code" || client.id === "codex",
);

/**
 * A command and the control that copies it: real text in a `<pre>`, wrapped rather than
 * scrolled so a phone shows the whole line. `data-command` names the row in the markup,
 * which is how the test tells the Codex cell from the Claude Code cell. The prop is `row`
 * rather than `id` so the only id attributes written in this file are the five anchors
 * the Learn rail links, which is what the anchors walk reads this source for.
 */
function CommandLine({
  row,
  label,
  command,
  ariaLabel,
}: {
  row: string;
  label: string;
  command: string;
  ariaLabel: string;
}) {
  return <CodePanel title={label} text={command} ariaLabel={ariaLabel} preProps={{ "data-command": row }} />;
}

/** A step's ordinal and its title as one heading, so the outline a screen reader walks carries the sequence. */
function StepHeading({ index, title }: { index: number; title: string }) {
  return <GuideStepHeading index={index} title={title} />;
}

const P = guide.prose;

export default function TutorialPage() {
  return (
    <div className={`${guide.page} container-page py-16 sm:py-20`}>
      <SectionHeading
        as="h1"
        eyebrow="Tutorial"
        title="Write your first blueprint"
        lead="Build a small price-checking workflow with your own agent. Watch its graph take shape on a live page."
      />

      <ol className="mt-10 flex flex-col gap-6">
        {/* ---------- 1 · install ---------- */}
        <li>
          <section id="install" className={`${guide.panel} flex min-w-0 scroll-mt-24 flex-col gap-4`}>
            <StepHeading index={1} title="Install the DarkPrint skill" />
            <div className="grid gap-6 md:grid-cols-2 md:items-start">
              <div className="flex min-w-0 flex-col gap-4">
                <CommandLine
                  row="claude-code"
                  label="Claude Code"
                  command={SKILL_INSTALL_COMMAND}
                  ariaLabel="Copy the command that installs the DarkPrint skill for Claude Code"
                />
                <CommandLine
                  row="codex"
                  label="Codex"
                  command={SKILL_INSTALL_COMMAND_CODEX}
                  ariaLabel="Copy the command that installs the DarkPrint skill for Codex"
                />
              </div>
              <div className="flex flex-col gap-3">
                <p className={P}>
                  Both commands download the{" "}
                  <code className="font-mono text-[13px] text-fg">{SKILL_PACKAGE}</code> package
                  from npm and copy the DarkPrint skill into{" "}
                  <code className="font-mono text-[13px] text-fg">{SKILL_ARCHIVE_ROOT}</code>{" "}
                  under your agent&rsquo;s folder. Nothing else is
                  installed and no account is created.
                </p>
                <p className={P}>
                  Read{" "}
                  <a href={`${SKILL_TREE_PATH}/SKILL.md`} className={LINK}>
                    SKILL.md
                  </a>
                   before installing.{" "}
                  <Link href="/skill" className={LINK}>
                    Assisted Design
                  </Link>{" "}
                  shows the files it writes.
                </p>
              </div>
            </div>
          </section>
        </li>

        {/* ---------- 2 · the live page ---------- */}
        <li>
          <section id="open-live" className={`${guide.panel} flex min-w-0 scroll-mt-24 flex-col gap-4`}>
            <StepHeading index={2} title="Open your live page" />
            <p className={P}>
              The DarkPrint skill posts each interview draft here so you can review its graph.
              Nothing runs on this site.
            </p>
            <StartLive />
          </section>
        </li>

        {/* ---------- 3 · the task ---------- */}
        <li>
          <section id="design" className={`${guide.panel} flex min-w-0 scroll-mt-24 flex-col gap-4`}>
            <StepHeading index={3} title="Describe the task" />
            <p className={P}>
              Paste this into Claude Code or Codex:
            </p>
            <LivePrompt name="design" />
            <p className={P}>
              Answer the interview questions in your agent; review the draft on the live page.
            </p>
          </section>
        </li>

        {/* ---------- 4 · enrich ---------- */}
        <li>
          <section id="enrich" className={`${guide.panel} flex min-w-0 scroll-mt-24 flex-col gap-4`}>
            <StepHeading index={4} title="Add reusable steps with MCP" />
            <p className={P}>
              Connect your agent to the remote registry. These commands install nothing.{" "}
              <Link href="/mcp" className={LINK}>
                The MCP page
              </Link>{" "}
              has setup for other clients.
            </p>
            <div className="grid gap-4 md:grid-cols-2 md:items-start">
              {TERMINAL_CLIENTS.map((client) => (
                <div key={client.id} className="flex min-w-0 flex-col gap-1.5">
                  <CodePanel title={client.label} text={client.snippet} ariaLabel={`Copy the command that connects ${client.label} to the DarkPrint MCP server`} preProps={{ "data-client": client.id }} />
                </div>
              ))}
            </div>
            <p className={P}>Add monitoring to the workflow:</p>
            <LivePrompt name="enrich" />
            <p className={P}>
              Your agent searches with <code className="font-mono text-[13px] text-fg">find_blueprints</code>,
              fetches the match with{" "}
              <code className="font-mono text-[13px] text-fg">get_blueprint</code>, and merges it
              into your folder using the DarkPrint skill. Review the changes on your live page.
            </p>
          </section>
        </li>

        {/* ---------- 5 · keep ---------- */}
        <li>
          <section id="keep" className={`${guide.panel} flex min-w-0 scroll-mt-24 flex-col gap-4`}>
            <StepHeading index={5} title="Keep the files" />
            <p className={P}>
              Keep the folder locally. The live page expires 24 hours after the last post. To publish,{" "}
              <Link href="/welcome" className={LINK}>
                sign in
              </Link>{" "}
              and drop the folder on{" "}
              <Link href="/upload" className={LINK}>
                Publish
              </Link>
              , where visibility defaults to private. An API key also lets you publish from your terminal.
            </p>
          </section>
        </li>
      </ol>

      <div className="mt-16">
        <SpecPager href={HERE} />
      </div>
    </div>
  );
}
