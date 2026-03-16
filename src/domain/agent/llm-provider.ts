export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

export type OnChunkCallback = (chunk: string) => void;

export interface LLMOptions {
  timeout?: number;
  maxTokens?: number;
  onChunk?: OnChunkCallback;
}

export interface LLMResponse {
  content: string;
  success: boolean;
  error?: string;
}

export interface LLMProvider {
  chat(
    systemPrompt: string,
    messages: LLMMessage[],
    workingDir: string,
    options?: LLMOptions
  ): Promise<LLMResponse>;
}
