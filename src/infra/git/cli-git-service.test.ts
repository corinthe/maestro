import { describe, it, expect, vi, beforeEach } from "vitest";
import { CliGitService } from "./cli-git-service.js";
import { GitError, GitBranchExistsError } from "../../domain/git/errors.js";
import * as childProcess from "node:child_process";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

describe("CliGitService", () => {
  let service: CliGitService;
  const mockExecFile = vi.mocked(childProcess.execFile);

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CliGitService("/tmp/project");
  });

  describe("createBranch", () => {
    it("doit appeler git checkout -b avec le bon nom de branche", async () => {
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        (callback as Function)(null, "", "");
        return {} as ReturnType<typeof childProcess.execFile>;
      });

      await service.createBranch("feature/ma-branche");

      expect(mockExecFile).toHaveBeenCalledWith(
        "git",
        ["checkout", "-b", "feature/ma-branche"],
        expect.objectContaining({ cwd: "/tmp/project" }),
        expect.any(Function)
      );
    });

    it("doit lancer GitBranchExistsError quand la branche existe deja", async () => {
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        (callback as Function)(new Error("fatal: a branch named 'feature/test' already exists"), "", "");
        return {} as ReturnType<typeof childProcess.execFile>;
      });

      await expect(service.createBranch("feature/test")).rejects.toThrow(GitBranchExistsError);
    });

    it("doit lancer GitError sur les autres erreurs", async () => {
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        (callback as Function)(new Error("unknown error"), "", "");
        return {} as ReturnType<typeof childProcess.execFile>;
      });

      await expect(service.createBranch("feature/test")).rejects.toThrow(GitError);
    });
  });

  describe("commit", () => {
    it("doit ajouter les fichiers et commiter avec le message", async () => {
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        (callback as Function)(null, "", "");
        return {} as ReturnType<typeof childProcess.execFile>;
      });

      await service.commit("feat: ajout fonctionnalite", ["src/index.ts", "src/app.ts"]);

      expect(mockExecFile).toHaveBeenCalledWith(
        "git",
        ["add", "src/index.ts", "src/app.ts"],
        expect.objectContaining({ cwd: "/tmp/project" }),
        expect.any(Function)
      );
      expect(mockExecFile).toHaveBeenCalledWith(
        "git",
        ["commit", "-m", "feat: ajout fonctionnalite"],
        expect.objectContaining({ cwd: "/tmp/project" }),
        expect.any(Function)
      );
    });

    it("doit ne pas appeler git add si aucun fichier n'est fourni", async () => {
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        (callback as Function)(null, "", "");
        return {} as ReturnType<typeof childProcess.execFile>;
      });

      await service.commit("fix: correction", []);

      expect(mockExecFile).toHaveBeenCalledTimes(1);
      expect(mockExecFile).toHaveBeenCalledWith(
        "git",
        ["commit", "-m", "fix: correction"],
        expect.objectContaining({ cwd: "/tmp/project" }),
        expect.any(Function)
      );
    });

    it("doit lancer GitError en cas d'echec du commit", async () => {
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        (callback as Function)(new Error("nothing to commit"), "", "");
        return {} as ReturnType<typeof childProcess.execFile>;
      });

      await expect(service.commit("test", ["file.ts"])).rejects.toThrow(GitError);
    });
  });

  describe("push", () => {
    it("doit appeler git push -u origin avec le nom de branche", async () => {
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        (callback as Function)(null, "", "");
        return {} as ReturnType<typeof childProcess.execFile>;
      });

      await service.push("feature/ma-branche");

      expect(mockExecFile).toHaveBeenCalledWith(
        "git",
        ["push", "-u", "origin", "feature/ma-branche"],
        expect.objectContaining({ cwd: "/tmp/project" }),
        expect.any(Function)
      );
    });

    it("doit lancer GitError en cas d'echec du push", async () => {
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        (callback as Function)(new Error("remote rejected"), "", "");
        return {} as ReturnType<typeof childProcess.execFile>;
      });

      await expect(service.push("feature/test")).rejects.toThrow(GitError);
    });
  });

  describe("createPR", () => {
    it("doit appeler gh pr create avec les bons arguments et retourner l'URL", async () => {
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        (callback as Function)(null, "https://github.com/org/repo/pull/42\n", "");
        return {} as ReturnType<typeof childProcess.execFile>;
      });

      const prUrl = await service.createPR("Ma PR", "Description de la PR", "feature/ma-branche");

      expect(prUrl).toBe("https://github.com/org/repo/pull/42");
      expect(mockExecFile).toHaveBeenCalledWith(
        "gh",
        ["pr", "create", "--title", "Ma PR", "--body", "Description de la PR", "--head", "feature/ma-branche"],
        expect.objectContaining({ cwd: "/tmp/project" }),
        expect.any(Function)
      );
    });

    it("doit lancer GitError quand gh echoue", async () => {
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        (callback as Function)(new Error("gh: not found"), "", "");
        return {} as ReturnType<typeof childProcess.execFile>;
      });

      await expect(service.createPR("titre", "body", "feature/test")).rejects.toThrow(GitError);
    });
  });
});
