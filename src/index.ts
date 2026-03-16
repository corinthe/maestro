import { createServer } from "node:http";
import { join } from "node:path";
import { logger } from "./shared/index.js";
import { createApp } from "./api/app.js";
import { FileSystemAgentRegistry } from "./infra/filesystem/filesystem-agent-registry.js";
import { InMemoryTaskQueue } from "./infra/queue/in-memory-task-queue.js";
import { InMemoryEventBus } from "./infra/events/in-memory-event-bus.js";
import { CliGitService } from "./infra/git/cli-git-service.js";
import { MaestroWebSocketServer } from "./infra/websocket/websocket-server.js";
import { Worker } from "./domain/orchestration/worker.js";
import { ClaudeCliProvider } from "./infra/llm/claude-cli-provider.js";
import { SqliteTaskRepository } from "./infra/sqlite/sqlite-task-repository.js";
import { SqliteExecutionRepository } from "./infra/sqlite/sqlite-execution-repository.js";
import { createDatabase } from "./infra/sqlite/database.js";
import { FileSystemProjectLoader } from "./infra/filesystem/filesystem-project-loader.js";

const PORT = Number(process.env.PORT ?? 4000);
const AGENTS_DIR = process.env.AGENTS_DIR ?? join(process.cwd(), "agents");
const SHARED_DIR = process.env.SHARED_DIR ?? join(process.cwd(), "agents", "shared");
const WORKING_DIR = process.env.WORKING_DIR ?? process.cwd();

// Infrastructure
const db = createDatabase(process.env.DB_PATH);
const agentRegistry = new FileSystemAgentRegistry(AGENTS_DIR, SHARED_DIR);
const taskQueue = new InMemoryTaskQueue();
const eventBus = new InMemoryEventBus();
const llmProvider = new ClaudeCliProvider();
const gitService = new CliGitService(WORKING_DIR);
const taskRepository = new SqliteTaskRepository(db);
const executionRepository = new SqliteExecutionRepository(db);
const projectLoader = new FileSystemProjectLoader();

// Worker
const worker = new Worker({
  taskQueue,
  taskRepository,
  agentRegistry,
  llmProvider,
  gitService,
  eventBus,
  workingDir: WORKING_DIR,
  projectLoader,
  executionRepository,
});

// App
const app = createApp({ db, agentRegistry, projectLoader, taskQueue, worker, workingDir: WORKING_DIR, eventBus });
const httpServer = createServer(app);

// WebSocket
const wss = new MaestroWebSocketServer(httpServer, eventBus);

// Graceful shutdown
function shutdown(signal: string): void {
  logger.info({ signal }, "Signal recu, arret en cours...");

  worker.stop();

  wss.close();

  httpServer.close(() => {
    db.close();
    logger.info("Arret termine");
    process.exit(0);
  });

  // Forcer l'arret si le serveur ne se ferme pas dans les 10s
  setTimeout(() => {
    logger.error("Arret force apres timeout");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Demarrage
worker.start();

httpServer.listen(PORT, () => {
  logger.info({ port: PORT, agentsDir: AGENTS_DIR, workingDir: WORKING_DIR }, "Maestro backend demarre");
});
