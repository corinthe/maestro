# LLM Provider : couche d'abstraction

## Principe

L'orchestrateur ne sait pas comment le LLM est appele. Il passe par un provider qui expose une interface commune. Cela permet de changer de backend (CLI claude, API Anthropic, API OpenAI) sans modifier la logique d'orchestration.

## Interface commune

```javascript
class LLMProvider {
  /**
   * Envoie un prompt a un LLM et retourne sa reponse.
   *
   * @param {string} systemPrompt - Le template de l'agent (contenu du SOUL.md)
   * @param {Array<{role: string, content: string}>} messages - Messages de conversation
   * @param {string} workingDir - Dossier de travail (le repo cible)
   * @param {object} options - Options supplementaires
   * @param {number} options.timeout - Timeout en ms (defaut: 300000)
   * @param {function} options.onOutput - Callback pour le streaming (chunk) => void
   * @returns {Promise<{content: string, success: boolean, error?: string}>}
   */
  async chat(systemPrompt, messages, workingDir, options = {}) {
    throw new Error("Not implemented");
  }
}
```

## Implementation MVP : ClaudeCliProvider

Utilise la CLI `claude` (Claude Code) en sous-processus.

```javascript
const { execFile } = require("child_process");

class ClaudeCliProvider extends LLMProvider {
  async chat(systemPrompt, messages, workingDir, options = {}) {
    const { timeout = 300000, onOutput } = options;

    // Construire le prompt complet
    const lastMessage = messages[messages.length - 1].content;
    const prompt = this.buildPrompt(systemPrompt, lastMessage);

    return new Promise((resolve, reject) => {
      const proc = execFile("claude", [
        "--print",
        "--dangerously-skip-permissions",
        "--output-format", "json",
        "-p", prompt
      ], {
        cwd: workingDir,
        maxBuffer: 10 * 1024 * 1024,
        timeout
      });

      let output = "";

      proc.stdout.on("data", (chunk) => {
        output += chunk;
        if (onOutput) onOutput(chunk.toString());
      });

      proc.on("close", (code) => {
        if (code === 0) {
          resolve({ content: output, success: true });
        } else {
          resolve({ content: output, success: false, error: `Exit code ${code}` });
        }
      });

      proc.on("error", (err) => {
        resolve({ content: "", success: false, error: err.message });
      });
    });
  }

  buildPrompt(systemPrompt, task) {
    return [
      "=== ROLE ===",
      systemPrompt,
      "",
      "=== TACHE ===",
      task
    ].join("\n");
  }
}
```

### Avantages de cette implementation

- **Tool use integre** : Claude Code sait deja lire/ecrire des fichiers, executer des commandes shell, chercher dans le code. Pas besoin de reimplementer la boucle tool use.
- **Contexte automatique** : Claude Code explore le repo de lui-meme pour comprendre le contexte. Pas besoin d'envoyer tous les fichiers manuellement.
- **Cout forfaitaire** : utilise l'abonnement Claude Code existant.

### Limites

- **Pas de controle fin** : on ne peut pas choisir le modele (Opus, Sonnet, Haiku) par agent.
- **Pas de metriques de tokens** : l'abonnement est forfaitaire, on ne sait pas combien chaque tache consomme.
- **Rate limits** : l'abonnement a des limites d'usage qui peuvent bloquer si trop d'agents tournent en parallele.

## Implementation future : AnthropicProvider

```javascript
const Anthropic = require("@anthropic-ai/sdk");

class AnthropicProvider extends LLMProvider {
  constructor(apiKey, defaultModel = "claude-sonnet-4-6-20250514") {
    super();
    this.client = new Anthropic({ apiKey });
    this.model = defaultModel;
  }

  async chat(systemPrompt, messages, workingDir, options = {}) {
    const tools = this.getTools(); // read_file, write_file, run_command, etc.

    let conversationMessages = [...messages];
    let finalContent = "";

    // Boucle tool use
    while (true) {
      const response = await this.client.messages.create({
        model: this.model,
        system: systemPrompt,
        messages: conversationMessages,
        tools,
        max_tokens: 4096
      });

      // Collecter le texte
      for (const block of response.content) {
        if (block.type === "text") {
          finalContent += block.text;
          if (options.onOutput) options.onOutput(block.text);
        }
      }

      // Si pas de tool use, c'est fini
      if (response.stop_reason === "end_turn") {
        return { content: finalContent, success: true };
      }

      // Executer les tool calls
      if (response.stop_reason === "tool_use") {
        const toolResults = [];

        for (const block of response.content) {
          if (block.type === "tool_use") {
            const result = await this.executeTool(block.name, block.input, workingDir);
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: result
            });
          }
        }

        // Ajouter a la conversation et continuer
        conversationMessages.push({ role: "assistant", content: response.content });
        conversationMessages.push({ role: "user", content: toolResults });
      }
    }
  }

  async executeTool(name, input, workingDir) {
    switch (name) {
      case "read_file":
        return fs.readFileSync(path.join(workingDir, input.path), "utf-8");
      case "write_file":
        fs.writeFileSync(path.join(workingDir, input.path), input.content);
        return "File written successfully";
      case "run_command":
        return execSync(input.command, { cwd: workingDir }).toString();
      case "search_code":
        return execSync(`grep -r "${input.pattern}" . --include="*.ts" --include="*.js" -l`,
          { cwd: workingDir }).toString();
      default:
        return `Unknown tool: ${name}`;
    }
  }

  getTools() {
    return [
      {
        name: "read_file",
        description: "Lire le contenu d'un fichier",
        input_schema: {
          type: "object",
          properties: { path: { type: "string" } },
          required: ["path"]
        }
      },
      {
        name: "write_file",
        description: "Ecrire dans un fichier",
        input_schema: {
          type: "object",
          properties: {
            path: { type: "string" },
            content: { type: "string" }
          },
          required: ["path", "content"]
        }
      },
      {
        name: "run_command",
        description: "Executer une commande shell",
        input_schema: {
          type: "object",
          properties: { command: { type: "string" } },
          required: ["command"]
        }
      },
      {
        name: "search_code",
        description: "Chercher un pattern dans le code",
        input_schema: {
          type: "object",
          properties: { pattern: { type: "string" } },
          required: ["pattern"]
        }
      }
    ];
  }
}
```

## Migration

Pour passer du MVP a l'API directe :

```javascript
// Avant (MVP)
const provider = new ClaudeCliProvider();

// Apres (production)
const provider = new AnthropicProvider(process.env.ANTHROPIC_API_KEY, "claude-sonnet-4-6-20250514");

// Rien d'autre ne change
const orchestrator = new Orchestrator(provider);
```
