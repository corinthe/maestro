import { describe, it, expect } from "vitest";
import { parseStreamLine } from "@/lib/claude/parser";

describe("parseStreamLine", () => {
  it("returns null for empty lines", () => {
    expect(parseStreamLine("")).toBeNull();
    expect(parseStreamLine("   ")).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(parseStreamLine("not json")).toBeNull();
    expect(parseStreamLine("{broken")).toBeNull();
  });

  it("returns null for JSON without type", () => {
    expect(parseStreamLine('{"foo":"bar"}')).toBeNull();
  });

  it("parses system init event", () => {
    const line = JSON.stringify({
      type: "system",
      subtype: "init",
      session_id: "sess-123",
      model: "sonnet",
    });
    const event = parseStreamLine(line);
    expect(event).not.toBeNull();
    expect(event!.type).toBe("system");
    expect(event!.subtype).toBe("init");
    expect(event!.sessionId).toBe("sess-123");
    expect(event!.model).toBe("sonnet");
  });

  it("parses assistant text event", () => {
    const line = JSON.stringify({
      type: "assistant",
      session_id: "sess-123",
      message: {
        content: [{ type: "text", text: "Hello world" }],
      },
    });
    const event = parseStreamLine(line);
    expect(event).not.toBeNull();
    expect(event!.type).toBe("assistant");
    expect(event!.subtype).toBe("text");
    expect(event!.text).toBe("Hello world");
    expect(event!.sessionId).toBe("sess-123");
  });

  it("parses assistant thinking event", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: {
        content: [{ type: "thinking", thinking: "Let me think..." }],
      },
    });
    const event = parseStreamLine(line);
    expect(event!.subtype).toBe("thinking");
    expect(event!.text).toBe("Let me think...");
  });

  it("parses assistant tool_use event", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: {
        content: [{ type: "tool_use", name: "read_file", input: { path: "/foo" } }],
      },
    });
    const event = parseStreamLine(line);
    expect(event!.subtype).toBe("tool_use");
    expect(event!.toolName).toBe("read_file");
    expect(event!.toolInput).toEqual({ path: "/foo" });
  });

  it("parses user tool_result event", () => {
    const line = JSON.stringify({
      type: "user",
      message: {
        content: [{ type: "tool_result", content: "file contents here", is_error: false }],
      },
    });
    const event = parseStreamLine(line);
    expect(event!.type).toBe("user");
    expect(event!.subtype).toBe("tool_result");
    expect(event!.toolResult).toBe("file contents here");
    expect(event!.isError).toBe(false);
  });

  it("parses result event with usage", () => {
    const line = JSON.stringify({
      type: "result",
      subtype: "success",
      session_id: "sess-123",
      result: "Task completed",
      total_cost_usd: 0.05,
      usage: {
        input_tokens: 1000,
        output_tokens: 500,
        cache_read_input_tokens: 200,
      },
    });
    const event = parseStreamLine(line);
    expect(event!.type).toBe("result");
    expect(event!.subtype).toBe("success");
    expect(event!.summary).toBe("Task completed");
    expect(event!.costUsd).toBe(0.05);
    expect(event!.inputTokens).toBe(1000);
    expect(event!.outputTokens).toBe(500);
    expect(event!.cachedTokens).toBe(200);
  });

  it("includes raw JSON in all events", () => {
    const line = '{"type":"system","subtype":"init"}';
    const event = parseStreamLine(line);
    expect(event!.raw).toBe(line);
  });

  it("handles unknown type gracefully", () => {
    const line = '{"type":"unknown_type"}';
    const event = parseStreamLine(line);
    expect(event).not.toBeNull();
    expect(event!.type).toBe("unknown_type");
  });
});
