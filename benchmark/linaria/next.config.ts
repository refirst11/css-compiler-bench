import type { NextConfig } from "next";
import path from "node:path";
import { withWyw } from "@wyw-in-js/nextjs";

// withWyw wires `@wyw-in-js/turbopack-loader` through `turbopack.rules`, so
// `next build` stays on Turbopack like every other lane.
const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default withWyw(nextConfig);
