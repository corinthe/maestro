import type { ProjectConfig } from "./project-config.js";

export interface ProjectContext {
  config: ProjectConfig;
  soul: string;
  sharedContext: string;
}
