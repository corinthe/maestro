import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FileSystemProjectLoader } from "./filesystem-project-loader.js";

describe("FileSystemProjectLoader", () => {
  let loader: FileSystemProjectLoader;
  let tempDir: string;

  beforeEach(async () => {
    loader = new FileSystemProjectLoader();
    tempDir = await mkdtemp(join(tmpdir(), "maestro-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("loadConfig", () => {
    it("doit retourner la config par defaut si pas de fichier", async () => {
      const config = await loader.loadConfig(tempDir);

      expect(config.workingDir).toBe(tempDir);
      expect(config.defaultBranch).toBe("main");
      expect(config.orchestratorAgent).toBe("orchestrator");
      expect(config.maxRetries).toBe(2);
      expect(config.timeout).toBe(300);
    });

    it("doit charger la config depuis maestro.config.json", async () => {
      await writeFile(
        join(tempDir, "maestro.config.json"),
        JSON.stringify({
          defaultBranch: "develop",
          agents: ["backend", "frontend"],
          maxRetries: 3,
        })
      );

      const config = await loader.loadConfig(tempDir);

      expect(config.defaultBranch).toBe("develop");
      expect(config.agents).toEqual(["backend", "frontend"]);
      expect(config.maxRetries).toBe(3);
      expect(config.workingDir).toBe(tempDir);
    });

    it("doit lever une erreur si le JSON est mal forme", async () => {
      await writeFile(join(tempDir, "maestro.config.json"), "{ invalid json }");

      await expect(loader.loadConfig(tempDir)).rejects.toThrow("JSON mal forme");
    });
  });

  describe("loadSoul", () => {
    it("doit retourner une chaine vide si pas de SOUL.md", async () => {
      const soul = await loader.loadSoul(tempDir);
      expect(soul).toBe("");
    });

    it("doit charger le contenu du SOUL.md", async () => {
      const content = "# Mon Projet\n\nConventions: TDD, TypeScript strict.";
      await writeFile(join(tempDir, "SOUL.md"), content);

      const soul = await loader.loadSoul(tempDir);
      expect(soul).toBe(content);
    });
  });

  describe("loadContext", () => {
    it("doit combiner config, soul et shared context", async () => {
      await writeFile(join(tempDir, "SOUL.md"), "Contexte du projet");
      await mkdir(join(tempDir, "agents", "shared"), { recursive: true });
      await writeFile(join(tempDir, "agents", "shared", "conventions.md"), "Convention A");

      const context = await loader.loadContext(tempDir);

      expect(context.config.workingDir).toBe(tempDir);
      expect(context.soul).toBe("Contexte du projet");
      expect(context.sharedContext).toBe("Convention A");
    });

    it("doit retourner un contexte valide sans SOUL.md ni shared", async () => {
      const context = await loader.loadContext(tempDir);

      expect(context.config.workingDir).toBe(tempDir);
      expect(context.soul).toBe("");
      expect(context.sharedContext).toBe("");
    });

    it("doit utiliser le cache pour les appels suivants", async () => {
      await writeFile(join(tempDir, "SOUL.md"), "Contenu initial");

      const context1 = await loader.loadContext(tempDir);
      // Modifier le fichier apres le premier chargement
      await writeFile(join(tempDir, "SOUL.md"), "Contenu modifie");
      const context2 = await loader.loadContext(tempDir);

      // Le cache retourne la meme reference
      expect(context1).toBe(context2);
      expect(context2.soul).toBe("Contenu initial");
    });

    it("doit concatener plusieurs fichiers shared tries par nom", async () => {
      await mkdir(join(tempDir, "agents", "shared"), { recursive: true });
      await writeFile(join(tempDir, "agents", "shared", "b-conventions.md"), "Convention B");
      await writeFile(join(tempDir, "agents", "shared", "a-style.md"), "Style A");

      const context = await loader.loadContext(tempDir);

      expect(context.sharedContext).toBe("Style A\n\n---\n\nConvention B");
    });
  });
});
