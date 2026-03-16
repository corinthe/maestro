import type { LLMProvider, LLMMessage, LLMOptions, LLMResponse } from "../../domain/agent/llm-provider.js";

export interface FakeResponse {
  content: string;
  success?: boolean;
  error?: string;
}

type ResponseResolver = (systemPrompt: string, messages: LLMMessage[]) => FakeResponse;

export class FakeLLMProvider implements LLMProvider {
  private calls: Array<{ systemPrompt: string; messages: LLMMessage[]; workingDir: string; options?: LLMOptions }> = [];
  private resolver: ResponseResolver;

  constructor(responsesOrFn: Record<string, FakeResponse> | ResponseResolver) {
    if (typeof responsesOrFn === "function") {
      this.resolver = responsesOrFn;
    } else {
      const responses = responsesOrFn;
      this.resolver = (systemPrompt, messages) => {
        const userMessage = messages
          .filter((m) => m.role === "user")
          .map((m) => m.content)
          .join(" ");
        const searchText = `${systemPrompt} ${userMessage}`;

        for (const [pattern, response] of Object.entries(responses)) {
          if (searchText.includes(pattern)) {
            return response;
          }
        }

        return { content: "Reponse par defaut du FakeLLMProvider", success: true };
      };
    }
  }

  async chat(
    systemPrompt: string,
    messages: LLMMessage[],
    workingDir: string,
    options?: LLMOptions
  ): Promise<LLMResponse> {
    this.calls.push({ systemPrompt, messages, workingDir, options });
    const response = this.resolver(systemPrompt, messages);

    if (options?.onChunk && (response.success ?? true)) {
      options.onChunk(response.content);
    }

    return {
      content: response.content,
      success: response.success ?? true,
      error: response.error,
    };
  }

  getCalls(): typeof this.calls {
    return [...this.calls];
  }

  getCallCount(): number {
    return this.calls.length;
  }

  reset(): void {
    this.calls = [];
  }
}
