import { z } from "zod";

export const projectConfigSchema = z.object({
  workingDir: z.string().min(1, "Le repertoire de travail est requis"),
  gitRemote: z.string().optional(),
  defaultBranch: z.string().default("main"),
  agents: z.array(z.string()).optional(),
  orchestratorAgent: z.string().default("orchestrator"),
  maxRetries: z.number().int().min(1).max(10).default(2),
  timeout: z.number().int().min(30).max(3600).default(300),
});

export type ProjectConfig = z.infer<typeof projectConfigSchema>;

export function createDefaultConfig(workingDir: string): ProjectConfig {
  return projectConfigSchema.parse({ workingDir });
}

export function mergeConfig(
  fileConfig: Partial<ProjectConfig>,
  envConfig: Partial<ProjectConfig>
): Partial<ProjectConfig> {
  const merged: Partial<ProjectConfig> = { ...fileConfig };

  // Les variables d'environnement prennent le dessus
  for (const [key, value] of Object.entries(envConfig)) {
    if (value !== undefined) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }

  return merged;
}
