/**
 * 通用类型定义
 */

export interface ToolCallResult {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  default?: unknown;
}

export interface ToolContext {
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface Message {
  id?: string;
  sessionId?: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp?: number;
  toolCallId?: string;
  toolName?: string;
}

export interface AgentConfig {
  agent: {
    name: string;
    version: string;
    description: string;
  };
  llm: {
    provider: string;
    apiKey: string;
    model: string;
    apiBase: string;
    maxTokens: number;
    temperature: number;
  };
  memory: {
    type: string;
    path: string;
    maxHistory: number;
    maxContextTokens: number;
  };
  retry: {
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
    jitter: boolean;
  };
  tools: Record<string, unknown>;
  logging: {
    level: string;
    format: string;
  };
}

export interface RetryOptions {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}
