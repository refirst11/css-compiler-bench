import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { selectedLanes, numberFromEnv, type Lane } from "./lanes.ts";
import { updateResults } from "./results.ts";

const LITERAL = "0.123px";
const BOUND = "0.456px";
const COMPUTED = "0.789px";
const BUILD_TIMEOUT_MS = numberFromEnv("BENCHMARK_BUILD_TIMEOUT_MS", 10 * 60 * 1000);

const laneList = selectedLanes();

const cases = ["literal", "bound", "computed"] as const;
type ProbeCase = (typeof cases)[number];

function probeFiles(lane: Lane, probeCase: ProbeCase = "literal") {
  const kind = lane.scaleKind;
  if (kind === "css-modules") return null;
  const sentinel = { literal: LITERAL, bound: BOUND, computed: COMPUTED }[probeCase];
  const tailwind = kind === "tailwind" || kind === "cn";
  const value = tailwind ? `tracking-[${sentinel}]` : sentinel;
  const binding =
    probeCase === "literal"
      ? ""
      : probeCase === "bound"
        ? `const VALUE = ${JSON.stringify(value)};`
        : `const VALUE = [${JSON.stringify(tailwind ? "tracking-[0.7" : "0.7")}, ${JSON.stringify(tailwind ? "89px]" : "89px")}].join("");`;
  const expression = probeCase === "literal" ? JSON.stringify(value) : "VALUE";
  let imports = "";
  let declaration = "";
  let element: string;
  const files: { path: string; source: string }[] = [];

  if (kind === "plumeria" || kind === "stylex") {
    imports =
      kind === "plumeria"
        ? 'import * as css from "@plumeria/core";'
        : 'import * as css from "@stylexjs/stylex";';
    declaration = `const styles = css.create({ probe: { letterSpacing: ${expression} } });`;
    element =
      kind === "plumeria"
        ? "<div classStyle={styles.probe}>probe</div>"
        : "<div {...css.props(styles.probe)}>probe</div>";
  } else if (kind === "panda") {
    imports = 'import { css } from "../../styled-system/css";';
    element = `<div className={css({ letterSpacing: ${expression} })}>probe</div>`;
  } else if (kind === "devup") {
    imports = 'import { Box } from "@devup-ui/react";';
    element = `<Box letterSpacing={${expression}}>probe</Box>`;
  } else if (kind === "next-yak" || kind === "styled-components") {
    imports =
      kind === "next-yak"
        ? 'import { styled } from "next-yak";'
        : 'import styled from "styled-components";';
    const interpolation = probeCase === "literal" ? sentinel : "${VALUE}";
    declaration = "const Probe = styled.div`letter-spacing: " + interpolation + ";`;";
    element = "<Probe>probe</Probe>";
  } else if (kind === "vanilla-extract") {
    imports = 'import { probe } from "./Scale.css";';
    element = "<div className={probe}>probe</div>";
    files.push({
      path: path.join(lane.dir, "src/component/Scale.css.ts"),
      source: `import { style } from "@vanilla-extract/css";\n${binding}\nexport const probe = style({ letterSpacing: ${expression} });\n`,
    });
  } else if (tailwind) {
    imports = kind === "cn" ? 'import { cn } from "cn";' : "";
    element = `<div className={${kind === "cn" ? `cn(${expression})` : expression}}>probe</div>`;
  } else {
    throw new Error(`Unknown scaleKind "${kind}". Add a binding probe branch here.`);
  }

  files.push({
    path: path.join(lane.dir, "src/component/ScaleFixture.tsx"),
    source: `${imports}\n${kind === "vanilla-extract" ? "" : binding}\n${declaration}\nexport default function BindingProbe() { return (${element}); }\n`,
  });
  return files;
}

function walk(dir: string, match: (name: string) => boolean, skip?: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === skip) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, match, skip));
    else if (match(entry.name)) out.push(full);
  }
  return out;
}

function read(files: string[]): string {
  return files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
}

const mark = (value: string) => value.replace(/^0\./, "");

function classify(css: string, js: string) {
  const literalInCss = css.includes(mark(LITERAL));
  const boundInCss = css.includes(mark(BOUND));
  const computedInCss = css.includes(mark(COMPUTED));
  const computedInJs = js.includes(mark(COMPUTED));

  let outcome: string;
  if (computedInCss) outcome = "sees-through";
  else if (computedInJs) outcome = "escaped-to-runtime";
  else outcome = "dropped";

  return { literalInCss, boundInCss, computedInCss, computedInJs, outcome };
}

function buildFailureReason(error: unknown): string {
  const output = [
    (error as { stdout?: Buffer })?.stdout?.toString() ?? "",
    (error as { stderr?: Buffer })?.stderr?.toString() ?? "",
  ]
    .join("\n")
    .split("\n")
    .map((line) => line.replace(/\u001b\[[0-9;]*m/g, "").trimEnd())
    .filter((line) => line.trim().length > 0);

  const marker = output.findIndex((line) => /error/i.test(line));
  const excerpt = (marker >= 0 ? output.slice(marker, marker + 8) : output.slice(-8)).join(" · ");
  if (excerpt) return excerpt.slice(0, 600);
  return error instanceof Error ? error.message.split("\n")[0] : String(error);
}

function run() {
  const snapshot = new Map<string, string | null>();
  const rows = [];
  const failures = new Map<string, string>();

  for (const lane of laneList) {
    for (const file of probeFiles(lane) ?? []) {
      snapshot.set(file.path, fs.existsSync(file.path) ? fs.readFileSync(file.path, "utf8") : null);
    }
  }

  try {
    for (const lane of laneList) {
      const files = probeFiles(lane);
      if (files === null) {
        rows.push({
          project: lane.name,
          label: lane.label,
          mechanism: lane.mechanism,
          outcome: "not-applicable",
          literalInCss: null,
          boundInCss: null,
          computedInCss: null,
          computedInJs: null,
        });
        console.log(`${lane.name}\tnot-applicable`);
        continue;
      }

      const row = {
        project: lane.name,
        label: lane.label,
        mechanism: lane.mechanism,
        outcome: "build-failed",
        literalInCss: null as boolean | null,
        boundInCss: null as boolean | null,
        computedInCss: null as boolean | null,
        computedInJs: null as boolean | null,
      };
      // Each form gets its own build: rejecting one must not erase the others.
      for (const probeCase of cases) {
        for (const file of probeFiles(lane, probeCase)!) fs.writeFileSync(file.path, file.source);
        const env = { ...process.env, BENCHMARK_SCALE_COUNT: "1" };
        const nextPath = path.join(lane.dir, ".next");
        try {
          execSync("npm run build", {
            cwd: lane.dir,
            env,
            stdio: "pipe",
            timeout: BUILD_TIMEOUT_MS,
          });
        } catch (error) {
          const reason = buildFailureReason(error);
          failures.set(`${lane.name}/${probeCase}`, reason);
          console.log(`${lane.name}/${probeCase}\tbuild-failed — ${reason}`);
          continue;
        }
        const css = read(walk(nextPath, (name) => name.endsWith(".css"), "cache"));
        const js = read(walk(nextPath, (name) => name.endsWith(".js"), "cache"));
        const verdict = classify(css, js);
        const field = `${probeCase}InCss` as const;
        row[field] = verdict[field];
        if (probeCase === "computed") {
          row.computedInJs = verdict.computedInJs;
          row.outcome = verdict.outcome;
        }
        console.log(`${lane.name}/${probeCase}\tCSS: ${row[field]}`);
      }
      rows.push(row);
    }
  } finally {
    for (const [file, source] of snapshot) {
      if (source === null) {
        if (fs.existsSync(file)) fs.rmSync(file);
      } else {
        fs.writeFileSync(file, source);
      }
    }
  }

  console.log("\n🔗 Binding escape\n");
  console.table(
    Object.fromEntries(
      rows.map((row) => [
        row.label,
        {
          mechanism: row.mechanism,
          literal: row.literalInCss,
          bound: row.boundInCss,
          computed: row.computedInCss,
          outcome: row.outcome,
        },
      ]),
    ),
  );
  console.log(
    `literal is written at the call site, bound goes through a module-scope const, and computed ` +
      `requires evaluating an expression. Each form is built separately; null means that form failed to build. ` +
      `Resolving an expression does not establish whether the compiler executes the module. ` +
      `Sentinels: ${LITERAL} / ${BOUND} / ${COMPUTED}.`,
  );

  updateResults({
    binding: {
      status: failures.size ? "partial" : "complete",
      literalSentinel: LITERAL,
      boundSentinel: BOUND,
      computedSentinel: COMPUTED,
      measurements: rows,
      failures: [...failures].map(([project, error]) => ({ project, error })),
    },
  });
  console.log("\n💾 Wrote scoreboard/public/latest.json");
}

run();
