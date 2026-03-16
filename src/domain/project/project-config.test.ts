import { describe, it, expect } from "vitest";
import { createDefaultConfig, mergeConfig, projectConfigSchema } from "./project-config.js";

describe("ProjectConfig", () => {
  describe("createDefaultConfig", () => {
    it("doit creer une config avec les valeurs par defaut", () => {
      const config = createDefaultConfig("/my/project");

      expect(config.workingDir).toBe("/my/project");
      expect(config.defaultBranch).toBe("main");
      expect(config.orchestratorAgent).toBe("orchestrator");
      expect(config.maxRetries).toBe(2);
      expect(config.timeout).toBe(300);
      expect(config.agents).toBeUndefined();
      expect(config.gitRemote).toBeUndefined();
    });

    it("doit refuser un repertoire de travail vide", () => {
      expect(() => createDefaultConfig("")).toThrow();
    });
  });

  describe("projectConfigSchema", () => {
    it("doit valider une config complete", () => {
      const result = projectConfigSchema.parse({
        workingDir: "/my/project",
        gitRemote: "https://github.com/user/repo.git",
        defaultBranch: "develop",
        agents: ["backend", "frontend"],
        orchestratorAgent: "custom-orchestrator",
        maxRetries: 3,
        timeout: 600,
      });

      expect(result.workingDir).toBe("/my/project");
      expect(result.gitRemote).toBe("https://github.com/user/repo.git");
      expect(result.defaultBranch).toBe("develop");
      expect(result.agents).toEqual(["backend", "frontend"]);
      expect(result.orchestratorAgent).toBe("custom-orchestrator");
      expect(result.maxRetries).toBe(3);
      expect(result.timeout).toBe(600);
    });

    it("doit refuser maxRetries hors limites", () => {
      expect(() => projectConfigSchema.parse({ workingDir: "/x", maxRetries: 0 })).toThrow();
      expect(() => projectConfigSchema.parse({ workingDir: "/x", maxRetries: 11 })).toThrow();
    });

    it("doit refuser timeout hors limites", () => {
      expect(() => projectConfigSchema.parse({ workingDir: "/x", timeout: 10 })).toThrow();
      expect(() => projectConfigSchema.parse({ workingDir: "/x", timeout: 5000 })).toThrow();
    });
  });

  describe("mergeConfig", () => {
    it("doit fusionner les configs en donnant priorite a envConfig", () => {
      const fileConfig = { workingDir: "/from/file", defaultBranch: "main", maxRetries: 2 };
      const envConfig = { maxRetries: 5 };

      const merged = mergeConfig(fileConfig, envConfig);

      expect(merged.workingDir).toBe("/from/file");
      expect(merged.defaultBranch).toBe("main");
      expect(merged.maxRetries).toBe(5);
    });

    it("doit ignorer les valeurs undefined de envConfig", () => {
      const fileConfig = { workingDir: "/from/file", maxRetries: 3 };
      const envConfig = { maxRetries: undefined };

      const merged = mergeConfig(fileConfig, envConfig);

      expect(merged.maxRetries).toBe(3);
    });

    it("doit ajouter les nouvelles cles de envConfig", () => {
      const fileConfig = { workingDir: "/from/file" };
      const envConfig = { gitRemote: "https://github.com/user/repo.git" };

      const merged = mergeConfig(fileConfig, envConfig);

      expect(merged.gitRemote).toBe("https://github.com/user/repo.git");
      expect(merged.workingDir).toBe("/from/file");
    });
  });
});
