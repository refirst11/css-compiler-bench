import { cx, style } from "zyzz";

type ZyzzComponentProps = {
  isRed?: boolean;
};

const ZyzzComponent = ({ isRed }: ZyzzComponentProps) => {
  return (
    <>
      <div {...cx(styles.base(), isRed && styles.red())}>Hello from Benchmark!</div>
      <div>
        <div {...styles.container()}>First</div>
        <div {...styles.container()}>Second</div>
        <div {...styles.container()}>Last</div>
      </div>
    </>
  );
};

export default ZyzzComponent;

namespace styles {
  export const base = style({
    padding: "8px",
    fontSize: "16px",
    color: "blue",
    borderColor: "blue",
    borderStyle: "solid",
    borderWidth: "1px",
    borderRadius: "4px",
  });

  export const red = style({
    color: "red",
    borderColor: "red",
  });

  export const container = style({
    marginBottom: "0.5rem",
    ":last-child": {
      marginBottom: 0,
    },
    "@media screen and (min-width: 800px)": {
      marginBottom: "0.75rem",
    },
  });
}
