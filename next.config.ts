import type { NextConfig } from "next";

/**
 * Files the sentence encoder reads from disk at runtime, which the build's import tracer
 * cannot see: the vendored MiniLM weights under `models/` and the onnxruntime binary with
 * the shared library it dlopens. A prebuilt deployment runs on linux/arm64 (the builder
 * declares it and /api/health on such a deployment asked for the arm64 binding), so that is
 * the one platform traced; a build made on Vercel's own machines runs x64 instead. The
 * binding is required through a `${platform}/${arch}` template, which makes the tracer keep
 * every platform's binaries unless they are excluded, and that surplus alone pushed the
 * deployment past the Hobby plan's function grouping.
 */
const ENCODER_FILES = ["./models/**", "./node_modules/onnxruntime-node/bin/napi-v6/linux/arm64/**"];
/** The route paths whose functions load the encoder: the two searchers, the MCP find tools and endpoint, publish (which re-embeds), and the health probe. */
const ENCODER_ROUTES = [
  "/api/search/blueprints",
  "/api/search/cards",
  "/api/mcp",
  "/api/mcp/blueprints/find",
  "/api/mcp/cards/find",
  "/api/bundles",
  "/api/health",
];

const FOREIGN_BINARIES = [
  "./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/**",
  "./node_modules/onnxruntime-node/bin/napi-v6/darwin/**",
  "./node_modules/onnxruntime-node/bin/napi-v6/win32/**",
  /* `@huggingface/transformers` imports sharp at load, so sharp stays; only the builds for
     platforms the function will never run on go. A prebuilt deploy from a Mac carries the
     linux-arm64 pair because the release steps install them alongside the host's. */
  "./node_modules/@img/sharp-darwin*/**",
  "./node_modules/@img/sharp-libvips-darwin*/**",
  "./node_modules/@img/sharp-win32*/**",
  "./node_modules/@img/sharp-linux-x64/**",
  "./node_modules/@img/sharp-libvips-linux-x64/**",
  "./node_modules/@img/sharp-linuxmusl*/**",
  "./node_modules/@img/sharp-libvips-linuxmusl*/**",
  "./node_modules/@img/sharp-wasm32/**",
];

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

  /* Only the routes that embed carry the encoder. Vercel groups routes whose traces agree
     into one function, and on the Hobby plan a deployment may hold twelve functions at most;
     giving every route the 60MB of weights and native library pushed the grouping past that
     cap, while a handful of routes sharing one trace form one extra group. Routes outside
     this list answer `encoder: "absent"` and rank on words alone, which is what they did
     before the vector channel existed. */
  outputFileTracingIncludes: Object.fromEntries(ENCODER_ROUTES.map((route) => [route, ENCODER_FILES])),
  outputFileTracingExcludes: {
    "/*": FOREIGN_BINARIES,
    "/**": FOREIGN_BINARIES,
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
