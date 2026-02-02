/**
 * 配置管理模块
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import type { AgentConfig } from '../utils/types.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Config');

export class ConfigManager {
  private config: AgentConfig;
  private configPath: string;

  constructor(configPath: string) {
    this.configPath = resolve(configPath);
    this.config = this.loadConfig();
    logger.info(`Configuration loaded from: ${this.configPath}`);
  }

  /**
   * 加载配置文件
   */
  private loadConfig(): AgentConfig {
    if (!existsSync(this.configPath)) {
      throw new Error(`Configuration file not found: ${this.configPath}`);
    }

    try {
      const content = readFileSync(this.configPath, 'utf-8');
      const config = JSON.parse(content) as AgentConfig;
      this.validateConfig(config);
      return config;
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw error;
      }
      throw new Error(`Failed to parse configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 验证配置结构
   */
  private validateConfig(config: AgentConfig): void {
    const required = ['agent', 'llm', 'memory', 'retry'];
    for (const key of required) {
      if (!(key in config)) {
        throw new Error(`Missing required configuration section: ${key}`);
      }
    }

    // 验证 agent 部分
    if (!config.agent.name || !config.agent.version) {
      throw new Error('Invalid agent configuration: missing name or version');
    }

    // 验证 llm 部分
    if (!config.llm.provider || !config.llm.model) {
      throw new Error('Invalid LLM configuration: missing provider or model');
    }

    logger.debug('Configuration validation passed');
  }

  /**
   * 获取完整配置
   */
  getConfig(): AgentConfig {
    return this.config;
  }

  /**
   * 获取 agent 配置
   */
  getAgentConfig() {
    return this.config.agent;
  }

  /**
   * 获取 LLM 配置
   */
  getLLMConfig() {
    return this.config.llm;
  }

  /**
   * 获取记忆存储配置
   */
  getMemoryConfig() {
    return this.config.memory;
  }

  /**
   * 获取记忆过期配置
   */
  getMemoryExpiryConfig() {
    return this.config.memory.expiry;
  }

  /**
   * 获取重试配置
   */
  getRetryConfig() {
    return this.config.retry;
  }

  /**
   * 获取工具配置
   */
  getToolConfig(toolName: string): Record<string, unknown> | undefined {
    return this.config.tools[toolName] as Record<string, unknown> | undefined;
  }

  /**
   * 检查工具是否启用
   */
  isToolEnabled(toolName: string): boolean {
    const toolConfig = this.getToolConfig(toolName);
    return toolConfig ? (toolConfig.enabled as boolean) ?? true : false;
  }

  /**
   * 获取日志配置
   */
  getLoggingConfig() {
    return this.config.logging;
  }

  /**
   * 重新加载配置
   */
  reload(): void {
    this.config = this.loadConfig();
    logger.info('Configuration reloaded');
  }

  /**
   * 获取配置文件所在目录
   */
  getConfigDir(): string {
    return dirname(this.configPath);
  }
}

/**
 * 创建配置管理器（单例模式）
 */
let configManagerInstance: ConfigManager | null = null;

export function loadConfig(configPath?: string): ConfigManager {
  if (!configManagerInstance) {
    const defaultPath = configPath || './config/agent.config.json';
    configManagerInstance = new ConfigManager(defaultPath);
  }
  return configManagerInstance;
}

export function getConfig(): ConfigManager {
  if (!configManagerInstance) {
    throw new Error('Configuration not loaded. Call loadConfig() first.');
  }
  return configManagerInstance;
}
