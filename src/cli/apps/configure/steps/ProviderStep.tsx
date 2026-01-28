import type { LLMProvider } from "@/core/config";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import React from "react";
import { Header } from "../../shared/Header";

interface ProviderStepProps {
  currentValue?: LLMProvider;
  onSelect: (provider: LLMProvider) => void;
  step: number;
  totalSteps: number;
}

const providers = [
  { label: "Ollama (local)", value: "ollama" as const },
  { label: "OpenAI", value: "openai" as const },
];

export const ProviderStep: React.FC<ProviderStepProps> = ({
  currentValue,
  onSelect,
  step,
  totalSteps,
}) => {
  const initialIndex = currentValue
    ? providers.findIndex((p) => p.value === currentValue)
    : 0;

  return (
    <Box flexDirection="column">
      <Header step={step} totalSteps={totalSteps} />
      <Text>Select your LLM provider:</Text>
      {currentValue && (
        <Text dimColor>Current: {currentValue}</Text>
      )}
      <Box marginTop={1}>
        <SelectInput
          items={providers}
          initialIndex={initialIndex >= 0 ? initialIndex : 0}
          onSelect={(item) => onSelect(item.value)}
        />
      </Box>
    </Box>
  );
};
