import { MaestroError } from "../../shared/errors/base-error.js";

export class InvalidPlanError extends MaestroError {
  constructor(message: string, rawInput: string) {
    super(
      message,
      "INVALID_PLAN",
      { rawInput: rawInput.substring(0, 500) },
      "Verifiez que la sortie de l'orchestrateur est un JSON valide avec les champs: summary, steps, files_impacted, questions"
    );
  }
}

export class PlanExecutionError extends MaestroError {
  constructor(stepOrder: number, agent: string, reason: string) {
    super(
      `Echec de l'etape ${stepOrder} (agent: ${agent}): ${reason}`,
      "PLAN_EXECUTION_ERROR",
      { stepOrder, agent, reason },
      "Consultez les logs de l'agent pour identifier la cause de l'echec"
    );
  }
}

export class ExecutionNotFoundError extends MaestroError {
  constructor(executionId: string) {
    super(
      `Execution "${executionId}" introuvable`,
      "EXECUTION_NOT_FOUND",
      { executionId },
      "Verifiez l'identifiant de l'execution"
    );
  }
}

export class StepNotRetryableError extends MaestroError {
  constructor(taskId: string, stepOrder: number, currentStatus: string) {
    super(
      `L'etape ${stepOrder} de la tache "${taskId}" ne peut pas etre relancee (statut: ${currentStatus})`,
      "STEP_NOT_RETRYABLE",
      { taskId, stepOrder, currentStatus },
      "Seules les etapes en statut 'failed' peuvent etre relancees"
    );
  }
}

export class PlanNotEditableError extends MaestroError {
  constructor(taskId: string, currentStatus: string) {
    super(
      `Le plan de la tache "${taskId}" ne peut pas etre modifie (statut: ${currentStatus})`,
      "PLAN_NOT_EDITABLE",
      { taskId, currentStatus },
      "Le plan ne peut etre modifie que quand la tache est en statut 'ready'"
    );
  }
}
