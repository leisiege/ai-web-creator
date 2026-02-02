/**
 * API Client
 */
import type { ChatResponse, SessionInfo, MemoryInfo } from '../types.js';

const API_BASE = '/api';

export interface SendChatOptions {
  userId: string;
  sessionId?: string;
  message: string;
}

/**
 * Send a chat message
 */
export async function sendChat(options: SendChatOptions): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send message');
  }

  return response.json();
}

/**
 * Get sessions for a user
 */
export async function getSessions(userId: string): Promise<{ sessions: SessionInfo[]; activeAgents: number }> {
  const response = await fetch(`${API_BASE}/sessions?userId=${encodeURIComponent(userId)}`);

  if (!response.ok) {
    throw new Error('Failed to get sessions');
  }

  return response.json();
}

/**
 * Get session info
 */
export async function getSessionInfo(sessionId: string): Promise<SessionInfo> {
  const response = await fetch(`${API_BASE}/sessions/${sessionId}/info`);

  if (!response.ok) {
    throw new Error('Failed to get session info');
  }

  return response.json();
}

/**
 * Clear session history
 */
export async function clearSession(sessionId: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/sessions/${sessionId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to clear session');
  }

  return response.json();
}

/**
 * Search memories
 */
export async function searchMemories(sessionId: string, query: string, limit: number = 20): Promise<{ memories: MemoryInfo[]; count: number }> {
  const params = new URLSearchParams({
    sessionId,
    limit: limit.toString(),
  });

  if (query) {
    params.set('q', query);
  }

  const response = await fetch(`${API_BASE}/memory?${params}`);

  if (!response.ok) {
    throw new Error('Failed to search memories');
  }

  return response.json();
}

/**
 * Add memory
 */
export async function addMemory(sessionId: string, content: string, importance: number = 1.0, tags: string[] = []): Promise<{ success: boolean; memoryId: string }> {
  const response = await fetch(`${API_BASE}/memory`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId,
      content,
      importance,
      tags,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to add memory');
  }

  return response.json();
}

/**
 * Health check
 */
export async function healthCheck(): Promise<{ status: string; uptime: number; activeAgents?: number }> {
  const response = await fetch(`${API_BASE}/health`);

  if (!response.ok) {
    throw new Error('Health check failed');
  }

  return response.json();
}
