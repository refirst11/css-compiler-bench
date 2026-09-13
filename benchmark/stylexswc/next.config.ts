import path from "node:path";
import withStylexTurbopack from "@stylexswc/nextjs-plugin/turbopack";

export default withStylexTurbopack({
  rsOptions: {
    dev: process.env.NODE_ENV !== "production",
    aliases: {
      "@/*": [path.join(import.meta.dirname, "*")],
    },
    unstable_moduleResolution: {
      type: "commonJS",
    },
  },
})({
  outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
});
