import type { NextConfig } from "next";
import path from "node:path";

// `compiler.styledComponents` is Next's own SWC transform, so the lane stays on
// Turbopack. What it does is add a stable component id and display name; it does
// not resolve any style, which is the point of this lane.
const nextConfig: NextConfig = {
  turbopack: {},
  compiler: { styledComponents: true },
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
