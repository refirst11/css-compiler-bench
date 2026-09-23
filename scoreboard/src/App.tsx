import { useMemo } from "react";
import { MachineNote, Notes } from "./Notes";
import { repositoryUrl, useBenchmark } from "./data";
import type {
  BindingMeasurement,
  BenchmarkData,
  BuildMeasurement,
  LaneFailure,
  StructureMeasurement,
  WorkflowRun,
} from "./types";

const formatSeconds = (value: number) => `${value.toFixed(3)} s`;
const formatBytes = (value: number, unit: "KB" | "MB") =>
  `${(value / (unit === "MB" ? 1024 * 1024 : 1024)).toFixed(2)} ${unit}`;
const formatDate = (value?: string) => {
  if (!value) return "No CI result yet";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
};

function relativeTime(value: string) {
  const elapsed = Date.now() - new Date(value).valueOf();
  if (!Number.isFinite(elapsed)) return value;

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["minute", 60_000],
    ["hour", 3_600_000],
    ["day", 86_400_000],
    ["week", 604_800_000],
    ["month", 2_629_800_000],
    ["year", 31_557_600_000],
  ];
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  let [unit, size] = units[0];
  for (const candidate of units) {
    if (Math.abs(elapsed) >= candidate[1]) [unit, size] = candidate;
  }
  return formatter.format(-Math.round(elapsed / size), unit);
}

function EmptyState({ children }: { children: string }) {
  return <div className="empty-state">{children}</div>;
}

function SectionHeading({
  eyebrow,
  title,
  detail,
}: {
  eyebrow: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <p className="section-detail">{detail}</p>
    </div>
  );
}

// A lane that could not be measured is named here rather than silently missing
// from the chart above it.
function Failures({ failures }: { failures?: LaneFailure[] }) {
  if (!failures?.length) return null;

  return (
    <div className="failures">
      <strong>{failures.length} lane(s) failed this run</strong>
      <ul>
        {failures.map((failure) => (
          <li key={failure.project}>
            <code>{failure.project}</code> {failure.error}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RunStatus({
  run,
  data,
  stale,
}: {
  run: WorkflowRun | null;
  data: BenchmarkData | null;
  stale: WorkflowRun | null;
}) {
  const state = !run
    ? data
      ? "ready"
      : "pending"
    : run.status !== "completed"
      ? "running"
      : run.conclusion === "success"
        ? "ready"
        : "failed";

  const headline = !run
    ? data
      ? "Result loaded"
      : "Waiting for a result"
    : run.status !== "completed"
      ? "Benchmark running"
      : run.conclusion === "success"
        ? "CI green"
        : `CI ${run.conclusion}`;

  return (
    <div className="status-card">
      <span className={`status-dot ${state}`} />
      <div>
        <strong>{headline}</strong>
        <small>
          {run ? (
            <a href={run.url} target="_blank" rel="noreferrer">
              run #{run.id} · {relativeTime(run.createdAt)}
            </a>
          ) : (
            formatDate(data?.generatedAt)
          )}
        </small>
        {stale && (
          <small className="stale">
            Showing an older measurement;{" "}
            <a href={stale.url} target="_blank" rel="noreferrer">
              run #{stale.id}
            </a>{" "}
            is newer.
          </small>
        )}
      </div>
    </div>
  );
}

function SpeedBars({ measurements }: { measurements: BuildMeasurement[] }) {
  const fastest = Math.min(...measurements.map((item) => item.averageBuildSeconds));
  const slowest = Math.max(...measurements.map((item) => item.averageBuildSeconds));
  const span = Math.max(slowest - fastest, 0.001);

  return (
    <div className="speed-list">
      {measurements.map((item) => {
        // The shortest line is the fastest result; the line itself encodes the
        // measured distance from the fastest lane, while the number is exact.
        const length = 18 + ((item.averageBuildSeconds - fastest) / span) * 82;
        return (
          <div className="speed-row" key={item.project}>
            <div className="speed-label">
              <span>
                {item.label}
                {item.baseline && <em> control</em>}
              </span>
              <small>{item.project}</small>
            </div>
            <div
              className="speed-track"
              aria-label={`${item.label}: ${formatSeconds(item.averageBuildSeconds)}`}
            >
              <span
                className={`speed-line ${item.baseline ? "control" : ""}`}
                style={{ width: `${length}%` }}
              />
              <span className="speed-dot" style={{ left: `${length}%` }} />
            </div>
            <strong>{formatSeconds(item.averageBuildSeconds)}</strong>
          </div>
        );
      })}
      <div className="speed-axis">
        <span>fastest</span>
        <span>slowest</span>
      </div>
    </div>
  );
}

function BuildTable({ measurements }: { measurements: BuildMeasurement[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Implementation</th>
            <th>Mechanism</th>
            <th>Average</th>
            <th>Library cost</th>
            <th>SD</th>
            <th>.next</th>
            <th>CSS</th>
            <th>Build cache</th>
          </tr>
        </thead>
        <tbody>
          {measurements.map((item) => (
            <tr key={item.project}>
              <td>
                <span className="table-label">{item.label}</span>
                <small>{item.project}</small>
              </td>
              <td>
                <span className="mechanism">{mechanismLabel(item.mechanism)}</span>
              </td>
              <td className="number">{formatSeconds(item.averageBuildSeconds)}</td>
              <td className="number">
                {item.libraryCostMs === null ? (
                  "control"
                ) : (
                  <>
                    <span className={item.separation?.significant === false ? "indistinct" : ""}>
                      {item.libraryCostMs.toFixed(1)} ms
                    </span>
                    {item.separation ? (
                      <small>
                        {item.separation.significant
                          ? `95% ${item.separation.ci95LowMs.toFixed(0)} – ${item.separation.ci95HighMs.toFixed(0)} ms`
                          : "within noise"}
                      </small>
                    ) : null}
                  </>
                )}
              </td>
              <td className="number">{item.standardDeviationMs.toFixed(1)} ms</td>
              <td className="number">{formatBytes(item.nextBytes, "MB")}</td>
              <td className="number">{formatBytes(item.cssBytes, "KB")}</td>
              <td className="number">
                {item.cacheBytes === undefined ? "—" : formatBytes(item.cacheBytes, "MB")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function niceFloor(value: number) {
  return Math.floor(value * 2) / 2;
}

function niceCeil(value: number) {
  return Math.ceil(value * 2) / 2;
}

// Eleven lanes cannot be told apart by eleven line colours on one pair of axes:
// the palette runs out at eight and the lines cross in a band a few tenths of a
// second wide. One panel per lane on a shared scale compares the slopes without
// asking the reader to hold a legend in their head.
function ScaleChart({ data }: { data: NonNullable<BenchmarkData["scale"]> }) {
  const lanes = [
    ...new Map(
      data.measurements.map((item) => [item.project, item.label ?? item.project]),
    ).entries(),
  ];
  const counts = [...data.counts].sort((a, b) => a - b);
  const seconds = data.measurements.map((item) => item.buildSeconds);
  const low = niceFloor(Math.min(...seconds));
  const high = niceCeil(Math.max(...seconds));

  const width = 200;
  const height = 104;
  const padX = 18;
  const padTop = 10;
  const padBottom = 18;

  const x = (count: number) => {
    if (counts.length < 2) return width / 2;
    const span = Math.log10(counts[counts.length - 1]) - Math.log10(counts[0]);
    return padX + ((Math.log10(count) - Math.log10(counts[0])) / span) * (width - padX * 2);
  };
  const y = (value: number) =>
    height - padBottom - ((value - low) / Math.max(high - low, 0.001)) * (height - padTop - padBottom);

  const series = (project: string) =>
    data.measurements
      .filter((item) => item.project === project)
      .sort((a, b) => a.count - b.count);

  const baselineProject = lanes[0]?.[0];
  const baselinePoints = baselineProject
    ? series(baselineProject)
        .map((item) => `${x(item.count)},${y(item.buildSeconds)}`)
        .join(" ")
    : "";

  return (
    <div className="scale-grid">
      {lanes.map(([project, label]) => {
        const points = series(project);
        const last = points[points.length - 1];
        return (
          <figure className="scale-panel" key={project}>
            <figcaption>
              <span className="scale-panel-label">{label}</span>
              {last ? <small>{formatSeconds(last.buildSeconds)}</small> : null}
            </figcaption>
            <svg
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-label={`${label}: build time across ${counts.join(", ")} distinct definitions`}
            >
              {[low, (low + high) / 2, high].map((value) => (
                <line
                  key={value}
                  x1={padX}
                  x2={width - padX}
                  y1={y(value)}
                  y2={y(value)}
                  className="grid-line"
                />
              ))}
              {project !== baselineProject && baselinePoints ? (
                <polyline
                  points={baselinePoints}
                  fill="none"
                  className="scale-ghost"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
              <polyline
                points={points.map((item) => `${x(item.count)},${y(item.buildSeconds)}`).join(" ")}
                fill="none"
                className="scale-line"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              {points.map((item) => (
                <circle
                  key={item.count}
                  cx={x(item.count)}
                  cy={y(item.buildSeconds)}
                  r="4"
                  className="scale-dot"
                >
                  <title>{`${item.count} definitions — ${formatSeconds(item.buildSeconds)}`}</title>
                </circle>
              ))}
              {counts.map((count) => (
                <text
                  key={count}
                  x={x(count)}
                  y={height - 4}
                  textAnchor="middle"
                  className="axis-label"
                >
                  {count}
                </text>
              ))}
            </svg>
          </figure>
        );
      })}
      <p className="scale-note">
        Every panel shares one vertical scale, {low.toFixed(1)}s to {high.toFixed(1)}s — it does
        not start at zero, so read the slope, not the height. The faint line repeated in each
        panel is the control.
      </p>
    </div>
  );
}

const MECHANISM_LABELS: Record<string, string> = {
  "names-only": "names only",
  "authored-classes": "authored classes",
  "scans-source": "scans source",
  "rewrites-ast": "rewrites AST",
  "evaluates-module": "evaluates module",
  runtime: "runtime",
};

function mechanismLabel(mechanism?: string) {
  if (!mechanism) return "—";
  return MECHANISM_LABELS[mechanism] ?? mechanism;
}

const OUTCOME_LABELS: Record<string, string> = {
  "sees-through": "resolves it",
  dropped: "drops it",
  "escaped-to-runtime": "ships it to the runtime",
  "build-failed": "refuses to build",
  "not-applicable": "no style value to bind",
};

function Reach({ value }: { value: boolean | null }) {
  if (value === null) return <span className="reach reach-na">—</span>;
  return (
    <span className={value ? "reach reach-yes" : "reach reach-no"}>{value ? "yes" : "no"}</span>
  );
}

// The repository's central claim is that "compile-time CSS" names several
// different mechanisms. This table is where that claim is measured rather than
// asserted: the same declaration written three ways, and what each lane's build
// managed to resolve.
function BindingTable({ measurements }: { measurements: BindingMeasurement[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Implementation</th>
            <th>Mechanism</th>
            <th>At the call site</th>
            <th>Behind a const</th>
            <th>Behind an expression</th>
            <th>Verdict</th>
          </tr>
        </thead>
        <tbody>
          {measurements.map((item) => (
            <tr key={item.project}>
              <td>
                <span className="table-label">{item.label}</span>
                <small>{item.project}</small>
              </td>
              <td>
                <span className="mechanism">{mechanismLabel(item.mechanism)}</span>
              </td>
              <td>
                <Reach value={item.literalInCss} />
              </td>
              <td>
                <Reach value={item.boundInCss} />
              </td>
              <td>
                <Reach value={item.computedInCss} />
              </td>
              <td>
                <span className={`verdict verdict-${item.outcome}`}>
                  {OUTCOME_LABELS[item.outcome] ?? item.outcome}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StructureTable({
  measurements,
  client,
}: {
  measurements: StructureMeasurement[];
  client: boolean;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Implementation</th>
            <th>SSR chunk</th>
            <th>Structure</th>
            <th>Runtime</th>
            {client && <th>Client chunk</th>}
          </tr>
        </thead>
        <tbody>
          {measurements.map((row) => (
            <tr key={row.project}>
              <td>
                <span className="table-label">{row.label}</span>
                <small>{row.project}</small>
              </td>
              <td className="number">{row["SSR chunk (B)"]} B</td>
              <td className="number">{row["Structure (B)"]} B</td>
              <td className="number">
                {row["Runtime (B)"] === "—" ? "—" : `${row["Runtime (B)"]} B`}
              </td>
              {client && <td className="number">{row["Client chunk (B)"] ?? "—"} B</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function App() {
  const { data, error, latestRun, staleSince } = useBenchmark();

  // Fastest first. The section draws speed as bar length, so leaving the rows in
  // lane order asked the reader to sort eleven bars by eye. The control keeps its
  // badge and is findable wherever the run puts it.
  const measurements = useMemo(
    () =>
      [...(data?.build?.measurements ?? [])].sort(
        (a, b) => a.averageBuildSeconds - b.averageBuildSeconds,
      ),
    [data],
  );
  const fastest = useMemo(
    () =>
      measurements.length
        ? Math.min(...measurements.map((item) => item.averageBuildSeconds))
        : null,
    [measurements],
  );
  const environment = data?.environment;

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">CI measurement dashboard</p>
          <h1>CSS compiler benchmark</h1>
          <p className="lede">
            Measurements, not verdicts. Every lane builds the same app on the same runner in the
            same job; the exact seconds stay beside the visual comparison.
          </p>
        </div>
        <RunStatus run={latestRun} data={data} stale={staleSince} />
      </header>

      {environment && (
        <div className="metadata">
          <span>{environment.ci ? (environment.runner ?? "CI") : "local"}</span>
          <span>{environment.node}</span>
          <span>
            {environment.platform}/{environment.arch}
          </span>
          {environment.cpu && (
            <span>
              {environment.cpu}
              {environment.cpuCount ? ` ×${environment.cpuCount}` : ""}
            </span>
          )}
          {environment.memoryGb && <span>{environment.memoryGb} GB</span>}
          {environment.commit && (
            <a
              className="metadata-link"
              href={`${repositoryUrl}/commit/${environment.commit}`}
              target="_blank"
              rel="noreferrer"
            >
              {environment.commit.slice(0, 7)}
            </a>
          )}
          {environment.runUrl && (
            <a className="metadata-link" href={environment.runUrl} target="_blank" rel="noreferrer">
              measured by run #{environment.runId}
            </a>
          )}
          <span>{formatDate(data?.generatedAt)}</span>
        </div>
      )}

      <section className="section primary-section">
        <SectionHeading
          eyebrow="01 / cold build"
          title="Speed, drawn to scale"
          detail={
            data?.build
              ? `${data.build.iterations - data.build.warmupIterations} measured rounds · rotating order · control: ${data.build.baseline}`
              : "The chart appears once a benchmark run publishes its JSON."
          }
        />
        {measurements.length ? (
          <>
            <SpeedBars measurements={measurements} />
            <BuildTable measurements={measurements} />
            {fastest !== null && (
              <p className="annotation">
                Fastest observed average: <strong>{formatSeconds(fastest)}</strong>. Line length is
                relative within this run; it is not a universal performance score. A library cost
                shown struck through is not distinguishable from the control at 95% confidence:
                treat it as zero, not as a ranking.
              </p>
            )}
          </>
        ) : (
          <EmptyState>
            {error ?? "Run the benchmark to populate the build-time visualization."}
          </EmptyState>
        )}
        <Failures failures={data?.build?.failures} />
      </section>

      <section className="section primary-section">
        <SectionHeading
          eyebrow="02 / scale"
          title="Distinct definitions"
          detail={
            data?.scale
              ? `${data.scale.counts.join(" / ")} distinct styled definitions, holding the rendered instance count fixed.`
              : "How the build changes as the number of styled definitions grows."
          }
        />
        {data?.scale?.measurements?.length ? (
          <ScaleChart data={data.scale} />
        ) : (
          <EmptyState>Scale data appears after the sweep completes.</EmptyState>
        )}
        <Failures failures={data?.scale?.failures} />
      </section>

      <section className="section">
        <SectionHeading
          eyebrow="03 / binding escape"
          title="What the build can still see"
          detail={
            data?.binding
              ? `The same declaration written three ways — ${data.binding.literalSentinel} at the call site, ${data.binding.boundSentinel} behind a const, ${data.binding.computedSentinel} behind an expression — and whether each reached the stylesheet.`
              : "Which lanes resolve a value they have to evaluate, and which do not."
          }
        />
        {data?.binding?.measurements?.length ? (
          <>
            <BindingTable measurements={data.binding.measurements} />
            <p className="annotation">
              A lane that resolves the const but not the expression is folding constants while
              reading the AST. One that resolves all three is executing the module. Reading a
              declaration at all is what separates a compiler here from a scanner.
            </p>
          </>
        ) : (
          <EmptyState>Binding results appear after the probe runs.</EmptyState>
        )}
        <Failures failures={data?.binding?.failures} />
      </section>

      <section className="section">
        <SectionHeading
          eyebrow="04 / shipped structure"
          title="What survives the build"
          detail={
            data?.structure?.client
              ? 'Class-name machinery in the SSR chunk, and in the client chunk of a "use client" rebuild.'
              : "Class-name machinery in the SSR chunk. Run the structure measurement with --client for both sides."
          }
        />
        {data?.structure?.measurements?.length ? (
          <StructureTable
            measurements={data.structure.measurements}
            client={data.structure.client}
          />
        ) : (
          <EmptyState>Structure data appears after the structure measurement completes.</EmptyState>
        )}
        <Failures failures={data?.structure?.failures} />
      </section>

      <Notes data={data} />

      <footer>
        <span>
          Measured by{" "}
          <a
            href={`${repositoryUrl}/actions/workflows/benchmark.yml`}
            target="_blank"
            rel="noreferrer"
          >
            GitHub Actions
          </a>
          , published from the run's own JSON
        </span>
        <span>
          <a href={repositoryUrl} target="_blank" rel="noreferrer">
            {repositoryUrl.replace("https://github.com/", "")}
          </a>
        </span>
      </footer>
    </main>
  );
}

export default App;
