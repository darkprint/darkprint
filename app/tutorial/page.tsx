import type { Metadata } from "next";
import Link from "next/link";

import { MCP_CLIENTS } from "@/components/mcp/clients";
import { SpecPager } from "@/components/spec/SpecPager";
import { LivePrompt, StartLive } from "@/components/tutorial/StartLive";
import { CopyButton } from "@/components/ui/CopyButton";
import { PanelHeading, SectionHeading } from "@/components/ui/SectionHeading";
import { SKILL_INSTALL_COMMAND, SKILL_INSTALL_COMMAND_CODEX, SKILL_TREE_PATH } from "@/lib/skill";

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
    "Write a blueprint in your own agent with the blueprint-writing skill while a live page on this site draws the graph as the interview runs. Then enrich it from the registry over MCP and keep it on your account.",
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
        lead="A small pipeline that watches a few card prices every morning, written in your own agent by the blueprint-writing skill. Open a live page here first, and the graph appears on it as you answer the interview."
      />

      <ol className="mt-14 flex flex-col gap-14">
        {/* ---------- 1 · install ---------- */}
        <li>
          <section id="install" className="flex min-w-0 scroll-mt-24 flex-col gap-4">
            <StepHeading index={1} title="Install the blueprint-writing skill" />
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
                  Either line fetches one archive from this site and unpacks it as{" "}
                  <code className="font-mono text-[13px] text-fg">skills/darkprint</code> under
                  the folder your agent reads its skills from. Nothing else is installed and no
                  account is created.
                </p>
                <p className={P}>
                  The archive is served file by file if you want to read it first:{" "}
                  <a href={`${SKILL_TREE_PATH}/SKILL.md`} className={LINK}>
                    SKILL.md
                  </a>{" "}
                  is the interview the DarkPrint skill runs, and{" "}
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
              The interview happens in your terminal, and this page is how you watch it. Opening
              a live page gives you an address with a token in it; the blueprint-writing skill
              posts its draft there after every phase. The page lists the nodes and edges as
              they are named, and once every node has its card it draws the graph in the same
              panel a published blueprint uses. Nothing runs on this site: it shows what your
              agent posts.
            </p>
            <StartLive />
          </section>
        </li>

        {/* ---------- 3 · the task ---------- */}
        <li>
          <section id="design" className="flex min-w-0 scroll-mt-24 flex-col gap-4">
            <StepHeading index={3} title="Describe the task in your agent" />
            <p className={P}>
              Paste this into Claude Code or Codex with the DarkPrint skill installed. The task is
              small on purpose, so the interview stays short.
            </p>
            <LivePrompt name="design" />
            <p className={P}>
              The interview starts one question per turn: what exists at the end, and which
              command fails when the work is wrong. It then searches the registry for a piece
              of it on its own, and asks the node, port and isolation questions in numbered
              rounds. After each phase the draft lands on your live page and the graph grows a
              node or an edge, so keep that tab open while you answer.
            </p>
          </section>
        </li>

        {/* ---------- 4 · enrich ---------- */}
        <li>
          <section id="enrich" className="flex min-w-0 scroll-mt-24 flex-col gap-4">
            <StepHeading index={4} title="Enrich it through MCP" />
            <p className={P}>
              Once the folder is written, connect your agent to this registry. The server is
              remote, so the line below installs nothing;{" "}
              <Link href="/mcp" className={LINK}>
                the MCP page
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
            <p className={P}>Then ask for the observability layer by what it does, and let the search find it.</p>
            <LivePrompt name="enrich" />
            <p className={P}>
              Your agent calls <code className="font-mono text-[13px] text-fg">find_blueprints</code>,
              which searches the registry by meaning, and fetches the hit with{" "}
              <code className="font-mono text-[13px] text-fg">get_blueprint</code>; the DarkPrint
              skill&rsquo;s enrich mode merges it into your folder. The live page lists the hits
              the search returned and draws the grown graph.
            </p>
          </section>
        </li>

        {/* ---------- 5 · keep ---------- */}
        <li>
          <section id="keep" className="flex min-w-0 scroll-mt-24 flex-col gap-4">
            <StepHeading index={5} title="Keep it on your account" />
            <p className={P}>
              A live page expires after a day. To keep the blueprint,{" "}
              <Link href="/welcome" className={LINK}>
                sign in
              </Link>{" "}
              and drop the folder on{" "}
              <Link href="/upload" className={LINK}>
                Publish
              </Link>
              , where visibility defaults to private. An account gives you private blueprints,
              releases by version, and an API key for publishing from the terminal.
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
