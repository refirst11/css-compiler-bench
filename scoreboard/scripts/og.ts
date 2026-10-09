import fs from "fs";
import path from "path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import type { BenchmarkData, BuildMeasurement } from "../src/types.ts";

// The share card carries the numbers, so it is generated from the same JSON the
// page renders -- once per deploy, never by hand. If there is no result to draw
// or the card cannot be produced, the build continues without one rather than
// publishing a stale picture of an older run.
const scoreboardDir = path.resolve(import.meta.dirname, "..");
const resultPath = path.join(scoreboardDir, "public", "latest.json");
const outputPath = path.join(scoreboardDir, "public", "og.png");
const assets = path.join(scoreboardDir, "assets");

const NUMBER_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];
const laneCount = (count: number) => NUMBER_WORDS[count] ?? String(count);

const WIDTH = 1200;
const HEIGHT = 630;
const LABEL_WIDTH = 240;
const BAR_WIDTH = 520;
// What the padding, heading and footer leave for the rows. Satori shrinks flex
// children to fit, so rows that overflow squeeze the heading into them instead
// of being clipped; each row's height is derived from this so they never do.
const ROWS_HEIGHT = 360;

// Every text is one unshrinkable line: a wrapped label or a squeezed heading
// silently breaks the layout instead of failing.
const text = (content: string, style: Record<string, unknown>) => ({
  type: "div",
  props: {
    style: { display: "flex", flexShrink: 0, whiteSpace: "nowrap", ...style },
    children: content,
  },
});

function card(data: BenchmarkData) {
  const measurements: BuildMeasurement[] = [...(data.build?.measurements ?? [])].sort(
    (a, b) => a.averageBuildSeconds - b.averageBuildSeconds,
  );
  const slowest = Math.max(...measurements.map((item) => item.averageBuildSeconds));
  const environment = data.environment ?? {};
  const iterations = data.build?.iterations ?? measurements.length;
  const measured = new Date(data.generatedAt).toISOString().slice(0, 10);
  const runner = environment.ci ? (environment.runner ?? "CI").toLowerCase() : "a local machine";
  const rowHeight = Math.min(40, Math.floor(ROWS_HEIGHT / measurements.length));
  const fontSize = Math.min(25, Math.round(rowHeight * 0.7));

  const rows = measurements.map((item) => ({
    type: "div",
    props: {
      style: { display: "flex", alignItems: "center", height: rowHeight, flexShrink: 0 },
      children: [
        text(item.label, { width: LABEL_WIDTH, color: "#edf2ff", fontSize }),
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              width: BAR_WIDTH,
              height: 14,
              borderRadius: 7,
              background: "#161d33",
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    width: Math.round((item.averageBuildSeconds / slowest) * BAR_WIDTH),
                    height: 14,
                    borderRadius: 7,
                    background: item.baseline
                      ? "#4b5675"
                      : "linear-gradient(90deg, #ffbd69, #fb7185)",
                  },
                },
              },
            ],
          },
        },
        text(`${item.averageBuildSeconds.toFixed(2)}s`, {
          width: 120,
          justifyContent: "flex-end",
          color: "#f8d4a6",
          fontSize,
        }),
        text(
          item.libraryCostMs === null ? "control" : `+${(item.libraryCostMs / 1000).toFixed(2)}s`,
          {
            width: 120,
            justifyContent: "flex-end",
            color: "#7f8ba9",
            fontSize: fontSize - 2,
          },
        ),
      ],
    },
  }));

  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        width: WIDTH,
        height: HEIGHT,
        padding: "44px 60px",
        background: "#080b16",
        backgroundImage: "radial-gradient(circle at 88% -20%, #2b2456 0%, #080b16 55%)",
        fontFamily: "Inter",
      },
      children: [
        text("CSS COMPILER BENCHMARK", {
          color: "#ffbd69",
          fontSize: 19,
          letterSpacing: 3.6,
        }),
        text(`Build cost of ${laneCount(measurements.length)} styling setups`, {
          marginTop: 12,
          color: "#edf2ff",
          fontSize: 40,
        }),
        text("on one identical Next.js app", {
          marginTop: 2,
          color: "#8b97b5",
          fontSize: 28,
        }),
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column", marginTop: 20 },
            children: rows,
          },
        },
        {
          type: "div",
          props: {
            style: { display: "flex", marginTop: "auto", paddingTop: 18 },
            children: [
              text(`${iterations} cold builds per lane · ${runner} · ${measured}`, {
                color: "#5f6b87",
                fontSize: 20,
              }),
            ],
          },
        },
      ],
    },
  };
}

async function run() {
  if (!fs.existsSync(resultPath)) {
    console.log("og: no latest.json, skipping the share card.");
    return;
  }

  const data: BenchmarkData = JSON.parse(fs.readFileSync(resultPath, "utf8"));
  if (!data.build?.measurements?.length) {
    console.log("og: the result carries no build measurements, skipping the share card.");
    return;
  }

  const svg = await satori(card(data) as never, {
    width: WIDTH,
    height: HEIGHT,
    fonts: [
      {
        name: "Inter",
        data: fs.readFileSync(path.join(assets, "Inter-Regular.ttf")),
        weight: 400,
        style: "normal",
      },
    ],
  });

  const png = new Resvg(svg, { fitTo: { mode: "width", value: WIDTH } }).render().asPng();
  fs.writeFileSync(outputPath, png);
  console.log(`og: wrote public/og.png (${(png.length / 1024).toFixed(1)}KB)`);
}

run().catch((error) => {
  // A missing share card is a cosmetic loss; a failed deploy is not.
  console.warn(`og: could not render the share card — ${error.message}`);
});
