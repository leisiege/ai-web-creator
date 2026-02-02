/**
 * Agent 核心
 * 参考 clawdbot 的 Agent 设计模式
 */
import type { Message, ToolContext } from '../utils/types.js';
import { MemoryStore } from '../memory/index.js';
import { ToolRegistry, defaultToolRegistry } from './tools/index.js';
import { LLMClient, type ChatMessage } from '../llm/index.js';
import { createLogger } from '../utils/logger.js';
import { generateId } from '../utils/id.js';

const logger = createLogger('Agent');

export interface AgentOptions {
  sessionId: string;
  userId: string;
  systemPrompt?: string;
  toolRegistry?: ToolRegistry;
  llmClient: LLMClient;
}

export interface AgentResponse {
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

export class Agent {
  private sessionId: string;
  private userId: string;
  private systemPrompt: string;
  private memory: MemoryStore;
  private toolRegistry: ToolRegistry;
  private llmClient: LLMClient;
  private context: Map<string, unknown> = new Map();

  constructor(options: AgentOptions, memory: MemoryStore) {
    this.sessionId = options.sessionId;
    this.userId = options.userId;
    this.memory = memory;
    this.toolRegistry = options.toolRegistry || defaultToolRegistry;
    this.llmClient = options.llmClient;
    this.systemPrompt = options.systemPrompt || this.getDefaultSystemPrompt();

    // 确保会话存在
    this.initializeSession();
  }

  /**
   * 获取默认系统提示
   */
  private getDefaultSystemPrompt(): string {
    const tools = this.toolRegistry.getSchemas();
    const toolDescriptions = tools.map(t => `- ${t.name}: ${t.description}`).join('\n');

    return `You are a helpful AI assistant with access to the following tools:

${toolDescriptions}

When you need to use a tool, respond with a function call in the format:
{ "tool_calls": [ { "name": "tool_name", "parameters": { ... } } ] }

Always be helpful and provide clear, concise responses.`;
  }

  /**
   * 初始化会话
   */
  private initializeSession(): void {
    if (!this.memory.sessionExists(this.sessionId)) {
      this.memory.createSession(this.sessionId, this.userId);
      logger.info(`Created new session: ${this.sessionId}`);
    }
  }

  /**
   * 处理用户消息并生成响应
   */
  async process(userMessage: string): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      logger.info(`Processing message for session: ${this.sessionId}`);

      // 1. 保存用户消息
      const userMsg: Message = {
        id: generateId(),
        role: 'user',
        content: userMessage,
        timestamp: Date.now()
      };
      this.memory.addMessage(userMsg, this.sessionId);

      // 2. 获取对话历史
      const history = this.buildConversationHistory();

      // 3. 调用 LLM 生成响应
      const response = await this.generateResponse(history);

      // 4. 处理工具调用
      let finalResponse = response;
      if (response.toolCalls && response.toolCalls.length > 0) {
        finalResponse = await this.handleToolCalls(response);
      }

      // 5. 保存助手响应
      if (finalResponse.content) {
        const assistantMsg: Message = {
          id: generateId(),
          role: 'assistant',
          content: finalResponse.content,
          timestamp: Date.now()
        };
        this.memory.addMessage(assistantMsg, this.sessionId);
      }

      const duration = Date.now() - startTime;
      logger.info(`Message processed in ${duration}ms`);

      return finalResponse;
    } catch (error) {
      logger.error('Error processing message', error as Error);
      throw error;
    }
  }

  /**
   * 构建对话历史
   */
  private buildConversationHistory(): Message[] {
    const messages = this.memory.getMessages(this.sessionId);

    // 添加系统提示
    const history: Message[] = [
      {
        id: generateId(),
        role: 'system',
        content: this.systemPrompt,
        timestamp: Date.now()
      }
    ];

    history.push(...messages);
    return history;
  }

  /**
   * 生成响应 - 调用 LLM API
   */
  private async generateResponse(history: Message[]): Promise<AgentResponse> {
    // 转换为 LLM 客户端需要的格式
    const chatMessages: ChatMessage[] = history.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // 获取工具定义并转换为 LLM 需要的格式
    const toolSchemas = this.toolRegistry.getSchemas();
    const tools = toolSchemas.map(schema => ({
      name: schema.name as string,
      description: schema.description as string,
      parameters: schema.parameters as Record<string, unknown>
    }));

    // 调用 LLM
    const llmResponse = await this.llmClient.chat(chatMessages, tools);

    logger.debug('LLM response received', {
      contentLength: llmResponse.content?.length || 0,
      toolCalls: llmResponse.toolCalls?.length || 0,
      usage: llmResponse.usage
    });

    return {
      content: llmResponse.content || '',
      toolCalls: llmResponse.toolCalls,
      usage: llmResponse.usage
    };
  }

  /**
   * 处理工具调用
   */
  private async handleToolCalls(response: AgentResponse): Promise<AgentResponse> {
    if (!response.toolCalls || response.toolCalls.length === 0) {
      return response;
    }

    const results: Array<{
      toolName: string;
      success: boolean;
      result?: unknown;
      error?: string;
    }> = [];

    // 执行所有工具调用
    for (const toolCall of response.toolCalls) {
      logger.info(`Executing tool: ${toolCall.name}`);

      try {
        const context: ToolContext = {
          userId: this.userId,
          sessionId: this.sessionId
        };

        const toolResult = await this.toolRegistry.execute(
          toolCall.name,
          toolCall.parameters,
          context
        );

        // 记录工具调用
        this.memory.addToolCall({
          id: generateId(),
          sessionId: this.sessionId,
          toolName: toolCall.name,
          parameters: toolCall.parameters,
          result: toolResult,
          success: toolResult.success,
          timestamp: Date.now()
        });

        results.push({
          toolName: toolCall.name,
          success: toolResult.success,
          result: toolResult.data,
          error: toolResult.error
        });

        logger.info(`Tool ${toolCall.name} completed: ${toolResult.success}`);
      } catch (error) {
        logger.error(`Tool ${toolCall.name} failed`, error as Error);

        this.memory.addToolCall({
          id: generateId(),
          sessionId: this.sessionId,
          toolName: toolCall.name,
          parameters: toolCall.parameters,
          success: false,
          timestamp: Date.now()
        });

        results.push({
          toolName: toolCall.name,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // 构建包含工具结果的响应
    const toolSummary = results.map(r => {
      if (r.success) {
        return `\nTool ${r.toolName} result: ${JSON.stringify(r.result, null, 2)}`;
      } else {
        return `\nTool ${r.toolName} failed: ${r.error}`;
      }
    }).join('\n');

    return {
      content: response.content + toolSummary,
      toolCalls: response.toolCalls,
      usage: response.usage
    };
  }

  /**
   * 添加长期记忆
   */
  addMemory(content: string, importance: number = 1.0, tags?: string[]): string {
    return this.memory.addMemory(content, this.sessionId, importance, tags);
  }

  /**
   * 搜索记忆
   */
  searchMemories(query: string, limit: number = 10) {
    return this.memory.searchMemories(query, this.sessionId, limit);
  }

  /**
   * 获取会话信息
   */
  getSessionInfo() {
    return this.memory.getSession(this.sessionId);
  }

  /**
   * 清除会话历史
   */
  clearHistory(): void {
    this.memory.clearMessages(this.sessionId);
    logger.info(`Cleared history for session: ${this.sessionId}`);
  }

  /**
   * 设置上下文数据
   */
  setContext(key: string, value: unknown): void {
    this.context.set(key, value);
  }

  /**
   * 获取上下文数据
   */
  getContext(key: string): unknown {
    return this.context.get(key);
  }

  /**
   * 更新系统提示
   */
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
    logger.debug('System prompt updated');
  }
}
