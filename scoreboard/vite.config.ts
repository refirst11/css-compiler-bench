import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import type { BenchmarkData } from "./src/types.ts";

const scoreboardDir = path.dirname(fileURLToPath(import.meta.url));
const SITE_URL = process.env.SITE_URL ?? "https://refirst11.github.io/css-compiler-bench/";

function readResult(): BenchmarkData | null {
  const resultPath = path.join(scoreboardDir, "public", "latest.json");
  if (!fs.existsSync(resultPath)) return null;

  try {
    return JSON.parse(fs.readFileSync(resultPath, "utf8"));
  } catch {
    return null;
  }
}

// The unfurled card describes the run it was built from, so a shared link
// carries the current numbers instead of a sentence written once and forgotten.
function describe(data: BenchmarkData | null) {
  const fallback = "Build-time cost of compile-time CSS for React, on one identical Next.js app.";
  const build = data?.build;
  if (!build?.measurements?.length) return fallback;

  const costs = build.measurements
    .map((item) => item.libraryCostMs)
    .filter((cost): cost is number => cost !== null)
    .map((cost) => cost / 1000);
  if (!costs.length) return fallback;

  const measured = new Date(data!.generatedAt).toISOString().slice(0, 10);
  return (
    `${build.measurements.length} styling setups, one identical Next.js app, ` +
    `${build.iterations} cold builds each. Library cost over the CSS Modules control ` +
    `runs from +${Math.min(...costs).toFixed(2)}s to +${Math.max(...costs).toFixed(2)}s. ` +
    `Measured ${measured}.`
  );
}

function shareCard(): Plugin {
  return {
    name: "share-card",
    transformIndexHtml() {
      const data = readResult();
      const description = describe(data);
      // The card is regenerated per deploy; the version keeps crawlers that
      // cache aggressively from serving an older run's picture.
      const version = data?.environment?.runId ?? data?.generatedAt ?? "1";
      const hasCard = fs.existsSync(path.join(scoreboardDir, "public", "og.png"));
      const title = "CSS compiler benchmark";

      const tags = [
        { tag: "meta", attrs: { name: "description", content: description } },
        { tag: "meta", attrs: { property: "og:type", content: "website" } },
        { tag: "meta", attrs: { property: "og:site_name", content: title } },
        { tag: "meta", attrs: { property: "og:title", content: title } },
        { tag: "meta", attrs: { property: "og:description", content: description } },
        { tag: "meta", attrs: { property: "og:url", content: SITE_URL } },
        {
          tag: "meta",
          attrs: { name: "twitter:card", content: hasCard ? "summary_large_image" : "summary" },
        },
        { tag: "meta", attrs: { name: "twitter:title", content: title } },
        { tag: "meta", attrs: { name: "twitter:description", content: description } },
      ];

      if (hasCard) {
        const image = `${SITE_URL.replace(/\/$/, "")}/og.png?v=${encodeURIComponent(String(version))}`;
        tags.push(
          { tag: "meta", attrs: { property: "og:image", content: image } },
          { tag: "meta", attrs: { property: "og:image:width", content: "1200" } },
          { tag: "meta", attrs: { property: "og:image:height", content: "630" } },
          {
            tag: "meta",
            attrs: {
              property: "og:image:alt",
              content:
                "Average cold build time per styling setup, drawn as bars against the CSS Modules control.",
            },
          },
          { tag: "meta", attrs: { name: "twitter:image", content: image } },
        );
      }
      return tags.map((tag) => ({ ...tag, injectTo: "head" as const }));
    },
  };
}

// `pnpm dev` serves the result CI last published to Pages in place of whatever
// scoreboard/public holds, so the page is worked on against a full run without
// measuring locally. Fetched per request, never written to disk, so a local
// measurement is never overwritten; `pnpm dev:local` shows that one instead.
function ciResult(): Plugin {
  return {
    name: "ci-result",
    apply: "serve",
    configureServer(server) {
      if (server.config.mode === "local") return;
      const source = new URL("latest.json", SITE_URL).href;
      server.config.logger.info(`  latest.json is served from ${source}`);

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.split("?")[0].endsWith("/latest.json")) return next();
        try {
          const response = await fetch(source, { cache: "no-store" });
          if (!response.ok) throw new Error(`${source} responded ${response.status}`);
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.end(await response.text());
        } catch (error) {
          server.config.logger.error(`  could not fetch ${source}: ${String(error)}`);
          next(error);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), shareCard(), ciResult()],
  // Relative asset URLs, so the same build works at a user page, at a project
  // page under /<repo>/, and from a local file.
  base: "./",
});
