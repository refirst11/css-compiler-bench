const path = require("path");

module.exports = {
  plugins: {
    "@stylexswc/postcss-plugin": {
      include: ["src/component/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],
      rsOptions: {
        aliases: {
          "@/*": [path.join(__dirname, "*")],
        },
        unstable_moduleResolution: {
          type: "commonJS",
        },
        dev: process.env.NODE_ENV === "development",
      },
    },
    autoprefixer: {},
  },
};
