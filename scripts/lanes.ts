import fs from "fs";
import path from "path";

// There is no lane registry. A lane exists because `benchmark/<name>/` exists
// and its package.json carries a `bench` block; every harness in this folder
// discovers its lanes from the filesystem, so adding one is a folder and never
// an edit to a shared list.
export type Lane = {
  name: string;
  label: string;
  dir: string;
  baseline: boolean;
  // Which fixture generator scripts/scale.ts writes into this lane.
  scaleKind: string;
  mechanism: Mechanism;
};

export type Mechanism =
  | "evaluates-module"
  | "rewrites-ast"
  | "scans-source"
  | "runtime"
  | "names-only";

const MECHANISMS = [
  "evaluates-module",
  "rewrites-ast",
  "scans-source",
  "runtime",
  "names-only",
] as const;

export const repositoryRoot = path.resolve(import.meta.dirname, "..");
export const benchmarkRoot = path.join(repositoryRoot, "benchmark");

function readMechanism(name: string, value: unknown): Mechanism {
  if (!MECHANISMS.includes(value as Mechanism)) {
    throw new Error(
      `benchmark/${name}/package.json needs "bench.mechanism", one of: ${MECHANISMS.join(", ")}.`,
    );
  }
  return value as Mechanism;
}

function readLane(name: string): Lane | null {
  const dir = path.join(benchmarkRoot, name);
  const manifestPath = path.join(dir, "package.json");
  if (!fs.statSync(dir).isDirectory() || !fs.existsSync(manifestPath)) return null;

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const bench = manifest.bench;
  if (!bench) {
    throw new Error(
      `benchmark/${name}/package.json has no "bench" block. Add ` +
        `{ "label", "scaleKind", "mechanism" } (and "baseline": true for the control lane) ` +
        `or move the folder out of benchmark/.`,
    );
  }
  return {
    name,
    label: bench.label ?? name,
    dir,
    baseline: bench.baseline === true,
    scaleKind: bench.scaleKind ?? "tailwind",
    mechanism: readMechanism(name, bench.mechanism),
  };
}

// The control lane first, then alphabetically. Position within a round is
// re-randomized by the benchmark itself, so this order is presentation only.
export function lanes(): Lane[] {
  const found = fs
    .readdirSync(benchmarkRoot)
    .sort()
    .map(readLane)
    .filter((lane): lane is Lane => lane !== null);

  const baselines = found.filter((lane) => lane.baseline);
  if (baselines.length !== 1) {
    throw new Error(
      `Exactly one lane must set "baseline": true; found ${baselines.length} (${
        baselines.map((lane) => lane.name).join(", ") || "none"
      }).`,
    );
  }
  return [baselines[0], ...found.filter((lane) => !lane.baseline)];
}

// `--lanes=plumeria,stylex` (or BENCHMARK_LANES) narrows a run while keeping
// the control lane, which every relative number is measured against.
export function selectedLanes(): Lane[] {
  const option = process.argv.find((arg) => arg.startsWith("--lanes="));
  const raw = option ? option.slice("--lanes=".length) : process.env.BENCHMARK_LANES;
  const all = lanes();
  if (!raw) return all;

  const wanted = new Set(
    raw
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean),
  );
  const unknown = [...wanted].filter((name) => !all.some((lane) => lane.name === name));
  if (unknown.length) {
    throw new Error(
      `Unknown lane(s): ${unknown.join(", ")}. Available: ${all.map((l) => l.name).join(", ")}.`,
    );
  }
  return all.filter((lane) => lane.baseline || wanted.has(lane.name));
}

export function numberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer, received "${raw}".`);
  }
  return value;
}
