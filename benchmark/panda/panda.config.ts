import { defineConfig } from "@pandacss/dev";

// Left on the defaults, including the token preset. That preset is most of the
// stylesheet -- 11.7KB of design tokens against 400B of utilities the fixture
// actually uses -- but the Tailwind lane ships its own default theme unstripped
// for the same reason, and ejecting it here would give Panda a treatment no
// other lane gets.
export default defineConfig({
  preflight: true,
  include: ["./src/**/*.{js,jsx,ts,tsx}"],
  exclude: [],
  theme: { extend: {} },
  outdir: "styled-system",
});
