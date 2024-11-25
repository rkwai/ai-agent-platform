import { Router } from 'express';
import { AgentOrchestrator } from '../../core/services/agent-orchestrator';

export function createAgentRouter(orchestrator: AgentOrchestrator) {
  const router = Router();

  router.post('/', async (req, res) => {
    try {
      await orchestrator.createAgent(req.body);
      res.status(201).send();
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  router.get('/:agentId/state', async (req, res) => {
    try {
      const state = await orchestrator.getAgentState(req.params.agentId);
      res.json(state);
    } catch (error) {
      res.status(404).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  router.post('/:agentId/assist', async (req, res) => {
    try {
      await orchestrator.provideAssistance(req.params.agentId, req.body);
      res.status(200).send();
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  return router;
} 