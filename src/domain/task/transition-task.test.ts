import { describe, it, expect } from "vitest";
import { createTask } from "./task.js";
import { transitionTask } from "./transition-task.js";
import { InvalidTaskTransitionError } from "./errors.js";
import type { Task } from "./task.js";
import type { TaskStatus } from "./task-status.js";
import { VALID_TRANSITIONS, TASK_STATUSES } from "./task-status.js";

function taskWithStatus(status: TaskStatus): Task {
  return { ...createTask("Test", "Desc"), status };
}

describe("transitionTask", () => {
  describe("transitions valides", () => {
    const validCases: Array<[TaskStatus, TaskStatus]> = [
      ["inbox", "analyzing"],
      ["analyzing", "ready"],
      ["analyzing", "failed"],
      ["ready", "approved"],
      ["ready", "inbox"],
      ["approved", "running"],
      ["running", "review"],
      ["running", "failed"],
      ["review", "done"],
      ["review", "failed"],
      ["review", "running"],
      ["failed", "inbox"],
    ];

    it.each(validCases)(
      "doit accepter la transition %s → %s",
      (from, to) => {
        const task = taskWithStatus(from);
        const result = transitionTask(task, to);

        expect(result.status).toBe(to);
        expect(result.updatedAt.getTime()).toBeGreaterThanOrEqual(task.updatedAt.getTime());
      }
    );
  });

  describe("transitions invalides", () => {
    const invalidCases: Array<[TaskStatus, TaskStatus]> = [
      ["inbox", "ready"],
      ["inbox", "running"],
      ["inbox", "done"],
      ["analyzing", "approved"],
      ["analyzing", "running"],
      ["ready", "running"],
      ["ready", "done"],
      ["approved", "done"],
      ["approved", "inbox"],
      ["running", "inbox"],
      ["running", "approved"],
      ["done", "inbox"],
      ["done", "running"],
    ];

    it.each(invalidCases)(
      "doit refuser la transition %s → %s",
      (from, to) => {
        const task = taskWithStatus(from);

        expect(() => transitionTask(task, to)).toThrow(InvalidTaskTransitionError);
      }
    );
  });

  it("doit conserver les autres proprietes lors d'une transition", () => {
    const task = taskWithStatus("inbox");
    const result = transitionTask(task, "analyzing");

    expect(result.id).toBe(task.id);
    expect(result.title).toBe(task.title);
    expect(result.description).toBe(task.description);
  });

  it("doit inclure les transitions valides dans le message d'erreur", () => {
    const task = taskWithStatus("inbox");

    try {
      transitionTask(task, "done");
      expect.fail("Aurait du lever une erreur");
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidTaskTransitionError);
      const error = err as InvalidTaskTransitionError;
      expect(error.code).toBe("TASK_INVALID_TRANSITION");
      expect(error.suggestion).toContain("analyzing");
    }
  });
});
