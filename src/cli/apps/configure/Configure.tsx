import type { LLMProvider } from "@/core/config";
import { DEFAULT_CONFIG, loadConfig, writeConfig, type Config } from "@/core/config";
import { paths } from "@/utils/paths.util";
import { existsSync } from "fs";
import { Box, render, Text, useApp } from "ink";
import React, { useEffect, useState } from "react";
import { ApiKeyStep } from "./steps/ApiKeyStep";
import { BaseUrlStep } from "./steps/BaseUrlStep";
import { MainMenu, type EditTarget } from "./steps/MainMenu";
import { ModelStep } from "./steps/ModelStep";
import { ProviderStep } from "./steps/ProviderStep";
import { SummaryStep } from "./steps/SummaryStep";
import { TelegramStep } from "./steps/TelegramStep";

type Step = "menu" | "provider" | "model" | "apiKey" | "baseUrl" | "telegram" | "summary";

const TOTAL_STEPS = 5;

const Configure: React.FC = () => {
  const { exit } = useApp();

  const [step, setStep] = useState<Step>("menu");
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [hasExistingConfig, setHasExistingConfig] = useState(false);
  const [existingApiKey, setExistingApiKey] = useState<string | undefined>();
  const [existingTelegramToken, setExistingTelegramToken] = useState<string | undefined>();
  const [message, setMessage] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    const configExists = existsSync(paths.config());
    setHasExistingConfig(configExists);

    if (configExists) {
      const existing = loadConfig();
      setConfig(existing);
      setExistingApiKey(existing.llm.apiKey);
      setExistingTelegramToken(existing.telegram?.botToken);
    } else {
      // No config exists, go straight to wizard
      setStep("provider");
    }
  }, []);

  const getStepNumber = (): number => {
    switch (step) {
      case "provider":
        return 1;
      case "model":
        return 2;
      case "apiKey":
        return 3;
      case "baseUrl":
        return 4;
      case "telegram":
        return 5;
      default:
        return 0;
    }
  };

  const handleEdit = (target: EditTarget) => {
    setStep(target);
  };

  const handleStartFresh = () => {
    setConfig(DEFAULT_CONFIG);
    setExistingApiKey(undefined);
    setExistingTelegramToken(undefined);
    setStep("provider");
  };

  const handleExit = () => {
    exit();
  };

  const handleProviderSelect = (provider: LLMProvider) => {
    setConfig((c) => ({
      ...c,
      llm: { ...c.llm, provider },
    }));
    setStep("model");
  };

  const handleModelSubmit = (model: string) => {
    setConfig((c) => ({
      ...c,
      llm: { ...c.llm, model },
    }));
    setStep("apiKey");
  };

  const handleApiKeySubmit = (apiKey: string | undefined) => {
    setConfig((c) => ({
      ...c,
      llm: {
        ...c.llm,
        apiKey: apiKey || existingApiKey,
      },
    }));
    setStep("baseUrl");
  };

  const handleBaseUrlSubmit = (baseUrl: string | undefined) => {
    setConfig((c) => ({
      ...c,
      llm: {
        ...c.llm,
        baseUrl,
      },
    }));
    setStep("telegram");
  };

  const handleTelegramSubmit = (token: string | undefined) => {
    const botToken = token || existingTelegramToken;
    setConfig((c) => ({
      ...c,
      telegram: botToken ? { botToken } : undefined,
    }));
    setStep("summary");
  };

  const handleSave = () => {
    try {
      writeConfig(config);
      setMessage(`Configuration saved to ${paths.config()}`);
      setIsDone(true);
      setTimeout(() => exit(), 1500);
    } catch (err) {
      setMessage(`Error saving config: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleSummaryBack = () => {
    setStep("telegram");
  };

  const handleCancel = () => {
    exit();
  };

  const handleBack = (fromStep: Step) => {
    switch (fromStep) {
      case "model":
        setStep("provider");
        break;
      case "apiKey":
        setStep("model");
        break;
      case "baseUrl":
        setStep("apiKey");
        break;
      case "telegram":
        setStep("baseUrl");
        break;
      default:
        if (hasExistingConfig) {
          setStep("menu");
        }
    }
  };

  if (isDone) {
    return (
      <Box flexDirection="column">
        <Text color="green">{message}</Text>
      </Box>
    );
  }

  if (message) {
    return (
      <Box flexDirection="column">
        <Text color="red">{message}</Text>
      </Box>
    );
  }

  switch (step) {
    case "menu":
      return (
        <MainMenu
          config={config}
          onEdit={handleEdit}
          onStartFresh={handleStartFresh}
          onExit={handleExit}
        />
      );

    case "provider":
      return (
        <ProviderStep
          currentValue={config.llm.provider}
          onSelect={handleProviderSelect}
          step={getStepNumber()}
          totalSteps={TOTAL_STEPS}
        />
      );

    case "model":
      return (
        <ModelStep
          provider={config.llm.provider}
          currentValue={config.llm.model}
          onSubmit={handleModelSubmit}
          onBack={() => handleBack("model")}
          step={getStepNumber()}
          totalSteps={TOTAL_STEPS}
        />
      );

    case "apiKey":
      return (
        <ApiKeyStep
          provider={config.llm.provider}
          hasExistingKey={!!existingApiKey}
          onSubmit={handleApiKeySubmit}
          onBack={() => handleBack("apiKey")}
          step={getStepNumber()}
          totalSteps={TOTAL_STEPS}
        />
      );

    case "baseUrl":
      return (
        <BaseUrlStep
          provider={config.llm.provider}
          currentValue={config.llm.baseUrl}
          onSubmit={handleBaseUrlSubmit}
          onBack={() => handleBack("baseUrl")}
          step={getStepNumber()}
          totalSteps={TOTAL_STEPS}
        />
      );

    case "telegram":
      return (
        <TelegramStep
          currentValue={existingTelegramToken}
          onSubmit={handleTelegramSubmit}
          onBack={() => handleBack("telegram")}
          step={getStepNumber()}
          totalSteps={TOTAL_STEPS}
        />
      );

    case "summary":
      return (
        <SummaryStep
          config={config}
          onSave={handleSave}
          onBack={handleSummaryBack}
          onCancel={handleCancel}
        />
      );

    default:
      return <Text>Loading...</Text>;
  }
};

export const runConfigure = () => {
  render(<Configure />);
};
