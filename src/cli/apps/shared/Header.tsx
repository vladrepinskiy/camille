import { Box, Text } from "ink";
import React from "react";

interface HeaderProps {
  step?: number;
  totalSteps?: number;
}

export const Header: React.FC<HeaderProps> = ({ step, totalSteps }) => {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="cyan">
        Camille Setup{step && totalSteps ? ` (${step}/${totalSteps})` : ""}
      </Text>
      <Text dimColor>─────────────────────</Text>
    </Box>
  );
};
