import type { Config } from "@/core/config";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import React from "react";
import { Header } from "../../shared/Header";

interface SummaryStepProps {
  config: Config;
  onSave: () => void;
  onBack: () => void;
  onCancel: () => void;
}

const maskApiKey = (key?: string): string => {
  if (!key) return "(not set)";
  if (key.length <= 8) return "••••••••";

  return key.slice(0, 4) + "••••" + key.slice(-4);
};

export const SummaryStep: React.FC<SummaryStepProps> = ({
  config,
  onSave,
  onBack,
  onCancel,
}) => {
  const items = [
    { label: "Save configuration", value: "save" },
    { label: "Go back", value: "back" },
    { label: "Cancel", value: "cancel" },
  ];

  const handleSelect = (item: { value: string }) => {
    switch (item.value) {
      case "save":
        onSave();
        break;
      case "back":
        onBack();
        break;
      case "cancel":
        onCancel();
        break;
    }
  };

  return (
    <Box flexDirection="column">
      <Header />
      <Text bold>Configuration Summary</Text>

      <Box flexDirection="column" marginLeft={2} marginTop={1} marginBottom={1}>
        <Text>
          <Text dimColor>Provider: </Text>
          <Text>{config.llm.provider}</Text>
        </Text>
        <Text>
          <Text dimColor>Model: </Text>
          <Text>{config.llm.model}</Text>
        </Text>
        <Text>
          <Text dimColor>API Key: </Text>
          <Text>{maskApiKey(config.llm.apiKey)}</Text>
        </Text>
        <Text>
          <Text dimColor>Base URL: </Text>
          <Text>{config.llm.baseUrl || "(default)"}</Text>
        </Text>
        <Text>
          <Text dimColor>Telegram: </Text>
          <Text>{config.telegram?.botToken ? "configured" : "(not configured)"}</Text>
        </Text>
      </Box>

      <SelectInput items={items} onSelect={handleSelect} />
    </Box>
  );
};
