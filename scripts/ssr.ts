import { execSync, spawn, type ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import { performance } from "perf_hooks";
import { numberFromEnv, selectedLanes, type Lane } from "./lanes.ts";
import { updateResults } from "./results.ts";

// Server render time of the main page: 1,000 instances whose styles are picked
// at render, so a library that rebuilds its lookup per call pays it here. The
// page is prerendered, so each request carries the on-demand revalidation
// header, which makes `next start` render it again instead of serving the HTML
// written at build time.
const laneList = selectedLanes();
const WARMUP_REQUESTS = numberFromEnv("BENCHMARK_SSR_WARMUP", 50);
const REQUESTS = numberFromEnv("BENCHMARK_SSR_REQUESTS", 200);
// A shared runner drifts between minutes more than it varies within one lane's
// requests, so the lanes are visited in rounds, the order rotated each round,
// and a lane is compared with the control round by round.
const ROUNDS = numberFromEnv("BENCHMARK_SSR_ROUNDS", 5);
const BUILD_TIMEOUT_MS = numberFromEnv("BENCHMARK_BUILD_TIMEOUT_MS", 10 * 60 * 1000);
const READY_TIMEOUT_MS = 30 * 1000;
const skipBuild = process.argv.includes("--no-build");

function quantile(xs: number[], q: number) {
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * q;
  const lo = Math.floor(i);
  return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo);
}

function build(lane: Lane) {
  const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1", ...lane.env };
  execSync("npm run prebuild", { cwd: lane.dir, env, stdio: "ignore", timeout: BUILD_TIMEOUT_MS });
  execSync("npm run build", { cwd: lane.dir, env, stdio: "ignore", timeout: BUILD_TIMEOUT_MS });
}

function previewModeId(lane: Lane): string {
  const manifestPath = path.join(lane.dir, ".next/prerender-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`no build in benchmark/${lane.name} -- build it first or drop --no-build`);
  }
  return JSON.parse(fs.readFileSync(manifestPath, "utf8")).preview.previewModeId;
}

function start(lane: Lane, port: number): ChildProcess {
  return spawn("npm", ["run", "start", "--", "-p", String(port)], {
    cwd: lane.dir,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", NODE_ENV: "production", ...lane.env },
    stdio: "ignore",
    detached: true,
  });
}

function stop(server: ChildProcess) {
  try {
    process.kill(-server.pid!, "SIGTERM");
  } catch {}
}

async function waitReady(url: string) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      await response.arrayBuffer();
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`server did not answer ${url} within ${READY_TIMEOUT_MS / 1000}s`);
}

async function render(url: string, headers: Record<string, string>) {
  const t0 = performance.now();
  const response = await fetch(url, { headers });
  await response.arrayBuffer();
  const elapsed = performance.now() - t0;
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  const cache = response.headers.get("x-nextjs-cache");
  if (cache && cache !== "REVALIDATED") {
    throw new Error(`${url} was served from the cache (${cache}), not rendered`);
  }
  return elapsed;
}

async function measure(lane: Lane, port: number) {
  const headers = { "x-prerender-revalidate": previewModeId(lane) };
  const url = `http://127.0.0.1:${port}/`;
  const server = start(lane, port);
  try {
    await waitReady(url);
    for (let i = 0; i < WARMUP_REQUESTS; i++) await render(url, headers);
    const samples: number[] = [];
    for (let i = 0; i < REQUESTS; i++) samples.push(await render(url, headers));
    return samples;
  } finally {
    stop(server);
  }
}

async function run() {
  const failures = new Map<string, string>();
  const ports = new Map(laneList.map((lane, index) => [lane.name, 3100 + index]));

  if (!skipBuild) {
    for (const lane of laneList) {
      console.log(`🔨 ${lane.label}`);
      try {
        build(lane);
      } catch (error) {
        failures.set(lane.name, error instanceof Error ? error.message.split("\n")[0] : String(error));
      }
    }
  }

  // Per lane, the median of each round's requests.
  const medians = new Map<string, number[]>();
  const samples = new Map<string, number[]>();
  for (let round = 0; round < ROUNDS; round++) {
    const offset = round % laneList.length;
    const order = [...laneList.slice(offset), ...laneList.slice(0, offset)];
    console.log(`\n🔁 round ${round + 1}/${ROUNDS}`);
    for (const lane of order) {
      if (failures.has(lane.name)) continue;
      try {
        const times = await measure(lane, ports.get(lane.name)!);
        medians.set(lane.name, [...(medians.get(lane.name) ?? []), quantile(times, 0.5)]);
        samples.set(lane.name, [...(samples.get(lane.name) ?? []), ...times]);
        console.log(`   ${lane.label}\t${quantile(times, 0.5).toFixed(2)} ms`);
      } catch (error) {
        failures.set(lane.name, error instanceof Error ? error.message : String(error));
      }
    }
  }

  const control = laneList.find((lane) => lane.baseline);
  const controlMedians = control ? medians.get(control.name) : undefined;
  // The control's own round-to-round spread is the drift every lane shares; a
  // difference smaller than it says nothing.
  const noiseFloorMs = controlMedians
    ? Math.max(...controlMedians) - Math.min(...controlMedians)
    : null;

  const measurements = laneList
    .filter((lane) => medians.has(lane.name))
    .map((lane) => {
      const rounds = medians.get(lane.name)!;
      const all = samples.get(lane.name)!;
      let overControl = null;
      if (!lane.baseline && controlMedians?.length === rounds.length) {
        const deltas = rounds.map((m, i) => m - controlMedians[i]);
        const medianDeltaMs = quantile(deltas, 0.5);
        const sameSign = deltas.every((d) => d > 0) || deltas.every((d) => d < 0);
        overControl = {
          medianDeltaMs,
          minDeltaMs: Math.min(...deltas),
          maxDeltaMs: Math.max(...deltas),
          significant: sameSign && Math.abs(medianDeltaMs) > (noiseFloorMs ?? Infinity),
        };
      }
      return {
        project: lane.name,
        label: lane.label,
        baseline: lane.baseline,
        mechanism: lane.mechanism,
        medianMs: quantile(rounds, 0.5),
        p90Ms: quantile(all, 0.9),
        roundMediansMs: rounds,
        overControl,
      };
    });

  console.log(
    `\nSSR render of / ` +
      `(${ROUNDS} rounds × ${REQUESTS} requests after ${WARMUP_REQUESTS} warm-up)`,
  );
  console.table(
    Object.fromEntries(
      measurements.map((m) => [
        m.label,
        {
          "median (ms)": m.medianMs.toFixed(2),
          "p90 (ms)": m.p90Ms.toFixed(2),
          "over control (ms)": m.overControl
            ? `${m.overControl.medianDeltaMs.toFixed(2)}${m.overControl.significant ? "" : " (noise)"}`
            : "control",
        },
      ]),
    ),
  );
  console.log(`Noise floor (control's round-to-round spread): ${noiseFloorMs?.toFixed(2) ?? "—"} ms`);

  updateResults({
    ssr: {
      status: failures.size ? "partial" : "complete",
      rounds: ROUNDS,
      requests: REQUESTS,
      warmupRequests: WARMUP_REQUESTS,
      noiseFloorMs,
      measurements,
      failures: [...failures].map(([project, error]) => ({ project, error })),
    },
  });
  console.log("\n💾 Wrote scoreboard/public/latest.json");

  if (failures.size) {
    console.error(`\n❌ ${failures.size} lane(s) failed the SSR measurement:`);
    for (const [project, error] of failures) console.error(`   ${project}: ${error}`);
    process.exitCode = 1;
  }
}

run();
