import type { Task } from "../task/task.js";
import type { TaskStatus } from "../task/task-status.js";
import type { TaskRepository } from "../task/task-repository.js";
import type { AgentRegistry } from "../agent/agent-registry.js";
import type { LLMProvider } from "../agent/llm-provider.js";
import type { GitService } from "../git/git-service.js";
import type { TaskQueue } from "./task-queue.js";
import type { EventBus } from "./events.js";
import type { ExecutionPlan } from "./execution-plan.js";
import { parsePlan } from "./parse-plan.js";
import { getNextSteps } from "./get-next-steps.js";
import { isPlanComplete } from "./is-plan-complete.js";
import { PlanExecutionError } from "./errors.js";
import { logger } from "../../shared/logger.js";

export interface WorkerDependencies {
  taskQueue: TaskQueue;
  taskRepository: TaskRepository;
  agentRegistry: AgentRegistry;
  llmProvider: LLMProvider;
  gitService: GitService;
  eventBus: EventBus;
  workingDir: string;
  orchestratorAgent?: string;
  maxRetries?: number;
  pollIntervalMs?: number;
}

export class Worker {
  private running = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly deps: Required<WorkerDependencies>;

  constructor(deps: WorkerDependencies) {
    this.deps = {
      orchestratorAgent: "orchestrator",
      maxRetries: 2,
      pollIntervalMs: 2000,
      ...deps,
    };
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    logger.info("Worker demarre");
    this.poll();
  }

  stop(): void {
    this.running = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    logger.info("Worker arrete");
  }

  isRunning(): boolean {
    return this.running;
  }

  private poll(): void {
    if (!this.running) return;

    const task = this.deps.taskQueue.pop();
    if (task) {
      this.processTask(task).catch((error) => {
        logger.error({ taskId: task.id, error: (error as Error).message }, "Erreur fatale lors du traitement de la tache");
      });
    }

    this.pollTimer = setTimeout(() => this.poll(), this.deps.pollIntervalMs);
  }

  async processTask(task: Task): Promise<void> {
    const startTime = Date.now();
    logger.info({ taskId: task.id, title: task.title }, "Debut du traitement de la tache");

    try {
      // Phase 1: Analyse — appeler l'orchestrateur pour generer un plan
      const plan = await this.analyzeTask(task);

      // Phase 2: Mettre a jour la tache avec le plan, passer en "ready"
      const readyTask = this.updateTaskStatus(task, "analyzing");
      const taskWithPlan = {
        ...readyTask,
        plan: JSON.stringify(plan),
        updatedAt: new Date(),
      };
      this.deps.taskRepository.update(taskWithPlan);
      const finalReadyTask = this.updateTaskStatus(taskWithPlan, "ready");

      this.emitEvent("task:plan_ready", task.id, {
        summary: plan.summary,
        stepsCount: plan.steps.length,
        questions: plan.questions,
      });

      logger.info({ taskId: task.id, steps: plan.steps.length }, "Plan genere, en attente de validation");

      // Phase 3: Attendre la validation (approved)
      // Le worker ne bloque pas — il re-verifie plus tard.
      // L'API met la tache en "approved" et la remet dans la queue.
      // Ici on verifie si la tache est deja approved (re-entree apres approbation)
      const currentTask = this.deps.taskRepository.findById(task.id);
      if (!currentTask || currentTask.status !== "approved") {
        return; // On attend que l'utilisateur approuve via l'API
      }

      await this.executeApprovedTask(currentTask, plan);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ taskId: task.id, error: message, durationMs: Date.now() - startTime }, "Tache echouee");
      this.failTask(task, message);
    }
  }

  async executeApprovedTask(task: Task, plan?: ExecutionPlan): Promise<void> {
    const startTime = Date.now();

    // Recharger le plan si non fourni
    if (!plan && task.plan) {
      plan = parsePlan(task.plan);
    }
    if (!plan) {
      throw new PlanExecutionError(0, "worker", "Aucun plan disponible pour cette tache");
    }

    try {
      // Passer en running
      const runningTask = this.updateTaskStatus(task, "running");

      // Phase execution: executer chaque etape du plan
      const completedSteps: number[] = [];
      const agentLogs: Record<string, string> = {};

      while (!isPlanComplete(plan, completedSteps)) {
        const nextSteps = getNextSteps(plan, completedSteps);
        if (nextSteps.length === 0) {
          throw new PlanExecutionError(0, "worker", "Aucune etape executable trouvee mais le plan n'est pas termine");
        }

        // Executer les etapes paralleles en parallele
        const results = await Promise.all(
          nextSteps.map(async (step) => {
            this.emitEvent("task:agent_started", task.id, {
              stepOrder: step.order,
              agent: step.agent,
              task: step.task,
            });

            const result = await this.executeStep(task, step.agent, step.task, step.order);

            agentLogs[`step-${step.order}-${step.agent}`] = result;

            this.emitEvent("task:agent_completed", task.id, {
              stepOrder: step.order,
              agent: step.agent,
              success: true,
            });

            return step.order;
          })
        );

        completedSteps.push(...results);
      }

      // Phase finalisation: git
      const branchName = `feature/task-${task.id.substring(0, 8)}`;
      await this.deps.gitService.createBranch(branchName);
      await this.deps.gitService.commit(`feat: ${task.title}`, plan.filesImpacted);
      await this.deps.gitService.push(branchName);
      const prUrl = await this.deps.gitService.createPR(
        task.title,
        `## Tache\n${task.description}\n\n## Plan\n${plan.summary}`,
        branchName
      );

      // Mettre a jour la tache
      const reviewTask: Task = {
        ...runningTask,
        status: "review",
        branch: branchName,
        prUrl,
        agentLogs: JSON.stringify(agentLogs),
        updatedAt: new Date(),
      };
      this.deps.taskRepository.update(reviewTask);

      this.emitEvent("task:pr_opened", task.id, { prUrl, branch: branchName });
      this.emitEvent("task:status_changed", task.id, { from: "running", to: "review" });

      logger.info({ taskId: task.id, prUrl, durationMs: Date.now() - startTime }, "Tache terminee, PR ouverte");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ taskId: task.id, error: message, durationMs: Date.now() - startTime }, "Execution de la tache echouee");
      this.failTask(task, message);
      throw error;
    }
  }

  private async analyzeTask(task: Task): Promise<ExecutionPlan> {
    const { agentRegistry, llmProvider, workingDir, orchestratorAgent, maxRetries } = this.deps;

    const template = await agentRegistry.load(orchestratorAgent);
    const prompt = `Analyse cette tache et genere un plan d'execution en JSON:\n\nTitre: ${task.title}\nDescription: ${task.description}`;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      logger.info({ taskId: task.id, attempt, maxRetries }, "Appel a l'orchestrateur");

      const response = await llmProvider.chat(
        template.content,
        [{ role: "user", content: prompt }],
        workingDir,
        {
          onChunk: (chunk) => {
            this.emitEvent("task:agent_output", task.id, {
              agent: orchestratorAgent,
              chunk,
              streaming: true,
            });
          },
        }
      );

      if (!response.success) {
        lastError = new Error(response.error ?? "Reponse LLM echouee");
        logger.warn({ taskId: task.id, attempt, error: response.error }, "Echec de l'appel LLM, nouvelle tentative");
        continue;
      }

      try {
        // Extraire le JSON du contenu (peut etre entoure de markdown)
        const jsonContent = extractJson(response.content);
        return parsePlan(jsonContent);
      } catch (error) {
        lastError = error as Error;
        logger.warn({ taskId: task.id, attempt, error: (error as Error).message }, "Echec du parsing du plan, nouvelle tentative");
      }
    }

    throw lastError ?? new Error("Echec de l'analyse apres toutes les tentatives");
  }

  private async executeStep(task: Task, agentName: string, stepTask: string, stepOrder = 0): Promise<string> {
    const { agentRegistry, llmProvider, workingDir, maxRetries } = this.deps;

    const template = await agentRegistry.load(agentName);
    const prompt = `Tache principale: ${task.title}\n\nEtape a realiser: ${stepTask}`;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      logger.info({ taskId: task.id, agent: agentName, attempt }, "Execution de l'agent");

      const response = await llmProvider.chat(
        template.content,
        [{ role: "user", content: prompt }],
        workingDir,
        {
          onChunk: (chunk) => {
            this.emitEvent("task:agent_output", task.id, {
              agent: agentName,
              stepOrder,
              chunk,
              streaming: true,
            });
          },
        }
      );

      if (response.success) {
        this.emitEvent("task:agent_output", task.id, {
          agent: agentName,
          output: response.content.substring(0, 1000),
        });
        return response.content;
      }

      lastError = new Error(response.error ?? "Agent a echoue");
      logger.warn({ taskId: task.id, agent: agentName, attempt, error: response.error }, "Echec agent, nouvelle tentative");
    }

    throw new PlanExecutionError(0, agentName, lastError?.message ?? "Echec apres toutes les tentatives");
  }

  private updateTaskStatus(task: Task, newStatus: TaskStatus): Task {
    const updated: Task = { ...task, status: newStatus, updatedAt: new Date() };
    this.deps.taskRepository.update(updated);
    this.emitEvent("task:status_changed", task.id, { from: task.status, to: newStatus });
    return updated;
  }

  private failTask(task: Task, reason: string): void {
    try {
      const failed: Task = { ...task, status: "failed", updatedAt: new Date() };
      this.deps.taskRepository.update(failed);
      this.emitEvent("task:failed", task.id, { reason });
      this.emitEvent("task:status_changed", task.id, { from: task.status, to: "failed" });
    } catch (error) {
      logger.error({ taskId: task.id, error: (error as Error).message }, "Impossible de marquer la tache comme echouee");
    }
  }

  private emitEvent(type: Parameters<EventBus["emit"]>[0]["type"], taskId: string, data: Record<string, unknown>): void {
    this.deps.eventBus.emit({
      type,
      taskId,
      timestamp: new Date(),
      data,
    });
  }
}

function extractJson(content: string): string {
  // Essayer de trouver un bloc JSON dans du markdown
  const jsonBlockMatch = content.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (jsonBlockMatch) {
    return jsonBlockMatch[1].trim();
  }

  // Essayer de trouver un objet JSON brut
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  return content;
}
