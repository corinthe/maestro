# Features

## v1 — Core (MVP)

### Initialization
- `maestro init` command — scaffolds `.ai-agents/` in any existing project
- Interactive setup: project name, stack, main conventions
- Auto-generates `agents.yaml` with commented examples
- Suggests `.gitignore` additions without modifying existing files

### Agent definition
- Define agents in `agents.yaml` — name, role, system prompt, runner
- Built-in agent templates: backend, frontend, security, testing, documentation
- Each agent has a persistent `memory.md` updated across sessions
- Agent scope: receives only the context needed for its current task

### Orchestrator
- Dedicated orchestrator agent — plans, decomposes, assigns, never writes code
- Event-driven: wakes up on filesystem signals, sleeps between events
- Decomposes a high-level objective into atomic tasks
- Builds a dependency graph between tasks
- Assigns tasks to agents based on role and availability
- Detects file-level conflicts before assigning parallel tasks
- Serializes conflicting tasks automatically when possible
- Escalates ambiguous conflicts to the developer via human queue
- Maintains `decisions.md` as a persistent journal of structural choices

### Task management
- Backlog populated by developer (manual entry or paste from Jira ticket)
- Task states: `backlog` → `in-progress` → `done` / `blocked`
- File lock system: each in-progress task declares the files it touches
- Tasks carry acceptance criteria, source reference (e.g. Jira ticket ID), and assignee

### Agent execution
- Claude Code CLI runner — uses existing Claude subscription
- Agent receives a fully constructed `current-context.md` per task
- Agent writes a completion signal when done
- `current-context.md` deleted after task completion
- Agent updates its own `memory.md` at end of each task

### Dashboard (local web UI — localhost:7842)
- Task kanban: backlog / in-progress / done / blocked
- Agent cards: name, role, current status (idle / working / waiting), current task
- Active file locks visualization — who is touching what
- Log stream per agent (real-time)
- Orchestrator plan view
- Human queue — items requiring developer attention, with response input
- Pause / resume all agents
- Add task manually from dashboard

### Developer controls
- Agents modify code locally — no git operations performed by agents
- Dashboard shows a "ready to commit" summary when tasks complete
- Developer retains full control over git (commit, push, branch)

---

## v2 — Extended runners and richer dashboard

### Additional runners
- Anthropic API runner (requires `ANTHROPIC_API_KEY`)
- OpenAI API runner (requires `OPENAI_API_KEY`)
- Runner specified per agent in `agents.yaml` — mix and match

### Dashboard enhancements
- Task dependency graph visualization
- File diff viewer per completed task
- Timeline view of agent activity across a session
- Agent memory inspector — read and edit `memory.md` in dashboard
- Session summary export (Markdown report of what was done)

### Agent capabilities
- Per-agent tool restrictions (e.g. read-only agent, no bash access)
- Global file exclusion list — files no agent should ever touch
- Agent scope validation — warn if agent tries to modify out-of-scope files

---

## v3 — Story Discovery and integrations

### Story Discovery mode
- Developer describes a goal in plain language (a few sentences)
- A dedicated Discovery agent asks clarifying questions
- Produces a well-formed task entry in `backlog.yaml`
- Surfaces acceptance criteria, edge cases, and open questions before work starts

### Jira integration (optional)
- Import a ticket by URL or Jira key
- Auto-populates task title, description, and acceptance criteria
- Links `done` tasks back to the Jira ticket
- No Jira account required — feature is fully optional

### Additional quality-of-life
- `maestro status` CLI command — quick terminal overview without opening the dashboard
- Multi-project support — run Maestro across several projects simultaneously
- Agent preset library — shareable `agents.yaml` configurations

---

## Explicit non-goals (v1)

- No git operations by agents (commit, push, branch, merge)
- No cloud sync or remote dashboard
- No multi-user collaboration
- No automatic Jira ticket creation or status updates
- No dry-run mode
- No agent-to-agent direct communication (all coordination goes through the orchestrator)