# Maestro

> Local dashboard to coordinate AI agents working together on your codebase. Define specialized agents, give them a goal, and watch them collaborate — one orchestrates, the others execute.

---

## What is Maestro?

Maestro is a local developer tool that runs AI agents in parallel on your project. Each agent has a specific role and personality — backend, security, testing, UX — and a dedicated orchestrator coordinates their work, assigns tasks, and prevents conflicts.

You keep full control: agents modify code locally, you decide when to commit and push.

## How it works

1. **Initialize** Maestro in any existing project with `maestro init`
2. **Define your agents** in a simple YAML file (role, personality, model)
3. **Give a goal** — paste a Jira ticket, write a description, or add tasks manually
4. **Watch** the dashboard as the orchestrator plans, assigns, and coordinates
5. **Review** the changes and commit when you're satisfied

## Key concepts

- **Orchestrator** — a dedicated AI agent that plans, decomposes goals into tasks, assigns work, and resolves scheduling conflicts. It never writes code.
- **Specialized agents** — each agent has a focused role and only receives the context it needs for its current task.
- **File-based coordination** — all state lives in a `.ai-agents/` folder in your project. No database, no cloud sync.
- **Persistent memory** — agents remember important discoveries (patterns, pitfalls, conventions) across sessions, not the details of past tasks.
- **Event-driven orchestrator** — the orchestrator wakes up on filesystem signals, keeping token usage low between events.
- **Human-in-the-loop** — conflicts and decisions requiring judgment are surfaced to you in a dedicated queue in the dashboard.

## Quick start

```bash
# Install globally
npm install -g maestro-agents

# Initialize in your project
cd my-project
maestro init

# Start the dashboard
maestro start
# → Dashboard available at http://localhost:7842
```

## Setup guide

### 1. Install Maestro

```bash
npm install -g maestro-agents
```

Requires **Node.js 18+**.

### 2. Initialize your project

Navigate to your project root and run:

```bash
maestro init
```

The CLI will ask you three questions:

| Question | Example | Used in |
|---|---|---|
| **Project name** | `my-app` | `project.yaml` |
| **Tech stack** (comma-separated) | `TypeScript, React, PostgreSQL` | `project.yaml` |
| **Main conventions** (comma-separated) | `ESLint, Prettier, conventional commits` | `project.yaml` |

This creates the `.ai-agents/` directory with all required files:

- `config/agents.yaml` — pre-filled with 5 commented agent templates (backend, frontend, security, testing, documentation). Uncomment and customize the ones you need.
- `config/project.yaml` — your project context, generated from your answers.
- `orchestrator/` — plan, task graph, and decisions log (empty placeholders).
- `tasks/backlog.yaml` — empty task backlog, ready for objectives.
- `agents/`, `signals/`, `logs/`, `human-queue/` — runtime directories.

> If a `.ai-agents/` directory already exists, `maestro init` will ask before reinitializing and will preserve existing files.

### 3. Configure your agents

Edit `.ai-agents/config/agents.yaml` to define the agents you want. Each agent needs a name, role, runner, and system prompt:

```yaml
agents:
  - name: backend
    role: "Backend developer"
    runner: claude-code
    systemPrompt: |
      You are a backend developer. You write clean, tested,
      production-ready server-side code.

  - name: testing
    role: "QA engineer"
    runner: claude-code
    systemPrompt: |
      You are a QA engineer. Write comprehensive test suites.
```

### 4. Update your `.gitignore`

After running `maestro init`, the CLI suggests lines to add to your `.gitignore`. Runtime files (logs, signals, in-progress tasks) should not be versioned:

```gitignore
# Maestro runtime files
.ai-agents/logs/
.ai-agents/signals/
.ai-agents/agents/*/current-context.md
.ai-agents/tasks/in-progress/
.ai-agents/tasks/done/
```

**Recommended to version:** `agents.yaml`, `project.yaml`, `tasks/backlog.yaml`, and agent `memory.md` files.

### 5. Start Maestro

```bash
maestro start
```

This launches:

- **Server** — serves the dashboard at `http://localhost:7842` with WebSocket for real-time updates.
- **Dispatcher** — routes incoming signals to the appropriate orchestrator handler.
- **Watcher** — monitors `.ai-agents/signals/` for filesystem events and feeds them to the dispatcher.

Press `Ctrl+C` to stop all processes gracefully.

### Signal flow

When `maestro start` is running, the system reacts to signal files dropped in `.ai-agents/signals/`:

| Signal | What happens |
|---|---|
| `new-objective` | Planner decomposes the objective into tasks → scheduler assigns them to available agents → runners are launched |
| `task-completed` | Consolidator archives the task and updates agent memory → scheduler picks the next ready tasks |
| `task-blocked` | Task moved to `blocked/` → WebSocket notification sent to dashboard |
| `agent-error` | Escalated to `human-queue/` → WebSocket notification sent to dashboard |
| `wake` | Triggers a scheduling cycle (useful to resume after manual edits) |

Each runner emits a signal on completion, creating a self-sustaining loop: **signal → dispatch → schedule → run → signal**.

### Prerequisites

- **Node.js 18+**
- **Claude Code CLI** installed and authenticated (used as the default agent runner in v1).

## Dashboard

The local web dashboard gives you a live view of:

- Agent status (idle / working / waiting)
- Task kanban (backlog / in-progress / done / blocked)
- Active file locks — which agent is touching what
- Orchestrator plan
- Log stream per agent
- Human queue — items that need your attention

## File structure

Maestro creates a `.ai-agents/` folder in your project:

```
.ai-agents/
  config/
    agents.yaml        ← agent definitions and prompts
    project.yaml       ← project context and conventions
  orchestrator/
    plan.md
    task-graph.json
    decisions.md
  tasks/
    backlog.yaml
    in-progress/
    done/
    blocked/
  agents/
    backend/
      state.json
      memory.md        ← persistent memory (versioned)
    security/
      ...
  signals/             ← event triggers (auto-managed)
  logs/
  human-queue/         ← items needing developer attention
```

You choose what to version. Recommended: version `agents.yaml`, `project.yaml`, `tasks/backlog.yaml`, and agent `memory.md` files.

## AI provider support

| Provider | Status |
|---|---|
| Claude Code CLI (subscription) | ✅ v1 |
| Anthropic API (key) | 🔜 v2 |
| OpenAI API (key) | 🔜 v2 |

## Roadmap

- **v1** — Core orchestration, Claude Code CLI runner, local dashboard, file-based state
- **v2** — API runners (Anthropic, OpenAI), richer dashboard (dependency graph, diff viewer)
- **v3** — Story Discovery mode (AI-assisted user story writing), optional Jira integration

## Philosophy

Maestro doesn't replace the developer — it multiplies them. You define the vision, review the work, and stay in charge of what gets shipped.