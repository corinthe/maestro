import { ExecutionPlan } from "./execution-plan.js";

export function isPlanComplete(plan: ExecutionPlan, completedSteps: number[]): boolean {
  return plan.steps.every(step => completedSteps.includes(step.order));
}
