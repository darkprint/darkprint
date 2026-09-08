/* ============================================================
   The node card's header row, and the one paragraph under it.

   The owner set both on 2026-09-05: "In the node card, it should be star, fork, Download
   Card (with amber accent color to differentiate wrt to the blue accent color in the
   blueprint), the text of the specification should occupy the full horizontal length."

   Three of those four are things a later pass can undo without any test noticing, which is
   why they are held here:

   * the ORDER of the three controls, which is a reading order rather than a behaviour and
     survives nothing but a source walk;
   * the ACCENT, which is `--color-amber`, in the owner's own word. They asked for it on
     2026-09-05 and were answered with copper; they ruled it again on 2026-09-06 — "the
     amber should be the dominant color on the cards sections. So that an user in a glance
     can know wheter they are on a blueprint or in a card" — and `app/globals.css` now
     carries the card register as amber's third sanctioned job. What the copper answer was
     protecting is not lost, and the cells below are where it survives: the two honesty
     claims that also wear amber are separated from the register by SHAPE now that hue no
     longer separates them;
   * the WIDTH of the specification, which was `max-w-[68ch]` and is the whole reason the
     owner had to ask.

   ── Why the source and not only the markup ──
   `app/nodes/[...id]/page.tsx` is an async server component that reads Postgres and the
   content archive before it draws anything, so there is no cheap way to render it here.
   What the two rules above need is the shape of the JSX, which the source carries exactly.
   `components/site/anchors.test.ts` walks the tree for the same reason.

   The controls themselves ARE rendered, because their own states are what the walk cannot
   see: a `CardForkButton` that was handed no route has to say so, and the download trigger
   has to carry the register without carrying an honesty claim's shape.

   ── The fork's refusals are held as a table, not as a render ──
   `POST /api/cards/{id}/fork` shipped and this header now calls it. Its live
   half cannot be rendered here at all: it reaches for `useRouter`, which throws outside an
   App Router tree under `environment: "node"`, and there is no DOM to click in either. So
   the part worth guarding is held where it can be: `refusalFor` is a pure table from the
   `problem+json` type the route sends to the sentence a reader gets, and the cells below
   hold it against `lib/server/lineage/http.ts`'s own status map. A refusal the route can
   raise and this table has no arm for is a reader told "that fork was not accepted" when
   the answer was "choose a handle first", and nothing else in the tree would notice.
   ============================================================ */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CardForkButton, refusalFor, refusalKind } from "@/components/nodes/CardForkButton";
import { CloneMenu } from "@/components/blueprint/CloneMenu";
import { plainText } from "@/components/ui/visible-text";

const PAGE = readFileSync(
  fileURLToPath(new URL("../../app/nodes/[...id]/page.tsx", import.meta.url)),
  "utf8",
);

/** The server file that decides which `kind` becomes which status, and therefore which types exist. */
const LINEAGE_HTTP = readFileSync(
  fileURLToPath(new URL("../../lib/server/lineage/http.ts", import.meta.url)),
  "utf8",
);

/**
 * The three renders, drawn inside the case that reads them rather than at module scope.
 *
 * Measured, not stylistic: a mutation that made `CardForkButton` reach for `useRouter` on
 * the switched-off path throws `invariant expected app router to be mounted` under
 * `environment: "node"`. At module scope that throw takes the whole file down — "Tests: no
 * tests", thirteen cells absent and nothing said about the download control or the
 * specification, all from a defect in one of the three. Called from a case, the same throw
 * reds one case and leaves the other twelve reporting.
 */
const FORK_OFF = () => renderToStaticMarkup(createElement(CardForkButton, {}));

/**
 * The `<CardForkButton …/>` mount on the page, as source.
 *
 * Every rule about what the page HANDS the control is scoped to this slice rather than to
 * the whole file. `FavoriteStar` two lines above it passes `api:` and a count of its own,
 * so an unscoped match reads the star's props and reports them as the fork's. It did
 * exactly that on the first run of the endpoint cell below.
 */
const MOUNT = (() => {
  const at = PAGE.indexOf("<CardForkButton");
  return at === -1 ? "" : PAGE.slice(at, PAGE.indexOf("/>", at));
})();

const DOWNLOAD = () =>
  renderToStaticMarkup(
    createElement(CloneMenu, {
      kind: "node",
      cloneCommand: "npx -y darkprint clone lupo/spec-planner@1.0.0",
    }),
  );

const FOLDER = () =>
  renderToStaticMarkup(
    createElement(CloneMenu, {
      kind: "blueprint",
      cloneCommand: "npx -y darkprint clone darkprint/starter",
    }),
  );

describe("the walk and the renders found something", () => {
  it("read the page and drew both controls", () => {
    // A rule held over an empty string passes on every page there is.
    expect(PAGE.length).toBeGreaterThan(20000);
    expect(FORK_OFF().length).toBeGreaterThan(200);
    expect(DOWNLOAD().length).toBeGreaterThan(900);
    expect(FOLDER().length).toBeGreaterThan(900);
  });
});

describe("star, fork, download card, in that order", () => {
  /**
   * The three mounts, in the order the owner named them. `indexOf` is enough because each
   * of these three components is mounted exactly once on this page — asserted below, so a
   * second mount cannot quietly make this rule read the wrong pair.
   */
  const MOUNTS = ["<FavoriteStar", "<CardForkButton", "<CloneMenu"] as const;

  it.each(MOUNTS)("mounts %s exactly once", (tag) => {
    expect(PAGE.split(tag).length - 1, `${tag} is mounted a number of times that is not 1`).toBe(1);
  });

  it("draws them left to right as star, then fork, then the download", () => {
    const at = MOUNTS.map((tag) => PAGE.indexOf(tag));
    expect(at.every((i) => i !== -1), `one of ${MOUNTS.join(", ")} is not on the page`).toBe(true);
    expect(at[0], "Fork is drawn before Star").toBeLessThan(at[1]);
    expect(at[1], "the download is drawn before Fork").toBeLessThan(at[2]);
  });

  /**
   * A fork explainer held the first slot until this pass. It was a dropdown that
   * explained what forking a card would mean and then pointed at the download, which is the
   * wrong thing to draw beside a Fork button: two controls a click apart, the left one
   * explaining that the right one does not exist. A later pass restoring it would put four
   * controls in a row the owner asked down to three.
   */
  it("does not mount the fork explainer beside the fork button", () => {
    expect(PAGE).not.toContain("<ForkAction");
  });
});

describe("the fork control says what it is waiting on", () => {
  it("is switched off, and carries why", () => {
    expect(FORK_OFF()).toContain("Fork");
    expect(FORK_OFF()).toContain("disabled");
    expect(FORK_OFF()).toContain("has nothing to call");
  });

  /**
   * The additive-prop pattern, held from the off side. A caller that hands over no route
   * gets a control that cannot pretend: no pending label, and no click handler to fire.
   */
  it("does not draw as a live control without a route", () => {
    expect(FORK_OFF()).not.toContain("Forking…");
  });

  /**
   * **The count that is not there, and the reason it must not be a zero.**
   *
   * `lib/server/counters` publishes `starCount`, `downloadCount` and `noteCount` for a card
   * and no fork figure. A card fork's lineage is the forked row's own `provenance` string
   * (`CARD_FORK_PROVENANCE_PREFIX`), which no column indexes and no reader aggregates, so
   * there is no number to print. A literal `0` beside the working button this now is would
   * be true until the first fork and false from then on, with nothing in the tree to notice
   * the day it turns. Held over the rendered text rather than the source, because the thing
   * that must not appear is a figure a reader sees.
   */
  it("prints a label and no figure", () => {
    expect(plainText(FORK_OFF())).toBe("Fork");
  });

  it("is handed no count by the page either", () => {
    expect(MOUNT, "the page passes a fork count that nothing counts").not.toContain("forks");
  });
});

/* ============================================================
   The wiring, and the refusal table behind it.
   ============================================================ */

describe("the node page hands the control the route the route published", () => {
  /** The `api` the page builds for the fork, read out of the mount's own template literal. */
  const API = MOUNT.match(/api: `([^`]+)`/)?.[1];

  it("found the mount to read", () => {
    // A slice that matched nothing would pass every rule in this block.
    expect(MOUNT.length, "no <CardForkButton …/> mount on the page").toBeGreaterThan(80);
  });

  /**
   * The URL carries the BARE card id and nothing else. `app/api/cards/[...ref]/route.ts`
   * reads the last segment as the literal `fork` and joins everything before it into the
   * id, so `record.ref` (`id@version`) would address a card called `planner@1.2.0` and 404.
   * The version is not in the URL because there is no room for it; it goes in the body.
   */
  it("addresses the bare card id", () => {
    expect(API, "nothing on the page builds a fork endpoint").toBeDefined();
    expect(API).toBe("/api/cards/${card.id}/fork");
    expect(API).not.toContain("@");
  });

  /**
   * Three separate cases rather than three assertions in one, because the first failure in
   * a case hides the rest of it: a probe that broke the version AND the session reported
   * one red and would have read as one defect.
   */
  it("sends the version the page is showing", () => {
    expect(MOUNT).toContain("version: card.version");
  });

  it("asks the session whether the control is live", () => {
    expect(MOUNT).toContain('signedIn: actor.kind === "account"');
  });

  /**
   * No `visibility`, and this is the one prop whose absence is a decision. An omitted
   * visibility takes the forker's OWN account default (D-110-09); a constant chosen by a
   * button is exactly what that ruling refuses, and `"private"` is no safer a constant than
   * `"public"` since it overrides an account that chose otherwise.
   */
  it("names no visibility for the copy", () => {
    expect(MOUNT, "the page picks a visibility the account is supposed to pick").not.toContain(
      "visibility",
    );
  });
});

/**
 * Every `kind` the fork's status map answers, read out of the map rather than listed here.
 *
 * Derived so a kind added on the server side arrives in this suite on the day it is added.
 * A hardcoded list is a list of the refusals somebody remembered.
 */
const SERVER_KINDS: string[] = (() => {
  const open = LINEAGE_HTTP.indexOf("const STATUSES");
  const close = LINEAGE_HTTP.indexOf("};", open);
  const block = open === -1 ? "" : LINEAGE_HTTP.slice(open, close);
  return [...block.matchAll(/^\s*"([a-z-]+)":/gm)].map((m) => m[1]!);
})();

/**
 * The kinds this button can never receive, each for a reason rather than because it was
 * inconvenient.
 *
 * The first three are `forkBundle`'s. This control posts to `/api/cards/{id}/fork`, whose
 * handler calls `forkCard` and nothing else, so no bundle refusal can travel back through
 * it. `not-signed-in` is `forkCard`'s own and is unreachable through HTTP (D-110-10):
 * `withSession` answers a 401 typed `unauthorized` before the handler runs, and that type
 * IS handled below.
 */
const NOT_REACHABLE_HERE = new Set([
  "no-such-bundle",
  "no-such-release",
  "slug-taken",
  "not-signed-in",
]);

/** What a reader gets for a refusal nothing recognises. Every named kind must beat it. */
const FALLTHROUGH = refusalFor("a-kind-no-route-raises", undefined).say;

describe("every refusal the fork route can send is a different thing to say", () => {
  it("read the server's own status map", () => {
    // A derivation that matched nothing would pass every case below.
    expect(SERVER_KINDS.length).toBeGreaterThan(8);
    for (const kind of ["no-handle", "card-id-taken", "unreadable-card"]) {
      expect(SERVER_KINDS, `${kind} is not in the status map this suite reads`).toContain(kind);
    }
  });

  it.each(SERVER_KINDS.filter((kind) => !NOT_REACHABLE_HERE.has(kind)))(
    "answers fork-%s with a sentence of its own",
    (kind) => {
      const said = refusalFor(`fork-${kind}`, undefined).say;
      expect(said, `fork-${kind} falls through to the sentence for an unrecognised refusal`).not.toBe(
        FALLTHROUGH,
      );
    },
  );

  it.each(["unauthorized", "store-failed"])("answers %s with a sentence of its own", (kind) => {
    expect(refusalFor(kind, undefined).say).not.toBe(FALLTHROUGH);
  });

  /**
   * The sentences are the reader's, so none of them may carry the name of the function that
   * refused. `lib/server/lineage` opens every message with its own operation because that is
   * right in a log; a reader under a button is not looking at a function.
   */
  it.each(SERVER_KINDS)("fork-%s says nothing about a function", (kind) => {
    expect(refusalFor(`fork-${kind}`, "forkCard: something happened.").say).not.toContain("forkCard");
  });

  it("reads the kind off the type rather than off the status", () => {
    expect(refusalKind("https://darkprint.io/problems/fork-no-handle")).toBe("fork-no-handle");
    expect(refusalKind(undefined)).toBe("");
  });
});

describe("the four refusals a reader can do something about", () => {
  /**
   * 401 and 403 are two different sentences and the difference is the whole point. A
   * handle-less account is signed in already (T050 AC1 rules it legal, and
   * `PublicAuthor.handle` is nullable for it), so sending that reader to a sign-in page
   * answers a question they have answered.
   */
  it("offers sign-in for a missing session and settings for a missing handle", () => {
    expect(refusalFor("unauthorized", undefined).go?.href).toBe("/welcome");
    expect(refusalFor("fork-no-handle", undefined).go?.href).toBe("/settings");
  });

  it("does not read the missing handle as a missing session", () => {
    const said = refusalFor("fork-no-handle", undefined).say.toLowerCase();
    expect(said, "the handle refusal is written as a sign-in prompt").not.toContain("sign in");
    expect(said).toContain("handle");
  });

  /** The one refusal the optional `name` field exists for, and the only one that opens it. */
  it("opens the name field where another name would help", () => {
    expect(refusalFor("fork-card-id-taken", undefined).rename).toBe(true);
    expect(refusalFor("fork-card-id-invalid", undefined).rename).toBe(true);
  });

  /**
   * The grammar's own sentence, passed through with only the operation prefix taken off.
   * `lib/server/naming` derives the card-id rule from the engine's `CARD_ID`, so re-wording
   * it here would give one rule two authors that drift apart.
   */
  it("surfaces the grammar's sentence for a name a card id cannot carry", () => {
    expect(refusalFor("fork-card-id-invalid", "forkCard: `a b` is not a legal card name.").say).toBe(
      "`a b` is not a legal card name.",
    );
  });

  /**
   * The one refusal with no next step at all. The stored row predates the card schema, so
   * no copy of it can be written without inventing fields nobody wrote, and the route
   * answers 409 rather than 500 precisely because it is a fact about the target and not a
   * fault. Offering a retry would be the page disagreeing with the route about that.
   */
  it("offers no retry for a card that cannot be read at all", () => {
    const refusal = refusalFor("fork-unreadable-card", "forkCard: the stored card cannot be read.");
    expect(refusal.rename).toBeUndefined();
    expect(refusal.go).toBeUndefined();
    expect(refusal.say.toLowerCase()).not.toContain("try again");
    expect(refusal.say.toLowerCase()).toContain("will not change");
  });

  /**
   * B-03: a card nobody stored and a card private to somebody else are one answer, so this
   * sentence must not guess which. D-110-11 is the other half: the version is named only
   * after the read grant, so it gets its own sentence rather than being folded in.
   */
  it("keeps the absent card and the absent version apart without guessing at either", () => {
    const card = refusalFor("fork-no-such-card", undefined).say;
    const version = refusalFor("fork-no-such-card-version", undefined).say;
    expect(card).not.toBe(version);
    expect(card.toLowerCase()).not.toContain("private");
  });

  /**
   * A malformed body is the one case where the route's own `detail` is the whole answer:
   * it is the body validator's sentence about the field it refused, and this file has
   * nothing better to say about a request it built wrongly.
   */
  it("passes a bad request's own sentence through", () => {
    expect(refusalFor("bad-request", "forkCard: `version` is required.").say).toBe(
      "`version` is required.",
    );
  });
});

describe("the download control is amber, and the blueprint's is not", () => {
  it("wears the node card's own register", () => {
    // A neutral verb, the way GitHub's "Code" is: the menu clones as well as downloads.
    expect(DOWNLOAD()).toContain("Get card");
    expect(DOWNLOAD()).toContain("border-amber/60");
    expect(DOWNLOAD()).toContain("text-amber");
    expect(
      DOWNLOAD(),
      "the trigger is still copper, which the owner overruled on 2026-09-06",
    ).not.toContain("copper");
  });

  /**
   * THE PRICE OF THE RULING, HELD SO IT CANNOT BE PAID QUIETLY.
   *
   * This panel now holds two amber things that mean opposite kinds of thing: a trigger that
   * downloads a card that really exists, and a fence around a CLI that does not, with a
   * `ComingSoonBadge` inside it. CLAUDE.md forbids weakening an honesty disclaimer, and
   * camouflage is weakening — a "not built yet" claim that reads as one more accent in the
   * register around it has stopped making its claim.
   *
   * Hue cannot separate them any more, so FORM does, and these are the two halves of that:
   *
   *   1. the fence is a FILLED amber block with a heavy rule down its leading edge, which
   *      is the shape `app/globals.css` gives a leaves-the-page box and the shape it now
   *      says must carry the difference;
   *   2. the trigger is line work on nothing — border, label, caret — and takes an amber
   *      ground only under a pointer, transiently, never beside the badge it would be
   *      confused with.
   *
   * Delete either half and this cell reds. The `bg-amber` check strips the hover classes
   * first, because a hover tint is not a rest state and asserting over the raw string would
   * forbid the one amber ground that is allowed.
   */
  it("keeps the not-built-yet claim readable inside a register of its own colour", () => {
    const menu = DOWNLOAD();
    const summary = menu.slice(menu.indexOf("<summary"), menu.indexOf("</summary>"));
    expect(summary.length, "no <summary> in the rendered menu").toBeGreaterThan(100);

    // 2. the trigger: amber, and no amber GROUND at rest.
    expect(summary, "the trigger carries no amber, so the register did not land").toContain(
      "amber",
    );
    expect(
      summary.replace(/hoverable:hover:[^\s"]+/g, ""),
      "the card's download sits on a filled amber ground at rest, which is the shape " +
        "`ComingSoonBadge` uses to say something is not built. Line work only.",
    ).not.toMatch(/\bbg-amber/);

    // 1. the fence: still filled, and now carrying the heavy leading rule as well.
    const badge = menu.indexOf("Coming soon");
    expect(badge, "the not-built-yet badge is gone from the panel").toBeGreaterThan(-1);
    // The fence's OWN opening tag and nothing else. Slicing to the badge's text instead
    // swallowed `ComingSoonBadge`'s own `bg-amber/10`, and the filled-ground assertion below
    // then passed off the badge no matter what the fence around it wore — verified by
    // emptying the fence's background and watching this cell stay green.
    const open = menu.lastIndexOf("<div", badge);
    const fence = menu.slice(open, menu.indexOf(">", open));
    expect(fence, "no fence tag found before the badge").toContain("class");
    expect(
      fence,
      "the unbuilt half lost its filled ground, so nothing but hue separates it from the " +
        "register it sits in",
    ).toMatch(/\bbg-amber\//);
    expect(
      fence,
      "the unbuilt half lost the heavy leading rule that makes it read as a claim rather " +
        "than as one more amber accent on an amber page",
    ).toContain("border-l-2");
  });

  it("leaves the blueprint's trigger in the neutral register", () => {
    const folder = FOLDER();
    expect(folder).toContain("Get blueprint");
    expect(folder).not.toContain("copper");
    const summary = folder.slice(folder.indexOf("<summary"), folder.indexOf("</summary>"));
    expect(
      summary,
      "the blueprint's trigger took the card register, so the two no longer differ",
    ).not.toContain("amber");
    expect(summary).toContain("cyan");
  });

  /**
   * The Download item, which the row gave up its fourth control for.
   *
   * The header used to carry a "Download card" `ButtonLink` next to this menu: press it and
   * the card document lands on disk, no terminal involved. The owner asked the row down to
   * three controls, so the link moved INSIDE this panel as its first item, and a panel that
   * quietly stopped rendering what it was handed would take the working half of the menu
   * with it and leave a reader nothing but a command that runs nowhere yet.
   */
  it("renders the download link it is handed, first", () => {
    const withDownload = renderToStaticMarkup(
      createElement(CloneMenu, {
        kind: "node",
        cloneCommand: "npx -y darkprint clone lupo/spec-planner@1.0.0",
        download: createElement("a", { download: "spec-planner@1.0.0.yaml" }, "spec-planner@1.0.0.yaml"),
      }),
    );
    expect(withDownload).toContain('download="spec-planner@1.0.0.yaml"');
    const text = plainText(withDownload);
    expect(text.indexOf("spec-planner@1.0.0.yaml")).toBeLessThan(
      text.indexOf("npx -y darkprint clone lupo/spec-planner@1.0.0"),
    );
  });

  it("is handed one by the node page", () => {
    expect(PAGE, "CloneMenu is mounted without a download link").toMatch(
      /<CloneMenu[\s\S]{0,1200}?download=\{/,
    );
    expect(PAGE, "the saved file no longer carries the card's own name").toContain(
      "download={`${record.ref}.yaml`}",
    );
  });

  /**
   * Two items and no third. The owner asked for Download and Clone the way GitHub's menu has
   * them; a `curl` line was the panel's first item before and must not come back beside them.
   */
  it("has exactly the two items, Download then Clone", () => {
    const menu = DOWNLOAD();
    const items = [...menu.matchAll(/class="label-lead text-fg">([^<]*)</g)].map((m) => m[1]);
    expect(items).toEqual(["Download", "Clone"]);
    expect(plainText(menu)).not.toContain("curl");
  });
});

describe("the specification runs the full container width", () => {
  /**
   * The paragraph that draws `card.spec`, found from its one child rather than by counting
   * `<p>`s. The comment above it names `max-w-[68ch]` to record what was removed, which is
   * why this reads the opening TAG and not the region: a rule matching the comment would be
   * red against the very correction it is guarding.
   */
  const SPEC_TAG = (() => {
    const child = PAGE.indexOf("<Ticked text={card.spec} />");
    if (child === -1) return undefined;
    const before = PAGE.slice(0, child);
    const open = before.lastIndexOf("<p ");
    const close = before.indexOf(">", open);
    return open === -1 || close === -1 ? undefined : before.slice(open, close + 1);
  })();

  it("found the paragraph", () => {
    expect(SPEC_TAG, "nothing on the page renders card.spec through Ticked").toBeDefined();
    expect(SPEC_TAG).toContain("text-base");
  });

  it("carries no width cap", () => {
    expect(
      SPEC_TAG,
      "the specification is capped again; app/globals.css records the full container as the default and the owner asked this cap off on 2026-09-05",
    ).not.toMatch(/max-w-/);
  });
});
