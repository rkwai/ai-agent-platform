import express from 'express';
import cors from 'cors';
import { EventStore } from '../core/events/event-store';
import { ToolRegistry } from '../core/tools/registry';
import { AgentManager } from '../core/agents/manager';
import { AgentOrchestrator } from '../core/services/agent-orchestrator';
import { createAgentRouter } from './routes/agents';
import { Database } from '../core/types/database';
import { NotificationService } from '../core/services/notification';

async function createServer(db: Database) {
  const app = express();
  
  // Initialize core services
  const eventStore = new EventStore(db);
  const toolRegistry = new ToolRegistry(eventStore);
  const notificationService = new NotificationService();
  const agentManager = new AgentManager(eventStore, toolRegistry, notificationService);
  const orchestrator = new AgentOrchestrator(agentManager, toolRegistry, eventStore);

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Routes
  app.use('/api/agents', createAgentRouter(orchestrator));

  return app;
}

export { createServer }; 