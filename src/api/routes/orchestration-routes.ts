import { Router } from "express";
import type { TaskRepository } from "../../domain/task/task-repository.js";
import { transitionTask } from "../../domain/task/transition-task.js";
import { TaskNotFoundError } from "../../domain/task/errors.js";
import type { TaskQueue } from "../../domain/orchestration/task-queue.js";
import type { Worker } from "../../domain/orchestration/worker.js";
import type { EventBus } from "../../domain/orchestration/events.js";
import type { ExecutionRepository } from "../../domain/orchestration/execution-repository.js";
import type { AgentRegistry } from "../../domain/agent/agent-registry.js";
import { parsePlan } from "../../domain/orchestration/parse-plan.js";
import { ExecutionNotFoundError, PlanNotEditableError, StepNotRetryableError } from "../../domain/orchestration/errors.js";
import { getRetryableExecution, getFailedSteps, createExecution } from "../../domain/orchestration/task-execution.js";
import { updatePlanSchema, retryStepSchema, retryTaskSchema, answerQuestionsSchema } from "../schemas/execution-schemas.js";
import { logger } from "../../shared/logger.js";

export interface OrchestrationRouteDeps {
  taskRepository: TaskRepository;
  taskQueue: TaskQueue;
  worker: Worker;
  eventBus?: EventBus;
  executionRepository?: ExecutionRepository;
  agentRegistry?: AgentRegistry;
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

  // PUT /api/tasks/:id/plan — editer le plan avant approbation
  router.put("/:id/plan", async (req, res, next) => {
    try {
      const task = deps.taskRepository.findById(req.params.id);
      if (!task) {
        throw new TaskNotFoundError(req.params.id);
      }

      if (task.status !== "ready") {
        throw new PlanNotEditableError(req.params.id, task.status);
      }

      const parsed = updatePlanSchema.parse(req.body);

      // Verify agents exist if registry is available
      if (deps.agentRegistry) {
        for (const step of parsed.steps) {
          const agentExists = await deps.agentRegistry.exists(step.agent);
          if (!agentExists) {
            throw new PlanNotEditableError(
              req.params.id,
              `Agent "${step.agent}" introuvable dans le registry`
            );
          }
        }
      }

      // Convert from zod parsed (snake_case) to domain format
      const plan = {
        summary: parsed.summary,
        steps: parsed.steps.map((s) => ({
          order: s.order,
          agent: s.agent,
          task: s.task,
          dependsOn: s.depends_on,
          parallel: s.parallel,
        })),
        filesImpacted: parsed.files_impacted,
        questions: parsed.questions,
      };

      const updatedTask = {
        ...task,
        plan: JSON.stringify(plan),
        updatedAt: new Date(),
      };
      deps.taskRepository.update(updatedTask);

      if (deps.eventBus) {
        deps.eventBus.emit({
          type: "task:plan_updated",
          taskId: task.id,
          timestamp: new Date(),
          data: { summary: plan.summary, stepsCount: plan.steps.length },
        });
      }

      logger.info({ taskId: task.id, stepsCount: plan.steps.length }, "Plan mis a jour");

      res.json(updatedTask);
    } catch (error) {
      next(error);
    }
  });

  // POST /api/tasks/:id/steps/:stepOrder/retry — relancer une etape echouee
  router.post("/:id/steps/:stepOrder/retry", async (req, res, next) => {
    try {
      if (!deps.executionRepository) {
        throw new ExecutionNotFoundError("execution repository not configured");
      }

      const task = deps.taskRepository.findById(req.params.id);
      if (!task) {
        throw new TaskNotFoundError(req.params.id);
      }

      const stepOrder = parseInt(req.params.stepOrder, 10);
      const { feedback } = retryStepSchema.parse(req.body);

      const execution = deps.executionRepository.findLatestByTaskId(task.id);
      if (!execution) {
        throw new ExecutionNotFoundError(`Aucune execution trouvee pour la tache "${task.id}"`);
      }

      const step = execution.steps.find((s) => s.stepOrder === stepOrder);
      if (!step) {
        throw new StepNotRetryableError(task.id, stepOrder, "introuvable");
      }
      if (step.status !== "failed") {
        throw new StepNotRetryableError(task.id, stepOrder, step.status);
      }

      const retryExecution = getRetryableExecution(execution, [stepOrder], feedback);
      deps.executionRepository.create(retryExecution);

      // Transition task to running
      const runningTask = transitionTask(
        task.status === "failed" ? transitionTask(task, "inbox") : task,
        task.status === "failed" ? "analyzing" : "running",
      );
      // For failed tasks, go through inbox → analyzing → ready → approved → running
      // Simplified: directly set to running if possible
      const taskForExecution = { ...task, status: "running" as const, updatedAt: new Date() };
      deps.taskRepository.update(taskForExecution);

      if (deps.eventBus) {
        deps.eventBus.emit({
          type: "task:step_retried",
          taskId: task.id,
          timestamp: new Date(),
          data: { stepOrder, feedback: feedback ?? null, attempt: step.attempt + 1 },
        });
        deps.eventBus.emit({
          type: "task:execution_started",
          taskId: task.id,
          timestamp: new Date(),
          data: { executionId: retryExecution.id },
        });
      }

      logger.info({ taskId: task.id, stepOrder, attempt: step.attempt + 1 }, "Etape relancee");

      // Execute in background
      deps.worker.executeWithExecution(taskForExecution, retryExecution).catch((error) => {
        logger.error({ taskId: task.id, error: (error as Error).message }, "Echec de la re-execution");
      });

      res.json(retryExecution);
    } catch (error) {
      next(error);
    }
  });

  // POST /api/tasks/:id/retry — relancer toutes les etapes echouees
  router.post("/:id/retry", async (req, res, next) => {
    try {
      if (!deps.executionRepository) {
        throw new ExecutionNotFoundError("execution repository not configured");
      }

      const task = deps.taskRepository.findById(req.params.id);
      if (!task) {
        throw new TaskNotFoundError(req.params.id);
      }

      const { feedback } = retryTaskSchema.parse(req.body);

      const execution = deps.executionRepository.findLatestByTaskId(task.id);
      if (!execution) {
        throw new ExecutionNotFoundError(`Aucune execution trouvee pour la tache "${task.id}"`);
      }

      const failedSteps = getFailedSteps(execution);
      if (failedSteps.length === 0) {
        return res.status(400).json({
          code: "NO_FAILED_STEPS",
          message: "Aucune etape en echec a relancer",
          suggestion: "Toutes les etapes sont deja reussies ou en attente",
        });
      }

      const stepsToRetry = failedSteps.map((s) => s.stepOrder);
      const retryExecution = getRetryableExecution(execution, stepsToRetry, feedback);
      deps.executionRepository.create(retryExecution);

      const taskForExecution = { ...task, status: "running" as const, updatedAt: new Date() };
      deps.taskRepository.update(taskForExecution);

      if (deps.eventBus) {
        deps.eventBus.emit({
          type: "task:execution_started",
          taskId: task.id,
          timestamp: new Date(),
          data: { executionId: retryExecution.id, retriedSteps: stepsToRetry },
        });
      }

      logger.info({ taskId: task.id, retriedSteps: stepsToRetry }, "Re-execution lancee");

      deps.worker.executeWithExecution(taskForExecution, retryExecution).catch((error) => {
        logger.error({ taskId: task.id, error: (error as Error).message }, "Echec de la re-execution");
      });

      res.json(retryExecution);
    } catch (error) {
      next(error);
    }
  });

  // GET /api/tasks/:id/executions — historique des executions
  router.get("/:id/executions", (req, res, next) => {
    try {
      if (!deps.executionRepository) {
        return res.json([]);
      }

      const task = deps.taskRepository.findById(req.params.id);
      if (!task) {
        throw new TaskNotFoundError(req.params.id);
      }

      const executions = deps.executionRepository.findByTaskId(task.id);
      res.json(executions);
    } catch (error) {
      next(error);
    }
  });

  // POST /api/tasks/:id/answer — repondre aux questions de l'orchestrateur
  router.post("/:id/answer", async (req, res, next) => {
    try {
      const task = deps.taskRepository.findById(req.params.id);
      if (!task) {
        throw new TaskNotFoundError(req.params.id);
      }

      if (task.status !== "ready") {
        throw new PlanNotEditableError(req.params.id, task.status);
      }

      if (!task.plan) {
        throw new PlanNotEditableError(req.params.id, "pas de plan");
      }

      const plan = parsePlan(task.plan);
      if (plan.questions.length === 0) {
        return res.status(400).json({
          code: "NO_QUESTIONS",
          message: "Le plan ne contient aucune question",
          suggestion: "Il n'y a pas de question a repondre pour cette tache",
        });
      }

      const { answers } = answerQuestionsSchema.parse(req.body);

      logger.info({ taskId: task.id, answersCount: answers.length }, "Reponses aux questions soumises, re-analyse en cours");

      // Transition back to analyzing for re-analysis
      const analyzingTask = transitionTask(
        transitionTask(task, "inbox"), // ready → inbox
        "analyzing",                    // inbox → analyzing
      );
      deps.taskRepository.update(analyzingTask);

      // Re-analyze with answers injected
      deps.worker.reanalyzeWithAnswers(analyzingTask, answers).catch((error) => {
        logger.error({ taskId: task.id, error: (error as Error).message }, "Echec de la re-analyse");
      });

      res.json(analyzingTask);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
