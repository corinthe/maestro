import { ExecutionPlan, executionPlanSchema } from "./execution-plan.js";
import { InvalidPlanError } from "./errors.js";

export function parsePlan(rawJson: string): ExecutionPlan {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new InvalidPlanError("Le JSON du plan est invalide", rawJson);
  }

  const result = executionPlanSchema.safeParse(parsed);
  if (!result.success) {
    throw new InvalidPlanError(
      `Le plan ne respecte pas le schema attendu: ${result.error.issues.map(i => i.message).join(", ")}`,
      rawJson
    );
  }

  const data = result.data;
  return {
    summary: data.summary,
    steps: data.steps.map(s => ({
      order: s.order,
      agent: s.agent,
      task: s.task,
      dependsOn: s.depends_on,
      parallel: s.parallel,
    })),
    filesImpacted: data.files_impacted,
    questions: data.questions,
  };
}
