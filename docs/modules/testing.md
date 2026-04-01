# Module Testing

## Responsabilité

Stratégie de tests pour valider le fonctionnement de Maestro sans consommer de tokens Claude à chaque exécution.

## Principes

1. **Mock Claude CLI** pour les tests automatisés — pas d'appels réels sauf smoke tests
2. **Tests unitaires** pour la logique pure (parser, args builder, config, DB)
3. **Tests d'intégration** pour les pipelines complets (spawn → parse → DB → WebSocket)
4. **Tests E2E** pour l'UI (Playwright)
5. **Smoke tests** avec le vrai Claude CLI, lancés manuellement

## Mock Claude CLI

Un script qui simule le comportement de Claude CLI en produisant une sortie `stream-json` predéterminée.

### Implementation

```bash
#!/usr/bin/env node
// mock-claude.mjs
// Simule la sortie stream-json de Claude CLI

const events = [
  { type: "system", subtype: "init", session_id: "mock-session-123", model: "claude-sonnet-4-6" },
  { type: "assistant", message: { content: [{ type: "text", text: "I'll start working on this task." }] }, session_id: "mock-session-123" },
  { type: "assistant", message: { content: [{ type: "tool_use", name: "Read", input: { file_path: "/src/index.ts" } }] }, session_id: "mock-session-123" },
  { type: "user", message: { content: [{ type: "tool_result", content: "file contents here" }] } },
  { type: "assistant", message: { content: [{ type: "text", text: "I've read the file. Now I'll make the changes." }] }, session_id: "mock-session-123" },
  { type: "result", subtype: "success", session_id: "mock-session-123", result: "Task completed successfully.", usage: { input_tokens: 1500, output_tokens: 800, cache_read_input_tokens: 500 }, total_cost_usd: 0.012 },
];

// Emit events with realistic delays
for (const event of events) {
  console.log(JSON.stringify(event));
  await new Promise(r => setTimeout(r, 100));
}

process.exit(0);
```

### Variantes de mock

| Scénario | Fichier | Comportement |
|----------|---------|--------------|
| Succès | `mock-claude-success.mjs` | Run normal avec tool calls |
| Échec | `mock-claude-failure.mjs` | Sortie avec `is_error: true` |
| Timeout | `mock-claude-timeout.mjs` | Ne se terminé jamais (pour tester le timeout) |
| Max turns | `mock-claude-max-turns.mjs` | Sortie avec `subtype: "error_max_turns"` |
| Login requis | `mock-claude-login.mjs` | Message "please run claude login" |
| Session inconnue | `mock-claude-bad-session.mjs` | Erreur "unknown session" |

### Injection du mock

```typescript
// En test, on substitue la commande "claude" par le mock
const CLAUDE_COMMAND = process.env.MOCK_CLAUDE
  ? process.env.MOCK_CLAUDE
  : "claude";

spawn(CLAUDE_COMMAND, args, { cwd, env });
```

## Niveaux de tests

### 1. Tests unitaires (Vitest)

Testent la logique pure sans effets de bord.

| Module | Ce qui est teste |
|--------|-----------------|
| `parser.ts` | Parsing des events stream-json, extraction session/cost/usage |
| `args-builder.ts` | Construction des arguments Claude CLI |
| `agent-config.ts` | Lecture et validation des fichiers YAML |
| `orchestrator-prompt.ts` | Construction du prompt de l'orchestrateur |
| `branch-naming.ts` | Conventions de nommage des branches |
| Schéma Drizzle | Validation du schéma, contraintes |

```typescript
// Exemple : test du parser
describe("parseClaudeStreamJson", () => {
  it("extracts session id from init event", () => {
    const stdout = '{"type":"system","subtype":"init","session_id":"abc","model":"claude-sonnet-4-6"}\n';
    const result = parseClaudeStreamJson(stdout);
    expect(result.sessionId).toBe("abc");
    expect(result.model).toBe("claude-sonnet-4-6");
  });

  it("extracts cost from result event", () => {
    const stdout = '{"type":"result","total_cost_usd":0.05,"usage":{"input_tokens":1000,"output_tokens":500}}\n';
    const result = parseClaudeStreamJson(stdout);
    expect(result.costUsd).toBe(0.05);
    expect(result.usage?.inputTokens).toBe(1000);
  });

  it("handles malformed JSON gracefully", () => {
    const stdout = 'not json\n{"type":"result"}\n';
    const result = parseClaudeStreamJson(stdout);
    expect(result.resultJson).toBeTruthy();
  });
});
```

### 2. Tests d'intégration (Vitest + mock CLI)

Testent les pipelines complets avec le mock Claude CLI et une DB SQLite en mémoire.

| Pipeline | Ce qui est teste |
|----------|-----------------|
| Agent run | spawn mock → parse → save events → emit WS |
| Orchestrator run | spawn mock + MCP → décisions → agent launched |
| Heartbeat | tick → orchestrator wake → agent dispatch |
| Session résumé | run succeeds → session saved → next run résumés |
| Stop/restart | SIGTERM → status update → restart with résumé |
| Orphan reaper | stale run détected → marked as failed |
| Log purge | events > 24h deleted |

```typescript
// Exemple : test d'integration d'un run agent
describe("agent run integration", () => {
  let db: TestDb;

  beforeEach(() => {
    db = createTestDb(); // SQLite in-memory
  });

  it("executes a full run with mock claude", async () => {
    const agent = await db.agents.create({ name: "test-agent", ... });
    const feature = await db.features.create({ title: "Test feature", ... });

    const result = await executeRun(agent, {
      featureId: feature.id,
      prompt: "Do the thing",
    }, { claudeCommand: "node ./mocks/mock-claude-success.mjs" });

    expect(result.status).toBe("succeeded");
    expect(result.sessionId).toBe("mock-session-123");
    expect(result.costUsd).toBeGreaterThan(0);

    const events = await db.runEvents.findMany({ runId: result.runId });
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].type).toBe("system");
  });
});
```

### 3. Tests E2E (Playwright)

Testent l'UI complété avec le serveur lancé et le mock Claude CLI.

| Scénario | Ce qui est teste |
|----------|-----------------|
| Initialisation | Page dashboard charge correctement |
| Créer une feature | Formulaire → feature visible dans la liste |
| Créer un agent | Formulaire → agent visible, fichier YAML crée |
| Live view | Run mock → events affichées en temps réel |
| Stop un run | Bouton stop → processus arrête → statut mis à jour |
| Propositions | Proposition d'agent → notification → accepter → agent crée |

```typescript
// Exemple : test E2E de creation de feature
test("create a feature", async ({ page }) => {
  await page.goto("/features");
  await page.click('[data-testid="new-feature"]');
  await page.fill('[name="title"]', "Implement user auth");
  await page.fill('[name="description"]', "JWT-based authentication");
  await page.click('[data-testid="submit"]');

  await expect(page.locator("text=Implement user auth")).toBeVisible();
  await expect(page.locator("text=MAE-1")).toBeVisible();
});
```

### 4. Smoke tests (Claude CLI réel)

Tests manuels ou CI optionnels qui utilisent le vrai Claude CLI. Budgetes et plafonnés.

**Quand les lancer :**
- Avant une release
- Après un changement majeur dans l'adaptateur Claude
- Jamais en CI automatique (cout)

**Ce qu'ils testent :**
- Claude CLI démarre et produit du stream-json valide
- Le parser gère la sortie réelle (pas juste le mock)
- Le résumé de session fonctionne avec le vrai Claude
- Les skills sont correctement injectés

```bash
# Lancer les smoke tests (necessite ANTHROPIC_API_KEY ou claude login)
SMOKE_TEST=true pnpm test:smoke
```

## Structure technique

```
tests/
├── mocks/
│   ├── mock-claude-success.mjs
│   ├── mock-claude-failure.mjs
│   ├── mock-claude-timeout.mjs
│   ├── mock-claude-max-turns.mjs
│   ├── mock-claude-login.mjs
│   └── mock-claude-bad-session.mjs
├── unit/
│   ├── parser.test.ts
│   ├── args-builder.test.ts
│   ├── agent-config.test.ts
│   └── ...
├── integration/
│   ├── agent-run.test.ts
│   ├── orchestrator-run.test.ts
│   ├── heartbeat.test.ts
│   ├── session-resume.test.ts
│   └── ...
├── e2e/
│   ├── playwright.config.ts
│   ├── features.spec.ts
│   ├── agents.spec.ts
│   ├── live-view.spec.ts
│   └── ...
└── smoke/
    ├── real-claude.test.ts
    └── README.md
```

## Configuration CI

```yaml
# Dans .github/workflows/test.yml
jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - run: pnpm test:unit

  integration:
    runs-on: ubuntu-latest
    steps:
      - run: pnpm test:integration

  e2e:
    runs-on: ubuntu-latest
    steps:
      - run: pnpm test:e2e

  # PAS de smoke tests en CI automatique
```
