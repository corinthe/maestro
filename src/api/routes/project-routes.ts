import { Router } from "express";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ProjectLoader } from "../../domain/project/project-loader.js";
import type { AgentRegistry } from "../../domain/agent/agent-registry.js";
import type { TaskRepository } from "../../domain/task/task-repository.js";
import { projectConfigSchema } from "../../domain/project/project-config.js";
import { MaestroError } from "../../shared/errors/base-error.js";

interface ProjectRoutesDeps {
  projectLoader: ProjectLoader;
  agentRegistry: AgentRegistry;
  taskRepository: TaskRepository;
  workingDir: string;
}

export function createProjectRoutes(deps: ProjectRoutesDeps): Router {
  const router = Router();

  // GET /api/project — configuration courante et contexte
  router.get("/", async (_req, res, next) => {
    try {
      const context = await deps.projectLoader.loadContext(deps.workingDir);
      res.json({
        config: context.config,
        hasSoul: context.soul.length > 0,
        soulSize: context.soul.length,
        sharedContextSize: context.sharedContext.length,
      });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/project/soul — contenu brut du SOUL.md
  router.get("/soul", async (_req, res, next) => {
    try {
      const soul = await deps.projectLoader.loadSoul(deps.workingDir);
      res.type("text/markdown").send(soul);
    } catch (error) {
      next(error);
    }
  });

  // PUT /api/project/config — modifier la configuration
  router.put("/config", async (req, res, next) => {
    try {
      // Verifier qu'aucune tache n'est en cours
      const runningTasks = [
        ...deps.taskRepository.findByStatus("running"),
        ...deps.taskRepository.findByStatus("analyzing"),
      ];
      if (runningTasks.length > 0) {
        throw new MaestroError(
          "Impossible de modifier la configuration pendant l'execution de taches",
          "PROJECT_CONFIG_LOCKED",
          { runningTaskCount: runningTasks.length },
          "Attendez que les taches en cours soient terminees ou annulez-les"
        );
      }

      const parsed = projectConfigSchema.safeParse({
        ...req.body,
        workingDir: deps.workingDir,
      });

      if (!parsed.success) {
        throw new MaestroError(
          "Configuration invalide",
          "VALIDATION_ERROR",
          { errors: parsed.error.flatten().fieldErrors },
          "Verifiez les valeurs envoyees"
        );
      }

      // Ecrire la config (sans workingDir, qui est derive de l'env)
      const { workingDir: _wd, ...configToSave } = parsed.data;
      const configPath = join(deps.workingDir, "maestro.config.json");
      await writeFile(configPath, JSON.stringify(configToSave, null, 2), "utf-8");

      res.json({ config: parsed.data });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/project/agents — agents actifs pour ce projet
  router.get("/agents", async (_req, res, next) => {
    try {
      const allAgents = await deps.agentRegistry.list();
      const context = await deps.projectLoader.loadContext(deps.workingDir);

      const activeAgents = context.config.agents
        ? allAgents.filter((a) => context.config.agents!.includes(a.name))
        : allAgents;

      res.json(activeAgents.map((a) => ({
        name: a.name,
        description: a.metadata.description ?? a.content.split("\n")[0],
      })));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
