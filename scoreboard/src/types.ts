export type BuildMeasurement = {
  project: string;
  label: string;
  averageBuildSeconds: number;
  minSeconds: number;
  maxSeconds: number;
  standardDeviationMs: number;
  libraryCostMs: number | null;
  nextBytes: number;
  cssBytes: number;
  samples: number[];
};

export type BenchmarkData = {
  schemaVersion: number;
  generatedAt: string;
  environment?: {
    node?: string;
    platform?: string;
    arch?: string;
    ci?: boolean;
    commit?: string | null;
    runId?: string | null;
  };
  build?: {
    status: string;
    iterations: number;
    warmupIterations: number;
    seed: number;
    baseline: string;
    measurements: BuildMeasurement[];
  };
  scale?: {
    status: string;
    counts: number[];
    measurements: Array<{
      count: number;
      project: string;
      buildSeconds: number;
    }>;
  };
  structure?: {
    status: string;
    client: boolean;
    measurements: Record<string, Record<string, number | string>>;
  };
};
