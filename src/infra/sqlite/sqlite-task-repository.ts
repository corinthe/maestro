import type Database from "better-sqlite3";
import type { Task } from "../../domain/task/task.js";
import type { TaskStatus } from "../../domain/task/task-status.js";
import type { TaskRepository } from "../../domain/task/task-repository.js";

interface TaskRow {
  id: string;
  title: string;
  description: string;
  status: string;
  plan: string | null;
  branch: string | null;
  pr_url: string | null;
  agent_logs: string | null;
  created_at: string;
  updated_at: string;
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status as TaskStatus,
    plan: row.plan,
    branch: row.branch,
    prUrl: row.pr_url,
    agentLogs: row.agent_logs,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export class SqliteTaskRepository implements TaskRepository {
  constructor(private readonly db: Database.Database) {}

  create(task: Task): Task {
    this.db
      .prepare(
        `INSERT INTO tasks (id, title, description, status, plan, branch, pr_url, agent_logs, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        task.id,
        task.title,
        task.description,
        task.status,
        task.plan,
        task.branch,
        task.prUrl,
        task.agentLogs,
        task.createdAt.toISOString(),
        task.updatedAt.toISOString()
      );

    return task;
  }

  findById(id: string): Task | null {
    const row = this.db
      .prepare("SELECT * FROM tasks WHERE id = ?")
      .get(id) as TaskRow | undefined;

    return row ? rowToTask(row) : null;
  }

  findAll(): Task[] {
    const rows = this.db
      .prepare("SELECT * FROM tasks ORDER BY created_at DESC")
      .all() as TaskRow[];

    return rows.map(rowToTask);
  }

  findByStatus(status: TaskStatus): Task[] {
    const rows = this.db
      .prepare("SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC")
      .all(status) as TaskRow[];

    return rows.map(rowToTask);
  }

  update(task: Task): Task {
    this.db
      .prepare(
        `UPDATE tasks SET title = ?, description = ?, status = ?, plan = ?, branch = ?, pr_url = ?, agent_logs = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        task.title,
        task.description,
        task.status,
        task.plan,
        task.branch,
        task.prUrl,
        task.agentLogs,
        task.updatedAt.toISOString(),
        task.id
      );

    return task;
  }

  delete(id: string): boolean {
    const result = this.db
      .prepare("DELETE FROM tasks WHERE id = ?")
      .run(id);

    return result.changes > 0;
  }
}
