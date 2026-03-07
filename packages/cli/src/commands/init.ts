import * as path from 'node:path';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { ensureDir, writeYaml, writeMarkdown, writeJson, resolveAgentsPath, fileExists } from '@maestro/core';

interface InitAnswers {
  projectName: string;
  techStack: string;
  conventions: string;
}

async function prompt(rl: readline.Interface, question: string, defaultValue: string): Promise<string> {
  const answer = await rl.question(`${question} (${defaultValue}): `);
  return answer.trim() || defaultValue;
}

async function confirm(rl: readline.Interface, question: string): Promise<boolean> {
  const answer = await rl.question(`${question} [y/N]: `);
  return answer.trim().toLowerCase() === 'y';
}

const AGENTS_YAML_CONTENT = `# agents.yaml — Agent definitions for Maestro
# Each agent has a name, role, system prompt, and runner configuration.
#
# Available runners: claude-code
#
# Set enabled: false to disable an agent without removing it.

- name: backend
  role: "Backend developer"
  runner: claude-code
  enabled: true
  systemPrompt: |
    You are a backend developer. You write clean, tested, production-ready
    server-side code. Follow the project conventions strictly.
    Focus on API endpoints, database models, and business logic.

- name: frontend
  role: "Frontend developer"
  runner: claude-code
  enabled: true
  systemPrompt: |
    You are a frontend developer. You build responsive, accessible UIs
    using the project's frontend framework. Write component tests and
    follow the established design system.

- name: security
  role: "Security auditor"
  runner: claude-code
  enabled: true
  systemPrompt: |
    You are a security auditor. Review code for vulnerabilities (OWASP Top 10),
    check authentication/authorization flows, and suggest hardening measures.
    Never modify code directly — report findings as tasks.

- name: testing
  role: "QA engineer"
  runner: claude-code
  enabled: true
  systemPrompt: |
    You are a QA engineer. Write comprehensive test suites: unit tests,
    integration tests, and edge-case scenarios. Ensure code coverage
    meets project standards.

- name: documentation
  role: "Technical writer"
  runner: claude-code
  enabled: true
  systemPrompt: |
    You are a technical writer. Maintain API docs, architecture decision
    records, and developer guides. Keep documentation in sync with code
    changes. Write clearly and concisely.
`;

function generateProjectYaml(answers: InitAnswers): Record<string, unknown> {
  return {
    project: {
      name: answers.projectName,
      techStack: answers.techStack.split(',').map((s) => s.trim()).filter(Boolean),
      conventions: answers.conventions.split(',').map((s) => s.trim()).filter(Boolean),
    },
  };
}

const GITIGNORE_SUGGESTIONS = [
  '# Maestro runtime files (add to your .gitignore)',
  '.ai-agents/logs/',
  '.ai-agents/signals/',
  '.ai-agents/agents/*/current-context.md',
  '.ai-agents/tasks/in-progress/',
  '.ai-agents/tasks/done/',
];

export async function initCommand(): Promise<void> {
  const projectRoot = process.cwd();
  const agentsRoot = resolveAgentsPath(projectRoot);

  const rl = readline.createInterface({ input, output });

  try {
    const alreadyExists = await fileExists(agentsRoot);
    if (alreadyExists) {
      console.log('A .ai-agents/ directory already exists in this project.');
      const overwrite = await confirm(rl, 'Do you want to reinitialize? Existing files will be preserved.');
      if (!overwrite) {
        console.log('Initialization cancelled.');
        return;
      }
    }

    // Interactive questions
    const answers: InitAnswers = {
      projectName: await prompt(rl, 'Project name', path.basename(projectRoot)),
      techStack: await prompt(rl, 'Tech stack (comma-separated, e.g. Node.js, React, PostgreSQL)', 'TypeScript, Node.js'),
      conventions: await prompt(rl, 'Main conventions (comma-separated, e.g. ESLint, Prettier, conventional commits)', 'ESLint, Prettier'),
    };

    console.log('\nCreating .ai-agents/ directory structure...\n');

    // Create directory tree
    const dirs = [
      'config',
      'orchestrator',
      'tasks',
      'tasks/in-progress',
      'tasks/done',
      'tasks/blocked',
      'agents',
      'signals',
      'logs',
      'human-queue',
    ];

    for (const dir of dirs) {
      await ensureDir(resolveAgentsPath(projectRoot, dir));
    }

    // Generate agents.yaml with commented templates
    const agentsYamlPath = resolveAgentsPath(projectRoot, 'config', 'agents.yaml');
    if (!(await fileExists(agentsYamlPath))) {
      await writeMarkdown(agentsYamlPath, AGENTS_YAML_CONTENT);
      console.log('  Created config/agents.yaml (with example templates)');
    } else {
      console.log('  Skipped config/agents.yaml (already exists)');
    }

    // Generate project.yaml
    const projectYamlPath = resolveAgentsPath(projectRoot, 'config', 'project.yaml');
    if (!(await fileExists(projectYamlPath))) {
      await writeYaml(projectYamlPath, generateProjectYaml(answers));
      console.log('  Created config/project.yaml');
    } else {
      console.log('  Skipped config/project.yaml (already exists)');
    }

    // Create orchestrator placeholder files
    const planPath = resolveAgentsPath(projectRoot, 'orchestrator', 'plan.md');
    if (!(await fileExists(planPath))) {
      await writeMarkdown(planPath, '# Orchestrator Plan\n\n_No active plan yet._\n');
      console.log('  Created orchestrator/plan.md');
    }

    const decisionsPath = resolveAgentsPath(projectRoot, 'orchestrator', 'decisions.md');
    if (!(await fileExists(decisionsPath))) {
      await writeMarkdown(decisionsPath, '# Decisions Log\n\n_No decisions recorded yet._\n');
      console.log('  Created orchestrator/decisions.md');
    }

    const taskGraphPath = resolveAgentsPath(projectRoot, 'orchestrator', 'task-graph.json');
    if (!(await fileExists(taskGraphPath))) {
      await writeJson(taskGraphPath, { tasks: [], edges: [] });
      console.log('  Created orchestrator/task-graph.json');
    }

    // Create empty backlog
    const backlogPath = resolveAgentsPath(projectRoot, 'tasks', 'backlog.yaml');
    if (!(await fileExists(backlogPath))) {
      await writeYaml(backlogPath, { tasks: [] });
      console.log('  Created tasks/backlog.yaml');
    }

    console.log('\nInitialization complete!\n');

    // Suggest .gitignore additions
    console.log('Suggested .gitignore additions:');
    console.log('---');
    for (const line of GITIGNORE_SUGGESTIONS) {
      console.log(line);
    }
    console.log('---');
    console.log('\nRun `maestro start` to launch the orchestrator and dashboard.\n');
  } finally {
    rl.close();
  }
}
