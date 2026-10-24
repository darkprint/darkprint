import type { Metadata } from "next";

import Link from "next/link";

import { SurfaceTabs, type Surface } from "@/components/capabilities/SurfaceTabs";
import { MCP_CLIENTS, MCP_ENDPOINT_URL } from "@/components/mcp/clients";
import { QUESTIONS } from "@/components/skill/SkillSetup";
import { CodePanel, guideStyles as guide } from "@/components/ui/Guide";
import { KeyValueList, KeyValueRow } from "@/components/ui/KeyValueList";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SpecPager } from "@/components/spec/SpecPager";
import { StatusPill, type CapabilityStatus } from "@/components/ui/StatusPill";
import { BUNDLE_CARDS_DIR, BUNDLE_README, TOPOLOGY_DOT } from "@/lib/content/bundle-export";
import { SKILL_INSTALL_COMMAND, SKILL_PACKAGE, SKILL_ROUTE } from "@/lib/skill";
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
    "Every operation DarkPrint offers, from the command line, from a remote MCP server your coding agent connects to with nothing to install, and from the DarkPrint blueprint-writing skill. The CLI and the DarkPrint skill install from npm with one npx line.",
};

/**
 * What a reader is trying to do, and where it is answered.
 *
 * Ordered by how early somebody meets it rather than by surface: finding a blueprint comes
 * before cloning one, and both come before cutting a version of your own. `how` is prose
 * when the answer is not one command: a tutorial to follow or a browser step has no line
 * to paste, and writing one anyway would send a reader to a shell for something a page does.
 */
const INTENTS: readonly {
  readonly intent: string;
  readonly group: "Find" | "Create" | "Check" | "Publish" | "Use locally";
  readonly how: React.ReactNode;
  readonly status: CapabilityStatus;
  /** Why this row carries this status. Not rendered: it is for whoever changes the row. */
  readonly because: string;
}[] = [
  {
    intent: "Find a blueprint",
    group: "Find",
    how: <code className="font-mono text-blueprint-ink">find_blueprints {"{ task: \"…\" }"}</code>,
    status: "live",
    because: "`app/api/mcp/blueprints/find/route.ts` answers, over HTTP and over the remote MCP endpoint.",
  },
  {
    intent: "Find a card",
    group: "Find",
    how: <code className="font-mono text-blueprint-ink">find_cards {"{ task: \"…\" }"}</code>,
    status: "live",
    because: "`app/api/mcp/cards/find/route.ts`, same as above.",
  },
  {
    intent: "Read a card version",
    group: "Find",
    how: <code className="font-mono text-blueprint-ink">read_card {"{ ref: \"…@1.0.0\" }"}</code>,
    status: "live",
    because: "`app/api/mcp/cards/[...ref]/route.ts`, same as above.",
  },
  {
    intent: "Fetch a release by hash",
    group: "Find",
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
    group: "Use locally",
    how: (
      <span>
        <code className="font-mono text-blueprint-ink">get_blueprint</code> from your agent, or{" "}
        <Verb name="clone" /> from your terminal, for a release or for one card
      </span>
    ),
    status: "live",
    because:
      "The MCP tool hands an agent every file of a release; the CLI verb fetches the same " +
      "bytes on any machine with Node, since npx pulls the package from npm.",
  },
  {
    intent: "Validate a folder",
    group: "Check",
    how: <Verb name="validate" />,
    status: "live",
    because:
      "A CLI verb, fetched by npx from npm. `/upload` runs the same engine in the tab with no " +
      "install at all, so this row is `live` for a reader with no terminal as well.",
  },
  {
    intent: "Run one",
    group: "Use locally",
    how: (
      <span className="text-muted">
        nothing here runs a blueprint: your own harness does, and{" "}
        <code className="font-mono text-blueprint-ink">get_blueprint</code> returns the
        contract for running it
      </span>
    ),
    status: "by design",
    because:
      "The site executes nothing, which `/upload` and `/mcp` both state in the open. What it " +
      "hands an agent instead is the `run` block on `get_blueprint`: approve the shape with " +
      "the person first, one node per context with only its declared inputs, `will_not` and " +
      "`cannot` honoured, loops bounded by `max_retries`, and a stop at every human gate. It " +
      "does not vary by the `harness` parameter and is returned whether or not one is named. " +
      "The verb " +
      "that gets you a runnable file is a CLI verb, and `export_pipeline` returns the same file " +
      "over MCP; the running is the reader's runner's.",
  },
  {
    intent: "Import an Attractor pipeline",
    group: "Create",
    how: <Verb name="import" />,
    status: "live",
    because:
      "A CLI verb, fetched by npx from npm. `/upload` reads a dropped Attractor pipeline " +
      "through the same `lib/core` import, so a reader with no terminal has a way in too.",
  },
  {
    intent: "Start with the tutorial",
    group: "Create",
    how: (
      <span className="text-muted">
        <Link href="/tutorial">follow the tutorial</Link>: the DarkPrint skill interviews you in
        your agent, and a live page here draws the graph as you answer
      </span>
    ),
    status: "live",
    because:
      "`/tutorial` walks the skill, the live page, MCP and `/upload` in order; the folder is " +
      "written on the reader's machine and this site draws the draft it posts.",
  },
  {
    intent: "Use Assisted Design",
    group: "Create",
    how: (
      <span className="text-muted">
        install the DarkPrint skill with one npx line; it interviews you and writes the folder
      </span>
    ),
    status: "live",
    because:
      "`SKILL_INSTALL_COMMAND` has npx fetch the package from npm and copy the DarkPrint skill " +
      "into the agent's skills folder. The same skill is served here file by file, which is " +
      "what the `Assisted Design` panel says. `lib/skill.ts` forbids the bare phrase `the " +
      "skill`, hence the qualifier.",
  },
  {
    intent: "Check a version bump matches the change",
    group: "Check",
    how: <Verb name="bump" />,
    status: "live",
    because:
      "`bump` cuts nothing. It holds a number you already declared against the actual diff " +
      "and writes nothing at all, so the intent is a check rather than a release.",
  },
  {
    intent: "Report run cost",
    group: "Use locally",
    how: <Verb name="report" />,
    status: "live",
    because:
      "The one verb that writes. The route takes a session cookie or a write-scoped key, and " +
      "the verb sends the cookie named in the environment table on the CLI tab.",
  },
  {
    intent: "Publish a release from your agent",
    group: "Publish",
    how: (
      <span className="text-muted">
        <code className="font-mono text-blueprint-ink">POST /api/bundles</code> with a
        write-scoped API key; <Link href="/settings">Settings</Link> prints the exact call when
        you mint one, and the <Link href="/upload">Publish</Link> page does the same from a
        browser
      </span>
    ),
    status: "live",
    because:
      "`POST /api/bundles` takes a session or a write-scoped key. The curl is `PUBLISH_CURL` in " +
      "`components/settings/ApiKeys.tsx`, a client module this server page does not import, so " +
      "the row points at the page that prints it rather than typing it a second time. The " +
      "address itself is named here because `/settings` reveals that curl only after the scope " +
      "dropdown is moved to Write, and a code span is not the curl.",
  },
  {
    intent: "Publish one card on its own",
    group: "Publish",
    how: (
      <span className="text-muted">
        <code className="font-mono text-blueprint-ink">POST /api/cards</code> with a write-scoped
        API key, or drop the YAML on <Link href="/upload">Publish</Link>
      </span>
    ),
    status: "live",
    because:
      "`app/api/cards/route.ts` takes a session or a write-scoped key, reads one card document " +
      "as `source` with an optional name and visibility, and answers 201 with the card and its " +
      "path. Its own row rather than a wider publish row above: the address and the browser " +
      "step both differ from a release's, and a reader holding one node reads past a row whose " +
      "answer names a release.",
  },
  {
    intent: "Change who can see a blueprint",
    group: "Publish",
    how: (
      <span className="text-muted">
        <code className="font-mono text-blueprint-ink">
          PATCH /api/bundles/&lt;owner&gt;/&lt;slug&gt;/visibility
        </code>
        , or the switch on each row of your own shelf
      </span>
    ),
    status: "live",
    because:
      "The route writes `bundle.visibility`, a column on the bundle row, so it moves the whole " +
      "name at once and there is no such thing as a private release under a public blueprint. " +
      "Session-only and owner-only, which is why this row names no key: `withSession`, then " +
      "`setBundleVisibility` re-checks the actor. `VisibilityControl` on the owner's shelf is " +
      "the same call from a browser.",
  },
  {
    intent: "Read a private blueprint over MCP",
    group: "Find",
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
  return <p className={guide.prose}>{children}</p>;
}

function TableShell({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div tabIndex={0} role="group" aria-label={`${label}, scrollable`} className={`${guide.reference} min-w-0 overflow-x-auto`}>
      <table className="w-full min-w-[44rem] table-fixed border-collapse text-left">
        <caption className="sr-only">{label}</caption>
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

/** This page is a stop in the Learn sequence; the pager at its foot reads the list. */
const HERE = "/capabilities";

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
      {/* The status column is written here rather than read off a row: `CLI_VERBS` carries
          no status field, and every verb in it works as printed. */}
      <Framing>
        Every verb below runs as{" "}
        <code className="font-mono text-blueprint-ink">{NPX_INVOCATION} &lt;verb&gt;</code> on
        any machine with Node. The first run has npx fetch the{" "}
        <code className="font-mono text-blueprint-ink">{SKILL_PACKAGE}</code> package from npm
        and keep it in its own cache, so nothing lands in your project. The table below is what
        each command takes. Exit code 0 on success, 1 on anything else.
      </Framing>
      <TableShell label="CLI command reference">
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
                <StatusPill status="live" />
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>
      <p className="text-sm leading-relaxed text-dim">
        {" "}
        <code className="font-mono text-blueprint-ink">report</code> is the only verb that
        writes. It uses the session cookie described below and does not send an API key.
        It checks five required run facts locally before sending the report.
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
        Connect to <code className="font-mono text-blueprint-ink">{MCP_ENDPOINT_URL}</code> without installing a package.
        All seven tools are read-only. Without a key every call reads as anonymous and sees public content.
        A bearer key raises the rate limit and lets you fetch your own private blueprints by name;
        search remains public-only. A match score says nothing about quality. Nothing here runs a blueprint.
      </Framing>
      <TableShell label="MCP tool reference">
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
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        {MCP_CLIENTS.map((client) => <CodePanel key={client.id} title={client.label} text={client.snippet} ariaLabel={`Copy the ${client.label} MCP configuration`} preProps={{ "data-client": client.id }} />)}
      </div>
      <p className="text-sm leading-relaxed text-dim">
        Use the configuration for your client. The stdio server runs locally as <code className="font-mono text-blueprint-ink">{NPX_INVOCATION} mcp</code>, from the same npm package. The remote connection needs no package.
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
      <CodePanel title="Install for Claude Code" text={SKILL_INSTALL_COMMAND} ariaLabel="Copy the command that installs the DarkPrint skill" />

      {/* The package name is named again here, and not only on the CLI panel: the three
          surfaces are tabs, so a reader on this one sees no sentence written over there, and
          this panel prints a whole command under a copy button. */}
      <p className="text-sm leading-relaxed text-dim">
        The line has npx fetch the{" "}
        <code className="font-mono text-blueprint-ink">{SKILL_PACKAGE}</code> package from npm
        and copy the DarkPrint skill it carries into your agent&rsquo;s skills folder; nothing
        else is installed and no account is created. The DarkPrint skill is also served on this
        site, file by file.{" "}
        <Link href={SKILL_ROUTE}>Assisted Design</Link> explains it and gives the Codex form, and{" "}
        <Link href="/tutorial">the tutorial</Link> walks a first blueprint through it, with a
        live page here drawing the graph as the interview runs.
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
            The full interview also reviews each node’s risks and chooses names and versions.
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <span className="label">Writes</span>
          <KeyValueList>
            <KeyValueRow
              keyWidth={168}
              term={<span className="font-mono text-xs text-fg">{TOPOLOGY_DOT}</span>}
            >
              <span className="text-sm leading-relaxed text-muted">nodes and their connections</span>
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
                one exact version per graph node
              </span>
            </KeyValueRow>
            <KeyValueRow
              keyWidth={168}
              term={<span className="font-mono text-xs text-fg">{BUNDLE_README}</span>}
            >
              <span className="text-sm leading-relaxed text-muted">
                setup and runner instructions
              </span>
            </KeyValueRow>
          </KeyValueList>
          <p className="text-sm leading-relaxed text-dim">
            This site does not check what the DarkPrint skill writes. It is a document your agent
            follows.
          </p>
        </div>
      </div>
    </section>
  );

  return (
    <div className={`${guide.page} container-page py-16 sm:py-20`}>
      <SectionHeading
        as="h1"
        eyebrow="Reference"
        title="What you can do"
        lead="Find the right command or tool for your task. Use the CLI, connect through MCP, or write files with the DarkPrint skill."
      />
      <p className="mt-3 text-sm leading-relaxed text-dim">
        <span className="text-emerald">live</span>: works as printed ·{" "}
        <span className="text-muted">by design</span>: built, and declines that step on purpose
      </p>

      <section aria-labelledby="intent-title" className="mt-10 flex min-w-0 flex-col gap-3">
        <h2 id="intent-title" className="label scroll-mt-24">
          By intent
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {(["Find", "Create", "Check", "Publish", "Use locally"] as const).map((group) => (
            <div key={group} className={`${guide.panel} ${group === "Publish" ? guide.copper : ""}`}>
              <h3 className="mb-4 font-display text-xl font-semibold text-fg">{group}</h3>
              <ul className="divide-y divide-line">
                {INTENTS.filter((row) => row.group === group).map((row) => (
                  <li key={row.intent} className="flex min-w-0 flex-col gap-2 py-4 first:pt-0 last:pb-0">
                    <div className="flex items-baseline justify-between gap-3"><span className="text-sm font-medium text-fg">{row.intent}</span><StatusPill status={row.status} /></div>
                    <div className="min-w-0 text-sm leading-relaxed text-muted [overflow-wrap:anywhere]">{row.how}</div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
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
      <div className="mt-16">
        <SpecPager href={HERE} />
      </div>
    </div>
  );
}
