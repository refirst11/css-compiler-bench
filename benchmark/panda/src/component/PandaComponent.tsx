import { css } from "../../styled-system/css";

const base = css({
  padding: "8px",
  fontSize: "16px",
  color: "blue",
  borderColor: "blue",
  borderStyle: "solid",
  borderWidth: "1px",
  borderRadius: "4px",
});

const red = css({
  color: "red",
  borderColor: "red",
});

const container = css({
  marginBottom: "0.5rem",
  "&:last-child": { marginBottom: 0 },
  "@media screen and (min-width: 800px)": { marginBottom: "0.75rem" },
});

type PandaComponentProps = {
  isRed?: boolean;
};

const PandaComponent = ({ isRed }: PandaComponentProps) => {
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

export default PandaComponent;
