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

// The first iteration is excluded from every average, as documented in the
// README. Not for V8 startup -- every `next build` is its own process, so each
// round pays that -- but for the machine-level costs a first run carries alone:
// the OS page cache still cold on `node_modules` and the toolchain binaries, the
// CPU not yet at its sustained clock, a first touch of each file on disk.
const WARMUP_ITERATIONS = numberFromEnv("BENCHMARK_WARMUP_ITERATIONS", 1);

// One measured round per lane, so that the rotation below hands every lane
// every position exactly once. The default follows the lane count rather than a
// constant: adding a lane is a folder here, and the balance would quietly stop
// holding if the round count had to be remembered separately.
const ITERATIONS = numberFromEnv("BENCHMARK_ITERATIONS", laneList.length + WARMUP_ITERATIONS);

// A hung build must not consume the whole CI job; it is recorded as a lane
// failure like any other and the remaining lanes still produce numbers.
const BUILD_TIMEOUT_MS = numberFromEnv("BENCHMARK_BUILD_TIMEOUT_MS", 10 * 60 * 1000);

if (ITERATIONS <= WARMUP_ITERATIONS) {
  throw new Error(
    `BENCHMARK_ITERATIONS (${ITERATIONS}) must exceed BENCHMARK_WARMUP_ITERATIONS (${WARMUP_ITERATIONS}); ` +
      "otherwise no measured round remains.",
  );
}

// Position in a round is not neutral: a lane that runs first meets a colder
// page cache than one that runs eleventh, and one that follows a heavy lane
// meets a hotter CPU. Rotating the list by the round number is a Latin square
// -- over a full cycle every lane occupies every position exactly once -- so
// that bias cancels by construction rather than on average. A random shuffle
// only balances in expectation, and at ten-odd rounds it visibly does not:
// under the seed this replaces, one Tailwind lane averaged position 0.50 of
// the field and the other 0.67.
function rotated<T>(values: T[], round: number): T[] {
  if (values.length === 0) return [];
  const offset = ((round % values.length) + values.length) % values.length;
  return [...values.slice(offset), ...values.slice(0, offset)];
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

// Sample standard deviation, reported so the reader can judge whether a
// build-time difference is actually above the noise floor.
function stdDev(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((total, x) => total + (x - m) ** 2, 0) / (xs.length - 1));
}

// Sums real file sizes rather than shelling out to `du`, which rounds every
// file up to a disk block and would overstate a tree of many small files.
// `skipDirs` drops whole subtrees before they are walked.
function dirSize(dirPath, matches = (_name: string) => true, skipDirs = new Set<string>()) {
  if (!fs.existsSync(dirPath)) return 0;

  let size = 0;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      size += dirSize(entryPath, matches, skipDirs);
    } else if (entry.isFile() && matches(entry.name)) {
      size += fs.statSync(entryPath).size;
    }
  }
  return size;
}

// `.next/cache` is Turbopack's persistent cache. It is reported, but on its own
// column rather than inside `.next`, because it is a real measurement of a
// different thing: `prebuild` deletes the whole of `.next`, so a lane's cache is
// written entirely by the build being timed, and it is reproducible to +/-0.01MB
// across cold builds while spanning 26.25-32.77MB across lanes. What it is not is
// a proxy for output size -- the two correlate at r=0.38 -- so summing them gives
// a number that answers neither question, and at 81-87% of that sum the cache
// decides the ranking. Separate columns keep both readable.
const BUILD_CACHE = new Set(["cache"]);

function buildOnce(lane: Lane, env) {
  // Clean builds are intentionally retained. The round-robin order keeps this
  // cold-build comparison from favoring whichever lane runs first.
  //
  // npm runs a script's `pre` lifecycle itself, so the timed section below is
  // `prebuild` *and* `build` -- the whole of what a user typing `npm run build`
  // in this lane waits for, which is the cost the README's "library cost" column
  // claims to report. A lane whose build needs a generation step ahead of
  // `next build` (`panda codegen`) is timed with it, because adopting it means
  // paying it. What the explicit call here does is run that same step once more
  // ahead of the clock, so the timed window always starts from an identical
  // deleted-`.next` state and never contains the removal of the previous
  // round's build output, whose cost would scale with that lane's output size
  // rather than with its compiler.
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
    laneList.map((lane) => [lane.name, { times: [], buildSize: 0, cssSize: 0, cacheSize: 0 }]),
  );
  // A lane that cannot build is dropped from the remaining rounds and reported,
  // rather than aborting a run the other lanes would have completed.
  const failures = new Map<string, string>();
  const rounds = [];
  const buildEnv = { ...process.env };
  delete buildEnv.BENCHMARK_SCALE_COUNT;

  for (let i = 1; i <= ITERATIONS; i++) {
    const alive = laneList.filter((lane) => !failures.has(lane.name));
    const order = rotated(alive, i);
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
      // position in that round's rotation.
      if (i === ITERATIONS) {
        const nextPath = path.join(lane.dir, ".next");
        measurements[lane.name].buildSize = dirSize(nextPath, undefined, BUILD_CACHE);
        measurements[lane.name].cssSize = dirSize(
          nextPath,
          (name) => name.endsWith(".css"),
          BUILD_CACHE,
        );
        measurements[lane.name].cacheSize = dirSize(path.join(nextPath, "cache"));
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
    const { times, buildSize, cssSize, cacheSize } = measurements[lane.name];

    results[lane.name] = {
      "Avg Build (s)": mean(times).toFixed(3),
      "Min (s)": Math.min(...times).toFixed(3),
      "Max (s)": Math.max(...times).toFixed(3),
      "SD (ms)": (stdDev(times) * 1000).toFixed(1),
      "Library Cost (ms)": lane.baseline ? "—" : ((mean(times) - baselineMean) * 1000).toFixed(1),
      ".next (MB)": (buildSize / 1024 / 1024).toFixed(2),
      "CSS (KB)": (cssSize / 1024).toFixed(2),
      "Cache (MB)": (cacheSize / 1024 / 1024).toFixed(2),
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
      cacheBytes: cacheSize,
      samples: times,
    });
  }

  console.log(
    `\n📊 Final Benchmark Results (Cold Build, first ${WARMUP_ITERATIONS} iteration excluded):`,
  );
  console.table(results);
  console.log(
    `Library Cost = this lane's average build time minus ${baseline.name}'s (${baselineMean.toFixed(3)}s). ` +
      `Lane order rotates one place per round, so each lane held each position once.`,
  );

  updateResults({
    build: {
      status: failures.size ? "partial" : "complete",
      iterations: ITERATIONS,
      warmupIterations: WARMUP_ITERATIONS,
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
