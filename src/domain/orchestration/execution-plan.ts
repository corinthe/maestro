import { z } from "zod";

export interface PlanStep {
  order: number;
  agent: string;
  task: string;
  dependsOn: number[];
  parallel: boolean;
}

export interface ExecutionPlan {
  summary: string;
  steps: PlanStep[];
  filesImpacted: string[];
  questions: string[];
}

export const planStepSchema = z.object({
  order: z.number().int().positive(),
  agent: z.string().min(1),
  task: z.string().min(1),
  depends_on: z.array(z.number().int()).default([]),
  parallel: z.boolean().default(false),
});

export const executionPlanSchema = z.object({
  summary: z.string().min(1),
  steps: z.array(planStepSchema).min(1),
  files_impacted: z.array(z.string()).default([]),
  questions: z.array(z.string()).default([]),
});
