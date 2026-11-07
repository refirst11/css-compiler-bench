import path from "node:path";
import { withTypedCSS } from "@typedcss/next-plugin";

export default withTypedCSS(
  {
    outputFileTracingRoot: path.join(__dirname, "../../"),
  },
  { root: __dirname, lint: false },
);
