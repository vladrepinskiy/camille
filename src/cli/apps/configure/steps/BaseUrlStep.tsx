import type { LLMProvider } from "@/core/config";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import React, { useState } from "react";
import { Header } from "../../shared/Header";

interface BaseUrlStepProps {
  provider: LLMProvider;
  currentValue?: string;
  onSubmit: (baseUrl: string | undefined) => void;
  onBack: () => void;
  step: number;
  totalSteps: number;
}

const defaultUrls: Record<LLMProvider, string | undefined> = {
  ollama: "http://localhost:11434",
  openai: undefined,
};

export const BaseUrlStep: React.FC<BaseUrlStepProps> = ({
  provider,
  currentValue,
  onSubmit,
  onBack,
  step,
  totalSteps,
}) => {
  const defaultUrl = defaultUrls[provider];
  const [value, setValue] = useState(currentValue || "");

  useInput((input, key) => {
    if (key.escape) {
      onBack();
    }
  });

  const handleSubmit = (text: string) => {
    const url = text.trim();
    if (url) {
      onSubmit(url);
    } else {
      onSubmit(undefined); 
    }
  };

  return (
    <Box flexDirection="column">
      <Header step={step} totalSteps={totalSteps} />
      <Text>Custom base URL (optional):</Text>
      {defaultUrl && (
        <Text dimColor>Default for {provider}: {defaultUrl}</Text>
      )}
      {currentValue && (
        <Text dimColor>Current: {currentValue}</Text>
      )}
      <Box marginTop={1}>
        <Text color="gray">{"> "}</Text>
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          placeholder="Press Enter to use default"
        />
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          Press Enter to {currentValue ? "keep" : "skip"}, Escape to go back
        </Text>
      </Box>
    </Box>
  );
};
