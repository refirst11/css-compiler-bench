import { useEffect, useMemo, useState } from "react";
import type { BenchmarkData, BuildMeasurement } from "./types";

const RESULT_URL = "/latest.json";

const formatSeconds = (value: number) => `${value.toFixed(3)} s`;
const formatBytes = (value: number, unit: "KB" | "MB") =>
  `${(value / (unit === "MB" ? 1024 * 1024 : 1024)).toFixed(2)} ${unit}`;
const formatDate = (value?: string) => {
  if (!value) return "No CI result yet";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
};

function EmptyState({ children }: { children: string }) {
  return <div className="empty-state">{children}</div>;
}

function SectionHeading({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
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
              <span>{item.label}</span>
              <small>{item.project}</small>
            </div>
            <div className="speed-track" aria-label={`${item.label}: ${formatSeconds(item.averageBuildSeconds)}`}>
              <span className="speed-line" style={{ width: `${length}%` }} />
              <span className="speed-dot" style={{ left: `${length}%` }} />
            </div>
            <strong>{formatSeconds(item.averageBuildSeconds)}</strong>
          </div>
        );
      })}
      <div className="speed-axis"><span>fastest</span><span>slowest</span></div>
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
          </tr>
        </thead>
        <tbody>
          {measurements.map((item) => (
            <tr key={item.project}>
              <td><span className="table-label">{item.label}</span><small>{item.project}</small></td>
              <td className="number">{formatSeconds(item.averageBuildSeconds)}</td>
              <td className="number">{item.libraryCostMs === null ? "control" : `${item.libraryCostMs.toFixed(1)} ms`}</td>
              <td className="number">{item.standardDeviationMs.toFixed(1)} ms</td>
              <td className="number">{formatBytes(item.nextBytes, "MB")}</td>
              <td className="number">{formatBytes(item.cssBytes, "KB")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScaleChart({ data }: { data: NonNullable<BenchmarkData["scale"]> }) {
  const projects = [...new Set(data.measurements.map((item) => item.project))];
  const colors = ["#ffbd69", "#7dd3fc", "#c4b5fd", "#86efac", "#fb7185", "#f0abfc", "#facc15", "#67e8f9"];
  const max = Math.max(...data.measurements.map((item) => item.buildSeconds));
  const min = Math.min(...data.measurements.map((item) => item.buildSeconds));
  const width = 760;
  const height = 250;
  const x = (count: number) => {
    const minCount = Math.min(...data.counts);
    const maxCount = Math.max(...data.counts);
    if (minCount === maxCount) return width / 2;
    return 32 + ((Math.log10(count) - Math.log10(minCount)) / (Math.log10(maxCount) - Math.log10(minCount))) * (width - 64);
  };
  const y = (seconds: number) => height - 30 - ((seconds - min) / Math.max(max - min, 0.001)) * (height - 58);

  return (
    <div className="chart-layout">
      <svg className="scale-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Build time by number of distinct styled components">
        {[0, 1, 2, 3].map((step) => {
          const value = min + ((max - min) * step) / 3;
          const yPosition = y(value);
          return <g key={step}><line x1="32" x2={width - 32} y1={yPosition} y2={yPosition} className="grid-line" /><text x="0" y={yPosition + 4} className="axis-label">{value.toFixed(1)}s</text></g>;
        })}
        {projects.map((project, index) => {
          const points = data.measurements
            .filter((item) => item.project === project)
            .sort((a, b) => a.count - b.count)
            .map((item) => `${x(item.count)},${y(item.buildSeconds)}`)
            .join(" ");
          return <polyline key={project} points={points} fill="none" stroke={colors[index % colors.length]} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />;
        })}
        {data.counts.map((count) => <text key={count} x={x(count)} y={height - 5} textAnchor="middle" className="axis-label">{count}</text>)}
      </svg>
      <div className="legend">
        {projects.map((project, index) => <span key={project}><i style={{ background: colors[index % colors.length] }} />{project}</span>)}
      </div>
    </div>
  );
}

function App() {
  const [data, setData] = useState<BenchmarkData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${RESULT_URL}?t=${Date.now()}`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("No benchmark result has been published yet.");
        return response.json() as Promise<BenchmarkData>;
      })
      .then(setData)
      .catch((reason: Error) => setError(reason.message));
  }, []);

  const measurements = data?.build?.measurements ?? [];
  const fastest = useMemo(() => measurements.length ? Math.min(...measurements.map((item) => item.averageBuildSeconds)) : null, [measurements]);

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">CI measurement dashboard</p>
          <h1>CSS compiler benchmark</h1>
          <p className="lede">Measurements, not verdicts. Each line is derived from the build time emitted by CI; the exact seconds stay beside the visual comparison.</p>
        </div>
        <div className="status-card">
          <span className={`status-dot ${data ? "ready" : "pending"}`} />
          <div><strong>{data ? "CI result loaded" : "Waiting for CI"}</strong><small>{data ? formatDate(data.generatedAt) : error ?? "Run npm run bench to publish latest.json"}</small></div>
        </div>
      </header>

      {data?.environment && <div className="metadata"><span>{data.environment.ci ? "CI" : "local"}</span><span>{data.environment.node}</span><span>{data.environment.platform}/{data.environment.arch}</span>{data.environment.commit && <span>{data.environment.commit.slice(0, 7)}</span>}</div>}

      <section className="section primary-section">
        <SectionHeading eyebrow="01 / cold build" title="Speed, drawn to scale" detail={data?.build ? `${data.build.iterations - data.build.warmupIterations} measured rounds · seed ${data.build.seed}` : "The chart appears after the benchmark job uploads its JSON result."} />
        {measurements.length ? <><SpeedBars measurements={measurements} /><BuildTable measurements={measurements} />{fastest !== null && <p className="annotation">Fastest observed average: <strong>{formatSeconds(fastest)}</strong>. Line length is relative within this CI run; it is not a universal performance score.</p>}</> : <EmptyState>Run the CI benchmark to populate the build-time visualization.</EmptyState>}
      </section>

      <section className="section-grid">
        <section className="section">
          <SectionHeading eyebrow="02 / scale" title="Distinct definitions" detail="10 / 100 / 1,000 styled definitions expose how the build changes as a project grows." />
          {data?.scale?.measurements?.length ? <ScaleChart data={data.scale} /> : <EmptyState>Scale data will appear after the scale job completes.</EmptyState>}
        </section>
      </section>

      <section className="section">
        <SectionHeading eyebrow="04 / shipped structure" title="What survives the build" detail={data?.structure?.client ? "Server and client structure measurements." : "Run the structure measurement with --client to compare both sides."} />
        {data?.structure?.measurements ? <div className="table-wrap"><table><thead><tr><th>Implementation</th><th>SSR chunk</th><th>Structure</th><th>Runtime</th><th>Client</th></tr></thead><tbody>{Object.entries(data.structure.measurements).map(([label, row]) => <tr key={label}><td>{label}</td><td className="number">{row["SSR chunk (B)"]} B</td><td className="number">{row["Structure (B)"]} B</td><td className="number">{row["Runtime (B)"]} B</td><td className="number">{row["Client chunk (B)"] ?? "—"} B</td></tr>)}</tbody></table></div> : <EmptyState>Structure data will appear after the structure job completes.</EmptyState>}
      </section>

      <footer><span>Generated from <code>results/latest.json</code></span><span>Source lives in <code>benchmark/</code></span></footer>
    </main>
  );
}

export default App;
