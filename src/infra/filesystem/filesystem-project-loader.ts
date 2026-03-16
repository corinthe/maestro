import { readFile, readdir, access } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ProjectLoader } from "../../domain/project/project-loader.js";
import type { ProjectConfig } from "../../domain/project/project-config.js";
import type { ProjectContext } from "../../domain/project/project-context.js";
import { projectConfigSchema, createDefaultConfig } from "../../domain/project/project-config.js";
import { ProjectConfigError, SoulFileError } from "../../domain/project/errors.js";
import { logger } from "../../shared/logger.js";

const execFileAsync = promisify(execFile);

export class FileSystemProjectLoader implements ProjectLoader {
  private cache: Map<string, ProjectContext> = new Map();

  async loadConfig(workingDir: string): Promise<ProjectConfig> {
    const configPath = join(workingDir, "maestro.config.json");

    let fileConfig: Record<string, unknown> = {};
    try {
      await access(configPath);
      const raw = await readFile(configPath, "utf-8");
      fileConfig = JSON.parse(raw);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT" && !(error instanceof SyntaxError)) {
        // Fichier existe mais n'est pas lisible
        if ((error as NodeJS.ErrnoException).code) {
          throw new ProjectConfigError(
            `Impossible de lire le fichier de configuration: ${(error as Error).message}`,
            { path: configPath }
          );
        }
      }
      if (error instanceof SyntaxError) {
        throw new ProjectConfigError(
          `Fichier maestro.config.json invalide: JSON mal forme`,
          { path: configPath }
        );
      }
      // ENOENT: pas de fichier config, on utilise les defauts
    }

    // Auto-detection git
    const gitRemote = fileConfig.gitRemote as string | undefined ?? await this.detectGitRemote(workingDir);
    const defaultBranch = fileConfig.defaultBranch as string | undefined ?? await this.detectDefaultBranch(workingDir);

    const configInput = {
      ...fileConfig,
      workingDir,
      ...(gitRemote ? { gitRemote } : {}),
      ...(defaultBranch ? { defaultBranch } : {}),
    };

    try {
      const config = projectConfigSchema.parse(configInput);
      logger.debug({ workingDir, hasConfigFile: Object.keys(fileConfig).length > 0 }, "Configuration projet chargee");
      return config;
    } catch (error) {
      throw new ProjectConfigError(
        `Configuration projet invalide: ${(error as Error).message}`,
        { workingDir, raw: configInput }
      );
    }
  }

  async loadSoul(workingDir: string): Promise<string> {
    const soulPath = join(workingDir, "SOUL.md");

    try {
      await access(soulPath);
      const content = await readFile(soulPath, "utf-8");
      logger.debug({ workingDir, soulSize: content.length }, "SOUL.md charge");
      return content;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        logger.debug({ workingDir }, "Pas de SOUL.md trouve");
        return "";
      }
      throw new SoulFileError(soulPath, (error as Error).message);
    }
  }

  async loadContext(workingDir: string): Promise<ProjectContext> {
    const cached = this.cache.get(workingDir);
    if (cached) return cached;

    const config = await this.loadConfig(workingDir);
    const soul = await this.loadSoul(workingDir);
    const sharedContext = await this.loadSharedContext(workingDir);

    const context: ProjectContext = { config, soul, sharedContext };
    this.cache.set(workingDir, context);

    logger.info(
      {
        workingDir,
        hasSoul: soul.length > 0,
        sharedContextSize: sharedContext.length,
        gitRemote: config.gitRemote ?? "non detecte",
      },
      "Contexte projet charge"
    );

    return context;
  }

  private async loadSharedContext(workingDir: string): Promise<string> {
    const sharedDir = join(workingDir, "agents", "shared");

    try {
      await access(sharedDir);
    } catch {
      return "";
    }

    const files = await readdir(sharedDir);
    const mdFiles = files.filter((f) => f.endsWith(".md")).sort();
    if (mdFiles.length === 0) return "";

    const contents: string[] = [];
    for (const file of mdFiles) {
      const content = await readFile(join(sharedDir, file), "utf-8");
      contents.push(content);
    }

    return contents.join("\n\n---\n\n");
  }

  private async detectGitRemote(workingDir: string): Promise<string | undefined> {
    try {
      const { stdout } = await execFileAsync("git", ["remote", "get-url", "origin"], { cwd: workingDir });
      return stdout.trim() || undefined;
    } catch {
      return undefined;
    }
  }

  private async detectDefaultBranch(workingDir: string): Promise<string | undefined> {
    try {
      const { stdout } = await execFileAsync("git", ["symbolic-ref", "refs/remotes/origin/HEAD"], { cwd: workingDir });
      const ref = stdout.trim();
      return ref.replace("refs/remotes/origin/", "") || undefined;
    } catch {
      return undefined;
    }
  }
}
