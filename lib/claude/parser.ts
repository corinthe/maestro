/**
 * Parses Claude CLI stream-json output line by line.
 *
 * Claude CLI with --output-format stream-json emits one JSON object per line:
 * - { type: "system", subtype: "init", session_id, model }
 * - { type: "assistant", message: { content: [...] }, session_id }
 * - { type: "user", message: { content: [...] } }           (tool results)
 * - { type: "result", subtype: "success"|"error_max_turns", result, session_id, usage, total_cost_usd }
 */

export type StreamEvent = {
  type: "system" | "assistant" | "user" | "result";
  subtype?: string;
  sessionId?: string;
  model?: string;
  text?: string;
  toolName?: string;
  toolInput?: unknown;
  toolResult?: string;
  isError?: boolean;
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  summary?: string;
  raw: string;
};

import { createLogger } from "@/lib/logger";

const log = createLogger("parser");

export function parseStreamLine(line: string): StreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let json: Record<string, unknown>;
  try {
    json = JSON.parse(trimmed);
  } catch {
    log.warn("invalid JSON in stream", { line: trimmed.slice(0, 200) });
    return null;
  }

  const type = json.type as string;
  if (!type) return null;

  const base: StreamEvent = { type: type as StreamEvent["type"], raw: trimmed };

  switch (type) {
    case "system": {
      base.subtype = json.subtype as string;
      base.sessionId = json.session_id as string;
      base.model = json.model as string;
      return base;
    }

    case "assistant": {
      base.sessionId = json.session_id as string;
      const message = json.message as { content?: Array<Record<string, unknown>> } | undefined;
      if (message?.content) {
        for (const block of message.content) {
          if (block.type === "text") {
            base.subtype = "text";
            base.text = block.text as string;
          } else if (block.type === "thinking") {
            base.subtype = "thinking";
            base.text = block.thinking as string;
          } else if (block.type === "tool_use") {
            base.subtype = "tool_use";
            base.toolName = block.name as string;
            base.toolInput = block.input;
          }
        }
      }
      return base;
    }

    case "user": {
      const message = json.message as { content?: Array<Record<string, unknown>> } | undefined;
      if (message?.content) {
        for (const block of message.content) {
          if (block.type === "tool_result") {
            base.subtype = "tool_result";
            base.toolResult = typeof block.content === "string"
              ? block.content
              : JSON.stringify(block.content);
            base.isError = block.is_error as boolean;
          }
        }
      }
      return base;
    }

    case "result": {
      base.subtype = json.subtype as string;
      base.sessionId = json.session_id as string;
      base.summary = json.result as string;
      base.costUsd = json.total_cost_usd as number;
      const usage = json.usage as Record<string, number> | undefined;
      if (usage) {
        base.inputTokens = usage.input_tokens;
        base.outputTokens = usage.output_tokens;
        base.cachedTokens = usage.cache_read_input_tokens;
      }
      return base;
    }

    default:
      return base;
  }
}
