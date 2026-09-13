import { Box } from "@devup-ui/react";

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

interface TestProps {
  color: Color;
  size: Size;
  padding: Padding;
  borderRadius: BorderRadius;
  background: Background;
}

// Devup UI reads the style props off the JSX element itself, so the variant
// lookup has to happen in the prop value. Spreading a style object into Box
// hides the prop names from the compiler and silently emits no CSS at all.
const Test = ({
  color,
  size,
  padding,
  borderRadius,
  background,
}: TestProps) => (
  <Box
    display="inline-block"
    fontWeight="500"
    transition="all 0.2s ease"
    color={colors[color]}
    fontSize={sizes[size]}
    padding={paddings[padding]}
    borderRadius={radii[borderRadius]}
    backgroundColor={backgrounds[background]}
  >
    Benchmark Test Component with Bracket Notation Variants
  </Box>
);

export default Test;
