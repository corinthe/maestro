import { Router } from "express";
import type { TaskRepository } from "../../domain/task/task-repository.js";
import { transitionTask } from "../../domain/task/transition-task.js";
import { TaskNotFoundError } from "../../domain/task/errors.js";
import type { TaskQueue } from "../../domain/orchestration/task-queue.js";
import type { Worker } from "../../domain/orchestration/worker.js";
import { logger } from "../../shared/logger.js";

export interface OrchestrationRouteDeps {
  taskRepository: TaskRepository;
  taskQueue: TaskQueue;
  worker: Worker;
}

export function createOrchestrationRoutes(deps: OrchestrationRouteDeps): Router {
  const router = Router();

  // POST /api/tasks/:id/analyze — lancer l'analyse de la tache par l'orchestrateur
  router.post("/:id/analyze", async (req, res, next) => {
    try {
      const task = deps.taskRepository.findById(req.params.id);
      if (!task) {
        throw new TaskNotFoundError(req.params.id);
      }

      const analyzingTask = transitionTask(task, "analyzing");
      deps.taskRepository.update(analyzingTask);

      logger.info({ taskId: task.id }, "Tache soumise a l'analyse");

      // Lancer l'analyse en arriere-plan
      deps.worker.processTask(analyzingTask).catch((error) => {
        logger.error({ taskId: task.id, error: (error as Error).message }, "Echec de l'analyse de la tache");
      });

      res.json(analyzingTask);
    } catch (error) {
      next(error);
    }
  });

  // POST /api/tasks/:id/approve — approuver le plan et lancer l'execution
  router.post("/:id/approve", async (req, res, next) => {
    try {
      const task = deps.taskRepository.findById(req.params.id);
      if (!task) {
        throw new TaskNotFoundError(req.params.id);
      }

      const approvedTask = transitionTask(task, "approved");
      deps.taskRepository.update(approvedTask);

      logger.info({ taskId: task.id }, "Tache approuvee, lancement de l'execution");

      // Lancer l'execution en arriere-plan
      deps.worker.executeApprovedTask(approvedTask).catch((error) => {
        logger.error({ taskId: task.id, error: (error as Error).message }, "Echec de l'execution de la tache");
      });

      res.json(approvedTask);
    } catch (error) {
      next(error);
    }
  });

  // POST /api/tasks/:id/cancel — annuler une tache en cours
  router.post("/:id/cancel", async (req, res, next) => {
    try {
      const task = deps.taskRepository.findById(req.params.id);
      if (!task) {
        throw new TaskNotFoundError(req.params.id);
      }

      const failedTask = transitionTask(task, "failed");
      deps.taskRepository.update(failedTask);

      logger.info({ taskId: task.id, previousStatus: task.status }, "Tache annulee");

      res.json(failedTask);
    } catch (error) {
      next(error);
    }
  });

  // GET /api/tasks/:id/logs — retourner les logs des agents
  router.get("/:id/logs", (req, res, next) => {
    try {
      const task = deps.taskRepository.findById(req.params.id);
      if (!task) {
        throw new TaskNotFoundError(req.params.id);
      }

      const logs = task.agentLogs ? JSON.parse(task.agentLogs) : {};

      res.json({
        taskId: task.id,
        status: task.status,
        logs,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
