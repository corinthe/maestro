import { Router } from "express";
import type { TaskRepository } from "../../domain/task/task-repository.js";
import { createTask } from "../../domain/task/task.js";
import { transitionTask } from "../../domain/task/transition-task.js";
import { TaskNotFoundError } from "../../domain/task/errors.js";
import { MaestroError } from "../../shared/errors/base-error.js";
import { createTaskSchema, updateTaskSchema, statusQuerySchema } from "../schemas/task-schemas.js";
import { logger } from "../../shared/logger.js";

export function createTaskRoutes(taskRepository: TaskRepository): Router {
  const router = Router();

  router.post("/", (req, res, next) => {
    try {
      const parsed = createTaskSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new MaestroError(
          "Donnees invalides pour la creation de tache",
          "VALIDATION_ERROR",
          { errors: parsed.error.flatten().fieldErrors },
          "Fournissez un titre et une description valides"
        );
      }

      const task = createTask(parsed.data.title, parsed.data.description);
      const created = taskRepository.create(task);

      logger.info({ taskId: created.id, title: created.title }, "Tache creee");
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });

  router.get("/", (req, res, next) => {
    try {
      const parsed = statusQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new MaestroError(
          "Parametre de filtre invalide",
          "VALIDATION_ERROR",
          { errors: parsed.error.flatten().fieldErrors },
          `Statuts valides : ${statusQuerySchema.shape.status.options}`
        );
      }

      const tasks = parsed.data.status
        ? taskRepository.findByStatus(parsed.data.status)
        : taskRepository.findAll();

      res.json(tasks);
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id", (req, res, next) => {
    try {
      const task = taskRepository.findById(req.params.id);
      if (!task) {
        throw new TaskNotFoundError(req.params.id);
      }
      res.json(task);
    } catch (err) {
      next(err);
    }
  });

  router.put("/:id", (req, res, next) => {
    try {
      const parsed = updateTaskSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new MaestroError(
          "Donnees invalides pour la mise a jour",
          "VALIDATION_ERROR",
          { errors: parsed.error.flatten().fieldErrors },
          "Verifiez les champs fournis"
        );
      }

      const task = taskRepository.findById(req.params.id);
      if (!task) {
        throw new TaskNotFoundError(req.params.id);
      }

      let updated = { ...task, updatedAt: new Date() };

      if (parsed.data.title !== undefined) {
        updated = { ...updated, title: parsed.data.title };
      }
      if (parsed.data.description !== undefined) {
        updated = { ...updated, description: parsed.data.description };
      }
      if (parsed.data.status !== undefined) {
        updated = transitionTask(updated, parsed.data.status);
      }

      const saved = taskRepository.update(updated);

      logger.info({ taskId: saved.id, status: saved.status }, "Tache mise a jour");
      res.json(saved);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
