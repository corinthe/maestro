import { describe, it, expect } from "vitest";
import { buildAgentPrompt } from "./build-agent-prompt.js";

describe("buildAgentPrompt", () => {
  const template = "Tu es un agent backend expert en TypeScript.";
  const soul = "Ce projet utilise Express et SQLite.";
  const shared = "Convention: nommage en camelCase.";

  it("doit construire le prompt complet avec toutes les sections", () => {
    const result = buildAgentPrompt(template, soul, shared);

    expect(result).toContain(template);
    expect(result).toContain("## Contexte du projet");
    expect(result).toContain(soul);
    expect(result).toContain("## Conventions partagees");
    expect(result).toContain(shared);
  });

  it("doit omettre la section SOUL si le contenu est vide", () => {
    const result = buildAgentPrompt(template, "", shared);

    expect(result).toContain(template);
    expect(result).not.toContain("## Contexte du projet");
    expect(result).toContain("## Conventions partagees");
    expect(result).toContain(shared);
  });

  it("doit omettre la section shared si le contenu est vide", () => {
    const result = buildAgentPrompt(template, soul, "");

    expect(result).toContain(template);
    expect(result).toContain("## Contexte du projet");
    expect(result).toContain(soul);
    expect(result).not.toContain("## Conventions partagees");
  });

  it("doit retourner uniquement le template si soul et shared sont vides", () => {
    const result = buildAgentPrompt(template, "", "");

    expect(result).toBe(template);
  });

  it("doit respecter l'ordre: template, soul, shared", () => {
    const result = buildAgentPrompt(template, soul, shared);

    const templateIndex = result.indexOf(template);
    const soulIndex = result.indexOf(soul);
    const sharedIndex = result.indexOf(shared);

    expect(templateIndex).toBeLessThan(soulIndex);
    expect(soulIndex).toBeLessThan(sharedIndex);
  });
});
