import type { ContentKind } from "./types";

/** The route segment each surface lives under. Singular for the ontology: there is one. */
const SEGMENT: Record<ContentKind, string> = {
  blueprint: "blueprints",
  node: "nodes",
  ontology: "ontology",
};

/**
 * What `contentHref` needs, per kind, since B-09 split the blueprint key in two.
 *
 * A discriminated union rather than a widened record with an optional owner, because the
 * three kinds do not agree about what identifies them any more: a blueprint is
 * `{ownerHandle, slug}` (D-261-01) and a node card and a term are still one string. An
 * optional member would typecheck at every call site and be wrong at exactly one of them.
 */
export type ContentTarget =
  | { kind: "blueprint"; ownerHandle: string; slug: string }
  | { kind: "node"; slug: string }
  | { kind: "ontology"; slug: string };

/** Canonical detail-page href for any content item. */
export function contentHref(c: ContentTarget): string {
  if (c.kind === "blueprint") return blueprintHref(c.ownerHandle, c.slug);
  return `/${SEGMENT[c.kind]}/${c.slug}`;
}

/**
 * The canonical public detail URL of a blueprint (B-09, D-261-01).
 *
 * `ownerHandle` and not `author`: re-attribution moves OWNERSHIP and not AUTHORSHIP
 * (D-250-18), so a URL built from the manifest's author names the wrong account the first
 * time a bundle is transferred. It is the same two-part key `blueprint(db, actor,
 * ownerHandle, slug)` takes, which is what makes one name for one resource possible.
 *
 * Neither half is percent-encoded, and that is the shipped behaviour rather than an
 * omission: T070's grammar admits `[a-z0-9-]` for both a handle and a slug, so there is
 * nothing in either that a path could mistake for punctuation. `blueprintFileHref` below
 * encodes, because the file half really can carry an `@`.
 */
export function blueprintHref(ownerHandle: string, slug: string): string {
  return `/${SEGMENT.blueprint}/${ownerHandle}/${slug}`;
}

/**
 * The handle the archive's nine bundles are owned by, for the handful of STATIC links whose
 * subject is one of those nine (D-261-07).
 *
 * `lib/server/seed/plan.ts` publishes the same string as `REGISTRY_HANDLE`, and this is
 * deliberately not that import: the emitters are a landing beat, a spec paragraph and a
 * scoring caption, none of which may pull a server module into the browser bundle, and
 * `lib/server/**` is out of this task's reach besides. The cost is stated rather than
 * hidden — this is a second spelling of one fact, and it is one constant here instead of
 * the five scattered literals the ruling would otherwise have licensed.
 *
 * It is NOT a default for `blueprintHref`. Every link whose subject is a blueprint the
 * READER chose takes its owner from the record; this names the owner of a fixed set of
 * bundles that the seed re-attributed (D-250-04), and nothing else may reach for it.
 */
export const ARCHIVE_OWNER = "darkprint";

/**
 * The pre-B-09 single-segment URL, for a row whose owner is not known.
 *
 * It exists so the fixture-fed world degrades to ONE HOP instead of to a wrong owner
 * (D-261-07): `lib/types.ts`'s `Blueprint.ownerHandle` is optional, and a row assembled
 * from a fixture rather than from the registry has nobody to name. This lands on
 * `app/blueprints/[slug]/page.tsx`, which resolves the slug and 308s (D-261-02).
 *
 * Not a fallback inside `blueprintHref`. A caller has to choose it, because the choice is
 * "I do not know the owner" and that is a fact about the caller's data rather than about
 * the URL.
 */
export function legacyBlueprintHref(slug: string): string {
  return `/${SEGMENT.blueprint}/${slug}`;
}

/**
 * The href for a `lib/types.ts` `Blueprint` record, which may or may not know its owner.
 *
 * This exists because two rulings are both literally true and neither bends: `contentHref`'s
 * blueprint arm REQUIRES an owner (D-261-05), and a shelf row must emit the canonical URL
 * when the owner is present and the old URL riding the 308 when it is absent (D-261-07).
 * Requiring it at the union and choosing here is the only arrangement that satisfies both,
 * and it puts the choice where a reader can see it instead of hiding a fallback inside the
 * canonical builder — where an owner-less record would quietly produce a wrong-looking URL
 * that nobody is asked to think about.
 *
 * One function rather than the same three lines in `ContentRow` and `ContentCard`: which
 * URL an owner-less row gets is a DECISION, and two copies of it agree exactly until the
 * day one is fixed.
 */
export function blueprintRecordHref(item: { slug: string; ownerHandle?: string }): string {
  return item.ownerHandle === undefined
    ? legacyBlueprintHref(item.slug)
    : contentHref({ kind: "blueprint", ownerHandle: item.ownerHandle, slug: item.slug });
}

/**
 * A caller's query string, rebuilt for a redirect's `Location`.
 *
 * Both of this task's redirectors need it and neither may drop it: AC1 requires the query
 * to survive the 308, because every shared link into a filtered blueprint view carries one
 * and `permanentRedirect` sends exactly the path it is handed and appends nothing.
 *
 * Rebuilt through `URLSearchParams` rather than concatenated, so a value containing an `&`
 * or an `=` cannot split into two parameters on the way through. Two consequences visible
 * in the `Location` header, stated because a byte-comparison would fail on them: the result
 * is canonically encoded rather than identical to what arrived (a literal space returns as
 * `+`), and repeated keys keep their own order while the keys themselves come out in the
 * order they were parsed. Every reader that parses a query sees the same query.
 *
 * One function rather than one per redirector: how a query survives a hop is a decision,
 * and two copies of it agree exactly until the day one is fixed.
 */
export function searchSuffix(params: Record<string, string | string[] | undefined>): string {
  const carried = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) for (const one of value) carried.append(key, one);
    else carried.append(key, value);
  }
  const text = carried.toString();
  return text === "" ? "" : `?${text}`;
}

export function kindHref(kind: ContentKind): string {
  return `/${SEGMENT[kind]}`;
}

/** A profile's page. */
export function profilePageHref(handle: string): string {
  return `/u/${handle}`;
}

/**
 * Where `/blueprints/<one segment>` sends a reader, or `undefined` for a 404.
 *
 * The segment is read as an owner first, because that is the shape the canonical
 * `/blueprints/<owner>/<slug>` address gives the slot, and an account's blueprints live on
 * its profile. It is read as the pre-owner slug second, for links written before a slug
 * became unique per owner, and only when exactly one account holds it: with two holders
 * there is no fact to pick one by, and with none there is nowhere to go.
 */
export function legacyBlueprintTarget(input: {
  segment: string;
  accountExists: boolean;
  holders: readonly { ownerHandle: string }[];
  query?: string;
}): string | undefined {
  const query = input.query ?? "";
  if (input.accountExists) return `${profilePageHref(input.segment)}${query}`;
  const [only, second] = input.holders;
  if (only === undefined || second !== undefined) return undefined;
  return `${blueprintHref(only.ownerHandle, input.segment)}${query}`;
}

/**
 * An id (a card's or a term's) as a path, keeping its namespace separator a separator.
 *
 * Both vocabularies allow a namespaced id (doc 3 §7: `berti/solver-a`,
 * `lupo/pii-handling`) and both routes are catch-alls, so a `/` in an id is one more
 * path segment rather than a character to escape. Percent-encoding the whole id instead
 * produced `/ontology/lupo%2Fpii-handling`, which Next decodes back to two segments
 * before matching and which therefore matched nothing at all. Each segment is still
 * encoded — an id is author-supplied, and a `?` or a `#` in one would otherwise end the
 * path early.
 */
function idPath(id: string): string {
  return id.split("/").map(encodeURIComponent).join("/");
}

/** A node card's page — `/nodes/[...id]`. */
export function nodeHref(id: string): string {
  return `/nodes/${idPath(id)}`;
}

/** An ontology term's page — `/ontology/[...term]`. */
export function termHref(id: string): string {
  return `/ontology/${idPath(id)}`;
}

/**
 * One card document at its registry address — `/api/files/cards/<ref>`.
 *
 * The sibling of `blueprintFileHref` and it exists for the same reason: `cardHref` names
 * `public/cards/<ref>.yaml`, the mirror written from `content/` before a build, which holds
 * nothing for a card published since the last deploy. The route takes a catch-all and
 * accepts the bare ref as well as the `.yaml` spelling, so the bare one travels here — it
 * is the ref the page already has, and adding an extension it would then have to strip is
 * a second name for one file.
 *
 * A ref may be namespaced (`berti/solver-a@1.0.0`), so the `/` is a separator and each
 * segment is encoded around it — `idPath`'s rule, for the same reason: the route is a
 * catch-all and Next decodes each segment before matching.
 */
export function cardFileHref(ref: string): string {
  return `/api/files/cards/${idPath(ref)}`;
}

/**
 * One file of one release, at its DIGEST address (D-261-04).
 *
 * The digest and not the version, and the difference is the whole reason the two live at
 * different addresses: a version reference moves when a newer release is cut and a digest
 * reference never does (`lib/server/export/types.ts`'s `ReleaseRef`). The download command
 * a reader pastes into a terminal has to fetch the folder the page was describing, not
 * whatever is current when they get round to running it, so it binds the immutable
 * promise `/mcp` already calls load-bearing. The `/v/` address stays for hand-written URLs.
 *
 * This replaces `bundleHref`'s `public/bundles/<slug>/…` mirror, which is a build-time
 * artefact of `content/` and therefore has nothing at all for a blueprint published since
 * the last deploy — AC3 and AC4 cannot both hold on a static mirror. The mirror itself is
 * untouched and expressly out of this task's reach (D-261-04): the page simply stops
 * linking it.
 *
 * Every segment is percent-encoded, which is `bundleHref`'s decision consumed rather than
 * re-taken: a card filename carries the `@` of its pinned version and semver permits `+`,
 * and the route is a catch-all that Next has already decoded per segment by the time it
 * matches. `path` is the export's own name for the file and may contain `/`, which is a
 * separator here and not a character.
 */
export function blueprintFileHref(
  ownerHandle: string,
  slug: string,
  release: { digest: string },
  path: string,
): string {
  const segments = [ownerHandle, slug, "d", release.digest, ...path.split("/")].map(
    encodeURIComponent,
  );
  return `/api/files/blueprints/${segments.join("/")}`;
}
