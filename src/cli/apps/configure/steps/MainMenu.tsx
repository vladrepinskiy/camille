import type { Config } from "@/core/config";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import React from "react";
import { Header } from "../../shared/Header";

export type EditTarget = "provider" | "model" | "apiKey" | "baseUrl" | "telegram";

interface MainMenuProps {
  config: Config;
  onEdit: (target: EditTarget) => void;
  onStartFresh: () => void;
  onExit: () => void;
}

const maskValue = (value?: string, maxLen = 20): string => {
  if (!value) return "(not set)";
  if (value.length > maxLen) {
    return value.slice(0, maxLen - 3) + "...";
  }

  return value;
};

export const MainMenu: React.FC<MainMenuProps> = ({
  config,
  onEdit,
  onStartFresh,
  onExit,
}) => {
  const items = [
    {
      label: `Edit LLM provider (${config.llm.provider})`,
      value: "provider" as const,
    },
    {
      label: `Edit model (${maskValue(config.llm.model)})`,
      value: "model" as const,
    },
    {
      label: `Edit API key (${config.llm.apiKey ? "configured" : "not set"})`,
      value: "apiKey" as const,
    },
    {
      label: `Edit base URL (${maskValue(config.llm.baseUrl) || "default"})`,
      value: "baseUrl" as const,
    },
    {
      label: `Edit Telegram (${config.telegram?.botToken ? "configured" : "not configured"})`,
      value: "telegram" as const,
    },
    { label: "──────────────", value: "separator" as const },
    { label: "Start fresh", value: "fresh" as const },
    { label: "Exit without changes", value: "exit" as const },
  ];

  const handleSelect = (item: { value: string }) => {
    switch (item.value) {
      case "separator":
        break;
      case "fresh":
        onStartFresh();
        break;
      case "exit":
        onExit();
        break;
      default:
        onEdit(item.value as EditTarget);
    }
  };

  return (
    <Box flexDirection="column">
      <Header />
      <Text>Current configuration detected. What would you like to do?</Text>
      <Box marginTop={1}>
        <SelectInput items={items} onSelect={handleSelect} />
      </Box>
    </Box>
  );
};
