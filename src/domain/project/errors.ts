import { MaestroError } from "../../shared/errors/base-error.js";

export class ProjectConfigError extends MaestroError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(
      message,
      "PROJECT_CONFIG_ERROR",
      context,
      "Verifiez le fichier maestro.config.json et les variables d'environnement"
    );
  }
}

export class SoulFileError extends MaestroError {
  constructor(filePath: string, cause: string) {
    super(
      `Impossible de lire le fichier SOUL.md: ${cause}`,
      "SOUL_FILE_ERROR",
      { filePath, cause },
      "Verifiez que le fichier SOUL.md existe et est lisible dans le repertoire du projet"
    );
  }
}
