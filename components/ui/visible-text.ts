/* ============================================================
   Reading a rendered page the way a reader does.

   `components/ui/More.tsx` and the inline `<details>` disclosures
   around the site are the licensed way to cut density without
   cutting content: the text stays in the prerendered HTML, stays
   keyboard-reachable and stays findable by find-in-page.

   That licence has a boundary, and the guards that hold the site to
   it need to be able to see the boundary. A statement that
   *qualifies* something printed in the open has to be in the open
   with it, or the qualified thing is read alone. So there are two
   readings of a page and they are not the same number:

     `plainText` — everything, folded or not.
     `openText`  — the same, minus the body of every closed
                   `<details>`. The `<summary>` stays, because that
                   is the line a reader sees without opening
                   anything.

   Used by `components/site/honesty.test.ts`. It lives here and not
   in a test file because a helper imported across two test files
   registers that file's suites twice.
   ============================================================ */

/** The five characters React escapes on the way into markup, undone. */
function unescape(html: string): string {
  return html
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

/** Tags out, entities resolved, whitespace flattened. */
export function plainText(html: string): string {
  return unescape(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

/**
 * The same, with the body of every closed `<details>` dropped.
 *
 * Innermost first, so a disclosure nested inside another resolves before the one around
 * it and a summary is never eaten by an outer replacement.
 */
export function openText(html: string): string {
  let out = html;
  for (let pass = 0; pass < 40; pass += 1) {
    const next = out.replace(
      /<details\b(?![^>]*\bopen\b)[^>]*>([\s\S]*?)<\/details>/gi,
      (whole, inner: string) => {
        if (/<details\b/i.test(inner)) return whole;
        const summary = inner.match(/<summary\b[^>]*>[\s\S]*?<\/summary>/i);
        return summary ? summary[0] : " ";
      },
    );
    if (next === out) break;
    out = next;
  }
  return plainText(out);
}
