import type { LLMProvider } from "@/core/config";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import React, { useState } from "react";
import { Header } from "../../shared/Header";

interface ApiKeyStepProps {
  provider: LLMProvider;
  hasExistingKey: boolean;
  onSubmit: (apiKey: string | undefined) => void;
  onBack: () => void;
  step: number;
  totalSteps: number;
}

export const ApiKeyStep: React.FC<ApiKeyStepProps> = ({
  provider,
  hasExistingKey,
  onSubmit,
  onBack,
  step,
  totalSteps,
}) => {
  const [value, setValue] = useState("");
  const isOllama = provider === "ollama";

  useInput((_input, key) => {
    if (key.escape) {
      onBack();
    }
  });

  const handleSubmit = (text: string) => {
    const key = text.trim();
    if (key) {
      onSubmit(key);
    } else if (isOllama || hasExistingKey) {
      onSubmit(undefined); // Skip or keep existing
    }
  };

  if (isOllama) {
    return (
      <Box flexDirection="column">
        <Header step={step} totalSteps={totalSteps} />
        <Text>API Key (optional for Ollama):</Text>
        <Text dimColor>Ollama typically runs locally without authentication.</Text>
        <Box marginTop={1}>
          <Text color="gray">{"> "}</Text>
          <TextInput
            value={value}
            onChange={setValue}
            onSubmit={handleSubmit}
            placeholder="Press Enter to skip"
          />
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Press Enter to skip, Escape to go back</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Header step={step} totalSteps={totalSteps} />
      <Text>Enter your {provider} API key:</Text>
      {hasExistingKey && (
        <Text dimColor>An API key is already configured. Press Enter to keep it.</Text>
      )}
      <Box marginTop={1}>
        <Text color="gray">{"> "}</Text>
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          mask="*"
        />
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          Press Enter to {hasExistingKey ? "keep existing" : "continue"}, Escape to go back
        </Text>
      </Box>
    </Box>
  );
};
