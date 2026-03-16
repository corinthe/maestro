import type { AgentTemplate } from "./agent-template.js";

export interface AgentRegistry {
  load(name: string): Promise<AgentTemplate>;
  list(): Promise<AgentTemplate[]>;
  exists(name: string): Promise<boolean>;
}
