import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClaudeCliProvider } from "./claude-cli-provider.js";
import * as childProcess from "node:child_process";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

function createMockChild() {
  const child = new EventEmitter() as any;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = vi.fn();
  return child;
}

describe("ClaudeCliProvider", () => {
  let provider: ClaudeCliProvider;
  const mockSpawn = vi.mocked(childProcess.spawn);

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new ClaudeCliProvider();
  });

  it("doit appeler la CLI claude avec --print sans streaming par defaut", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);

    const promise = provider.chat(
      "Tu es un agent",
      [{ role: "user", content: "Analyse ce code" }],
      "/tmp/project"
    );

    setImmediate(() => {
      child.stdout.write("Reponse de Claude");
      child.stdout.end();
      child.emit("close", 0);
    });

    const result = await promise;

    expect(result.success).toBe(true);
    expect(result.content).toBe("Reponse de Claude");
    const args = mockSpawn.mock.calls[0][1] as string[];
    expect(args).toContain("--print");
    expect(args).not.toContain("--output-format");
  });

  it("doit gerer les erreurs de la CLI", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);

    const promise = provider.chat(
      "prompt",
      [{ role: "user", content: "test" }],
      "/tmp"
    );

    setImmediate(() => {
      const error = new Error("spawn claude ENOENT");
      child.emit("error", error);
    });

    const result = await promise;

    expect(result.success).toBe(false);
    expect(result.error).toContain("CLI Claude non trouvee");
  });

  it("doit gerer les timeouts", async () => {
    vi.useFakeTimers();
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);

    const promise = provider.chat(
      "prompt",
      [{ role: "user", content: "test" }],
      "/tmp",
      { timeout: 5000 }
    );

    vi.advanceTimersByTime(5001);

    setImmediate(() => {
      child.emit("close", null);
    });
    vi.advanceTimersByTime(1);

    const result = await promise;

    expect(result.success).toBe(false);
    expect(result.error).toContain("Timeout");
    expect(child.kill).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("doit passer maxTokens en argument si fourni", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);

    const promise = provider.chat(
      "prompt",
      [{ role: "user", content: "test" }],
      "/tmp",
      { maxTokens: 4096 }
    );

    setImmediate(() => {
      child.stdout.write("ok");
      child.stdout.end();
      child.emit("close", 0);
    });

    await promise;

    expect(mockSpawn).toHaveBeenCalledWith(
      "claude",
      expect.arrayContaining(["--max-tokens", "4096"]),
      expect.any(Object)
    );
  });

  it("doit combiner les messages user en un seul prompt", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);

    const promise = provider.chat(
      "system",
      [
        { role: "user", content: "Partie 1" },
        { role: "assistant", content: "ignoré" },
        { role: "user", content: "Partie 2" },
      ],
      "/tmp"
    );

    setImmediate(() => {
      child.stdout.write("ok");
      child.stdout.end();
      child.emit("close", 0);
    });

    await promise;

    expect(mockSpawn).toHaveBeenCalledWith(
      "claude",
      expect.arrayContaining(["Partie 1\n\nPartie 2"]),
      expect.any(Object)
    );
  });

  it("doit utiliser --output-format stream-json --verbose et parser les messages assistant", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);
    const chunks: string[] = [];

    const promise = provider.chat(
      "system",
      [{ role: "user", content: "test" }],
      "/tmp",
      { onChunk: (chunk) => chunks.push(chunk) }
    );

    setImmediate(() => {
      // Format reel de la CLI Claude
      child.stdout.write('{"type":"system","subtype":"init","session_id":"abc"}\n');
      child.stdout.write('{"type":"assistant","message":{"content":[{"type":"text","text":"Hello World"}]}}\n');
      child.stdout.write('{"type":"result","subtype":"success","result":"Hello World"}\n');
      child.stdout.end();
      child.emit("close", 0);
    });

    const result = await promise;

    expect(result.success).toBe(true);
    expect(result.content).toBe("Hello World");
    expect(chunks).toEqual(["Hello World"]);

    const args = mockSpawn.mock.calls[0][1] as string[];
    expect(args).toContain("--output-format");
    expect(args).toContain("stream-json");
    expect(args).toContain("--verbose");
  });

  it("doit utiliser le result final si aucun message assistant recu", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);

    const promise = provider.chat(
      "system",
      [{ role: "user", content: "test" }],
      "/tmp",
      { onChunk: () => {} }
    );

    setImmediate(() => {
      child.stdout.write('{"type":"result","subtype":"success","result":"Fallback"}\n');
      child.stdout.end();
      child.emit("close", 0);
    });

    const result = await promise;

    expect(result.success).toBe(true);
    expect(result.content).toBe("Fallback");
  });

  it("doit gerer un code de sortie non-zero", async () => {
    const child = createMockChild();
    mockSpawn.mockReturnValue(child as any);

    const promise = provider.chat(
      "prompt",
      [{ role: "user", content: "test" }],
      "/tmp"
    );

    setImmediate(() => {
      child.stderr.write("something went wrong");
      child.stderr.end();
      child.emit("close", 1);
    });

    const result = await promise;

    expect(result.success).toBe(false);
    expect(result.error).toContain("something went wrong");
  });
});
