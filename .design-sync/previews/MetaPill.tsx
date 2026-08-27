import { MetaPill } from "darkprint";

/** The two tones. `surface` is reserved for the one fact a reader should read first. */
export const Tones = () => (
  <div className="flex flex-wrap items-center gap-2">
    <MetaPill tone="surface">Public</MetaPill>
    <MetaPill tone="line">forked</MetaPill>
    <MetaPill tone="line">v1.2.0</MetaPill>
  </div>
);

/** Beside a bundle name, the way `BundleHeader` and `OwnedBundles` actually draw it. */
export const OnAShelf = () => (
  <div className="flex items-center gap-2 rounded-lg border border-line bg-surface p-3">
    <span className="font-mono text-xs text-dim">starter-software-factory</span>
    <MetaPill tone="surface">latest</MetaPill>
    <MetaPill tone="line">Draft</MetaPill>
  </div>
);
