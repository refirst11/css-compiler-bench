import styles from "./VariantsComponent.module.css";

type VariantsComponentProps = {
  isRed?: boolean;
};

const VariantsComponent = ({ isRed }: VariantsComponentProps) => {
  return (
    <>
      <div className={[styles.base, isRed && styles.red].filter(Boolean).join(" ")}>
        Hello from Benchmark!
      </div>
      <div>
        <div className={styles.container}>First</div>
        <div className={styles.container}>Second</div>
        <div className={styles.container}>Last</div>
      </div>
    </>
  );
};

export default VariantsComponent;
