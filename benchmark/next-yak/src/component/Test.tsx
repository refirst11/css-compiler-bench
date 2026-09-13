import { styled } from "next-yak";

type Color = "red" | "blue" | "green" | "yellow" | "purple";
type Size = "small" | "medium" | "large" | "xlarge";
type Padding = "none" | "small" | "medium" | "large" | "xlarge";
type BorderRadius = "none" | "small" | "medium" | "large" | "full";
type Background = "transparent" | "white" | "gray" | "lightBlue" | "lightGreen";

const colors: Record<Color, string> = {
  red: "red",
  blue: "blue",
  green: "green",
  yellow: "yellow",
  purple: "purple",
};

const sizes: Record<Size, string> = {
  small: "12px",
  medium: "16px",
  large: "20px",
  xlarge: "24px",
};

const paddings: Record<Padding, string> = {
  none: "0",
  small: "4px",
  medium: "8px",
  large: "16px",
  xlarge: "24px",
};

const radii: Record<BorderRadius, string> = {
  none: "0",
  small: "2px",
  medium: "4px",
  large: "8px",
  full: "9999px",
};

const backgrounds: Record<Background, string> = {
  transparent: "transparent",
  white: "white",
  gray: "#f0f0f0",
  lightBlue: "#e3f2fd",
  lightGreen: "#e8f5e9",
};

const StyledTest = styled.div<{
  $color: Color;
  $size: Size;
  $padding: Padding;
  $borderRadius: BorderRadius;
  $background: Background;
}>`
  display: inline-block;
  font-weight: 500;
  transition: all 0.2s ease;
  color: ${({ $color }) => colors[$color]};
  font-size: ${({ $size }) => sizes[$size]};
  padding: ${({ $padding }) => paddings[$padding]};
  border-radius: ${({ $borderRadius }) => radii[$borderRadius]};
  background-color: ${({ $background }) => backgrounds[$background]};
`;

interface TestProps {
  color: Color;
  size: Size;
  padding: Padding;
  borderRadius: BorderRadius;
  background: Background;
}

const Test = (props: TestProps) => (
  <StyledTest
    $color={props.color}
    $size={props.size}
    $padding={props.padding}
    $borderRadius={props.borderRadius}
    $background={props.background}
  >
    Benchmark Test Component with Bracket Notation Variants
  </StyledTest>
);

export default Test;
