import { css } from "@linaria/core";

const base = css`
  padding: 8px;
  font-size: 16px;
  color: blue;
  border-color: blue;
  border-style: solid;
  border-width: 1px;
  border-radius: 4px;
`;

const red = css`
  color: red;
  border-color: red;
`;

const container = css`
  margin-bottom: 0.5rem;

  &:last-child {
    margin-bottom: 0;
  }

  @media screen and (min-width: 800px) {
    margin-bottom: 0.75rem;
  }
`;

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
