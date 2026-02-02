/**
 * Chat API Routes
 */
import { Router, Request, Response } from 'express';
import type { AgentRunner } from '../../agents/runner.js';
import type { ChatRequest, ChatResponse } from '../types.js';

export function chatRouter(runner: AgentRunner): Router {
  const router = Router();

  /**
   * POST /api/chat
   * Send a message and get AI response
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { userId, sessionId, message }: ChatRequest = req.body;

      // Validate request
      if (!userId || !message) {
        res.status(400).json({
          error: 'Missing required fields: userId, message'
        });
        return;
      }

      if (typeof message !== 'string' || message.trim().length === 0) {
        res.status(400).json({
          error: 'Message must be a non-empty string'
        });
        return;
      }

      console.log(`[Chat API] Processing message for user ${userId}, session ${sessionId || 'new'}`);

      // Run agent
      const result = await runner.run({
        userId,
        sessionId,
        message
      });

      // Ensure response is not empty
      const responseContent = result.response || '抱歉，我没有生成有效的回复。';

      const response: ChatResponse = {
        response: responseContent,
        sessionId: result.sessionId,
        timestamp: result.timestamp,
        duration: result.duration
      };

      console.log(`[Chat API] Response generated: ${responseContent.slice(0, 50)}...`);

      res.json(response);
    } catch (error) {
      console.error('[Chat API] Error:', error);

      // Ensure we always return valid JSON even on error
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
        response: '抱歉，处理您的请求时出现了错误。',
        sessionId: req.body.sessionId || '',
        timestamp: Date.now(),
        duration: 0
      });
    }
  });

  return router;
}
