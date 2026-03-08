import { Router } from 'express';
import * as fs from 'node:fs/promises';
import type { WebSocketServer } from 'ws';
import type { AgentState } from '@maestro/core';
import { resolveAgentsPath, readYaml, writeYaml, readJson } from '@maestro/core';
import type { AgentConfig } from '../types.js';
import { appendLog } from '../logger.js';
import { broadcast } from '../broadcast.js';

export function createAgentRoutes(wss: WebSocketServer, projectRoot: string) {
  const router = Router();

  router.get('/api/agents', async (_req, res) => {
    try {
      const configPath = resolveAgentsPath(projectRoot, 'config', 'agents.yaml');
      const agentDefs = await readYaml<AgentConfig[]>(configPath).catch((): AgentConfig[] => []);

      const agentsDir = resolveAgentsPath(projectRoot, 'agents');
      const result: (AgentConfig & AgentState)[] = [];
      const normalizedDefs = Array.isArray(agentDefs) ? agentDefs : [];

      for (const def of normalizedDefs) {
        const statePath = `${agentsDir}/${def.name}/state.json`;
        const state = await readJson<AgentState>(statePath).catch((): AgentState => ({
          name: def.name,
          status: 'idle',
        }));
        result.push({ ...def, ...state, enabled: def.enabled !== false });
      }

      try {
        const entries = await fs.readdir(agentsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          if (normalizedDefs.some((a) => a.name === entry.name)) continue;
          const statePath = `${agentsDir}/${entry.name}/state.json`;
          const state = await readJson<AgentState>(statePath).catch((): AgentState => ({
            name: entry.name,
            status: 'idle',
          }));
          result.push({ role: 'unknown', ...state, name: entry.name });
        }
      } catch { /* agents/ may not exist */ }

      res.json(result);
    } catch {
      res.status(500).json({ error: 'Failed to load agents' });
    }
  });

  router.post('/api/agents', async (req, res) => {
    try {
      const { name, role, runner, model, systemPrompt, enabled } = req.body as Record<string, unknown>;

      if (!name || !role) {
        res.status(400).json({ error: 'name and role are required' });
        return;
      }

      const configPath = resolveAgentsPath(projectRoot, 'config', 'agents.yaml');
      const agentDefs = await readYaml<AgentConfig[]>(configPath).catch((): AgentConfig[] => []);
      const agents = Array.isArray(agentDefs) ? agentDefs : [];

      if (agents.some((a) => a.name === String(name))) {
        res.status(409).json({ error: `Agent "${name}" already exists` });
        return;
      }

      const newAgent: AgentConfig = {
        name: String(name),
        role: String(role),
        runner: String(runner || 'claude-code'),
        model: model ? String(model) : undefined,
        systemPrompt: systemPrompt ? String(systemPrompt) : undefined,
        enabled: enabled !== false,
      };

      agents.push(newAgent);
      await writeYaml(configPath, agents);

      appendLog({ timestamp: new Date().toISOString(), agent: 'system', level: 'info', message: `Agent created: ${newAgent.name}` });
      broadcast(wss, { type: 'agent-created', agent: newAgent });

      res.status(201).json(newAgent);
    } catch {
      res.status(500).json({ error: 'Failed to create agent' });
    }
  });

  router.patch('/api/agents/:name', async (req, res) => {
    try {
      const { name } = req.params;
      const updates = req.body as Partial<AgentConfig>;

      const configPath = resolveAgentsPath(projectRoot, 'config', 'agents.yaml');
      const agentDefs = await readYaml<AgentConfig[]>(configPath).catch((): AgentConfig[] => []);
      const agents = Array.isArray(agentDefs) ? agentDefs : [];

      const idx = agents.findIndex((a) => a.name === name);
      if (idx === -1) {
        res.status(404).json({ error: `Agent "${name}" not found` });
        return;
      }

      if (updates.role !== undefined) agents[idx].role = updates.role;
      if (updates.runner !== undefined) agents[idx].runner = updates.runner;
      if (updates.model !== undefined) agents[idx].model = updates.model;
      if (updates.systemPrompt !== undefined) agents[idx].systemPrompt = updates.systemPrompt;
      if (updates.enabled !== undefined) agents[idx].enabled = updates.enabled;

      await writeYaml(configPath, agents);

      const action = updates.enabled === false ? 'disabled' : updates.enabled === true ? 'enabled' : 'updated';
      appendLog({ timestamp: new Date().toISOString(), agent: 'system', level: 'info', message: `Agent ${action}: ${name}` });
      broadcast(wss, { type: 'agent-updated', agent: agents[idx] });

      res.json(agents[idx]);
    } catch {
      res.status(500).json({ error: 'Failed to update agent' });
    }
  });

  router.delete('/api/agents/:name', async (req, res) => {
    try {
      const { name } = req.params;

      const configPath = resolveAgentsPath(projectRoot, 'config', 'agents.yaml');
      const agentDefs = await readYaml<AgentConfig[]>(configPath).catch((): AgentConfig[] => []);
      const agents = Array.isArray(agentDefs) ? agentDefs : [];

      const idx = agents.findIndex((a) => a.name === name);
      if (idx === -1) {
        res.status(404).json({ error: `Agent "${name}" not found` });
        return;
      }

      agents.splice(idx, 1);
      await writeYaml(configPath, agents);

      appendLog({ timestamp: new Date().toISOString(), agent: 'system', level: 'info', message: `Agent deleted: ${name}` });
      broadcast(wss, { type: 'agent-deleted', name });

      res.json({ deleted: name });
    } catch {
      res.status(500).json({ error: 'Failed to delete agent' });
    }
  });

  return router;
}
