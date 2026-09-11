import { RailScrollSpy } from "darkprint";

/**
 * `RailScrollSpy` renders `null` — it is a scroll listener that writes `data-rail-active`
 * onto whichever `SideRail` row's section the reader is currently in. There is no scroll
 * in a static capture, so the row this card marks active is set by hand rather than by the
 * component; the hrefs below point at fragments this isolated page does not contain, so the
 * spy's own effect finds nothing to mark over it and the depicted state holds. This is
 * `SideRail`'s row markup, reproduced rather than imported, since only the spy is this
 * batch's component.
 */
export const NavWithATrackedRow = () => (
  <nav id="side-rail-nav" aria-label="On this blueprint" className="w-64 rounded-md border border-line bg-surface p-2">
    <RailScrollSpy />
    <ul className="flex flex-col gap-0.5">
      {[
        { href: "#topology", label: "Topology" },
        { href: "#cards", label: "Node cards" },
        { href: "#autonomy", label: "Autonomy and static risk" },
        { href: "#downloads", label: "Downloads" },
      ].map((item, i) => (
        <li key={item.href}>
          <a
            href={item.href}
            data-rail-active={i === 2 ? "true" : undefined}
            className="group grid items-baseline gap-2 rounded-md border-l-2 border-transparent px-3 py-2.5 text-muted transition-colors data-[rail-active=true]:border-cyan data-[rail-active=true]:bg-cyan/5 data-[rail-active=true]:text-fg"
          >
            {item.label}
          </a>
        </li>
      ))}
    </ul>
  </nav>
);
