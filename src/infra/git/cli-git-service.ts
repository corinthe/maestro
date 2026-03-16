import { execFile } from "node:child_process";
import { GitService } from "../../domain/git/git-service.js";
import { GitError, GitBranchExistsError } from "../../domain/git/errors.js";
import { logger } from "../../shared/logger.js";

export class CliGitService implements GitService {
  constructor(private readonly workingDir: string) {}

  async createBranch(name: string): Promise<void> {
    logger.info({ branch: name }, "Creation de la branche git");
    try {
      await this.exec("git", ["checkout", "-b", name]);
      logger.info({ branch: name }, "Branche git creee");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("already exists")) {
        throw new GitBranchExistsError(name);
      }
      throw new GitError("createBranch", message);
    }
  }

  async commit(message: string, files: string[]): Promise<void> {
    logger.info({ files: files.length, message }, "Commit git en cours");
    try {
      if (files.length > 0) {
        await this.exec("git", ["add", ...files]);
      }
      await this.exec("git", ["commit", "-m", message]);
      logger.info({ message }, "Commit git effectue");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new GitError("commit", errorMessage);
    }
  }

  async push(branch: string): Promise<void> {
    logger.info({ branch }, "Push git en cours");
    try {
      await this.exec("git", ["push", "-u", "origin", branch]);
      logger.info({ branch }, "Push git effectue");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new GitError("push", message);
    }
  }

  async createPR(title: string, body: string, branch: string): Promise<string> {
    logger.info({ title, branch }, "Creation de la PR");
    try {
      const { stdout } = await this.exec("gh", [
        "pr", "create",
        "--title", title,
        "--body", body,
        "--head", branch,
      ]);
      const prUrl = stdout.trim();
      logger.info({ prUrl, branch }, "PR creee");
      return prUrl;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new GitError("createPR", message, "Verifiez que gh est installe et authentifie");
    }
  }

  private exec(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
    logger.debug({ command, args }, "Execution commande git");
    return new Promise((resolve, reject) => {
      execFile(command, args, { cwd: this.workingDir }, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  }
}
