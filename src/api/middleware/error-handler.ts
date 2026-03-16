import type { Request, Response, NextFunction } from "express";
import { MaestroError } from "../../shared/errors/base-error.js";
import { logger } from "../../shared/logger.js";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof MaestroError) {
    logger.warn({ code: err.code, context: err.context }, err.message);
    const status = getHttpStatus(err.code);
    res.status(status).json({
      code: err.code,
      message: err.message,
      suggestion: err.suggestion,
      details: err.context,
    });
    return;
  }

  logger.error({ error: err.message, stack: err.stack }, "Erreur inattendue");
  res.status(500).json({
    code: "INTERNAL_ERROR",
    message: "Une erreur inattendue est survenue",
    suggestion: "Verifiez les logs du serveur",
  });
}

function getHttpStatus(code: string): number {
  switch (code) {
    case "TASK_NOT_FOUND":
    case "AGENT_NOT_FOUND":
      return 404;
    case "TASK_INVALID_TRANSITION":
      return 422;
    case "VALIDATION_ERROR":
    case "AGENT_REGISTRY_ERROR":
    case "INVALID_PLAN":
    case "PROJECT_CONFIG_ERROR":
    case "PROJECT_CONFIG_LOCKED":
      return 400;
    case "PLAN_EXECUTION_ERROR":
    case "GIT_ERROR":
      return 500;
    case "GIT_BRANCH_EXISTS":
      return 409;
    default:
      return 400;
  }
}
