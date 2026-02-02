/**
 * Agent 运行器
 * 参考 clawdbot 的 agent-runner 设计
 * 提供统一的 Agent 执行入口
 */
import { Agent } from './agent.js';
import { MemoryStore } from '../memory/index.js';
import { loadConfig } from '../config/config.js';
import { ToolRegistry } from './tools/index.js';
import { LLMClient, createLLMClient } from '../llm/index.js';
import { createLogger } from '../utils/logger.js';
import { generateId } from '../utils/id.js';

const logger = createLogger('AgentRunner');

export interface RunnerConfig {
  configPath?: string;
  toolRegistry?: ToolRegistry;
}

export interface RunOptions {
  sessionId?: string;
  userId: string;
  message: string;
  systemPrompt?: string;
}

export interface RunResult {
  response: string;
  sessionId: string;
  timestamp: number;
  duration: number;
}

/**
 * Agent 运行器类
 */
export class AgentRunner {
  private config: ReturnType<typeof loadConfig>;
  private memory: MemoryStore;
  private toolRegistry: ToolRegistry;
  private llmClient: LLMClient;
  private agents: Map<string, Agent> = new Map();

  constructor(options: RunnerConfig = {}) {
    // 加载配置
    this.config = loadConfig(options.configPath);

    // 初始化 LLM 客户端
    const llmConfig = this.config.getLLMConfig();
    this.llmClient = createLLMClient({
      provider: llmConfig.provider as 'glm' | 'openai' | 'anthropic',
      apiKey: llmConfig.apiKey,
      apiBase: llmConfig.apiBase,
      model: llmConfig.model,
      maxTokens: llmConfig.maxTokens,
      temperature: llmConfig.temperature
    });

    // 初始化记忆存储
    const memoryConfig = this.config.getMemoryConfig();
    this.memory = new MemoryStore(memoryConfig.path);

    // 初始化工具注册表
    this.toolRegistry = options.toolRegistry || new ToolRegistry();

    logger.info('AgentRunner initialized');
  }

  /**
   * 运行单次对话
   */
  async run(options: RunOptions): Promise<RunResult> {
    const startTime = Date.now();
    const sessionId = options.sessionId || generateId();

    logger.info(`Running agent for session: ${sessionId}, user: ${options.userId}`);

    try {
      // 获取或创建 Agent
      let agent = this.agents.get(sessionId);

      if (!agent) {
        agent = this.createAgent(sessionId, options.userId, options.systemPrompt);
        this.agents.set(sessionId, agent);
      }

      // 处理消息
      const response = await agent.process(options.message);

      const result: RunResult = {
        response: response.content,
        sessionId,
        timestamp: Date.now(),
        duration: Date.now() - startTime
      };

      logger.info(`Agent run completed in ${result.duration}ms`);

      return result;
    } catch (error) {
      logger.error('Agent run failed', error as Error);
      throw error;
    }
  }

  /**
   * 创建新 Agent
   */
  private createAgent(sessionId: string, userId: string, systemPrompt?: string): Agent {
    return new Agent(
      {
        sessionId,
        userId,
        systemPrompt,
        toolRegistry: this.toolRegistry,
        llmClient: this.llmClient
      },
      this.memory
    );
  }

  /**
   * 获取现有 Agent
   */
  getAgent(sessionId: string): Agent | undefined {
    return this.agents.get(sessionId);
  }

  /**
   * 移除 Agent
   */
  removeAgent(sessionId: string): boolean {
    return this.agents.delete(sessionId);
  }

  /**
   * 清理所有 Agent
   */
  cleanup(): void {
    this.agents.clear();
    logger.info('All agents cleaned up');
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      activeAgents: this.agents.size,
      config: this.config.getConfig(),
      toolCount: this.toolRegistry.getToolNames().length
    };
  }

  /**
   * 关闭运行器
   */
  shutdown(): void {
    this.cleanup();
    this.memory.close();
    logger.info('AgentRunner shutdown complete');
  }
}

/**
 * 创建默认运行器实例
 */
let defaultRunner: AgentRunner | null = null;

export function createRunner(options?: RunnerConfig): AgentRunner {
  if (!defaultRunner) {
    defaultRunner = new AgentRunner(options);
  }
  return defaultRunner;
}

export function getRunner(): AgentRunner {
  if (!defaultRunner) {
    throw new Error('Runner not initialized. Call createRunner() first.');
  }
  return defaultRunner;
}
