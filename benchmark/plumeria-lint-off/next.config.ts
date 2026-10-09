import { withPlumeria } from "@plumeria/next-plugin";
import path from "node:path";

const nextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

// A copy of `plumeria` with the lint guard off. It is its own folder rather
// than an env-switched variant of `plumeria`, so the two lanes never share a
// working tree between builds.
export default withPlumeria(nextConfig, { lint: false });
