import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { performance } from "perf_hooks";
import { updateResults } from "./results.ts";
import { numberFromEnv, selectedLanes, type Lane } from "./lanes.ts";

// This fixture changes the number of distinct styling definitions, not the
// number of rendered instances in the main benchmark. The generated source is
// restored in finally so running this command never leaves the worktree dirty.
const laneList = selectedLanes();
const defaultCounts = [10, 100, 1000];
const BUILD_TIMEOUT_MS = numberFromEnv("BENCHMARK_BUILD_TIMEOUT_MS", 10 * 60 * 1000);

function countsFromArgs() {
  const option = process.argv.find((arg) => arg.startsWith("--counts="));
  const raw = option ? option.slice("--counts=".length) : process.env.BENCHMARK_SCALE_COUNTS;
  const values = raw ? raw.split(",") : defaultCounts;
  const counts = values.map(Number).filter((count) => Number.isInteger(count) && count > 0);
  if (!counts.length) throw new Error("--counts must contain positive integers");
  return counts;
}

function scaleSource(kind, count) {
  const definitions = [];

  for (let i = 0; i < count; i++) {
    if (kind === "css-modules") {
      definitions.push(
        `const Scale${i} = () => <div className={styles.item${i}}>Scale fixture</div>;`,
      );
    } else if (kind === "plumeria") {
      definitions.push(
        `const style${i} = css.create({ item: { display: "inline-block", padding: "1px" } });\nconst Scale${i} = () => <div classStyle={style${i}.item}>Scale fixture</div>;`,
      );
    } else if (kind === "stylex") {
      definitions.push(
        `const style${i} = stylex.create({ item: { display: "inline-block", padding: "1px" } });\nconst Scale${i} = () => <div {...stylex.props(style${i}.item)}>Scale fixture</div>;`,
      );
    } else if (kind === "devup") {
      definitions.push(
        `const Scale${i} = () => <Box display="inline-block" padding="1px">Scale fixture</Box>;`,
      );
    } else if (kind === "next-yak") {
      definitions.push(
        `const Scale${i} = styled.div\`display: inline-block; padding: 1px;\`;`,
      );
    } else if (kind === "cn") {
      definitions.push(
        `const Scale${i} = () => <div className={cn("inline-block p-px")}>Scale fixture</div>;`,
      );
    } else {
      definitions.push(
        `const Scale${i} = () => <div className="inline-block p-px">Scale fixture</div>;`,
      );
    }
  }

  const imports = {
    "css-modules": 'import styles from "./Scale.module.css";',
    plumeria: 'import * as css from "@plumeria/core";',
    stylex: 'import * as stylex from "@stylexjs/stylex";',
    devup: 'import { Box } from "@devup-ui/react";',
    "next-yak": 'import { styled } from "next-yak";',
    cn: 'import { cn } from "cn";',
    tailwind: "",
  };

  if (!(kind in imports)) {
    throw new Error(
      `Unknown scaleKind "${kind}". Add a generator branch here, or set a known scaleKind in the lane's package.json.`,
    );
  }

  const componentNames = Array.from({ length: count }, (_, i) => `Scale${i}`).join(", ");
  return `${imports[kind]}\n\n${definitions.join("\n\n")}\n\nconst components = [${componentNames}];\n\nexport default function ScaleFixture() {\n  return (\n    <>\n      {components.map((Component, i) => (\n        <Component key={i} />\n      ))}\n    </>\n  );\n}\n`;
}

function scaleCss(count) {
  return Array.from(
    { length: count },
    (_, i) => `.item${i} { display: inline-block; padding: 1px; }`,
  ).join("\n");
}

function fixtureFiles(lane: Lane) {
  const files = [
    {
      path: path.join(lane.dir, "src/component/ScaleFixture.tsx"),
      generate: (count) => scaleSource(lane.scaleKind, count),
    },
  ];
  if (lane.scaleKind === "css-modules") {
    files.push({
      path: path.join(lane.dir, "src/component/Scale.module.css"),
      generate: scaleCss,
    });
  }
  return files;
}

function fileSnapshot(files) {
  return new Map(
    files.map(({ path: filePath }) => [
      filePath,
      fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null,
    ]),
  );
}

function restore(snapshot) {
  for (const [filePath, source] of snapshot) {
    if (source === null) {
      if (fs.existsSync(filePath)) fs.rmSync(filePath);
    } else {
      fs.writeFileSync(filePath, source);
    }
  }
}

function run() {
  const counts = countsFromArgs();
  const allFiles = laneList.flatMap(fixtureFiles);
  const snapshot = fileSnapshot(allFiles);
  const failures = new Map<string, string>();
  const rows = [];

  try {
    for (const count of counts) {
      for (const lane of laneList) {
        // A lane that already failed at a smaller count is not retried: the
        // sweep is monotonic, and one broken lane must not cost the run the
        // measurements the others can still produce.
        if (failures.has(lane.name)) continue;

        for (const file of fixtureFiles(lane)) {
          fs.writeFileSync(file.path, file.generate(count));
        }

        const env = { ...process.env, BENCHMARK_SCALE_COUNT: String(count) };
        try {
          execSync("npm run prebuild", {
            cwd: lane.dir,
            env,
            stdio: "ignore",
            timeout: BUILD_TIMEOUT_MS,
          });
          const start = performance.now();
          execSync("npm run build", {
            cwd: lane.dir,
            env,
            stdio: "ignore",
            timeout: BUILD_TIMEOUT_MS,
          });
          const seconds = (performance.now() - start) / 1000;
          rows.push({ count, project: lane.name, label: lane.label, buildSeconds: seconds });
          console.log(`${count}\t${lane.name}\t${seconds.toFixed(3)}s`);
        } catch (error) {
          const reason = error instanceof Error ? error.message.split("\n")[0] : String(error);
          failures.set(lane.name, `at count ${count}: ${reason}`);
          console.log(`${count}\t${lane.name}\tfailed — ${reason}`);
        }
      }
    }
  } finally {
    restore(snapshot);
  }

  console.log("\n📈 Distinct styled component scale");
  console.table(rows);
  updateResults({
    scale: {
      status: failures.size ? "partial" : "complete",
      counts,
      measurements: rows,
      failures: [...failures].map(([project, error]) => ({ project, error })),
    },
  });
  console.log("\n💾 Wrote scoreboard/public/latest.json");

  if (failures.size) {
    console.error(`\n❌ ${failures.size} lane(s) failed the scale sweep:`);
    for (const [project, error] of failures) console.error(`   ${project}: ${error}`);
    process.exitCode = 1;
  }
}

run();
