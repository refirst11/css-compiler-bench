import * as css from "@typedcss/css";

const styles = css.create({
  base: {
    padding: "8px",
    fontSize: "16px",
    color: "blue",
    borderColor: "blue",
    borderStyle: "solid",
    borderWidth: "1px",
    borderRadius: "4px",
  },
  red: {
    color: "red",
    borderColor: "red",
  },
});
const styles2 = css.create({
  container: {
    marginBottom: "0.5rem",
    ":last-child": {
      marginBottom: 0,
    },
    "@media screen and (min-width: 800px)": {
      marginBottom: "0.75rem",
    },
  },
});

type TypedcssComponentProps = {
  isRed?: boolean;
};

const TypedcssComponent = ({ isRed }: TypedcssComponentProps) => {
  return (
    <>
      <div sx={[styles.base, isRed && styles.red]}>Hello from Benchmark!</div>
      <div>
        <div sx={styles2.container}>First</div>
        <div sx={styles2.container}>Second</div>
        <div sx={styles2.container}>Last</div>
      </div>
    </>
  );
};

export default TypedcssComponent;
