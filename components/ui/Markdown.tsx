/* ============================================================
   The view half of `markdown-parse.ts`: a parsed document, drawn.

   The reference the owner named is GitHub's README panel, so the shapes are GitHub's —
   a ruled h1 and h2, a grey-barred blockquote, a boxed code block, a bordered table with
   a shaded header row — spoken in this site's own tokens rather than GitHub's greys.

   ── the one thing this file may never do ──
   Every author string arrives as a TEXT CHILD of a React element. There is no
   `dangerouslySetInnerHTML` here, in any branch, and there must never be one: the
   README's title, summary, card names and node labels come from `blueprint.yaml` and
   `content/cards/*.yaml`, which on a live registry is text a stranger typed. React
   escapes a text child, so `<script>` reaches the reader as five visible characters.
   `markdown.test.ts` asserts the absence of that prop over this file's own source, which
   is a guard rather than a comment because the rule has to survive an edit made in a
   hurry by somebody who has not read this paragraph.

   ── width ──
   Nothing here carries a `max-w-*`, and `.prose-lane` is not applied. Text on this site
   runs the full width of the column it is given (standing ruling, restated by the owner
   when this panel was specified). The two containers that DO cap something cap it
   sideways and not by measure: a table and a code block scroll inside their own box so
   the page never scrolls with them.
   ============================================================ */

import { cx } from "@/lib/format";

import { parseMarkdown, type Block, type ColumnAlign, type Inline } from "./markdown-parse";

/* A scrollable box holds no focusable cell of its own, so it needs a tab stop to be
   reachable by keyboard at all (WCAG 2.1.1). Same treatment the risk ledger in
   `components/blueprint/Explainability.tsx` already gets, for the same reason. */
function Scroller({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div tabIndex={0} role="group" aria-label={label} className={cx("overflow-x-auto", className)}>
      {children}
    </div>
  );
}

function renderInline(nodes: Inline[]): React.ReactNode {
  return nodes.map((node, index) => {
    switch (node.kind) {
      case "text":
        return node.text;
      case "code":
        return (
          <code
            key={index}
            className="rounded-sm bg-surface-3 px-1.5 py-0.5 font-mono text-[13px] text-fg"
          >
            {node.text}
          </code>
        );
      case "strong":
        return (
          <strong key={index} className="font-semibold text-fg">
            {renderInline(node.children)}
          </strong>
        );
      case "em":
        return (
          <em key={index} className="italic">
            {renderInline(node.children)}
          </em>
        );
      case "link":
        /* `nofollow noopener noreferrer` on every one of them. The destination is
           author-supplied, so this document is an open invitation to farm link equity
           and to leak a referrer to whoever a stranger points at. `safeHref` has already
           refused anything that is not http, https, mailto or relative. */
        return (
          <a
            key={index}
            href={node.href}
            rel="nofollow noopener noreferrer"
            className="text-cyan underline decoration-line underline-offset-2 hover:text-cyan-bright"
          >
            {renderInline(node.children)}
          </a>
        );
    }
  });
}

/* Indexed by level rather than built as `h${level}`, so the tag is a real union and not
   a string cast: a template literal would typecheck against `h1` while being able to
   hold anything, which is exactly the assertion that stops meaning something. */
const HEADING_TAG = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;

/* h1 and h2 are ruled and the rest are not, which is GitHub's own break: the first two
   levels divide a README into sections and the deeper ones label a paragraph. */
const HEADING_CLASS: Record<number, string> = {
  1: "mt-10 border-b border-line pb-3 text-[26px] leading-tight font-semibold tracking-tight text-fg first:mt-0",
  2: "mt-10 border-b border-line pb-2 text-[20px] leading-snug font-semibold text-fg first:mt-0",
  3: "mt-8 text-[17px] font-semibold text-fg first:mt-0",
  4: "mt-6 text-[15px] font-semibold text-fg first:mt-0",
  5: "mt-6 text-[14px] font-semibold text-fg first:mt-0",
  6: "mt-6 font-mono text-[11px] tracking-[0.18em] uppercase text-dim first:mt-0",
};

const ALIGN_CLASS: Record<Exclude<ColumnAlign, null>, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

function renderBlock(block: Block, key: number): React.ReactNode {
  switch (block.kind) {
    case "heading": {
      /* The tag comes off the level, so the document's own outline is the outline a
         screen reader walks. Clamped because `markdown-parse.ts` only ever emits 1 to 6, and
         a tag name built from an unclamped number would be a React crash rather than a
         wrong heading. */
      const level = Math.min(Math.max(block.level, 1), 6);
      const Tag = HEADING_TAG[level - 1];
      return (
        <Tag key={key} className={HEADING_CLASS[level]}>
          {renderInline(block.children)}
        </Tag>
      );
    }

    case "paragraph":
      return (
        <p key={key} className="mt-4 text-[15px] leading-relaxed text-muted first:mt-0">
          {renderInline(block.children)}
        </p>
      );

    case "fence":
      return (
        <Scroller
          key={key}
          label="Code block, scrollable"
          className="mt-4 rounded-md border border-line bg-surface-2 p-4 first:mt-0"
        >
          {/* `whitespace-pre` rather than `pre-wrap`: the fenced blocks in a bundle README
              are column-aligned key/value listings, and rewrapping one destroys the only
              thing its layout was carrying. It scrolls sideways instead. */}
          <pre className="whitespace-pre">
            <code className="font-mono text-[12px] leading-relaxed text-fg">{block.text}</code>
          </pre>
        </Scroller>
      );

    case "quote":
      return (
        /* `[&_p]:text-dim` and not `text-dim` alone: the paragraphs inside carry their
           own colour, and a class on the child wins over an inherited one however the
           two are nested. Without it a quote renders in body colour and stops reading
           as a quotation. */
        <blockquote
          key={key}
          className="mt-4 border-l-2 border-line-bright pl-4 text-dim first:mt-0 [&_li]:text-dim [&_p]:text-dim"
        >
          {block.children.map(renderBlock)}
        </blockquote>
      );

    case "list": {
      const base = "mt-4 space-y-2 pl-5 text-[15px] leading-relaxed text-muted marker:text-dim first:mt-0";
      const items = block.items.map((item, index) => <li key={index}>{renderInline(item)}</li>);
      /* Two branches rather than one element with a computed tag: `start` belongs to
         `<ol>` and to nothing else, and a union tag would have to be cast to accept it. */
      if (block.ordered) {
        return (
          <ol key={key} start={block.start === 1 ? undefined : block.start} className={cx(base, "list-decimal")}>
            {items}
          </ol>
        );
      }
      return (
        <ul key={key} className={cx(base, "list-disc")}>
          {items}
        </ul>
      );
    }

    case "table":
      return (
        <Scroller key={key} label="Table, scrollable" className="mt-4 rounded-md border border-line first:mt-0">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {block.head.map((cell, index) => (
                  <th
                    key={index}
                    scope="col"
                    className={cx(
                      "border-b border-line bg-surface-2 px-3 py-2 font-mono text-[11px] font-normal tracking-[0.18em] whitespace-nowrap uppercase text-dim",
                      ALIGN_CLASS[block.align[index] ?? "left"],
                    )}
                  >
                    {renderInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, index) => (
                    <td
                      key={index}
                      className={cx(
                        "px-3 py-2 align-top leading-relaxed text-muted",
                        rowIndex > 0 && "border-t border-line",
                        ALIGN_CLASS[block.align[index] ?? "left"],
                      )}
                    >
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Scroller>
      );

    case "rule":
      return <hr key={key} className="mt-8 border-0 border-t border-line" />;
  }
}

/**
 * A Markdown document, rendered as React elements.
 *
 * A server component: it has no state, no effect and no event handler, so it costs the
 * client nothing and the parse happens once at build time for a prerendered page.
 */
export function Markdown({ source, className }: { source: string; className?: string }) {
  /* `break-words` is the third piece of "the page never scrolls sideways", after the two
     scroll boxes. A table and a code block are the constructs whose width is structural;
     a paragraph's is not, and one unbroken 200-character token — a digest, a URL an
     author pasted — would otherwise push the whole column past the viewport. It breaks
     nothing inside the `<pre>`, which is `whitespace-pre` and never wraps at all. */
  return <div className={cx("break-words", className)}>{parseMarkdown(source).map(renderBlock)}</div>;
}
