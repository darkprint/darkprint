/* ============================================================
   The sentences this site is not allowed to stop saying.

   Every entry below qualifies something a page prints: a command that looks runnable, a
   figure that looks measured, a check that looks complete. Each one has gone missing at
   least once during a pass that was cutting for length, so each is held here, over the
   component the page renders, against the real archive under `content/`.

   `open` means the sentence must be readable without opening anything, because it
   qualifies something printed in the open beside it. `present` is enough when the thing
   it qualifies sits inside the same closed disclosure.

   A row leaves this file only when the claim it guards has nothing left to guard, or when
   the claim has become false in the other direction. Either way the reason goes in the
   commit that removes it. The rows for `/mcp`, `/skill` and `/capabilities` live beside
   those pages now, in `components/mcp` and `components/skill`.
   ============================================================ */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import SpecCardPage from "@/app/spec/card/page";
import UploadPage from "@/app/upload/page";
import { allBlueprints } from "@/lib/content";
import { CARD_ROWS } from "@/components/spec/rows";
import { GuardrailShape } from "@/components/explain/ConceptFigures";
import { BlueprintCanvas } from "@/components/blueprint/BlueprintCanvas";
import { CloneMenu } from "@/components/blueprint/CloneMenu";
import { CodeMenu } from "@/components/bundle/CodeMenu";
import { SectionFirstBlueprint } from "@/components/home/SectionFirstBlueprint";
import { openText, plainText } from "@/components/ui/visible-text";

/* --------------------- the surfaces --------------------- */

const BLUEPRINTS = allBlueprints();

/**
 * The explainability panel over one archive blueprint. `/upload`'s validation report is the
 * surface that mounts it today, over the graph a reader has just dropped in.
 */
function canvas(slug: string): string {
  const bp = BLUEPRINTS.find((b) => b.slug === slug);
  if (bp === undefined) throw new Error(`no blueprint ${slug} in content/`);
  return renderToStaticMarkup(
    createElement(BlueprintCanvas, { graph: bp.graph, analysis: bp.analysis }),
  );
}

const SPEC_CARD = renderToStaticMarkup(createElement(SpecCardPage as never));

/**
 * `/upload`, whole: the one route where a reader hands the site a file. The page is written
 * in the route file, and lifting a sentence into a component to make it testable would move
 * it for a test's convenience.
 */
const UPLOAD_PAGE = renderToStaticMarkup(createElement(UploadPage as never));

/**
 * The guardrail figure on `/what-a-blueprint-is#the-words`. Its right-hand column names
 * live-path actions (retrying a call, capping a budget, blocking a call in flight) that this
 * site never performs, and the possessive in its head is the only thing that says whose
 * they are.
 */
const GUARDRAILS = renderToStaticMarkup(createElement(GuardrailShape));

/** The landing's lifecycle beat, held to the length floor so the render is a real one. */
const ENDING = renderToStaticMarkup(createElement(SectionFirstBlueprint));

/**
 * The starter is the one archive blueprint whose criteria walk stops at a judge, so it is
 * the only one carrying the feedback-against-gaming statement. Asserted rather than assumed
 * below.
 */
const STARTER = canvas("starter-software-factory");

/**
 * The two "Get" menus, exactly as the two header bands mount them: `CodeMenu` on a blueprint
 * page and `CloneMenu` on a card page. Each offers a Download that works beside a `darkprint`
 * clone line that does not run on a stranger's machine, and a reader who has just been
 * handed a working file reads the next code block as another working thing unless the panel
 * says otherwise. Both are native `<details>`, so the whole panel is in the static markup
 * whether it is open or shut; `present` is enough because nothing they qualify is in the
 * open.
 */
const CODE_MENU = renderToStaticMarkup(
  createElement(CodeMenu, {
    download: {
      href: "/api/bundles/autogen/starter-software-factory/archive?digest=sha256%3Aabc",
      name: "starter-software-factory-1.0.0.tgz",
    },
    cloneCommand: "npx -y darkprint clone autogen/starter-software-factory",
  }),
);
const CLONE_NODE = renderToStaticMarkup(
  createElement(CloneMenu, {
    kind: "node",
    cloneCommand: "npx -y darkprint clone lupo/spec-planner@1.0.0",
  }),
);

/* --------------------- the ledger --------------------- */

type Where = "open" | "present";

interface Claim {
  /** What the sentence is for, in the failure message. */
  why: string;
  /** Verbatim, lowercased at compare time. A paraphrase is a different sentence. */
  says: string;
  /** `open` when it qualifies something printed in the open beside it. */
  where: Where;
  html: string;
  surface: string;
}

/* The unanchored limit statement is not in this table. It is held over every archive
   blueprint in that state, one case each, by the test under it. */
const CLAIMS: Claim[] = [
  {
    surface: "/upload · the validation report's criteria trace",
    why: "why a channel the analysis cannot follow is worth naming at all; every hint on that list sits behind a closed disclosure",
    says: "seeing the evidence of a failure you caused is feedback. seeing the criteria is gaming",
    where: "open",
    html: STARTER,
  },
  {
    surface: "/upload · the validation report's criteria trace",
    why: "the limit stated in both directions: what the reading did, and what its silence means",
    says: "not evidence of a leak. it is not evidence of isolation either",
    where: "open",
    html: STARTER,
  },

  /* ---- /spec/card ---- */
  {
    surface: "/spec/card · the `cannot[]` entry in the subfield list",
    why: "half of the page's thesis: the free-text promise is legitimate beside the checked refusal, and without this sentence an entry nothing checks reads as an entry that failed",
    says: "both are legitimate. a reader has to be able to tell which is which without running anything",
    where: "open",
    html: SPEC_CARD,
  },
  {
    surface: "/spec/card · the checker's own diagnostic, quoted under the field list",
    why: "the severity of the refusal in word form, read off the demonstration rather than typed",
    says: "error bundle/prohibition-violated",
    where: "open",
    html: SPEC_CARD,
  },

  /* ---- /what-a-blueprint-is · the guardrail figure ---- */
  {
    surface: "/what-a-blueprint-is#the-words · the guardrail figure's right-hand column",
    why: "the column lists retry, budget caps and blocking a call in flight. None of that happens here, and the possessive is the only thing that says so. Drop it and the figure claims a live path on the page whose whole subject is what a blueprint can and cannot promise",
    says: "an example of what your harness does with it",
    where: "open",
    html: GUARDRAILS,
  },

  /* ---- /upload ---- */
  {
    surface: "/upload · the other door",
    why: "the paragraph above it says a tool inside the reader's own editor writes a folder for this page, and the next question anybody asks is how it gets here. The DarkPrint skill's hand-off publishes over POST /api/bundles with a write-scoped key from the terminal it runs in, and this page is the other way in; a page that says nothing about the first leaves a reader thinking the folder has to be carried by hand",
    says: "the darkprint skill ends with a publish command for the terminal it runs in",
    where: "open",
    html: UPLOAD_PAGE,
  },

  /* ---- the "Get" menus ----
     The blueprint menu used to be held to "not built yet: a darkprint cli that clones a
     blueprint by name". That sentence became false in the other direction: `darkprint clone`
     is implemented. What is still true, and what the panel now says, is that the package is
     not published to npm, so the printed line runs on nobody's machine and the verb itself
     runs from a build of the repository. */
  {
    surface: "/blueprints/<owner>/<slug> · Get blueprint",
    why: "the panel prints a `darkprint clone` line with a copy button under a Download that really works, and a code block beside a working item reads as runnable. This is the sentence saying the CLI line does not run on a machine that has never seen the repository",
    says: "the darkprint package is not published to npm",
    where: "present",
    html: CODE_MENU,
  },
  {
    surface: "/blueprints/<owner>/<slug> · Get blueprint",
    why: "what the two items are, and what neither is. An item named Clone promises a repository to a reader who knows the word; there is none behind a release and no history, so Download hands over the files as they stand and Clone fetches the same files by name",
    says: "there is no repository and no history behind a release",
    where: "present",
    html: CODE_MENU,
  },
  {
    surface: "/nodes/<id> · Get card",
    why: "the same limit on the card page's own menu, so a reader who only ever opens a card still meets it. The noun differs because the CLI would clone a card there, and the card verb is not implemented",
    says: "not built yet: a darkprint cli that clones a card by name",
    where: "present",
    html: CLONE_NODE,
  },
];

/** The two dropdown panels, asserted together wherever the assertion is the same. */
const MENUS = [
  ["the blueprint download menu", CODE_MENU],
  ["the card download menu", CLONE_NODE],
] as const;

describe("the surfaces the ledger is read off", () => {
  it("rendered something on each of them", () => {
    // A ledger held over an empty string passes every case in it.
    for (const [name, html] of [
      ["/spec/card", SPEC_CARD],
      ["the starter's canvas", STARTER],
      ["/ · the ending", ENDING],
      ["/upload", UPLOAD_PAGE],
    ] as const) {
      expect(html.length, name).toBeGreaterThan(2000);
    }
    // Smaller surfaces get their own floor: a threshold they could never meet is no threshold.
    expect(GUARDRAILS.length, "the guardrail figure").toBeGreaterThan(900);
    for (const [name, html] of MENUS) {
      expect(html.length, name).toBeGreaterThan(900);
    }
    expect(BLUEPRINTS.length).toBe(10);
  });

  /**
   * There is no repository per blueprint, no remote and no history. The command that works
   * is a snapshot fetch, and the word may not reappear on either menu under any later
   * wording pass.
   */
  it("never says git on either download menu", () => {
    for (const [name, html] of MENUS) {
      expect(plainText(html).toLowerCase(), name).not.toContain("git");
    }
  });

  it("still has a blueprint whose criteria walk stops at a judge", () => {
    // The two starter claims above are only readable in the `relayed` state. If the archive
    // stops producing it, this fails here rather than passing vacuously there.
    expect(
      BLUEPRINTS.filter((bp) =>
        bp.analysis.security.diagnostics.some(
          (d) => d.code === "analysis/criteria-relayed-through-judge",
        ),
      ).map((bp) => bp.slug),
    ).toContain("starter-software-factory");
  });
});

describe("claims the site may not stop making", () => {
  it.each(CLAIMS.map((c) => [`${c.surface} — "${c.says.slice(0, 48)}…"`, c] as const))(
    "%s",
    (_name, claim) => {
      const body = (
        claim.where === "open" ? openText(claim.html) : plainText(claim.html)
      ).toLowerCase();
      expect(body, `${claim.why}. Surface: ${claim.surface}`).toContain(
        claim.says.toLowerCase(),
      );
    },
  );

  /**
   * The unanchored claim is held over every archive blueprint in that state rather than
   * over one, so a change that fixes the panel for the blueprint somebody happened to open
   * is not enough.
   */
  it("states the unanchored limit in the open on every blueprint in that state", () => {
    const unanchored = BLUEPRINTS.filter((bp) =>
      bp.analysis.security.diagnostics.some(
        (d) => d.code === "analysis/criteria-leak-unanchored",
      ),
    );
    expect(unanchored.length, "no blueprint is unanchored any more").toBeGreaterThan(0);
    for (const bp of unanchored) {
      expect(openText(canvas(bp.slug)).toLowerCase(), bp.slug).toContain(
        "the absence of a finding here is silence. it is not a clean verdict",
      );
    }
  });
});

describe("claims carried by data rather than by copy", () => {
  /**
   * The reason typed ports exist and the premise the whole `cannot` demonstration rests on.
   * A grep for "checkable" over the built pages found it nowhere else.
   */
  it("says what typed ports are for, on the field the ports are declared in", () => {
    const row = CARD_ROWS.find((r) => r.name === "inputs · outputs");
    expect(row, "the inputs · outputs row was renamed or removed").toBeDefined();
    expect(row?.what).toContain("makes an edge checkable at all");
  });
});

/* ============================================================
   /upload step 4: what the success screen claims
   ============================================================ */

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

/**
 * The wizard's ending, asserted over its SOURCE rather than over a render. The success
 * screen is step 4 of a stateful client component reached by a publish that resolves, and a
 * static render never arrives there. What is pinned is the claim: that the published branch
 * names the four things a reader is owed, and that the words the route may no longer say
 * are gone.
 */

/**
 * Source with its commentary removed. The copy check below is about what the PAGE says, and
 * a comment is not what the page says: a file whose comments explain why a retired sentence
 * was retired would red a correct page, and a check that matched comments could be satisfied
 * by deleting a comment while the sentence stayed on screen.
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/**
 * The sentences `/upload` may no longer say, now that pressing Publish publishes. Each is a
 * claim the cutover made false rather than merely dated. "not built yet" is deliberately not
 * here: it still stands over the editor push.
 */
const RETIRED_CLAIMS = [
  "nothing was sent",
  "nothing was saved",
  "nothing was uploaded",
  "nothing is uploaded",
  "nothing is sent",
  "not wired up",
  "there is no registry backend",
  "nothing leaves this tab",
] as const;

/**
 * Every source file that can put copy on `/upload`, enumerated off the filesystem so a file
 * somebody adds to the route next year is swept without anyone knowing this guard exists.
 */
function ROUTE_SOURCES(): { path: string; copy: string }[] {
  const out: { path: string; copy: string }[] = [];
  for (const dir of ["app/upload", "components/upload"]) {
    for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true, recursive: true })) {
      if (!entry.isFile()) continue;
      if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) continue;
      const path = join(entry.parentPath ?? dir, entry.name);
      out.push({ path, copy: withoutComments(readFileSync(path, "utf8")) });
    }
  }
  return out;
}

describe("/upload step 4 states what was stored", () => {
  /** The wizard with its commentary taken out, used by every cell below. */
  const FLOW = withoutComments(
    readFileSync(`${ROOT}/components/upload/UploadFlow.tsx`, "utf8"),
  );

  /**
   * Held over the source and not the render: two of the three places this route used to
   * say it, the success screen and the note behind the Publish button, are unreachable from
   * a static render. Every file that renders the route is swept, because the first version
   * read one file and passed while the dropzone still said "nothing is uploaded".
   */
  it("no longer says the bundle is not sent, saved or wired up, on ANY file that renders the route", () => {
    const surfaces = ROUTE_SOURCES();
    expect(surfaces.length, "the route's source files could not be read").toBeGreaterThan(3);

    for (const { path, copy } of surfaces) {
      for (const forbidden of RETIRED_CLAIMS) {
        expect(
          copy.toLowerCase(),
          `${path} still says "${forbidden}", which the Publish button made false`,
        ).not.toContain(forbidden);
      }
    }
  });

  /**
   * The four things a reader is owed after a release. Owner, slug and release are rendered
   * from what this tab submitted and only the digest comes back in the body, so this asserts
   * the four appear on the screen and nothing about the response shape.
   */
  it("names the owner, the slug, the release and the digest on the published branch", () => {
    const published = /outcome\.state === "published" \? \(([\s\S]*?)\) : outcome\.state === "refused"/.exec(
      FLOW,
    );
    expect(published, "the published branch of the outcome screen was restructured").not.toBeNull();
    const branch = published?.[1] ?? "";
    expect(branch, "the owner's handle is not named").toContain("session.handle");
    expect(branch, "the slug is not named").toContain("{slug}");
    expect(branch, "the release version is not named").toContain("declaredVersion");
    expect(branch, "the digest is not named").toContain("outcome.release.digest");
    expect(branch.toLowerCase(), "the screen does not say the bundle was stored").toContain(
      "stored as",
    );
  });

  /**
   * `unfinished` and `in-error` are both 422 and are two different sentences. An unfinished
   * folder HAS errors, so the count is available, and printing it is a decision rather than
   * an accident.
   */
  it("refuses an unfinished bundle in the unfinished wording, with no error count", () => {
    const arm = /if \(kind === "unfinished"\) \{([\s\S]*?)\n  \}/.exec(FLOW);
    expect(arm, "the unfinished refusal arm was restructured").not.toBeNull();
    const body = arm?.[1] ?? "";
    expect(body, "the unfinished refusal lost its wording").toContain("still being written");
    expect(body, "the unfinished refusal reaches for the error count").not.toContain("errorCount");
    expect(body, "the unfinished refusal counts errors").not.toContain("summarize");
    // The counts it MAY print are the two `bundleProgress` reports, from `progress.ts`.
    expect(body, "the unfinished refusal stopped saying how far along the folder is").toContain(
      "progress.placed",
    );
  });
});
