import { MaestroError } from "../../shared/errors/base-error.js";

export class GitError extends MaestroError {
  constructor(operation: string, reason: string, details?: string) {
    super(
      `Echec de l'operation git "${operation}": ${reason}`,
      "GIT_ERROR",
      { operation, reason, details },
      "Verifiez que le repertoire est un depot git initialise et que les outils git/gh sont installes"
    );
  }
}

export class GitBranchExistsError extends MaestroError {
  constructor(branchName: string) {
    super(
      `La branche "${branchName}" existe deja`,
      "GIT_BRANCH_EXISTS",
      { branchName },
      `Supprimez la branche existante ou utilisez un nom different`
    );
  }
}
