/* ============================================================
   DarkPrint backend — what a served file says it is
   Keyed on the extension rather than on the file's name, because
   `cards/<ref>.yaml` is one name per pinned card and a table of
   names would have to be rebuilt every time the export's file set
   moved — which is `lib/content/bundle-export.ts`'s decision and
   not this module's.

   Every file the export produces is UTF-8 text, so every entry
   carries the charset. A caller writing bytes to disk ignores
   this; a browser opening one does not, and `factory.dot` with
   an unstated charset renders a mojibake node label for every
   card whose spec is not ASCII.
   ============================================================ */

const BY_EXTENSION: ReadonlyMap<string, string> = new Map([
  ["md", "text/markdown; charset=utf-8"],
  // RFC 9512, registered 2024. `text/yaml` and `application/x-yaml` are both pre-registry
  // spellings still in wide use; this is the one with a number behind it.
  ["yaml", "application/yaml; charset=utf-8"],
  ["yml", "application/yaml; charset=utf-8"],
  // Graphviz's own registered type. `text/plain` would be true and would lose the one
  // thing a client could dispatch on.
  ["dot", "text/vnd.graphviz; charset=utf-8"],
]);

/**
 * `text/plain; charset=utf-8` for anything the map does not name.
 *
 * Deliberately not `application/octet-stream`: every file in an export is text, and the
 * day the export adds a fifth kind, a default that says "unknown bytes" would make a
 * browser download it where the honest default merely under-describes it.
 */
export function contentTypeFor(path: string): string {
  const dot = path.lastIndexOf(".");
  const slash = path.lastIndexOf("/");
  if (dot <= slash + 1) return "text/plain; charset=utf-8";
  return BY_EXTENSION.get(path.slice(dot + 1).toLowerCase()) ?? "text/plain; charset=utf-8";
}
