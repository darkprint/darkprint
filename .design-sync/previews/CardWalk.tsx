import { CardWalk, SectionHeading } from "darkprint";
import { cardSource, getNodeCard } from "@/lib/content";

// `useScrollProgress` starts at progress 1 (the finished drawing) and only steps
// backwards to animate when `useMotionAllowed()` says motion is welcome. That hook
// reads `prefers-reduced-motion`, and the capture harness never emulates it, so the
// component freezes at its entrance frame and hides the very content it reveals.
// Answering the query the way a reduced-motion reader's browser would runs the
// component's own documented no-motion path, which is the resting state a card wants.
if (typeof window !== "undefined") {
  const passthrough = window.matchMedia.bind(window);
  window.matchMedia = (query) =>
    query.includes("prefers-reduced-motion")
      ? ({
          matches: true,
          media: query,
          onchange: null,
          addEventListener() {},
          removeEventListener() {},
          addListener() {},
          removeListener() {},
          dispatchEvent: () => false,
        } as MediaQueryList)
      : passthrough(query);
}


/**
 * The landing's own card and heading (`SectionNodeIsCard`), minus the six metadata keys
 * that beat hides (notes, requires_human, risk_markers, version, author,
 * ontology_version) — ported the same way that component builds it, off the real
 * archive text rather than a typed-up excerpt.
 */
const CARD_REF = "code-builder@1.0.0";
const HIDDEN_KEYS = [
  "notes",
  "requires_human",
  "risk_markers",
  "version",
  "author",
  "ontology_version",
] as const;

function withoutKeys(card: string, keys: readonly string[]): string {
  let lines = card.split("\n");
  for (const key of keys) {
    const at = lines.findIndex((line) => new RegExp(`^${key}:`).test(line));
    if (at === -1) continue;
    let end = at + 1;
    while (end < lines.length && (lines[end].trim() === "" || /^\s/.test(lines[end]))) end += 1;
    lines = [...lines.slice(0, at), ...lines.slice(end)];
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
}

const source = cardSource(CARD_REF);
const card = getNodeCard("code-builder", "1.0.0")?.card;
if (source === undefined || card === undefined) {
  throw new Error("code-builder@1.0.0 fixture is missing from the content shim");
}

/** The static layout (no scroll choreography in a capture): all nine parts open at once. */
export const NineParts = () => (
  <CardWalk
    source={withoutKeys(source, HIDDEN_KEYS)}
    cardRef={CARD_REF}
    card={card}
    heading={
      <SectionHeading
        title={<span className="text-copper-line">Every node is a card</span>}
        lead="Open one and it says what it does, the brief it is handed, which model runs it, what arrives, and what must never reach it."
        align="center"
        className="mx-auto"
      />
    }
  />
);
