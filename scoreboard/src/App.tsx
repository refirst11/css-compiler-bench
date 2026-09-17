import { useMemo } from "react";
import { MachineNote, Notes } from "./Notes";
import { repositoryUrl, useBenchmark } from "./data";
import type {
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
              <td className="number">{formatSeconds(item.averageBuildSeconds)}</td>
              <td className="number">
                {item.libraryCostMs === null ? "control" : `${item.libraryCostMs.toFixed(1)} ms`}
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

const LANE_COLORS = [
  "#ffbd69",
  "#7dd3fc",
  "#c4b5fd",
  "#86efac",
  "#fb7185",
  "#f0abfc",
  "#facc15",
  "#67e8f9",
];

function ScaleChart({ data }: { data: NonNullable<BenchmarkData["scale"]> }) {
  const lanes = [
    ...new Map(
      data.measurements.map((item) => [item.project, item.label ?? item.project]),
    ).entries(),
  ];
  const max = Math.max(...data.measurements.map((item) => item.buildSeconds));
  const min = Math.min(...data.measurements.map((item) => item.buildSeconds));
  const width = 760;
  const height = 250;
  const x = (count: number) => {
    const minCount = Math.min(...data.counts);
    const maxCount = Math.max(...data.counts);
    if (minCount === maxCount) return width / 2;
    return (
      32 +
      ((Math.log10(count) - Math.log10(minCount)) / (Math.log10(maxCount) - Math.log10(minCount))) *
        (width - 64)
    );
  };
  const y = (seconds: number) =>
    height - 30 - ((seconds - min) / Math.max(max - min, 0.001)) * (height - 58);

  return (
    <div className="chart-layout">
      <svg
        className="scale-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Build time by number of distinct styled definitions"
      >
        {[0, 1, 2, 3].map((step) => {
          const value = min + ((max - min) * step) / 3;
          const yPosition = y(value);
          return (
            <g key={step}>
              <line x1="32" x2={width - 32} y1={yPosition} y2={yPosition} className="grid-line" />
              <text x="0" y={yPosition + 4} className="axis-label">
                {value.toFixed(1)}s
              </text>
            </g>
          );
        })}
        {lanes.map(([project], index) => {
          const points = data.measurements
            .filter((item) => item.project === project)
            .sort((a, b) => a.count - b.count)
            .map((item) => `${x(item.count)},${y(item.buildSeconds)}`)
            .join(" ");
          // The viewBox is 760 wide and the chart is stretched to its container,
          // so a stroke width set on the element is multiplied by whatever that
          // ratio happens to be -- the old 3 landed near 4.3px on a wide screen,
          // heavy once eleven lanes overlap. Non-scaling keeps it in device
          // pixels, so styles.css can set the width and mean it.
          return (
            <polyline
              key={project}
              points={points}
              fill="none"
              stroke={LANE_COLORS[index % LANE_COLORS.length]}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
        {data.counts.map((count) => (
          <text key={count} x={x(count)} y={height - 5} textAnchor="middle" className="axis-label">
            {count}
          </text>
        ))}
      </svg>
      <div className="legend">
        {lanes.map(([project, label], index) => (
          <span key={project}>
            <i style={{ background: LANE_COLORS[index % LANE_COLORS.length] }} />
            {label}
          </span>
        ))}
      </div>
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

  const measurements = data?.build?.measurements ?? [];
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
              ? `${data.build.iterations - data.build.warmupIterations} measured rounds · seed ${data.build.seed} · control: ${data.build.baseline}`
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
                relative within this run; it is not a universal performance score.
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
          eyebrow="03 / shipped structure"
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
