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
