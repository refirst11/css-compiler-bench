import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const scoreboardDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scoreboardDir, "..");

export default defineConfig({
  plugins: [react()],
  publicDir: path.join(repositoryRoot, "results"),
});
