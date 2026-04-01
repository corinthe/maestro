import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { initializeDatabase, seedDefaultAgents } from "../../../lib/db/index.js";

const DEFAULT_CONFIG = `heartbeat:
  enabled: true
  interval: 60
orchestrator:
  model: claude-sonnet-4-6
  maxTurns: 50
defaults:
  model: claude-sonnet-4-6
  maxTurns: 30
  permission: dangerously-skip
`;

const DEVELOPER_AGENT = `name: developer
description: General-purpose development agent
model: claude-sonnet-4-6
maxTurns: 30
permission: dangerously-skip
instructions: |
  You are a software developer. Write clean, maintainable code.
  Follow the project's existing conventions and patterns.
skills: []
`;

const QA_AGENT = `name: qa-engineer
description: QA agent that verifies work quality
model: claude-sonnet-4-6
maxTurns: 20
permission: dangerously-skip
instructions: |
  You are a QA engineer. Review code changes, run tests,
  and verify that features work correctly before marking them done.
skills: []
`;

export async function init(): Promise<void> {
  const cwd = process.cwd();

  // Check we're in a git repo
  if (!fs.existsSync(path.join(cwd, ".git"))) {
    console.log(pc.red("Error: Not a git repository. Please run this from a git repo root."));
    process.exit(1);
  }

  const maestroDir = path.join(cwd, ".maestro");

  // Check if already initialized
  if (fs.existsSync(maestroDir)) {
    console.log(pc.yellow("Maestro is already initialized in this repository."));
    return;
  }

  // Create .maestro/ directory
  fs.mkdirSync(maestroDir, { recursive: true });
  console.log(pc.green("Created .maestro/ directory"));

  // Create config.yml
  fs.writeFileSync(path.join(maestroDir, "config.yml"), DEFAULT_CONFIG);
  console.log(pc.green("Created .maestro/config.yml"));

  // Create agents/ directory and agent files
  const agentsDir = path.join(maestroDir, "agents");
  fs.mkdirSync(agentsDir, { recursive: true });
  fs.writeFileSync(path.join(agentsDir, "developer.yml"), DEVELOPER_AGENT);
  fs.writeFileSync(path.join(agentsDir, "qa-engineer.yml"), QA_AGENT);
  console.log(pc.green("Created .maestro/agents/ with developer and qa-engineer"));

  // Create skills/ directory
  const skillsDir = path.join(maestroDir, "skills");
  fs.mkdirSync(skillsDir, { recursive: true });
  console.log(pc.green("Created .maestro/skills/ directory"));

  // Update .gitignore
  const gitignorePath = path.join(cwd, ".gitignore");
  const dbEntry = ".maestro/db.sqlite";
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, "utf-8");
    if (!content.includes(dbEntry)) {
      fs.appendFileSync(gitignorePath, `\n${dbEntry}\n`);
      console.log(pc.green("Updated .gitignore with .maestro/db.sqlite"));
    }
  } else {
    fs.writeFileSync(gitignorePath, `${dbEntry}\n`);
    console.log(pc.green("Created .gitignore with .maestro/db.sqlite"));
  }

  // Initialize the database and seed default agents
  await initializeDatabase();
  console.log(pc.green("Initialized SQLite database"));

  seedDefaultAgents();
  console.log(pc.green("Seeded default agents (developer, qa-engineer)"));

  console.log(pc.bold(pc.green("\n✔ Maestro initialized successfully!")));
  console.log(pc.dim("Run `maestro dev` to start the dev server."));
}
