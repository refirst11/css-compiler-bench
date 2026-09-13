import path from "node:path";
import { DevupUI } from "@devup-ui/next-plugin";

export default DevupUI(
  {
    outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
  },
  { singleCss: true },
);
