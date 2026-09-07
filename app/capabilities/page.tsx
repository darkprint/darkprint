import type { Metadata } from "next";

import Link from "next/link";

import { SurfaceTabs, type Surface } from "@/components/capabilities/SurfaceTabs";
import { MCP_CLIENTS, MCP_ENDPOINT_URL } from "@/components/mcp/clients";
import { QUESTIONS } from "@/components/skill/SkillSetup";
import { CopyButton } from "@/components/ui/CopyButton";
import { KeyValueList, KeyValueRow } from "@/components/ui/KeyValueList";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { StatusPill, type CapabilityStatus } from "@/components/ui/StatusPill";
import { BUNDLE_CARDS_DIR, BUNDLE_README, TOPOLOGY_DOT } from "@/lib/content/bundle-export";
import { SKILL_INSTALL_COMMAND, SKILL_ROUTE } from "@/lib/skill";
import { CLI_ENV, CLI_INVOCATION, CLI_VERBS, NPX_INVOCATION } from "@/packages/cli/src/index";
import { TOOL_DEFINITIONS } from "@/packages/mcp/src/definitions";

/* ============================================================
   /capabilities: every operation, read off the modules that define it

   The three surfaces this page indexes are defined in code: `CLI_VERBS` and `CLI_ENV` in
   the CLI's dispatcher, `TOOL_DEFINITIONS` in the MCP package, `MCP_CLIENTS` beside
   `/mcp`'s own tabs, `SKILL_INSTALL_COMMAND` in `lib/skill.ts`, `QUESTIONS` in
   `SkillSetup`. A reference page that retyped any of them would be a fourth copy of a
   command a reader pastes into a shell, going stale in silence, so no verb, flag, tool
   name, client snippet or environment variable is written in this file. Everything is
   mapped, and `app/capabilities/honesty.test.ts` holds the page from both ends.

   A server component, and it must stay one: the CLI barrel reaches `lib/server/engine` and
   `node:fs`. The tab bar is a client island that receives the three rendered panels.

   The status of each row is editorial: no module carries a field saying whether the thing
   it defines works today. Each row carries the reason its status rests on, for whoever
   changes it.
   ============================================================ */

export const metadata: Metadata = {
  title: "What you can do",
  description:
    "Every operation DarkPrint offers, from the command line, from a remote MCP server your coding agent connects to with nothing to install, and from the DarkPrint blueprint-writing skill. The CLI is not on npm yet.",
};

/**
 * What a reader is trying to do, and where it is answered.
 *
 * Ordered by how early somebody meets it rather than by surface: finding a blueprint comes
 * before cloning one, and both come before cutting a version of your own. `how` is prose
 * when the answer is not a command, because a row that prints a command a reader cannot
 * run is worse than a row that says so in words.
 */
const INTENTS: readonly {
  readonly intent: string;
  readonly how: React.ReactNode;
  readonly status: CapabilityStatus;
  /** Why this row carries this status. Not rendered: it is for whoever changes the row. */
  readonly because: string;
}[] = [
  {
    intent: "Find one for a task",
    how: <code className="font-mono text-blueprint-ink">find_blueprints {"{ task: \"…\" }"}</code>,
    status: "live",
    because: "`app/api/mcp/blueprints/find/route.ts` answers, over HTTP and over the remote MCP endpoint.",
  },
  {
    intent: "Find a node for a task",
    how: <code className="font-mono text-blueprint-ink">find_cards {"{ task: \"…\" }"}</code>,
    status: "live",
    because: "`app/api/mcp/cards/find/route.ts`, same as above.",
  },
  {
    intent: "Read a card before you depend on it",
    how: <code className="font-mono text-blueprint-ink">read_card {"{ ref: \"…@1.0.0\" }"}</code>,
    status: "live",
    because: "`app/api/mcp/cards/[...ref]/route.ts`, same as above.",
  },
  {
    intent: "Fetch an exact release by its digest",
    how: (
      <span>
        <code className="font-mono text-blueprint-ink">inspect_provenance</code> for the digest,
        then <code className="font-mono text-blueprint-ink">get_blueprint</code> at it
      </span>
    ),
    status: "live",
    because: "Both are MCP tools over live routes; `get_blueprint` returns every file in one answer.",
  },
  {
    intent: "Get the files on disk",
    how: (
      <span>
        <code className="font-mono text-blueprint-ink">get_blueprint</code> from your agent, or{" "}
        <Verb name="clone" /> from a checkout
      </span>
    ),
    status: "live",
    because:
      "The MCP tool hands an agent every file of a release today; the CLI verb needs a build " +
      "from the private repository until the package is on npm.",
  },
  {
    intent: "Check a folder is valid",
    how: <Verb name="validate" />,
    status: "checkout",
    because: "A CLI verb. `/upload` runs the same engine in the tab with no install at all.",
  },
  {
    intent: "Run one",
    how: (
      <span className="text-muted">
        nothing here runs a blueprint: <Verb name="export" />, then your own runner
      </span>
    ),
    status: "checkout",
    because:
      "The site executes nothing, which `/upload` and `/mcp` both state in the open. The " +
      "verb that gets you a runnable file is a CLI verb; `export_pipeline` returns the same file over MCP.",
  },
  {
    intent: "Bring a foreign pipeline in",
    how: <Verb name="import" />,
    status: "checkout",
    because: "A CLI verb.",
  },
  {
    intent: "Write one from nothing",
    how: (
      <span className="text-muted">
        <Link href="/tutorial">fill in the blanks</Link>, in your browser, with nothing installed
      </span>
    ),
    status: "live",
    because:
      "`/tutorial` needs no server and no install: the folder is assembled, archived and " +
      "checked in the tab.",
  },
  {
    intent: "Have your agent write one",
    how: (
      <span className="text-muted">
        install the DarkPrint skill from this site; it interviews you and writes the folder
      </span>
    ),
    status: "live",
    because:
      "`SKILL_INSTALL_COMMAND` fetches the archive this site serves under `/skill/`, so the " +
      "command runs for every reader. `lib/skill.ts` forbids the bare phrase `the skill`, hence the qualifier.",
  },
  {
    intent: "Check a version bump matches the change",
    how: <Verb name="bump" />,
    status: "checkout",
    because:
      "`bump` cuts nothing. It holds a number you already declared against the actual diff " +
      "and writes nothing at all, so the intent is a check rather than a release.",
  },
  {
    intent: "Say what a run cost",
    how: <Verb name="report" />,
    status: "checkout",
    because:
      "The one verb that writes. The route takes a session cookie or a write-scoped key, and " +
      "the verb itself still needs a build from the private repository.",
  },
  {
    intent: "Publish from your agent",
    how: (
      <span className="text-muted">
        POST a release with a write-scoped API key; <Link href="/settings">Settings</Link> prints
        the exact call when you mint one, and the <Link href="/upload">Publish</Link> page does the
        same from a browser
      </span>
    ),
    status: "live",
    because:
      "`POST /api/bundles` takes a session or a write-scoped key. The curl is `PUBLISH_CURL` in " +
      "`components/settings/ApiKeys.tsx`, a client module this server page does not import, so " +
      "the row points at the page that prints it rather than typing it a second time.",
  },
  {
    intent: "Read a private blueprint over MCP",
    how: (
      <span className="text-muted">
        send your API key as a bearer token; get_blueprint, read_card, inspect_provenance and
        fetch_release then reach your own private blueprints, while the two find tools search
        public blueprints only
      </span>
    ),
    status: "live",
    because:
      "`lib/server/mcp/http.ts` resolves a bearer key to its account and the four addressed " +
      "verbs decide visibility with `can`. `searchBlueprints` and `searchCards` are public-only " +
      "by their own rule, so the find tools do not widen.",
  },
];

/**
 * A verb of the CLI, named from the table rather than typed.
 *
 * The intent rows quote the bare verb where the tab quotes its whole grammar, because an
 * intent is what a reader wants and the flags are what the table is for. `CLI_VERBS` is
 * still where the name comes from: a verb renamed there renames it here, and a verb that
 * left the table is a build error rather than a row pointing at a command that is gone.
 */
function Verb({ name }: { name: string }) {
  const verb = CLI_VERBS.find((entry) => entry.name === name);
  if (verb === undefined) throw new Error(`no CLI verb \`${name}\``);
  return (
    <code className="font-mono text-blueprint-ink">
      {CLI_INVOCATION} {verb.name}
    </code>
  );
}

/**
 * A module's own prose, with its backticks rendered as code.
 *
 * A tool description is written for an agent reading a tool list, so it marks its
 * identifiers in backticks. Converted, they are the same `<code>` runs the rest of this page
 * uses; nothing is added or removed but the delimiters, which is what lets
 * `honesty.test.ts` hold the rendered text against the module's string.
 */
function Ticks({ text }: { text: string }) {
  return (
    <>
      {text.split("`").map((part, index) =>
        index % 2 === 0 ? (
          <span key={index}>{part}</span>
        ) : (
          <code key={index} className="font-mono text-blueprint-ink">
            {part}
          </code>
        ),
      )}
    </>
  );
}

/** The panel's own intro line, so the three tabs open the same way. */
function Framing({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed text-dim">{children}</p>;
}

function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="panel min-w-0 overflow-x-auto">
      <table className="w-full min-w-[44rem] table-fixed border-collapse text-left">
        {children}
      </table>
    </div>
  );
}

function Th({ children, width }: { children: React.ReactNode; width: string }) {
  return (
    <th scope="col" className={`label px-5 py-2.5 font-normal ${width}`}>
      {children}
    </th>
  );
}

export default function CapabilitiesPage() {
  const surfaces: readonly Surface[] = [
    { id: "cli", label: "Terminal · CLI", count: CLI_VERBS.length },
    { id: "mcp", label: "Agent · MCP", count: TOOL_DEFINITIONS.length },
    { id: "skill", label: "Agent · Assisted Design", count: 1 },
  ];

  const cli = (
    <section
      id="cli"
      aria-labelledby="cli-title"
      className="mt-5 flex min-w-0 scroll-mt-24 flex-col gap-5"
    >
      <h2 id="cli-title" className="sr-only">
        The command-line surface
      </h2>
      <Framing>
        The darkprint package is not on npm, so{" "}
        <code className="font-mono text-blueprint-ink">{NPX_INVOCATION}</code> fails, and the
        source repository it would be built from is private. Until that changes, the table below
        is a reference for what each command will take; no visitor can run one yet. Exit code 0
        on success, 1 on anything else.
      </Framing>
      <TableShell>
        <thead>
          <tr className="border-b border-line">
            <Th width="w-[40%]">Verb</Th>
            <Th width="w-[48%]">Does</Th>
            <Th width="w-[12%]">Status</Th>
          </tr>
        </thead>
        <tbody>
          {CLI_VERBS.map((verb) => (
            <tr key={verb.name} className="border-b border-line last:border-b-0">
              <th
                scope="row"
                className="px-5 py-3.5 align-top font-mono text-xs font-normal leading-relaxed text-blueprint-ink"
              >
                {verb.args}
              </th>
              <td
                data-does={verb.name}
                className="px-5 py-3.5 align-top text-sm leading-relaxed text-muted"
              >
                {verb.does}
              </td>
              <td className="px-5 py-3.5 align-top">
                <StatusPill status="checkout" />
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>
      <p className="text-sm leading-relaxed text-dim">
        One of the seven needs more than a checkout.{" "}
        <code className="font-mono text-blueprint-ink">report</code> is the only verb that
        writes. It needs a signed-in session cookie, passed through the session variable below,
        or a write-scoped API key from <Link href="/settings">Settings</Link>. It also refuses
        offline until five facts about the run are supplied or found in the run manifest.
      </p>
      <KeyValueList>
        {CLI_ENV.map((variable) => (
          <KeyValueRow
            key={variable.name}
            keyWidth={240}
            term={
              <span className="font-mono text-xs tracking-[0.06em] text-blueprint-ink">
                {variable.name}
              </span>
            }
          >
            <span className="text-sm text-muted">{variable.does}</span>
          </KeyValueRow>
        ))}
      </KeyValueList>
    </section>
  );

  const mcp = (
    <section
      id="mcp"
      aria-labelledby="mcp-title"
      className="mt-5 flex min-w-0 scroll-mt-24 flex-col gap-5"
    >
      <h2 id="mcp-title" className="sr-only">
        The MCP server
      </h2>
      <Framing>
        A remote MCP server at{" "}
        <code className="font-mono text-blueprint-ink">{MCP_ENDPOINT_URL}</code>, nothing to
        install. Two tools search the public registry by task, one returns a whole blueprint with
        notes for instantiating it under your harness, three read one thing by its address, and
        one compiles a release into a pipeline for Attractor, the runner DarkPrint compiles to.
        Every tool reads. Without a key every call reads as anonymous and sees public blueprints
        and cards only; a key sent as a bearer token raises the rate limit and lets the four
        addressed tools reach your own private blueprints. Ranking is a similarity between your
        task and each document, and a score says nothing about quality. Nothing here runs a
        blueprint.
      </Framing>
      <TableShell>
        <thead>
          <tr className="border-b border-line">
            <Th width="w-[22%]">Tool</Th>
            <Th width="w-[24%]">Takes</Th>
            <Th width="w-[42%]">Returns</Th>
            <Th width="w-[12%]">Status</Th>
          </tr>
        </thead>
        <tbody>
          {TOOL_DEFINITIONS.map((tool) => {
            /* `Takes` is the schema's own `required` list and not a description of it: a
               paraphrase would be a second statement of the argument names an agent has to
               send, and the two would drift the first time one was renamed. */
            const required = (tool.inputSchema as { required?: readonly string[] }).required ?? [];
            return (
              <tr key={tool.name} className="border-b border-line last:border-b-0">
                <th
                  scope="row"
                  className="px-5 py-3.5 align-top font-mono text-xs font-normal text-blueprint-ink"
                >
                  {tool.name}
                </th>
                <td
                  data-takes={tool.name}
                  className="px-5 py-3.5 align-top font-mono text-xs leading-relaxed text-muted"
                >
                  {required.join(", ")}
                </td>
                <td
                  data-returns={tool.name}
                  className="[overflow-wrap:anywhere] px-5 py-3.5 align-top text-sm leading-relaxed text-muted"
                >
                  <Ticks text={tool.description} />
                </td>
                <td className="px-5 py-3.5 align-top">
                  <StatusPill status="live" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableShell>
      <KeyValueList>
        {MCP_CLIENTS.map((client) => (
          <KeyValueRow
            key={client.id}
            keyWidth={240}
            term={<span className="text-sm text-fg">{client.label}</span>}
          >
            {/* `data-client` is the row's identity in the markup, for the guard: asserting
                that the page contains every snippet is satisfied by a page that prints them
                all against the wrong labels. */}
            <pre
              data-client={client.id}
              className="min-w-0 overflow-x-auto whitespace-pre font-mono text-xs leading-relaxed text-blueprint-ink"
            >
              <code>{client.snippet}</code>
            </pre>
          </KeyValueRow>
        ))}
      </KeyValueList>
      <p className="text-sm leading-relaxed text-dim">
        Copy the one for your client. The server is remote, so nothing is installed. The same
        server also runs on your own machine over stdio once the darkprint package is published
        to npm; it is not published to npm yet.
      </p>
    </section>
  );

  const skill = (
    <section
      id="skill"
      aria-labelledby="skill-title"
      className="mt-5 flex min-w-0 scroll-mt-24 flex-col gap-5"
    >
      <h2 id="skill-title" className="sr-only">
        The DarkPrint skill
      </h2>
      <Framing>
        One command installs the DarkPrint skill into your agent, which then interviews you and
        writes a blueprint folder. A card&rsquo;s{" "}
        <code className="font-mono text-blueprint-ink">skill:</code> field points at a document
        for one node, while the DarkPrint skill writes the whole graph.
      </Framing>
      <div className="flex min-w-0 flex-wrap items-start gap-2">
        <pre className="panel min-w-0 flex-1 overflow-x-auto px-3.5 py-3 font-mono text-xs leading-relaxed text-blueprint-ink">
          <code>{SKILL_INSTALL_COMMAND}</code>
        </pre>
        <CopyButton
          text={SKILL_INSTALL_COMMAND}
          ariaLabel="Copy the command that installs the DarkPrint skill"
        />
      </div>
      <p className="text-sm leading-relaxed text-dim">
        The archive is served by this site, so the command runs for every reader.{" "}
        <Link href={SKILL_ROUTE}>Assisted Design</Link> explains it and gives the Codex form, and{" "}
        <Link href="/tutorial">the tutorial</Link> writes the same folder by hand with nothing
        installed.
      </p>
      <div className="grid gap-8 sm:grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
        <div className="flex min-w-0 flex-col gap-3">
          <span className="label">Asks</span>
          <KeyValueList>
            {QUESTIONS.map((question) => (
              <KeyValueRow
                key={question.label}
                keyWidth={132}
                term={
                  <span className="font-mono text-xs tracking-[0.06em] text-blueprint-ink">
                    {question.label}
                  </span>
                }
              >
                <span className="text-sm leading-relaxed text-muted">{question.text}</span>
              </KeyValueRow>
            ))}
          </KeyValueList>
          <p className="text-sm leading-relaxed text-dim">
            Five of the questions it asks. The full interview is longer, walks a risk sheet for
            each node, and picks every name and version itself.
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <span className="label">Writes</span>
          <KeyValueList>
            <KeyValueRow
              keyWidth={168}
              term={<span className="font-mono text-xs text-fg">{TOPOLOGY_DOT}</span>}
            >
              <span className="text-sm leading-relaxed text-muted">who is wired to whom</span>
            </KeyValueRow>
            <KeyValueRow
              keyWidth={168}
              term={
                <span className="font-mono text-xs text-fg">
                  {BUNDLE_CARDS_DIR}/&lt;id&gt;@&lt;version&gt;.yaml
                </span>
              }
            >
              <span className="text-sm leading-relaxed text-muted">
                one per node the graph pins
              </span>
            </KeyValueRow>
            <KeyValueRow
              keyWidth={168}
              term={<span className="font-mono text-xs text-fg">{BUNDLE_README}</span>}
            >
              <span className="text-sm leading-relaxed text-muted">
                for a person opening the folder
              </span>
            </KeyValueRow>
          </KeyValueList>
          <p className="text-sm leading-relaxed text-dim">
            This site does not check what the skill writes. It is a document your agent follows,
            and this list describes it rather than testing it.
          </p>
        </div>
      </div>
    </section>
  );

  return (
    <div className="container-page py-16 sm:py-20">
      <SectionHeading
        as="h1"
        eyebrow="Reference"
        title="What you can do"
        lead="Everything you can do with DarkPrint, and where: the darkprint command line, an MCP server your coding agent connects to, and a skill your agent installs to write blueprints. Each row says whether it works today."
      />
      <p className="mt-3 text-sm leading-relaxed text-dim">
        <span className="text-emerald">live</span>: works as printed ·{" "}
        <span className="text-blueprint-ink">checkout</span>: needs a build from the source
        repository, which is private today
      </p>

      <section aria-labelledby="intent-title" className="mt-10 flex min-w-0 flex-col gap-3">
        <h2 id="intent-title" className="label">
          By intent
        </h2>
        <KeyValueList>
          {INTENTS.map((row) => (
            <KeyValueRow
              key={row.intent}
              keyWidth={240}
              term={<span className="text-sm text-fg">{row.intent}</span>}
              aside={<StatusPill status={row.status} />}
            >
              <span className="font-mono text-xs leading-relaxed text-blueprint-ink">
                {row.how}
              </span>
            </KeyValueRow>
          ))}
        </KeyValueList>
      </section>

      <section
        aria-labelledby="surfaces-title"
        className="mt-11 flex min-w-0 flex-col gap-5 border-t border-line pt-10"
      >
        <h2 id="surfaces-title" className="sr-only">
          The three surfaces
        </h2>
        <SurfaceTabs surfaces={surfaces}>{[cli, mcp, skill]}</SurfaceTabs>
      </section>
    </div>
  );
}
