import { RouteBoxLink } from "darkprint";

/** Both arrows of a pager, which is where this box does its work. */
export const Pager = () => (
  <div className="flex flex-col gap-4 sm:flex-row">
    <RouteBoxLink
      href="/spec/ontology"
      rel="prev"
      label={<><span aria-hidden>←</span> Previous · run 2</>}
      title="The ontology"
    />
    <RouteBoxLink
      href="/spec/scoring"
      rel="next"
      className="sm:ms-auto sm:text-right"
      label={<>Next · run 4 <span aria-hidden>→</span></>}
      title="The scoring model"
    />
  </div>
);

/** A single box leaving the page, with no pager around it. */
export const Standalone = () => (
  <RouteBoxLink
    href="/nodes"
    label={<>The card library <span aria-hidden>→</span></>}
    title="Every published node card"
  />
);
