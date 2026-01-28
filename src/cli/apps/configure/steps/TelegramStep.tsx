import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import React, { useState } from "react";
import { Header } from "../../shared/Header";

interface TelegramStepProps {
  currentValue?: string;
  onSubmit: (token: string | undefined) => void;
  onBack: () => void;
  step: number;
  totalSteps: number;
}

export const TelegramStep: React.FC<TelegramStepProps> = ({
  currentValue,
  onSubmit,
  onBack,
  step,
  totalSteps,
}) => {
  const [value, setValue] = useState("");

  useInput((_input, key) => {
    if (key.escape) {
      onBack();
    }
  });

  const handleSubmit = (text: string) => {
    const token = text.trim();
    if (token) {
      onSubmit(token);
    } else {
      onSubmit(undefined); 
    }
  };

  return (
    <Box flexDirection="column">
      <Header step={step} totalSteps={totalSteps} />
      <Text>Telegram bot token (optional):</Text>
      <Text dimColor>Get a token from @BotFather on Telegram</Text>
      {currentValue && (
        <Text dimColor>A token is already configured. Press Enter to keep it.</Text>
      )}
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
        <Text dimColor>
          Press Enter to {currentValue ? "keep existing" : "skip"}, Escape to go back
        </Text>
      </Box>
    </Box>
  );
};
