import styles from "./page.module.css";
import PlumeriaComponent from "../component/PlumeriaComponent";
import ScaleFixture from "../component/ScaleFixture";
import Test from "../component/Test";

const scaleCount = Number(process.env.BENCHMARK_SCALE_COUNT ?? 0);

const benchmarkItems = Array.from({ length: 1000 }).map((_, i) => ({
  color: (["red", "blue", "green", "yellow", "purple"] as const)[i % 5],
  size: (["small", "medium", "large", "xlarge"] as const)[i % 4],
  padding: (["none", "small", "medium", "large", "xlarge"] as const)[i % 5],
  borderRadius: (["none", "small", "medium", "large", "full"] as const)[i % 5],
  background: (
    ["transparent", "white", "gray", "lightBlue", "lightGreen"] as const
  )[i % 5],
}));

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>CSS Benchmark</h1>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "2px" }}>
          {benchmarkItems.map((item, i) => (
            <Test key={i} {...item} />
          ))}
        </div>
        <PlumeriaComponent isRed={true} />
        <PlumeriaComponent isRed={false} />
        {scaleCount > 0 ? <ScaleFixture /> : null}
      </main>
    </div>
  );
}
