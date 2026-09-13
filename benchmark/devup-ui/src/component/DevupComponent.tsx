import { Box } from "@devup-ui/react";

type DevupComponentProps = {
  isRed?: boolean;
};

const DevupComponent = ({ isRed }: DevupComponentProps) => {
  return (
    <>
      <Box
        p="8px"
        fontSize="16px"
        color={isRed ? "red" : "blue"}
        borderColor={isRed ? "red" : "blue"}
        borderStyle="solid"
        borderWidth="1px"
        borderRadius="4px"
      >
        Hello from Benchmark!
      </Box>
      <Box>
        <Box mb="0.5rem" _lastChild={{ mb: 0 }} _media={{ "screen and (min-width: 800px)": { mb: "0.75rem" } }}>
          First
        </Box>
        <Box mb="0.5rem" _lastChild={{ mb: 0 }} _media={{ "screen and (min-width: 800px)": { mb: "0.75rem" } }}>
          Second
        </Box>
        <Box mb="0.5rem" _lastChild={{ mb: 0 }} _media={{ "screen and (min-width: 800px)": { mb: "0.75rem" } }}>
          Last
        </Box>
      </Box>
    </>
  );
};

export default DevupComponent;
