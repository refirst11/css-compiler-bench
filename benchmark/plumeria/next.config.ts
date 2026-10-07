import { withPlumeria } from "@plumeria/next-plugin";
import path from "node:path";

const nextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

// The `plumeria-lint-off` lane builds this folder with PLUMERIA_LINT=off.
export default withPlumeria(nextConfig, { lint: process.env.PLUMERIA_LINT !== "off" });
