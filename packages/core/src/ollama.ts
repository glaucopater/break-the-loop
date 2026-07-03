export type OllamaTagsStatus = {
  ok: boolean;
  models: string[];
  error?: string;
};

export type OllamaChatProbeStatus = {
  ok: boolean;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  sample?: string;
  error?: string;
};

export type OllamaStatus = {
  reachable: boolean;
  ready: boolean;
  baseUrl: string;
  configuredModel: string;
  configuredAgentModel: string;
  tags: OllamaTagsStatus;
  chat: OllamaChatProbeStatus;
  modelAvailable: boolean;
  agentModelAvailable: boolean;
};
