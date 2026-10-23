import type { NextConfig } from "next";
import path from "node:path";
import { withYak } from "@yak/react/withYak";

const nextConfig: NextConfig = {
  turbopack: {},
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default withYak(nextConfig);
