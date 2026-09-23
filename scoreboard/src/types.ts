export type LaneFailure = { project: string; error: string };

export type BuildMeasurement = {
  project: string;
  label: string;
  baseline: boolean;
  averageBuildSeconds: number;
  minSeconds: number;
  maxSeconds: number;
  standardDeviationMs: number;
  libraryCostMs: number | null;
  nextBytes: number;
  cssBytes: number;
  // Absent from results measured before the cache was split out of nextBytes;
  // deploy.yml can redeploy from an older run's artifact, so the table has to
  // render without it.
  cacheBytes?: number;
  samples: number[];
  // Absent from results measured before the significance test was added;
  // deploy.yml can redeploy from an older run's artifact, so the table has to
  // render without it.
  mechanism?: string;
  medianBuildSeconds?: number;
  madMs?: number;
  sampleCount?: number;
  noiseFloorMs?: number;
  separation?: {
    vs: string;
    deltaMs: number;
    ci95LowMs: number;
    ci95HighMs: number;
    significant: boolean;
  } | null;
};

export type ScaleMeasurement = {
  count: number;
  project: string;
  label: string;
  buildSeconds: number;
};

export type StructureMeasurement = {
  project: string;
  label: string;
  "SSR chunk (B)": number;
  "Structure (B)": number;
  "Runtime (B)": number | string;
  "Structure + runtime (B)": number;
  "Client chunk (B)"?: number;
};

export type BindingMeasurement = {
  project: string;
  label: string;
  mechanism?: string;
  outcome: "sees-through" | "dropped" | "escaped-to-runtime" | "build-failed" | "not-applicable";
  literalInCss: boolean | null;
  boundInCss: boolean | null;
  computedInCss: boolean | null;
  computedInJs: boolean | null;
};

export type Environment = {
  node?: string;
  platform?: string;
  arch?: string;
  cpu?: string | null;
  cpuCount?: number;
  memoryGb?: number;
  ci?: boolean;
  runner?: string | null;
  repository?: string | null;
  ref?: string | null;
  commit?: string | null;
  runId?: string | null;
  runUrl?: string | null;
};

export type BenchmarkData = {
  schemaVersion: number;
  generatedAt: string;
  environment?: Environment;
  build?: {
    status: string;
    iterations: number;
    warmupIterations: number;
    baseline: string;
    measurements: BuildMeasurement[];
    failures?: LaneFailure[];
  };
  scale?: {
    status: string;
    counts: number[];
    measurements: ScaleMeasurement[];
    failures?: LaneFailure[];
  };
  binding?: {
    status: string;
    literalSentinel: string;
    boundSentinel: string;
    computedSentinel: string;
    measurements: BindingMeasurement[];
    failures?: LaneFailure[];
  };
  structure?: {
    status: string;
    client: boolean;
    measurements: StructureMeasurement[];
    failures?: LaneFailure[];
  };
};

// The public Actions API, read straight from the browser: no token, no build
// step, and it stays true after the page was deployed.
export type WorkflowRun = {
  id: number;
  status: string;
  conclusion: string | null;
  createdAt: string;
  url: string;
  commit: string;
  title: string;
};
