/**
 * Sessions API Routes
 */
import { Router, Request, Response } from 'express';
import type { AgentRunner } from '../../agents/runner.js';
import type { SessionInfo } from '../types.js';

export function sessionsRouter(runner: AgentRunner): Router {
  const router = Router();

  /**
   * GET /api/sessions
   * Get all sessions for a user
   */
  router.get('/', (req: Request, res: Response) => {
    try {
      const { userId } = req.query;

      if (!userId || typeof userId !== 'string') {
        res.status(400).json({
          error: 'Missing or invalid userId parameter'
        });
        return;
      }

      const stats = runner.getStats();
      // For now, return empty array as we don't track all sessions
      // This could be extended to query from memory store
      res.json({
        sessions: [] as SessionInfo[],
        activeAgents: stats.activeAgents
      });
    } catch (error) {
      console.error('Sessions GET error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * GET /api/sessions/:sessionId/info
   * Get session information
   * NOTE: Must be defined before /:sessionId to avoid route conflicts
   */
  router.get('/:sessionId/info', (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      if (!sessionId || typeof sessionId !== 'string') {
        res.status(400).json({
          error: 'Missing sessionId parameter'
        });
        return;
      }

      const agent = runner.getAgent(sessionId);
      if (agent) {
        const info = agent.getSessionInfo();
        res.json(info);
      } else {
        res.status(404).json({
          error: 'Session not found'
        });
      }
    } catch (error) {
      console.error('Session info GET error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * DELETE /api/sessions/:sessionId
   * Clear session history
   */
  router.delete('/:sessionId', (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      if (!sessionId || typeof sessionId !== 'string') {
        res.status(400).json({
          error: 'Missing sessionId parameter'
        });
        return;
      }

      const agent = runner.getAgent(sessionId);
      if (agent) {
        agent.clearHistory();
        res.json({ success: true, message: 'Session history cleared' });
      } else {
        res.status(404).json({
          error: 'Session not found'
        });
      }
    } catch (error) {
      console.error('Sessions DELETE error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  return router;
}
