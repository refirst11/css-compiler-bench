import { variants } from "zyzz";

interface TestProps {
  color: "red" | "blue" | "green" | "yellow" | "purple";
  size: "small" | "medium" | "large" | "xlarge";
  padding: "none" | "small" | "medium" | "large" | "xlarge";
  borderRadius: "none" | "small" | "medium" | "large" | "full";
  background: "transparent" | "white" | "gray" | "lightBlue" | "lightGreen";
}

const Test = ({ color, size, padding, borderRadius, background }: TestProps) => {
  return (
    <div {...styles.test({ color, size, padding, radius: borderRadius, background })}>
      Benchmark Test Component with Bracket Notation Variants
    </div>
  );
};

export default Test;

namespace styles {
  export const test = variants({
    base: {
      display: "inline-block",
      fontWeight: 500,
      transition: "all 0.2s ease",
    },
    variants: {
      color: {
        red: { color: "red" },
        blue: { color: "blue" },
        green: { color: "green" },
        yellow: { color: "yellow" },
        purple: { color: "purple" },
      },
      size: {
        small: { fontSize: "12px" },
        medium: { fontSize: "16px" },
        large: { fontSize: "20px" },
        xlarge: { fontSize: "24px" },
      },
      padding: {
        none: { padding: "0" },
        small: { padding: "4px" },
        medium: { padding: "8px" },
        large: { padding: "16px" },
        xlarge: { padding: "24px" },
      },
      radius: {
        none: { borderRadius: "0" },
        small: { borderRadius: "2px" },
        medium: { borderRadius: "4px" },
        large: { borderRadius: "8px" },
        full: { borderRadius: "9999px" },
      },
      background: {
        transparent: { backgroundColor: "transparent" },
        white: { backgroundColor: "white" },
        gray: { backgroundColor: "#f0f0f0" },
        lightBlue: { backgroundColor: "#e3f2fd" },
        lightGreen: { backgroundColor: "#e8f5e9" },
      },
    },
  });
}
