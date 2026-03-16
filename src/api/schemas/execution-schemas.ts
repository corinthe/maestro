import { z } from "zod";
import { executionPlanSchema } from "../../domain/orchestration/execution-plan.js";

export const updatePlanSchema = executionPlanSchema;

export const retryStepSchema = z.object({
  feedback: z.string().optional(),
});

export const retryTaskSchema = z.object({
  feedback: z.string().optional(),
});

export const answerQuestionsSchema = z.object({
  answers: z.array(
    z.object({
      question: z.string().min(1),
      answer: z.string().min(1),
    })
  ).min(1, "Au moins une reponse est requise"),
});
