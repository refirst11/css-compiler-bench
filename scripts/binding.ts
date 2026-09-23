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

function probeSource(kind: string): string | null {
  if (kind === "css-modules") return null;

  const binds = `const BOUND = "${BOUND}";\nconst COMPUTED = ["${COMPUTED.slice(0, 3)}", "${COMPUTED.slice(3)}"].join("");`;

  if (kind === "plumeria")
    return `import * as css from "@plumeria/core";\n\n${binds}\n\nconst literal = css.create({ a: { letterSpacing: "${LITERAL}" } });\nconst bound = css.create({ b: { letterSpacing: BOUND } });\nconst computed = css.create({ c: { letterSpacing: COMPUTED } });\n\nexport default function BindingProbe() {\n  return (\n    <>\n      <div classStyle={literal.a}>literal</div>\n      <div classStyle={bound.b}>bound</div>\n      <div classStyle={computed.c}>computed</div>\n    </>\n  );\n}\n`;

  if (kind === "stylex")
    return `import * as stylex from "@stylexjs/stylex";\n\n${binds}\n\nconst literal = stylex.create({ a: { letterSpacing: "${LITERAL}" } });\nconst bound = stylex.create({ b: { letterSpacing: BOUND } });\nconst computed = stylex.create({ c: { letterSpacing: COMPUTED } });\n\nexport default function BindingProbe() {\n  return (\n    <>\n      <div {...stylex.props(literal.a)}>literal</div>\n      <div {...stylex.props(bound.b)}>bound</div>\n      <div {...stylex.props(computed.c)}>computed</div>\n    </>\n  );\n}\n`;

  if (kind === "panda")
    return `import { css } from "../../styled-system/css";\n\n${binds}\n\nexport default function BindingProbe() {\n  return (\n    <>\n      <div className={css({ letterSpacing: "${LITERAL}" })}>literal</div>\n      <div className={css({ letterSpacing: BOUND })}>bound</div>\n      <div className={css({ letterSpacing: COMPUTED })}>computed</div>\n    </>\n  );\n}\n`;

  if (kind === "devup")
    return `import { Box } from "@devup-ui/react";\n\n${binds}\n\nexport default function BindingProbe() {\n  return (\n    <>\n      <Box letterSpacing="${LITERAL}">literal</Box>\n      <Box letterSpacing={BOUND}>bound</Box>\n      <Box letterSpacing={COMPUTED}>computed</Box>\n    </>\n  );\n}\n`;

  if (kind === "next-yak" || kind === "styled-components") {
    const imp =
      kind === "next-yak"
        ? 'import { styled } from "next-yak";'
        : 'import styled from "styled-components";';
    return `${imp}\n\n${binds}\n\nconst Literal = styled.div\`letter-spacing: ${LITERAL};\`;\nconst Bound = styled.div\`letter-spacing: \${BOUND};\`;\nconst Computed = styled.div\`letter-spacing: \${COMPUTED};\`;\n\nexport default function BindingProbe() {\n  return (\n    <>\n      <Literal>literal</Literal>\n      <Bound>bound</Bound>\n      <Computed>computed</Computed>\n    </>\n  );\n}\n`;
  }

  if (kind === "vanilla-extract")
    return `import * as styles from "./Scale.css";\n\nexport default function BindingProbe() {\n  return (\n    <>\n      <div className={styles.literal}>literal</div>\n      <div className={styles.bound}>bound</div>\n      <div className={styles.computed}>computed</div>\n    </>\n  );\n}\n`;

  if (kind === "cn")
    return `import { cn } from "cn";\n\nconst BOUND = "tracking-[${BOUND}]";\nconst COMPUTED = ["tracking-[${COMPUTED.slice(0, 3)}", "${COMPUTED.slice(3)}]"].join("");\n\nexport default function BindingProbe() {\n  return (\n    <>\n      <div className={cn("tracking-[${LITERAL}]")}>literal</div>\n      <div className={cn(BOUND)}>bound</div>\n      <div className={cn(COMPUTED)}>computed</div>\n    </>\n  );\n}\n`;

  if (kind === "tailwind")
    return `const BOUND = "tracking-[${BOUND}]";\nconst COMPUTED = ["tracking-[${COMPUTED.slice(0, 3)}", "${COMPUTED.slice(3)}]"].join("");\n\nexport default function BindingProbe() {\n  return (\n    <>\n      <div className="tracking-[${LITERAL}]">literal</div>\n      <div className={BOUND}>bound</div>\n      <div className={COMPUTED}>computed</div>\n    </>\n  );\n}\n`;

  throw new Error(
    `Unknown scaleKind "${kind}". Add a binding probe branch here, or set a known scaleKind in the lane's package.json.`,
  );
}

function probeFiles(lane: Lane) {
  const source = probeSource(lane.scaleKind);
  if (source === null) return null;

  const files = [{ path: path.join(lane.dir, "src/component/ScaleFixture.tsx"), source }];
  if (lane.scaleKind === "vanilla-extract") {
    files.push({
      path: path.join(lane.dir, "src/component/Scale.css.ts"),
      source: `import { style } from "@vanilla-extract/css";\n\nconst BOUND = "${BOUND}";\nconst COMPUTED = ["${COMPUTED.slice(0, 3)}", "${COMPUTED.slice(3)}"].join("");\n\nexport const literal = style({ letterSpacing: "${LITERAL}" });\nexport const bound = style({ letterSpacing: BOUND });\nexport const computed = style({ letterSpacing: COMPUTED });\n`,
    });
  }
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

      for (const file of files) fs.writeFileSync(file.path, file.source);

      const env = { ...process.env, BENCHMARK_SCALE_COUNT: "1" };
      const nextPath = path.join(lane.dir, ".next");
      try {
        execSync("npm run prebuild", { cwd: lane.dir, env, stdio: "ignore", timeout: BUILD_TIMEOUT_MS });
        execSync("npm run build", { cwd: lane.dir, env, stdio: "ignore", timeout: BUILD_TIMEOUT_MS });
      } catch (error) {
        const reason = error instanceof Error ? error.message.split("\n")[0] : String(error);
        failures.set(lane.name, reason);
        rows.push({
          project: lane.name,
          label: lane.label,
          mechanism: lane.mechanism,
          outcome: "build-failed",
          literalInCss: null,
          boundInCss: null,
          computedInCss: null,
          computedInJs: null,
        });
        console.log(`${lane.name}\tbuild-failed — ${reason}`);
        continue;
      }

      const css = read(walk(nextPath, (name) => name.endsWith(".css"), "cache"));
      const js = read(walk(nextPath, (name) => name.endsWith(".js"), "cache"));
      const verdict = classify(css, js);
      rows.push({ project: lane.name, label: lane.label, mechanism: lane.mechanism, ...verdict });
      console.log(`${lane.name}\t${verdict.outcome}`);
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
      `requires evaluating an expression. A lane that compiles bound but not computed is reading the ` +
      `AST and folding constants; one that compiles computed is executing the module. ` +
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
