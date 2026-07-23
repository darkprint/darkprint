import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root: stray lockfiles exist in parent directories.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
