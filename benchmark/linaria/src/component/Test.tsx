import { css } from "@linaria/core";

const base = css`
  display: inline-block;
  font-weight: 500;
  transition: all 0.2s ease;
`;

const colors = {
  red: css`
    color: red;
  `,
  blue: css`
    color: blue;
  `,
  green: css`
    color: green;
  `,
  yellow: css`
    color: yellow;
  `,
  purple: css`
    color: purple;
  `,
};

const sizes = {
  small: css`
    font-size: 12px;
  `,
  medium: css`
    font-size: 16px;
  `,
  large: css`
    font-size: 20px;
  `,
  xlarge: css`
    font-size: 24px;
  `,
};

const paddings = {
  none: css`
    padding: 0;
  `,
  small: css`
    padding: 4px;
  `,
  medium: css`
    padding: 8px;
  `,
  large: css`
    padding: 16px;
  `,
  xlarge: css`
    padding: 24px;
  `,
};

const radii = {
  none: css`
    border-radius: 0;
  `,
  small: css`
    border-radius: 2px;
  `,
  medium: css`
    border-radius: 4px;
  `,
  large: css`
    border-radius: 8px;
  `,
  full: css`
    border-radius: 9999px;
  `,
};

const backgrounds = {
  transparent: css`
    background-color: transparent;
  `,
  white: css`
    background-color: white;
  `,
  gray: css`
    background-color: #f0f0f0;
  `,
  lightBlue: css`
    background-color: #e3f2fd;
  `,
  lightGreen: css`
    background-color: #e8f5e9;
  `,
};

interface TestProps {
  color: keyof typeof colors;
  size: keyof typeof sizes;
  padding: keyof typeof paddings;
  borderRadius: keyof typeof radii;
  background: keyof typeof backgrounds;
}

const Test = ({ color, size, padding, borderRadius, background }: TestProps) => {
  return (
    <div
      className={[
        base,
        colors[color],
        sizes[size],
        paddings[padding],
        radii[borderRadius],
        backgrounds[background],
      ].join(" ")}
    >
      Benchmark Test Component with Bracket Notation Variants
    </div>
  );
};

export default Test;
