import fs from "fs";
import os from "os";
import path from "path";
import { repositoryRoot } from "./lanes.ts";

// The measurement JSON is a build input, not repository content: the harness
// writes it where Vite serves static files from, CI carries it between jobs as
// an artifact, and the deployed site is the copy everyone reads.
const resultsDir = path.join(repositoryRoot, "scoreboard", "public");
export const resultsPath = path.join(resultsDir, "latest.json");

// Everything the scoreboard needs to say where a number came from. A benchmark
// without its machine is not reproducible, and a CI number without its run is
// not checkable, so both travel with the measurement itself.
function environment() {
  const cpus = os.cpus();
  const repository = process.env.GITHUB_REPOSITORY ?? null;
  const runId = process.env.GITHUB_RUN_ID ?? null;

  return {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cpu: cpus[0]?.model ?? null,
    cpuCount: cpus.length,
    memoryGb: Number((os.totalmem() / 1024 ** 3).toFixed(1)),
    ci: process.env.CI === "true",
    runner: process.env.RUNNER_OS ? `${process.env.RUNNER_OS} (${process.env.RUNNER_ARCH})` : null,
    repository,
    ref: process.env.GITHUB_REF_NAME ?? null,
    commit: process.env.GITHUB_SHA ?? null,
    runId,
    runUrl:
      repository && runId
        ? `${process.env.GITHUB_SERVER_URL ?? "https://github.com"}/${repository}/actions/runs/${runId}`
        : null,
  };
}

function readResults() {
  if (!fs.existsSync(resultsPath)) return {};

  try {
    return JSON.parse(fs.readFileSync(resultsPath, "utf8"));
  } catch {
    return {};
  }
}

// Each harness owns one top-level section and merges it into the same file, so
// a full CI run leaves one JSON describing every measurement of that run.
export function updateResults(patch) {
  fs.mkdirSync(resultsDir, { recursive: true });

  const previous = readResults();
  const next = {
    ...previous,
    ...patch,
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    environment: {
      ...previous.environment,
      ...environment(),
    },
  };

  const temporaryPath = `${resultsPath}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(next, null, 2)}\n`);
  fs.renameSync(temporaryPath, resultsPath);
  return next;
}
