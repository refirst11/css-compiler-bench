import { style } from "@vanilla-extract/css";

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
  selectors: {
    "&:last-child": { marginBottom: 0 },
  },
  "@media": {
    "screen and (min-width: 800px)": { marginBottom: "0.75rem" },
  },
});
