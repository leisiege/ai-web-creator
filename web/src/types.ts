/**
 * Frontend Type Definitions
 */

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ChatResponse {
  response: string;
  sessionId: string;
  timestamp: number;
  duration: number;
}

export interface SessionInfo {
  sessionId: string;
  userId: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export interface MemoryInfo {
  id: string;
  content: string;
  importance: number;
  tags: string[];
  createdAt: number;
  lastAccessedAt: number;
}
