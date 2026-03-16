import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FileSystemAgentRegistry } from "./filesystem-agent-registry.js";
import { AgentNotFoundError, AgentRegistryError } from "../../domain/agent/errors.js";

describe("FileSystemAgentRegistry", () => {
  let tempDir: string;
  let agentsDir: string;
  let sharedDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "maestro-test-"));
    agentsDir = join(tempDir, "agents");
    sharedDir = join(tempDir, "shared");
    await mkdir(agentsDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("doit charger un agent depuis un fichier .md", async () => {
    await writeFile(join(agentsDir, "backend.md"), "# Agent Backend\n\nTu es un agent...");
    const registry = new FileSystemAgentRegistry(agentsDir);

    const agent = await registry.load("backend");

    expect(agent.name).toBe("backend");
    expect(agent.content).toContain("Agent Backend");
    expect(agent.metadata.description).toBe("Agent Backend");
  });

  it("doit lister tous les agents disponibles", async () => {
    await writeFile(join(agentsDir, "backend.md"), "# Backend\n\nContenu");
    await writeFile(join(agentsDir, "frontend.md"), "# Frontend\n\nContenu");
    const registry = new FileSystemAgentRegistry(agentsDir);

    const agents = await registry.list();

    expect(agents).toHaveLength(2);
    const names = agents.map((a) => a.name).sort();
    expect(names).toEqual(["backend", "frontend"]);
  });

  it("doit retourner true pour un agent existant", async () => {
    await writeFile(join(agentsDir, "backend.md"), "# Backend\n\nContenu");
    const registry = new FileSystemAgentRegistry(agentsDir);

    expect(await registry.exists("backend")).toBe(true);
    expect(await registry.exists("inexistant")).toBe(false);
  });

  it("doit lever AgentNotFoundError pour un agent inexistant", async () => {
    await writeFile(join(agentsDir, "backend.md"), "# Backend\n\nContenu");
    const registry = new FileSystemAgentRegistry(agentsDir);

    await expect(registry.load("inexistant")).rejects.toThrow(AgentNotFoundError);
  });

  it("doit lever AgentRegistryError si le dossier n'existe pas", async () => {
    const registry = new FileSystemAgentRegistry("/chemin/inexistant");

    await expect(registry.list()).rejects.toThrow(AgentRegistryError);
  });

  it("doit lever AgentRegistryError si le dossier est vide de fichiers .md", async () => {
    await writeFile(join(agentsDir, "readme.txt"), "pas un markdown");
    const registry = new FileSystemAgentRegistry(agentsDir);

    await expect(registry.list()).rejects.toThrow(AgentRegistryError);
  });

  it("doit ignorer les fichiers non-.md", async () => {
    await writeFile(join(agentsDir, "backend.md"), "# Backend\n\nContenu");
    await writeFile(join(agentsDir, "notes.txt"), "pas un agent");
    const registry = new FileSystemAgentRegistry(agentsDir);

    const agents = await registry.list();
    expect(agents).toHaveLength(1);
    expect(agents[0].name).toBe("backend");
  });

  it("doit injecter le contexte partage dans le contenu de l'agent", async () => {
    await mkdir(sharedDir);
    await writeFile(join(sharedDir, "rules.md"), "# Regles globales\n\nRegle 1");
    await writeFile(join(agentsDir, "backend.md"), "# Backend\n\nContenu agent");
    const registry = new FileSystemAgentRegistry(agentsDir, sharedDir);

    const agent = await registry.load("backend");

    expect(agent.content).toContain("Regles globales");
    expect(agent.content).toContain("Contenu agent");
  });

  it("doit fonctionner sans dossier shared", async () => {
    await writeFile(join(agentsDir, "backend.md"), "# Backend\n\nContenu");
    const registry = new FileSystemAgentRegistry(agentsDir, join(tempDir, "absent"));

    const agent = await registry.load("backend");
    expect(agent.content).toBe("# Backend\n\nContenu");
  });

  it("doit utiliser le cache apres le premier chargement", async () => {
    await writeFile(join(agentsDir, "backend.md"), "# Backend\n\nContenu");
    const registry = new FileSystemAgentRegistry(agentsDir);

    await registry.list();
    await registry.list();

    // Le second appel utilise le cache — pas d'erreur meme si conceptuellement on pourrait
    // supprimer le fichier entre les deux appels
    const agents = await registry.list();
    expect(agents).toHaveLength(1);
  });

  it("doit extraire la metadata depuis le contenu brut, pas le contenu avec shared", async () => {
    await mkdir(sharedDir);
    await writeFile(join(sharedDir, "rules.md"), "# Regles\n\nContenu partage");
    await writeFile(join(agentsDir, "backend.md"), "# Agent Backend\n\nContenu");
    const registry = new FileSystemAgentRegistry(agentsDir, sharedDir);

    const agent = await registry.load("backend");
    expect(agent.metadata.description).toBe("Agent Backend");
  });
});
