import { MaestroError } from "../../shared/errors/base-error.js";

export class AgentNotFoundError extends MaestroError {
  constructor(agentName: string) {
    super(
      `Agent "${agentName}" introuvable`,
      "AGENT_NOT_FOUND",
      { agentName },
      "Verifiez le nom de l'agent. Utilisez GET /api/agents pour lister les agents disponibles"
    );
  }
}

export class AgentRegistryError extends MaestroError {
  constructor(message: string, context: Record<string, unknown> = {}, suggestion?: string) {
    super(
      message,
      "AGENT_REGISTRY_ERROR",
      context,
      suggestion
    );
  }
}
