import { SpecLink } from "darkprint";

/** Internal, mid-sentence: a route on this site, the common case. */
export const Internal = () => (
  <p className="max-w-md text-sm leading-relaxed text-muted">
    A blueprint that leaks its acceptance criteria fails{" "}
    <SpecLink href="/upload">the upload check</SpecLink>. See{" "}
    <SpecLink href="/spec/topology">the topology layer</SpecLink> for how the graph is walked.
  </p>
);

/** External: leaves the site, so it opens in a new tab and carries `rel="noreferrer noopener"`. */
export const External = () => (
  <p className="max-w-md text-sm leading-relaxed text-muted">
    The DOT grammar this parser accepts is Graphviz&apos;s own, described in full at{" "}
    <SpecLink href="https://graphviz.org/doc/info/lang.html" external>
      graphviz.org
    </SpecLink>
    .
  </p>
);
