import { css, styled } from "next-yak";

type Color = "red" | "blue" | "green" | "yellow" | "purple";
type Size = "small" | "medium" | "large" | "xlarge";
type Padding = "none" | "small" | "medium" | "large" | "xlarge";
type BorderRadius = "none" | "small" | "medium" | "large" | "full";
type Background = "transparent" | "white" | "gray" | "lightBlue" | "lightGreen";

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
  ${({ $color }) =>
    $color === "red"
      ? css`
          ${colors.red}
        `
      : $color === "blue"
        ? css`
            ${colors.blue}
          `
        : $color === "green"
          ? css`
              ${colors.green}
            `
          : $color === "yellow"
            ? css`
                ${colors.yellow}
              `
            : css`
                ${colors.purple}
              `};
  ${({ $size }) =>
    $size === "small"
      ? css`
          ${sizes.small}
        `
      : $size === "medium"
        ? css`
            ${sizes.medium}
          `
        : $size === "large"
          ? css`
              ${sizes.large}
            `
          : css`
              ${sizes.xlarge}
            `};
  ${({ $padding }) =>
    $padding === "none"
      ? css`
          ${paddings.none}
        `
      : $padding === "small"
        ? css`
            ${paddings.small}
          `
        : $padding === "medium"
          ? css`
              ${paddings.medium}
            `
          : $padding === "large"
            ? css`
                ${paddings.large}
              `
            : css`
                ${paddings.xlarge}
              `};
  ${({ $borderRadius }) =>
    $borderRadius === "none"
      ? css`
          ${radii.none}
        `
      : $borderRadius === "small"
        ? css`
            ${radii.small}
          `
        : $borderRadius === "medium"
          ? css`
              ${radii.medium}
            `
          : $borderRadius === "large"
            ? css`
                ${radii.large}
              `
            : css`
                ${radii.full}
              `};
  ${({ $background }) =>
    $background === "transparent"
      ? css`
          ${backgrounds.transparent}
        `
      : $background === "white"
        ? css`
            ${backgrounds.white}
          `
        : $background === "gray"
          ? css`
              ${backgrounds.gray}
            `
          : $background === "lightBlue"
            ? css`
                ${backgrounds.lightBlue}
              `
            : css`
                ${backgrounds.lightGreen}
              `};
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
