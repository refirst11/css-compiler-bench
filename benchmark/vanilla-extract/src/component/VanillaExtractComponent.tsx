import { base, container, red } from "./VanillaExtractComponent.css";

type VanillaExtractComponentProps = {
  isRed?: boolean;
};

const VanillaExtractComponent = ({ isRed }: VanillaExtractComponentProps) => {
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

export default VanillaExtractComponent;
