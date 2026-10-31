import path from "node:path";
import { zyzz } from "zyzz/next";

export default zyzz({
  outputFileTracingRoot: path.join(__dirname, "../../"),
});
