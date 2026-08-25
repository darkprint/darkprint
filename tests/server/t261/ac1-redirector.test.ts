/* ============================================================
   T261 AC1 — `/blueprints/{slug}` 308s to the owner path with the
   query string intact.

   D-261-02 ruled the mechanism PAGE-LEVEL and refused the config
   arm twice over, and that choice is what makes AC1 a criterion at
   all. The two arms differ on exactly the property AC1 pins:

     next.config redirects()   query passed through AUTOMATICALLY
                               (`…/01-next-config-js/redirects.md:43`)
     permanentRedirect()       destination is VERBATIM

   Measured, not recalled — `permanentRedirect("/x?tag=y")` throws
   an error whose digest is:

       NEXT_REDIRECT;replace;/x?tag=y;308;

   Next puts nothing there that the caller did not. So under the
   ruled arm a redirector that hands over `/blueprints/{owner}/
   {slug}` and forgets `searchParams` DROPS THE QUERY SILENTLY,
   which breaks every shared filtered link. Under the config arm
   the same criterion would have been free and untestable. The
   instrument block below pins that difference, because if
   `permanentRedirect` ever started merging the incoming query,
   AC1's behavioural cells would pass without the redirector doing
   anything.

   ── what is here and what is not ──
   The redirector RESOLVES A SLUG AGAINST THE REGISTRY, so its
   behavioural cells need a database and live in the DB-window
   family with AC4 and AC6. What is here is everything that does
   not: the mechanism, the driver those cells will use, and the
   module shape AC3 rests on.

   `redirectOf` is exported for that family rather than duplicated
   there — one reader of the digest, so the two halves of AC1
   cannot come to disagree about what a 308 looks like.
   ============================================================ */

import { existsSync, readFileSync } from "node:fs";

import ts from "typescript";
import { permanentRedirect, redirect } from "next/navigation";
import { describe, expect, it } from "vitest";

import { ROUTES, FORCE_DYNAMIC, STATIC_PARAMS_MARKERS, canonicalBlueprintPath } from "./contract";

/** What a Next redirect throw actually carries. */
export interface Redirection {
  destination: string;
  status: number;
  /** Everything after `?`, or "" — the half AC1 is about. */
  query: string;
}

/**
 * Run something that is expected to redirect, and read the redirection off the throw.
 *
 * Returns `undefined` when nothing redirected, so a caller can tell "rendered a page"
 * from "redirected somewhere wrong" — two different failures with two different repairs.
 * A cell that only asserted `rejects.toThrow()` would accept both, and would also accept a
 * page that threw for an entirely unrelated reason (D-WAVE's `rejects` laundering note).
 */
export async function redirectOf(run: () => unknown): Promise<Redirection | undefined> {
  try {
    await run();
    return undefined;
  } catch (error) {
    const digest = (error as { digest?: unknown }).digest;
    if (typeof digest !== "string" || !digest.startsWith("NEXT_REDIRECT")) throw error;
    // `NEXT_REDIRECT;<kind>;<url>;<status>;`
    const [, , url = "", status = ""] = digest.split(";");
    const at = url.indexOf("?");
    return {
      destination: at === -1 ? url : url.slice(0, at),
      status: Number(status),
      query: at === -1 ? "" : url.slice(at + 1),
    };
  }
}

describe("AC1's mechanism, pinned so the criterion cannot go free", () => {
  it("permanentRedirect is a 308 and redirect is not", async () => {
    const permanent = await redirectOf(() => permanentRedirect("/blueprints/o/s"));
    expect(permanent?.status, "`permanentRedirect` no longer emits 308").toBe(308);

    // The near-miss: the two differ by one digit and by the whole meaning of the rename.
    // A redirector reaching for `redirect` instead ships a 307 that tells clients to keep
    // asking, on a move the section calls a decision rather than an experiment.
    const temporary = await redirectOf(() => redirect("/blueprints/o/s"));
    expect(
      temporary?.status,
      "`redirect` now emits the same status as `permanentRedirect`, so nothing below can " +
        "tell a permanent move from a temporary one",
    ).not.toBe(308);
  });

  /*
   * The property AC1 exists because of, and the reason D-261-02's arm choice matters.
   *
   * If this ever fails — if Next starts merging the incoming request's query into the
   * destination — then the behavioural AC1 cells in the DB-window family would pass
   * against a redirector that never touched `searchParams`, and AC1 would be free again.
   */
  it("carries only the query the caller wrote, and drops it when the caller omits one", async () => {
    const withQuery = await redirectOf(() =>
      permanentRedirect(`${canonicalBlueprintPath("darkprint", "starter")}?tag=agents&sort=new`),
    );
    expect(withQuery?.destination).toBe("/blueprints/darkprint/starter");
    expect(withQuery?.query, "the caller's own query did not survive the throw").toBe(
      "tag=agents&sort=new",
    );

    const without = await redirectOf(() =>
      permanentRedirect(canonicalBlueprintPath("darkprint", "starter")),
    );
    expect(
      without?.query,
      "`permanentRedirect` is now adding a query the caller did not write. AC1 has become " +
        "free: a redirector that ignores `searchParams` would satisfy it. The behavioural " +
        "cells in the DB-window family are measuring nothing until this is understood.",
    ).toBe("");
  });

  it("reports `undefined` rather than throwing when nothing redirects", async () => {
    // The discriminator that keeps a behavioural cell from being satisfied by any throw at
    // all: a page that raises a database error must not read as "redirected".
    expect(await redirectOf(() => "rendered")).toBeUndefined();
    await expect(
      redirectOf(() => {
        throw new Error("connection refused");
      }),
    ).rejects.toThrow("connection refused");
  });
});

describe("AC3: the redirector and the canonical route carry no build-time param list", () => {
  /*
   * `dynamicParams = false` and `generateStaticParams` over the archive cannot serve a
   * registry that grows between deploys, so both go — that deletion IS what AC3 proves
   * happened. Asserted on the module's own exports, parsed rather than grepped: a
   * commented-out `generateStaticParams` is not an export, and a grep cannot tell.
   */
  const routes = [ROUTES.redirector, ROUTES.canonical, ROUTES.nodes, ROUTES.ontology] as const;

  it.each(routes)("%s exports no static-params surface", (path) => {
    if (!existsSync(path)) {
      // The canonical route does not exist before the cutover. Say which, rather than
      // letting an absent file pass an "exports nothing" assertion.
      expect(
        path === ROUTES.canonical,
        `${path} does not exist, and it is not the route the migration creates`,
      ).toBe(true);
      return;
    }

    const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
    const exported: string[] = [];
    source.forEachChild((node) => {
      const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
      if (!modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) return;
      if (ts.isFunctionDeclaration(node) && node.name) exported.push(node.name.text);
      if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) exported.push(decl.name.getText());
      }
    });

    const offenders = STATIC_PARAMS_MARKERS.map((marker) => marker.replace("export const ", "").replace("export ", ""))
      .filter((name) => exported.includes(name));

    expect(
      offenders,
      `${path} still exports ${offenders.join(", ")}.\n\n` +
        `A build-time parameter list cannot serve a registry that grows between deploys — ` +
        `a blueprint published after the last deploy would 404 at its own URL, which is AC3. ` +
        `D-261-03 rules the replacement is \`${FORCE_DYNAMIC}\`, per-request, not a longer list.`,
    ).toEqual([]);
  });

  it.each(routes)("%s marks itself per-request in the ruled spelling", (path) => {
    if (!existsSync(path)) return;
    const raw = readFileSync(path, "utf8");
    // `raw.includes(...)` and not `expect(raw).toContain(...)`: these files run to a
    // thousand lines, and a failing `toContain` prints the whole of one as a diff. A red
    // nobody scrolls to the end of is a red nobody reads.
    expect(
      raw.includes(FORCE_DYNAMIC),
      `${path} does not carry \`${FORCE_DYNAMIC}\`.\n\n` +
        `D-261-03 extends D-260-05 in writing and names this spelling specifically: ` +
        `\`connection()\` throws when a page function is invoked directly under ` +
        `\`environment: "node"\`, which is how D-260-09's cells and this suite's own ` +
        `DB-window family drive these routes. The prettier spelling would red a correct page.`,
    ).toBe(true);
  });
});
