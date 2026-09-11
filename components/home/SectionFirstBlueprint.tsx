import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";

/* ============================================================
   The landing's ending: one door, to the tutorial.

   The page closes on the one thing a reader does next. The heading
   says what it is, one line says what the tutorial does, a strip of
   four short steps says what the click leads to, and the button is
   the only link in the section. `beats.test.ts` holds it to exactly
   one anchor; the registry and the skill stay one click away in the
   header on every page, so the ending does not have to carry them.

   The drafting sheet behind it is the blueprint's own paper
   (`.bp-grid` over a cyanotype ground), the same ground `ContentCard`
   and every figure under `components/explain` draw a blueprint on.
   Behind the button, a fan of rules converges on it: the sheet's own
   ink, drawn a few stops above the graticule, so the eye is led down
   the page to the one control on it. The band is fixed in height and
   anchored to the button rather than to the section, so the lines
   meet at the button at every width, however the heading wraps.
   ============================================================ */

const STEPS = [
  { index: "01", label: "Design in conversation" },
  { index: "02", label: "Watch the graph draw" },
  { index: "03", label: "Enrich through MCP" },
  { index: "04", label: "Keep it on your account" },
] as const;

/* The x positions the fan starts from along the band's top edge, in the SVG's own units;
   every rule ends at the bottom centre, under the button. `preserveAspectRatio="none"`
   stretches the band to the container, and `non-scaling-stroke` keeps every rule one
   pixel wide under that stretch. */
const FAN_ORIGINS = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000] as const;

export function SectionFirstBlueprint() {
  return (
    <section
      id="first-blueprint"
      className="relative scroll-mt-24 overflow-hidden border-t border-line bg-void py-20 sm:py-28"
    >
      {/* Masked top and bottom so the ruling arrives out of the border above and leaves
          before the footer, rather than reading as a texture swatch with two hard edges. */}
      <div
        aria-hidden
        className="bp-grid pointer-events-none absolute inset-0 bg-blueprint-deep/40"
        style={{
          maskImage: "linear-gradient(to bottom, transparent, black 18%, black 82%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent, black 18%, black 82%, transparent)",
        }}
      />

      <div className="container-page relative flex flex-col items-center text-center">
        <SectionHeading
          title="Write your first blueprint"
          lead="The tutorial takes you from a small task to a folder your agent can run, and the graph draws itself as you answer."
          align="center"
        />

        <ol
          aria-label="The four steps of the tutorial"
          className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 font-mono text-[12px] text-dim"
        >
          {STEPS.map((step, i) => (
            <li key={step.index} className="flex items-center gap-3">
              <span>
                <span className="text-cyan">{step.index}</span> {step.label}
              </span>
              {i < STEPS.length - 1 && (
                <span aria-hidden className="text-line-bright">
                  →
                </span>
              )}
            </li>
          ))}
        </ol>

        {/* The band the fan is drawn in. It reaches up behind the strip and the lead so
            the rules have room to converge, and it sits under the button in the stacking
            order with no pointer events of its own, so the click lands on the anchor. */}
        <div className="relative mt-12 flex w-full justify-center">
          <svg
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-28 h-[calc(100%+7rem)] w-full text-blueprint-line"
            viewBox="0 0 1000 200"
            preserveAspectRatio="none"
            style={{
              maskImage: "linear-gradient(to bottom, transparent, black 45%)",
              WebkitMaskImage: "linear-gradient(to bottom, transparent, black 45%)",
            }}
          >
            {FAN_ORIGINS.map((x) => (
              <line
                key={x}
                x1={x}
                y1={0}
                x2={500}
                y2={200}
                stroke="currentColor"
                strokeOpacity={0.35}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
          <span className="lit relative inline-flex rounded-md">
            <ButtonLink href="/tutorial" size="lg">
              Write your first blueprint <span aria-hidden>→</span>
            </ButtonLink>
          </span>
        </div>

        <p className="mt-5 text-sm text-dim">In Claude Code or Codex. No account needed to start.</p>
      </div>
    </section>
  );
}
