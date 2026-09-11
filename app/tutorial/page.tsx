import type { Metadata } from "next";
import Link from "next/link";

import { MCP_CLIENTS } from "@/components/mcp/clients";
import { SpecPager } from "@/components/spec/SpecPager";
import { LivePrompt, StartLive } from "@/components/tutorial/StartLive";
import { ComingSoonBadge } from "@/components/ui/ComingSoonBadge";
import { CopyButton } from "@/components/ui/CopyButton";
import { PanelHeading, SectionHeading } from "@/components/ui/SectionHeading";
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
  "text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan";

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
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="label">{label}</span>
      <div className="flex min-w-0 items-start gap-2">
        <pre
          data-command={row}
          className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-line bg-surface-2 px-3.5 py-3 font-mono text-xs leading-relaxed text-emerald"
        >
          <code>{command}</code>
        </pre>
        <CopyButton text={command} ariaLabel={ariaLabel} />
      </div>
    </div>
  );
}

/** A step's ordinal and its title as one heading, so the outline a screen reader walks carries the sequence. */
function StepHeading({ index, title }: { index: number; title: string }) {
  return (
    <PanelHeading as="h2" size="2xl">
      {index}. {title}
    </PanelHeading>
  );
}

const P = "text-[15px] leading-relaxed text-muted";

export default function TutorialPage() {
  return (
    <div className="container-page py-16 sm:py-20">
      <SectionHeading
        as="h1"
        eyebrow="Tutorial"
        title="Write your first blueprint"
        lead="Write a small pipeline that checks a few card prices every morning. The DarkPrint skill interviews you in your own agent, and a live page here draws the graph as you answer."
      />

      <ol className="mt-14 flex flex-col gap-14">
        {/* ---------- 1 · install ---------- */}
        <li>
          <section id="install" className="flex min-w-0 scroll-mt-24 flex-col gap-4">
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
                {/* Both lines fetch a package that is not on npm yet, so both answer 404
                    today. This is the first step of the first page a new reader is sent to,
                    and the limit sits under the two commands rather than at the top of the
                    page because the commands are what a reader copies. It comes off with the
                    same sentence on the six other surfaces printing an npx line, in the one
                    commit that follows `npm publish`. */}
                <div className="flex flex-col gap-2 rounded-md border border-amber/30 border-l-2 border-l-amber bg-amber/8 p-3">
                  <ComingSoonBadge className="self-start" />
                  <p className="text-xs leading-relaxed text-muted">
                    Not installable yet: the darkprint package is not published to npm, so npx
                    finds nothing to run. The DarkPrint skill is served on this site, file by
                    file.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <p className={P}>
                  Either line has npx fetch the{" "}
                  <code className="font-mono text-[13px] text-fg">{SKILL_PACKAGE}</code> package
                  from npm and copy the DarkPrint skill it carries into{" "}
                  <code className="font-mono text-[13px] text-fg">{SKILL_ARCHIVE_ROOT}</code>{" "}
                  under your agent&rsquo;s folder, where it reads its skills. Nothing else is
                  installed and no account is created.
                </p>
                <p className={P}>
                  To read it first, open{" "}
                  <a href={`${SKILL_TREE_PATH}/SKILL.md`} className={LINK}>
                    SKILL.md
                  </a>
                  , the interview it runs.{" "}
                  <Link href="/skill" className={LINK}>
                    Assisted Design
                  </Link>{" "}
                  explains what it writes.
                </p>
              </div>
            </div>
          </section>
        </li>

        {/* ---------- 2 · the live page ---------- */}
        <li>
          <section id="open-live" className="flex min-w-0 scroll-mt-24 flex-col gap-4">
            <StepHeading index={2} title="Open your live page" />
            <p className={P}>
              The interview runs in your terminal. The live page is where you watch it: the
              DarkPrint skill posts its draft there after every phase, the page lists the nodes
              and edges as they are named, and once every node has its card it draws the graph.
              Nothing runs on this site. It shows what your agent posts.
            </p>
            <StartLive />
          </section>
        </li>

        {/* ---------- 3 · the task ---------- */}
        <li>
          <section id="design" className="flex min-w-0 scroll-mt-24 flex-col gap-4">
            <StepHeading index={3} title="Describe the task" />
            <p className={P}>
              Paste this into Claude Code or Codex. The task is small on purpose, so the interview
              stays short.
            </p>
            <LivePrompt name="design" />
            <p className={P}>
              The first questions come one per turn: what exists at the end, and which command
              fails when the work is wrong. Then the DarkPrint skill searches the registry on its
              own and asks about nodes, ports and isolation in numbered rounds. Keep the live tab
              open. The graph grows after each phase.
            </p>
          </section>
        </li>

        {/* ---------- 4 · enrich ---------- */}
        <li>
          <section id="enrich" className="flex min-w-0 scroll-mt-24 flex-col gap-4">
            <StepHeading index={4} title="Enrich it through MCP" />
            <p className={P}>
              Once the folder is written, connect your agent to the registry. The server is
              remote, so the line installs nothing.{" "}
              <Link href="/mcp" className={LINK}>
                The MCP page
              </Link>{" "}
              has the same entry for Cursor, VS Code, Gemini CLI and Claude Desktop.
            </p>
            <div className="grid gap-4 md:grid-cols-2 md:items-start">
              {TERMINAL_CLIENTS.map((client) => (
                <div key={client.id} className="flex min-w-0 flex-col gap-1.5">
                  <span className="label">{client.label}</span>
                  <div className="flex min-w-0 items-start gap-2">
                    <pre
                      data-client={client.id}
                      className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-line bg-surface-2 px-3.5 py-3 font-mono text-xs leading-relaxed text-emerald"
                    >
                      <code>{client.snippet}</code>
                    </pre>
                    <CopyButton
                      text={client.snippet}
                      ariaLabel={`Copy the command that connects ${client.label} to the DarkPrint MCP server`}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className={P}>Then ask for observability by what it does, and let the search find it.</p>
            <LivePrompt name="enrich" />
            <p className={P}>
              Your agent calls <code className="font-mono text-[13px] text-fg">find_blueprints</code>,
              which searches by meaning, fetches the hit with{" "}
              <code className="font-mono text-[13px] text-fg">get_blueprint</code>, and merges it
              into your folder in the DarkPrint skill&rsquo;s enrich mode. The live page lists the
              hits and draws the grown graph.
            </p>
          </section>
        </li>

        {/* ---------- 5 · keep ---------- */}
        <li>
          <section id="keep" className="flex min-w-0 scroll-mt-24 flex-col gap-4">
            <StepHeading index={5} title="Keep it on your account" />
            <p className={P}>
              A live page expires 24 hours after the last post. To keep the blueprint,{" "}
              <Link href="/welcome" className={LINK}>
                sign in
              </Link>{" "}
              and drop the folder on{" "}
              <Link href="/upload" className={LINK}>
                Publish
              </Link>
              , where visibility defaults to private. An account also gives you releases by
              version and an API key for publishing from the terminal.
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
