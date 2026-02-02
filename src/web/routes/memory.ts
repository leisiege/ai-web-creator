/**
 * Memory API Routes
 */
import { Router, Request, Response } from 'express';
import type { AgentRunner } from '../../agents/runner.js';
import type { MemoryInfo } from '../types.js';

export function memoryRouter(runner: AgentRunner): Router {
  const router = Router();

  /**
   * GET /api/memory
   * Search memories for a session/user
   */
  router.get('/', (req: Request, res: Response) => {
    try {
      const { sessionId, q, limit } = req.query;

      if (!sessionId || typeof sessionId !== 'string') {
        res.status(400).json({
          error: 'Missing or invalid sessionId parameter'
        });
        return;
      }

      const agent = runner.getAgent(sessionId);
      if (!agent) {
        res.status(404).json({
          error: 'Session not found'
        });
        return;
      }

      // Search memories
      const query = (q as string) || '';
      const memLimit = limit ? parseInt(limit as string, 10) : 20;
      const memories = agent.searchMemories(query, memLimit);

      // Convert to MemoryInfo format
      const memoryInfos: MemoryInfo[] = memories.map(m => ({
        id: m.id,
        content: m.content,
        importance: m.importance,
        tags: m.tags || [],
        createdAt: m.createdAt,
        lastAccessedAt: m.accessedAt
      }));

      res.json({
        memories: memoryInfos,
        count: memoryInfos.length
      });
    } catch (error) {
      console.error('Memory GET error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * POST /api/memory
   * Add a memory for a session
   */
  router.post('/', (req: Request, res: Response) => {
    try {
      const { sessionId, content, importance, tags } = req.body;

      if (!sessionId || !content) {
        res.status(400).json({
          error: 'Missing required fields: sessionId, content'
        });
        return;
      }

      const agent = runner.getAgent(sessionId);
      if (!agent) {
        res.status(404).json({
          error: 'Session not found'
        });
        return;
      }

      // Add memory
      const memoryId = agent.addMemory(
        content,
        importance || 1.0,
        tags || [],
        true // useUserId for cross-session memory
      );

      res.json({
        success: true,
        memoryId
      });
    } catch (error) {
      console.error('Memory POST error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  return router;
}
