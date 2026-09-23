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
    } else if (kind === "vanilla-extract") {
      definitions.push(
        `const Scale${i} = () => <div className={styles.item${i}}>Scale fixture</div>;`,
      );
    } else if (kind === "panda") {
      definitions.push(
        `const style${i} = css({ display: "inline-block", padding: "1px" });\nconst Scale${i} = () => <div className={style${i}}>Scale fixture</div>;`,
      );
    } else if (kind === "styled-components") {
      definitions.push(`const Scale${i} = styled.div\`display: inline-block; padding: 1px;\`;`);
    } else if (kind === "next-yak") {
      definitions.push(`const Scale${i} = styled.div\`display: inline-block; padding: 1px;\`;`);
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
    "vanilla-extract": 'import * as styles from "./Scale.css";',
    panda: 'import { css } from "../../styled-system/css";',
    plumeria: 'import * as css from "@plumeria/core";',
    stylex: 'import * as stylex from "@stylexjs/stylex";',
    devup: 'import { Box } from "@devup-ui/react";',
    "next-yak": 'import { styled } from "next-yak";',
    "styled-components": 'import styled from "styled-components";',
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

// vanilla-extract evaluates its styles in a separate `.css.ts` module, so the
// sweep has to write two files for this lane the way it already does for CSS
// Modules -- the definitions cannot live in the component file.
function scaleVanillaExtract(count) {
  const definitions = Array.from(
    { length: count },
    (_, i) => `export const item${i} = style({ display: "inline-block", padding: "1px" });`,
  ).join("\n");
  return `import { style } from "@vanilla-extract/css";\n\n${definitions}\n`;
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
  if (lane.scaleKind === "vanilla-extract") {
    files.push({
      path: path.join(lane.dir, "src/component/Scale.css.ts"),
      generate: scaleVanillaExtract,
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

type ScaleRow = { count: number; project: string; label: string; buildSeconds: number };

function slopesFrom(rows: ScaleRow[], counts: number[]) {
  const ordered = [...counts].sort((a, b) => a - b);
  const projects = [...new Map(rows.map((row) => [row.project, row.label])).entries()];
  const controlName = laneList.find((lane) => lane.baseline)?.name;

  const perDefinition = (project: string) => {
    const points = ordered
      .map((count) => rows.find((row) => row.project === project && row.count === count))
      .filter(Boolean);
    if (points.length < 2) return null;

    const first = points[0];
    const last = points[points.length - 1];
    const segments = points.slice(1).map((point, index) => ({
      from: points[index].count,
      to: point.count,
      msPerDefinition:
        ((point.buildSeconds - points[index].buildSeconds) * 1000) /
        (point.count - points[index].count),
    }));
    return {
      msPerDefinition:
        ((last.buildSeconds - first.buildSeconds) * 1000) / (last.count - first.count),
      segments,
    };
  };

  const control = controlName ? perDefinition(controlName) : null;

  // The sweep takes one build per point, so there is no interval to test a
  // per-definition cost against. The control's own segments disagree by some
  // amount purely from run-to-run wobble, and that disagreement is the only
  // noise estimate this measurement contains. It is reported as a number rather
  // than resolved into a verdict here: the threshold belongs to whoever is
  // reading, and moving it must not mean measuring again.
  const controlSpread = control
    ? Math.max(...control.segments.map((segment) => segment.msPerDefinition)) -
      Math.min(...control.segments.map((segment) => segment.msPerDefinition))
    : null;

  return projects.flatMap(([project, label]) => {
    const slope = perDefinition(project);
    if (!slope) return [];
    const overControl =
      control && project !== controlName ? slope.msPerDefinition - control.msPerDefinition : null;
    return [
      {
        project,
        label,
        msPerDefinition: slope.msPerDefinition,
        msPerDefinitionOverControl: overControl,
        controlSpreadMsPerDefinition: controlSpread,
        segments: slope.segments,
      },
    ];
  });
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

  const slopes = slopesFrom(rows, counts);

  console.log("\n📈 Distinct styled component scale");
  console.table(rows);
  console.table(
    Object.fromEntries(
      slopes.map((slope) => [
        slope.label,
        {
          "ms / definition": slope.msPerDefinition.toFixed(3),
          "over control": slope.msPerDefinitionOverControl?.toFixed(3) ?? "control",
        },
      ]),
    ),
  );
  console.log(
    "One build per lane per count, so these slopes carry no interval. Compare a cost over the " +
      "control against the control's own segment spread, which is the only noise this " +
      "measurement contains.",
  );

  updateResults({
    scale: {
      status: failures.size ? "partial" : "complete",
      counts,
      measurements: rows,
      slopes,
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
