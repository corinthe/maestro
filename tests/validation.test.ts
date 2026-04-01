import { describe, it, expect } from "vitest";
import {
  validateAgentCreate,
  validateAgentUpdate,
  validateFeatureCreate,
  validateFeatureUpdate,
  validateRunStart,
  validateMessageCreate,
  validateHeartbeatConfig,
} from "@/lib/validation";

describe("validateAgentCreate", () => {
  it("accepts valid input", () => {
    expect(validateAgentCreate({ name: "agent-1" })).toEqual({ ok: true });
    expect(validateAgentCreate({ name: "agent-1", description: "desc", config: { model: "sonnet" } })).toEqual({ ok: true });
  });

  it("rejects missing name", () => {
    const r = validateAgentCreate({});
    expect(r.ok).toBe(false);
  });

  it("rejects empty name", () => {
    const r = validateAgentCreate({ name: "   " });
    expect(r.ok).toBe(false);
  });

  it("rejects overly long name", () => {
    const r = validateAgentCreate({ name: "a".repeat(101) });
    expect(r.ok).toBe(false);
  });

  it("rejects non-object config", () => {
    expect(validateAgentCreate({ name: "a", config: "string" }).ok).toBe(false);
    expect(validateAgentCreate({ name: "a", config: [1, 2] }).ok).toBe(false);
    expect(validateAgentCreate({ name: "a", config: null }).ok).toBe(false);
  });
});

describe("validateAgentUpdate", () => {
  it("accepts empty update", () => {
    expect(validateAgentUpdate({}).ok).toBe(true);
  });

  it("rejects invalid status", () => {
    expect(validateAgentUpdate({ status: "invalid" }).ok).toBe(false);
  });

  it("accepts valid status", () => {
    expect(validateAgentUpdate({ status: "idle" }).ok).toBe(true);
    expect(validateAgentUpdate({ status: "running" }).ok).toBe(true);
  });
});

describe("validateFeatureCreate", () => {
  it("accepts valid input", () => {
    expect(validateFeatureCreate({ title: "My Feature" }).ok).toBe(true);
  });

  it("rejects missing title", () => {
    expect(validateFeatureCreate({}).ok).toBe(false);
  });

  it("rejects non-integer priority", () => {
    expect(validateFeatureCreate({ title: "F", priority: 1.5 }).ok).toBe(false);
  });

  it("accepts integer priority", () => {
    expect(validateFeatureCreate({ title: "F", priority: 5 }).ok).toBe(true);
  });
});

describe("validateFeatureUpdate", () => {
  it("rejects invalid status", () => {
    expect(validateFeatureUpdate({ status: "bogus" }).ok).toBe(false);
  });

  it("accepts valid statuses", () => {
    for (const s of ["backlog", "in_progress", "done", "cancelled"]) {
      expect(validateFeatureUpdate({ status: s }).ok).toBe(true);
    }
  });
});

describe("validateRunStart", () => {
  it("accepts valid input", () => {
    expect(validateRunStart({ agentId: "abc", prompt: "do thing" }).ok).toBe(true);
  });

  it("rejects missing agentId", () => {
    expect(validateRunStart({ prompt: "do thing" }).ok).toBe(false);
  });

  it("rejects missing prompt", () => {
    expect(validateRunStart({ agentId: "abc" }).ok).toBe(false);
  });

  it("rejects overly long prompt", () => {
    expect(validateRunStart({ agentId: "abc", prompt: "x".repeat(50001) }).ok).toBe(false);
  });
});

describe("validateMessageCreate", () => {
  it("accepts valid input", () => {
    expect(validateMessageCreate({ content: "hello" }).ok).toBe(true);
  });

  it("rejects missing content", () => {
    expect(validateMessageCreate({}).ok).toBe(false);
  });

  it("rejects non-string targetAgent", () => {
    expect(validateMessageCreate({ content: "hi", targetAgent: 123 }).ok).toBe(false);
  });
});

describe("validateHeartbeatConfig", () => {
  it("accepts empty object", () => {
    expect(validateHeartbeatConfig({}).ok).toBe(true);
  });

  it("accepts valid config", () => {
    expect(validateHeartbeatConfig({ enabled: true, intervalSec: 60 }).ok).toBe(true);
  });

  it("rejects non-boolean enabled", () => {
    expect(validateHeartbeatConfig({ enabled: "yes" }).ok).toBe(false);
  });

  it("rejects intervalSec out of range", () => {
    expect(validateHeartbeatConfig({ intervalSec: 5 }).ok).toBe(false);
    expect(validateHeartbeatConfig({ intervalSec: 100000 }).ok).toBe(false);
  });

  it("rejects non-integer intervalSec", () => {
    expect(validateHeartbeatConfig({ intervalSec: 60.5 }).ok).toBe(false);
  });
});
