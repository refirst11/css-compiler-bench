import { base, container, red } from "./VariantsComponent.css";

type VariantsComponentProps = {
  isRed?: boolean;
};

const VariantsComponent = ({ isRed }: VariantsComponentProps) => {
  return (
    <>
      <div className={[base, isRed && red].filter(Boolean).join(" ")}>Hello from Benchmark!</div>
      <div>
        <div className={container}>First</div>
        <div className={container}>Second</div>
        <div className={container}>Last</div>
      </div>
    </>
  );
};

export default VariantsComponent;
