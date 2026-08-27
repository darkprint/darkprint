/* ============================================================
   T230 — AC1, and the file that exists because the finding was
   reported instead of guessed at

   **D-230-01.** `checkLimit` returns a verdict and never throws;
   `RateLimitedError` sat in the admissible-form block in no
   signature, with no published constructor, returned or thrown by
   nothing; every route that could render a 429 is Forbidden to
   T230 and its own tree had no published shape. So *an over-limit
   request returns 429* had no published caller and nothing blind
   could drive it. Ruled: the barrel publishes

       rateLimited(request: Request, verdict: LimitVerdict, bucket: string): Response

   which makes AC1 drivable from the barrel without T230 owning a
   rate-limited route.

   **D-230-09** publishes the response's whole KEY SET, and the
   ruling gives the reason the set rather than the members: T081's
   key-set whitelist was the only instrument that caught an
   extension member carrying a driver value once `type`, `title`
   and `detail` were each pinned. That set is PARSED out of the
   block here — a whitelist typed into this file would be a second
   contract, and the next implementer would meet two.

   ── nothing in this file needs a database or a bucket name ──
   `rateLimited` takes the verdict as an argument, so every cell
   builds its own. That is not a shortcut: it makes AC1's coverage
   independent of F-230-D, which is still unresolved and which
   D-230-04 turned from awkward into load-bearing everywhere else.
   The numbers in the fixture are DISTINCTIVE rather than
   plausible, so a slot pinned to one of them is pinned by
   provenance and not by a value that could have arrived from
   anywhere.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { PROBLEM_TYPE_BASE } from "@/lib/server/http";

import {
  BARREL,
  describe_,
  messageForm,
  occurrencesOf,
  publishedProblem,
  requiredFn,
  responseSurface,
} from "./contract";

/** A ceiling, a remainder and an instant that could have come from nowhere else. */
const WINDOW_MS = 90 * 60 * 1000;

const VERDICT = {
  allowed: false,
  limit: 7331,
  remaining: 0,
  resetAt: new Date("2031-03-07T09:41:17.503Z"),
  windowMs: WINDOW_MS,
};

const BUCKET = "t230-probe-bucket";
const PATH = "/api/blueprints/probe";

function request(headers: Record<string, string> = {}): Request {
  return new Request(`https://darkprint.test${PATH}?q=1`, { headers });
}

async function render(
  headers: Record<string, string> = {},
  bucket = BUCKET,
  verdict: typeof VERDICT = VERDICT,
): Promise<{ response: Response; body: Record<string, unknown>; text: string }> {
  const rateLimited = await requiredFn("rateLimited");
  const response = await rateLimited(request(headers), verdict, bucket);
  if (!(response instanceof Response)) {
    throw new Error(
      `${BARREL}'s \`rateLimited\` answered ${describe_(response)}; D-230-01 publishes a ` +
        `\`Response\`.`,
    );
  }
  const text = await response.clone().text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`\`rateLimited\` answered a body that is not JSON: ${text.slice(0, 300)}`);
  }
  return { response, body, text };
}

describe("T230 AC1 — the 429 itself", () => {
  it("is a 429", async () => {
    const { response } = await render();
    expect(
      response.status,
      `AC1: "an over-limit request returns 429 naming the limit and the reset".`,
    ).toBe(429);
  });

  it("is application/problem+json", async () => {
    const { response } = await render();
    const header = response.headers.get("content-type");
    expect(
      header === null ? null : header.split(";")[0].trim(),
      `B-03 makes a transport failure \`application/problem+json\` (RFC 9457). Served: ` +
        `${JSON.stringify(header)}.`,
    ).toBe("application/problem+json");
  });

  /**
   * THE STRONGEST CELL IN THIS FILE, and the one D-230-09 published the set for.
   *
   * Once `type`, `title`, `detail` and `status` are each pinned below, every leak a word
   * scan was written for is caught by a pin first — so the scan stops being reachable
   * and nothing reds when that happens. What still passes every pin is an RFC 9457 §3.2
   * extension member sitting beside them, and a key-set equality is what fails closed on
   * it: any member the block does not name is a published surface nobody published,
   * whatever it contains.
   */
  it("the document's members are exactly the nine the block publishes", async () => {
    const { body, text } = await render();
    const published = publishedProblem(429);
    expect(
      Object.keys(body).sort(),
      `The 429 carried a member D-230-09 does not publish, or is missing one it does.\n` +
        `  Published, exactly: ${published.members.join(", ")}\n` +
        `  The ruling publishes the SET and not just the members, because a key-set ` +
        `whitelist is the only instrument that catches an extension member once \`type\`, ` +
        `\`title\` and \`detail\` are all pinned — and a task publishing extension members ` +
        `owes the set or the strongest available pin cannot be written.\n` +
        `  served: ${text.slice(0, 500)}`,
    ).toEqual([...published.members].sort());
  });

  /**
   * `detail` is "the admissible form byte for byte", so the form is turned into an
   * anchored pattern derived from the block's own line rather than retyped — a pin
   * retyped here would agree with an implementation that copied the same typo and
   * disagree with one that read the sentence.
   *
   * Anchored at both ends, which is what makes it an EXACT match: a message carrying the
   * caller's identity appended after the instant does not match, and that is the clause
   * about the refusal not being an identity oracle enforced by the same assertion.
   */
  it("`detail` matches the admissible form, with every slot the value the caller holds", async () => {
    const { body } = await render();
    const form = messageForm();
    const detail = body.detail;

    expect(typeof detail, `\`detail\` is ${describe_(detail)}`).toBe("string");
    const matched = form.pattern.exec(detail as string);
    expect(
      matched,
      `\`detail\` does not match the admissible form.\n` +
        `  form:    ${form.form}\n` +
        `  pattern: ${form.pattern.source}\n` +
        `  served:  ${JSON.stringify(detail)}\n` +
        `  The pattern is anchored at both ends, so a rendering that appends anything — the ` +
        `caller's ip, a key id, a hint — fails here rather than in a separate cell. "Never ` +
        `the caller's identity, key id or IP: a rendering that names the subject makes the ` +
        `refusal itself an identity oracle."`,
    ).not.toBeNull();

    const [, bucket, n, window, instant] = matched!;
    expect(bucket, `the \`<bucket>\` slot is not the bucket the caller passed`).toBe(BUCKET);
    expect(n, `the \`<n>\` slot is not the verdict's own \`limit\``).toBe(String(VERDICT.limit));
    expect(
      window.trim(),
      `the \`<window>\` slot is empty. The vocabulary is unpublished so nothing here pins ` +
        `the wording, but a blank slot renders as "limit of 7331 per  reached".`,
    ).not.toBe("");
    expect(
      instant,
      `the \`<ISO instant>\` slot is not the verdict's own \`resetAt\`. AC1 is "naming the ` +
        `limit and the reset", and a reset the caller cannot line up against the verdict it ` +
        `was given names nothing.`,
    ).toBe(VERDICT.resetAt.toISOString());
  });

  it("the machine-readable members are the verdict's own", async () => {
    const { body } = await render();
    expect(body.limit, `\`limit\` disagrees with the verdict rendered`).toBe(VERDICT.limit);
    expect(body.remaining, `\`remaining\` disagrees with the verdict rendered`).toBe(
      VERDICT.remaining,
    );
    expect(
      body.resetAt,
      `\`resetAt\` disagrees with the verdict rendered. D-230-09 calls these three "the ` +
        `verdict, machine-readable" — they exist so an agent does not have to parse ` +
        `\`detail\`, and a copy that can drift from the sentence beside it is worse than ` +
        `not having them.`,
    ).toBe(VERDICT.resetAt.toISOString());
  });

  it("carries T220 AC6's affordance at the literal the block pins", async () => {
    const { body } = await render();
    const pinned = publishedProblem(429).pinned.keysAvailable;
    expect(
      String(body.keysAvailable),
      `T220's AC6 is a usability criterion about a refusal: an unkeyed client is limited ` +
        `and told so "in a form an agent can act on". This member IS that form, and it is ` +
        `the whole reason D-230-09 exists — the affordance could not go in \`detail\` ` +
        `without violating an exact-matched message form.`,
    ).toBe(pinned);
  });

  it("`status` says the same thing as the status line", async () => {
    const { response, body } = await render();
    expect(
      body.status,
      `\`status\` is ${describe_(body.status)} while the response is ${response.status}; the ` +
        `two are one fact and a client may read either.`,
    ).toBe(response.status);
  });

  it("`type` is under the one problem-type namespace, and `title` is a non-empty string", async () => {
    const { body } = await render();
    expect(
      typeof body.type === "string" && (body.type as string).startsWith(PROBLEM_TYPE_BASE),
      `\`type\` is ${describe_(body.type)}. D-50-03 exports \`PROBLEM_TYPE_BASE\` precisely so ` +
        `a task needing a type this module does not construct cannot retype the host — that ` +
        `ruling exists because a second copy of the constant drifted to a host occurring ` +
        `nowhere else in the repository. Neither the suffix nor \`title\`'s wording is ` +
        `published, so neither is pinned.`,
    ).toBe(true);
    expect(typeof body.title, `\`title\` is ${describe_(body.title)}`).toBe("string");
    expect((body.title as string).length).toBeGreaterThan(0);
    expect(body.instance, `\`instance\` identifies this occurrence (D-02)`).toBe(PATH);
  });
});

describe("T230 D-230-10 — `<window>` is the window's length, not what is left of it", () => {
  /**
   * The cell the ruling asks for, and it catches the derivation that is WRONG rather
   * than missing.
   *
   * `rateLimited` has everything it needs to render `<window>` from `resetAt - now`, and
   * that number is the time REMAINING. A caller refused thirty seconds into a
   * sixty-second ceiling then reads "limit of 60 per 30 seconds" — an adjacent quantity
   * substituted for the one the sentence is about, inside an exact-matched form, and it
   * renders plausibly at every single point in the window.
   *
   * Driven at two points in ONE window: same `limit`, same `windowMs`, different
   * `resetAt`. The `<window>` slot must be identical and the `<ISO instant>` slot must
   * not be. Both halves are needed — identical windows alone passes against a renderer
   * that hardcodes a string, and differing instants alone says nothing about the window.
   *
   * No clock is involved, which is why this works at all from outside: the two points in
   * the window are two verdicts rather than two moments.
   */
  it("two refusals at different points of one window render the same window", async () => {
    const early = { ...VERDICT, resetAt: new Date(VERDICT.resetAt.getTime()) };
    const late = {
      ...VERDICT,
      /* Deeper into the same window: same length, far less of it left. */
      resetAt: new Date(VERDICT.resetAt.getTime() - WINDOW_MS + 30_000),
    };

    const form = messageForm();
    const slotsOf = (detail: unknown): { window: string; instant: string } => {
      const matched = form.pattern.exec(String(detail));
      if (matched === null) {
        throw new Error(`\`detail\` does not match the admissible form: ${String(detail)}`);
      }
      return { window: matched[3], instant: matched[4] };
    };

    const first = slotsOf((await render({}, BUCKET, early)).body.detail);
    const second = slotsOf((await render({}, BUCKET, late)).body.detail);

    expect(
      second.instant,
      `The two verdicts carry different \`resetAt\` values and rendered the same instant, so ` +
        `this cell is not driving what it thinks it is.`,
    ).not.toBe(first.instant);

    expect(
      second.window,
      `\`<window>\` changed between two refusals in the SAME window: ` +
        `${JSON.stringify(first.window)} then ${JSON.stringify(second.window)}.\n` +
        `  D-230-10: \`resetAt - now\` is the time REMAINING, not the window's LENGTH. A ` +
        `caller refused thirty seconds into a sixty-second ceiling reads "limit of 60 per 30 ` +
        `seconds", which is plausible at every point in the window and wrong at all of them.\n` +
        `  \`LimitVerdict\` carries \`windowMs\` precisely so this slot has a source that is ` +
        `not an adjacent quantity — one object, one source.`,
    ).toBe(first.window);
  });

  /**
   * The other half of D-230-10's reasoning, and it is about the ruling's own
   * discriminator: `windowMs` went on the verdict rather than becoming a fourth parameter
   * because "a fourth parameter admits a caller passing a window that disagrees with the
   * verdict it is rendering".
   *
   * So the property that ruling BUYS is that the rendered window tracks the verdict.
   * Asserted as a difference: change only `windowMs` and the slot must change with it.
   * Nothing here pins the wording, which is unpublished.
   */
  it("changing only `windowMs` changes the rendered window", async () => {
    const short = { ...VERDICT, windowMs: 60_000 };
    const long = { ...VERDICT, windowMs: 24 * 60 * 60 * 1000 };
    const form = messageForm();
    const windowOf = async (verdict: typeof VERDICT): Promise<string> => {
      const matched = form.pattern.exec(String((await render({}, BUCKET, verdict)).body.detail));
      if (matched === null) throw new Error("`detail` does not match the admissible form");
      return matched[3];
    };

    expect(
      await windowOf(long),
      `A minute and a day render the same \`<window>\`, so the slot is not derived from ` +
        `\`windowMs\` at all — which is the one thing D-230-10 added the field for.`,
    ).not.toBe(await windowOf(short));
  });
});

describe("T230 the refusal is not an identity oracle", () => {
  /**
   * ASSERTED AS THE DIFFERENCE RATHER THAN ARRANGED.
   *
   * `not.toContain("...")` only excludes the leaks somebody thought of, and the key-set
   * pin above cannot see a caller value carried inside an ADMITTED member. What is left
   * is invariance: two refusals identical in everything the contract says the response
   * depends on — the verdict, the bucket, the path — and differing only in who is
   * asking. Any byte of difference is something about the caller that reached the wire.
   *
   * Whole surface, headers included, because T081's F1 was a leak instrument scoped to
   * the problem document while a driver value sat on a header of all eleven responses
   * and reddened nothing, blind or colocated.
   */
  it("two callers at the same bucket and verdict get byte-identical refusals", async () => {
    const alice = await render({
      cookie: "dp_session=alice-session-value",
      authorization: "Bearer alice-token-11111",
      "x-forwarded-for": "198.51.100.11",
    });
    const bob = await render({
      cookie: "dp_session=bob-session-value",
      authorization: "Bearer bob-token-22222",
      "x-forwarded-for": "203.0.113.222",
    });

    const surfaceOf = async (r: Response) => {
      const s = await responseSurface(r);
      /* `date` is the runtime's, not the module's, and it legitimately differs. */
      delete s.headers.date;
      return s;
    };

    expect(
      await surfaceOf(bob.response),
      `Two refusals that differ only in WHO ASKED are not identical, so something about the ` +
        `caller reached the wire. "Never the caller's identity, key id or IP — a rendering ` +
        `that names the subject makes the refusal itself an identity oracle."\n` +
        `  This catches a leak wherever it renders, including inside a member the contract ` +
        `does admit and including a header, which is the surface T081's F1 found nothing ` +
        `pointed at.`,
    ).toEqual(await surfaceOf(alice.response));
  });

  it("no part of the response carries a credential presented on the request", async () => {
    const secret = "dpk_t230_presented_credential_9f3c1";
    const rendered = await render({
      authorization: `Bearer ${secret}`,
      cookie: `dp_session=${secret}`,
    });
    const surface = await responseSurface(rendered.response);
    expect(
      occurrencesOf(secret, surface),
      `The credential the caller presented is rendered back in the refusal. A 429 is the ` +
        `response most likely to be logged, proxied and pasted into an issue, and it is the ` +
        `one an unauthenticated caller can provoke on purpose.`,
    ).toEqual([]);
  });
});
