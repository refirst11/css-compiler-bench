import { css, styled } from "next-yak";

const StyledBox = styled.div<{ $isRed?: boolean }>`
  padding: 8px;
  font-size: 16px;
  ${({ $isRed }) =>
    $isRed
      ? css`
          color: red;
          border-color: red;
        `
      : css`
          color: blue;
          border-color: blue;
        `};
  border-style: solid;
  border-width: 1px;
  border-radius: 4px;
`;

const StyledContainer = styled.div`
  margin-bottom: 0.5rem;

  &:last-child {
    margin-bottom: 0;
  }

  @media screen and (min-width: 800px) {
    margin-bottom: 0.75rem;
  }
`;

type YakComponentProps = {
  isRed?: boolean;
};

const YakComponent = ({ isRed }: YakComponentProps) => (
  <>
    <StyledBox $isRed={isRed}>Hello from Benchmark!</StyledBox>
    <div>
      <StyledContainer>First</StyledContainer>
      <StyledContainer>Second</StyledContainer>
      <StyledContainer>Last</StyledContainer>
    </div>
  </>
);

export default YakComponent;
