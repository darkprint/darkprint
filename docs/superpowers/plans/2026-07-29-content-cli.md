# Content & CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the landing's usage-framing copy tweaks, a coming-soon CLI callout, a new
`/install` page, and live "dark factory" classification on `/build`.

**Architecture:** Three independent content/page changes plus one component-reuse task.
Task 4 depends on `components/ui/AutonomyBar.tsx` from the visual-polish plan
(`docs/superpowers/plans/2026-07-29-visual-polish.md`, Task 2) — **that task must be
merged before Task 4 of this plan starts.** Tasks 1-3 have no dependency on the other
plan and can run in any order, including before it.

**Tech Stack:** Next.js App Router, React 19 (one new client component for tab
switching), Tailwind v4, vitest (`environment: "node"`, `renderToStaticMarkup`-based
tests — no jsdom/testing-library in this repo).

## Global Constraints

- **Doc 2 §0.4 — nothing may be described as working that is not built.** Every new
  surface describing MCP access must say plainly it isn't live yet, in the same place the
  capability is suggested (not just once, buried). `SectionDoors.tsx`'s own "There is
  nowhere to publish yet" line is the existing precedent to match.
- **No real MCP server or CLI package is being built in this plan.** Only the
  positioning/marketing surface (CLI callout + `/install` page). If that's ever built, it
  is a separate spec and plan.
- **`components/home/beats.test.ts` covers all 5 landing beats, including `SectionDoors`
  (beat 5) and its own describe block asserting exact copy** ("nothing here is rounded
  up", the three counts). It also runs three checks across **all** beats: no `<table>`,
  no `<pre>`, no YAML-shaped `key:` text, and — critically — **no beat's static markup
  may contain the literal string `"opacity-0"`**. Task 2's new CLI block must not use
  `<pre>`/`<code>` tags or any `opacity-0` class, or it will fail this suite.
- **`components/site/nav.test.ts`** requires every top-level route under `app/` to have
  a header nav entry (with narrow, justified exceptions), the header and footer to agree
  on any shared label, and no two nav items in one group to have one label containing
  another. Task 3's new `/install` route must satisfy all of this.
- `npm test`, `npm run typecheck`, and `npm run build` must pass after every task.

---

### Task 1: Landing page — usage-framing copy

**Files:**
- Modify: `components/home/SectionBlueprint.tsx:124-130`
- Modify: `components/home/SectionNodeIsCard.tsx:269-275`
- Test: existing `components/home/beats.test.ts` (no new assertions needed — its
  existing beat-2/beat-3 checks target the graph labels and absence/prohibition text,
  not the lead sentence, so they're unaffected by this copy change and serve as the
  regression check)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing consumed by later tasks.

No TDD cycle here — this is a prose-only change with an existing test suite as the
regression guard, not a new behavior to drive out with a new test.

- [ ] **Step 1: Confirm the baseline passes**

```bash
npx vitest run components/home/beats.test.ts
```

Expected: PASS (establishes the "before" state).

- [ ] **Step 2: Edit `SectionBlueprint.tsx`'s lead sentence**

Change (lines 124-130):
```tsx
        <SectionHeading
          eyebrow="The drawing"
          title="This is a blueprint"
          lead="Which agents run, and what each one hands to the next."
          align="center"
          className="mx-auto"
        />
```
to:
```tsx
        <SectionHeading
          eyebrow="The drawing"
          title="This is a blueprint"
          lead="Which agents run, what each one hands to the next, and it is already yours to run."
          align="center"
          className="mx-auto"
        />
```

- [ ] **Step 3: Edit `SectionNodeIsCard.tsx`'s lead sentence**

Change (lines 269-275):
```tsx
        <SectionHeading
          eyebrow="One node"
          title="Every node is a card"
          lead="Open one and it says which model runs it and what must never reach it."
          align="center"
          className="mx-auto"
        />
```
to:
```tsx
        <SectionHeading
          eyebrow="One node"
          title="Every node is a card"
          lead="Open one and it says which model runs it, what must never reach it, and it pins into your own blueprint by version."
          align="center"
          className="mx-auto"
        />
```

- [ ] **Step 4: Run the regression suite, typecheck**

```bash
npx vitest run components/home/beats.test.ts && npm run typecheck
```

Expected: all pass — in particular the beat-2 and beat-3 describe blocks, which assert
role labels and the absence/prohibition text, not the lead sentence.

- [ ] **Step 5: Run the full suite**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add components/home/SectionBlueprint.tsx components/home/SectionNodeIsCard.tsx
git commit -m "Pivot the landing's two concept beats toward what you do with a blueprint/node"
```

---

### Task 2: `npx darkprint setup` CLI callout in `SectionDoors`

**Files:**
- Create: `components/ui/ComingSoonBadge.tsx`
- Modify: `components/home/SectionDoors.tsx`
- Test: existing `components/home/beats.test.ts`, extended with one new `it` in the
  existing `"beat 5 says where its numbers come from"` describe block

**Interfaces:**
- Consumes: nothing.
- Produces: `ComingSoonBadge` — reused by Task 3 (`/install` page).

- [ ] **Step 1: Write the failing test**

In `components/home/beats.test.ts`, inside the existing `describe("beat 5 says where its
numbers come from", ...)` block (currently ends after the `"prints a count to stand
behind"` test), add:

```ts
  it("says the CLI setup is not live yet", () => {
    expect(words).toContain("npx darkprint setup");
    expect(words.toLowerCase()).toContain("coming soon");
    expect(words.toLowerCase()).toContain("not built yet");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/home/beats.test.ts`
Expected: FAIL — `"says the CLI setup is not live yet"` fails, nothing else.

- [ ] **Step 3: Create `ComingSoonBadge`**

```tsx
// components/ui/ComingSoonBadge.tsx
import { cx } from "@/lib/format";

/** A small, plain "not live yet" marker — amber, never the alarm/signal color, since
    this states a timeline fact and not a defect. Doc 2 §0.4: used wherever a surface
    describes something that does not exist yet. */
export function ComingSoonBadge({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border border-amber/40 bg-amber/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-amber",
        className,
      )}
    >
      Coming soon
    </span>
  );
}
```

- [ ] **Step 4: Add the CLI block to `SectionDoors`**

Add the import, alongside the existing ones:
```tsx
import Link from "next/link";
import { ComingSoonBadge } from "@/components/ui/ComingSoonBadge";
```

Insert a new block between the two-door grid and the closing honesty paragraph.
Currently (end of file):
```tsx
          <Door
            title="Build your own"
            line="An hour of choices, and a factory that downloads to your machine."
            href="/build"
            cta="Start the guided path"
          />
        </div>

        <p className="mt-8 text-center text-sm leading-relaxed text-blueprint-ink/80">
          The guided path ends at the download. There is nowhere to publish yet.
        </p>
      </div>
    </section>
  );
}
```

Change to:
```tsx
          <Door
            title="Build your own"
            line="An hour of choices, and a factory that downloads to your machine."
            href="/build"
            cta="Start the guided path"
          />
        </div>

        {/* The CLI callout. No `<pre>`/`<code>` here — `components/home/beats.test.ts`
            bans code blocks on every landing beat, since the landing quotes no page it
            introduces. Plain `<div>`s carry the same monospace look without tripping it. */}
        <div className="mt-8 rounded-lg border border-blueprint-line/40 bg-void/40 p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-xl font-semibold text-blueprint-ink">
              Bring it into your agent
            </h3>
            <ComingSoonBadge />
          </div>
          <div className="mt-4 rounded-md border border-line bg-void px-4 py-3 font-mono text-sm text-blueprint-ink">
            <div>
              <span className="text-blueprint-line">$</span> npx darkprint setup
            </div>
            <div className="mt-2 text-blueprint-ink/60">
              <div>Connecting to the registry...</div>
              <div>Blueprints and node cards now available to your agent.</div>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-blueprint-ink/80">
            An MCP server for the registry is not built yet.{" "}
            <Link
              href="/install"
              className="underline decoration-blueprint-line/60 underline-offset-4 hover:text-blueprint-ink"
            >
              See what it will do
            </Link>
            .
          </p>
        </div>

        <p className="mt-8 text-center text-sm leading-relaxed text-blueprint-ink/80">
          The guided path ends at the download. There is nowhere to publish yet.
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Run test to verify it passes, and check the whole file for regressions**

```bash
npx vitest run components/home/beats.test.ts
```

Expected: PASS — including the pre-existing "no table/pre/YAML" and "no opacity-0"
cross-beat checks (this new block introduces neither), and the existing count/honesty-line
assertions (untouched `Door` components).

- [ ] **Step 6: Run the full suite and typecheck**

```bash
npm test && npm run typecheck
```

Expected: all pass.

- [ ] **Step 7: Visual check**

```bash
npm run dev
```

Open `/`, scroll to the "Read one, or build one" section. Confirm the two doors are
unchanged, the three counts and honesty line are unchanged, and a new "Bring it into
your agent" block appears below them with a visible "Coming soon" badge and a working
link to `/install` (will 404 until Task 3 ships — that's expected at this point).

- [ ] **Step 8: Commit**

```bash
git add components/ui/ComingSoonBadge.tsx components/home/SectionDoors.tsx components/home/beats.test.ts
git commit -m "Add a coming-soon npx darkprint setup callout to the landing's closing section"
```

---

### Task 3: New `/install` page

**Files:**
- Create: `components/install/clients.ts`
- Create: `components/install/InstallTabs.tsx`
- Create: `components/install/InstallTabs.test.ts`
- Create: `app/install/page.tsx`
- Modify: `components/site/SiteHeader.tsx` (the `NAV` array)
- Modify: `components/site/SiteFooter.tsx` (the `COLS` array)

**Interfaces:**
- Consumes: `ComingSoonBadge` from Task 2.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing test for the tabs component**

```ts
// components/install/InstallTabs.test.ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { InstallTabs } from "@/components/install/InstallTabs";
import { MCP_CLIENTS } from "@/components/install/clients";
import { plainText } from "@/components/ui/visible-text";

describe("InstallTabs", () => {
  it("names every client as a tab", () => {
    const html = renderToStaticMarkup(createElement(InstallTabs));
    const text = plainText(html);
    for (const client of MCP_CLIENTS) {
      expect(text).toContain(client.label);
    }
  });

  it("shows the first client's snippet by default", () => {
    const html = renderToStaticMarkup(createElement(InstallTabs));
    expect(html).toContain(MCP_CLIENTS[0].snippet.split("\n")[0]);
  });

  it("marks itself coming soon", () => {
    const html = renderToStaticMarkup(createElement(InstallTabs));
    expect(plainText(html).toLowerCase()).toContain("coming soon");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/install/InstallTabs.test.ts`
Expected: FAIL — `Cannot find module '@/components/install/InstallTabs'`.

- [ ] **Step 3: Write the client list**

```ts
// components/install/clients.ts

/* ============================================================
   What each MCP client's config will look like, once the registry
   has a server to point at. Coming-soon content: see doc 2 §0.4 —
   `InstallTabs.tsx` and `app/install/page.tsx` both say plainly
   this isn't live, everywhere the capability is suggested.
   ============================================================ */

export interface McpClientSetup {
  id: string;
  label: string;
  snippet: string;
}

export const MCP_CLIENTS: readonly McpClientSetup[] = [
  {
    id: "claude-code",
    label: "Claude Code",
    snippet: "claude mcp add darkprint -- npx -y darkprint mcp",
  },
  {
    id: "claude-desktop",
    label: "Claude Desktop",
    snippet: `{
  "mcpServers": {
    "darkprint": {
      "command": "npx",
      "args": ["-y", "darkprint", "mcp"]
    }
  }
}`,
  },
  {
    id: "cursor",
    label: "Cursor",
    snippet: `{
  "mcpServers": {
    "darkprint": {
      "command": "npx",
      "args": ["-y", "darkprint", "mcp"]
    }
  }
}`,
  },
  {
    id: "vscode",
    label: "VS Code",
    snippet: `{
  "servers": {
    "darkprint": {
      "command": "npx",
      "args": ["-y", "darkprint", "mcp"]
    }
  }
}`,
  },
] as const;
```

- [ ] **Step 4: Write the tabs component**

```tsx
// components/install/InstallTabs.tsx
"use client";

import { useState } from "react";
import { ComingSoonBadge } from "@/components/ui/ComingSoonBadge";
import { cx } from "@/lib/format";
import { MCP_CLIENTS } from "./clients";

export function InstallTabs() {
  const [active, setActive] = useState<string>(MCP_CLIENTS[0].id);
  const current = MCP_CLIENTS.find((c) => c.id === active) ?? MCP_CLIENTS[0];

  return (
    <div className="panel p-4 sm:p-6">
      <div className="flex flex-wrap gap-2 border-b border-line pb-3" role="tablist">
        {MCP_CLIENTS.map((client) => (
          <button
            key={client.id}
            type="button"
            role="tab"
            aria-selected={client.id === active}
            onClick={() => setActive(client.id)}
            className={cx(
              "rounded-md px-3 py-1.5 font-mono text-xs uppercase tracking-[0.1em] transition-colors",
              client.id === active ? "bg-surface-2 text-fg" : "text-dim hover:text-fg",
            )}
          >
            {client.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-dim">
          {current.label} configuration
        </span>
        <ComingSoonBadge />
      </div>

      <pre className="mt-2 overflow-x-auto rounded-md border border-line bg-surface-2 p-3 font-mono text-xs text-fg">
        <code>{current.snippet}</code>
      </pre>
    </div>
  );
}
```

Note: `<pre>`/`<code>` are fine here — `components/home/beats.test.ts`'s ban on those
tags only scans the five landing beats (`BEATS` in that file); `/install` is a separate
route, not one of them.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run components/install/InstallTabs.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Write the page**

```tsx
// app/install/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { ComingSoonBadge } from "@/components/ui/ComingSoonBadge";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { InstallTabs } from "@/components/install/InstallTabs";

export const metadata: Metadata = {
  title: "Install",
  description:
    "How an agent will connect to the DarkPrint registry over MCP, once the server exists. Not built yet — nothing here runs.",
};

export default function InstallPage() {
  return (
    <div className="container-page py-16 sm:py-24">
      <SectionHeading
        eyebrow="MCP access"
        title="Bring blueprints and nodes into your agent"
        lead="Not built yet: this is what setup will look like once the registry has an MCP server to point a client at."
        align="center"
        className="mx-auto"
      />

      <div className="mx-auto mt-4 flex justify-center">
        <ComingSoonBadge />
      </div>

      <div className="mx-auto mt-10 max-w-2xl">
        <InstallTabs />
      </div>

      <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-muted">
        Once live, an MCP server here will expose every published blueprint and node card
        as a resource an agent can read directly — the same registry{" "}
        <Link
          href="/blueprints"
          className="underline decoration-line-bright underline-offset-4 hover:text-fg"
        >
          the gallery
        </Link>{" "}
        already browses by hand.
      </p>
    </div>
  );
}
```

- [ ] **Step 7: Wire the header nav**

In `components/site/SiteHeader.tsx`, in the `NAV` array, add an entry right after
`/build` (same "learn" group — it's a setup action, not a registry surface to browse):

```ts
  { href: "/build", label: "Build one", group: "learn" },
  { href: "/install", label: "Install", group: "learn" },
```

- [ ] **Step 8: Wire the footer**

In `components/site/SiteFooter.tsx`, in `COLS`'s `"Learn"` column, add the matching
entry right after `/build`:

```ts
      { href: "/build", label: "Build one" },
      { href: "/install", label: "Install" },
```

- [ ] **Step 9: Run `nav.test.ts`, the full suite, typecheck, and build**

```bash
npx vitest run components/site/nav.test.ts && npm test && npm run typecheck && npm run build
```

Expected: all pass — `nav.test.ts`'s "lists every top-level route in the header" now
finds `/install` covered, "points every header item at a route that exists" finds
`app/install/page.tsx`, and the label-collision checks find no conflicts.

- [ ] **Step 10: Visual check**

```bash
npm run dev
```

Open `/install`. Confirm: the tabs switch between clients, each showing a distinct config
snippet, a visible "Coming soon" badge is present near the tabs and near the page header,
and `/` → the CLI block's "See what it will do" link now resolves instead of 404ing.
Confirm `/install` appears in both the header nav and the footer.

- [ ] **Step 11: Commit**

```bash
git add components/install/ app/install/ components/site/SiteHeader.tsx components/site/SiteFooter.tsx
git commit -m "Add a coming-soon /install page with per-client MCP setup previews"
```

---

### Task 4: `/build` — live "dark factory" classification via `AutonomyBar`

**Prerequisite:** `components/ui/AutonomyBar.tsx` must already exist
(`docs/superpowers/plans/2026-07-29-visual-polish.md`, Task 2). Do not start this task
before that one has merged.

**Files:**
- Modify: `components/build/ScorePanel.tsx` (import, module comment, both the
  `ScorePanel` and `ScoreStrip` autonomy sections)
- Test: `components/build/ScorePanel.test.ts` (new)

**Interfaces:**
- Consumes: `AutonomyBar({ level, label, className? })` from the visual-polish plan.
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Write the failing test**

```ts
// components/build/ScorePanel.test.ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ALL_COMBINATIONS } from "@/components/build/choices";
import { buildState } from "@/components/build/state";
import { ScorePanel, ScoreStrip } from "@/components/build/ScorePanel";

const state = buildState(ALL_COMBINATIONS[0], false);
const autonomy = state.analysis?.autonomy;
if (autonomy === undefined) {
  throw new Error("fixture combination did not resolve an autonomy reading");
}

describe("ScorePanel shows the segmented autonomy gauge alongside the class label", () => {
  it("renders AutonomyBar's accessible name for the real reading", () => {
    const html = renderToStaticMarkup(createElement(ScorePanel, { autonomy }));
    expect(html).toContain(
      `Autonomy class ${autonomy.label}, level ${autonomy.level} of 4`,
    );
  });

  it("renders nothing extra when there is no resolved autonomy", () => {
    const html = renderToStaticMarkup(createElement(ScorePanel, {}));
    expect(html).toContain("No graph resolved, so nothing was counted.");
    expect(html).not.toContain("Autonomy class");
  });
});

describe("ScoreStrip shows the same gauge in its compact form", () => {
  it("renders AutonomyBar's accessible name for the real reading", () => {
    const html = renderToStaticMarkup(createElement(ScoreStrip, { autonomy }));
    expect(html).toContain(
      `Autonomy class ${autonomy.label}, level ${autonomy.level} of 4`,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/build/ScorePanel.test.ts`
Expected: FAIL — the accessible-name string isn't in the output yet.

- [ ] **Step 3: Wire `AutonomyBar` into `ScorePanel`**

Add the import:
```ts
import { AutonomyBar } from "@/components/ui/AutonomyBar";
```

In the "---------- autonomy ----------" block, change:
```tsx
            <div className="flex flex-wrap items-center gap-2">
              <Band>
                <span className="sr-only">Autonomy class </span>
                {autonomy.label}
              </Band>
            </div>
```
to:
```tsx
            <div className="flex flex-wrap items-center gap-2">
              <Band>
                <span className="sr-only">Autonomy class </span>
                {autonomy.label}
              </Band>
            </div>
            <AutonomyBar
              level={autonomy.level}
              label={autonomy.label}
              className="max-w-40"
            />
```

- [ ] **Step 4: Wire `AutonomyBar` into `ScoreStrip`**

In the same file, change:
```tsx
      {autonomy !== undefined && (
        <span className="text-muted">
          autonomy <span className="text-fg">{autonomy.label}</span>
        </span>
      )}
```
to:
```tsx
      {autonomy !== undefined && (
        <span className="flex items-center gap-2 text-muted">
          autonomy <span className="text-fg">{autonomy.label}</span>
          <AutonomyBar level={autonomy.level} label={autonomy.label} className="w-16" />
        </span>
      )}
```

- [ ] **Step 5: Annotate the module comment — the sixth place citing the no-ordinal rule**

At the top of `components/build/ScorePanel.tsx`, in the module comment (the block
starting "The panel that never leaves the screen."), add a paragraph before its closing
`*/`:

```ts
   ── The one named exception ──
   Added 2026-07-29: `AutonomyBar` (a separate component,
   `components/ui/AutonomyBar.tsx`) now renders a segmented gauge next to the class
   label above and in `ScoreStrip` below — the same deliberate, documented exception to
   the no-ordinal rule made for the blueprint card top
   (`docs/superpowers/specs/2026-07-29-visual-polish-design.md` §1). This file's own
   `Band`/`Was` treatment is unchanged: no fill, no track, no ordinal printed as a
   number anywhere else on this panel.
   ============================================================ */
```

(Insert this immediately before the file's existing closing `============================================================ */` line, replacing that closing line with the text above, which repeats it.)

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run components/build/ScorePanel.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Run the full suite, typecheck, and build**

```bash
npm test && npm run typecheck && npm run build
```

Expected: all pass — in particular `components/build/path.test.ts`'s walk of all 80
`ALL_COMBINATIONS` (unaffected — this task only adds a visual element driven by data
that walk already produces) and `components/ui/autonomy-surfaces.test.ts` (unaffected —
`AutonomyBar` still isn't `AutonomyMeter`, and this task doesn't touch alarm-color usage).

- [ ] **Step 8: Visual check**

```bash
npm run dev
```

Open `/build`, and step through the guided path choosing the approval mode that removes
every human gate (closed-loop / dark factory). Confirm the segmented bar next to "Your
factory"'s autonomy reading fills to all 4 segments (emerald) at that point, and updates
live as you change the approval choice back and forth. Confirm the compact `ScoreStrip`
(narrow viewport, or resize the window) shows the same bar.

- [ ] **Step 9: Commit**

```bash
git add components/build/ScorePanel.tsx components/build/ScorePanel.test.ts
git commit -m "Show the segmented autonomy gauge live in /build's score panel"
```

---

## Self-Review

**Spec coverage:** Task 1 covers content-cli-design.md §1 (landing usage framing). Task 2
covers §2 (CLI callout) and states the MCP-server scope decision from the spec's own
"Scope decision" section (doc 2 §0.4 compliance, no real server). Task 3 covers §3
(`/install` page). Task 4 covers §4 (`/build` live classification), explicitly reusing
`AutonomyBar` per the spec's instruction not to duplicate analysis logic.

**Placeholder scan:** No TBD/TODO. The MCP client config snippets in Task 3 are
illustrative/coming-soon by design (the spec requires this), not placeholders for missing
real logic — they're clearly labeled "Coming soon" everywhere they appear, satisfying doc
2 §0.4 rather than evading it.

**Type consistency:** `AutonomyBar`'s `{ level, label }` prop shape (defined in the
visual-polish plan's Task 2) is used identically here in Task 4 against `AutonomyResult`
(`autonomy.level`, `autonomy.label` — both exist on `AutonomyResult` per
`lib/core/analysis/autonomy.ts`). `McpClientSetup` (Task 3) is used with matching field
names (`id`, `label`, `snippet`) in both `clients.ts` and `InstallTabs.tsx`.

**A note on task ordering:** Tasks 1-3 have no dependency on the visual-polish plan and
can be executed in parallel with it or before it. Task 4 is blocked on that plan's Task 2
specifically (not the whole plan) — if executing both plans via subagent-driven
development, Task 4 here should be sequenced after that one task lands, not necessarily
after the whole other plan finishes.
