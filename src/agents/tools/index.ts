/**
 * 工具注册表
 * 管理所有可用的 Agent 工具
 */
import { AgentTool } from './base.js';
import { HttpRequestTool } from './http.js';
import { WebScraperTool } from './scraper.js';
import { createLogger } from '../../utils/logger.js';

// Re-export base class
export { AgentTool } from './base.js';
export { HttpRequestTool } from './http.js';
export { WebScraperTool } from './scraper.js';

const logger = createLogger('ToolRegistry');

export class ToolRegistry {
  private tools: Map<string, AgentTool> = new Map();

  constructor() {
    // 注册默认工具
    this.register(new HttpRequestTool());
    this.register(new WebScraperTool());
  }

  /**
   * 注册新工具
   */
  register(tool: AgentTool): void {
    const name = tool.getName();
    if (this.tools.has(name)) {
      logger.warn(`Tool ${name} is already registered, overwriting`);
    }
    this.tools.set(name, tool);
    logger.info(`Registered tool: ${name}`);
  }

  /**
   * 获取工具
   */
  get(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  /**
   * 检查工具是否存在
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * 获取所有工具名称
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * 获取所有工具
   */
  getAllTools(): AgentTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 获取所有工具的 JSON Schema 定义
   */
  getSchemas(): Record<string, unknown>[] {
    return this.getAllTools().map(tool => tool.toJSONSchema());
  }

  /**
   * 执行工具
   */
  async execute(
    name: string,
    params: Record<string, unknown>,
    context?: { userId?: string; sessionId?: string; metadata?: Record<string, unknown> }
  ) {
    const tool = this.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }
    return tool.executeSafe(params, context);
  }

  /**
   * 注销工具
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * 清空所有工具
   */
  clear(): void {
    this.tools.clear();
    logger.info('All tools unregistered');
  }
}

// 创建默认工具注册表实例
export const defaultToolRegistry = new ToolRegistry();
