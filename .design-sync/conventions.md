## Building with DarkPrint

DarkPrint is the design system of a registry for agent-workflow blueprints. It
has two poles: a dark "lights-off factory" ground, which is the default, and a
blueprint/cyanotype register that sections opt into locally.

### Setup

There is no provider and no theme wrapper. Every component is a plain React
component on `window.DarkPrint`, and `styles.css` already paints the page:

```
html body { background: var(--color-void); color: var(--color-fg); }
```

Do not put a light background behind these components. Every colour, border and
shadow in the system assumes the dark ground, and on white the body text is
invisible.

Two behaviours are inert by design, because they belong to the Next.js app this
was extracted from: components that render a link produce a plain `<a>`, and
router calls do nothing. Compose around that rather than trying to wire it.

### The styling idiom

Tailwind v4, with every utility generated from the design tokens. Use the token
utilities; do not reach for raw hex or arbitrary values.

| Family | Utilities |
| --- | --- |
| Grounds | `bg-void` `bg-surface` `bg-surface-2` `bg-surface-3` |
| Rules | `border-line` `border-line-bright` `border-faint` |
| Text | `text-fg` `text-muted` `text-dim` |
| Blueprint pole | `bg-blueprint` `bg-blueprint-deep` `text-blueprint-line` `text-blueprint-ink` |
| Copper pole | `bg-copper` `text-copper-line` `text-copper-ink` (the node-card figure, and nothing else) |
| Signals | `text-signal` `text-amber` `text-cyan` `text-emerald` `text-violet` `text-warn` `text-key` |
| Type | `font-sans` `font-mono` `font-display` |

`text-faint` is decorative only. It sits at 1.83:1 and must never carry live
text.

Composite classes carry patterns that recur across the site: `.panel` (the
standard bordered surface), `.eyebrow` and `.label` (mono uppercase micro-type),
`.route-box` (a box whose link leaves the page, in amber), `.tick-frame`,
`.container-page`, `.lit`, and the grid grounds `.bp-grid` `.copper-grid`
`.tech-grid` `.dot-grid`.

**Spacing is a fixed scale of seven tiers.** A value off this list is a number
somebody typed rather than a decision anybody made:

```
inline  8px   gap-2          tight  12px  gap-3 / p-3
element 16px  gap-4 / p-4    card   20px  gap-5 / p-5
block   40px  mt-10 / gap-10 section 64px  py-16 sm:py-20
band    80/112px  py-20 sm:py-28
```

`p-6` and `p-8` on a panel collapse to `p-5`. Avoid 48, 56, 32 and 96 as
structural values; each collapses to the tier above it.

**Stacking is one ladder of five rungs**: header 50, page chrome 40, section
chrome 30, card furniture 20, card hit target 10. Nothing inside a card exceeds
20. A new sticky element picks a rung rather than inventing a number.

**Text runs full width.** There is no prose-lane or `max-w` on headings,
figures, tables or listings. `.prose-lane` exists and is reserved for body prose
alone; a `SectionHeading` lead in particular must reach the right edge of its
column.

### Where the truth lives

Read `_ds/<folder>/styles.css` and the files it imports for the tokens and the
composite classes. Each component's own `.d.ts` carries its real prop types with
the authors' JSDoc, and its `.prompt.md` sits beside it. Those beat any summary.

### An idiomatic composition

```jsx
<section className="py-16 sm:py-20">
  <SectionHeading
    eyebrow="The registry"
    title="The published archive"
    lead="Every blueprint is a folder your harness can run."
  />
  <div className="mt-10 grid gap-5 sm:grid-cols-2">
    <article className="panel p-5">
      <div className="eyebrow">starter-software-factory</div>
      <p className="mt-3 text-sm text-muted">
        Four nodes: one branches to two, and both come back together at a fourth.
      </p>
      <div className="mt-4 flex gap-2">
        <Badge color="var(--color-cyan)">agent</Badge>
        <Badge color="var(--color-amber)">human</Badge>
      </div>
      <div className="mt-5">
        <Button variant="primary" size="sm">Inspect the blueprint</Button>
      </div>
    </article>
  </div>
</section>
```
