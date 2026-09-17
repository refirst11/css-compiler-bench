import {
  backgroundStyles,
  base,
  borderRadiusStyles,
  colorStyles,
  paddingStyles,
  sizeStyles,
} from "./Test.css";

interface TestProps {
  color: "red" | "blue" | "green" | "yellow" | "purple";
  size: "small" | "medium" | "large" | "xlarge";
  padding: "none" | "small" | "medium" | "large" | "xlarge";
  borderRadius: "none" | "small" | "medium" | "large" | "full";
  background: "transparent" | "white" | "gray" | "lightBlue" | "lightGreen";
}

const Test = ({ color, size, padding, borderRadius, background }: TestProps) => {
  return (
    <div
      className={[
        base,
        colorStyles[color],
        sizeStyles[size],
        paddingStyles[padding],
        borderRadiusStyles[borderRadius],
        backgroundStyles[background],
      ].join(" ")}
    >
      Benchmark Test Component with Bracket Notation Variants
    </div>
  );
};

export default Test;
