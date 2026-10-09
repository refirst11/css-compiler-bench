import { withPlumeria } from "@plumeria/next-plugin";
import path from "node:path";

const nextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

// `plumeria-lint-off` is a copy of this folder with the lint guard off.
export default withPlumeria(nextConfig, { lint: true });
