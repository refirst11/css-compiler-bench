import { style, styleVariants } from "@vanilla-extract/css";

export const base = style({
  display: "inline-block",
  fontWeight: 500,
  transition: "all 0.2s ease",
});

export const colorStyles = styleVariants({
  red: { color: "red" },
  blue: { color: "blue" },
  green: { color: "green" },
  yellow: { color: "yellow" },
  purple: { color: "purple" },
});

export const sizeStyles = styleVariants({
  small: { fontSize: "12px" },
  medium: { fontSize: "16px" },
  large: { fontSize: "20px" },
  xlarge: { fontSize: "24px" },
});

export const paddingStyles = styleVariants({
  none: { padding: "0" },
  small: { padding: "4px" },
  medium: { padding: "8px" },
  large: { padding: "16px" },
  xlarge: { padding: "24px" },
});

export const borderRadiusStyles = styleVariants({
  none: { borderRadius: "0" },
  small: { borderRadius: "2px" },
  medium: { borderRadius: "4px" },
  large: { borderRadius: "8px" },
  full: { borderRadius: "9999px" },
});

export const backgroundStyles = styleVariants({
  transparent: { backgroundColor: "transparent" },
  white: { backgroundColor: "white" },
  gray: { backgroundColor: "#f0f0f0" },
  lightBlue: { backgroundColor: "#e3f2fd" },
  lightGreen: { backgroundColor: "#e8f5e9" },
});
