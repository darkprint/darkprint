/* ============================================================
   DarkPrint core — the immutable content store
   The archive half of doc 1 §5: every object is keyed by the
   SHA-256 of its own bytes, so the key *is* the integrity
   guarantee and two identical cards collapse onto one entry for
   free (doc 1 §4).

   Content addressing here is doc 1 §5.1's decision, not an
   implementation whim: "object storage, non Git", because
   DarkPrint is deliberately untied from GitHub (doc 1 §0.1). The
   hash alone delivers what a DVCS would have been used for —
   immutability (change the content and you change the key, so the
   old object survives untouched), deduplication (two identical
   cards land on one key) and verifiability (a downloader
   recomputes the hash and confirms it is what the site claims).
   The diff between two versions, the one real advantage Git had,
   is computed at runtime over two text objects; Git stays possible
   later as an *export* function, never as the archive, and nothing
   here may grow a dependency on it.

   Doc 1 §5.2 draws the other half of the line — "il contenuto
   immutabile vive nell'object storage indicizzato per hash, i
   metadati di ricerca nel database" — which is why searching,
   tagging and phase coverage live in `registry.ts` and not here.
   ============================================================ */

import { sha256Hex } from "../hash/sha256";

/** One object in the archive: the digest it is filed under and the text it addresses. */
export interface StoredObject {
  digest: string;
  content: string;
}

/** A content-addressed blob store. Writing is idempotent: same content, same key, one entry. */
export interface ContentStore {
  /** File `content` and return its digest. Storing the same content twice changes nothing. */
  put(content: string): string;
  get(digest: string): string | undefined;
  has(digest: string): boolean;
  /** Every digest held, sorted — enumeration is deterministic, never insertion-ordered. */
  list(): readonly string[];
}

/** Algorithm-tagged so a future digest scheme can coexist with this one. */
const DIGEST_PREFIX = "sha256:";

/** The address `content` has in any store: "sha256:<64 hex>". */
export function contentDigest(content: string): string {
  return DIGEST_PREFIX + sha256Hex(content);
}

/** Code-unit comparison, not `localeCompare` — the order must not depend on the host locale. */
function cmpString(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * An in-memory `ContentStore`, optionally rehydrated from `seed`.
 *
 * Seeded objects are re-keyed under `contentDigest(content)` rather than trusted: content
 * addressing means the key is *derived*, so a `StoredObject` whose recorded digest disagrees
 * with its content is filed at its true address and the stale digest reads back as
 * `undefined`. That is exactly the §4 tamper check, and it needs no exception for data that
 * came off storage we do not control.
 */
export function memoryContentStore(seed?: Iterable<StoredObject>): ContentStore {
  const objects = new Map<string, string>();

  const store: ContentStore = {
    put(content) {
      const digest = contentDigest(content);
      // Idempotent by construction: same content -> same key -> same slot.
      objects.set(digest, content);
      return digest;
    },
    get: (digest) => objects.get(digest),
    has: (digest) => objects.has(digest),
    // A fresh array per call, so a caller holding an old one never sees later writes.
    list: () => [...objects.keys()].sort(cmpString),
  };

  if (seed !== undefined) {
    for (const object of seed) store.put(object.content);
  }
  return store;
}
