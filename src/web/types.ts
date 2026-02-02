/**
 * Web Module Type Definitions
 */

export interface ChatRequest {
  userId: string;
  sessionId?: string;
  message: string;
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

export interface HealthResponse {
  status: string;
  uptime: number;
  activeAgents?: number;
}
