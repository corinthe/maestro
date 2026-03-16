import { spawn } from "node:child_process";
import type { LLMProvider, LLMMessage, LLMOptions, LLMResponse } from "../../domain/agent/llm-provider.js";
import { logger } from "../../shared/logger.js";

const DEFAULT_TIMEOUT = 300_000; // 5 minutes

export class ClaudeCliProvider implements LLMProvider {
  async chat(
    systemPrompt: string,
    messages: LLMMessage[],
    workingDir: string,
    options: LLMOptions = {}
  ): Promise<LLMResponse> {
    const timeout = options.timeout ?? DEFAULT_TIMEOUT;
    const streaming = !!options.onChunk;
    const userMessage = messages
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .join("\n\n");

    const args = [
      "--print",
      "--dangerously-skip-permissions",
      "--system-prompt", systemPrompt,
      ...(streaming ? ["--output-format", "stream-json", "--verbose"] : []),
      ...(options.maxTokens ? ["--max-tokens", String(options.maxTokens)] : []),
      userMessage,
    ];

    const startTime = Date.now();
    logger.info(
      { workingDir, promptSize: systemPrompt.length + userMessage.length, streaming },
      "Appel CLI Claude demarre"
    );

    return new Promise<LLMResponse>((resolve) => {
      const contentParts: string[] = [];
      const rawChunks: string[] = [];
      let stderr = "";
      let killed = false;
      let lineBuffer = "";
      let resultText: string | null = null;

      const child = spawn("claude", args, {
        cwd: workingDir,
        stdio: ["ignore", "pipe", "pipe"],
      });

      const timer = setTimeout(() => {
        killed = true;
        child.kill();
      }, timeout);

      child.stdout.on("data", (data: Buffer) => {
        const raw = data.toString();
        rawChunks.push(raw);

        if (!streaming) {
          contentParts.push(raw);
          return;
        }

        // En mode stream-json, chaque ligne est un objet JSON
        lineBuffer += raw;
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop() ?? "";

        for (const line of lines) {
          this.processStreamLine(line, contentParts, options.onChunk!, (text) => {
            resultText = text;
          });
        }
      });

      child.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      child.on("error", (error) => {
        clearTimeout(timer);
        const duration = Date.now() - startTime;
        const errorMessage = error.message.includes("ENOENT")
          ? "CLI Claude non trouvee. Verifiez que 'claude' est installe et dans le PATH"
          : `Erreur CLI Claude: ${error.message}`;

        logger.error({ duration, error: errorMessage }, "Appel CLI Claude echoue");
        resolve({ content: "", success: false, error: errorMessage });
      });

      child.on("close", (code) => {
        clearTimeout(timer);
        const duration = Date.now() - startTime;

        // Traiter la derniere ligne du buffer
        if (streaming && lineBuffer.trim()) {
          this.processStreamLine(lineBuffer, contentParts, options.onChunk!, (text) => {
            resultText = text;
          });
        }

        if (killed) {
          const errorMessage = `Timeout apres ${timeout}ms`;
          logger.error({ duration, error: errorMessage }, "Appel CLI Claude echoue");
          resolve({ content: "", success: false, error: errorMessage });
          return;
        }

        if (code !== 0) {
          const errorMessage = `Erreur CLI Claude: ${stderr || `code de sortie ${code}`}`;
          logger.error({ duration, error: errorMessage }, "Appel CLI Claude echoue");
          resolve({ content: "", success: false, error: errorMessage });
          return;
        }

        // Utiliser le resultat final si disponible, sinon les parties accumulees
        let content = (resultText ?? contentParts.join("")).trim();

        // Fallback : si le parsing stream-json n'a rien donne, extraire depuis le raw
        if (streaming && !content) {
          const rawOutput = rawChunks.join("");
          logger.debug({ rawOutputSize: rawOutput.length, rawOutputPreview: rawOutput.substring(0, 500) }, "Parsing stream-json n'a rien donne, tentative de fallback");
          content = this.extractContentFromRaw(rawOutput);
        }

        logger.info({ duration, responseSize: content.length }, "Appel CLI Claude termine");
        resolve({ content, success: true });
      });
    });
  }

  private extractContentFromRaw(raw: string): string {
    // Essayer de parser chaque ligne comme JSON et extraire le contenu
    const lines = raw.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const event = JSON.parse(trimmed);
        // Chercher le result
        if (event.type === "result" && typeof event.result === "string") {
          return event.result;
        }
        // Chercher le message assistant
        if (event.type === "assistant" && event.message?.content) {
          for (const block of event.message.content) {
            if (block.type === "text" && block.text) {
              return block.text;
            }
          }
        }
      } catch {
        // Ignorer
      }
    }
    // Dernier recours : retourner le raw tel quel (sans les lignes JSON system/rate_limit)
    return raw;
  }

  private processStreamLine(
    line: string,
    contentParts: string[],
    onChunk: (chunk: string) => void,
    onResult: (text: string) => void,
  ): void {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      const event = JSON.parse(trimmed);

      // Message assistant avec contenu textuel
      if (event.type === "assistant" && event.message?.content) {
        for (const block of event.message.content) {
          if (block.type === "text" && block.text) {
            contentParts.push(block.text);
            onChunk(block.text);
          }
        }
      }

      // Resultat final
      if (event.type === "result" && typeof event.result === "string") {
        onResult(event.result);
      }
    } catch {
      // Ligne non-JSON, ignorer
    }
  }
}
