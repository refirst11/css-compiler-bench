import styled, { css } from "styled-components";

const Base = styled.div<{ $isRed?: boolean }>`
  padding: 8px;
  font-size: 16px;
  color: blue;
  border-color: blue;
  border-style: solid;
  border-width: 1px;
  border-radius: 4px;
  ${({ $isRed }) =>
    $isRed &&
    css`
      color: red;
      border-color: red;
    `}
`;

const Container = styled.div`
  margin-bottom: 0.5rem;

  &:last-child {
    margin-bottom: 0;
  }

  @media screen and (min-width: 800px) {
    margin-bottom: 0.75rem;
  }
`;

type StyledComponentsComponentProps = {
  isRed?: boolean;
};

const StyledComponentsComponent = ({ isRed }: StyledComponentsComponentProps) => {
  return (
    <>
      <Base $isRed={isRed}>Hello from Benchmark!</Base>
      <div>
        <Container>First</Container>
        <Container>Second</Container>
        <Container>Last</Container>
      </div>
    </>
  );
};

export default StyledComponentsComponent;
