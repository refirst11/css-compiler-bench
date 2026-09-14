import { useEffect, useState } from "react";
import type { BenchmarkData, WorkflowRun } from "./types";

// Where the numbers come from, in order of authority:
//
//   1. latest.json, deployed next to this page. CI measures, hands the JSON to
//      the build as an artifact, and the result ships with the site. Always
//      present, never rate limited, works offline and from file://.
//   2. The public Actions API, read live in the browser. It cannot hand out
//      artifacts without a token, but it can say whether a newer run exists and
//      how it went -- so the page can admit that it is showing an older result.
const REPOSITORY = import.meta.env.VITE_GITHUB_REPOSITORY ?? "refirst11/css-compiler-bench";
const WORKFLOW = "benchmark.yml";

export const repositoryUrl = `https://github.com/${REPOSITORY}`;

async function loadResults(): Promise<BenchmarkData> {
  const response = await fetch(`${import.meta.env.BASE_URL}latest.json?t=${Date.now()}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("No benchmark result has been published yet.");
  return (await response.json()) as BenchmarkData;
}

async function loadRuns(): Promise<WorkflowRun[]> {
  const response = await fetch(
    `https://api.github.com/repos/${REPOSITORY}/actions/workflows/${WORKFLOW}/runs?per_page=5`,
    { headers: { Accept: "application/vnd.github+json" } },
  );
  // Unauthenticated callers get 60 requests an hour per IP. A 403 here means
  // the visitor spent them, which is not worth an error state.
  if (!response.ok) throw new Error(`GitHub API responded ${response.status}`);

  const payload = await response.json();
  return (payload.workflow_runs ?? []).map((run: Record<string, any>) => ({
    id: run.id,
    status: run.status,
    conclusion: run.conclusion,
    createdAt: run.created_at,
    url: run.html_url,
    commit: run.head_sha,
    title: run.display_title ?? run.name,
  }));
}

export function useBenchmark() {
  const [data, setData] = useState<BenchmarkData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<WorkflowRun[] | null>(null);

  useEffect(() => {
    loadResults().then(setData, (reason: Error) => setError(reason.message));
    // The page is fully usable without this; a failure stays silent.
    loadRuns().then(setRuns, () => setRuns(null));
  }, []);

  const latestRun = runs?.[0] ?? null;
  // The deployed JSON knows which run measured it. If CI has finished a newer
  // one since, this page is out of date and says so rather than pretending.
  const measuredBy = data?.environment?.runId ? Number(data.environment.runId) : null;
  const staleSince =
    latestRun &&
    latestRun.conclusion === "success" &&
    measuredBy !== null &&
    latestRun.id > measuredBy
      ? latestRun
      : null;

  return { data, error, runs, latestRun, staleSince };
}
