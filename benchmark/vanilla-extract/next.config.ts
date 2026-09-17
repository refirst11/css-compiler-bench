import type { NextConfig } from "next";
import path from "node:path";
import { createVanillaExtractPlugin } from "@vanilla-extract/next-plugin";

// `unstable_turbopack.mode` defaults to "off", which leaves the plugin
// webpack-only and makes Next 16 refuse the build. Turning it on wires the
// Turbopack loader (`turbopack.rules` for `*.css.{js,ts,...}` and for
// `vanilla.virtual.css`) so this lane runs on the same bundler as every other
// lane instead of falling back to `next build --webpack`.
const withVanillaExtract = createVanillaExtractPlugin({
  unstable_turbopack: { mode: "on" },
});

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default withVanillaExtract(nextConfig);
