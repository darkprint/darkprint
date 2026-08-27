import { Badge } from "darkprint";

/** The three content kinds, exactly the colours `KindBadge` hands down to `Badge` on a search result or a shelf tile. */
export const ContentKinds = () => (
  <div className="flex flex-wrap gap-2">
    <Badge color="var(--color-cyan)">Blueprint</Badge>
    <Badge color="var(--color-amber)">Node</Badge>
    <Badge color="var(--color-violet)">Ontology</Badge>
  </div>
);

/** `ProfileHeader`'s validator badge: the default surface overridden to a cyan tint. */
export const Validator = () => (
  <Badge color="var(--color-cyan)" className="border-cyan/40! bg-cyan/10! text-cyan!">
    ✦ Validator
  </Badge>
);

/** `/settings`'s reading for an account with no validator standing, dim rather than absent. */
export const NotAValidator = () => <Badge color="var(--color-dim)">Not a validator</Badge>;

/** The node-type chip `NodeCardSummary` sets at the head of every tile. */
export const NodeType = () => <Badge color="var(--color-amber)">Tool</Badge>;
