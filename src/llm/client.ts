/**
 * LLM 客户端
 * 支持 GLM-4.7 (智谱AI) 和 OpenAI 兼容 API
 */
import { createLogger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';

const logger = createLogger('LLMClient');

export interface LLMConfig {
  provider: 'glm' | 'openai' | 'anthropic';
  apiKey: string;
  apiBase: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface LLMResponse {
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    parameters: Record<string, unknown>;
  }>;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: string;
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export class LLMClient {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
    logger.info(`LLM client initialized: ${config.provider} (${config.model})`);
  }

  /**
   * 发送聊天请求
   */
  async chat(
    messages: ChatMessage[],
    tools?: Array<{ name: string; description: string; parameters: Record<string, unknown> }>,
    _stream: boolean = false
  ): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      if (this.config.provider === 'glm' || this.config.apiBase.includes('zhipu')) {
        return await this.chatGLM(messages, tools);
      } else {
        return await this.chatOpenAI(messages, tools);
      }
    } catch (error) {
      logger.error('LLM request failed', error as Error);
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      logger.debug(`LLM request completed in ${duration}ms`);
    }
  }

  /**
   * GLM (智谱AI) API 调用
   */
  private async chatGLM(
    messages: ChatMessage[],
    tools?: Array<{ name: string; description: string; parameters: Record<string, unknown> }>
  ): Promise<LLMResponse> {
    const jwt = this.generateGLMToken(this.config.apiKey);

    const requestBody = {
      model: this.config.model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      stream: false
    };

    // 添加工具定义（函数调用）
    if (tools && tools.length > 0) {
      Object.assign(requestBody, {
        tools: tools.map(tool => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
          }
        }))
      });
    }

    const response = await withRetry(
      () => this.fetchGLM(jwt, requestBody),
      {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 5000,
        backoffMultiplier: 2,
        jitter: true
      }
    );

    return this.parseGLMResponse(response);
  }

  /**
   * OpenAI 兼容 API 调用
   */
  private async chatOpenAI(
    messages: ChatMessage[],
    tools?: Array<{ name: string; description: string; parameters: Record<string, unknown> }>
  ): Promise<LLMResponse> {
    const requestBody = {
      model: this.config.model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens
    };

    // 添加工具定义
    if (tools && tools.length > 0) {
      Object.assign(requestBody, {
        tools: tools.map(tool => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
          }
        }))
      });
    }

    const response = await withRetry(
      () => this.fetchOpenAI(requestBody),
      {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 5000,
        backoffMultiplier: 2,
        jitter: true
      }
    );

    return this.parseOpenAIResponse(response);
  }

  /**
   * 生成 GLM JWT Token
   */
  private generateGLMToken(apiKey: string): string {
    // GLM API key 格式: id.secret
    const [id, secret] = apiKey.split('.');
    if (!id || !secret) {
      throw new Error('Invalid GLM API key format');
    }

    // 简单实现：直接使用 API key
    // 生产环境应该生成 JWT token
    return apiKey;
  }

  /**
   * 发起 GLM API 请求
   */
  private async fetchGLM(token: string, body: Record<string, unknown>): Promise<unknown> {
    const url = this.config.apiBase.replace(/\/$/, '') + '/chat/completions';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GLM API error ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  /**
   * 发起 OpenAI API 请求
   */
  private async fetchOpenAI(body: Record<string, unknown>): Promise<unknown> {
    const url = this.config.apiBase.replace(/\/$/, '') + '/chat/completions';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  /**
   * 解析 GLM 响应
   */
  private parseGLMResponse(data: unknown): LLMResponse {
    const response = data as {
      choices?: Array<{
        message?: {
          content?: string;
          tool_calls?: Array<{
            id: string;
            function: {
              name: string;
              arguments: string;
            };
          }>;
        };
      }>;
      usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
    };

    const choice = response.choices?.[0];
    const message = choice?.message;

    if (!message) {
      throw new Error('Invalid GLM response: no message');
    }

    const result: LLMResponse = {
      content: message.content || ''
    };

    // 解析工具调用
    if (message.tool_calls && message.tool_calls.length > 0) {
      result.toolCalls = message.tool_calls.map(tc => ({
        id: tc.id,
        name: tc.function.name,
        parameters: JSON.parse(tc.function.arguments)
      }));
    }

    // 解析 token 使用
    if (response.usage) {
      result.usage = {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens
      };
    }

    return result;
  }

  /**
   * 解析 OpenAI 响应
   */
  private parseOpenAIResponse(data: unknown): LLMResponse {
    // OpenAI 格式与 GLM 类似
    return this.parseGLMResponse(data);
  }
}

/**
 * 创建 LLM 客户端
 */
export function createLLMClient(config: LLMConfig): LLMClient {
  return new LLMClient(config);
}
