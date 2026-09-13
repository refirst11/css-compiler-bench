import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative asset URLs, so the same build works at a user page, at a project
  // page under /<repo>/, and from a local file.
  base: "./",
});
