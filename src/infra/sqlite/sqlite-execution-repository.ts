import type Database from "better-sqlite3";
import type { ExecutionRepository } from "../../domain/orchestration/execution-repository.js";
import type { TaskExecution, ExecutionStatus, StepExecution } from "../../domain/orchestration/task-execution.js";
import type { StepStatus } from "../../domain/orchestration/step-status.js";
import type { ExecutionPlan } from "../../domain/orchestration/execution-plan.js";

interface ExecutionRow {
  id: string;
  task_id: string;
  plan: string;
  status: string;
  started_at: string;
  completed_at: string | null;
}

interface StepRow {
  id: number;
  execution_id: string;
  step_order: number;
  agent: string;
  task: string;
  status: string;
  output: string | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  attempt: number;
  feedback: string | null;
}

function rowToStepExecution(row: StepRow): StepExecution {
  return {
    stepOrder: row.step_order,
    agent: row.agent,
    task: row.task,
    status: row.status as StepStatus,
    output: row.output,
    error: row.error,
    startedAt: row.started_at ? new Date(row.started_at) : null,
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    attempt: row.attempt,
    feedback: row.feedback,
  };
}

export class SqliteExecutionRepository implements ExecutionRepository {
  constructor(private readonly db: Database.Database) {}

  create(execution: TaskExecution): TaskExecution {
    const insertExecution = this.db.prepare(
      `INSERT INTO task_executions (id, task_id, plan, status, started_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    const insertStep = this.db.prepare(
      `INSERT INTO step_executions (execution_id, step_order, agent, task, status, output, error, started_at, completed_at, attempt, feedback)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const transaction = this.db.transaction(() => {
      insertExecution.run(
        execution.id,
        execution.taskId,
        JSON.stringify(execution.plan),
        execution.status,
        execution.startedAt.toISOString(),
        execution.completedAt?.toISOString() ?? null,
      );

      for (const step of execution.steps) {
        insertStep.run(
          execution.id,
          step.stepOrder,
          step.agent,
          step.task,
          step.status,
          step.output,
          step.error,
          step.startedAt?.toISOString() ?? null,
          step.completedAt?.toISOString() ?? null,
          step.attempt,
          step.feedback,
        );
      }
    });

    transaction();
    return execution;
  }

  findById(id: string): TaskExecution | null {
    const row = this.db
      .prepare("SELECT * FROM task_executions WHERE id = ?")
      .get(id) as ExecutionRow | undefined;

    if (!row) return null;

    return this.buildExecution(row);
  }

  findByTaskId(taskId: string): TaskExecution[] {
    const rows = this.db
      .prepare("SELECT * FROM task_executions WHERE task_id = ? ORDER BY started_at ASC")
      .all(taskId) as ExecutionRow[];

    return rows.map((row) => this.buildExecution(row));
  }

  findLatestByTaskId(taskId: string): TaskExecution | null {
    const row = this.db
      .prepare("SELECT * FROM task_executions WHERE task_id = ? ORDER BY started_at DESC LIMIT 1")
      .get(taskId) as ExecutionRow | undefined;

    if (!row) return null;

    return this.buildExecution(row);
  }

  update(execution: TaskExecution): TaskExecution {
    const updateExecution = this.db.prepare(
      `UPDATE task_executions SET status = ?, completed_at = ? WHERE id = ?`
    );

    const updateStep = this.db.prepare(
      `UPDATE step_executions SET status = ?, output = ?, error = ?, started_at = ?, completed_at = ?, attempt = ?, feedback = ?
       WHERE execution_id = ? AND step_order = ?`
    );

    const transaction = this.db.transaction(() => {
      updateExecution.run(
        execution.status,
        execution.completedAt?.toISOString() ?? null,
        execution.id,
      );

      for (const step of execution.steps) {
        updateStep.run(
          step.status,
          step.output,
          step.error,
          step.startedAt?.toISOString() ?? null,
          step.completedAt?.toISOString() ?? null,
          step.attempt,
          step.feedback,
          execution.id,
          step.stepOrder,
        );
      }
    });

    transaction();
    return execution;
  }

  private buildExecution(row: ExecutionRow): TaskExecution {
    const stepRows = this.db
      .prepare("SELECT * FROM step_executions WHERE execution_id = ? ORDER BY step_order ASC")
      .all(row.id) as StepRow[];

    return {
      id: row.id,
      taskId: row.task_id,
      plan: JSON.parse(row.plan) as ExecutionPlan,
      steps: stepRows.map(rowToStepExecution),
      status: row.status as ExecutionStatus,
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
    };
  }
}
