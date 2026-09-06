import type { Metadata } from "next";

import Link from "next/link";

import { SurfaceTabs, type Surface } from "@/components/capabilities/SurfaceTabs";
import { MCP_CLIENTS } from "@/components/mcp/clients";
import { QUESTIONS } from "@/components/skill/SkillSetup";
import { ComingSoonBadge } from "@/components/ui/ComingSoonBadge";
import { CopyButton } from "@/components/ui/CopyButton";
import { KeyValueList, KeyValueRow } from "@/components/ui/KeyValueList";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { StatusPill, type CapabilityStatus } from "@/components/ui/StatusPill";
import { BUNDLE_CARDS_DIR, BUNDLE_README, TOPOLOGY_DOT } from "@/lib/content/bundle-export";
import { SKILL_INSTALL_COMMAND, SKILL_ROUTE } from "@/lib/skill";
import { CLI_ENV, CLI_INVOCATION, CLI_VERBS, NPX_INVOCATION } from "@/packages/cli/src/index";
import { TOOLS } from "@/packages/mcp/src/tools";

/* ============================================================
   /capabilities — every operation, read off the modules that define it

   ── why this page imports two packages ──
   It is the first file under `app/` to import from `packages/**`, and that edge is the
   whole design. The three surfaces this page indexes are defined in code — `CLI_VERBS`
   and `CLI_ENV` in the CLI's dispatcher, `TOOLS` in the MCP server, `MCP_CLIENTS` beside
   `/mcp`'s own tabs, `SKILL_INSTALL_COMMAND` in `lib/skill.ts`, `QUESTIONS` in
   `SkillSetup` — and a reference page that retyped any of them would be a fourth copy of
   a command a reader pastes into a shell, going stale in silence. `lib/skill.ts:14` names
   that failure exactly: "a wrong command produces an error in somebody else's shell, never
   a red test here." So no verb, flag, tool name, client snippet or environment variable is
   written in this file. Everything is `.map`ped.

   This is a SERVER component and must stay one. `TOOLS` reaches `packages/cli/src/index`,
   which reaches `lib/server/engine` and `node:fs`; none of that may cross into a browser
   bundle. The one interactive part, the tab bar, is a client island that receives the
   three already-rendered panels as children.

   ── what IS written here, and why it is a small array ──
   The status of each row. `live`, `checkout`, `not built` and `by design` are editorial:
   no module carries a field saying whether the thing it defines works today, and inventing
   one would put a claim about the world into a data structure that describes an interface.
   So `INTENTS` below is the page's own, every row carries the decision or the source line
   its status rests on, and `app/capabilities/honesty.test.ts` holds the strings that are
   NOT editorial against the modules they come from.

   ── the legend has four words, and one of them is not amber ──
   `app/globals.css` reserves `--color-amber` for "does not exist yet" and names its two
   contracted consumers. `by design` is the opposite claim, so it is muted. `StatusPill`
   carries that argument at the tone table.
   ============================================================ */

export const metadata: Metadata = {
  title: "What you can do",
  /* The three surfaces and the one limit that applies to two of them, because a shared
     link's preview is where a reader decides whether the page is worth opening and the npm
     404 is the thing most likely to surprise them once they are here. `/mcp`'s description
     makes the same trade for the same reason. */
  description:
    "Every operation DarkPrint offers, from three places: the command line, the MCP server, and the DarkPrint blueprint-writing skill. Four registry reads are live over HTTP. The npm package is not published, so every CLI verb runs from a checkout.",
};

/**
 * What a reader is trying to do, and where it is answered.
 *
 * Ordered by how early somebody meets it rather than by surface: finding a blueprint comes
 * before cloning one, and both come before cutting a version of your own. `how` is prose
 * when the answer is not a command, because a row that prints a command a reader cannot
 * run is worse than a row that says so in words.
 *
 * Every command in this table goes through `<Verb>` or names an MCP tool, so none of them
 * is a string typed here. `honesty.test.ts` refuses to find a command literal in this
 * file's source at all, which is the half of that claim a render cannot make: a hand-typed
 * copy that happens to match today passes any assertion about the markup.
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
    how: <code className="font-mono text-blueprint-ink">search {"{ task: \"…\" }​"}</code>,
    status: "live",
    because:
      "`app/api/mcp/search/route.ts` answers, and `packages/mcp/src/tools.ts` calls it. " +
      "Live over HTTP whatever the npm package does.",
  },
  {
    intent: "Read a card before pinning",
    how: <code className="font-mono text-blueprint-ink">read_card {"{ ref: \"…@1.0.0\" }"}</code>,
    status: "live",
    because: "`app/api/mcp/cards/[...ref]/route.ts`, same as above.",
  },
  {
    intent: "Pin bytes that will not move",
    how: (
      <span>
        <code className="font-mono text-blueprint-ink">inspect_provenance</code> for the digest,
        then <code className="font-mono text-blueprint-ink">fetch_release</code> at it
      </span>
    ),
    status: "live",
    because:
      "Both are MCP tools over live routes. This row said `clone --digest` in the handoff, " +
      "which straddles two surfaces with two statuses: `clone` is a CLI verb and every " +
      "other CLI row on this page reads `checkout`.",
  },
  {
    intent: "Get the files on disk",
    how: <Verb name="clone" />,
    status: "checkout",
    because: "A CLI verb, and the package is not on npm.",
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
      "verb that gets you a runnable file is a CLI verb.",
  },
  {
    intent: "Bring a foreign pipeline in",
    how: <Verb name="import" />,
    status: "checkout",
    because: "A CLI verb.",
  },
  {
    /* Two rows and not one. They were one, reading "the DarkPrint skill interviews you, or
       fill in the blanks" under a single `not built`, and a row with two answers can only
       carry the status of the worse of them: a reader scanning the column saw amber beside
       the route that ships in this very change. `because` is not rendered, so an argument
       written there settles nothing a reader can see. */
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
    intent: "Be interviewed into one",
    how: <span className="text-muted">the DarkPrint skill asks, and writes the folder</span>,
    status: "not built",
    because:
      "`lib/skill.ts` forbids the bare phrase `the skill`, hence the qualifier. The status " +
      "is about reachability: the repository the install command clones answers 404 to " +
      "anyone but its owner, so the command fails for every reader. ARCHITECTURE §11.0 Q8.",
  },
  {
    intent: "Check a version number is enough",
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
      "The one verb that writes, and it needs a session cookie no page hands out " +
      "(ARCHITECTURE §11.1, 2026-08-30).",
  },
  {
    intent: "Publish from the editor",
    how: (
      <span className="text-muted">
        publishing is live on this site, and not from your agent
      </span>
    ),
    status: "not built",
    because:
      "SEAM-96: nothing pushes a release from an editor. `POST /api/bundles` has been live " +
      "since T263, which is why the row says where publishing DOES work.",
  },
  {
    intent: "Reach a private bundle",
    how: (
      <span className="text-muted">
        MCP carries no identity, and a key only raises the read ceiling
      </span>
    ),
    status: "by design",
    because:
      "`lib/server/mcp/actor.ts` hands every MCP read `{ kind: \"anonymous\" }`, whatever " +
      "session it was asked with. D-114 is the other half and rules that a key gates no " +
      "read and authorises no write. Neither is unfinished work.",
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
 * `TOOLS[].description` is written for an agent reading a tool list, so it marks its
 * identifiers the way that audience reads them, in backticks. Printed verbatim on a page
 * those are stray characters; converted, they are the same `<code>` runs the rest of this
 * page uses. Nothing is added or removed but the delimiters, which is what lets
 * `honesty.test.ts` still hold the rendered text against the module's string.
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
    { id: "mcp", label: "Agent · MCP", count: TOOLS.length },
    { id: "skill", label: "Editor · Assisted Design", count: 1 },
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
        Not on npm: <code className="font-mono text-blueprint-ink">{NPX_INVOCATION}</code>{" "}
        answers 404, so every verb below runs from a checkout.{" "}
        <code className="font-mono text-blueprint-ink">npm run build</code> in{" "}
        <code className="font-mono text-blueprint-ink">packages/mcp</code> writes the bin, and
        nothing links it: the repository declares no workspaces, so a verb is{" "}
        <code className="font-mono text-blueprint-ink">
          node packages/mcp/dist/cli.js &lt;verb&gt;
        </code>{" "}
        until you link it yourself. The grammar below is what the command takes either way.
        Exit 0 on success, 1 on everything else.
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
        writes, it authenticates with a signed-in session cookie, and no page on this site
        hands one out: you read it out of a browser&rsquo;s developer tools. It also refuses
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
        Four registry reads, live over HTTP under{" "}
        <code className="font-mono text-blueprint-ink">/api/mcp</code>, plus one compiler that
        fetches a release and compiles it in your own process. The server itself speaks MCP over
        stdio. Read access and nothing else, and no tool knows who is asking.
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
          {TOOLS.map((tool) => {
            /* `Takes` is the schema's own `required` list and not a description of it. A
               prose paraphrase here would be a second statement of the argument names an
               agent actually has to send, and the two would drift the first time one was
               renamed. */
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
            aside={<ComingSoonBadge />}
          >
            {/* `data-client` is the row's identity in the markup, and it is there for the
                guard rather than for the browser: asserting that the page CONTAINS every
                snippet is satisfied by a page that prints them all against the wrong
                labels, which is exactly the mistake the design handoff made when it
                collapsed four clients onto one line of JSON that fits none of them. */}
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
        Every snippet above is real configuration for a real endpoint. The command inside it is
        the part that fails: the package it runs is not published to npm.
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
        One command, one interview, and a folder. Not a card&rsquo;s{" "}
        <code className="font-mono text-blueprint-ink">skill:</code> field, which points at a
        document for one node: this one writes the graph.
      </Framing>
      <div className="flex min-w-0 flex-wrap items-start gap-2">
        <pre className="panel min-w-0 flex-1 overflow-x-auto px-3.5 py-3 font-mono text-xs leading-relaxed text-blueprint-ink">
          <code>{SKILL_INSTALL_COMMAND}</code>
        </pre>
        <CopyButton
          text={SKILL_INSTALL_COMMAND}
          ariaLabel="Copy the command that installs the DarkPrint skill"
        />
        <ComingSoonBadge />
      </div>
      <p className="text-sm leading-relaxed text-dim">
        The skills CLI reads this over git, and the repository it names is not publicly readable
        yet, so the command fails the same way{" "}
        <code className="font-mono text-blueprint-ink">{NPX_INVOCATION}</code> does.{" "}
        <Link href={SKILL_ROUTE}>Assisted Design</Link> is the page that explains it, and{" "}
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
          {/* The five are `SkillSetup`'s own array, which is what `/skill` prints. SKILL.md
              runs to twenty-four numbered questions plus a risk table, so this column is a
              selection and the sentence below says so rather than letting five read as all
              of them. */}
          <p className="text-sm leading-relaxed text-dim">
            Five of about thirty. The interview also walks a risk sheet per node and derives
            every name and version itself.
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
          {/* Under its own rule rather than as a fourth row: neither of these is a file the
              skill writes, and a reader counting outputs under a heading that says Writes
              would count five. */}
          <p className="text-sm leading-relaxed text-dim">
            Nothing here checks that output. The skill is a document your agent runs, and no
            gate in this repository fails on the day what it writes stops matching this list.
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
        lead="Every operation, from three places: a terminal, an agent, an editor."
      />
      <p className="mt-3 text-sm leading-relaxed text-dim">
        <span className="text-emerald">live</span> works as printed ·{" "}
        <span className="text-blueprint-ink">checkout</span> runs from a clone, not npm ·{" "}
        <span className="text-amber">not built</span> as it says ·{" "}
        <span className="text-muted">by design</span> a shipped constraint, not a gap
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
