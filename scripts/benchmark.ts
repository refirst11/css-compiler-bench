import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { performance } from "perf_hooks";
import { updateResults } from "./results.ts";
import { numberFromEnv, selectedLanes, type Lane } from "./lanes.ts";

// The baseline lane is the control: the same app, the same DOM, the same 1,000
// instances, styled with plain CSS Modules and no CSS-in-JS library. The cost
// of each library is simply how much longer its build takes than the control's.
const laneList = selectedLanes();
const baseline = laneList.find((lane) => lane.baseline)!;

const ITERATIONS = numberFromEnv("BENCHMARK_ITERATIONS", 10);

// The first iteration absorbs V8/compiler cold start overhead and is excluded
// from every average, as documented in the README.
const WARMUP_ITERATIONS = numberFromEnv("BENCHMARK_WARMUP_ITERATIONS", 1);

// A hung build must not consume the whole CI job; it is recorded as a lane
// failure like any other and the remaining lanes still produce numbers.
const BUILD_TIMEOUT_MS = numberFromEnv("BENCHMARK_BUILD_TIMEOUT_MS", 10 * 60 * 1000);

if (ITERATIONS <= WARMUP_ITERATIONS) {
  throw new Error(
    `BENCHMARK_ITERATIONS (${ITERATIONS}) must exceed BENCHMARK_WARMUP_ITERATIONS (${WARMUP_ITERATIONS}); ` +
      "otherwise no measured round remains.",
  );
}

// A deterministic per-round shuffle removes the systematic heat/cache bias
// caused by running the baseline first and every other project afterwards.
// Repeating the same seed makes a result reproducible while still balancing
// the position of each project across rounds.
const BENCHMARK_SEED = Number(process.env.BENCHMARK_SEED ?? 0x5eed1234) >>> 0;

function shuffled(values, seed) {
  const result = [...values];
  let state = seed >>> 0;

  for (let i = result.length - 1; i > 0; i--) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const j = state % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

// Sample standard deviation, reported so the reader can judge whether a
// build-time difference is actually above the noise floor.
function stdDev(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(
    xs.reduce((total, x) => total + (x - m) ** 2, 0) / (xs.length - 1),
  );
}

// Sums real file sizes rather than shelling out to `du`, which rounds every
// file up to a disk block and would overstate a tree of many small files.
function dirSize(dirPath, matches = (_name: string) => true) {
  if (!fs.existsSync(dirPath)) return 0;

  let size = 0;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      size += dirSize(entryPath, matches);
    } else if (entry.isFile() && matches(entry.name)) {
      size += fs.statSync(entryPath).size;
    }
  }
  return size;
}

function buildOnce(lane: Lane, env) {
  // Clean builds are intentionally retained. The round-robin order keeps this
  // cold-build comparison from favoring whichever lane runs first.
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
  return (performance.now() - start) / 1000;
}

function runBenchmark() {
  const measurements = Object.fromEntries(
    laneList.map((lane) => [lane.name, { times: [], buildSize: 0, cssSize: 0 }]),
  );
  // A lane that cannot build is dropped from the remaining rounds and reported,
  // rather than aborting a run the other lanes would have completed.
  const failures = new Map<string, string>();
  const rounds = [];
  const buildEnv = { ...process.env };
  delete buildEnv.BENCHMARK_SCALE_COUNT;

  for (let i = 1; i <= ITERATIONS; i++) {
    const alive = laneList.filter((lane) => !failures.has(lane.name));
    const order = shuffled(alive, BENCHMARK_SEED + i);
    rounds.push(order.map((lane) => lane.name));
    console.log(`\n🚀 Round ${i}/${ITERATIONS}: ${order.map((lane) => lane.name).join(" → ")}`);

    for (const lane of order) {
      process.stdout.write(`  ${lane.name}... `);

      let buildTime;
      try {
        buildTime = buildOnce(lane, buildEnv);
      } catch (error) {
        const reason = error instanceof Error ? error.message.split("\n")[0] : String(error);
        failures.set(lane.name, reason);
        measurements[lane.name].times.length = 0;
        process.stdout.write(`failed — ${reason}\n`);
        if (lane.baseline) {
          throw new Error(
            `The control lane (${lane.name}) failed to build, so no library cost can be derived: ${reason}`,
          );
        }
        continue;
      }

      if (i > WARMUP_ITERATIONS) measurements[lane.name].times.push(buildTime);
      process.stdout.write(`${buildTime.toFixed(2)}s\n`);

      // Measure each lane's output on the final round, regardless of its
      // position in that round's shuffle.
      if (i === ITERATIONS) {
        const nextPath = path.join(lane.dir, ".next");
        measurements[lane.name].buildSize = dirSize(nextPath);
        measurements[lane.name].cssSize = dirSize(nextPath, (name) => name.endsWith(".css"));
      }
    }
  }

  const baselineMean = mean(measurements[baseline.name].times);
  const results = {};
  const measurementRows = [];

  for (const lane of laneList) {
    if (failures.has(lane.name)) {
      results[lane.name] = { "Avg Build (s)": "failed" };
      continue;
    }
    const { times, buildSize, cssSize } = measurements[lane.name];

    results[lane.name] = {
      "Avg Build (s)": mean(times).toFixed(3),
      "Min (s)": Math.min(...times).toFixed(3),
      "Max (s)": Math.max(...times).toFixed(3),
      "SD (ms)": (stdDev(times) * 1000).toFixed(1),
      "Library Cost (ms)": lane.baseline ? "—" : ((mean(times) - baselineMean) * 1000).toFixed(1),
      ".next (MB)": (buildSize / 1024 / 1024).toFixed(2),
      "CSS (KB)": (cssSize / 1024).toFixed(2),
    };
    measurementRows.push({
      project: lane.name,
      label: lane.label,
      baseline: lane.baseline,
      averageBuildSeconds: mean(times),
      minSeconds: Math.min(...times),
      maxSeconds: Math.max(...times),
      standardDeviationMs: stdDev(times) * 1000,
      libraryCostMs: lane.baseline ? null : (mean(times) - baselineMean) * 1000,
      nextBytes: buildSize,
      cssBytes: cssSize,
      samples: times,
    });
  }

  console.log(
    `\n📊 Final Benchmark Results (Cold Build, first ${WARMUP_ITERATIONS} iteration excluded):`,
  );
  console.table(results);
  console.log(
    `Library Cost = this lane's average build time minus ${baseline.name}'s (${baselineMean.toFixed(3)}s). Seed: ${BENCHMARK_SEED}.`,
  );

  updateResults({
    build: {
      status: failures.size ? "partial" : "complete",
      iterations: ITERATIONS,
      warmupIterations: WARMUP_ITERATIONS,
      seed: BENCHMARK_SEED,
      baseline: baseline.name,
      rounds,
      measurements: measurementRows,
      failures: [...failures].map(([project, error]) => ({ project, error })),
    },
  });
  console.log("\n💾 Wrote scoreboard/public/latest.json");

  if (failures.size) {
    console.error(`\n❌ ${failures.size} lane(s) failed to build:`);
    for (const [project, error] of failures) console.error(`   ${project}: ${error}`);
    process.exitCode = 1;
  }
}

runBenchmark();
