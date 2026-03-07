# Architecture

## Overview

Maestro is a Node.js (TypeScript) monorepo that runs locally alongside any project. It consists of three main processes running together:

1. **Watcher** — monitors `.ai-agents/signals/` for filesystem events
2. **Orchestrator** — invoked by the watcher, plans and coordinates agent work
3. **Server** — serves the dashboard and pushes real-time updates via WebSocket

---

## Package structure

```
maestro/
  packages/
    core/               ← shared types and file primitives
    watcher/            ← filesystem event loop
    runners/            ← agent execution adapters
    orchestrator/       ← planning, scheduling, consolidation
    server/             ← Express + WebSocket + React dashboard
```

### `core`

The foundation. No framework dependencies.

- `types.ts` — all shared TypeScript types: `Task`, `Agent`, `Signal`, `Lock`, `AgentState`, `HumanQueueItem`
- `file-store.ts` — read/write primitives for `.ai-agents/` files (YAML, JSON, Markdown)
- `task-graph.ts` — dependency resolution and conflict detection between tasks
- `signal-bus.ts` — emit and consume signal files

### `watcher`

A persistent process using **chokidar** that watches `.ai-agents/signals/`.

- On any `.signal` file creation: reads the signal, routes it to the appropriate handler
- Handlers: `task-completed`, `task-blocked`, `new-objective`, `agent-error`
- After routing: deletes the signal file
- Invokes the orchestrator process for signals that require planning decisions

### `runners`

An abstraction layer for agent execution. Each runner implements the `AgentRunner` interface:

```typescript
interface AgentRunner {
  run(agent: Agent, contextPath: string): Promise<AgentRunResult>
  isAvailable(): Promise<boolean>
}
```

**`ClaudeCodeRunner` (v1)**
- Spawns a `claude --print` subprocess in the target project directory
- Pipes `current-context.md` as input
- Captures stdout as the agent's response/summary
- Handles timeouts and process errors

**`AnthropicApiRunner` (v2)**
- Direct API calls with full tool use control
- Requires `ANTHROPIC_API_KEY` in environment

### `orchestrator`

Invoked as a short-lived process by the watcher. Stateless between invocations — all state lives in `.ai-agents/` files.

- `planner.ts` — decomposes a high-level objective into atomic tasks, writes to `backlog.yaml`
- `scheduler.ts` — picks next assignable tasks, checks locks, builds `current-context.md` for each agent, starts runners
- `consolidator.ts` — processes completed tasks, updates task graph, triggers next assignments, updates agent memory prompt
- `conflict-detector.ts` — compares `files-locked` across in-progress tasks, routes conflicts to `human-queue/`

### `server`

A single Express server that:
- Serves the React dashboard (static build)
- Exposes a REST API for dashboard interactions (create task, pause agent, resolve human queue item)
- Pushes real-time updates to the dashboard via **WebSocket** (SSE as fallback)

The server watches `.ai-agents/` independently (read-only) to push live state to connected clients.

---

## The signal system

Signals are the coordination backbone. Any process (agent, orchestrator, dashboard) can create a signal file. The watcher consumes and deletes it.

```
.ai-agents/signals/
  new-objective.signal
  task-{id}-done.signal
  task-{id}-blocked.signal
  wake.signal
```

Signal file format (YAML):

```yaml
type: task-completed
task-id: task-42
agent: backend
summary: "Implemented POST /users endpoint, 3 files modified"
timestamp: 2025-03-07T10:45:00Z
```

---

## File lock mechanism

Before assigning a task to an agent, the orchestrator reads all `in-progress/*.yaml` files and collects their `files-locked` arrays. If any file in the new task's expected scope overlaps, the orchestrator either:

- **Serializes** — keeps the task in backlog until the lock is released
- **Escalates** — if ambiguous, creates a `human-queue/` item for developer input

Lock format in `in-progress/task-42.yaml`:

```yaml
id: task-42
agent: backend
title: "Add POST /users endpoint"
files-locked:
  - src/controllers/users.ts
  - src/routes/users.ts
started-at: 2025-03-07T10:23:00Z
```

Locks are released when the task moves to `done/` or `blocked/`.

---

## Agent context injection

When assigning a task, the orchestrator builds `current-context.md` for the target agent. This file is the agent's complete input. It contains:

1. The agent's role and personality (from `agents.yaml`)
2. The task description and acceptance criteria
3. Relevant files to read (not the full project)
4. Files the agent is allowed to modify
5. Files explicitly off-limits (locked by other agents)
6. The agent's persistent memory (`memory.md`)
7. The signal file path to write upon completion

The `current-context.md` is deleted after the task completes.

---

## Agent memory

Each agent maintains a `memory.md` file that persists across sessions. The agent itself updates this file at the end of each task (as part of its instructions).

What goes in memory:
- Discovered patterns and conventions in the codebase
- Encountered errors and their solutions
- Project-specific constraints
- Architectural decisions relevant to the agent's domain

What does not go in memory:
- Task-specific details (those go in `done/task-XX.yaml`)
- Modified file lists

The orchestrator's equivalent is `orchestrator/decisions.md`.

---

## Integration into an existing project

Maestro is installed globally and initialized per-project:

```bash
npm install -g maestro-agents
cd existing-project
maestro init    # creates .ai-agents/, asks 3 setup questions
maestro start   # starts watcher + server on localhost:7842
```

`maestro init` does not modify any existing project files. It only creates `.ai-agents/` and suggests additions to `.gitignore`.

Recommended `.gitignore` additions:
```
.ai-agents/logs/
.ai-agents/signals/
.ai-agents/agents/*/current-context.md
.ai-agents/tasks/in-progress/
.ai-agents/tasks/done/
```

Recommended to version:
```
.ai-agents/config/
.ai-agents/tasks/backlog.yaml
.ai-agents/agents/*/memory.md
.ai-agents/orchestrator/decisions.md
```

---

## Tech stack

| Concern | Choice | Reason |
|---|---|---|
| Runtime | Node.js + TypeScript | Event-driven, native async, strong ecosystem |
| Filesystem watching | chokidar | Mature, cross-platform, reliable |
| Config/state files | YAML + JSON | Human-readable, versionable |
| Server | Express | Minimal, sufficient |
| Real-time | WebSocket (ws) | Simple push to dashboard |
| Dashboard | React + Tailwind | Component model fits the UI |
| Monorepo | npm workspaces | No heavy tooling required |
| Agent runner v1 | Claude Code CLI | Uses existing subscription |
| Agent runner v2 | Anthropic API | Full control, no CLI dependency |