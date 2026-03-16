import { describe, it, expect } from "vitest";
import { extractMetadata } from "./agent-template.js";

describe("extractMetadata", () => {
  it("doit extraire la description depuis un titre markdown", () => {
    const content = "# Agent Backend\n\nTu es un agent specialise...";
    const metadata = extractMetadata(content);
    expect(metadata.description).toBe("Agent Backend");
  });

  it("doit extraire la description depuis un titre h2", () => {
    const content = "## Orchestrateur\n\nAnalyse la tache...";
    const metadata = extractMetadata(content);
    expect(metadata.description).toBe("Orchestrateur");
  });

  it("doit utiliser la premiere ligne non vide si pas de titre markdown", () => {
    const content = "Agent simple sans titre markdown";
    const metadata = extractMetadata(content);
    expect(metadata.description).toBe("Agent simple sans titre markdown");
  });

  it("doit ignorer les lignes vides en debut de fichier", () => {
    const content = "\n\n# Agent Frontend\n\nContenu...";
    const metadata = extractMetadata(content);
    expect(metadata.description).toBe("Agent Frontend");
  });

  it("doit retourner une description vide pour un contenu vide", () => {
    const metadata = extractMetadata("");
    expect(metadata.description).toBe("");
  });
});
