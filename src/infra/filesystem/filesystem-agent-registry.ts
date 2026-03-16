import { readdir, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import type { AgentRegistry } from "../../domain/agent/agent-registry.js";
import type { AgentTemplate } from "../../domain/agent/agent-template.js";
import { extractMetadata } from "../../domain/agent/agent-template.js";
import { AgentNotFoundError, AgentRegistryError } from "../../domain/agent/errors.js";
import { logger } from "../../shared/logger.js";

export class FileSystemAgentRegistry implements AgentRegistry {
  private cache: Map<string, AgentTemplate> = new Map();
  private loaded = false;

  constructor(
    private readonly agentsDir: string,
    private readonly sharedDir?: string
  ) {}

  async load(name: string): Promise<AgentTemplate> {
    await this.ensureLoaded();
    const template = this.cache.get(name);
    if (!template) {
      throw new AgentNotFoundError(name);
    }
    return template;
  }

  async list(): Promise<AgentTemplate[]> {
    await this.ensureLoaded();
    return Array.from(this.cache.values());
  }

  async exists(name: string): Promise<boolean> {
    await this.ensureLoaded();
    return this.cache.has(name);
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;

    await this.verifyDirectory(this.agentsDir);
    const sharedContext = await this.loadSharedContext();
    const files = await readdir(this.agentsDir);
    const mdFiles = files.filter((f) => f.endsWith(".md"));

    if (mdFiles.length === 0) {
      throw new AgentRegistryError(
        `Aucun fichier .md trouve dans le dossier agents`,
        { path: this.agentsDir },
        "Ajoutez des fichiers .md dans le dossier agents/"
      );
    }

    for (const file of mdFiles) {
      const filePath = join(this.agentsDir, file);
      const rawContent = await readFile(filePath, "utf-8");
      const name = file.replace(/\.md$/, "");
      const content = sharedContext
        ? `${sharedContext}\n\n---\n\n${rawContent}`
        : rawContent;
      const metadata = extractMetadata(rawContent);

      this.cache.set(name, { name, content, metadata });
    }

    logger.info(
      { agentCount: this.cache.size, path: this.agentsDir },
      "Agents charges depuis le filesystem"
    );
    this.loaded = true;
  }

  private async loadSharedContext(): Promise<string | null> {
    if (!this.sharedDir) return null;

    try {
      await access(this.sharedDir);
    } catch {
      return null;
    }

    const files = await readdir(this.sharedDir);
    const mdFiles = files.filter((f) => f.endsWith(".md")).sort();

    if (mdFiles.length === 0) return null;

    const contents: string[] = [];
    for (const file of mdFiles) {
      const filePath = join(this.sharedDir, file);
      const content = await readFile(filePath, "utf-8");
      contents.push(content);
    }

    return contents.join("\n\n---\n\n");
  }

  private async verifyDirectory(dirPath: string): Promise<void> {
    try {
      await access(dirPath);
    } catch {
      throw new AgentRegistryError(
        `Dossier agents introuvable: "${dirPath}"`,
        { path: dirPath },
        "Verifiez que le dossier existe et est accessible"
      );
    }
  }
}
