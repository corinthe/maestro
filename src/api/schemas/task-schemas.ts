import { z } from "zod";
import { TASK_STATUSES } from "../../domain/task/task-status.js";

export const createTaskSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  description: z.string().min(1, "La description est requise"),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  status: z.enum(TASK_STATUSES).optional(),
});

export const statusQuerySchema = z.object({
  status: z.enum(TASK_STATUSES).optional(),
});
