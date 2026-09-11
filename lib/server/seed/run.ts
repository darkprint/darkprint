/* ============================================================
   DarkPrint backend — seed: the import itself
   T250 AC2, AC3, AC4, AC5. One `publish` per bundle, through the
   merged door the wizard and the CLI already go through.

   ── This module composes and owns no storage ──
   Nothing below decides anything somebody else has ruled. The
   digest is the engine's, computed during resolution inside
   `publish` and never recomputed. The card chain check is T020's
   inside `addCard`. The visibility grant is T060's `can`. The
   merged ontology view is `openView`. The vocabulary's
   shape is T010's `parseStoredVocabulary`. The freeze is T090's
   `exportRelease` plus T100's `persistArtefacts`. The refusal for
   a release that already exists is T100's, and this file's only
   use for it is to COUNT it.

   ── Why AC3 and AC5 need no code ──
   They are negatives satisfied by writing nothing (D-250-07,
   D-250-14). No door reached from here touches `target`, so
   `star_count`, `download_count` and `note_count` keep the `'0'`
   the column defaults to, and the registry prints no figure
   nobody counted. Adding a write that set them to zero would be
   this task deciding a product question by shipping.
   ============================================================ */

import { contentVocabulary, readContent } from "@/lib/content/read";
import type { Db, ObjectStorage } from "@/lib/db";
import { changeHandle, upsertFromGitHub } from "@/lib/server/accounts";
import { getBundle, getRelease } from "@/lib/server/archive";
import type { Actor } from "@/lib/server/policy";
import { PublishRefusedError, publish } from "@/lib/server/publish";
import { REGISTRY_HANDLE, SEED_RELEASE_VERSION, type ImportPlan } from "./plan";

export interface ImportResult extends ImportPlan {
  created: number;
  skipped: number;
}

/**
 * The GitHub identity the registry account is created under (D-250-04).
 *
 * A sentinel that cannot collide: GitHub ids start at 1, so no real signup can ever reach
 * this row. `"0"` and not `0` — `upsertFromGitHub` types `githubId` as `string`, which is
 * the column's type; the ruling writes the number and the tree writes the text, and the
 * text is what the write takes.
 *
 * The handle is unavailable to a real signup afterwards because this account HOLDS it,
 * which is the outcome; no separate reservation is made or needed.
 */
const REGISTRY_GITHUB_ID = "0";

/**
 * Import the archive under the registry handle, idempotently.
 *
 * `created` and `skipped` count BUNDLES (D-250-08). A second run refuses every unchanged
 * bundle with `PublishRefusedError` kind `"conflict"` — raised before the version check, so
 * it is cleanly countable — and reports `created: 0, skipped: 9`. Cards do not fold in:
 * composing `publish` per bundle imports the whole library as a consequence, so counting
 * them would report the same 57 as new work on every run.
 *
 * Every other refusal leaves with its own author's message unaltered, which is the same
 * rule `publish` follows for the three it passes through (D-50-08): a seed import
 * re-rendering `UnknownOntologyVersionError` or `CardStoreError` would put a second author
 * on one sentence, and the operator reading it needs the sentence that names the cause.
 *
 * **The bytes come from the loader, not from `plan` (D-250-01).** The plan carries identity
 * — digests, ids, versions — so AC1 is checkable before a database exists; a plan carrying
 * bytes would be a second copy of the content tree with its own staleness. `plan` is still
 * consumed rather than decorative: it names the ontology version to publish and the handle
 * to publish under, and it is returned so `ImportResult` reports what was planned beside
 * what happened.
 */
export interface ImportOptions {
  /**
   * Slugs to publish, when the import is not the whole archive. A registry that already holds
   * nine releases whose bytes have since moved refuses each of them as version-not-higher, and
   * that refusal stops a whole-archive run before a new, tenth slug is reached; naming the new
   * slug publishes it alone and leaves the drift visible for the owner to decide on.
   */
  only?: ReadonlySet<string>;
}

export async function runImport(
  db: Db,
  plan: ImportPlan,
  /**
   * Where the frozen artefacts go, so a caller with an isolated bucket does not have to
   * reach for `S3_BUCKET` in the environment.
   *
   * **`= undefined` and NOT `?`.** TypeScript's `?` erases to nothing, so the optional
   * parameter would still count in `Function.length` and the published two-argument arity
   * would read as three. Only a default-value expression stops a parameter counting. Same
   * reason `publish`'s fourth parameter is spelled this way, and it shipped as `?` there
   * once and was charged for it.
   */
  storage: ObjectStorage | undefined = undefined,
  /* A default for the same reason as `storage`: the published arity stays two. */
  options: ImportOptions = {},
): Promise<ImportResult> {
  const registry = await registryActor(db, plan.registryHandle);

  /* There is no vocabulary write before the bundles any more. This function used to open
     with `addOntologyVersion(db, {version: ..., terms: CORE_ONTOLOGY.terms})`, catching the
     duplicate-version refusal so a second import was a no-op, and it had to: `publish`
     opened a view by version and refused one nobody had published, so an unseeded registry
     could not accept a single bundle. `openView` merges over `CORE_ONTOLOGY` directly now,
     which is the vocabulary that row always held anyway, and migration 0009 dropped the
     table that call wrote to.

     The archive's own overlay was never part of that write and still is not. It is a local
     namespace layered over the core per release (`ontology/extensions.yaml`, doc 3 §7), and
     it travels on `release.local_vocabulary` below.

     The archive's vocabulary, as a file rather than as terms (D-90-03): `text` is
     `content/ontology/extensions.yaml` byte for byte so `exportBundle` re-emits it
     unaltered, and `terms` is its parse. Handed to every bundle, not only the ones that
     use a local term, because `readContent` builds ONE view for the whole archive and the
     analysis stored on each release has to be the one the site computed. The export gates
     on use on its own — `exportBundle` writes the file only when `localTermsUsed` is
     non-empty — so a release that pins no local term ships no vocabulary file. */
  const archiveVocabulary = contentVocabulary();
  const vocabulary =
    archiveVocabulary === undefined ? undefined : { text: archiveVocabulary.text, terms: archiveVocabulary.terms };

  let created = 0;
  let skipped = 0;
  for (const loaded of readContent()) {
    if (options.only !== undefined && !options.only.has(loaded.slug)) continue;
    try {
      await publish(
        db,
        registry,
        {
          ownerHandle: plan.registryHandle,
          slug: loaded.slug,
          version: SEED_RELEASE_VERSION,
          /* Passed through as the loader read it, `author` included: the archive credits
             every document to the registry handle, so the owner and the author line already
             agree, and `addCard` stores card `source` verbatim for the export to rebuild the
             folder from. */
          manifest: loaded.bundle.manifest,
          dot: loaded.bundle.dot,
          cardFiles: { ...loaded.bundle.cardFiles },
          ...(vocabulary === undefined ? {} : { vocabulary }),
          /* Explicit, never the account's default. The archive's public-ness is a property
             of where these documents live — `content/` is what the site reads at build time
             and treats as published — not of a preference on the registry row, which a
             later `setDefaultVisibility` could flip and silently take the archive private. */
          visibility: "public",
        },
        storage,
      );
      created += 1;
    } catch (err) {
      /* AC2's second run, and ONLY the digest conflict. `kind` is checked rather than the
         message: a conflict is what "this exact release is already here" refuses with, and
         the four other kinds mean the import did not do what it was asked. Narrowing on the
         class alone would count an unowned slug or a bundle in error as work skipped. */
      if (
        err instanceof PublishRefusedError &&
        err.kind === "conflict" &&
        (await holdsRelease(db, registry.accountId, loaded.slug, loaded.blueprint.digest))
      ) {
        skipped += 1;
        continue;
      }
      throw err;
    }
  }

  return { ...plan, created, skipped };
}

/**
 * Whether the registry's own bundle already carries a release at this digest.
 *
 * `publish` refuses with the same `conflict` kind when a pinned card version is already
 * stored under different bytes, which happens when an earlier import's card rows survive
 * under another account. Counting that as skipped would report a whole archive as already
 * present while nothing was written, so the skip is confirmed against the stored release
 * and every other conflict leaves with `publish`'s own message.
 */
async function holdsRelease(db: Db, ownerId: string, slug: string, digest: string): Promise<boolean> {
  const bundle = await getBundle(db, ownerId, slug);
  if (bundle === undefined) return false;
  return (await getRelease(db, bundle.id, digest)) !== undefined;
}

/**
 * The registry account, created if it is not there, and the `Actor` that publishes as it.
 *
 * `{ kind: "account" }` and never `{ kind: "operator" }` (D-250-05). The seed import is the
 * registry account publishing its OWN content, not an operator acting on somebody else's
 * behalf, and `audit_log.actor_kind` is a permanent record of which of those happened
 * (B-14). Constructed here rather than taken as a parameter for the same reason: a
 * parameter would let a caller make it the other thing.
 *
 * `upsertFromGitHub` is the only door that creates an account, and it is idempotent by
 * `githubId` — a second run updates the login and returns the same id. `changeHandle` is
 * what sets `account.handle`; `allocateHandle` writes only `handle_reservation`, and
 * `resolveOwner` — which `publish` calls — reads the account column.
 */
async function registryActor(db: Db, handle: string): Promise<Extract<Actor, { kind: "account" }>> {
  const account = await upsertFromGitHub(db, { githubId: REGISTRY_GITHUB_ID, githubLogin: REGISTRY_HANDLE });

  if (account.handle === handle) return { kind: "account", accountId: account.accountId, handle };

  /* The sentinel row may already hold a different handle, when an earlier registry account
     was never retired. Renaming it here would move that account's bundles under the new
     handle in silence and leave the old handle for a later `account:retire` to miss, so the
     import stops and names both. */
  if (account.handle !== null) {
    throw new Error(
      `runImport: the registry account already holds the handle \`${account.handle}\`, and this import publishes under \`${handle}\`. Retire that account first (npm run account:retire -- --handle ${account.handle}), then import again.`,
    );
  }

  /* `requireAccountOwner` compares the actor's `accountId` to the one being written, so the
     account claims its own first handle. `handle` is `null` here, which T050's AC1 rules a
     signed-in and incomplete account, and `changeHandle` does not call `requireHandle`, which
     is what lets a first claim through. */
  const claimant: Actor = { kind: "account", accountId: account.accountId, handle: account.handle };
  /* The result is discarded and the actor carries the handle just claimed. `AccountRecord`
     spells it `author.handle: string | null`, so reading it back would need a non-null
     assertion here — a claim about a value this call has already made true, written as a
     cast that would compile whatever the column held. `changeHandle` throws rather than
     returning a row that disagrees. */
  await changeHandle(db, claimant, account.accountId, handle);
  return { kind: "account", accountId: account.accountId, handle };
}
