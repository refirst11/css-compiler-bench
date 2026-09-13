import { withPlumeria } from "@plumeria/next-plugin";
import path from "node:path";

const nextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default withPlumeria(nextConfig);
