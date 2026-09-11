import { AutonomyMeter, BundleHeader, KindBadge, TagPill } from "darkprint";

/**
 * The band `/blueprints/<owner>/<slug>` and the owner's own draft view both mount, ported
 * from `app/blueprints/[owner]/[slug]/page.tsx`'s real call: owner, slug, the four actions,
 * and (via `children`) the kind badge, autonomy reading and tags a published page stacks
 * under the summary. `star`/`watch`/`fork` are omitted on purpose — they are T280's live
 * props and passing them would fire a `fetch` at capture time; the drawn-and-disabled
 * defaults below are what every one of today's callers falls back to without them anyway.
 */
const orin = { username: "orin", displayName: "Orin", avatarHue: 192, validator: true };

const autonomy = {
  autonomyClass: "closed-loop",
  label: "Closed-loop",
  isDarkFactory: true,
  level: 4,
  blurb: "No node in this graph waits for a person.",
};

/** The published band: title, clone command, watchers and forks already counted. */
export const Published = () => (
  <BundleHeader
    owner={orin}
    slug="starter-software-factory"
    visibility="public"
    validator={orin.validator}
    title="Starter Software Factory"
    summary="The canonical five-node factory: plan, build, test, debug, release, and the one edge it deliberately does not have."
    watchers={14}
    forks={3}
    saveId="blueprint:starter-software-factory"
    clone={{
      command:
        'curl --fail-early -fsSL --create-dirs -o "starter-software-factory/#1" "https://darkprint.dev/blueprints/orin/starter-software-factory/{blueprint.yaml,topology.dot}"',
      cliCommand: "darkprint clone orin/starter-software-factory",
    }}
  >
    <div className="mt-1 flex flex-wrap items-center gap-3">
      <KindBadge kind="blueprint" />
      <AutonomyMeter autonomy={autonomy} size="sm" />
      <div className="flex gap-1.5">
        <TagPill label="starter" />
        <TagPill label="tutorial" />
        <TagPill label="isolation" />
      </div>
    </div>
  </BundleHeader>
);

/** The lineage line, the "forked" pill and the amber drift note — a copy whose upstream has since repinned a card. */
export const ForkedWithDrift = () => (
  <BundleHeader
    owner={{ username: "lupo", displayName: "Lupo", avatarHue: 28, validator: false }}
    slug="starter-software-factory-hardened"
    visibility="private"
    title="Starter Software Factory, hardened"
    summary="The starter graph with a human gate in front of the deploy step."
    lineage={{ owner: "orin", slug: "starter-software-factory", version: "1.0.0" }}
    driftNote="spec-planner repinned 1.0.0 → 1.1.0"
    watchers={0}
    forks={0}
    saveId="blueprint:starter-software-factory-hardened"
  >
    <div className="mt-1 flex flex-wrap items-center gap-3">
      <KindBadge kind="blueprint" />
      <AutonomyMeter autonomy={{ ...autonomy, autonomyClass: "supervised", label: "Supervised", isDarkFactory: false, level: 3 }} size="sm" />
    </div>
  </BundleHeader>
);
