import type { NextConfig } from "next";

/**
 * Files the sentence encoder reads from disk at runtime, which the build's import tracer
 * cannot see: the vendored MiniLM weights under `models/` and the Linux onnxruntime binary
 * with the shared library it dlopens. Without them a Vercel function loads no encoder and
 * search silently degrades to lexical-only.
 */
const ENCODER_FILES = ["./models/**", "./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/**"];

/**
 * Sent on every response. No Content-Security-Policy: the app inlines styles and scripts
 * through Next and `next/font`, and a policy that keeps those working needs a nonce pass
 * nobody has verified yet.
 */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  // Pin the workspace root: stray lockfiles exist in parent directories.
  turbopack: {
    root: import.meta.dirname,
  },

  /**
   * Only the routes that embed a query or a publish carry the ~70MB encoder. Publishing
   * re-embeds inside its own transaction, so `/api/bundles` needs it; the registry pages
   * call the searchers with no query and never load the model. `/api/health` reports
   * whether the encoder loads, which is only a true answer if its function carries the
   * same files.
   */
  /* One key for every route rather than one per embedding route. Vercel groups routes whose
     traces agree into a single function; per-route includes split the app into more bundles
     than the Hobby plan's cap of twelve allows, and the deploy is refused. A uniform trace keeps
     the grouping and costs each bundle the encoder's files once. */
  outputFileTracingIncludes: {
    "/*": ENCODER_FILES,
    "/**": ENCODER_FILES,
  },

  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },

  /**
   * Every retired path lands on the page that now holds its content, in one hop: a 308
   * onto a route that itself 308s costs every old link two round trips. `permanent: true`
   * because each rename was a decision rather than an experiment. Redirects are checked
   * before the filesystem, so a directory reappearing at an old path is shadowed by its
   * entry here; `components/site/nav.test.ts` fails if one does.
   */
  async redirects() {
    return [
      // The blueprints index used to be called the gallery; Next passes the query string through.
      { source: "/gallery", destination: "/blueprints", permanent: true },
      // Reusable sub-graphs became the one node-card library; a part was never a card, so its slug is dropped.
      { source: "/parts", destination: "/nodes", permanent: true },
      { source: "/parts/:slug", destination: "/nodes", permanent: true },
      // The vocabulary is printed beside the card fields that consume it, so every old ontology path lands on the card spec.
      { source: "/ontology", destination: "/spec/card", permanent: true },
      { source: "/ontologies", destination: "/spec/card", permanent: true },
      { source: "/ontologies/:slug", destination: "/spec/card", permanent: true },
      { source: "/spec/ontology", destination: "/spec/card", permanent: true },
      // The four-phase guide and its "which tasks" child both folded into one page.
      { source: "/how-to-build-a-dark-factory", destination: "/towards-a-dark-factory", permanent: true },
      { source: "/towards-a-dark-factory/the-climb", destination: "/towards-a-dark-factory", permanent: true },
      { source: "/which-tasks", destination: "/towards-a-dark-factory", permanent: true },
      { source: "/towards-a-dark-factory/which-tasks", destination: "/towards-a-dark-factory", permanent: true },
      // The spec overview, the scoring page and the concepts page are all introduced by the first Learn page now.
      { source: "/spec", destination: "/what-a-blueprint-is", permanent: true },
      { source: "/spec/scoring", destination: "/what-a-blueprint-is", permanent: true },
      { source: "/reading-the-radar", destination: "/what-a-blueprint-is", permanent: true },
      { source: "/concepts", destination: "/what-a-blueprint-is", permanent: true },
      // The install page split into the skill page and the MCP page; the install command lived on the skill half.
      { source: "/install", destination: "/skill", permanent: true },
    ];
  },
};

export default nextConfig;
