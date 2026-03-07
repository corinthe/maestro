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