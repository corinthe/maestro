import { describe, it, expect } from "vitest";
import { AgentNotFoundError, AgentRegistryError } from "./errors.js";
import { MaestroError } from "../../shared/errors/base-error.js";

describe("AgentNotFoundError", () => {
  it("doit contenir le nom de l'agent dans le message", () => {
    const error = new AgentNotFoundError("backend");
    expect(error.message).toContain("backend");
    expect(error.code).toBe("AGENT_NOT_FOUND");
    expect(error.context).toEqual({ agentName: "backend" });
    expect(error.suggestion).toBeDefined();
  });

  it("doit etendre MaestroError", () => {
    const error = new AgentNotFoundError("frontend");
    expect(error).toBeInstanceOf(MaestroError);
    expect(error).toBeInstanceOf(Error);
  });
});

describe("AgentRegistryError", () => {
  it("doit contenir le message et le contexte fournis", () => {
    const error = new AgentRegistryError(
      "Dossier agents introuvable",
      { path: "/agents" },
      "Verifiez que le dossier existe"
    );
    expect(error.message).toBe("Dossier agents introuvable");
    expect(error.code).toBe("AGENT_REGISTRY_ERROR");
    expect(error.context).toEqual({ path: "/agents" });
    expect(error.suggestion).toBe("Verifiez que le dossier existe");
  });
});
