import { MaestroError } from "../../shared/errors/base-error.js";
import { getValidTransitions } from "./task-status.js";

export class InvalidTaskTransitionError extends MaestroError {
  constructor(taskId: string, from: string, to: string) {
    const validTransitions = getValidTransitions(from as any);
    super(
      `Impossible de passer la tache "${taskId}" de "${from}" a "${to}"`,
      "TASK_INVALID_TRANSITION",
      { taskId, from, to },
      `Transitions valides depuis "${from}": ${validTransitions.join(", ") || "aucune"}`
    );
  }
}

export class TaskNotFoundError extends MaestroError {
  constructor(taskId: string) {
    super(
      `Tache "${taskId}" introuvable`,
      "TASK_NOT_FOUND",
      { taskId },
      "Verifiez l'identifiant de la tache"
    );
  }
}
