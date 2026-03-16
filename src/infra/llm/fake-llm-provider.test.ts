import { describe, it, expect } from "vitest";
import { FakeLLMProvider } from "./fake-llm-provider.js";

describe("FakeLLMProvider", () => {
  it("doit retourner une reponse basee sur le pattern matching", async () => {
    const provider = new FakeLLMProvider({
      "analyse": { content: "Plan genere", success: true },
      "code": { content: "Code ecrit", success: true },
    });

    const result = await provider.chat(
      "system",
      [{ role: "user", content: "analyse ce projet" }],
      "/tmp"
    );

    expect(result.content).toBe("Plan genere");
    expect(result.success).toBe(true);
  });

  it("doit retourner une reponse par defaut si aucun pattern ne correspond", async () => {
    const provider = new FakeLLMProvider({
      "analyse": { content: "Plan" },
    });

    const result = await provider.chat(
      "system",
      [{ role: "user", content: "aucun match" }],
      "/tmp"
    );

    expect(result.content).toContain("defaut");
    expect(result.success).toBe(true);
  });

  it("doit pouvoir simuler un echec", async () => {
    const provider = new FakeLLMProvider({
      "fail": { content: "", success: false, error: "Timeout simule" },
    });

    const result = await provider.chat(
      "system",
      [{ role: "user", content: "fail" }],
      "/tmp"
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("Timeout simule");
  });

  it("doit accepter une fonction de resolution", async () => {
    const provider = new FakeLLMProvider((_system, messages) => ({
      content: `Echo: ${messages[0].content}`,
    }));

    const result = await provider.chat(
      "system",
      [{ role: "user", content: "hello" }],
      "/tmp"
    );

    expect(result.content).toBe("Echo: hello");
  });

  it("doit enregistrer tous les appels", async () => {
    const provider = new FakeLLMProvider({ "": { content: "ok" } });

    await provider.chat("system1", [{ role: "user", content: "msg1" }], "/tmp/a");
    await provider.chat("system2", [{ role: "user", content: "msg2" }], "/tmp/b");

    expect(provider.getCallCount()).toBe(2);
    const calls = provider.getCalls();
    expect(calls[0].systemPrompt).toBe("system1");
    expect(calls[1].workingDir).toBe("/tmp/b");
  });

  it("doit pouvoir reset les appels enregistres", async () => {
    const provider = new FakeLLMProvider({ "": { content: "ok" } });

    await provider.chat("s", [{ role: "user", content: "m" }], "/tmp");
    expect(provider.getCallCount()).toBe(1);

    provider.reset();
    expect(provider.getCallCount()).toBe(0);
  });

  it("doit passer les options au resolver", async () => {
    const provider = new FakeLLMProvider({ "": { content: "ok" } });

    await provider.chat(
      "s",
      [{ role: "user", content: "m" }],
      "/tmp",
      { timeout: 5000, maxTokens: 1024 }
    );

    const calls = provider.getCalls();
    expect(calls[0].options).toEqual({ timeout: 5000, maxTokens: 1024 });
  });
});
