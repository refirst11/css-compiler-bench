import { Box } from "@devup-ui/react";

type Color = "red" | "blue" | "green" | "yellow" | "purple";
type Size = "small" | "medium" | "large" | "xlarge";
type Padding = "none" | "small" | "medium" | "large" | "xlarge";
type BorderRadius = "none" | "small" | "medium" | "large" | "full";
type Background = "transparent" | "white" | "gray" | "lightBlue" | "lightGreen";

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
//
// The table also has to be written at the prop, as an object literal. A table
// reached through a module-level binding is a value the compiler has to assume
// can be mutated before render, so it falls back to one custom property per
// axis; the literal makes every possible value visible at build time and each
// one becomes its own class. This is the maintainer's recommended form:
// https://github.com/dev-five-git/devup-ui/issues/663
const Test = ({ color, size, padding, borderRadius, background }: TestProps) => (
  <Box
    display="inline-block"
    fontWeight="500"
    transition="all 0.2s ease"
    color={
      {
        red: "red",
        blue: "blue",
        green: "green",
        yellow: "yellow",
        purple: "purple",
      }[color]
    }
    fontSize={
      {
        small: "12px",
        medium: "16px",
        large: "20px",
        xlarge: "24px",
      }[size]
    }
    padding={
      {
        none: "0",
        small: "4px",
        medium: "8px",
        large: "16px",
        xlarge: "24px",
      }[padding]
    }
    borderRadius={
      {
        none: "0",
        small: "2px",
        medium: "4px",
        large: "8px",
        full: "9999px",
      }[borderRadius]
    }
    backgroundColor={
      {
        transparent: "transparent",
        white: "white",
        gray: "#f0f0f0",
        lightBlue: "#e3f2fd",
        lightGreen: "#e8f5e9",
      }[background]
    }
  >
    Benchmark Test Component with Bracket Notation Variants
  </Box>
);

export default Test;
