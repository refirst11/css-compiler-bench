import { css } from "../../styled-system/css";

const base = css({
  display: "inline-block",
  fontWeight: 500,
  transition: "all 0.2s ease",
});

const colorStyles = {
  red: css({ color: "red" }),
  blue: css({ color: "blue" }),
  green: css({ color: "green" }),
  yellow: css({ color: "yellow" }),
  purple: css({ color: "purple" }),
};

const sizeStyles = {
  small: css({ fontSize: "12px" }),
  medium: css({ fontSize: "16px" }),
  large: css({ fontSize: "20px" }),
  xlarge: css({ fontSize: "24px" }),
};

const paddingStyles = {
  none: css({ padding: "0" }),
  small: css({ padding: "4px" }),
  medium: css({ padding: "8px" }),
  large: css({ padding: "16px" }),
  xlarge: css({ padding: "24px" }),
};

const borderRadiusStyles = {
  none: css({ borderRadius: "0" }),
  small: css({ borderRadius: "2px" }),
  medium: css({ borderRadius: "4px" }),
  large: css({ borderRadius: "8px" }),
  full: css({ borderRadius: "9999px" }),
};

const backgroundStyles = {
  transparent: css({ backgroundColor: "transparent" }),
  white: css({ backgroundColor: "white" }),
  gray: css({ backgroundColor: "#f0f0f0" }),
  lightBlue: css({ backgroundColor: "#e3f2fd" }),
  lightGreen: css({ backgroundColor: "#e8f5e9" }),
};

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
