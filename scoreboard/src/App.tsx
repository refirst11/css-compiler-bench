import { useMemo } from "react";
import { Notes, mechanismLabel } from "./Notes";
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
function Failures({
  failures,
  unit = "lane(s)",
  tone = "error",
}: {
  failures?: LaneFailure[];
  unit?: string;
  tone?: "error" | "info";
}) {
  if (!failures?.length) return null;

  return (
    <div className={`failures failures-${tone}`}>
      <strong>
        {failures.length} {unit} failed this run
      </strong>
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

// The card speaks for the result on the page. A benchmark still measuring is a
// line under it, so the page never reads as if its numbers were already gone.
function RunStatus({
  data,
  shown,
  active,
  stale,
}: {
  data: BenchmarkData | null;
  shown: WorkflowRun | null;
  active: WorkflowRun | null;
  stale: WorkflowRun | null;
}) {
  const state = shown
    ? shown.conclusion === "success"
      ? "ready"
      : "failed"
    : data
      ? "ready"
      : "pending";

  const headline = shown
    ? shown.conclusion === "success"
      ? "CI green"
      : `CI ${shown.conclusion}`
    : data
      ? "Result loaded"
      : "Waiting for a result";

  return (
    <div className="status-card">
      <span className={`status-dot ${state}`} />
      <div>
        <strong>{headline}</strong>
        <small>
          {shown ? (
            <a href={shown.url} target="_blank" rel="noreferrer">
              run #{shown.id} · {relativeTime(shown.createdAt)}
            </a>
          ) : (
            formatDate(data?.generatedAt)
          )}
        </small>
        {active && (
          <small className="running">
            <a href={active.url} target="_blank" rel="noreferrer">
              run #{active.id}
            </a>{" "}
            is measuring; this result stays until it finishes.
          </small>
        )}
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

const formatDelta = (ms: number) => `${ms >= 0 ? "+" : "−"}${Math.abs(ms).toFixed(0)} ms`;

// Every lane pays for Next.js itself, so drawing absolute seconds spends most of
// the line on a cost they all share. Measuring from the control instead leaves
// only what the library adds. A dimmed bar is one whose 95% interval of the
// paired per-round differences crosses zero: it cannot be told from the control.
function CostChart({ measurements }: { measurements: BuildMeasurement[] }) {
  const bounds = measurements.flatMap((item) =>
    item.libraryCostMs === null
      ? [0]
      : [
          item.libraryCostMs,
          item.separation?.ci95LowMs ?? item.libraryCostMs,
          item.separation?.ci95HighMs ?? item.libraryCostMs,
        ],
  );
  const low = Math.min(0, ...bounds);
  const high = Math.max(0, ...bounds);
  const span = Math.max(high - low, 1);
  const position = (ms: number) => 4 + ((ms - low) / span) * 92;

  return (
    <div className="speed-list">
      {measurements.map((item) => {
        const cost = item.libraryCostMs ?? 0;
        const interval = item.separation;
        const indistinct = interval?.significant === false;
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
              aria-label={
                item.baseline
                  ? `${item.label}: control, ${formatSeconds(item.averageBuildSeconds)}`
                  : `${item.label}: ${formatDelta(cost)} against the control${
                      interval
                        ? `, 95% ${interval.ci95LowMs.toFixed(0)} to ${interval.ci95HighMs.toFixed(0)} ms`
                        : ""
                    }`
              }
            >
              <span className="speed-zero" style={{ left: `${position(0)}%` }} />
              <span
                className={`speed-bar${indistinct ? " indistinct" : ""}`}
                style={{
                  left: `${position(Math.min(0, cost))}%`,
                  width: `${Math.abs(position(cost) - position(0))}%`,
                }}
              />
              <span
                className={`speed-dot${item.baseline ? " control" : ""}${indistinct ? " indistinct" : ""}`}
                style={{ left: `${position(cost)}%` }}
              />
            </div>
            <strong>
              {item.baseline ? "control" : formatDelta(cost)}
              <small>{formatSeconds(item.averageBuildSeconds)}</small>
            </strong>
          </div>
        );
      })}
      <div className="speed-axis">
        <span>{formatDelta(low)}</span>
        <span>{formatDelta(high)}</span>
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
            <th className="number">Average</th>
            <th className="number">Library cost</th>
            <th className="number">SD</th>
            <th className="number">.next</th>
            <th className="number">CSS</th>
            <th className="number">Build cache</th>
          </tr>
        </thead>
        <tbody>
          {measurements.map((item) => (
            <tr key={item.project} className={item.baseline ? "is-control" : undefined}>
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
                        {item.separation.medianDeltaMs === undefined
                          ? ""
                          : `median ${item.separation.medianDeltaMs.toFixed(0)} ms · `}
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

// Twelve lanes cannot be told apart by twelve line colours on one pair of axes:
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
  const slowest = Math.max(...seconds);

  // The scale starts at zero, so a line's height is its whole build time and a
  // lane that starts high is seen to. Gridlines on round seconds, at most six
  // gaps, up to the first one above the slowest build.
  const tickStep = [1, 2, 5, 10].find((step) => Math.ceil(slowest / step) <= 6) ?? 10;
  const low = 0;
  const high = Math.max(Math.ceil(slowest / tickStep), 1) * tickStep;
  const ticks: number[] = [];
  for (let tick = low; tick <= high; tick += tickStep) ticks.push(tick);

  const width = 260;
  const height = 150;
  const padLeft = 30;
  const padRight = 10;
  const padTop = 8;
  // The count labels sit in their own row under the plot, clear of the
  // seconds label on its bottom line.
  const padBottom = 24;
  // The first and last points sit inside the plot, not on its edge, so the
  // count under each one does not run into the seconds beside it.
  const inset = 10;

  const x = (count: number) => {
    if (counts.length < 2) return (padLeft + width - padRight) / 2;
    const span = Math.log10(counts[counts.length - 1]) - Math.log10(counts[0]);
    return (
      padLeft +
      inset +
      ((Math.log10(count) - Math.log10(counts[0])) / span) *
        (width - padLeft - padRight - 2 * inset)
    );
  };
  const y = (value: number) =>
    height -
    padBottom -
    ((value - low) / Math.max(high - low, 0.001)) * (height - padTop - padBottom);

  const series = (project: string) =>
    data.measurements.filter((item) => item.project === project).sort((a, b) => a.count - b.count);

  return (
    <div className="scale-grid">
      {lanes.map(([project, label]) => {
        const points = series(project);
        const first = points[0];
        const last = points[points.length - 1];
        return (
          <figure className="scale-panel" key={project}>
            <figcaption className="scale-panel-label">{label}</figcaption>
            <svg
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-label={`${label}: build time across ${counts.join(", ")} distinct definitions`}
            >
              {ticks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={padLeft}
                    x2={width - padRight}
                    y1={y(tick)}
                    y2={y(tick)}
                    className="grid-line"
                  />
                  <text
                    x={padLeft - 6}
                    y={y(tick)}
                    textAnchor="end"
                    dominantBaseline="central"
                    className="axis-label"
                  >
                    {`${tick}s`}
                  </text>
                </g>
              ))}
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
                  y={height - 6}
                  textAnchor="middle"
                  className="axis-label"
                >
                  {count}
                </text>
              ))}
            </svg>
            {/* The two ends of the line, read off as a grid. */}
            {first && last ? (
              <table className="scale-values">
                <thead>
                  <tr>
                    <td />
                    <th scope="col">{first.count} defs</th>
                    <th scope="col">{last.count} defs</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">build time</th>
                    <td>{first.buildSeconds.toFixed(2)} s</td>
                    <td>{last.buildSeconds.toFixed(2)} s</td>
                  </tr>
                </tbody>
              </table>
            ) : null}
          </figure>
        );
      })}
      <p className="scale-note">
        Every panel shares one vertical scale, from zero to {high}s. Every count is built once, so a
        few tenths of a second either way is noise.
      </p>
    </div>
  );
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
            <th>Expression outcome</th>
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
            <th className="number">SSR chunk</th>
            <th className="number">Structure</th>
            <th className="number">Runtime</th>
            {client && <th className="number">Client chunk</th>}
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
  const { data, error, shownRun, activeRun, staleSince } = useBenchmark();

  // Fastest first. The section draws speed as bar length, so leaving the rows in
  // lane order asked the reader to sort twelve bars by eye. The control keeps its
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
        <RunStatus data={data} shown={shownRun} active={activeRun} stale={staleSince} />
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

      <nav className="toc" aria-label="Sections">
        <a href="#build">01 Cold build</a>
        <a href="#scale">02 Scale</a>
        <a href="#binding">03 Binding</a>
        <a href="#structure">04 Structure</a>
        <a href="#notes">Notes</a>
      </nav>

      <section className="section" id="build">
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
            <CostChart measurements={measurements} />
            <BuildTable measurements={measurements} />
            {fastest !== null && (
              <p className="annotation">
                Fastest observed average: <strong>{formatSeconds(fastest)}</strong>. Each bar is the
                library cost against the control; a dimmed bar, or a cost struck through in the
                table, is not distinguishable from the control at 95% confidence: treat it as zero,
                not as a ranking.
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

      <section className="section" id="scale">
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

      <section className="section" id="binding">
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
              Each form is built separately. A dash means that case has no result; a failed
              expression build does not erase the literal or const results. Finding a value in the
              stylesheet does not establish whether the compiler executes the module.
            </p>
          </>
        ) : (
          <EmptyState>Binding results appear after the probe runs.</EmptyState>
        )}
        <Failures failures={data?.binding?.failures} unit="probe case(s)" tone="info" />
      </section>

      <section className="section" id="structure">
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
