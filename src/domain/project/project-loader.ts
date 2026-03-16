import type { ProjectConfig } from "./project-config.js";
import type { ProjectContext } from "./project-context.js";

export interface ProjectLoader {
  loadConfig(workingDir: string): Promise<ProjectConfig>;
  loadSoul(workingDir: string): Promise<string>;
  loadContext(workingDir: string): Promise<ProjectContext>;
}
