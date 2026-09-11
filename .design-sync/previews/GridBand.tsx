import { GridBand } from "darkprint";

/**
 * Both real callers (`app/blueprints/page.tsx`, `app/nodes/page.tsx`) mount it bare — no
 * `className` override, default `h-[34rem]` — inside a `relative` host with the shelf's
 * own `SectionHeading` sitting over it in `container-page`. Ported verbatim rather than
 * shrunk: the clearing's radial gradient is sized against this exact height.
 */
export const OverBlueprintsShelf = () => (
  <div className="relative">
    <GridBand />
    <div className="container-page relative py-12 sm:py-16">
      <p className="eyebrow">Registry</p>
      <h1 className="mb-3 font-display text-4xl font-semibold text-fg sm:text-5xl">Blueprints</h1>
      <p className="max-w-2xl text-lg text-muted">
        Every one is a folder of text. Read the graph here. Take it away. Run it with your own tools.
      </p>
    </div>
  </div>
);

/** `/nodes`' identical head, different words — the same band the shelf's own docblock argues both galleries must share. */
export const OverNodesShelf = () => (
  <div className="relative">
    <GridBand />
    <div className="container-page relative py-12 sm:py-16">
      <p className="eyebrow">Registry</p>
      <h1 className="mb-3 font-display text-4xl font-semibold text-fg sm:text-5xl">Node cards</h1>
      <p className="max-w-2xl text-lg text-muted">
        The cards the registry&apos;s blueprints are assembled from, grouped by what kind of step they are.
      </p>
    </div>
  </div>
);
