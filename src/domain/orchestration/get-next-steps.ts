import { ExecutionPlan, PlanStep } from "./execution-plan.js";

export function getNextSteps(plan: ExecutionPlan, completedSteps: number[]): PlanStep[] {
  return plan.steps.filter(step => {
    if (completedSteps.includes(step.order)) return false;
    return step.dependsOn.every(dep => completedSteps.includes(dep));
  });
}
