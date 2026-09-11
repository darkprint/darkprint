import { SideRail } from "darkprint";

/**
 * The sticky documentation rail three surfaces mount: a blueprint's own sections
 * (`app/blueprints/[owner]/[slug]/page.tsx`), and `/settings`' seven, which is the one
 * caller that takes `compact` (below `xl` the rail draws nothing at all, so `/settings`
 * — no footer sequence of its own — asks for the horizontal chip fallback instead).
 *
 * NEEDS-WORK, config-level: the desktop `<aside>` is `hidden … xl:block` (1280px), and
 * this bundle's review capture is 900×700 — see `.design-sync/learnings/batch-2.md` for
 * the requested `cfg.overrides.SideRail` viewport. `SettingsCompact` below does not
 * depend on it: the compact row is `xl:hidden`, so it is exactly what a narrow capture
 * shows.
 */
const BLUEPRINT_SECTIONS = [
  { href: "#files", label: "Files", step: "01" },
  { href: "#blueprint-workspace", label: "Graph and cards", step: "02" },
  { href: "#evidence", label: "Evidence", step: "03" },
  { href: "#history", label: "History", step: "04" },
  { href: "#use-this-blueprint", label: "Use this release", step: "05" },
  { href: "#blueprint-source", label: "Source", step: "06" },
  { href: "#community-notes", label: "Community notes", step: "07" },
];

/** The desktop rail beside the page it belongs to, real `BLUEPRINT_SECTIONS` content. */
export const OnThisBlueprint = () => (
  <SideRail label="On this blueprint" meta={`${BLUEPRINT_SECTIONS.length} sections`} items={BLUEPRINT_SECTIONS} ariaLabel="On this blueprint">
    <div className="p-8">
      <h2 id="files" className="font-display text-2xl font-semibold text-fg">
        Files
      </h2>
      <p className="mt-2 max-w-xl text-muted">
        Three files: <code className="font-mono text-cyan">blueprint.yaml</code>,{" "}
        <code className="font-mono text-cyan">topology.dot</code>, and the cards the topology pins.
      </p>
    </div>
  </SideRail>
);

const SETTINGS_SECTIONS = [
  { href: "#public-profile", label: "Public profile", step: "01" },
  { href: "#account-handle", label: "Account & handle", step: "02" },
  { href: "#notifications", label: "Email & notifications", step: "03" },
  { href: "#default-visibility", label: "Default visibility", step: "04" },
  { href: "#validator-status", label: "Validator status", step: "05" },
  { href: "#api-keys", label: "API keys", step: "06" },
  { href: "#danger-zone", label: "Danger zone", step: "07", tone: "signal" },
];

/** `/settings`' `compact` fallback: a horizontal chip row, `xl:hidden`, so it is what a narrow viewport actually shows. */
export const SettingsCompact = () => (
  <SideRail
    label="Settings"
    items={SETTINGS_SECTIONS}
    ariaLabel="Settings sections"
    compact
    footer={<span className="font-mono text-[11px] text-dim">← Back to your profile</span>}
  >
    <div className="p-8">
      <h2 className="font-display text-2xl font-semibold text-fg">Public profile</h2>
      <p className="mt-2 max-w-xl text-muted">What a visitor to `/u/orin` sees before they open anything you made.</p>
    </div>
  </SideRail>
);
