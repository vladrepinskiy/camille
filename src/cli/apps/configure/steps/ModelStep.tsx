import type { LLMProvider } from "@/core/config";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import React, { useState } from "react";
import { Header } from "../../shared/Header";

interface ModelStepProps {
  provider: LLMProvider;
  currentValue?: string;
  onSubmit: (model: string) => void;
  onBack: () => void;
  step: number;
  totalSteps: number;
}

const modelSuggestions: Record<LLMProvider, string> = {
  ollama: "llama3.2",
  openai: "gpt-4o",
};

export const ModelStep: React.FC<ModelStepProps> = ({
  provider,
  currentValue,
  onSubmit,
  onBack,
  step,
  totalSteps,
}) => {
  const suggestion = modelSuggestions[provider];
  const [value, setValue] = useState(currentValue || suggestion || "");

  useInput((input, key) => {
    if (key.escape) {
      onBack();
    }
  });

  const handleSubmit = (text: string) => {
    const model = text.trim() || suggestion;
    if (model) {
      onSubmit(model);
    }
  };

  return (
    <Box flexDirection="column">
      <Header step={step} totalSteps={totalSteps} />
      <Text>Enter the model name:</Text>
      <Text dimColor>Suggested for {provider}: {suggestion}</Text>
      {currentValue && currentValue !== suggestion && (
        <Text dimColor>Current: {currentValue}</Text>
      )}
      <Box marginTop={1}>
        <Text color="gray">{"> "}</Text>
        <TextInput value={value} onChange={setValue} onSubmit={handleSubmit} />
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Press Enter to confirm, Escape to go back</Text>
      </Box>
    </Box>
  );
};
