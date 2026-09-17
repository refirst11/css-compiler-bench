import styled from "styled-components";

const colorStyles = {
  red: "red",
  blue: "blue",
  green: "green",
  yellow: "yellow",
  purple: "purple",
};

const sizeStyles = {
  small: "12px",
  medium: "16px",
  large: "20px",
  xlarge: "24px",
};

const paddingStyles = {
  none: "0",
  small: "4px",
  medium: "8px",
  large: "16px",
  xlarge: "24px",
};

const borderRadiusStyles = {
  none: "0",
  small: "2px",
  medium: "4px",
  large: "8px",
  full: "9999px",
};

const backgroundStyles = {
  transparent: "transparent",
  white: "white",
  gray: "#f0f0f0",
  lightBlue: "#e3f2fd",
  lightGreen: "#e8f5e9",
};

interface TestProps {
  color: "red" | "blue" | "green" | "yellow" | "purple";
  size: "small" | "medium" | "large" | "xlarge";
  padding: "none" | "small" | "medium" | "large" | "xlarge";
  borderRadius: "none" | "small" | "medium" | "large" | "full";
  background: "transparent" | "white" | "gray" | "lightBlue" | "lightGreen";
}

const Box = styled.div<{
  $color: TestProps["color"];
  $size: TestProps["size"];
  $padding: TestProps["padding"];
  $borderRadius: TestProps["borderRadius"];
  $background: TestProps["background"];
}>`
  display: inline-block;
  font-weight: 500;
  transition: all 0.2s ease;
  color: ${({ $color }) => colorStyles[$color]};
  font-size: ${({ $size }) => sizeStyles[$size]};
  padding: ${({ $padding }) => paddingStyles[$padding]};
  border-radius: ${({ $borderRadius }) => borderRadiusStyles[$borderRadius]};
  background-color: ${({ $background }) => backgroundStyles[$background]};
`;

const Test = ({ color, size, padding, borderRadius, background }: TestProps) => {
  return (
    <Box
      $color={color}
      $size={size}
      $padding={padding}
      $borderRadius={borderRadius}
      $background={background}
    >
      Benchmark Test Component with Bracket Notation Variants
    </Box>
  );
};

export default Test;
