import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Worker, type WorkerDependencies } from "./worker.js";
import type { Task } from "../task/task.js";
import type { TaskRepository } from "../task/task-repository.js";
import type { AgentRegistry } from "../agent/agent-registry.js";
import type { LLMProvider, LLMResponse } from "../agent/llm-provider.js";
import type { GitService } from "../git/git-service.js";
import type { TaskQueue } from "./task-queue.js";
import type { EventBus, TaskEvent } from "./events.js";
import { InMemoryEventBus } from "../../infra/events/in-memory-event-bus.js";

function createTestTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "test-task-id",
    title: "Ajouter la page de login",
    description: "Creer une page de login avec email et mot de passe",
    status: "inbox",
    plan: null,
    branch: null,
    prUrl: null,
    agentLogs: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const VALID_PLAN_JSON = JSON.stringify({
  summary: "Plan pour la page de login",
  steps: [
    { order: 1, agent: "backend", task: "Creer le endpoint auth", depends_on: [], parallel: false },
    { order: 2, agent: "frontend", task: "Creer le composant Login", depends_on: [1], parallel: false },
  ],
  files_impacted: ["src/auth.ts", "src/Login.tsx"],
  questions: [],
});

function createMockTaskRepository(): TaskRepository {
  const store = new Map<string, Task>();
  return {
    create: vi.fn((task: Task) => { store.set(task.id, task); return task; }),
    findById: vi.fn((id: string) => store.get(id) ?? null),
    findAll: vi.fn(() => [...store.values()]),
    findByStatus: vi.fn(() => []),
    update: vi.fn((task: Task) => { store.set(task.id, task); return task; }),
  };
}

function createMockAgentRegistry(): AgentRegistry {
  return {
    load: vi.fn(async (name: string) => ({
      name,
      content: `Template pour ${name}`,
      metadata: { description: `Agent ${name}` },
    })),
    list: vi.fn(async () => []),
    exists: vi.fn(async () => true),
  };
}

function createMockGitService(): GitService {
  return {
    createBranch: vi.fn(async () => {}),
    commit: vi.fn(async () => {}),
    push: vi.fn(async () => {}),
    createPR: vi.fn(async () => "https://github.com/test/repo/pull/1"),
  };
}

function createMockQueue(tasks: Task[] = []): TaskQueue {
  const queue = [...tasks];
  return {
    push: vi.fn((task: Task) => queue.push(task)),
    pop: vi.fn(() => queue.shift()),
    peek: vi.fn(() => queue[0]),
    get length() { return queue.length; },
  };
}

function createMockLLMProvider(planJson: string = VALID_PLAN_JSON): LLMProvider {
  return {
    chat: vi.fn(async (): Promise<LLMResponse> => ({
      content: planJson,
      success: true,
    })),
  };
}

function createWorkerDeps(overrides: Partial<WorkerDependencies> = {}): WorkerDependencies {
  return {
    taskQueue: createMockQueue(),
    taskRepository: createMockTaskRepository(),
    agentRegistry: createMockAgentRegistry(),
    llmProvider: createMockLLMProvider(),
    gitService: createMockGitService(),
    eventBus: new InMemoryEventBus(),
    workingDir: "/tmp/test",
    maxRetries: 2,
    pollIntervalMs: 100,
    ...overrides,
  };
}

describe("Worker", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("start/stop", () => {
    it("doit demarrer et s'arreter correctement", () => {
      const worker = new Worker(createWorkerDeps());
      expect(worker.isRunning()).toBe(false);

      worker.start();
      expect(worker.isRunning()).toBe(true);

      worker.stop();
      expect(worker.isRunning()).toBe(false);
    });

    it("ne doit pas demarrer deux fois", () => {
      const worker = new Worker(createWorkerDeps());
      worker.start();
      worker.start(); // no-op
      expect(worker.isRunning()).toBe(true);
      worker.stop();
    });
  });

  describe("processTask — phase analyse", () => {
    it("doit appeler l'orchestrateur et generer un plan", async () => {
      const deps = createWorkerDeps();
      const worker = new Worker(deps);
      const task = createTestTask();
      (deps.taskRepository as ReturnType<typeof createMockTaskRepository>).findById = vi.fn(() => null); // Not approved yet

      await worker.processTask(task);

      expect(deps.agentRegistry.load).toHaveBeenCalledWith("orchestrator");
      expect(deps.llmProvider.chat).toHaveBeenCalledOnce();
      expect(deps.taskRepository.update).toHaveBeenCalled();
    });

    it("doit emettre un evenement plan_ready apres analyse", async () => {
      const eventBus = new InMemoryEventBus();
      const events: TaskEvent[] = [];
      eventBus.onAll((e) => events.push(e));

      const deps = createWorkerDeps({ eventBus });
      const worker = new Worker(deps);
      const task = createTestTask();

      await worker.processTask(task);

      const planReadyEvent = events.find((e) => e.type === "task:plan_ready");
      expect(planReadyEvent).toBeDefined();
      expect(planReadyEvent!.data.stepsCount).toBe(2);
    });

    it("doit echouer apres N tentatives si le LLM retourne une erreur", async () => {
      const llmProvider: LLMProvider = {
        chat: vi.fn(async (): Promise<LLMResponse> => ({
          content: "",
          success: false,
          error: "LLM indisponible",
        })),
      };

      const deps = createWorkerDeps({ llmProvider, maxRetries: 2 });
      const worker = new Worker(deps);
      const task = createTestTask();

      await worker.processTask(task);

      expect(llmProvider.chat).toHaveBeenCalledTimes(2);
      // La tache est en echec
      const updateCalls = (deps.taskRepository.update as ReturnType<typeof vi.fn>).mock.calls;
      const lastUpdate = updateCalls[updateCalls.length - 1][0] as Task;
      expect(lastUpdate.status).toBe("failed");
    });

    it("doit extraire le JSON d'un bloc markdown", async () => {
      const llmProvider: LLMProvider = {
        chat: vi.fn(async (): Promise<LLMResponse> => ({
          content: `Voici le plan:\n\`\`\`json\n${VALID_PLAN_JSON}\n\`\`\`\nFin.`,
          success: true,
        })),
      };

      const deps = createWorkerDeps({ llmProvider });
      const worker = new Worker(deps);
      const task = createTestTask();

      await worker.processTask(task);

      // Verify plan was parsed and stored
      const updateCalls = (deps.taskRepository.update as ReturnType<typeof vi.fn>).mock.calls;
      const planUpdate = updateCalls.find((call) => {
        const t = call[0] as Task;
        return t.plan !== null;
      });
      expect(planUpdate).toBeDefined();
    });
  });

  describe("executeApprovedTask — phase execution", () => {
    it("doit executer toutes les etapes du plan dans l'ordre", async () => {
      const deps = createWorkerDeps();
      const worker = new Worker(deps);
      const task = createTestTask({
        status: "approved",
        plan: VALID_PLAN_JSON,
      });

      await worker.executeApprovedTask(task);

      // 2 etapes = 2 appels LLM (+ l'orchestrateur n'est pas appele ici)
      expect(deps.llmProvider.chat).toHaveBeenCalledTimes(2);
      expect(deps.agentRegistry.load).toHaveBeenCalledWith("backend");
      expect(deps.agentRegistry.load).toHaveBeenCalledWith("frontend");
    });

    it("doit creer une branche, commit, push et ouvrir une PR", async () => {
      const deps = createWorkerDeps();
      const worker = new Worker(deps);
      const task = createTestTask({
        status: "approved",
        plan: VALID_PLAN_JSON,
      });

      await worker.executeApprovedTask(task);

      expect(deps.gitService.createBranch).toHaveBeenCalledWith(
        expect.stringContaining("feature/task-")
      );
      expect(deps.gitService.commit).toHaveBeenCalledWith(
        expect.stringContaining(task.title),
        ["src/auth.ts", "src/Login.tsx"]
      );
      expect(deps.gitService.push).toHaveBeenCalled();
      expect(deps.gitService.createPR).toHaveBeenCalled();
    });

    it("doit emettre des evenements agent_started et agent_completed", async () => {
      const eventBus = new InMemoryEventBus();
      const events: TaskEvent[] = [];
      eventBus.onAll((e) => events.push(e));

      const deps = createWorkerDeps({ eventBus });
      const worker = new Worker(deps);
      const task = createTestTask({
        status: "approved",
        plan: VALID_PLAN_JSON,
      });

      await worker.executeApprovedTask(task);

      const agentStarted = events.filter((e) => e.type === "task:agent_started");
      const agentCompleted = events.filter((e) => e.type === "task:agent_completed");
      expect(agentStarted).toHaveLength(2);
      expect(agentCompleted).toHaveLength(2);
    });

    it("doit emettre un evenement pr_opened a la fin", async () => {
      const eventBus = new InMemoryEventBus();
      const events: TaskEvent[] = [];
      eventBus.onAll((e) => events.push(e));

      const deps = createWorkerDeps({ eventBus });
      const worker = new Worker(deps);
      const task = createTestTask({
        status: "approved",
        plan: VALID_PLAN_JSON,
      });

      await worker.executeApprovedTask(task);

      const prEvent = events.find((e) => e.type === "task:pr_opened");
      expect(prEvent).toBeDefined();
      expect(prEvent!.data.prUrl).toBe("https://github.com/test/repo/pull/1");
    });

    it("doit marquer la tache comme failed si un agent echoue", async () => {
      const llmProvider: LLMProvider = {
        chat: vi.fn(async (): Promise<LLMResponse> => ({
          content: "",
          success: false,
          error: "Agent a plante",
        })),
      };

      const deps = createWorkerDeps({ llmProvider, maxRetries: 1 });
      const worker = new Worker(deps);
      const task = createTestTask({
        status: "approved",
        plan: VALID_PLAN_JSON,
      });

      await expect(worker.executeApprovedTask(task)).rejects.toThrow();

      const updateCalls = (deps.taskRepository.update as ReturnType<typeof vi.fn>).mock.calls;
      const lastUpdate = updateCalls[updateCalls.length - 1][0] as Task;
      expect(lastUpdate.status).toBe("failed");
    });

    it("doit executer les etapes paralleles en parallele", async () => {
      const parallelPlan = JSON.stringify({
        summary: "Plan parallele",
        steps: [
          { order: 1, agent: "backend", task: "Etape 1", depends_on: [], parallel: true },
          { order: 2, agent: "frontend", task: "Etape 2", depends_on: [], parallel: true },
          { order: 3, agent: "tests", task: "Etape 3", depends_on: [1, 2], parallel: false },
        ],
        files_impacted: [],
        questions: [],
      });

      const callOrder: string[] = [];
      const llmProvider: LLMProvider = {
        chat: vi.fn(async (_sys, messages): Promise<LLMResponse> => {
          const content = messages[0].content;
          if (content.includes("Etape 1")) callOrder.push("step1");
          if (content.includes("Etape 2")) callOrder.push("step2");
          if (content.includes("Etape 3")) callOrder.push("step3");
          return { content: "done", success: true };
        }),
      };

      const deps = createWorkerDeps({ llmProvider });
      const worker = new Worker(deps);
      const task = createTestTask({
        status: "approved",
        plan: parallelPlan,
      });

      await worker.executeApprovedTask(task);

      // Steps 1 and 2 should run before step 3
      expect(callOrder.indexOf("step3")).toBeGreaterThan(callOrder.indexOf("step1"));
      expect(callOrder.indexOf("step3")).toBeGreaterThan(callOrder.indexOf("step2"));
    });
  });
});
