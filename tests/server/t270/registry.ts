/* ============================================================
   T270 — a stub registry, for the two NETWORK verbs

   `clone` and `bump` reach the server (D-270-01 C8, D-270-05 (2)).
   The blind suite drives them IN-PROCESS, which is D-220-09's
   construction, and this is what stands in for the registry.

   ── why the seam is `fetch` and not an invented client ──
   D-270-05 (2) publishes `RegistryOptions { baseUrl, apiKey?,
   fetch }` as the verbs' LAST parameter, `= undefined`, resolved
   through `optionsFromEnv(process.env)` when absent — and
   `optionsFromEnv` reads the AMBIENT `fetch`. So replacing
   `globalThis.fetch` drives the success path through the published
   configuration rather than through a seam this suite made up. It
   also works through `runCli(argv, io)`, which takes no options
   parameter at all and is the only surface where the verbs' own
   argument lists — still the implementer's — do not have to be
   guessed.

   ── the router matches loosely, ON PURPOSE ──
   It keys on `/provenance`, `/releases/` and `/files/` rather than
   on a full URL. The exact path a verb builds is the implementer's
   and is not published, so an exact-match stub would 404 on a
   spelling difference and red AC4 with "bytes differ" — a
   confident, plausible, WRONG cause. Matching the route family
   keeps the cell's failure about the bytes, which is what AC4 is
   actually about. `calls` records every URL so a cell can say what
   was asked for when a match is missed.
   ============================================================ */

import type { ExportedFile } from "@/lib/content/bundle-export";

import { ARCHIVE } from "./fixtures";
import { computedExport } from "./references";

export interface StubRegistry {
  readonly base: string;
  readonly digest: string;
  readonly files: readonly ExportedFile[];
  /** Every URL the CLI asked for, in order. */
  readonly calls: string[];
  /** Requests that matched no route — a cell reports these rather than guessing. */
  readonly unmatched: string[];
  /** Every release the provenance answer publishes, in the order it publishes them. */
  readonly releases: readonly { version: string; digest: string }[];
  restore(): void;
}

/**
 * A provenance answer carrying TWO releases, oldest first, so "latest" is discriminable.
 *
 * D-270-07 rules "latest" as the release the registry treats as CURRENT — highest semver by
 * `compareVersionStrings`, the same reading D-100-01 AC8 gives `previous`. With a single
 * release published, latest and oldest are the same object and no cell can tell a CLI that
 * resolves the newest from one that resolves the first in the list. This is the fixture that
 * separates them, and it is deliberately ordered OLDEST FIRST: a CLI taking `releases[0]`
 * must land on the wrong one.
 *
 * Only `v2` carries the real digest and the real files. A CLI resolving `v1` fetches a digest
 * the files route does not serve and fails loudly rather than quietly returning the right
 * bytes for the wrong reason.
 */
export function twoReleaseVersions(): { older: string; newer: string } {
  return { older: "1.0.0", newer: "2.0.0" };
}

/**
 * Serve one archive bundle as a published release, over a replaced `globalThis.fetch`.
 *
 * `owner`/`slug` are the caller's to choose; the stub answers for any of them, because which
 * two-part key a cell uses is not what any criterion is about.
 */
/** `decodeURIComponent` throws on a malformed escape; a stub must not die on one. */
function safeDecode(url: string): string {
  try {
    return decodeURIComponent(url);
  } catch {
    return url;
  }
}

export function stubRegistry(
  slug: string,
  options: {
    readonly releases?: readonly { version: string; digest: string }[];
    /** Serve THESE files instead of the archive's own export — AC2's rewritten previous. */
    readonly files?: readonly ExportedFile[];
  } = {},
): StubRegistry {
  const entry = ARCHIVE.find((bundle) => bundle.slug === slug);
  if (entry === undefined) throw new Error(`no archive bundle \`${slug}\``);

  const files = options.files ?? computedExport(slug);
  /* The engine's own answer, not a recomputation. `resolveBundle` sets
     `blueprint.digest = bundleDigest({ dot, cardDigests })` at `lib/core/bundle/resolve.ts:749`,
     so taking it off the resolved blueprint means the digest the stub serves is the digest the
     registry would have stored. A digest computed here could differ, and a CLI that verifies
     what it downloaded would then red AC4 for a reason that is about this fixture. */
  const digest = entry.blueprint.digest;
  const releases = options.releases ?? [{ version: "1.0.0", digest }];

  const calls: string[] = [];
  const unmatched: string[] = [];
  const real = globalThis.fetch;
  const base = "https://registry.invalid";

  const json = (body: unknown): Response =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push(url);

    if (url.includes("/provenance")) {
      return json({ publishedBy: "someone", releases });
    }
    if (url.includes("/releases/")) {
      /* `{ files: [...] }`, NOT a bare array — the route's own envelope,
         `app/api/mcp/releases/[owner]/[slug]/d/[digest]/route.ts:49`:
             return ok({ files: files.map((file) => file.path) });
         and `ok()` adds no wrapper of its own (`lib/server/http/ok.ts:13`).

         THIS STUB SHIPPED THE BARE ARRAY AND IT COST THIRTEEN FALSE REDS AT FIRST CONTACT.
         A CLI reading `body.files` off an array got `undefined`, resolved zero files, never
         called the files route, wrote nothing, and reported `files: []` — and the reds landed
         on AC4's byte equality, on `--out`, on `--version`, and on all six AC2 rendering cells
         (whose `previous` snapshot then had no `cardRefs`, so every card read as newly pinned).
         Four unrelated-looking symptoms, one fixture defect, and every one of them would have
         been charged to an implementer that was right.

         The route answers NAMES and not bytes, by its own header, and that half was correct
         here from the start: a stub returning bytes would let a CLI pass AC4 without ever
         calling the files route. It was the ENVELOPE that was invented. E1 warned that a
         loose stub can red for a stub reason wearing a CLI cause; this is that, and the
         `calls` list is what made it findable in one step. */
      return json({ files: files.map((file) => file.path) });
    }
    if (url.includes("/files/")) {
      /* DECODED before matching. The CLI percent-encodes the path segments it builds —
         `sha256%3A…`, `cards/acceptance-verifier%402.0.0.yaml` — and that is correct client
         behaviour: `bundle-export.ts`'s own note records that both spellings were measured to
         return 200, and Next decodes `[...path]` before a route handler ever sees it. So the
         REAL server compares decoded names and this stub has to as well.

         Matching raw cost a second round of false reds: every `/files/` request missed, the
         stub 404'd, and the CLI faithfully rendered the registry's own 404 sentence — which
         then looked like a CLI defect in twenty-five cells. The decode is what makes this
         stub answer the question the real route answers. */
      const wanted = safeDecode(url);
      const match = files.find((file) => wanted.endsWith(file.path));
      if (match === undefined) {
        unmatched.push(url);
        return new Response("not found", { status: 404 });
      }
      return new Response(match.text, { status: 200 });
    }

    unmatched.push(url);
    return new Response("not found", { status: 404 });
  }) as typeof globalThis.fetch;

  return {
    base,
    digest,
    files,
    calls,
    unmatched,
    releases,
    restore: () => {
      globalThis.fetch = real;
    },
  };
}
